import test from 'node:test';
import assert from 'node:assert/strict';
import {payDates,payWeekday,withPayWeekday,WEEKDAYS} from '../src/finance.mjs';

test('every weekly weekday produces the matching dates in the selected month',()=>{
 for(const month of ['2026-09','2026-10','2026-12','2028-02'])for(let day=0;day<7;day++){
  const config=withPayWeekday(month,{frequency:'weekly',anchor_date:'2025-01-01'},day);
  const dates=payDates(month,config);
  assert.ok(dates.length>=4&&dates.length<=5);
  assert.equal(payWeekday(config),day);
  assert.ok(dates.every(d=>d.startsWith(month)&&new Date(`${d}T12:00:00Z`).getUTCDay()===day));
 }
 const fridays=withPayWeekday('2026-09',{frequency:'weekly',anchor_date:'2026-09-01'},5);
 assert.deepEqual(payDates('2026-09',fridays),['2026-09-04','2026-09-11','2026-09-18','2026-09-25']);
});
test('both biweekly cycles use the selected weekday and continue across months and years',()=>{
 const initial={frequency:'biweekly',anchor_date:'2026-09-01'};
 const fridays=withPayWeekday('2026-09',initial,5);
 assert.deepEqual(payDates('2026-09',fridays),['2026-09-04','2026-09-18']);
 assert.deepEqual(payDates('2026-10',fridays),['2026-10-02','2026-10-16','2026-10-30']);
 const otherCycle={...fridays,anchor_date:'2026-09-11'};
 assert.deepEqual(payDates('2026-09',otherCycle),['2026-09-11','2026-09-25']);
 assert.deepEqual(payDates('2026-10',otherCycle),['2026-10-09','2026-10-23']);
 const yearEnd={...fridays,anchor_date:'2026-12-25'};
 assert.deepEqual(payDates('2027-01',yearEnd),['2027-01-08','2027-01-22']);
 assert.equal(WEEKDAYS[payWeekday(yearEnd)],'Friday');
 assert.throws(()=>withPayWeekday('2026-09',initial,7));
});
test('existing biweekly reference dates preserve the same cycle when reopened or copied',()=>{
 const existing={frequency:'biweekly',anchor_date:'2026-08-28'};
 const normalized={...existing,anchor_date:payDates('2026-09',existing)[0]};
 assert.deepEqual(payDates('2026-10',existing),payDates('2026-10',normalized));
 assert.equal(payWeekday(existing),5);
 assert.equal(withPayWeekday('2026-09',existing,5).anchor_date,existing.anchor_date);
});
