import {randomBytes,createHmac,createHash,createCipheriv,createDecipheriv,timingSafeEqual} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function encodeSecret(bytes){let bits=0,value=0,out='';for(const b of bytes){value=(value<<8)|b;bits+=8;while(bits>=5){out+=alphabet[(value>>>(bits-5))&31];bits-=5}}if(bits)out+=alphabet[(value<<(5-bits))&31];return out}
function decodeSecret(s){let bits=0,value=0,out=[];for(const c of s){const v=alphabet.indexOf(c);if(v<0)throw Error('Invalid secret');value=(value<<5)|v;bits+=5;if(bits>=8){out.push((value>>>(bits-8))&255);bits-=8}}return Buffer.from(out)}
export function totp(secret,step=Math.floor(Date.now()/30000)){const counter=Buffer.alloc(8);counter.writeBigUInt64BE(BigInt(step));const digest=createHmac('sha1',decodeSecret(secret)).update(counter).digest(),offset=digest[19]&15;return String((digest.readUInt32BE(offset)&0x7fffffff)%1000000).padStart(6,'0')}
const hash=s=>createHash('sha256').update(s).digest('hex');
export function createStaffSecurity({db,data,fail,audit,now,passwordValid,limit}){
 const keyFile=path.join(data,'staff-mfa.key');if(!fs.existsSync(keyFile))fs.writeFileSync(keyFile,randomBytes(32),{mode:0o600,flag:'wx'});const key=fs.readFileSync(keyFile);if(key.length!==32)throw Error('Invalid MFA encryption key');
 const encrypt=s=>{const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',key,iv);return Buffer.concat([iv,c.update(s),c.final(),c.getAuthTag()]).toString('base64')};
 const decrypt=s=>{const b=Buffer.from(s,'base64'),c=createDecipheriv('aes-256-gcm',key,b.subarray(0,12));c.setAuthTag(b.subarray(-16));return Buffer.concat([c.update(b.subarray(12,-16)),c.final()]).toString()};
 db.exec(`CREATE TABLE IF NOT EXISTS staff_mfa(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,secret TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 0,expires INTEGER,last_step INTEGER NOT NULL DEFAULT -1,recovery TEXT NOT NULL DEFAULT '[]');`);
 const get=uid=>db.prepare('SELECT * FROM staff_mfa WHERE user_id=?').get(uid);
 function verify(uid,code){
  const row=get(uid);if(!row?.enabled)return;
  if(typeof code!=='string'||code.length>64)fail(401,'Authenticator code or recovery code required');
  const counter=Math.floor(Date.now()/30000),secret=decrypt(row.secret);
  for(let step=counter-1;step<=counter+1;step++){if(step<=row.last_step)continue;const expected=totp(secret,step);if(/^[0-9]{6}$/.test(code)&&timingSafeEqual(Buffer.from(expected),Buffer.from(code))){db.prepare('UPDATE staff_mfa SET last_step=? WHERE user_id=?').run(step,uid);return}}
  const codes=JSON.parse(row.recovery),index=codes.indexOf(hash(code));if(index>=0){codes.splice(index,1);db.prepare('UPDATE staff_mfa SET recovery=? WHERE user_id=?').run(JSON.stringify(codes),uid);audit(uid,'staff.mfa.recovery-used',uid);return}
  fail(401,'Invalid or previously used authenticator code');
 }
 async function handle(uid,action,body){
  if(action==='status')return {enabled:!!get(uid)?.enabled,recoveryRemaining:JSON.parse(get(uid)?.recovery||'[]').length};
  limit('mfa-management:'+uid,10,900000);
  if(typeof body.password!=='string'||body.password.length>128||!await passwordValid(body.password,db.prepare('SELECT password FROM users WHERE id=?').get(uid).password))fail(403,'Current password is incorrect');
  if(action==='setup'){
   if(get(uid)?.enabled)fail(409,'Two-factor authentication is already enabled');const secret=encodeSecret(randomBytes(20));
   db.prepare("INSERT INTO staff_mfa(user_id,secret,expires) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET secret=excluded.secret,expires=excluded.expires").run(uid,encrypt(secret),Date.now()+900000);
   audit(uid,'staff.mfa.setup',uid);return {secret,uri:`otpauth://totp/AM08:${uid}?secret=${secret}&issuer=AM08&digits=6&period=30`};
  }
  if(action==='enable'){
   const row=get(uid);if(!row||row.enabled||row.expires<Date.now())fail(400,'Start a new authenticator setup');
   const step=Math.floor(Date.now()/30000);if(body.code!==totp(decrypt(row.secret),step))fail(400,'Invalid authenticator code');
   const recoveryCodes=Array.from({length:8},()=>randomBytes(12).toString('hex'));
   db.prepare('UPDATE staff_mfa SET enabled=1,last_step=?,recovery=? WHERE user_id=?').run(step,JSON.stringify(recoveryCodes.map(hash)),uid);db.prepare('DELETE FROM sessions WHERE user_id=?').run(uid);audit(uid,'staff.mfa.enabled',uid);return {enabled:true,recoveryCodes};
  }
  if(action==='disable'){verify(uid,body.code);db.prepare('DELETE FROM staff_mfa WHERE user_id=?').run(uid);db.prepare('DELETE FROM sessions WHERE user_id=?').run(uid);audit(uid,'staff.mfa.disabled',uid);return {enabled:false}}
  fail(404,'Unknown security action');
 }
 return {verify,handle};
}
