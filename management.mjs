export function createManagement({db,transaction,audit,fail,now,id,text,json,operations,catalog,seeds,availableBalance}){
 const one=(q,...a)=>db.prepare(q).get(...a),all=(q,...a)=>db.prepare(q).all(...a),run=(q,...a)=>db.prepare(q).run(...a);
 db.exec(`CREATE TABLE IF NOT EXISTS user_admin(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,status TEXT NOT NULL DEFAULT 'active',note TEXT NOT NULL DEFAULT '',adult_confirmed INTEGER NOT NULL DEFAULT 0,source TEXT NOT NULL DEFAULT 'unknown',version INTEGER NOT NULL DEFAULT 1);
 CREATE TABLE IF NOT EXISTS character_admin(character_id TEXT PRIMARY KEY REFERENCES characters(id) ON DELETE CASCADE,status TEXT NOT NULL DEFAULT 'published',rank INTEGER NOT NULL DEFAULT 0,tags TEXT NOT NULL DEFAULT '',seo_title TEXT NOT NULL DEFAULT '',seo_description TEXT NOT NULL DEFAULT '',version INTEGER NOT NULL DEFAULT 1);
 CREATE TABLE IF NOT EXISTS product_plans(id TEXT PRIMARY KEY,value TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1);
 CREATE TABLE IF NOT EXISTS order_terms(order_id TEXT PRIMARY KEY REFERENCES orders(id),snapshot TEXT NOT NULL,paid_at TEXT);
 CREATE TABLE IF NOT EXISTS order_admin(order_id TEXT PRIMARY KEY REFERENCES orders(id),note TEXT NOT NULL DEFAULT '',dispute TEXT NOT NULL DEFAULT 'none',reference TEXT NOT NULL DEFAULT '',version INTEGER NOT NULL DEFAULT 1);
 CREATE TABLE IF NOT EXISTS refunds(order_id TEXT PRIMARY KEY REFERENCES orders(id),reference TEXT UNIQUE NOT NULL,reason TEXT NOT NULL,actor TEXT NOT NULL,created TEXT NOT NULL);`);
 for(const [column,definition] of [['persona_status',"TEXT NOT NULL DEFAULT 'draft'"],['greeting',"TEXT NOT NULL DEFAULT ''"],['persona_fields',"TEXT NOT NULL DEFAULT '{}'"]])if(!all('PRAGMA table_info(character_admin)').some(c=>c.name===column))db.exec('ALTER TABLE character_admin ADD COLUMN '+column+' '+definition);
 function personaPrompt(c){const fields=JSON.parse(one('SELECT persona_fields FROM character_admin WHERE character_id=?',c.id)?.persona_fields||'{}');const parts=Object.entries(fields).filter(([k,v])=>!/^level[1-5]$/.test(k)&&v).map(([k,v])=>k+': '+v);return parts.length?parts.join('\n'):JSON.parse(c.settings||'{}').prompt||''}
 transaction(()=>{
  for(const p of seeds)run('INSERT OR IGNORE INTO product_plans VALUES(?,?,1)',p.id,JSON.stringify({...p,kind:'subscription',cycleUnit:'month',cycleCount:p.months,originalAmount:p.amount,active:true,recommended:p.id==='annual',benefits:'Unlimited text chat\nPrivate characters',region:'GLOBAL'}));
  // Historical orders must retain the originally coded entitlement, not the current editable price.
  for(const o of all('SELECT * FROM orders WHERE id NOT IN (SELECT order_id FROM order_terms)')){
   const original=seeds.find(p=>p.id===o.plan);if(!original)throw Error('Cannot migrate unknown legacy plan: '+o.plan);
   const paid=one("SELECT created FROM audit WHERE action='order.paid' AND target=? ORDER BY rowid LIMIT 1",o.id)?.created;
   run('INSERT INTO order_terms VALUES(?,?,?)',o.id,JSON.stringify({...original,kind:'subscription',cycleUnit:'month',cycleCount:original.months,amount:o.amount,currency:o.currency,version:0}),o.status==='paid'?(paid||o.created):null);
  }
 });
 const planRow=r=>r?{...JSON.parse(r.value),version:r.version}:null;
 const plans=(includeInactive=false)=>all('SELECT * FROM product_plans ORDER BY id').map(planRow).filter(p=>includeInactive||p.active);
 const plan=pid=>planRow(one('SELECT * FROM product_plans WHERE id=?',pid));
 const snapshot=oid=>JSON.parse(one('SELECT snapshot FROM order_terms WHERE order_id=?',oid).snapshot);
 function saveSnapshot(oid,p){run('INSERT INTO order_terms VALUES(?,?,NULL)',oid,JSON.stringify(p))}
 function endDate(start,p){const date=new Date(start);if(p.cycleUnit==='week')date.setUTCDate(date.getUTCDate()+7*p.cycleCount);else{const day=date.getUTCDate();date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+p.cycleCount);const last=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();date.setUTCDate(Math.min(day,last))}return date.toISOString()}
 function grant(order,eventKey){
  if(order.status==='paid')return false;if(order.status!=='pending')fail(409,'Order is not pending');const p=snapshot(order.id),at=now();
  if(p.kind==='subscription'){const existing=one('SELECT * FROM subscriptions WHERE user_id=?',order.user_id);const start=Math.max(Date.now(),Date.parse(existing?.expires||'')||0);run('INSERT INTO subscriptions VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET plan=excluded.plan,status=excluded.status,expires=excluded.expires',order.user_id,order.plan,'active',endDate(start,p))}
  run("UPDATE orders SET status='paid' WHERE id=?",order.id);run('UPDATE order_terms SET paid_at=? WHERE order_id=?',at,order.id);
  run('INSERT INTO ledger VALUES(?,?,?,?,?,?)',id(),order.user_id,p.tokens,p.kind==='tokens'?'Token purchase':'Subscription allocation',`order:${order.id}`,at);audit(null,'order.paid',order.id,{eventKey,planVersion:p.version});return true;
 }
 function rebuildMembership(uid){
  const paid=all("SELECT o.plan,t.snapshot,t.paid_at FROM orders o JOIN order_terms t ON t.order_id=o.id WHERE o.user_id=? AND o.status='paid' ORDER BY t.paid_at,o.rowid",uid).filter(o=>JSON.parse(o.snapshot).kind==='subscription');
  const invites=one("SELECT name FROM sqlite_master WHERE name='invite_redemptions'")?all('SELECT days,created FROM invite_redemptions WHERE user_id=?',uid).map(r=>({plan:'beta',paid_at:r.created,days:r.days})):[];
  let end=0,last=null;for(const o of [...paid,...invites].sort((a,b)=>a.paid_at.localeCompare(b.paid_at))){const start=Math.max(end,Date.parse(o.paid_at));end=o.days?start+o.days*86400000:Date.parse(endDate(start,JSON.parse(o.snapshot)));last=o}
  const old=one('SELECT status FROM subscriptions WHERE user_id=?',uid);
  if(!last)run("UPDATE subscriptions SET status='revoked',expires=? WHERE user_id=?",now(),uid);
  else run('UPDATE subscriptions SET plan=?,expires=?,status=? WHERE user_id=?',last.plan,new Date(end).toISOString(),old?.status==='non-renewing'?'non-renewing':'active',uid);
 }
 function userState(uid){return one('SELECT * FROM user_admin WHERE user_id=?',uid)||{status:'active',note:'',adult_confirmed:0,source:'unknown',version:1}}
 const published=cid=>{const s=one('SELECT status FROM character_admin WHERE character_id=?',cid)?.status;return !s||s==='published'};
 function pageRows(url,base,params=[]){const page=Math.max(1,Math.min(100000,Math.floor(Number(url.searchParams.get('page')))||1)),size=25;const total=one(`SELECT COUNT(*) n FROM (${base})`,...params).n;return {rows:all(base+' LIMIT ? OFFSET ?',...params,size,(page-1)*size),total,page,pages:Math.max(1,Math.ceil(total/size))}}
 const checkVersion=(given,current)=>{if(given!==current)fail(409,'Record changed. Reload and try again.')};
 const reason=b=>text(b.reason,500);
 function characterInfo(c){return {...c,settings:JSON.parse(c.settings||'{}'),...(one('SELECT * FROM character_admin WHERE character_id=?',c.id)||{status:'published',rank:0,tags:'',seo_title:'',seo_description:'',version:1,persona_status:'draft',greeting:'',persona_fields:'{}'})}}
 function getOrder(oid){const o=one('SELECT orders.*,users.email FROM orders JOIN users ON users.id=orders.user_id WHERE orders.id=?',oid);if(!o)fail(404,'Order not found');return {...o,terms:snapshot(oid),...(one('SELECT * FROM order_admin WHERE order_id=?',oid)||{note:'',dispute:'none',reference:'',version:1}),paidAt:one('SELECT paid_at FROM order_terms WHERE order_id=?',oid)?.paid_at,refund:one('SELECT * FROM refunds WHERE order_id=?',oid)||null,ledger:all('SELECT id,delta,reason,created FROM ledger WHERE external_key IN (?,?)',`order:${oid}`,`refund:${oid}`)}}
 async function handle(req,res,url,user,body){
  const route=url.pathname,method=req.method,q=(url.searchParams.get('q')||'').slice(0,200),status=url.searchParams.get('status')||'';
  if(route==='/api/admin/users'&&method==='GET'){
   const list=pageRows(url,"SELECT u.id,u.email,u.name,u.role,u.created,COALESCE(a.status,'active') status,COALESCE(a.version,1) version,(SELECT COALESCE(SUM(delta),0) FROM ledger WHERE user_id=u.id) balance FROM users u LEFT JOIN user_admin a ON a.user_id=u.id WHERE (u.role='user' OR ?=1) AND (u.email LIKE ? OR u.name LIKE ?) AND (?='' OR COALESCE(a.status,'active')=?) ORDER BY u.created DESC",[Number(user.staffRole==='superadmin'),'%'+q+'%','%'+q+'%',status,status]);return json(res,200,{...list,rows:undefined,users:list.rows.map(u=>({...u,chatAccess:operations.access(u.id)}))}),true;
  }
  const um=route.match(/^\/api\/admin\/users\/([^/]+)(\/sessions)?$/);
  if(um){const uid=um[1],u=one('SELECT id,email,name,role,created FROM users WHERE id=?',uid);if(!u)fail(404,'User not found');if(u.role==='admin'&&user.staffRole!=='superadmin')fail(403,'Staff permission required');if(u.role==='admin'&&method!=='GET')fail(409,'Use staff management for employee accounts');
   if(method==='GET'&&!um[2])return json(res,200,{user:{...u,...userState(uid)},access:operations.access(uid),subscription:one('SELECT * FROM subscriptions WHERE user_id=?',uid)||null,balance:one('SELECT COALESCE(SUM(delta),0) n FROM ledger WHERE user_id=?',uid).n,ledger:(user.permissions.includes('*')||user.permissions.includes('orders.read'))?all('SELECT delta,reason,created FROM ledger WHERE user_id=? ORDER BY rowid DESC LIMIT 20',uid):[],orders:(user.permissions.includes('*')||user.permissions.includes('orders.read'))?all('SELECT id,plan,amount,currency,status,created FROM orders WHERE user_id=? ORDER BY rowid DESC LIMIT 10',uid):[]}),true;
   if(method==='POST'&&um[2]){const why=reason(body);if(uid===user.id)fail(409,'Cannot revoke your own session here');run('DELETE FROM sessions WHERE user_id=?',uid);audit(user.id,'user.sessions-revoked',uid,{reason:why});return json(res,200,{ok:true}),true}
   if(method==='PATCH'&&!um[2]){const why=reason(body);if(!['active','suspended'].includes(body.status))fail(400,'Invalid account status');if(u.role==='admin'&&body.status!=='active')fail(409,'Administrator accounts cannot be suspended');const name=text(body.name,60),note=text(body.note||'',1000,false);transaction(()=>{checkVersion(body.version,userState(uid).version);run('INSERT OR IGNORE INTO user_admin(user_id) VALUES(?)',uid);run('UPDATE users SET name=? WHERE id=?',name,uid);run('UPDATE user_admin SET status=?,note=?,version=version+1 WHERE user_id=?',body.status,note,uid);if(body.status==='suspended')run('DELETE FROM sessions WHERE user_id=?',uid);audit(user.id,'user.updated',uid,{status:body.status,reason:why})});return json(res,200,{ok:true}),true}
  }
  if(route==='/api/admin/characters'&&method==='GET'){
   const personaStatus=url.searchParams.get('persona_status')||'',popular=url.searchParams.get('sort')==='popular';if(!['','draft','reviewed','refined'].includes(personaStatus))fail(400,'Invalid persona status');
   const since=new Date(Date.parse(now())-30*86400000).toISOString();
   const list=pageRows(url,"SELECT c.*,(SELECT COUNT(*) FROM conversations v WHERE v.character_id=c.id AND v.created>=?) conversations30,(SELECT COUNT(*) FROM chat_runs r JOIN conversations v ON v.id=r.conversation_id WHERE v.character_id=c.id AND r.status='completed' AND r.created>=?) replies30 FROM characters c LEFT JOIN character_admin a ON a.character_id=c.id WHERE c.owner_id IS NULL AND c.name LIKE ? AND (?='' OR COALESCE(a.status,'published')=?) AND (?='' OR COALESCE(a.persona_status,'draft')=?) ORDER BY "+(popular?'replies30 DESC,conversations30 DESC,':'')+"COALESCE(a.rank,0) DESC,c.created DESC,c.id",[since,since,'%'+q+'%',status,status,personaStatus,personaStatus]);return json(res,200,{...list,rows:undefined,characters:list.rows.map(characterInfo),images:catalog.map(c=>({image:c.image,name:c.name}))}),true;

  }
  const cm=route.match(/^\/api\/admin\/characters(?:\/([^/]+))?$/);
  if(cm&&['POST','PUT'].includes(method)){
   const previous=cm[1]?one('SELECT * FROM characters WHERE id=? AND owner_id IS NULL',cm[1]):null;if(cm[1]&&!previous)fail(404,'Official character not found');
   if(!cm[1]&&method!=='POST'||cm[1]&&method!=='PUT')fail(405,'Method not allowed');
   const oldInfo=previous?characterInfo(previous):{};const personaStatus=body.persona_status??oldInfo.persona_status??'draft',greeting=text(body.greeting??oldInfo.greeting??'',1000,false),personaFields=body.persona_fields??JSON.parse(oldInfo.persona_fields||'{}');if(!['draft','reviewed','refined'].includes(personaStatus)||!personaFields||typeof personaFields!=='object'||Array.isArray(personaFields)||Object.keys(personaFields).some(k=>!['background','personality','speech','boundaries','level1','level2','level3','level4','level5'].includes(k)||typeof personaFields[k]!=='string'||personaFields[k].length>(k.startsWith('level')?300:600)))fail(400,'Invalid persona fields');
   const name=text(body.name,60),description=text(body.description||'',1000,false),prompt=text(body.prompt||'',3000,false),personality=text(body.personality||'Friendly',100),why=reason(body);
   if(!Number.isInteger(body.age)||body.age<18||body.age>100||!['female','male'].includes(body.gender)||!['Realistic','Anime'].includes(body.style)||!['draft','published','archived'].includes(body.status)||!Number.isInteger(body.rank)||Math.abs(body.rank)>10000)fail(400,'Invalid character fields');
   if(!catalog.some(c=>c.image===body.image))fail(400,'Choose an existing library image');
   const tags=text(body.tags||'',300,false),seoTitle=text(body.seo_title||'',120,false),seoDescription=text(body.seo_description||'',300,false),cid=previous?.id||id();
   transaction(()=>{if(previous)checkVersion(body.version,characterInfo(previous).version);const settings=JSON.stringify({...JSON.parse(previous?.settings||'{}'),personality,prompt,ageKnown:previous&&previous.age===body.age?JSON.parse(previous.settings||'{}').ageKnown!==false:true});
    if(previous)run('UPDATE characters SET name=?,age=?,style=?,gender=?,description=?,image=?,settings=? WHERE id=?',name,body.age,body.style,body.gender,description,body.image,settings,cid);
    else run('INSERT INTO characters VALUES(?,NULL,?,?,?,?,?,?,NULL,NULL,?,?)',cid,name,body.age,body.style,body.gender,description,body.image,settings,now());
    run('INSERT INTO character_admin(character_id,status,rank,tags,seo_title,seo_description) VALUES(?,?,?,?,?,?) ON CONFLICT(character_id) DO UPDATE SET status=excluded.status,rank=excluded.rank,tags=excluded.tags,seo_title=excluded.seo_title,seo_description=excluded.seo_description,version=character_admin.version+1',cid,body.status,body.rank,tags,seoTitle,seoDescription);run('UPDATE character_admin SET persona_status=?,greeting=?,persona_fields=? WHERE character_id=?',personaStatus,greeting,JSON.stringify(personaFields),cid);audit(user.id,previous?'character.updated':'character.created',cid,{status:body.status,reason:why,personaStatus,greetingChanged:greeting!==oldInfo.greeting,personaFieldsChanged:JSON.stringify(personaFields)!==oldInfo.persona_fields});
   });return json(res,previous?200:201,{character:characterInfo(one('SELECT * FROM characters WHERE id=?',cid))}),true;
  }
  if(route==='/api/admin/plans'&&method==='GET')return json(res,200,{plans:plans(true)}),true;
  const pm=route.match(/^\/api\/admin\/plans(?:\/([^/]+))?$/);
  if(pm&&['POST','PUT'].includes(method)){
   const pid=pm[1]||text(body.id,40);if(!/^[a-z0-9-]{1,40}$/.test(pid))fail(400,'Invalid plan ID');const previous=plan(pid);if(method==='POST'&&previous)fail(409,'Plan ID already exists');if(method==='PUT'&&!previous)fail(404,'Plan not found');
   const why=reason(body),name=text(body.name,80),benefits=text(body.benefits||'',1000,false),region=text(body.region||'GLOBAL',40);
   if(!['subscription','tokens'].includes(body.kind)||!['month','week'].includes(body.cycleUnit)||!Number.isInteger(body.cycleCount)||body.cycleCount<1||body.cycleCount>36||!Number.isSafeInteger(body.amount)||body.amount<1||body.amount>100000000||!Number.isSafeInteger(body.originalAmount)||body.originalAmount<body.amount||body.originalAmount>100000000||!Number.isInteger(body.tokens)||body.tokens<0||body.tokens>100000||!['USD','CNY','EUR','VND','KRW'].includes(body.currency)||typeof body.active!=='boolean'||typeof body.recommended!=='boolean')fail(400,'Invalid plan fields');
   if(body.kind==='tokens'&&!body.tokens)fail(400,'Token packs require tokens');
   const p={id:pid,name,kind:body.kind,cycleUnit:body.cycleUnit,cycleCount:body.cycleCount,months:body.cycleUnit==='month'?body.cycleCount:body.cycleCount*7/30,amount:body.amount,originalAmount:body.originalAmount,tokens:body.tokens,currency:body.currency,active:body.active,recommended:body.recommended,benefits,region};
   transaction(()=>{if(previous)checkVersion(body.version,previous.version);run('INSERT INTO product_plans VALUES(?,?,1) ON CONFLICT(id) DO UPDATE SET value=excluded.value,version=product_plans.version+1',pid,JSON.stringify(p));audit(user.id,'plan.updated',pid,{before:previous,after:p,reason:why})});return json(res,previous?200:201,{plan:plan(pid)}),true;
  }
  if(route==='/api/admin/orders'&&method==='GET'){
   const list=pageRows(url,"SELECT o.*,u.email,COALESCE(a.dispute,'none') dispute FROM orders o JOIN users u ON u.id=o.user_id LEFT JOIN order_admin a ON a.order_id=o.id WHERE (o.id LIKE ? OR u.email LIKE ?) AND (?='' OR o.status=?) ORDER BY o.created DESC",['%'+q+'%','%'+q+'%',status,status]);return json(res,200,{...list,rows:undefined,orders:list.rows,manualSettlement:process.env.ALLOW_MANUAL_SETTLEMENT==='true'}),true;
  }
  const om=route.match(/^\/api\/admin\/orders\/([^/]+)(?:\/(cancel|refund|dispute))?$/);
  if(om){const oid=om[1],o=getOrder(oid);if(method==='GET'&&!om[2])return json(res,200,{order:o,manualSettlement:process.env.ALLOW_MANUAL_SETTLEMENT==='true'}),true;
   if(method==='PATCH'&&!om[2]){const why=reason(body),note=text(body.note||'',2000,false);transaction(()=>{checkVersion(body.version,getOrder(oid).version);run('INSERT OR IGNORE INTO order_admin(order_id) VALUES(?)',oid);run('UPDATE order_admin SET note=?,version=version+1 WHERE order_id=?',note,oid);audit(user.id,'order.note',oid,{reason:why})});return json(res,200,{ok:true}),true}
   if(method==='POST'&&om[2]){const why=reason(body);transaction(()=>{
    const current=getOrder(oid);
    if(om[2]==='cancel'){if(current.status!=='pending')fail(409,'Only pending orders can be cancelled');run("UPDATE orders SET status='cancelled' WHERE id=?",oid)}
    if(om[2]==='refund'){
     const reference=text(body.reference,200);if(current.refund){if(current.refund.reference!==reference)fail(409,'Refund already recorded');return}
     if(current.status!=='paid')fail(409,'Only paid orders can be refunded');if(body.confirmExternal!==true)fail(400,'Confirm the refund was completed externally');if(one('SELECT order_id FROM refunds WHERE reference=?',reference))fail(409,'Refund reference already used');
     const balance=availableBalance?availableBalance(current.user_id):one('SELECT COALESCE(SUM(delta),0) n FROM ledger WHERE user_id=?',current.user_id).n;
     if(balance<current.terms.tokens)fail(409,'Insufficient tokens to reverse this order. Resolve the balance first.');
     run('INSERT INTO refunds VALUES(?,?,?,?,?)',oid,reference,why,user.id,now());run("UPDATE orders SET status='refunded' WHERE id=?",oid);run('INSERT INTO ledger VALUES(?,?,?,?,?,?)',id(),current.user_id,-current.terms.tokens,'Refund reversal',`refund:${oid}`,now());if(current.terms.kind==='subscription')rebuildMembership(current.user_id);
    }
    if(om[2]==='dispute'){if(!['open','closed'].includes(body.dispute))fail(400,'Invalid dispute status');const reference=text(body.reference,200);run('INSERT OR IGNORE INTO order_admin(order_id) VALUES(?)',oid);run('UPDATE order_admin SET dispute=?,reference=?,version=version+1 WHERE order_id=?',body.dispute,reference,oid);if(body.dispute==='open'&&one('SELECT role FROM users WHERE id=?',current.user_id).role!=='admin'){run('INSERT OR IGNORE INTO user_admin(user_id) VALUES(?)',current.user_id);run("UPDATE user_admin SET status='suspended',version=version+1 WHERE user_id=?",current.user_id);run('DELETE FROM sessions WHERE user_id=?',current.user_id)}}
    audit(user.id,'order.'+om[2],oid,{reason:why,reference:body.reference||null});
   });return json(res,200,{order:getOrder(oid)}),true}
  }
  return false;
 }
 return {relationshipHints:c=>JSON.parse(one('SELECT persona_fields FROM character_admin WHERE character_id=?',c.id)?.persona_fields||'{}'),personaPrompt,handle,plans,plan,snapshot,saveSnapshot,grant,userState,published,characterInfo};
}
