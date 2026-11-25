import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import path from 'node:path';
import net from 'node:net';
import {fileURLToPath} from 'node:url';

test('beta experience loop',async t=>{
 const root=fileURLToPath(new URL('..',import.meta.url)),data=mkdtempSync(path.join(tmpdir(),'am08-beta-'));
 const sock=net.createServer();await new Promise(r=>sock.listen(0,'127.0.0.1',r));const port=sock.address().port;await new Promise(r=>sock.close(r));const origin=`http://127.0.0.1:${port}`;
 let child,db,logs='';
 async function start(){child=spawn(process.execPath,['--import','./tests/mock-openai.mjs','server.mjs'],{cwd:root,env:{...process.env,ALLOW_MANUAL_SETTLEMENT:'true',PORT:String(port),PUBLIC_ORIGIN:origin,DATA_DIR:data,OPENAI_API_KEY:'test-only',ADMIN_EMAIL:'operator@test.local',ADMIN_PASSWORD:'operator-password-2026'},stdio:['ignore','pipe','pipe']});child.stdout.on('data',b=>logs+=b);child.stderr.on('data',b=>logs+=b);for(let n=0;n<100;n++){try{if((await fetch(origin+'/api/health')).ok)return}catch{}await new Promise(r=>setTimeout(r,30))}throw Error(logs)}
 async function stop(){if(!child||child.exitCode!==null)return;const done=new Promise(r=>child.once('exit',r));child.kill();await done}
 t.after(async()=>{await stop();db?.close();rmSync(data,{force:true,recursive:true})});await start();
 async function call(url,{actor,body,method=body?'POST':'GET',key,stream=false}={}){const r=await fetch(origin+url,{method,headers:{Origin:origin,'Content-Type':'application/json',...(actor?{Cookie:actor.cookie,'X-CSRF-Token':actor.csrf}:{}),...(key?{'Idempotency-Key':key}:{}),...(stream?{Accept:'text/event-stream'}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,body:stream?await r.text():await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}}
 async function signup(name){const r=await call('/api/auth/register',{body:{name,email:name+'@test.local',password:'testing-password-2026',adult:true}});assert.equal(r.status,201);return {cookie:r.cookie,csrf:r.body.csrf,id:r.body.user.id}}
 const login=await call('/api/auth/login',{body:{email:'operator@test.local',password:'operator-password-2026'}}),admin={cookie:login.cookie,csrf:login.body.csrf};
 const a=await signup('alpha'),b=await signup('bravo');
 const chars=(await call('/api/characters')).body.characters,cid=chars[0].id;
 const conv=(await call('/api/conversations',{actor:a,body:{characterId:cid}})).body.conversation.id;
 const send=(content,key,opts={})=>call('/api/conversations/'+conv+'/messages',{actor:a,body:{content,...opts.body},key,...(opts.stream?{stream:true}:{})});
 let config=(await call('/api/admin/config',{actor:admin})).body.config;
 async function configure(patch){const r=await call('/api/admin/config',{actor:admin,method:'PUT',body:{...config,...patch}});assert.equal(r.status,200,JSON.stringify(r.body));config=r.body.config}
 db=new DatabaseSync(path.join(data,'app.sqlite'));db.exec('PRAGMA busy_timeout=5000');
 let rule;
 await t.test('old rules remain input-only and scope round-trips through export',async()=>{
  const r=await call('/api/admin/safety/rules',{actor:admin,body:{label:'Split marker',kind:'keyword',value:'你好，',mode:'contains',enabled:true,reason:'test'}});assert.equal(r.status,201);rule=r.body.rule;assert.equal(rule.scope,'input');
  assert.equal((await send('ordinary probe','input-only')).body.replyReplaced,false);
  const update=await call('/api/admin/safety/rules/'+rule.id,{actor:admin,method:'PUT',body:{...rule,scope:'output',reason:'test output'}});assert.equal(update.status,200);rule=update.body.rule;
  const exported=(await call('/api/admin/safety/export',{actor:admin})).body;assert.equal(exported.rules[0].scope,'output');assert.equal(exported.version,3);assert.equal((await call('/api/admin/safety/import',{actor:admin,body:{...exported,preview:true}})).body.skipped,1);
 });
 await t.test('cross-delta output hit replaces reply and releases quota and growth',async()=>{
  const before=(await call('/api/chat/access',{actor:a})).body.used,xp=(await call('/api/characters/'+cid+'/relationship',{actor:a})).body.relationship.xp;
  const r=await send('请记住测试名字不能保存','blocked-stream',{stream:true});assert.equal(r.status,200);assert.match(r.body,/event: reply_replaced/);assert.ok(!r.body.includes('你好，流式测试完成。'));
  assert.equal((await call('/api/chat/access',{actor:a})).body.used,before);assert.equal((await call('/api/characters/'+cid+'/relationship',{actor:a})).body.relationship.xp,xp);
  assert.equal((await call('/api/characters/'+cid+'/memory',{actor:a})).body.memory.summary,'');
  const run=db.prepare("SELECT * FROM chat_runs WHERE request_key='blocked-stream'").get();assert.equal(run.status,'blocked');assert.equal(db.prepare('SELECT content FROM messages WHERE id=?').get(run.assistant_id).content,config.outputFallback);
 });
 await t.test('blocked replay and retry never return model original',async()=>{
  const r=await send('请记住测试名字不能保存','blocked-stream');assert.equal(r.body.duplicate,true);assert.equal(r.body.replyReplaced,true);assert.equal(r.body.assistantMessage.content,config.outputFallback);
  assert.equal((await send('请记住测试名字不能保存','blocked-retry',{body:{retryMessageId:r.body.message.id}})).status,409);
  const exp=(await call('/api/me/export',{actor:a})).body;
  assert.equal(exp.messages.filter(m=>m.role==='assistant'&&m.content===config.outputFallback).length,1);
  const hit=(await call('/api/admin/safety/hits',{actor:admin})).body.hits[0];assert.equal(hit.direction,'output');assert.ok(!JSON.stringify(hit).includes('你好，'));
 });
 await t.test('non-stream replies receive final output review',async()=>{
  await configure({streamEnabled:false});const r=await send('ordinary final probe','blocked-final');assert.equal(r.body.replyReplaced,true);assert.equal(r.body.assistantMessage.content,config.outputFallback);await configure({streamEnabled:true});
 });
 await t.test('scope test direction is explicit and does not record hits',async()=>{
  const count=db.prepare('SELECT COUNT(*) n FROM safety_hits').get().n;
  for(const [direction,expected] of [['input',0],['output',1]])assert.equal((await call('/api/admin/safety/test',{actor:admin,body:{samples:['你好，'],direction}})).body.blocked,expected);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM safety_hits').get().n,count);
  await call('/api/admin/safety/rules/'+rule.id,{actor:admin,method:'PUT',body:{...rule,enabled:false,reason:'finish test'}});
 });
 let official;
 await t.test('structured persona and greeting remain editable with review state',async()=>{
  const r=await call('/api/admin/characters',{actor:admin,body:{name:'Beta fictional guide',age:26,style:'Realistic',gender:'female',status:'published',rank:9000,image:chars[0].image,prompt:'legacy marker',persona_status:'reviewed',persona_fields:{background:'FICTIONAL_TEST_BACKGROUND',speech:'自然简洁'},greeting:'你好，今天有什么想聊的？',reason:'test'}});
  assert.equal(r.status,201,JSON.stringify(r.body));official=r.body.character;
  const list=await call('/api/admin/characters?sort=popular&persona_status=reviewed',{actor:admin});assert.equal(list.status,200,JSON.stringify(list.body));assert.ok(list.body.characters.some(c=>c.id===official.id));
  assert.equal((await call('/api/characters')).body.characters[0].id,official.id);
 });
 let greetingConv;
 await t.test('new conversation greeting is saved once and does not bill',async()=>{
  const before=db.prepare('SELECT COUNT(*) n FROM chat_runs').get().n;
  const r=await call('/api/conversations',{actor:a,body:{characterId:official.id}});greetingConv=r.body.conversation.id;
  assert.equal((await call('/api/conversations',{actor:a,body:{characterId:official.id}})).body.conversation.id,greetingConv);
  const view=(await call('/api/conversations/'+greetingConv,{actor:a})).body;
  assert.equal(view.messages.length,1);assert.equal(view.messages[0].role,'assistant');assert.equal(view.messages[0].content,official.greeting);assert.equal(view.relationship.xp,0);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM chat_runs').get().n,before);
 });
 await t.test('relationship levels and anniversaries are injected and acknowledged only on success',async()=>{
  const growth=(await call('/api/admin/relationship-rules',{actor:admin})).body.config;
  const updated=await call('/api/admin/relationship-rules',{actor:admin,method:'PUT',body:{...growth,levels:growth.levels.map((l,i)=>({...l,xp:i*10,promptHint:'RELATION_HINT_'+l.level})),reason:'test'}});assert.equal(updated.status,200);
  let rel=(await call('/api/characters/'+official.id+'/relationship',{actor:a})).body.relationship;
  await call('/api/characters/'+official.id+'/relationship',{actor:a,method:'PATCH',body:{revision:rel.revision,anniversaries:[{title:'TEST_ANNIVERSARY',date:new Date().toISOString().slice(0,10)}]}});
  const post=key=>call('/api/conversations/'+greetingConv+'/messages',{actor:a,key,body:{content:'PERSONA_CONTEXT'}});
  const first=await post('context1');assert.match(first.body.assistantMessage.content,/RELATION_HINT_1/);assert.match(first.body.assistantMessage.content,/TEST_ANNIVERSARY/);assert.match(first.body.assistantMessage.content,/FICTIONAL_TEST_BACKGROUND/);assert.ok(!first.body.assistantMessage.content.includes('legacy marker'));assert.equal(first.body.relationship.newInteraction,true);
  const second=await post('context2');assert.match(second.body.assistantMessage.content,/RELATION_HINT_2/);assert.match(second.body.assistantMessage.content,/justUnlocked/);
 });
 await t.test('feature settings are versioned and backend creation is enforced',async()=>{
  await configure({betaMode:true,features:{...config.features,createCharacter:false}});
  const f=(await call('/api/features')).body;assert.equal(f.betaMode,true);assert.equal(f.features.premium,false);assert.equal(f.features.wallet,false);assert.equal(f.features.shorts,false);
  assert.equal((await call('/api/characters',{actor:a,body:{name:'disabled'}})).status,404);
  assert.equal((await call('/api/orders',{actor:a,body:{plan:'monthly'},key:'beta-no-pay'})).status,409);
  assert.equal((await call('/api/admin/config',{actor:admin,method:'PUT',body:{...config,version:config.version-1}})).status,409);
 });
 const expiry=new Date(Date.now()+86400000).toISOString();
 async function batch(name,patch={}){return call('/api/admin/invite-codes',{actor:admin,body:{batch:name,count:1,days:30,tokens:100,max_uses:1,expires:expiry,note:'test',reason:'local fixture',...patch}})}
 let code;
 await t.test('batch generation validates bounds and exports safe CSV',async()=>{
  assert.equal((await batch('too-many',{count:501})).status,400);assert.equal((await batch('invalid-expiry',{expires:'invalid'})).status,400);
  assert.equal((await batch('=formula-test',{count:3})).status,201);
  const rows=(await call('/api/admin/invite-codes?batch=%3Dformula-test',{actor:admin})).body.codes;assert.equal(rows.length,3);assert.equal(new Set(rows.map(c=>c.code)).size,3);code=rows[0];
  const exp=(await call('/api/admin/invite-codes/export',{actor:admin})).body.csv;assert.ok(exp.includes("'=formula-test"));assert.ok(exp.includes(code.code));
 });
 const redeem=(actor,c=code)=>call('/api/beta/redeem',{actor,body:{code:c.code}});
 let winner;
 await t.test('concurrent redemption cannot overspend the code',async()=>{
  const r=await Promise.all([redeem(a),redeem(b)]);assert.deepEqual(r.map(x=>x.status).sort(),[200,400]);winner=r[0].status===200?a:b;
  assert.equal(db.prepare('SELECT used FROM invite_codes WHERE id=?').get(code.id).used,1);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM ledger WHERE reason='beta_grant'").get().n,1);
 });
 await t.test('same code repeated is idempotent and grants active membership',async()=>{
  const before=(await call('/api/me',{actor:winner})).body;
  const r=await redeem(winner);assert.equal(r.status,200);assert.equal(r.body.duplicate,true);assert.equal(r.body.access.subscribed,true);
  const after=(await call('/api/me',{actor:winner})).body;assert.equal(after.balance,before.balance);assert.equal(after.subscription.expires,before.subscription.expires);
 });
 await t.test('second invitation extends active membership and books one grant',async()=>{
  const before=(await call('/api/me',{actor:winner})).body.subscription.expires;
  await batch('extension');const c=(await call('/api/admin/invite-codes?batch=extension',{actor:admin})).body.codes[0];
  const r=await redeem(winner,c);assert.equal(r.status,200);assert.equal(Date.parse(r.body.redemption.expires)-Date.parse(before),30*86400000);
  const records=(await call('/api/admin/invite-codes/'+c.id+'/redemptions',{actor:admin})).body.redemptions;assert.equal(records.length,1);assert.equal(records[0].tokens,100);
 });
 await t.test('disabled and expired invitations fail without grants',async()=>{
  await batch('disabled');let c=(await call('/api/admin/invite-codes?batch=disabled',{actor:admin})).body.codes[0];
  assert.equal((await call('/api/admin/invite-codes/'+c.id,{actor:admin,method:'PATCH',body:{enabled:false,version:c.version,reason:'disable'}})).status,200);assert.equal((await redeem(b,c)).status,400);
  db.prepare('UPDATE invite_codes SET enabled=1,expires=? WHERE id=?').run('2000-01-01T00:00:00.000Z',c.id);assert.equal((await redeem(b,c)).status,400);
 });
 await t.test('refund reconstruction preserves earlier beta membership grants',async()=>{
  const before=(await call('/api/me',{actor:winner})).body.subscription.expires;await configure({betaMode:false});
  const o=(await call('/api/orders',{actor:winner,body:{plan:'monthly'},key:'refund-beta-compat'})).body.order;
  assert.equal((await call('/api/admin/orders/'+o.id+'/settle',{actor:admin,body:{reason:'simulated existing settlement'}})).status,200);
  assert.equal((await call('/api/admin/orders/'+o.id+'/refund',{actor:admin,body:{reason:'simulated refund',confirmExternal:true,reference:'beta-refund-fixture'}})).status,200);
  assert.equal((await call('/api/me',{actor:winner})).body.subscription.expires,before);await configure({betaMode:true});
 });
 await t.test('code guessing is rate limited',async()=>{
  const guess=await signup('guess');let r;for(let n=0;n<11;n++)r=await call('/api/beta/redeem',{actor:guess,body:{code:'not-valid'}});assert.equal(r.status,429);
 });
 await t.test('invitation cohorts use redemption dates and pending periods',async()=>{
  const c=(await call('/api/admin/invite-codes/cohorts',{actor:admin})).body.cohorts.find(c=>c.batch==='extension');assert.equal(c.redeemedUsers,1);assert.equal(c.periods[0].eligible,0);assert.equal(c.periods[0].rate,null);
 });
 await t.test('members cannot inspect or generate codes; reviewers denied, operations allowed',async()=>{
  assert.equal((await call('/api/admin/invite-codes',{actor:a})).status,403);
  for(const [role,status] of [['reviewer',403],['operations',200]]){
   await call('/api/admin/staff',{actor:admin,body:{email:role+'@test.local',name:role,role,status:'active',password:'staff-testing-password',reason:'test'}});
   const l=await call('/api/auth/login',{body:{email:role+'@test.local',password:'staff-testing-password'}});const actor={cookie:l.cookie,csrf:l.body.csrf};assert.equal((await call('/api/admin/invite-codes',{actor})).status,status);
  }
 });
 await t.test('settings, review states and redemption survive restart',async()=>{
  await stop();await start();assert.equal((await call('/api/features')).body.betaMode,true);assert.equal((await redeem(winner)).body.duplicate,true);
  assert.equal((await call('/api/admin/characters?persona_status=reviewed',{actor:admin})).body.characters[0].id,official.id);
 });
});
