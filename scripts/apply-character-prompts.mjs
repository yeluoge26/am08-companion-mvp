import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {applyCharacterPersonas} from '../character-personas.mjs';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const dir=path.resolve(process.env.DATA_DIR||path.join(root,'data'));
const file=path.join(dir,'app.sqlite');
if(!fs.existsSync(file))throw Error('Database does not exist');
const apply=process.argv.includes('--apply');
const db=new DatabaseSync(file);db.exec('PRAGMA busy_timeout=5000');
try{
  if(apply){const backup=path.join(dir,'before-personas-'+Date.now()+'.sqlite');db.prepare('VACUUM INTO ?').run(backup);console.log('Backup: '+backup)}
  console.log(JSON.stringify({mode:apply?'applied':'preview',...applyCharacterPersonas(db,JSON.parse(fs.readFileSync(path.join(root,'character-personas.json'),'utf8')),{apply})}));
}finally{db.close()}
