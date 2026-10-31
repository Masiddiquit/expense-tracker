import {requestWithDeadline} from './requests.mjs';
import {deleteMonthData,restoreMonthData,purgeMonthData} from './month-data.mjs';

export async function changeAccountMonth(data,kind,value,client,{timeoutMs=15000}={}){
 const rpc=kind==='delete'?['delete_expense_month',{target_month:`${value}-01`}]:kind==='purge'?['purge_deleted_expense_months',{deletion_ids:value}]:['restore_expense_month',{deletion_id:value}];
 const result=await requestWithDeadline(signal=>client.rpc(...rpc).abortSignal(signal).retry(false),{
  timeoutMs,message:'The request took too long to confirm. Check saved data before trying again; the change may already have completed.'
 });
 if(result.error){const error=new Error(result.error.message||'The change could not be saved. Please try again.');if(result.error.name==='AbortError'||result.error.code==='20'||/abort|timeout/i.test(error.message)){error.code='REQUEST_TIMEOUT';error.message='The request took too long to confirm. Check saved data before trying again; the change may already have completed.';}throw error;}
 // The server has committed. Update the screen without waiting for more requests.
 try{return {data:kind==='delete'?deleteMonthData(data,value,{id:result.data}).data:kind==='purge'?purgeMonthData(data,result.data):restoreMonthData(data,value),needsReload:false};}
 catch{return {needsReload:true};}
}
