import {modelConfig} from './openai.mjs';

export function createOperations({db,transaction,audit,fail,now}) {
 const one=(q,...a)=>db.prepare(q).get(...a),run=(q,...a)=>db.prepare(q).run(...a);
 db.exec(`CREATE TABLE IF NOT EXISTS operation_config(id INTEGER PRIMARY KEY CHECK(id=1),value TEXT NOT NULL,version INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS user_memory(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,summary TEXT NOT NULL DEFAULT '',enabled INTEGER NOT NULL DEFAULT 1,revision INTEGER NOT NULL DEFAULT 0,updated TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS relationship_memories(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,summary TEXT NOT NULL DEFAULT '',enabled INTEGER NOT NULL DEFAULT 1,revision INTEGER NOT NULL DEFAULT 0,updated TEXT NOT NULL,PRIMARY KEY(user_id,character_id));
 CREATE TABLE IF NOT EXISTS chat_runs(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,conversation_id TEXT NOT NULL,request_key TEXT NOT NULL,content TEXT NOT NULL,message_id TEXT,assistant_id TEXT,status TEXT NOT NULL,trial INTEGER NOT NULL DEFAULT 0,error TEXT,model TEXT,usage TEXT,created TEXT NOT NULL,completed TEXT,UNIQUE(user_id,request_key));
 CREATE INDEX IF NOT EXISTS chat_runs_user ON chat_runs(user_id,status);
 UPDATE chat_runs SET status='failed',error='AI service interrupted. Please retry.' WHERE status='pending';`);
 const defaultFeatures={shorts:false,collection:false,premium:true,wallet:true,createCharacter:true,voice:false,image:false};
 const defaults={betaMode:false,features:defaultFeatures,preferReviewed:true,outputFallback:'这部分内容不适合继续，我们换个安全的话题吧。',chatEnabled:true,streamEnabled:true,memoryEnabled:true,quotaEnabled:true,freeMessageLimit:5,model:modelConfig().model,maxOutputTokens:500,contextMessages:20,systemPrompt:'Be warm, attentive and concise. Offer ordinary companionship and respect user boundaries.'};
 run('INSERT OR IGNORE INTO operation_config VALUES(1,?,1)',JSON.stringify(defaults));
 function config(){const row=one('SELECT * FROM operation_config WHERE id=1');return {...defaults,...JSON.parse(row.value),version:row.version}}
 function saveConfig(body,actor){
  const old=config(),next={betaMode:body.betaMode??old.betaMode,preferReviewed:body.preferReviewed??old.preferReviewed,features:{...defaultFeatures,...old.features,...body.features},outputFallback:body.outputFallback??old.outputFallback};
  if(typeof next.betaMode!=='boolean'||typeof next.preferReviewed!=='boolean'||typeof next.outputFallback!=='string'||!next.outputFallback.trim()||next.outputFallback.length>500||Object.keys(next.features).some(k=>!Object.hasOwn(defaultFeatures,k)||typeof next.features[k]!=='boolean'))fail(400,'Invalid feature configuration');
  for(const key of ['chatEnabled','streamEnabled','memoryEnabled','quotaEnabled']){if(typeof body[key]!=='boolean')fail(400,'Invalid configuration');next[key]=body[key]}
  for(const [key,min,max] of [['freeMessageLimit',0,1000],['maxOutputTokens',64,4096],['contextMessages',2,60]]){if(!Number.isInteger(body[key])||body[key]<min||body[key]>max)fail(400,'Invalid configuration');next[key]=body[key]}
  if(typeof body.model!=='string'||!/^gpt-[a-zA-Z0-9.-]{1,60}$/.test(body.model))fail(400,'Invalid model name');next.model=body.model;
  if(typeof body.systemPrompt!=='string'||body.systemPrompt.length>3000)fail(400,'Invalid configuration');next.systemPrompt=body.systemPrompt.trim();
  transaction(()=>{const current=config();if(body.version!==current.version)fail(409,'Configuration changed. Reload and try again.');run('UPDATE operation_config SET value=?,version=version+1 WHERE id=1',JSON.stringify(next));audit(actor,'configuration.updated','chat',{before:current,after:next})});
  return config();
 }
 function memory(uid){run('INSERT OR IGNORE INTO user_memory(user_id,updated) VALUES(?,?)',uid,now());const row=one('SELECT * FROM user_memory WHERE user_id=?',uid);return {...row,enabled:!!row.enabled}}
 function saveMemory(uid,body){
  if(typeof body.summary!=='string'||body.summary.length>2000||typeof body.enabled!=='boolean')fail(400,'Invalid memory');
  const current=memory(uid);if(body.revision!==current.revision)fail(409,'Memory changed. Reload and try again.');
  run('UPDATE user_memory SET summary=?,enabled=?,revision=revision+1,updated=? WHERE user_id=?',body.summary.trim(),Number(body.enabled),now(),uid);
  audit(uid,'memory.updated',uid,{enabled:body.enabled});return memory(uid);
 }
 function characterMemory(uid,cid){run('INSERT OR IGNORE INTO relationship_memories(user_id,character_id,updated) VALUES(?,?,?)',uid,cid,now());const row=one('SELECT * FROM relationship_memories WHERE user_id=? AND character_id=?',uid,cid);return {...row,enabled:!!row.enabled}}
 function saveCharacterMemory(uid,cid,body){
  if(typeof body.summary!=='string'||body.summary.length>2000||typeof body.enabled!=='boolean')fail(400,'Invalid memory');
  return transaction(()=>{const current=characterMemory(uid,cid);if(body.revision!==current.revision)fail(409,'Memory changed. Reload and try again.');run('UPDATE relationship_memories SET summary=?,enabled=?,revision=revision+1,updated=? WHERE user_id=? AND character_id=?',body.summary.trim(),Number(body.enabled),now(),uid,cid);audit(uid,'character-memory.updated',cid,{enabled:body.enabled});return characterMemory(uid,cid)});
 }
 function rememberCharacter(uid,cid,summary,revision,accountRevision,configVersion){
  const c=config(),account=memory(uid);if(!c.memoryEnabled||c.version!==configVersion||!account.enabled||account.revision!==accountRevision)return false;
  return run('UPDATE relationship_memories SET summary=?,revision=revision+1,updated=? WHERE user_id=? AND character_id=? AND revision=? AND enabled=1',summary.slice(0,2000),now(),uid,cid,revision).changes===1;
 }
 function memoryState(uid,cid){return {memory:characterMemory(uid,cid),globalEnabled:config().memoryEnabled,accountEnabled:memory(uid).enabled}}
 function access(uid){
  const c=config(),sub=one('SELECT * FROM subscriptions WHERE user_id=?',uid);
  const subscribed=!!(sub&&['active','non-renewing'].includes(sub.status)&&Date.parse(sub.expires)>Date.now());
  const used=one("SELECT COUNT(*) n FROM chat_runs WHERE user_id=? AND trial=1 AND status='completed'",uid).n;
  const reserved=one("SELECT COUNT(*) n FROM chat_runs WHERE user_id=? AND trial=1 AND status='pending'",uid).n;
  return {subscribed,expires:subscribed?sub.expires:null,limit:c.freeMessageLimit,used,remaining:Math.max(0,c.freeMessageLimit-used-reserved),unlimited:subscribed||!c.quotaEnabled,allowed:subscribed||!c.quotaEnabled||used+reserved<c.freeMessageLimit,chatEnabled:c.chatEnabled&&modelConfig().enabled,streamEnabled:c.streamEnabled,memoryEnabled:c.memoryEnabled};
 }
 function stats(){return {completed:one("SELECT COUNT(*) n FROM chat_runs WHERE status='completed'").n,failed:one("SELECT COUNT(*) n FROM chat_runs WHERE status='failed'").n,pending:one("SELECT COUNT(*) n FROM chat_runs WHERE status='pending'").n,memoryUsers:one("SELECT COUNT(DISTINCT user_id) n FROM relationship_memories WHERE summary<>'' AND enabled=1").n,inputTokens:one("SELECT COALESCE(SUM(json_extract(usage,'$.input_tokens')),0) n FROM chat_runs").n,outputTokens:one("SELECT COALESCE(SUM(json_extract(usage,'$.output_tokens')),0) n FROM chat_runs").n}}
 function features(){const c=config();return {betaMode:c.betaMode,features:{...defaultFeatures,...c.features,...(c.betaMode?{premium:false,wallet:false}:{})}}}
 return {features,config,saveConfig,memory,saveMemory,characterMemory,saveCharacterMemory,rememberCharacter,memoryState,access,stats};
}
