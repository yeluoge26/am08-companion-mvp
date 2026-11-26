import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createModelBudget,budgetDefaults} from '../model-budget.mjs';
test('model budgets reserve atomically, retain unknown charges, and survive restart',()=>{
 const db=new DatabaseSync(':memory:');let clock='2026-11-26T00:00:00Z',budget={...budgetDefaults,maxConcurrent:1,platformDailyUsd:1,userDailyUsd:.1};
 const deps={db,config:()=>({budget}),now:()=>clock,fail:(status,message)=>{throw Object.assign(Error(message),{status})},audit(){},transaction(fn){db.exec('BEGIN');try{const r=fn();db.exec('COMMIT');return r}catch(e){db.exec('ROLLBACK');throw e}}};
 let guard=createModelBudget(deps);let a=guard.reserve('u','chat',budget.priceModel,10000,1000);
 assert.throws(()=>guard.reserve('b','chat',budget.priceModel,1000,10),e=>e.status===429);
 a.finish({input_tokens:100,output_tokens:20});a.finish(null);assert.equal(guard.totals('u').micros,180);
 const b=guard.reserve('u','memory',budget.priceModel,10000,1000);b.finish(null);assert.equal(guard.totals('u').estimatedCalls,1);assert.equal(guard.totals('u').micros,14180);
 assert.throws(()=>guard.reserve('u','chat',budget.priceModel,100000,100),e=>e.status===429);
 assert.throws(()=>guard.reserve('u','chat','gpt-unpriced',100,100),e=>e.status===503);
 guard.reserve('u','chat',budget.priceModel,1000,100);guard=createModelBudget(deps);assert.equal(guard.totals('u').active,0);assert.equal(guard.totals('u').estimatedCalls,2);
 clock='2026-11-27T00:00:00Z';assert.equal(guard.totals('u').micros,0);db.close();
});
