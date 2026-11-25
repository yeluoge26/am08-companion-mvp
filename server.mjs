import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import {randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash, createHmac} from 'node:crypto';
import {promisify} from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {modelConfig,generateReply,updateMemory} from './openai.mjs';
import {createBeta} from './beta.mjs';
import {createOperations} from './operations.mjs';
import {createChatHandler} from './chat-handler.mjs';
import {createTokenEconomy} from './token-economy.mjs';
import {createRBAC} from './rbac.mjs';
import {createMetrics} from './metrics.mjs';
import {createRelationships} from './relationships.mjs';
import {createContentSafety} from './content-safety.mjs';
import {createCommunity} from './community.mjs';
import {createManagement} from './management.mjs';

const scrypt=promisify(scryptCallback), ROOT=path.dirname(fileURLToPath(import.meta.url));
const production=process.env.NODE_ENV==='production';
const PORT=Number(process.env.PORT||4180), HOST=process.env.HOST||'127.0.0.1';
const ORIGIN=process.env.PUBLIC_ORIGIN||`http://127.0.0.1:${PORT}`;
if(production&&!ORIGIN.startsWith('https://')) throw Error('Production requires HTTPS PUBLIC_ORIGIN');
const DATA=path.resolve(process.env.DATA_DIR||path.join(ROOT,'data'));
fs.mkdirSync(DATA,{recursive:true,mode:0o700});
const db=new DatabaseSync(path.join(DATA,'app.sqlite'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'user',created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,csrf TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS characters(id TEXT PRIMARY KEY,owner_id TEXT REFERENCES users(id) ON DELETE CASCADE,name TEXT NOT NULL,age INTEGER NOT NULL CHECK(age>=18),style TEXT NOT NULL,gender TEXT NOT NULL,description TEXT NOT NULL,image TEXT NOT NULL,video TEXT,route TEXT,settings TEXT NOT NULL DEFAULT '{}',created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS favorites(user_id TEXT REFERENCES users(id) ON DELETE CASCADE,character_id TEXT REFERENCES characters(id) ON DELETE CASCADE,created TEXT NOT NULL,PRIMARY KEY(user_id,character_id));
CREATE TABLE IF NOT EXISTS conversations(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,title TEXT NOT NULL,created TEXT NOT NULL,updated TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,role TEXT NOT NULL CHECK(role IN ('user','system')),content TEXT NOT NULL,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS ledger(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,delta INTEGER NOT NULL,reason TEXT NOT NULL,external_key TEXT UNIQUE NOT NULL,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,plan TEXT NOT NULL,amount INTEGER NOT NULL,currency TEXT NOT NULL,status TEXT NOT NULL,request_key TEXT NOT NULL,created TEXT NOT NULL,UNIQUE(user_id,request_key));
CREATE TABLE IF NOT EXISTS subscriptions(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,plan TEXT NOT NULL,status TEXT NOT NULL,expires TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS webhook_events(id TEXT PRIMARY KEY,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS audit(id TEXT PRIMARY KEY,actor TEXT,action TEXT NOT NULL,target TEXT,detail TEXT NOT NULL,created TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS login_limits(key TEXT PRIMARY KEY,count INTEGER NOT NULL,reset INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS password_resets(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires INTEGER NOT NULL,used INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS conversations_user ON conversations(user_id,updated);
CREATE INDEX IF NOT EXISTS messages_conversation ON messages(conversation_id,created);
CREATE INDEX IF NOT EXISTS ledger_user ON ledger(user_id,created);
`);

// Upgrade existing databases without losing message order or conversation ownership.
if(!db.prepare("SELECT sql FROM sqlite_master WHERE name='messages'").get().sql.includes("'assistant'")){
 db.exec(`BEGIN IMMEDIATE;
 CREATE TABLE messages_v2(id TEXT PRIMARY KEY,conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,role TEXT NOT NULL CHECK(role IN ('user','system','assistant')),content TEXT NOT NULL,created TEXT NOT NULL);
 INSERT INTO messages_v2 SELECT * FROM messages ORDER BY rowid;
 DROP TABLE messages;
 ALTER TABLE messages_v2 RENAME TO messages;
 CREATE INDEX messages_conversation ON messages(conversation_id,created);
 PRAGMA user_version=2; COMMIT;`);
}
const pendingReplies=new Set();

const now=()=>new Date().toISOString(), id=()=>randomBytes(16).toString('hex'), hash=x=>createHash('sha256').update(x).digest('hex');
const one=(q,...a)=>db.prepare(q).get(...a), all=(q,...a)=>db.prepare(q).all(...a), run=(q,...a)=>db.prepare(q).run(...a);
const fail=(status,message)=>{throw Object.assign(Error(message),{status})};
function transaction(fn){db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result}catch(e){db.exec('ROLLBACK');throw e}}
function audit(actor,action,target,detail={}){run('INSERT INTO audit VALUES(?,?,?,?,?,?)',id(),actor,action,target,JSON.stringify(detail),now())}
const operations=createOperations({db,transaction,audit,fail,now});
async function passwordHash(password){const salt=randomBytes(16).toString('hex');return `${salt}:${(await scrypt(password,salt,64)).toString('hex')}`}
async function passwordValid(password,stored){const [salt,expected]=stored.split(':');const actual=await scrypt(password,salt,64);return timingSafeEqual(actual,Buffer.from(expected,'hex'))}
function text(value,max=200,required=true){if(typeof value!=='string'||value.length>max||(required&&!value.trim()))fail(400,'Invalid text field');return value.trim()}
function password(value){if(typeof value!=='string'||value.length<12||value.length>128)fail(400,'Password must contain 12–128 characters');return value}
function email(value){const e=text(value,254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))fail(400,'Invalid email address');return e}
function safeUser(user){return {id:user.id,email:user.email,name:user.name,role:user.role,created:user.created}}
function limit(key,max=12,windowMs=900000){const t=Date.now(),row=one('SELECT * FROM login_limits WHERE key=?',key);if(!row||row.reset<t){run('INSERT OR REPLACE INTO login_limits VALUES(?,?,?)',key,1,t+windowMs);return}if(row.count>=max)fail(429,'Too many attempts. Try again later.');run('UPDATE login_limits SET count=count+1 WHERE key=?',key)}
function publicCharacter(c){const settings=JSON.parse(c.settings||'{}');delete settings.prompt;if(community.blocked('character',c.id))return {...c,name:'Content unavailable',description:'Content removed after review',image:'',video:null,settings:{},moderated:true};return {...c,age:settings.ageKnown===false?null:c.age,settings,tags:management.characterInfo(c).tags||'',seo_title:management.characterInfo(c).seo_title||'',seo_description:management.characterInfo(c).seo_description||''}}
function visibleCharacter(cid,user,allowHidden=false){const c=one('SELECT * FROM characters WHERE id=?',cid);if(!c||(!allowHidden&&community.blocked('character',cid))||c.owner_id&&c.owner_id!==user?.id||(!allowHidden&&!c.owner_id&&!management.published(cid)))fail(404,'Character not found');return c}
const PLANS=[{id:'monthly',name:'1 Month',months:1,amount:999,currency:'USD',tokens:100},{id:'quarterly',name:'3 Months',months:3,amount:2697,currency:'USD',tokens:300},{id:'annual',name:'12 Months',months:12,amount:4788,currency:'USD',tokens:1200}];
const assetRoot=path.resolve(process.env.ASSET_DIR||path.join(ROOT,'public/assets'));
let catalog=[];const catalogPath=path.join(ROOT,'public/catalog.json');if(fs.existsSync(catalogPath))catalog=JSON.parse(fs.readFileSync(catalogPath,'utf8'));
transaction(()=>{for(const c of catalog){run(`INSERT INTO characters(id,owner_id,name,age,style,gender,description,image,video,route,settings,created) VALUES(?,NULL,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`,String(c.id),c.name,Math.max(18,Number(c.age)||18),c.style||'Realistic',c.gender||'female',c.description||'A character from the public collection.',c.image,c.video||null,c.route||null,JSON.stringify(c.settings||{}),now())}});
if(process.env.ADMIN_EMAIL&&process.env.ADMIN_PASSWORD){const adminEmail=email(process.env.ADMIN_EMAIL);if(!one('SELECT id FROM users WHERE email=?',adminEmail)){run('INSERT INTO users VALUES(?,?,?,?,?,?)',id(),adminEmail,'Administrator',await passwordHash(password(process.env.ADMIN_PASSWORD)),'admin',now())}}
const management=createManagement({db,transaction,audit,fail,now,id,text,json,operations,catalog,seeds:PLANS,availableBalance:uid=>economy.balance(uid).available});
const economy=createTokenEconomy({db,transaction,fail,id,now,audit});
const relationships=createRelationships({db,transaction,id,now,fail,audit});
const community=createCommunity({db,transaction,fail,id,now,audit,text,visibleCharacter});
const safety=createContentSafety({db,transaction,fail,id,now,audit,text,json});
const beta=createBeta({db,transaction,fail,id,now,audit,text,json,operations,limit});
const metrics=createMetrics({db,now,fail});
const rbac=createRBAC({db,transaction,now,id,fail,audit,text,email,password,passwordHash,passwordValid,json});
// All accounts are ordinary users unless explicitly bootstrapped by the operator.
function sessionCookie(req){return req.headers['x-admin-context']==='1'?'admin_sid':'sid'}
function getSession(req){const cookie=sessionCookie(req)+'=';const token=(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookie))?.slice(cookie.length);if(!token)return null;return one("SELECT sessions.*,users.email,users.name,users.role,users.created FROM sessions JOIN users ON users.id=sessions.user_id WHERE token=? AND expires>? AND NOT EXISTS(SELECT 1 FROM user_admin a WHERE a.user_id=users.id AND a.status='suspended') AND NOT EXISTS(SELECT 1 FROM staff_roles s WHERE s.user_id=users.id AND s.status='disabled')",hash(token),Date.now())}
function authenticate(req){const session=getSession(req);if(!session)fail(401,'Please sign in');return {session,user:{id:session.user_id,email:session.email,name:session.name,role:session.role,created:session.created}}}
function newSession(res,user,cookieName='sid'){const token=randomBytes(32).toString('hex'),csrf=randomBytes(24).toString('hex');run('INSERT INTO sessions VALUES(?,?,?,?)',hash(token),user.id,csrf,Date.now()+7*86400000);res.setHeader('Set-Cookie',`${cookieName}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=604800${production?'; Secure':''}`);return csrf}
function json(res,status,data){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data))}
async function readBody(req,max=65536){let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>max)fail(413,'Request too large');chunks.push(chunk)}return Buffer.concat(chunks).toString('utf8')}
function verifyMutation(req,session){if(req.headers.origin!==ORIGIN)fail(403,'Origin not allowed');if(session&&req.headers['x-csrf-token']!==session.csrf)fail(403,'Invalid CSRF token')}
async function sendReset(email,token){const message={to:email,subject:'Reset your companion account password',text:`Reset your password within 15 minutes: ${ORIGIN}/#reset/${token}\nIf you did not request this, ignore this message.`};if(process.env.MAIL_MODE==='outbox'&&!production){const outbox=path.join(DATA,'outbox');fs.mkdirSync(outbox,{recursive:true,mode:0o700});fs.writeFileSync(path.join(outbox,id()+'.json'),JSON.stringify(message),{mode:0o600});return}if(!process.env.MAIL_WEBHOOK_URL||!process.env.MAIL_WEBHOOK_TOKEN)fail(503,'Email delivery is not configured');const destination=new URL(process.env.MAIL_WEBHOOK_URL);if(destination.protocol!=='https:')fail(503,'Email adapter requires HTTPS');const r=await fetch(destination,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+process.env.MAIL_WEBHOOK_TOKEN},body:JSON.stringify(message),signal:AbortSignal.timeout(10000)});if(!r.ok)fail(503,'Email delivery is temporarily unavailable')}
function grantOrder(order,eventKey){return management.grant(order,eventKey)}

const handleChat=createChatHandler({db,metrics,relationships,operations,transaction,audit,fail,now,id,text,json,limit,publicCharacter,visibleCharacter,pendingReplies,community,safety,management});

async function api(req,res,url){const route=url.pathname,method=req.method,session=getSession(req);const isWrite=!['GET','HEAD'].includes(method);
  let accessActor=session?.user_id||null;
  if(route.startsWith('/api/admin/')||route==='/api/auth/admin-login')res.once('finish',()=>{try{rbac.logAccess(accessActor,accessActor?rbac.identity(accessActor)?.role:null,method,route,res.statusCode)}catch{console.error('Staff access audit failed')}});
  if(session?.role==='user'&&req.headers['x-admin-context']!=='1'&&/^\/api\/(me|characters|conversations|favorites|wallet|orders|reports|chat)(?:\/|$)/.test(route))res.once('finish',()=>{if(res.statusCode<400){try{metrics.touch(session.user_id)}catch{console.error('Activity recording failed')}}});
  if(route==='/api/features'&&method==='GET')return json(res,200,operations.features());
  if(route==='/api/health'&&method==='GET')return json(res,200,{ok:true,modelEnabled:modelConfig().enabled});
  if(route==='/api/billing/webhook'&&method==='POST'){
    const raw=await readBody(req),secret=process.env.BILLING_WEBHOOK_SECRET;if(!secret)fail(503,'Billing webhook not configured');
    const timestamp=req.headers['x-webhook-timestamp'];if(!/^\d+$/.test(timestamp||'')||Math.abs(Date.now()/1000-Number(timestamp))>300)fail(401,'Expired webhook');
    const expected=createHmac('sha256',secret).update(`${timestamp}.${raw}`).digest('hex'),provided=req.headers['x-webhook-signature']||'';
    if(provided.length!==64||!timingSafeEqual(Buffer.from(expected),Buffer.from(provided)))fail(401,'Invalid webhook signature');
    let event;try{event=JSON.parse(raw)}catch{fail(400,'Invalid JSON')}
    const eventId=text(event.id,128),orderId=text(event.orderId,64);if(event.type!=='payment.succeeded')fail(400,'Unsupported event');
    const duplicate=transaction(()=>{if(one('SELECT id FROM webhook_events WHERE id=?',eventId))return true;const order=one('SELECT * FROM orders WHERE id=?',orderId);if(!order)fail(404,'Order not found');if(event.amount!==order.amount||event.currency!==order.currency)fail(400,'Payment amount or currency mismatch');if(order.status==='cancelled')fail(409,'Order cancelled');grantOrder(order,eventId);run('INSERT INTO webhook_events VALUES(?,?)',eventId,now());return false});return json(res,200,{received:true,duplicate});
  }
  if(isWrite)verifyMutation(req,session);
  let body={};if(isWrite){if(!(req.headers['content-type']||'').startsWith('application/json'))fail(415,'JSON required');const raw=await readBody(req,['/api/admin/safety/import','/api/admin/safety/test'].includes(route)?1048576:65536);try{body=raw?JSON.parse(raw):{}}catch{fail(400,'Invalid JSON')}if(!body||Array.isArray(body)||typeof body!=='object')fail(400,'JSON object required')}
  if(route==='/api/auth/register'&&method==='POST'){
    limit(`register:${req.socket.remoteAddress}`,6);const addr=email(body.email),name=text(body.name,60),pass=password(body.password);if(body.adult!==true)fail(400,'Confirm that you are at least 18');
    if(one('SELECT id FROM users WHERE email=?',addr))fail(409,'This email is already registered');const uid=id(),digest=await passwordHash(pass);
    try{run('INSERT INTO users VALUES(?,?,?,?,?,?)',uid,addr,name,digest,'user',now())}catch(e){if(String(e).includes('UNIQUE'))fail(409,'This email is already registered');throw e}
    run('INSERT OR IGNORE INTO user_admin(user_id,adult_confirmed,source) VALUES(?,1,?)',uid,'direct');const user=one('SELECT * FROM users WHERE id=?',uid);const csrf=newSession(res,user);audit(uid,'account.created',uid);metrics.touch(uid);return json(res,201,{user:safeUser(user),csrf});
  }
  if(['/api/auth/login','/api/auth/admin-login'].includes(route)&&method==='POST'){
    const addr=email(body.email);limit(`login:${req.socket.remoteAddress}`,30);limit(`account:${addr}`,12);const user=one('SELECT * FROM users WHERE email=?',addr);const pass=text(body.password,128);if(route==='/api/auth/admin-login')accessActor=user?.id||null;
    // A real scrypt operation also runs for unknown accounts.
    const valid=await passwordValid(pass,user?.password||'00000000000000000000000000000000:'+Buffer.alloc(64).toString('hex'));if(!user||!valid||one('SELECT password FROM users WHERE id=?',user.id)?.password!==user.password)fail(401,'Incorrect email or password');
    if(route==='/api/auth/admin-login'&&(user.role!=='admin'||!rbac.identity(user.id)))fail(403,'Administrator access required');if(rbac.identity(user.id)?.status==='disabled')fail(403,'Staff account is disabled');if(management.userState(user.id).status==='suspended')fail(403,'Account suspended. Contact the operator.');const csrf=newSession(res,user,route==='/api/auth/admin-login'?'admin_sid':'sid');if(route==='/api/auth/login')metrics.touch(user.id);return json(res,200,{user:safeUser(user),csrf});
  }
  if(route==='/api/auth/forgot'&&method==='POST'){
    if(!(process.env.MAIL_MODE==='outbox'&&!production)&&(!process.env.MAIL_WEBHOOK_URL||!process.env.MAIL_WEBHOOK_TOKEN))fail(503,'Email recovery is not configured. Contact the deployment operator.');
    const addr=email(body.email);limit(`reset-ip:${req.socket.remoteAddress}`,10,3600000);limit(`reset-email:${addr}`,3,3600000);const user=one('SELECT id FROM users WHERE email=?',addr);
    if(user){const token=randomBytes(32).toString('hex');run('INSERT INTO password_resets VALUES(?,?,?,0)',hash(token),user.id,Date.now()+15*60000);try{await sendReset(addr,token)}catch(e){run('DELETE FROM password_resets WHERE token=?',hash(token));throw e}}
    return json(res,200,{ok:true,notice:'If an account exists, a password reset link will be sent.'});
  }
  if(route==='/api/auth/reset'&&method==='POST'){
    limit(`reset-consume:${req.socket.remoteAddress}`,20,3600000);const token=text(body.token,128),digest=await passwordHash(password(body.password));
    transaction(()=>{const reset=one('SELECT * FROM password_resets WHERE token=? AND used=0 AND expires>?',hash(token),Date.now());if(!reset)fail(400,'Reset link is invalid or expired');run('UPDATE users SET password=? WHERE id=?',digest,reset.user_id);run('UPDATE password_resets SET used=1 WHERE user_id=?',reset.user_id);run('DELETE FROM sessions WHERE user_id=?',reset.user_id);audit(reset.user_id,'password.reset',reset.user_id)});
    return json(res,200,{ok:true});
  }
  if(route==='/api/admin/me'&&method==='GET'){if(!session)return json(res,200,{user:null,csrf:null});const {user}=authenticate(req);if(user.role!=='admin')fail(403,'Administrator access required');return json(res,200,{user:{...user,staff:rbac.identity(user.id)},csrf:session.csrf})}
  if(route==='/api/me'&&method==='GET'){if(!session)return json(res,200,{user:null,csrf:null});const {user}=authenticate(req);return json(res,200,{user,csrf:session.csrf,balance:one('SELECT COALESCE(SUM(delta),0) AS value FROM ledger WHERE user_id=?',user.id).value,subscription:one('SELECT * FROM subscriptions WHERE user_id=?',user.id)||null,modelEnabled:modelConfig().enabled})}
  if(route==='/api/pricing/actions'&&method==='GET')return json(res,200,{rules:economy.rules()});
  if(route==='/api/token-packs'&&method==='GET')return json(res,200,{plans:management.plans().filter(p=>p.kind==='tokens'),billingMode:process.env.CHECKOUT_URL?'external':process.env.ALLOW_MANUAL_SETTLEMENT==='true'?'manual':'unavailable'});
  if(route==='/api/plans'&&method==='GET')return json(res,200,{plans:management.plans(),billingMode:process.env.CHECKOUT_URL?'external':process.env.ALLOW_MANUAL_SETTLEMENT==='true'?'manual':'unavailable',recurring:false});
  if(route==='/api/characters'&&method==='GET'){
    const uid=session?.user_id||'';let rows=all("SELECT c.* FROM characters c LEFT JOIN character_admin a ON a.character_id=c.id WHERE c.owner_id=? OR (c.owner_id IS NULL AND COALESCE(a.status,'published')='published') ORDER BY CASE WHEN ?=1 THEN CASE COALESCE(a.persona_status,'draft') WHEN 'refined' THEN 2 WHEN 'reviewed' THEN 1 ELSE 0 END ELSE 0 END DESC,COALESCE(a.rank,0) DESC,c.created DESC",uid,Number(operations.config().preferReviewed));rows=rows.filter(c=>!community.blocked('character',c.id));const q=(url.searchParams.get('q')||'').toLowerCase();if(q)rows=rows.filter(c=>c.name.toLowerCase().includes(q));const category=url.searchParams.get('category');if(category==='anime')rows=rows.filter(c=>c.style==='Anime');if(category==='guys')rows=rows.filter(c=>c.gender==='male');if(category==='girls')rows=rows.filter(c=>c.gender==='female'&&c.style!=='Anime');return json(res,200,{characters:rows.map(publicCharacter)})
  }
  if(/^\/api\/characters\/[^/]+$/.test(route)&&method==='GET')return json(res,200,{character:publicCharacter(visibleCharacter(route.split('/').pop(),session?{id:session.user_id}:null))});
  const {user}=authenticate(req);
  if(route==='/api/beta/redeem'&&method==='POST')return json(res,200,beta.redeem(user,body));
  const relationshipRoute=route.match(/^\/api\/characters\/([^/]+)\/relationship$/);
  if(relationshipRoute&&['GET','PATCH'].includes(method)){const cid=relationshipRoute[1];visibleCharacter(cid,user,true);return json(res,200,{relationship:method==='PATCH'?relationships.saveAnniversaries(user.id,cid,body):relationships.state(user.id,cid)})}
  const characterMemoryRoute=route.match(/^\/api\/characters\/([^/]+)\/memory$/);
  if(characterMemoryRoute&&['GET','PATCH','DELETE'].includes(method)){
    const cid=characterMemoryRoute[1];visibleCharacter(cid,user,true);
    if(method==='PATCH')operations.saveCharacterMemory(user.id,cid,body);
    if(method==='DELETE'){const current=operations.characterMemory(user.id,cid);operations.saveCharacterMemory(user.id,cid,{summary:'',enabled:current.enabled,revision:body.revision})}
    return json(res,200,operations.memoryState(user.id,cid));
  }
  if(route==='/api/me/settings'&&method==='GET')return json(res,200,economy.balance(user.id));
  if(route==='/api/me/settings'&&method==='PATCH')return json(res,200,economy.saveSettings(user.id,body));
  if(route==='/api/me/moderation'&&method==='GET')return json(res,200,{reports:community.mine(user.id)});
  const appealRoute=route.match(/^\/api\/reports\/([^/]+)\/appeals$/);
  if(appealRoute&&method==='POST'){limit(`appeals:${user.id}`,10,3600000);return json(res,201,community.appeal(user.id,appealRoute[1],body))}
  if(route==='/api/reports'&&method==='POST'){limit(`reports:${user.id}`,20,3600000);return json(res,201,community.submit(user,body,req.headers['idempotency-key']||''))}
  if(route==='/api/me'&&method==='DELETE'){
    if(user.role==='admin')fail(403,'Administrators cannot delete themselves');
    if(body.confirm!==true)fail(400,'Confirm account deletion');
    limit(`delete-account:${user.id}`,5,3600000);
    const stored=one('SELECT password FROM users WHERE id=?',user.id);
    if(!await passwordValid(text(body.password,128),stored.password))fail(403,'Current password is incorrect');
    transaction(()=>{
      if(all('SELECT id FROM conversations WHERE user_id=?',user.id).some(c=>pendingReplies.has(c.id))||one("SELECT id FROM chat_runs WHERE user_id=? AND status='pending'",user.id)||economy.balance(user.id).held>0)fail(409,'Wait for active requests to finish');
      for(const table of ['refunds','order_admin','order_terms'])run(`DELETE FROM ${table} WHERE order_id IN (SELECT id FROM orders WHERE user_id=?)`,user.id);
      run("UPDATE reports SET excerpt='[Content deleted]' WHERE (target_type='message' AND target_id IN (SELECT m.id FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.user_id=?)) OR (target_type='character' AND target_id IN (SELECT id FROM characters WHERE owner_id=?))",user.id,user.id);
      run('DELETE FROM moderation_evidence WHERE target_id IN (SELECT m.id FROM messages m JOIN conversations c ON c.id=m.conversation_id WHERE c.user_id=?)',user.id);
      run('UPDATE reports SET reporter=NULL WHERE reporter=?',user.id);
      run('DELETE FROM audit WHERE actor=? OR target=?',user.id,user.id);
      run('DELETE FROM users WHERE id=?',user.id);
      audit(null,'account.deleted',null);
    });
    res.setHeader('Set-Cookie',`sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${production?'; Secure':''}`);
    return json(res,200,{ok:true});
  }
  if(route==='/api/chat/access'&&method==='GET')return json(res,200,operations.access(user.id));
  if(route==='/api/me/memory'&&method==='GET')return json(res,200,{memory:operations.memory(user.id),globalEnabled:operations.config().memoryEnabled});
  if(route==='/api/me/memory'&&method==='PATCH')return json(res,200,{memory:operations.saveMemory(user.id,body)});
  if(route==='/api/auth/logout'&&method==='POST'){run('DELETE FROM sessions WHERE token=?',session.token);res.setHeader('Set-Cookie',`${sessionCookie(req)}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${production?'; Secure':''}`);return json(res,200,{ok:true})}
  if(route==='/api/me'&&method==='PATCH'){const name=text(body.name,60);run('UPDATE users SET name=? WHERE id=?',name,user.id);return json(res,200,{user:{...user,name}})}
  if(route==='/api/auth/password'&&method==='POST'){const u=one('SELECT * FROM users WHERE id=?',user.id);if(!await passwordValid(text(body.currentPassword,128),u.password))fail(403,'Current password is incorrect');const digest=await passwordHash(password(body.password));transaction(()=>{run('UPDATE users SET password=? WHERE id=?',digest,user.id);run('DELETE FROM sessions WHERE user_id=?',user.id);audit(user.id,'password.changed',user.id)});if(management.userState(user.id).status==='suspended')fail(403,'Account suspended. Contact the operator.');const csrf=newSession(res,user,sessionCookie(req));return json(res,200,{ok:true,csrf})}
  if(route==='/api/me/export'&&method==='GET'){return json(res,200,{user,activityDays:all('SELECT day,first_seen,last_seen,source FROM user_activity_days WHERE user_id=?',user.id),memoryUsage:all('SELECT model,input_tokens,output_tokens,created FROM memory_usage WHERE user_id=?',user.id),relationshipEvents:all('SELECT character_id,xp,rule_version,created FROM relationship_events WHERE user_id=?',user.id),relationshipMilestones:all('SELECT character_id,level,created FROM relationship_milestones WHERE user_id=?',user.id),relationships:all('SELECT character_id,xp,level,started,anniversaries FROM relationships WHERE user_id=?',user.id),relationshipMemories:all('SELECT character_id,summary,enabled,revision,updated FROM relationship_memories WHERE user_id=?',user.id),moderation:community.mine(user.id),spending:economy.balance(user.id),reports:all('SELECT id,target_type,target_id,reason,status,resolution,created FROM reports WHERE reporter=?',user.id),memory:operations.memory(user.id),chatAccess:operations.access(user.id),characters:all('SELECT * FROM characters WHERE owner_id=?',user.id),favorites:all('SELECT * FROM favorites WHERE user_id=?',user.id),conversations:all('SELECT * FROM conversations WHERE user_id=?',user.id),messages:all('SELECT messages.* FROM messages JOIN conversations ON conversations.id=messages.conversation_id WHERE conversations.user_id=?',user.id),orders:all('SELECT * FROM orders WHERE user_id=?',user.id),ledger:all('SELECT * FROM ledger WHERE user_id=?',user.id)})}
  if(route==='/api/characters'&&method==='POST'){if(!operations.features().features.createCharacter)fail(404,'Feature disabled');
    const name=text(body.name,60),age=Number(body.age);if(!Number.isInteger(age)||age<18||age>100)fail(400,'Age must be 18–100');if(!['Realistic','Anime'].includes(body.style))fail(400,'Invalid style');if(!['female','male'].includes(body.gender))fail(400,'Invalid gender');
    const image=text(body.image,200);if(!catalog.some(c=>c.image===image))fail(400,'Choose an existing library image');if(one('SELECT COUNT(*) AS n FROM characters WHERE owner_id=?',user.id).n>=100)fail(409,'Character limit reached');const cid=id();run('INSERT INTO characters VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',cid,user.id,name,age,body.style,body.gender,text(body.description||'',1000,false),image,null,null,JSON.stringify({personality:text(body.personality||'Friendly',100),voice:text(body.voice||'Not connected',80)}),now());return json(res,201,{character:publicCharacter(one('SELECT * FROM characters WHERE id=?',cid))})
  }
  if(/^\/api\/characters\/[^/]+$/.test(route)&&method==='DELETE'){const cid=route.split('/').pop(),c=visibleCharacter(cid,user,true);if(all('SELECT id FROM conversations WHERE character_id=?',cid).some(c=>pendingReplies.has(c.id))||one("SELECT chat_runs.id FROM chat_runs JOIN conversations ON conversations.id=chat_runs.conversation_id WHERE conversations.character_id=? AND chat_runs.status='pending'",cid))fail(409,'AI reply is still pending');if(c.owner_id!==user.id)fail(403,'Only your own characters can be deleted');run('DELETE FROM characters WHERE id=?',cid);return json(res,200,{ok:true})}
  if(route==='/api/favorites'&&method==='GET')return json(res,200,{characters:all('SELECT characters.* FROM favorites JOIN characters ON characters.id=favorites.character_id WHERE favorites.user_id=? ORDER BY favorites.created DESC',user.id).filter(c=>!community.blocked('character',c.id)&&(c.owner_id||management.published(c.id))).map(publicCharacter)});
  if(/^\/api\/favorites\/[^/]+$/.test(route)&&['PUT','DELETE'].includes(method)){const cid=route.split('/').pop();visibleCharacter(cid,user);if(method==='PUT')run('INSERT OR IGNORE INTO favorites VALUES(?,?,?)',user.id,cid,now());else run('DELETE FROM favorites WHERE user_id=? AND character_id=?',user.id,cid);return json(res,200,{ok:true})}
  if(route==='/api/conversations'&&method==='GET')return json(res,200,{conversations:all('SELECT conversations.*,characters.name AS character_name,characters.image FROM conversations JOIN characters ON characters.id=conversations.character_id WHERE user_id=? ORDER BY updated DESC',user.id).map(c=>community.blocked('character',c.character_id)?{...c,title:'Content unavailable',character_name:'Content unavailable',image:''}:c)});
  if(route==='/api/conversations'&&method==='POST'){const character=visibleCharacter(text(body.characterId,100),user),cid=id();const existing=one('SELECT * FROM conversations WHERE user_id=? AND character_id=?',user.id,character.id);if(existing)return json(res,200,{conversation:existing});transaction(()=>{run('INSERT INTO conversations VALUES(?,?,?,?,?,?)',cid,user.id,character.id,character.name,now(),now());const greeting=management.characterInfo(character).greeting;if(greeting){const blocked=safety.check(user,cid,greeting,'greeting:'+cid,'output');run('INSERT INTO messages VALUES(?,?,?,?,?)',id(),cid,'assistant',blocked?operations.config().outputFallback:greeting,now())}});return json(res,201,{conversation:one('SELECT * FROM conversations WHERE id=?',cid)})}
  const convMatch=route.match(/^\/api\/conversations\/([^/]+)(\/messages)?$/);
  if(convMatch){
    const conversation=one('SELECT * FROM conversations WHERE id=? AND user_id=?',convMatch[1],user.id);
    if(!conversation)fail(404,'Conversation not found');
    if(method==='DELETE'&&!convMatch[2]){if(pendingReplies.has(conversation.id))fail(409,'AI reply is still pending');run('DELETE FROM conversations WHERE id=?',conversation.id);return json(res,200,{ok:true})}
    if(method==='GET')return json(res,200,{conversation:community.blocked('character',conversation.character_id)?{...conversation,title:'Content unavailable'}:conversation,messages:all('SELECT * FROM messages WHERE conversation_id=? ORDER BY rowid',conversation.id).map(community.mask),failures:all("SELECT r.message_id,r.content,r.error FROM chat_runs r WHERE r.conversation_id=? AND r.user_id=? AND r.status='failed' AND r.rowid=(SELECT MAX(r2.rowid) FROM chat_runs r2 WHERE r2.message_id=r.message_id)",conversation.id,user.id).map(r=>community.blocked('message',r.message_id)?{...r,content:'[Content removed after review]'}:r),character:publicCharacter(visibleCharacter(conversation.character_id,user,true)),relationshipMemory:operations.memoryState(user.id,conversation.character_id),relationship:relationships.state(user.id,conversation.character_id),access:operations.access(user.id),modelEnabled:modelConfig().enabled});
    if(method==='POST'&&convMatch[2]){visibleCharacter(conversation.character_id,user);return handleChat(req,res,body,conversation,user);}
  }
  if(route==='/api/generate'&&method==='POST')fail(503,'Model API is not connected. No credits have been deducted.');
  if(route==='/api/wallet'&&method==='GET')return json(res,200,{...economy.balance(user.id),ledger:all('SELECT id,delta,reason,created FROM ledger WHERE user_id=? ORDER BY rowid DESC LIMIT 100',user.id)});
  if(route==='/api/orders'&&method==='GET')return json(res,200,{orders:all('SELECT * FROM orders WHERE user_id=? ORDER BY created DESC',user.id)});
  if(route==='/api/orders'&&method==='POST'){if(operations.features().betaMode)fail(409,'Purchases are disabled during beta');if(!process.env.CHECKOUT_URL&&process.env.ALLOW_MANUAL_SETTLEMENT!=='true')fail(503,'Payments are not configured.');const key=text(req.headers['idempotency-key']||'',100);const existing=one('SELECT * FROM orders WHERE user_id=? AND request_key=?',user.id,key);if(existing){if(existing.plan!==body.plan)fail(409,'Idempotency key was used for a different plan');return json(res,200,{order:existing})}const plan=management.plan(body.plan);if(!plan||!plan.active)fail(400,'Unknown plan');if(body.planVersion!==undefined&&body.planVersion!==plan.version)fail(409,'Plan changed. Reload pricing and try again.');limit(`orders:${user.id}`,10,3600000);const oid=id();transaction(()=>{run('INSERT INTO orders VALUES(?,?,?,?,?,?,?,?)',oid,user.id,plan.id,plan.amount,plan.currency,'pending',key,now());management.saveSnapshot(oid,plan)});let checkoutUrl=null;if(process.env.CHECKOUT_URL){const destination=new URL(process.env.CHECKOUT_URL);if(destination.protocol!=='https:')fail(503,'Checkout configuration requires HTTPS');destination.searchParams.set('order_id',oid);checkoutUrl=destination.href}return json(res,201,{order:one('SELECT * FROM orders WHERE id=?',oid),checkoutUrl,notice:'Order created; no payment has been collected. Credits are allocated only after verified settlement.'})}
  if(/^\/api\/orders\/[^/]+\/cancel$/.test(route)&&method==='POST'){const oid=route.split('/')[3],order=one('SELECT * FROM orders WHERE id=? AND user_id=?',oid,user.id);if(!order)fail(404,'Order not found');if(order.status!=='pending')fail(409,'Only pending orders can be cancelled');run('UPDATE orders SET status=? WHERE id=?','cancelled',oid);return json(res,200,{ok:true})}
  if(route==='/api/subscription/cancel'&&method==='POST'){run('UPDATE subscriptions SET status=? WHERE user_id=?','non-renewing',user.id);audit(user.id,'subscription.non-renewing',user.id);return json(res,200,{ok:true,notice:'This MVP does not initiate recurring charges. Existing access continues until expiry.'})}
  if(route.startsWith('/api/admin/')){
    if(user.role!=='admin')fail(403,'Administrator access required');
    const staff=rbac.authorize(user.id,method,route);user.staffRole=staff.role;user.permissions=staff.permissions;
    if(await rbac.handle(req,res,url,user,body))return;
    if(await safety.handle(req,res,url,user,body))return;
    if(route==='/api/admin/metrics'&&method==='GET'){const report=metrics.report(url.searchParams);return json(res,200,{...report,inviteCohorts:beta.cohorts(report.range)})}
    if(route==='/api/admin/relationship-rules'&&method==='GET')return json(res,200,{config:relationships.config()});
    if(route==='/api/admin/relationship-rules'&&method==='PUT')return json(res,200,{config:relationships.saveConfig(body,user.id)});
    if(route==='/api/admin/pricing-rules'&&method==='GET')return json(res,200,{rules:economy.rules()});
    if(route==='/api/admin/pricing-rules'&&method==='PUT')return json(res,200,{rules:economy.saveRule(body,user.id)});
    if(route==='/api/admin/reports'&&method==='GET')return json(res,200,community.queue(url.searchParams));
    if(route==='/api/admin/appeals'&&method==='GET')return json(res,200,community.appeals(url.searchParams));
    const reviewAppealRoute=route.match(/^\/api\/admin\/appeals\/([^/]+)\/resolve$/);
    if(reviewAppealRoute&&method==='POST')return json(res,200,community.reviewAppeal(user.id,reviewAppealRoute[1],body,user.staffRole==='superadmin'));
    const reportRoute=route.match(/^\/api\/admin\/reports\/([^/]+)(\/resolve)?$/);
    if(reportRoute&&method==='GET'&&!reportRoute[2]){audit(user.id,'report.viewed',reportRoute[1]);return json(res,200,{report:community.detail(reportRoute[1])})}
    if(reportRoute&&method==='POST'&&reportRoute[2])return json(res,200,{report:community.resolve(user.id,reportRoute[1],body)});
    if(await beta.handle(req,res,url,user,body))return;
    if(await management.handle(req,res,url,user,body))return;
    if(route==='/api/admin/config'&&method==='GET')return json(res,200,{config:operations.config(),stats:operations.stats(),providerConfigured:modelConfig().enabled});
    if(route==='/api/admin/config'&&method==='PUT')return json(res,200,{config:operations.saveConfig(body,user.id)});
    if(route==='/api/admin/summary'&&method==='GET')return json(res,200,{users:one('SELECT COUNT(*) AS n FROM users').n,characters:one('SELECT COUNT(*) AS n FROM characters').n,conversations:one('SELECT COUNT(*) AS n FROM conversations').n,pendingOrders:one("SELECT COUNT(*) AS n FROM orders WHERE status='pending'").n,modelEnabled:modelConfig().enabled});
    if(route==='/api/admin/users'&&method==='GET')return json(res,200,{users:all('SELECT id,email,name,role,created,(SELECT COALESCE(SUM(delta),0) FROM ledger WHERE user_id=users.id) AS balance FROM users ORDER BY created DESC LIMIT 200').map(u=>({...u,chatAccess:operations.access(u.id)}))});
    if(route==='/api/admin/orders'&&method==='GET')return json(res,200,{orders:all('SELECT orders.*,users.email FROM orders JOIN users ON users.id=orders.user_id ORDER BY orders.created DESC LIMIT 200')});
    if(route==='/api/admin/audit'&&method==='GET')return json(res,200,{events:all('SELECT * FROM audit ORDER BY rowid DESC LIMIT 200')});
    if(route==='/api/admin/credits'&&method==='POST'){const uid=text(body.userId,64),delta=Number(body.delta),reason=text(body.reason,200),key=text(req.headers['idempotency-key']||'',100);if(!Number.isSafeInteger(delta)||delta===0||Math.abs(delta)>100000)fail(400,'Invalid credit adjustment');const target=one('SELECT id,role FROM users WHERE id=?',uid);if(!target)fail(404,'User not found');if(target.role==='admin')fail(409,'Use staff management for employee accounts');const duplicate=transaction(()=>{const old=one('SELECT * FROM ledger WHERE external_key=?',`admin:${key}`);if(old){if(old.user_id!==uid||old.delta!==delta)fail(409,'Idempotency conflict');return true}const balance=economy.balance(uid).available;if(balance+delta<0)fail(409,'Balance cannot be negative');run('INSERT INTO ledger VALUES(?,?,?,?,?,?)',id(),uid,delta,reason,`admin:${key}`,now());audit(user.id,'credits.adjusted',uid,{delta,reason});return false});return json(res,200,{ok:true,duplicate})}
    if(/^\/api\/admin\/orders\/[^/]+\/settle$/.test(route)&&method==='POST'){if(process.env.ALLOW_MANUAL_SETTLEMENT!=='true')fail(403,'Manual settlement is disabled');const oid=route.split('/')[4],reason=text(body.reason,200);const changed=transaction(()=>{const order=one('SELECT * FROM orders WHERE id=?',oid);if(!order)fail(404,'Order not found');if(order.status==='cancelled')fail(409,'Order cancelled');const changed=grantOrder(order,`manual:${user.id}`);if(changed)audit(user.id,'order.manually-settled',oid,{reason});return changed});return json(res,200,{ok:true,changed})}
  }
  fail(404,'Endpoint not found');
}

const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.mp4':'video/mp4','.webm':'video/webm','.ico':'image/x-icon'};
function mime(file){if(MIME[path.extname(file)])return MIME[path.extname(file)];const fd=fs.openSync(file,'r'),b=Buffer.alloc(16);fs.readSync(fd,b,0,16,0);fs.closeSync(fd);if(b.toString('ascii',0,4)==='RIFF')return 'image/webp';if(b[0]===0xff&&b[1]===0xd8)return 'image/jpeg';if(b[0]===137&&b.toString('ascii',1,4)==='PNG')return 'image/png';if(b.toString('ascii',4,8)==='ftyp')return 'video/mp4';return 'application/octet-stream'}
function serve(req,res,url){if(!['GET','HEAD'].includes(req.method))fail(405,'Method not allowed');let decoded;try{decoded=decodeURIComponent(url.pathname)}catch{fail(400,'Invalid path')}const asset=decoded.startsWith('/assets/'),root=asset?assetRoot:path.join(ROOT,'public');const rel=asset?decoded.slice(8):/^\/admin(?:\/.*)?$/.test(decoded)?'admin.html':decoded.slice(1);let file=path.resolve(root,rel||'index.html');if(!file.startsWith(root+path.sep)&&file!==root)fail(403,'Invalid path');if(!fs.existsSync(file)||!fs.statSync(file).isFile()){if(asset||path.extname(decoded))fail(404,'File not found');file=path.join(ROOT,'public/index.html')}const stat=fs.statSync(file),type=mime(file);res.setHeader('Content-Type',type);res.setHeader('Cache-Control',asset?'public, max-age=31536000, immutable':'no-cache');res.setHeader('Accept-Ranges','bytes');let start=0,end=stat.size-1,status=200;if(req.headers.range){const m=req.headers.range.match(/^bytes=(\d*)-(\d*)$/);if(!m||!m[1]&&!m[2]){res.setHeader('Content-Range',`bytes */${stat.size}`);fail(416,'Invalid byte range')}if(!m[1])start=Math.max(0,stat.size-Number(m[2]));else start=Number(m[1]);if(m[1]&&m[2])end=Math.min(end,Number(m[2]));if(start>end||start>=stat.size){res.setHeader('Content-Range',`bytes */${stat.size}`);fail(416,'Invalid byte range')}status=206;res.setHeader('Content-Range',`bytes ${start}-${end}/${stat.size}`)}res.writeHead(status,{'Content-Length':end-start+1});if(req.method==='HEAD')return res.end();const stream=fs.createReadStream(file,{start,end});stream.on('error',()=>res.destroy());stream.pipe(res)}
const server=http.createServer(async(req,res)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','same-origin');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");if(production)res.setHeader('Strict-Transport-Security','max-age=31536000');try{const url=new URL(req.url,ORIGIN);if(url.pathname.startsWith('/api/'))await api(req,res,url);else serve(req,res,url)}catch(e){if(!res.headersSent){const status=e.status||500;if(status===500)console.error('Request failed:',e.message);json(res,status,{error:status===500?'Internal server error':e.message})}else res.destroy()}});
server.requestTimeout=30000;server.headersTimeout=10000;server.listen(PORT,HOST,()=>console.log(`Companion MVP ready: http://${HOST}:${PORT} | AI configured: ${modelConfig().enabled}`));
const cleanup=setInterval(()=>{run('DELETE FROM sessions WHERE expires<?',Date.now());run('DELETE FROM login_limits WHERE reset<?',Date.now());run('DELETE FROM password_resets WHERE expires<?',Date.now())},3600000);cleanup.unref();
function stop(){server.close(()=>{db.close();process.exit(0)})}process.on('SIGTERM',stop);process.on('SIGINT',stop);
