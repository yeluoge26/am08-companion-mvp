import {randomUUID} from 'node:crypto';

// Explicit operator operation. No automatic startup overwrite of edited personas.
export function applyCharacterPersonas(db, manifest, {apply=false}={}) {
  if(manifest.version!==1||!Array.isArray(manifest.characters))throw Error('Invalid persona manifest');
  const ids=new Set();
  for(const entry of manifest.characters){
    if(typeof entry.id!=='string'||ids.has(entry.id)||typeof entry.prompt!=='string'||!entry.prompt.trim()||entry.prompt.length>3000)throw Error('Invalid or duplicate persona');
    ids.add(entry.id);
  }
  const result={updated:0,existing:0,missing:0,private:0};
  db.exec('BEGIN IMMEDIATE');
  try {
    for(const entry of manifest.characters){
      const row=db.prepare('SELECT owner_id,settings FROM characters WHERE id=?').get(entry.id);
      if(!row){result.missing++;continue}
      if(row.owner_id!==null){result.private++;continue}
      const settings=JSON.parse(row.settings||'{}');
      if(settings.prompt?.trim()){result.existing++;continue}
      result.updated++;
      if(!apply)continue;
      settings.prompt=entry.prompt;
      db.prepare('UPDATE characters SET settings=? WHERE id=?').run(JSON.stringify(settings),entry.id);
      db.prepare('INSERT INTO character_admin(character_id,version) VALUES(?,2) ON CONFLICT(character_id) DO UPDATE SET version=character_admin.version+1').run(entry.id);
      db.prepare('INSERT INTO audit VALUES(?,?,?,?,?,?)').run(randomUUID(),'operator-cli','characters.derive-persona',entry.id,JSON.stringify({method:manifest.method,confidence:entry.confidence,sourceSha256:entry.sourceSha256}),new Date().toISOString());
    }
    db.exec(apply?'COMMIT':'ROLLBACK');
    return result;
  }catch(error){db.exec('ROLLBACK');throw error}
}
