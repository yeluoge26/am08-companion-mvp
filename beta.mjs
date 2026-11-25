import {randomBytes} from 'node:crypto';
export function createBeta({db,transaction,fail,id,now,audit,text,json,operations,limit}){
 const one=(q,...a)=>db.prepare(q).get(...a),all=(q,...a)=>db.prepare(q).all(...a),run=(q,...a)=>db.prepare(q).run(...a);
 db.exec(`CREATE TABLE IF NOT EXISTS invite_codes(id TEXT PRIMARY KEY,code TEXT UNIQUE NOT NULL,batch TEXT NOT NULL,days INTEGER NOT NULL,tokens INTEGER NOT NULL,max_uses INTEGER NOT NULL,used INTEGER NOT NULL DEFAULT 0,expires TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 1,note TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,created TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS invite_redemptions(id TEXT PRIMARY KEY,code_id TEXT NOT NULL REFERENCES invite_codes(id),user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,days INTEGER NOT NULL,tokens INTEGER NOT NULL,expires TEXT NOT NULL,created TEXT NOT NULL,UNIQUE(code_id,user_id));`);
 function redeem(user,b){
  if(!operations.config().betaMode)fail(409,'Beta mode is disabled');
  limit('beta:'+user.id,10,60000);
  const code=text(b.code,80).replace(/[\s-]/g,'').toUpperCase();
  return transaction(()=>{
   const c=one('SELECT * FROM invite_codes WHERE code=?',code);
   if(!c)fail(400,'Invitation code is unavailable');
   const old=one('SELECT * FROM invite_redemptions WHERE code_id=? AND user_id=?',c.id,user.id);
   if(old)return {redemption:old,duplicate:true,access:operations.access(user.id)};
   if(!c.enabled||c.used>=c.max_uses||c.expires<=now())fail(400,'Invitation code is unavailable');
   const sub=one('SELECT * FROM subscriptions WHERE user_id=?',user.id),start=sub&&['active','non-renewing'].includes(sub.status)?Math.max(Date.parse(now()),Date.parse(sub.expires)):Date.parse(now());
   const expires=new Date(start+c.days*86400000).toISOString(),rid=id();
   run('UPDATE invite_codes SET used=used+1,version=version+1 WHERE id=?',c.id);
   run("INSERT INTO subscriptions VALUES(?,'beta','non-renewing',?) ON CONFLICT(user_id) DO UPDATE SET expires=excluded.expires,status='non-renewing'",user.id,expires);
   run('INSERT INTO invite_redemptions VALUES(?,?,?,?,?,?,?)',rid,c.id,user.id,c.days,c.tokens,expires,now());
   run('INSERT INTO ledger VALUES(?,?,?,?,?,?)',id(),user.id,c.tokens,'beta_grant','beta:'+rid,now());
   audit(user.id,'beta.redeemed',c.id,{batch:c.batch,days:c.days,tokens:c.tokens});
   return {redemption:one('SELECT * FROM invite_redemptions WHERE id=?',rid),duplicate:false,access:operations.access(user.id)};
  });
 }
 function cohorts(range){return all('SELECT DISTINCT batch FROM invite_codes ORDER BY batch').map(({batch})=>{
  const users=all('SELECT r.user_id,MIN(r.created) first FROM invite_redemptions r JOIN invite_codes c ON c.id=r.code_id WHERE c.batch=? GROUP BY r.user_id',batch).filter(u=>!range||u.first.slice(0,10)>=range.from&&u.first.slice(0,10)<=range.to);
  return {batch,redeemedUsers:users.length,periods:[1,7,30].map(offset=>{let eligible=0,returned=0;for(const u of users){const target=new Date(Date.parse(u.first.slice(0,10))+offset*86400000).toISOString().slice(0,10);if(target>=now().slice(0,10))continue;eligible++;if(one('SELECT 1 FROM user_activity_days WHERE user_id=? AND day=?',u.user_id,target))returned++}return {offset,eligible,returned,rate:eligible?returned/eligible:null}})};
 })}
 async function handle(req,res,url,actor,b){const route=url.pathname;
  if(route==='/api/admin/invite-codes/cohorts'&&req.method==='GET')return json(res,200,{cohorts:cohorts()}),true;
  if(route==='/api/admin/invite-codes/export'&&req.method==='GET'){
   const batch=url.searchParams.get('batch')||'',rows=all("SELECT code,batch,days,tokens,max_uses,used,expires,enabled,note FROM invite_codes WHERE (?='' OR batch=?) ORDER BY created",batch,batch);
   const cell=x=>'"'+String(x).replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';
   const csv='\uFEFFcode,batch,days,tokens,max_uses,used,expires,enabled,note\r\n'+rows.map(r=>Object.values(r).map(cell).join(',')).join('\r\n');audit(actor.id,'beta.export',null,{batch,count:rows.length});
   return json(res,200,{csv,filename:'invite-codes.csv'}),true;
  }
  if(route==='/api/admin/invite-codes'&&req.method==='GET'){
   const page=Number(url.searchParams.get('page')||1);if(!Number.isInteger(page)||page<1||page>100000)fail(400,'Invalid page');const batch=(url.searchParams.get('batch')||'').slice(0,100),total=one("SELECT COUNT(*) n FROM invite_codes WHERE (?='' OR batch=?)",batch,batch).n;
   return json(res,200,{codes:all("SELECT * FROM invite_codes WHERE (?='' OR batch=?) ORDER BY created DESC,id LIMIT 25 OFFSET ?",batch,batch,(page-1)*25),total,page,pages:Math.max(1,Math.ceil(total/25))}),true;
  }
  if(route==='/api/admin/invite-codes'&&req.method==='POST'){
   const batch=text(b.batch,100),note=text(b.note||'',500,false),reason=text(b.reason,500);
   for(const [k,min,max] of [['count',1,500],['days',1,3650],['tokens',0,100000],['max_uses',1,10000]])if(!Number.isInteger(b[k])||b[k]<min||b[k]>max)fail(400,'Invalid invitation fields');
   if(typeof b.expires!=='string'||!Number.isFinite(Date.parse(b.expires))||Date.parse(b.expires)<=Date.parse(now()))fail(400,'Invalid invitation expiry');
   const expires=new Date(b.expires).toISOString();
   transaction(()=>{for(let n=0;n<b.count;n++)run('INSERT INTO invite_codes(id,code,batch,days,tokens,max_uses,expires,note,created) VALUES(?,?,?,?,?,?,?,?,?)',id(),randomBytes(16).toString('hex').toUpperCase(),batch,b.days,b.tokens,b.max_uses,expires,note,now());audit(actor.id,'beta.batch.created',batch,{count:b.count,days:b.days,tokens:b.tokens,reason})});
   return json(res,201,{created:b.count,batch}),true;
  }
  const m=route.match(/^\/api\/admin\/invite-codes\/([^/]+)(\/redemptions)?$/);
  if(m){const c=one('SELECT * FROM invite_codes WHERE id=?',m[1]);if(!c)fail(404,'Invitation not found');
   if(m[2]&&req.method==='GET')return json(res,200,{redemptions:all('SELECT r.*,u.email FROM invite_redemptions r JOIN users u ON u.id=r.user_id WHERE code_id=? ORDER BY r.created DESC LIMIT 1000',c.id)}),true;
   if(!m[2]&&req.method==='PATCH'){const reason=text(b.reason,500);if(typeof b.enabled!=='boolean')fail(400,'Invalid invitation status');transaction(()=>{if(c.version!==b.version)fail(409,'Record changed. Reload and try again.');run('UPDATE invite_codes SET enabled=?,version=version+1 WHERE id=?',Number(b.enabled),c.id);audit(actor.id,'beta.code.updated',c.id,{enabled:b.enabled,reason})});return json(res,200,{ok:true}),true}
  }
  return false;
 }
 return {redeem,handle,cohorts};
}
