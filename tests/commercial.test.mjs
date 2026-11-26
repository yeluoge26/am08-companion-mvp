import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {DatabaseSync} from 'node:sqlite';
import {totp,encodeSecret} from '../staff-security.mjs';
test('TOTP matches the RFC test secret',()=>{assert.equal(totp(encodeSecret(Buffer.from('12345678901234567890')),1),'287082')});
test('production hardening API: proxy identities, feedback privacy and staff MFA',async t=>{
 const data=mkdtempSync(path.join(tmpdir(),'am08-commercial-')),sock=net.createServer();await new Promise(r=>sock.listen(0,'127.0.0.1',r));const port=sock.address().port;await new Promise(r=>sock.close(r));const origin=`http://127.0.0.1:${port}`;
 const child=spawn(process.execPath,['server.mjs'],{env:{...process.env,DATA_DIR:data,PORT:String(port),PUBLIC_ORIGIN:origin,OPENAI_API_KEY:'',ADMIN_EMAIL:'admin@test.local',ADMIN_PASSWORD:'admin-password-test-2026',TRUST_PROXY_LOOPBACK:'true'},stdio:['ignore','pipe','pipe']});let logs='';child.stderr.on('data',b=>logs+=b);child.stdout.on('data',b=>logs+=b);
 t.after(async()=>{const done=new Promise(r=>child.once('exit',r));child.kill();await done;rmSync(data,{recursive:true,force:true})});
 for(let i=0;i<100;i++){try{if((await fetch(origin+'/api/health')).ok)break}catch{}await new Promise(r=>setTimeout(r,40));if(i===99)throw Error(logs)}
 async function call(route,{actor,body,method=body?'POST':'GET',headers={}}={}){const r=await fetch(origin+route,{method,headers:{Origin:origin,'Content-Type':'application/json',...(actor?{Cookie:actor.cookie,'X-CSRF-Token':actor.csrf}:{}),...headers},body:body?JSON.stringify(body):undefined});return {status:r.status,body:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}}
 const actors=[];for(let i=0;i<7;i++){const r=await call('/api/auth/register',{headers:{'X-Real-IP':`203.0.113.${i+1}`},body:{name:'Test',email:`u${i}@test.local`,password:'test-user-password-2026',adult:true}});assert.equal(r.status,201);actors.push({cookie:r.cookie,csrf:r.body.csrf,id:r.body.user.id})}
 const [a,b]=actors;
 const login=await call('/api/auth/admin-login',{body:{email:'admin@test.local',password:'admin-password-test-2026'}}),admin={cookie:login.cookie,csrf:login.body.csrf},headers={'X-Admin-Context':'1'};
 await t.test('feedback is isolated, idempotent and versioned',async()=>{
  const post={actor:a,headers:{'Idempotency-Key':'feedback-test'},body:{category:'memory',content:'Please correct the remembered preference'}};
  const first=await call('/api/feedback',post);assert.equal(first.status,201);assert.equal((await call('/api/feedback',post)).body.feedback.id,first.body.feedback.id);
  assert.equal((await call('/api/feedback',{actor:b})).body.total,0);
  assert.equal((await call('/api/admin/feedback',{actor:a})).status,403);
  assert.equal((await call('/api/feedback',{actor:a,body:{...post.body,messageId:'another-users-message'}})).status,404);
  const update={actor:admin,headers,method:'PATCH',body:{version:1,status:'resolved',reply:'Corrected; you can edit your memory card.',reason:'Reviewed the report'}};
  assert.equal((await call('/api/admin/feedback/'+first.body.feedback.id,update)).status,200);
  assert.equal((await call('/api/admin/feedback/'+first.body.feedback.id,update)).status,409);
  assert.equal((await call('/api/feedback',{actor:a})).body.items[0].status,'resolved');
 });
 await t.test('MFA enrollment revokes sessions and cannot be bypassed via member login',async()=>{
  const password='admin-password-test-2026',setup=await call('/api/admin/self/mfa/setup',{actor:admin,headers,body:{password}});assert.equal(setup.status,200);
  const enabled=await call('/api/admin/self/mfa/enable',{actor:admin,headers,body:{password,code:totp(setup.body.secret)}});assert.equal(enabled.status,200);assert.equal(enabled.body.recoveryCodes.length,8);
  assert.equal((await call('/api/admin/me',{actor:admin,headers})).body.user,null);
  for(const route of ['/api/auth/login','/api/auth/admin-login'])assert.equal((await call(route,{body:{email:'admin@test.local',password}})).status,401);
  const code=enabled.body.recoveryCodes[0];assert.equal((await call('/api/auth/admin-login',{body:{email:'admin@test.local',password,code}})).status,200);
  assert.equal((await call('/api/auth/admin-login',{body:{email:'admin@test.local',password,code}})).status,401);
  assert.equal((await call('/api/auth/admin-login',{body:{email:'admin@test.local',password,code:'😀😀😀'}})).status,401);
  const db=new DatabaseSync(path.join(data,'app.sqlite'),{readOnly:true});const stored=db.prepare('SELECT * FROM staff_mfa').get();assert.ok(!stored.secret.includes(setup.body.secret));assert.ok(!stored.recovery.includes(enabled.body.recoveryCodes[1]));db.close();
 });
});
