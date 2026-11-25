export function createMetrics({db,now,fail}) {
 const one=(q,...a)=>db.prepare(q).get(...a),all=(q,...a)=>db.prepare(q).all(...a),run=(q,...a)=>db.prepare(q).run(...a);
 const addDays=(d,n)=>new Date(Date.parse(d+'T00:00:00Z')+n*86400000).toISOString().slice(0,10);
 db.exec(`CREATE TABLE IF NOT EXISTS analytics_meta(id INTEGER PRIMARY KEY CHECK(id=1),started TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS user_activity_days(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,day TEXT NOT NULL,first_seen TEXT NOT NULL,last_seen TEXT NOT NULL,source TEXT NOT NULL,PRIMARY KEY(user_id,day));
 CREATE INDEX IF NOT EXISTS activity_day ON user_activity_days(day,user_id);
 CREATE TABLE IF NOT EXISTS memory_usage(run_id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,model TEXT NOT NULL,input_tokens INTEGER,output_tokens INTEGER,created TEXT NOT NULL);
 CREATE INDEX IF NOT EXISTS memory_usage_date ON memory_usage(created);
 CREATE INDEX IF NOT EXISTS chat_runs_created ON chat_runs(created,user_id);
 CREATE INDEX IF NOT EXISTS ledger_created ON ledger(created,user_id);`);
 if(!one('SELECT id FROM analytics_meta WHERE id=1')){
  db.exec('BEGIN IMMEDIATE');try{
   run('INSERT INTO analytics_meta VALUES(1,?)',now());
   // Evidence-based lower bound only; never invent historical visits.
   db.exec(`INSERT OR IGNORE INTO user_activity_days SELECT id,substr(created,1,10),created,created,'historical' FROM users WHERE role='user';
    INSERT INTO user_activity_days SELECT c.user_id,substr(m.created,1,10),MIN(m.created),MAX(m.created),'historical' FROM messages m JOIN conversations c ON c.id=m.conversation_id JOIN users u ON u.id=c.user_id WHERE u.role='user' AND m.role='user' GROUP BY c.user_id,substr(m.created,1,10)
    ON CONFLICT(user_id,day) DO UPDATE SET first_seen=MIN(first_seen,excluded.first_seen),last_seen=MAX(last_seen,excluded.last_seen);
    INSERT INTO user_activity_days SELECT r.user_id,substr(r.created,1,10),MIN(r.created),MAX(r.created),'historical' FROM chat_runs r JOIN users u ON u.id=r.user_id WHERE u.role='user' GROUP BY r.user_id,substr(r.created,1,10)
    ON CONFLICT(user_id,day) DO UPDATE SET first_seen=MIN(first_seen,excluded.first_seen),last_seen=MAX(last_seen,excluded.last_seen);`);
   db.exec('COMMIT');
  }catch(e){db.exec('ROLLBACK');throw e}
 }
 const started=one('SELECT started FROM analytics_meta WHERE id=1').started,completeFrom=addDays(started.slice(0,10),1);
 function touch(uid){const t=now();run("INSERT INTO user_activity_days SELECT id,?,?,?,'observed' FROM users WHERE id=? AND role='user' ON CONFLICT(user_id,day) DO UPDATE SET last_seen=excluded.last_seen,source='observed'",t.slice(0,10),t,t,uid)}
 function recordMemory(uid,runId,model,usage){const n=v=>Number.isSafeInteger(v)&&v>=0?v:null;run('INSERT OR IGNORE INTO memory_usage VALUES(?,?,?,?,?,?)',runId,uid,model,n(usage?.input_tokens),n(usage?.output_tokens),now())}
 function report(params){
  const today=now().slice(0,10),to=params.get('to')||today;
  if(!/^\d{4}-\d{2}-\d{2}$/.test(to)||!Number.isFinite(Date.parse(to)))fail(400,'Choose a valid date range of at most 93 days');
  const from=params.get('from')||addDays(to,-29);
  const valid=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&d>='2000-01-01'&&d<=today&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
  if(!valid(from)||!valid(to)||from>to||(Date.parse(to)-Date.parse(from))/86400000>92)fail(400,'Choose a valid date range of at most 93 days');
  const start=from+'T00:00:00.000Z',end=addDays(to,1)+'T00:00:00.000Z';
  const days=[];for(let d=from;d<=to;d=addDays(d,1))days.push(d);
  const activityStart=from<addDays(to,-29)?from:addDays(to,-29),activityEnd=addDays(to,30)<today?addDays(to,30):today;
  const activity=all("SELECT a.user_id,a.day FROM user_activity_days a JOIN users u ON u.id=a.user_id WHERE u.role='user' AND a.day>=? AND a.day<=?",activityStart,activityEnd),sets=new Map();
  for(const a of activity){if(!sets.has(a.day))sets.set(a.day,new Set());sets.get(a.day).add(a.user_id)}
  const unique=(a,b)=>new Set(activity.filter(x=>x.day>=a&&x.day<=b).map(x=>x.user_id)).size;
  const cohorts=all("SELECT id,substr(created,1,10) day FROM users WHERE role='user' AND created>=? AND created<?",start,end),cohortMap=new Map();for(const u of cohorts){if(!cohortMap.has(u.day))cohortMap.set(u.day,[]);cohortMap.get(u.day).push(u.id)}
  const retention=Array.from(cohortMap,([day,users])=>({day,registered:users.length,periods:[1,7,30].map(offset=>{const target=addDays(day,offset),status=target>=today?'pending':target<completeFrom?'insufficient_history':'complete';const returned=status==='complete'?users.filter(uid=>sets.get(target)?.has(uid)).length:null;return {offset,target,status,returned,rate:returned===null?null:returned/users.length}})})).sort((a,b)=>a.day.localeCompare(b.day));
  const byDay=new Map(days.map(day=>[day,{day,registered:cohortMap.get(day)?.length||0,active:sets.get(day)?.size||0,activityCoverage:day<completeFrom?'partial_history':day===today?'in_progress':'complete',attempts:0,completed:0,failed:0,pending:0,messages:0,chatInput:0,chatOutput:0,memoryInput:0,memoryOutput:0,consumed:0,inflow:0,refundReversal:0,adminDebit:0,otherDebit:0}]));
  const runs=all("SELECT r.status,r.usage,r.model,r.created FROM chat_runs r JOIN users u ON u.id=r.user_id WHERE u.role='user' AND r.created>=? AND r.created<?",start,end);
  const chat={attempts:runs.length,completed:0,failed:0,pending:0,inputTokens:0,outputTokens:0,usageKnown:0,usageUnknown:0,messages:0},models=new Map();
  const usageNumbers=usage=>{let u;try{u=typeof usage==='string'?JSON.parse(usage):usage}catch{}return {input:Number.isSafeInteger(u?.input_tokens)&&u.input_tokens>=0?u.input_tokens:null,output:Number.isSafeInteger(u?.output_tokens)&&u.output_tokens>=0?u.output_tokens:null}};
  for(const r of runs){const d=byDay.get(r.created.slice(0,10)),n=usageNumbers(r.usage);d.attempts++;if(['completed','failed','pending'].includes(r.status)){chat[r.status]++;d[r.status]++}chat.inputTokens+=n.input||0;chat.outputTokens+=n.output||0;d.chatInput+=n.input||0;d.chatOutput+=n.output||0;if(n.input!==null&&n.output!==null)chat.usageKnown++;else chat.usageUnknown++;
   const key=r.model||'unknown';if(!models.has(key))models.set(key,{model:key,attempts:0,inputTokens:0,outputTokens:0});const m=models.get(key);m.attempts++;m.inputTokens+=n.input||0;m.outputTokens+=n.output||0;
  }
  for(const r of all("SELECT substr(m.created,1,10) day,COUNT(*) n FROM messages m JOIN conversations c ON c.id=m.conversation_id JOIN users u ON u.id=c.user_id WHERE u.role='user' AND m.role='user' AND m.created>=? AND m.created<? GROUP BY substr(m.created,1,10)",start,end)){byDay.get(r.day).messages=r.n;chat.messages+=r.n}
  const memory={recordedCalls:0,inputTokens:0,outputTokens:0,usageUnknown:0,trackingStarted:started};
  for(const r of all("SELECT m.* FROM memory_usage m JOIN users u ON u.id=m.user_id WHERE u.role='user' AND m.created>=? AND m.created<?",start,end)){memory.recordedCalls++;memory.inputTokens+=r.input_tokens||0;memory.outputTokens+=r.output_tokens||0;if(r.input_tokens===null||r.output_tokens===null)memory.usageUnknown++;const d=byDay.get(r.created.slice(0,10));d.memoryInput+=r.input_tokens||0;d.memoryOutput+=r.output_tokens||0}
  const tokens={inflow:0,consumed:0,refundReversal:0,adminDebit:0,otherDebit:0,net:0,currentHeld:0},actions=new Map();
  for(const r of all("SELECT l.delta,l.external_key,l.created,h.action FROM ledger l JOIN users u ON u.id=l.user_id LEFT JOIN token_holds h ON l.external_key='hold:'||h.id WHERE u.role='user' AND l.created>=? AND l.created<?",start,end)){const d=byDay.get(r.created.slice(0,10));tokens.net+=r.delta;let category;if(r.delta>0)category='inflow';else if(r.external_key.startsWith('hold:'))category='consumed';else if(r.external_key.startsWith('refund:'))category='refundReversal';else if(r.external_key.startsWith('admin:'))category='adminDebit';else category='otherDebit';tokens[category]+=Math.abs(r.delta);d[category]+=Math.abs(r.delta);if(category==='consumed'){const action=r.action||'unknown';actions.set(action,(actions.get(action)||0)+Math.abs(r.delta))}}
  tokens.currentHeld=one("SELECT COALESCE(SUM(h.amount),0) n FROM token_holds h JOIN users u ON u.id=h.user_id WHERE u.role='user' AND h.status='held' AND h.expires>?",now()).n;
  return {range:{from,to,timezone:'UTC',today},coverage:{trackingStarted:started,completeActivityFrom:completeFrom,retainedAccountsOnly:true,adminsExcluded:true,activityIsLowerBound:from<completeFrom,rollingActivityIsLowerBound:addDays(to,-29)<completeFrom},summary:{registered:cohorts.length,totalUsers:one("SELECT COUNT(*) n FROM users WHERE role='user'").n,active:unique(from,to),dau:unique(to,to),wau:unique(addDays(to,-6),to),mau:unique(addDays(to,-29),to)},chat,memory,tokens,consumptionByAction:Array.from(actions,([action,tokens])=>({action,tokens})),models:[...models.values()],daily:[...byDay.values()],retention};
 }
 return {touch,recordMemory,report};
}
