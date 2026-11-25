import {test} from 'node:test';
import assert from 'node:assert/strict';
import {BETA_PERSONAS} from '../beta-personas.mjs';
import {OUTPUT_RULES,OUTPUT_SAFE_SAMPLES,OUTPUT_BLOCK_SAMPLES} from '../output-safety-baseline.mjs';
import {parseAdvancedRule,evaluateSafety} from '../safety-matcher.mjs';
const fail=(_,message)=>{throw Error(message)};
const rules=OUTPUT_RULES.map((r,i)=>({...r,id:String(i),normalized:JSON.stringify(parseAdvancedRule(r.kind,r.value,fail))}));
test('output starter rules block affirmative markers and preserve help/refusal samples',()=>{
 for(const sample of OUTPUT_BLOCK_SAMPLES)assert.ok(evaluateSafety(rules,{keywords:true,blacklist:true},{},sample).rules.length,sample);
 for(const sample of OUTPUT_SAFE_SAMPLES)assert.equal(evaluateSafety(rules,{keywords:true,blacklist:true},{},sample).rules.length,0,sample);
});
test('thirty distinct fictional personas have five bounded relationship hints and safe greetings',()=>{
 assert.equal(BETA_PERSONAS.length,30);assert.equal(new Set(BETA_PERSONAS.map(p=>p.id)).size,30);assert.equal(new Set(BETA_PERSONAS.map(p=>p.greeting)).size,30);
 for(const p of BETA_PERSONAS){
  for(let i=1;i<=5;i++)assert.ok(p.persona_fields['level'+i].length>0&&p.persona_fields['level'+i].length<=300);
  assert.match(p.persona_fields.background,/成年虚构/);assert.equal(p.review.humanApproved,false);
  for(const key of ['background','personality','speech','boundaries'])assert.ok(p.persona_fields[key].length<=600);
  assert.equal(evaluateSafety(rules,{keywords:true,blacklist:true},{},p.greeting).rules.length,0);
 }
});
