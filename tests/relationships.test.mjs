import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {createRelationships} from '../relationships.mjs';
test('relationship daily rollover, leap anniversary and atomic growth',()=>{
 const db=new DatabaseSync(':memory:');db.exec(`PRAGMA foreign_keys=ON;CREATE TABLE users(id TEXT PRIMARY KEY);CREATE TABLE characters(id TEXT PRIMARY KEY);CREATE TABLE conversations(id TEXT PRIMARY KEY,user_id TEXT,character_id TEXT,created TEXT);CREATE TABLE chat_runs(id TEXT PRIMARY KEY,user_id TEXT,conversation_id TEXT,status TEXT);INSERT INTO users VALUES('u');INSERT INTO characters VALUES('c');INSERT INTO conversations VALUES('v','u','c','2024-02-29T12:00:00Z');`);
 let clock='2027-02-28T23:59:00.000Z';const transaction=f=>{db.exec('BEGIN IMMEDIATE');try{const r=f();db.exec('COMMIT');return r}catch(e){db.exec('ROLLBACK');throw e}};
 const rel=createRelationships({db,transaction,id:randomUUID,now:()=>clock,fail:(status,message)=>{throw Object.assign(Error(message),{status})},audit:()=>{}});
 let r=rel.state('u','c');assert.equal(r.firstMeeting.nextDate,'2027-02-28');assert.equal(r.firstMeeting.daysUntil,0);assert.equal(r.xp,0);
 rel.saveAnniversaries('u','c',{revision:r.revision,anniversaries:[{title:'Leap',date:'2024-02-29'},{title:'Future',date:'2030-06-01'}]});
 assert.equal(rel.state('u','c').anniversaries[1].nextDate,'2030-06-01');
 const add=i=>db.prepare('INSERT INTO chat_runs VALUES(?,?,?,?)').run('r'+i,'u','v','completed');
 for(let i=0;i<6;i++){add(i);transaction(()=>rel.award('u','c','r'+i))}
 assert.equal(rel.state('u','c').xp,50);assert.equal(rel.state('u','c').level,2);assert.equal(rel.state('u','c').todayXp,50);
 clock='2027-03-01T00:01:00.000Z';assert.equal(rel.state('u','c').firstMeeting.nextDate,'2028-02-29');
 transaction(()=>rel.award('u','c','r0'));assert.equal(rel.state('u','c').todayXp,0);
 add(6);transaction(()=>rel.award('u','c','r6'));assert.equal(rel.state('u','c').xp,60);
 add(7);assert.throws(()=>transaction(()=>{rel.award('u','c','r7');throw Error('rollback')}));assert.equal(rel.state('u','c').xp,60);assert.equal(db.prepare("SELECT count(*) n FROM relationship_events WHERE run_id='r7'").get().n,0);
 db.prepare("INSERT INTO chat_runs VALUES('failed','u','v','failed')").run();assert.throws(()=>transaction(()=>rel.award('u','c','failed')),e=>e.status===409);
 db.prepare("DELETE FROM users WHERE id='u'").run();assert.equal(db.prepare('SELECT count(*) n FROM relationships').get().n,0);assert.equal(db.prepare('SELECT count(*) n FROM relationship_events').get().n,0);db.close();
});
