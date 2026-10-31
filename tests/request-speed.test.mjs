import test from 'node:test';
import assert from 'node:assert/strict';
import {requestWithDeadline} from '../src/requests.mjs';
import {changeAccountMonth} from '../src/month-requests.mjs';
import {loadAccount} from '../src/data.mjs';

const fixture=()=>({profile:{opening_date:'2026-01-01'},configs:[{month:'2026-10-01'}],transactions:[{id:'one',date:'2026-10-01',type:'income',amount_cents:50000}]});
function rpcClient(response){const calls=[];return {calls,rpc(name,args){const call={name,args};calls.push(call);return {abortSignal(signal){call.signal=signal;return this;},retry(value){call.retry=value;return typeof response==='function'?response(call):Promise.resolve(response);}};}};}

test('confirmed month deletion updates immediately without fetching the entire account again',async()=>{
 const client=rpcClient({data:'server-deletion',error:null});
 const original=fixture();
 const result=await changeAccountMonth(original,'delete','2026-10',client);
 assert.equal(result.needsReload,false);
 assert.equal(result.data.transactions[0].month_deletion_id,'server-deletion');
 assert.ok(result.data.transactions[0].deleted_at);
 assert.equal(result.data.deletedMonths[0].id,'server-deletion');
 assert.equal(original.transactions[0].deleted_at,undefined);
 assert.equal(client.calls.length,1);
 assert.deepEqual(client.calls[0].args,{target_month:'2026-10-01'});
 assert.equal(client.calls[0].retry,false);
 const restored=await changeAccountMonth(result.data,'restore','server-deletion',rpcClient({data:null,error:null}));
 assert.equal(restored.data.transactions[0].deleted_at,null);
});
test('purge targets explicit batch IDs and updates only after server confirmation',async()=>{
 const deleted=await changeAccountMonth(fixture(),'delete','2026-10',rpcClient({data:'batch',error:null}));
 const client=rpcClient({data:['batch'],error:null});
 const result=await changeAccountMonth(deleted.data,'purge',['batch'],client);
 assert.equal(client.calls[0].name,'purge_deleted_expense_months');
 assert.deepEqual(client.calls[0].args,{deletion_ids:['batch']});
 assert.equal(result.data.deletedMonths.length,0);
 assert.equal(result.data.transactions.length,0);
 assert.equal(result.data.configs.length,0);
});
test('stalled RPC expires, aborts, preserves local data, and does not automatically retry',async()=>{
 let finish;
 const client=rpcClient(()=>new Promise(resolve=>{finish=resolve;}));
 const original=fixture();
 await assert.rejects(changeAccountMonth(original,'delete','2026-10',client,{timeoutMs:15}),error=>error.code==='REQUEST_TIMEOUT'&&/may already have completed/.test(error.message));
 assert.equal(client.calls[0].signal.aborted,true);
 assert.equal(client.calls.length,1);
 assert.equal(original.transactions[0].deleted_at,undefined);
 finish({data:'late-response',error:null});
});
test('server errors do not report success or change local records',async()=>{
 const original=fixture();
 await assert.rejects(changeAccountMonth(original,'delete','2026-10',rpcClient({error:{message:'Please sign in again.'}})),/sign in again/);
 assert.equal(original.transactions[0].deleted_at,undefined);
});
test('deadline bounds an SDK session wait even when the SDK has not started fetch',async()=>{
 let signal;
 await assert.rejects(requestWithDeadline(s=>{signal=s;return new Promise(()=>{});},{timeoutMs:15}),error=>error.code==='REQUEST_TIMEOUT');
 assert.equal(signal.aborted,true);
});
test('account tables start loading together rather than waiting through sequential round trips',async()=>{
 const started=[],pending=[];
 const rows={expense_profiles:{opening_date:'2026-01-01'},expense_months:[],expense_transactions:[],expense_deleted_months:[]};
 const client={from(table){const query={};for(const method of ['select','eq','order','is','range','maybeSingle','abortSignal'])query[method]=()=>query;query.retry=()=>{started.push(table);return new Promise(resolve=>pending.push(()=>resolve({data:rows[table],error:null})));};return query;}};
 const loading=loadAccount('test-user',client,{timeoutMs:1000});
 await new Promise(resolve=>setImmediate(resolve));
 assert.deepEqual(new Set(started),new Set(Object.keys(rows)));
 pending.forEach(resolve=>resolve());
 const account=await loading;
 assert.deepEqual(account.transactions,[]);assert.deepEqual(account.deletedMonths,[]);
});
test('a stalled account reload ends with a useful error instead of an endless spinner',async()=>{
 const client={from(){const query={};for(const method of ['select','eq','order','is','range','maybeSingle','abortSignal'])query[method]=()=>query;query.retry=()=>new Promise(()=>{});return query;}};
 await assert.rejects(loadAccount('test-user',client,{timeoutMs:15}),/Loading your records took too long/);
});
