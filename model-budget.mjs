import {randomUUID} from 'node:crypto';
export const budgetDefaults={enabled:true,platformDailyUsd:100,userDailyUsd:5,maxConcurrent:8,priceModel:'gpt-4.1-mini',inputUsdPerMillion:1,outputUsdPerMillion:4};
export function validateBudget(b,fail){
 if(typeof b.enabled!=='boolean'||typeof b.priceModel!=='string'||!/^gpt-[\w.-]{1,60}$/.test(b.priceModel))fail(400,'Invalid budget configuration');
 for(const [k,min,max] of [['platformDailyUsd',0,100000],['userDailyUsd',0,10000],['maxConcurrent',1,100],['inputUsdPerMillion',0.01,1000],['outputUsdPerMillion',0.01,1000]])if(!Number.isFinite(b[k])||b[k]<min||b[k]>max)fail(400,'Invalid budget configuration');
 if(!Number.isInteger(b.maxConcurrent))fail(400,'Invalid concurrency');
 return Object.fromEntries(Object.keys(budgetDefaults).map(k=>[k,b[k]]));
}
export function createModelBudget({db,config,transaction,now,fail,audit}){
 const one=(q,...a)=>db.prepare(q).get(...a),run=(q,...a)=>db.prepare(q).run(...a);
 db.exec(`CREATE TABLE IF NOT EXISTS model_spend(id TEXT PRIMARY KEY,user_id TEXT,kind TEXT,model TEXT,day TEXT,state TEXT,micros INTEGER,input_tokens INTEGER,output_tokens INTEGER,created TEXT);
 CREATE INDEX IF NOT EXISTS model_spend_day ON model_spend(day,user_id);
 UPDATE model_spend SET state='estimated' WHERE state='reserved';`);
 let failures=0,pausedUntil=0;
 function totals(uid){const day=now().slice(0,10);return {day,...one("SELECT COALESCE(SUM(micros),0) micros,COUNT(*) calls,SUM(CASE WHEN state='estimated' THEN 1 ELSE 0 END) estimatedCalls FROM model_spend WHERE day=?",day),userMicros:uid?one('SELECT COALESCE(SUM(micros),0) n FROM model_spend WHERE day=? AND user_id=?',day,uid).n:undefined,active:one("SELECT COUNT(*) n FROM model_spend WHERE state='reserved'").n,pausedUntil:pausedUntil>Date.now()?new Date(pausedUntil).toISOString():null}}
 function reserve(uid,kind,model,inputBound,outputBound){
  const c={...budgetDefaults,...config().budget};
  if(!c.enabled)return {finish(){}};
  const estimate=Math.ceil(inputBound*c.inputUsdPerMillion+outputBound*c.outputUsdPerMillion);
  const key=randomUUID();
  transaction(()=>{
   const t=totals(uid);
   if(model!==c.priceModel)fail(503,'AI model cost configuration is required.');
   if(pausedUntil>Date.now())fail(503,'AI service is cooling down. Please retry later.');
   if(t.active>=c.maxConcurrent)fail(429,'AI service is busy. Please retry shortly.');
   if(t.micros+estimate>c.platformDailyUsd*1e6||t.userMicros+estimate>c.userDailyUsd*1e6)fail(429,'AI daily usage budget reached. Please return tomorrow.');
   run('INSERT INTO model_spend VALUES(?,?,?,?,?,?,?,NULL,NULL,?)',key,uid,kind,model,t.day,'reserved',estimate,now());
  });
  let finished=false;
  return {finish(usage,failed=false){if(finished)return;finished=true;
   const known=Number.isSafeInteger(usage?.input_tokens)&&usage.input_tokens>=0&&Number.isSafeInteger(usage?.output_tokens)&&usage.output_tokens>=0;
   const amount=known?Math.ceil(usage.input_tokens*c.inputUsdPerMillion+usage.output_tokens*c.outputUsdPerMillion):estimate;
   run('UPDATE model_spend SET state=?,micros=?,input_tokens=?,output_tokens=? WHERE id=?',known?'measured':'estimated',amount,known?usage.input_tokens:null,known?usage.output_tokens:null,key);
   if(failed){failures++;if(failures>=5){pausedUntil=Date.now()+60000;audit(null,'model.circuit-open',null,{seconds:60});failures=0}}else failures=0;
   const t=totals(uid);if(t.micros>=c.platformDailyUsd*1e6*.8)audit(null,'model.budget-warning',null,{day:t.day,micros:t.micros,limitUsd:c.platformDailyUsd});
  }};
 }
 return {reserve,totals};
}
