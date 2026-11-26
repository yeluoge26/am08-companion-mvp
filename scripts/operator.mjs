// Run only on the trusted deployment host. Never expose this CLI over HTTP.
import {DatabaseSync} from 'node:sqlite';
import {randomBytes,scryptSync} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dir=path.resolve(process.env.DATA_DIR||path.join(root,'data'));
const [command,email]=process.argv.slice(2);
if(!['promote','reset-password','backup','verify-backup'].includes(command)){console.error('Usage: node scripts/operator.mjs promote|reset-password <email> OR backup\nPassword reset requires NEW_PASSWORD environment variable.');process.exit(1)}
if(!fs.existsSync(path.join(dir,'app.sqlite')))throw Error('Database does not exist. Start the server once first.');
const source=command==='verify-backup'?path.resolve(email||''):path.join(dir,'app.sqlite');
if(command==='verify-backup'&&(!email||!fs.existsSync(source)))throw Error('Provide a backup database path');
const db=new DatabaseSync(source,{readOnly:command==='verify-backup'});db.exec('PRAGMA busy_timeout=5000');
if(command==='verify-backup'){const integrity=db.prepare('PRAGMA integrity_check').get().integrity_check,foreignKeys=db.prepare('PRAGMA foreign_key_check').all().length;if(integrity!=='ok'||foreignKeys)throw Error('Backup integrity verification failed');console.log(JSON.stringify({integrity,foreignKeys,users:db.prepare('SELECT COUNT(*) n FROM users').get().n,characters:db.prepare('SELECT COUNT(*) n FROM characters').get().n,messages:db.prepare('SELECT COUNT(*) n FROM messages').get().n}));}
else if(command==='backup'){const file=path.join(dir,'backup-'+Date.now()+'.sqlite');db.prepare('VACUUM INTO ?').run(file);const check=new DatabaseSync(file,{readOnly:true});if(check.prepare('PRAGMA integrity_check').get().integrity_check!=='ok')throw Error('Backup integrity check failed');check.close();const key=path.join(dir,'staff-mfa.key');if(fs.existsSync(key))fs.copyFileSync(key,file+'.mfa.key');fs.chmodSync(file,0o600);if(fs.existsSync(file+'.mfa.key'))fs.chmodSync(file+'.mfa.key',0o600);console.log('Consistent database backup created: '+file)}else{
 const user=db.prepare('SELECT id,email FROM users WHERE email=?').get(String(email).toLowerCase());if(!user)throw Error('Account not found');
 db.exec('BEGIN IMMEDIATE');try{
 if(command==='promote'){
  db.prepare("UPDATE users SET role='admin' WHERE id=?").run(user.id);
  if(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='staff_roles'").get())db.prepare("INSERT INTO staff_roles VALUES(?,'superadmin','active',1,?) ON CONFLICT(user_id) DO UPDATE SET role='superadmin',status='active',version=staff_roles.version+1,updated=excluded.updated").run(user.id,new Date().toISOString());
  db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
 }
 else{const p=process.env.NEW_PASSWORD;if(!p||p.length<12||p.length>128)throw Error('Set NEW_PASSWORD to a unique 12–128 character value');const salt=randomBytes(16).toString('hex'),digest=scryptSync(p,salt,64).toString('hex');db.prepare('UPDATE users SET password=? WHERE id=?').run(salt+':'+digest,user.id);db.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);db.prepare('UPDATE password_resets SET used=1 WHERE user_id=?').run(user.id)}
 db.prepare('INSERT INTO audit VALUES(?,?,?,?,?,?)').run(randomBytes(16).toString('hex'),'operator-cli','operator.'+command,user.id,'{}',new Date().toISOString());db.exec('COMMIT');console.log(command+' completed for '+user.email);
 }catch(e){db.exec('ROLLBACK');throw e}
}
db.close();
