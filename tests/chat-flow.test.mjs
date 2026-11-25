import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import net from 'node:net';
import {readEvents} from '../openai.mjs';

test('operations, streaming, memory, quota and subscription lifecycle',async t=>{
 const root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),data=mkdtempSync(path.join(tmpdir(),'companion-flow-'));
 const sock=net.createServer();await new Promise(r=>sock.listen(0,'127.0.0.1',r));const port=sock.address().port;await new Promise(r=>sock.close(r));
 const origin=`http://127.0.0.1:${port}`;
 let child,logs='';
 async function start(){child=spawn(process.execPath,['--import','./tests/mock-openai.mjs','server.mjs'],{cwd:root,env:{...process.env,OPENAI_API_KEY:'test-only-not-real',OPENAI_MODEL:'gpt-4.1-mini',PORT:String(port),DATA_DIR:data,PUBLIC_ORIGIN:origin,ADMIN_EMAIL:'operator@test.local',ADMIN_PASSWORD:'operator-password-2026',ALLOW_MANUAL_SETTLEMENT:'true'},stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);for(let i=0;i<100;i++){try{if((await fetch(origin+'/api/health')).ok)return}catch{}await new Promise(r=>setTimeout(r,30))}throw Error(logs)}
 async function stop(){if(!child||child.exitCode!==null)return;const done=new Promise(r=>child.once('exit',r));child.kill();await done}
 t.after(async()=>{await stop();rmSync(data,{recursive:true,force:true})});await start();
 async function call(route,{actor,body,method=body?'POST':'GET',key,stream=false}={}){const res=await fetch(origin+route,{method,headers:{Origin:origin,'Content-Type':'application/json',...(actor?{Cookie:actor.cookie,'X-CSRF-Token':actor.csrf}:{}),...(key?{'Idempotency-Key':key}:{}),...(stream?{Accept:'text/event-stream'}:{})},body:body?JSON.stringify(body):undefined});if(stream&&res.headers.get('content-type')?.includes('event-stream'))return res;return {status:res.status,body:await res.json(),cookie:res.headers.get('set-cookie')?.split(';')[0]}}
 async function signup(name){const r=await call('/api/auth/register',{body:{name,email:`${name}@test.local`,password:'test-password-2026',adult:true}});assert.equal(r.status,201);return {cookie:r.cookie,csrf:r.body.csrf,id:r.body.user.id}}
 const a=await signup('alice'),b=await signup('bob');const login=await call('/api/auth/login',{body:{email:'operator@test.local',password:'operator-password-2026'}}),admin={cookie:login.cookie,csrf:login.body.csrf};
 let config=(await call('/api/admin/config',{actor:admin})).body.config;
 async function configure(patch){const r=await call('/api/admin/config',{actor:admin,method:'PUT',body:{...config,...patch}});assert.equal(r.status,200,JSON.stringify(r.body));config=r.body.config}
 const chars=(await call('/api/characters')).body.characters;
 const c1=(await call('/api/conversations',{actor:a,body:{characterId:chars[0].id}})).body.conversation.id;
 const c2=(await call('/api/conversations',{actor:a,body:{characterId:chars[1].id}})).body.conversation.id;
 const send=(content,key,opts={})=>call(`/api/conversations/${opts.cid||c1}/messages`,{actor:a,body:{content,...opts.body},key,stream:opts.stream});
 await t.test('operator permissions, validation and versioning',async()=>{
  assert.equal((await call('/api/admin/config',{actor:a})).status,403);
  assert.equal((await call('/api/admin/config',{actor:admin,method:'PUT',body:{...config,freeMessageLimit:-1}})).status,400);
  const old=config;await configure({freeMessageLimit:1});
  assert.equal((await call('/api/admin/config',{actor:admin,method:'PUT',body:old})).status,409);
 });
 await t.test('real stream parser handles fragmented UTF-8; one pending request per user',async()=>{
  const res=await send('请记住我的测试名字小林','one',{stream:true});let events=[],deltaAt,doneAt;
  for await(const e of readEvents(res.body)){events.push(e);if(e.delta&&!deltaAt){deltaAt=Date.now();assert.equal((await send('concurrent','race',{cid:c2})).status,409)}if(e.assistantMessage)doneAt=Date.now()}
  assert.ok(doneAt-deltaAt>=50);assert.ok(events.some(e=>e.delta==='你好'));assert.equal(events.at(-1).access.remaining,0);
  assert.match((await call('/api/me/memory',{actor:a})).body.memory.summary,/测试名字小林/);
 });
 await t.test('paywall, duplicate request and private memory',async()=>{
  const replay=await send('请记住我的测试名字小林','one');assert.equal(replay.body.duplicate,true);
  assert.equal((await send('blocked','blocked',{cid:c2})).status,402);
  assert.equal((await call('/api/chat/access',{actor:a})).body.used,1);
  assert.equal((await call('/api/me/memory',{actor:b})).body.memory.summary,'');
  assert.equal((await call(`/api/conversations/${c1}`,{actor:b})).status,404);
 });
 await t.test('memory survives restart and is injected into a different conversation',async()=>{
  await configure({freeMessageLimit:3});await stop();await start();
  assert.equal((await call('/api/admin/config',{actor:admin})).body.config.freeMessageLimit,3);
  const r=await send('RECALL','recall',{cid:c2});assert.equal(r.body.assistantMessage.content,'记得你叫小林');
 });
 await t.test('provider failures do not consume quota; retry reuses saved user message',async()=>{
  const failed=await send('FAIL_ONCE','failure');assert.match(failed.body.replyError,/quota/);
  assert.equal(failed.body.access.used,2);
  const retried=await send('FAIL_ONCE','retry',{body:{retryMessageId:failed.body.message.id}});assert.ok(retried.body.assistantMessage);assert.equal(retried.body.access.used,3);
  const msgs=(await call(`/api/conversations/${c1}`,{actor:a})).body.messages;
  assert.equal(msgs.filter(m=>m.content==='FAIL_ONCE').length,1);
 });
 await t.test('unpaid order cannot unlock; settlement unlocks once with matching ledger',async()=>{
  const o=(await call('/api/orders',{actor:a,key:'order',body:{plan:'monthly'}})).body.order;
  assert.equal((await send('blocked again','blocked2')).status,402);
  const route=`/api/admin/orders/${o.id}/settle`;
  assert.equal((await call(route,{actor:a,body:{reason:'not permitted'}})).status,403);
  await call(route,{actor:admin,body:{reason:'local simulated payment'}});
  assert.equal((await call(route,{actor:admin,body:{reason:'duplicate'}})).body.changed,false);
  const wallet=(await call('/api/wallet',{actor:a})).body;assert.equal(wallet.balance,100);assert.equal(wallet.ledger.length,1);
  assert.equal((await send('subscriber reply','paid')).body.access.unlimited,true);
  await call('/api/subscription/cancel',{actor:a,body:{}});
  assert.equal((await call('/api/chat/access',{actor:a})).body.subscribed,true);
  const db=new DatabaseSync(path.join(data,'app.sqlite'));db.prepare('UPDATE subscriptions SET expires=? WHERE user_id=?').run('2000-01-01T00:00:00Z',a.id);db.close();
  assert.equal((await send('expired','expired')).status,402);
 });
 await t.test('memory edit, opt out, deletion and stale write protection',async()=>{
  let m=(await call('/api/me/memory',{actor:a})).body.memory;
  const r=await call('/api/me/memory',{actor:a,method:'PATCH',body:{summary:'',enabled:false,revision:m.revision}});assert.equal(r.status,200);
  assert.equal((await call('/api/me/memory',{actor:a,method:'PATCH',body:{summary:'stale',enabled:true,revision:m.revision}})).status,409);
  await configure({quotaEnabled:false});
  assert.equal((await send('RECALL','no-memory',{cid:c2})).body.assistantMessage.content,'没有记忆');
  assert.equal((await call('/api/me/memory',{actor:a})).body.memory.summary,'');
 });
 await t.test('interrupted stream is failed, never stored as a completed reply, and remains retryable',async()=>{
  const before=(await call('/api/admin/config',{actor:admin})).body.stats;
  const res=await send('INTERRUPTED','interrupted',{stream:true});const events=[];for await(const e of readEvents(res.body))events.push(e);
  assert.match(events.at(-1).replyError,/stream interrupted/);
  assert.equal(events.at(-1).assistantMessage,null);
  const convo=(await call(`/api/conversations/${c1}`,{actor:a})).body;
  assert.ok(convo.failures.some(f=>f.content==='INTERRUPTED'));
  const after=(await call('/api/admin/config',{actor:admin})).body.stats;
  assert.equal(after.completed,before.completed);assert.equal(after.failed,before.failed+1);assert.equal(after.pending,0);
 });
 await t.test('operator can pause chat and disable streaming without bypassing access checks',async()=>{
  await configure({chatEnabled:false});assert.equal((await send('paused','paused')).status,503);
  await configure({chatEnabled:true,streamEnabled:false});
  const res=await send('no incremental stream','buffered',{stream:true});let deltas=0;for await(const e of readEvents(res.body))if(e.delta)deltas++;
  assert.equal(deltas,1);
 });
 await t.test('user management revokes suspended sessions, blocks login and protects admins',async()=>{
  const detail=(await call('/api/admin/users/'+b.id,{actor:admin})).body;
  assert.ok(!('messages' in detail));assert.ok(!('memory' in detail));assert.ok(!('password' in detail.user));
  const payload={name:'Bob reviewed',note:'test note',status:'suspended',version:detail.user.version,reason:'test restriction'};
  assert.equal((await call('/api/admin/users/'+b.id,{actor:a,method:'PATCH',body:payload})).status,403);
  assert.equal((await call('/api/admin/users/'+b.id,{actor:admin,method:'PATCH',body:payload})).status,200);
  assert.equal((await call('/api/me',{actor:b})).body.user,null);
  assert.equal((await call('/api/auth/login',{body:{email:'bob@test.local',password:'test-password-2026'}})).status,403);
  assert.equal((await call('/api/admin/users/'+b.id,{actor:admin,method:'PATCH',body:payload})).status,409);
  const updated=(await call('/api/admin/users/'+b.id,{actor:admin})).body.user;
  assert.equal((await call('/api/admin/users/'+b.id,{actor:admin,method:'PATCH',body:{...payload,status:'active',version:updated.version}})).status,200);
  assert.equal((await call('/api/auth/login',{body:{email:'bob@test.local',password:'test-password-2026'}})).status,200);
  const operator=(await call('/api/admin/users?q=operator',{actor:admin})).body.users[0];
  assert.equal((await call('/api/admin/users/'+operator.id,{actor:admin,method:'PATCH',body:{...payload,name:operator.name,version:operator.version}})).status,409);
 });
 await t.test('official character draft, publication, archive and restart persistence',async()=>{
  let payload={name:'Managed official',age:26,style:'Realistic',gender:'female',image:chars[0].image,personality:'Calm',description:'Managed description',prompt:'Internal persona data',status:'draft',rank:99,tags:'science,books',seo_title:'Managed SEO',seo_description:'SEO summary',reason:'test'};
  const made=await call('/api/admin/characters',{actor:admin,body:payload});assert.equal(made.status,201,JSON.stringify(made.body));let c=made.body.character;
  assert.ok(!(await call('/api/characters')).body.characters.some(x=>x.id===c.id));
  let r=await call('/api/admin/characters/'+c.id,{actor:admin,method:'PUT',body:{...payload,status:'published',version:c.version}});assert.equal(r.status,200);c=r.body.character;
  const publicC=(await call('/api/characters/'+c.id)).body.character;assert.equal(publicC.tags,'science,books');assert.equal(publicC.settings.prompt,undefined);
  const conv=(await call('/api/conversations',{actor:a,body:{characterId:c.id}})).body.conversation.id;
  r=await call('/api/admin/characters/'+c.id,{actor:admin,method:'PUT',body:{...payload,status:'archived',version:c.version}});assert.equal(r.status,200);
  assert.equal((await call('/api/characters/'+c.id)).status,404);assert.equal((await call('/api/conversations/'+conv,{actor:a})).status,200);
  assert.equal((await call('/api/conversations/'+conv+'/messages',{actor:a,body:{content:'hidden'}})).status,404);
  const imported=(await call('/api/admin/characters?q='+encodeURIComponent(chars[0].name),{actor:admin})).body.characters.find(c=>c.id===chars[0].id);
  await call('/api/admin/characters/'+imported.id,{actor:admin,method:'PUT',body:{...payload,status:'published',name:'Edited imported character',version:imported.version}});
  await stop();await start();assert.equal((await call('/api/characters/'+imported.id)).body.character.name,'Edited imported character');
 });
 await t.test('price and benefit snapshots, token packs, refunds and disputes stay consistent',async()=>{
  const buyer=await signup('buyer');
  let monthly=(await call('/api/admin/plans',{actor:admin})).body.plans.find(p=>p.id==='monthly');
  const old=(await call('/api/orders',{actor:buyer,key:'old-price',body:{plan:'monthly',planVersion:monthly.version}})).body.order;
  const changed=await call('/api/admin/plans/monthly',{actor:admin,method:'PUT',body:{...monthly,amount:1234,originalAmount:1234,tokens:9,cycleCount:3,reason:'new pricing'}});assert.equal(changed.status,200);monthly=changed.body.plan;
  assert.equal((await call('/api/orders',{actor:buyer,key:'stale-price',body:{plan:'monthly',planVersion:monthly.version-1}})).status,409);
  assert.equal((await call('/api/orders',{actor:buyer,key:'old-price',body:{plan:'monthly',planVersion:monthly.version-1}})).body.order.id,old.id);
  const newer=(await call('/api/orders',{actor:buyer,key:'new-price',body:{plan:'monthly',planVersion:monthly.version}})).body.order;assert.equal(newer.amount,1234);
  for(const o of [old,newer])assert.equal((await call('/api/admin/orders/'+o.id+'/settle',{actor:admin,body:{reason:'simulated'}})).status,200);
  assert.equal((await call('/api/wallet',{actor:buyer})).body.balance,109);
  const frozen=(await call('/api/admin/orders/'+old.id,{actor:admin})).body.order;assert.equal(frozen.terms.tokens,100);assert.equal(frozen.terms.amount,999);
  const refund={reference:'refund-old',confirmExternal:true,reason:'external refund verified'};
  assert.equal((await call('/api/admin/orders/'+old.id+'/refund',{actor:admin,body:refund})).status,200);
  assert.equal((await call('/api/admin/orders/'+old.id+'/refund',{actor:admin,body:refund})).status,200);
  assert.equal((await call('/api/wallet',{actor:buyer})).body.balance,9);assert.equal((await call('/api/chat/access',{actor:buyer})).body.subscribed,true);
  assert.equal((await call('/api/admin/orders/'+newer.id+'/refund',{actor:admin,body:refund})).status,409);
  assert.equal((await call('/api/admin/orders/'+newer.id+'/refund',{actor:admin,body:{...refund,reference:'refund-new'}})).status,200);
  assert.equal((await call('/api/chat/access',{actor:buyer})).body.subscribed,false);assert.equal((await call('/api/wallet',{actor:buyer})).body.balance,0);
  const pack=await call('/api/admin/plans',{actor:admin,body:{...monthly,id:'token-pack',kind:'tokens',tokens:8,amount:100,originalAmount:100,reason:'token pack'}});assert.equal(pack.status,201);
  const po=(await call('/api/orders',{actor:buyer,key:'pack',body:{plan:'token-pack'}})).body.order;
  await call('/api/admin/orders/'+po.id+'/settle',{actor:admin,body:{reason:'simulated'}});
  assert.equal((await call('/api/wallet',{actor:buyer})).body.balance,8);assert.equal((await call('/api/chat/access',{actor:buyer})).body.subscribed,false);
  const note=await call('/api/admin/orders/'+po.id,{actor:admin,method:'PATCH',body:{note:'reconciled',version:1,reason:'review'}});assert.equal(note.status,200);
  await call('/api/admin/orders/'+po.id+'/dispute',{actor:admin,body:{dispute:'open',reference:'external-dispute',reason:'investigate'}});
  assert.equal((await call('/api/me',{actor:buyer})).body.user,null);
  const pending=(await call('/api/orders',{actor:a,key:'cancel-test',body:{plan:'monthly'}})).body.order;
  assert.equal((await call('/api/admin/orders/'+pending.id+'/cancel',{actor:admin,body:{reason:'unpaid'}})).status,200);
  assert.equal((await call('/api/admin/orders/'+pending.id+'/settle',{actor:admin,body:{reason:'invalid'}})).status,409);
  await stop();await start();assert.equal((await call('/api/admin/plans',{actor:admin})).body.plans.find(p=>p.id==='monthly').amount,1234);
 });
});
