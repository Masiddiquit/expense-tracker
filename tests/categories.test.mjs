import test from 'node:test';
import assert from 'node:assert/strict';
import {categoryOptions,prepareCategory} from '../src/categories.mjs';
import {summarize,summarizeYear} from '../src/finance.mjs';

test('custom categories persist without a transaction, stay separate by type, and preserve historical categories',()=>{
 const saved=prepareCategory('  College   fees  ','expense');
 assert.equal(saved.name,'College fees');
 const profile={[saved.key]:saved.values,income_categories:['Consulting']};
 assert.ok(categoryOptions('expense',profile).includes('College fees'));
 assert.ok(!categoryOptions('income',profile).includes('College fees'));
 assert.ok(categoryOptions('income',profile).includes('Consulting'));
 assert.ok(categoryOptions('expense',{},[{type:'expense',category:'Old category',deleted_at:'deleted'}]).includes('Old category'));
 assert.equal(prepareCategory(' college FEES ','expense',profile).created,false);
 assert.equal(prepareCategory('education','expense',profile).name,'Education');
 assert.throws(()=>prepareCategory('   ','expense'));
 assert.throws(()=>prepareCategory('a'.repeat(65),'expense'));
});
test('correcting saved income and expense amounts updates later balances and reports without another payment',()=>{
 const profile={opening_date:'2026-01-01',opening_balance_cents:10000};
 const original=[{id:'pay',date:'2026-01-08',scheduled_for:'2026-01-08',type:'income',amount_cents:90000},{id:'expense',date:'2026-01-10',type:'expense',category:'College fees',amount_cents:10000}];
 const edited=original.map(t=>t.id==='pay'?{...t,amount_cents:75000}:t.id==='expense'?{...t,amount_cents:12000}:t);
 assert.equal(edited.length,2);
 assert.equal(edited[0].scheduled_for,'2026-01-08');
 assert.equal(summarize(edited,'2026-01',profile).income,75000);
 assert.equal(summarize(edited,'2026-01',profile).closing,73000);
 assert.equal(summarize(edited,'2026-02',profile).opening,73000);
 assert.equal(summarizeYear(edited,2026,profile).closing,73000);
});
