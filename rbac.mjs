export const STAFF_ROLES={
 superadmin:['*'],
 operations:['metrics.read','users.read','users.write','users.sessions','characters.read','characters.write','plans.read','pricing.read','growth.read','growth.write','config.read','config.write'],
 reviewer:['reports.read','reports.write'],
 finance:['metrics.read','users.read','plans.read','plans.write','pricing.read','pricing.write','orders.read','orders.note','orders.cancel','orders.finance','credits.write'],
 support:['users.read','users.sessions','orders.read','orders.note','orders.cancel']
};
const ROUTES=[
 ['GET',/^\/api\/admin\/metrics$/,'metrics.read'],['GET',/^\/api\/admin\/summary$/,'summary.read'],
 ['GET',/^\/api\/admin\/users(?:\/[^/]+)?$/,'users.read'],['PATCH',/^\/api\/admin\/users\/[^/]+$/,'users.write'],['POST',/^\/api\/admin\/users\/[^/]+\/sessions$/,'users.sessions'],
 ['GET',/^\/api\/admin\/characters$/,'characters.read'],['POST',/^\/api\/admin\/characters$/,'characters.write'],['PUT',/^\/api\/admin\/characters\/[^/]+$/,'characters.write'],
 ['GET',/^\/api\/admin\/plans$/,'plans.read'],['POST',/^\/api\/admin\/plans$/,'plans.write'],['PUT',/^\/api\/admin\/plans\/[^/]+$/,'plans.write'],
 ['GET',/^\/api\/admin\/orders(?:\/[^/]+)?$/,'orders.read'],['PATCH',/^\/api\/admin\/orders\/[^/]+$/,'orders.note'],['POST',/^\/api\/admin\/orders\/[^/]+\/cancel$/,'orders.cancel'],['POST',/^\/api\/admin\/orders\/[^/]+\/(?:refund|dispute|settle)$/,'orders.finance'],
 ['POST',/^\/api\/admin\/credits$/,'credits.write'],['GET',/^\/api\/admin\/pricing-rules$/,'pricing.read'],['PUT',/^\/api\/admin\/pricing-rules$/,'pricing.write'],
 ['GET',/^\/api\/admin\/relationship-rules$/,'growth.read'],['PUT',/^\/api\/admin\/relationship-rules$/,'growth.write'],
 ['GET',/^\/api\/admin\/reports(?:\/[^/]+)?$/,'reports.read'],['POST',/^\/api\/admin\/reports\/[^/]+\/resolve$/,'reports.write'],
 ['GET',/^\/api\/admin\/config$/,'config.read'],['PUT',/^\/api\/admin\/config$/,'config.write'],
 ['GET',/^\/api\/admin\/audit$/,'audit.read'],['GET',/^\/api\/admin\/access-audit$/,'audit.read'],
 ['GET',/^\/api\/admin\/staff$/,'staff.read'],['POST',/^\/api\/admin\/staff$/,'staff.write'],['PATCH',/^\/api\/admin\/staff\/[^/]+$/,'staff.write'],['POST',/^\/api\/admin\/staff\/[^/]+\/(?:password|sessions)$/,'staff.write'],
 ['POST',/^\/api\/admin\/self\/password$/,'self.password']
];
export function createRBAC({db,transaction,now,id,fail,audit,text,email,password,passwordHash,passwordValid,json}){
 const one=(q,...a)=>db.prepare(q).get(...a),all=(q,...a)=>db.prepare(q).all(...a),run=(q,...a)=>db.prepare(q).run(...a);
 db.exec(`CREATE TABLE IF NOT EXISTS staff_roles(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,role TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'active',version INTEGER NOT NULL DEFAULT 1,updated TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS staff_access_audit(id TEXT PRIMARY KEY,actor TEXT,staff_role TEXT,method TEXT NOT NULL,path TEXT NOT NULL,permission TEXT,status INTEGER NOT NULL,created TEXT NOT NULL);`);
 run("INSERT OR IGNORE INTO staff_roles SELECT id,'superadmin','active',1,? FROM users WHERE role='admin'",now());
 function identity(uid){const s=one("SELECT s.* FROM staff_roles s JOIN users u ON u.id=s.user_id WHERE s.user_id=? AND u.role='admin'",uid);return s?{role:s.role,status:s.status,version:s.version,permissions:[...(STAFF_ROLES[s.role]||[]),'self.password']}:null}
 const required=(method,path)=>ROUTES.find(([m,re])=>m===method&&re.test(path))?.[2]||null;
 function allowed(uid,permission){const s=identity(uid);return !!(s?.status==='active'&&permission&&(s.permissions.includes('*')||s.permissions.includes(permission)))}
 function authorize(uid,method,path){const permission=required(method,path);if(!allowed(uid,permission))fail(403,'Staff permission required');return identity(uid)}
 function logAccess(actor,role,method,path,status){run('INSERT INTO staff_access_audit VALUES(?,?,?,?,?,?,?,?)',id(),actor||null,role||null,method,path.slice(0,300),required(method,path),status,now())}
 const row=uid=>one('SELECT u.id,u.name,u.email,u.created,s.role,s.status,s.version,s.updated FROM users u JOIN staff_roles s ON s.user_id=u.id WHERE u.id=?',uid);
 const reason=b=>text(b.reason,500);
 function fields(b){const name=text(b.name,60);if(!Object.hasOwn(STAFF_ROLES,b.role)||!['active','disabled'].includes(b.status))fail(400,'Invalid staff role or status');return name}
 async function handle(req,res,url,actor,b){const route=url.pathname,method=req.method;
  if(route==='/api/admin/access-audit'&&method==='GET'){const q=(url.searchParams.get('q')||'').slice(0,100);return json(res,200,{events:all('SELECT * FROM staff_access_audit WHERE actor LIKE ? OR path LIKE ? ORDER BY rowid DESC LIMIT 200','%'+q+'%','%'+q+'%')}),true}
  if(route==='/api/admin/staff'&&method==='GET'){const q=(url.searchParams.get('q')||'').slice(0,200);return json(res,200,{staff:all('SELECT u.id,u.name,u.email,u.created,s.role,s.status,s.version,s.updated FROM users u JOIN staff_roles s ON s.user_id=u.id WHERE u.email LIKE ? OR u.name LIKE ? ORDER BY u.created DESC LIMIT 100','%'+q+'%','%'+q+'%'),roles:STAFF_ROLES}),true}
  if(route==='/api/admin/staff'&&method==='POST'){
   const name=fields(b),addr=email(b.email),why=reason(b),digest=await passwordHash(password(b.password)),uid=id();
   transaction(()=>{authorize(actor.id,method,route);if(one('SELECT id FROM users WHERE email=?',addr))fail(409,'This email is already registered');run("INSERT INTO users VALUES(?,?,?,?,?,?)",uid,addr,name,digest,'admin',now());run('INSERT INTO staff_roles VALUES(?,?,?,1,?)',uid,b.role,b.status,now());audit(actor.id,'staff.created',uid,{role:b.role,status:b.status,reason:why})});return json(res,201,{staff:row(uid)}),true;
  }
  const m=route.match(/^\/api\/admin\/staff\/([^/]+)(?:\/(password|sessions))?$/);
  if(m){const uid=m[1];if(!row(uid))fail(404,'Staff account not found');const why=reason(b);
   if(method==='PATCH'&&!m[2]){const name=fields(b);transaction(()=>{authorize(actor.id,method,route);const old=row(uid);if(old.version!==b.version)fail(409,'Record changed. Reload and try again.');if(uid===actor.id&&(b.role!==old.role||b.status!=='active'))fail(409,'You cannot change your own role or disable yourself');if(old.role==='superadmin'&&old.status==='active'&&(b.role!=='superadmin'||b.status!=='active')&&one("SELECT COUNT(*) n FROM staff_roles s JOIN users u ON u.id=s.user_id WHERE s.role='superadmin' AND s.status='active' AND u.role='admin'").n<=1)fail(409,'At least one active super administrator is required');run('UPDATE users SET name=? WHERE id=?',name,uid);run('UPDATE staff_roles SET role=?,status=?,version=version+1,updated=? WHERE user_id=?',b.role,b.status,now(),uid);if(old.role!==b.role||old.status!==b.status)run('DELETE FROM sessions WHERE user_id=?',uid);audit(actor.id,'staff.updated',uid,{before:{role:old.role,status:old.status},after:{role:b.role,status:b.status},reason:why})});return json(res,200,{staff:row(uid)}),true}
   if(method==='POST'&&m[2]==='sessions'){transaction(()=>{authorize(actor.id,method,route);run('DELETE FROM sessions WHERE user_id=?',uid);audit(actor.id,'staff.sessions-revoked',uid,{reason:why})});return json(res,200,{ok:true}),true}
   if(method==='POST'&&m[2]==='password'){const digest=await passwordHash(password(b.password));transaction(()=>{authorize(actor.id,method,route);run('UPDATE users SET password=? WHERE id=?',digest,uid);run('UPDATE staff_roles SET version=version+1,updated=? WHERE user_id=?',now(),uid);run('DELETE FROM sessions WHERE user_id=?',uid);run('UPDATE password_resets SET used=1 WHERE user_id=?',uid);audit(actor.id,'staff.password-reset',uid,{reason:why})});return json(res,200,{ok:true}),true}
  }
  if(route==='/api/admin/self/password'&&method==='POST'){
   const u=one('SELECT password FROM users WHERE id=?',actor.id);if(!await passwordValid(text(b.currentPassword,128),u.password))fail(403,'Current password is incorrect');const digest=await passwordHash(password(b.password));transaction(()=>{authorize(actor.id,method,route);if(one('SELECT password FROM users WHERE id=?',actor.id)?.password!==u.password)fail(409,'Password changed. Sign in again.');run('UPDATE users SET password=? WHERE id=?',digest,actor.id);run('DELETE FROM sessions WHERE user_id=?',actor.id);run('UPDATE password_resets SET used=1 WHERE user_id=?',actor.id);audit(actor.id,'staff.password-changed',actor.id)});return json(res,200,{ok:true}),true;
  }
  return false;
 }
 return {identity,allowed,authorize,logAccess,handle};
}
