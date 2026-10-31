import test from 'node:test';
import assert from 'node:assert/strict';
import {paydayAssignments} from '../src/payday-matching.mjs';
import {summarize} from '../src/finance.mjs';

const income=(id,date,amount,extra={})=>({id,date,type:'income',category:'Pay',amount_cents:amount,scheduled_for:null,...extra});
test('split monthly income recorded after payday is shown as recorded without changing financial data',()=>{
 const rows=[income('one','2026-10-31',80000),income('two','2026-10-31',170000)];
 const before=structuredClone(rows);
 const m=paydayAssignments('2026-10',{frequency:'monthly',monthly_day:19},rows);
 assert.equal(m.byDate['2026-10-19'].length,2);
 assert.equal(m.byDate['2026-10-19'].reduce((sum,r)=>sum+r.amount_cents,0),250000);
 assert.equal(m.unassigned.length,0);
 assert.equal(summarize(rows,'2026-10').income,250000);
 assert.deepEqual(rows,before);
});
test('weekly pay auto-matches exact dates and keeps ambiguous late payments unassigned',()=>{
 const rows=[income('exact','2026-10-02',50000),income('late','2026-10-10',20000),income('gift','2026-10-09',10000,{category:'Gift'}),income('deleted','2026-10-16',50000,{deleted_at:'yes'})];
 const m=paydayAssignments('2026-10',{frequency:'weekly',anchor_date:'2026-10-02'},rows);
 assert.deepEqual(m.byDate['2026-10-02'].map(r=>r.id),['exact']);
 assert.equal(m.byDate['2026-10-09'].length,0);
 assert.deepEqual(m.unassigned.map(r=>r.id),['late']);
});
test('explicit links support early/late and cross-month receipts without double assignment',()=>{
 const row=income('late','2026-11-01',50000,{scheduled_for:'2026-10-30'});
 assert.equal(paydayAssignments('2026-10',{frequency:'biweekly',anchor_date:'2026-10-02'},[row]).byDate['2026-10-30'].length,1);
 const november=paydayAssignments('2026-11',{frequency:'monthly',monthly_day:1},[row]);
 assert.equal(november.byDate['2026-11-01'].length,0);
 assert.equal(november.unassigned.length,0);
 assert.equal(summarize([row],'2026-11').income,50000);
});
test('changing a monthly schedule date preserves recorded status; unrelated income remains separate',()=>{
 const rows=[income('old-link','2026-10-03',50000,{scheduled_for:'2026-10-01'}),income('refund','2026-10-19',10000,{category:'Refund'})];
 const m=paydayAssignments('2026-10',{frequency:'monthly',monthly_day:19},rows);
 assert.deepEqual(m.byDate['2026-10-19'].map(r=>r.id),['old-link']);
 assert.equal(paydayAssignments('2026-10',null,rows).dates.length,0);
});
