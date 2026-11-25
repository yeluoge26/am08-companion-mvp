import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import {applyCharacterPersonas} from '../character-personas.mjs';
const manifest=JSON.parse(fs.readFileSync(new URL('../character-personas.json',import.meta.url),'utf8'));
test('derived catalog covers existing characters without publishing personas in catalog',()=>{
  const catalog=JSON.parse(fs.readFileSync(new URL('../public/catalog.json',import.meta.url),'utf8'));
  assert.deepEqual(manifest.characters.map(c=>c.id),catalog.map(c=>String(c.id)));
  for(const entry of manifest.characters){
    assert.ok(entry.prompt.length<=3000);assert.equal(entry.needsReview,true);
    assert.match(entry.prompt,/不是原站隐藏 Prompt/);
    assert.match(entry.prompt,/不代表本人/);
  }
  assert.ok(catalog.every(c=>!c.settings?.prompt));
});
test('persona import previews, preserves manual/private settings and assets, audits and is idempotent',()=>{
  const db=new DatabaseSync(':memory:');
  try{
    db.exec('CREATE TABLE characters(id TEXT PRIMARY KEY,owner_id TEXT,settings TEXT,image TEXT,video TEXT); CREATE TABLE character_admin(character_id TEXT PRIMARY KEY,version INTEGER); CREATE TABLE audit(id TEXT,actor TEXT,action TEXT,target TEXT,detail TEXT,created TEXT)');
    const entries=manifest.characters.slice(0,4);
    for(const [index,e] of entries.entries()){
      db.prepare('INSERT INTO characters VALUES(?,?,?,?,?)').run(e.id,index===2?'member':null,JSON.stringify({ageKnown:false,voice:'original',...(index===1?{prompt:'Manual prompt'}:{})}),'image.bin','video.mp4');
      db.prepare('INSERT INTO character_admin VALUES(?,3)').run(e.id);
    }
    const batch={...manifest,characters:entries};
    const before=db.prepare('SELECT * FROM characters').all();
    assert.equal(applyCharacterPersonas(db,batch).updated,2);
    assert.deepEqual(db.prepare('SELECT * FROM characters').all(),before);
    assert.deepEqual(applyCharacterPersonas(db,batch,{apply:true}),{updated:2,existing:1,missing:0,private:1});
    const after=db.prepare('SELECT * FROM characters').all();
    for(let i=0;i<after.length;i++){
      assert.equal(after[i].image,before[i].image);assert.equal(after[i].video,before[i].video);
      const settings=JSON.parse(after[i].settings);assert.equal(settings.ageKnown,false);assert.equal(settings.voice,'original');
    }
    assert.deepEqual(after[1],before[1]);assert.deepEqual(after[2],before[2]);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM audit').get().n,2);
    assert.equal(db.prepare('SELECT version FROM character_admin WHERE character_id=?').get(entries[0].id).version,4);
    assert.equal(applyCharacterPersonas(db,batch,{apply:true}).updated,0);
    assert.throws(()=>applyCharacterPersonas(db,{...batch,characters:[entries[0],entries[0]]},{apply:true}),/duplicate/);
  }finally{db.close()}
});
