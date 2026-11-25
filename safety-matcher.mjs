// Literal AND-of-OR matching, scoped whole-clause exceptions; no executable regex.
export function normalizeSafety(s){return s.normalize('NFKC').replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g,'').toLowerCase().replace(/\s+/gu,' ').trim()}
export function safetyClauses(s){return s.normalize('NFKC').replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g,'').split(/[\r\n。！？!?；;]+|\.(?:\s+|$)|\b(?:but|however|yet)\b|但是|不过|然而/iu).map(normalizeSafety).filter(Boolean)}
export function literalMatch(term,input,mode){if(mode==='exact')return input===term;if(mode==='contains')return input.includes(term);let offset=0;while(offset<=input.length){const at=input.indexOf(term,offset);if(at<0)return false;const before=Array.from(input.slice(Math.max(0,at-2),at)).at(-1)||'',after=Array.from(input.slice(at+term.length,at+term.length+2))[0]||'';if(!/[\p{L}\p{N}_]/u.test(before)&&!/[\p{L}\p{N}_]/u.test(after))return true;offset=at+1}return false}
export function parseAdvancedRule(kind,value,fail){let data;try{data=JSON.parse(value)}catch{fail(400,'Advanced rule must be valid JSON')}
 if(!data||typeof data!=='object'||Array.isArray(data))fail(400,'Invalid advanced rule');
 const key=kind==='combination'?data.key:data.target;
 if(typeof key!=='string'||! /^[a-z0-9][a-z0-9-]{0,63}$/.test(key))fail(400,'Rule key must use lowercase letters, digits and hyphens');
 const strings=(list,max)=>{if(!Array.isArray(list)||!list.length||list.length>max||list.some(x=>typeof x!=='string'||!normalizeSafety(x)||x.length>200||normalizeSafety(x).length>200))fail(400,'Invalid rule phrases');const result=[...new Set(list.map(normalizeSafety))].sort();return result};
 if(kind==='combination'){
  if(!['contains','word'].includes(data.match)||!Number.isInteger(data.window)||data.window<20||data.window>400)fail(400,'Invalid combination match or window');
  if(!Array.isArray(data.groups)||data.groups.length<2||data.groups.length>5)fail(400,'Use 2 to 5 condition groups');
  const groups=data.groups.map(g=>strings(g,12));if(groups.some((g,i)=>groups.some((h,j)=>i!==j&&g.some(t=>h.includes(t)))))fail(400,'Condition groups must not share the same term');
  return {key,groups:groups.sort((a,b)=>JSON.stringify(a)<JSON.stringify(b)?-1:JSON.stringify(a)>JSON.stringify(b)?1:0),match:data.match,window:data.window};
 }
 const phrases=strings(data.phrases,30);if(phrases.some(x=>safetyClauses(x).length!==1||safetyClauses(x)[0]!==x))fail(400,'Exceptions must contain one complete clause without separators');
 return {target:key,phrases};
}
export function combinationMatches(def,clause){
 const events=[];
 for(let group=0;group<def.groups.length;group++)for(const term of def.groups[group]){let at=clause.indexOf(term);while(at>=0){const before=Array.from(clause.slice(Math.max(0,at-2),at)).at(-1)||'',after=Array.from(clause.slice(at+term.length,at+term.length+2))[0]||'';if(def.match==='contains'||(!/[\p{L}\p{N}_]/u.test(before)&&!/[\p{L}\p{N}_]/u.test(after)))events.push({group,start:at,end:at+term.length});at=clause.indexOf(term,at+1)}}
 events.sort((a,b)=>a.end-b.end);const latest=Array(def.groups.length).fill(-1);
 for(const e of events){latest[e.group]=Math.max(latest[e.group],e.start);const start=Math.min(...latest);if(start>=0&&e.end-start<=def.window)return true}return false;
}
export function evaluateSafety(rules,config,user,content){const input=normalizeSafety(content),clauses=safetyClauses(content),blocked=[],exempted=[];
 const exceptions=rules.filter(r=>r.kind==='exception').map(r=>({rule:r,def:JSON.parse(r.normalized)}));
 for(const r of rules){
  if(r.kind==='keyword'){if(config.keywords&&literalMatch(r.normalized,input,r.mode))blocked.push(r)}
  else if(r.kind==='user'||r.kind==='email'){if(config.blacklist&&(r.kind==='user'?r.value===user.id:r.normalized===(user.email||'').toLowerCase()))blocked.push(r)}
  else if(r.kind==='combination'&&config.keywords){const def=JSON.parse(r.normalized);let denied=false;
   for(const clause of clauses){if(!combinationMatches(def,clause))continue;const exception=exceptions.find(x=>x.def.target===def.key&&x.def.phrases.includes(clause));if(exception)exempted.push({rule:r,exception:exception.rule,key:def.key});else denied=true}
   if(denied)blocked.push(r);
  }
 }
 return {rules:blocked,exempted:exempted.filter((x,i,a)=>a.findIndex(y=>y.rule.id===x.rule.id&&y.exception.id===x.exception.id)===i)};
}
