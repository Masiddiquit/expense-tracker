import {createClient} from '@supabase/supabase-js';
import {newId,today,monthOf,shiftMonth} from './finance.mjs';
import {requestWithDeadline} from './requests.mjs';
const url=import.meta.env?.VITE_SUPABASE_URL;
const key=import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY;
export const supabase=url&&key?createClient(url,key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}):null;
const DEMO_KEY='expense-tracker-demo-v1';
export const emptyProfile={expense_categories:[],income_categories:[],display_name:'',currency:'USD',opening_balance_cents:0,opening_date:'2026-01-01'};
export function demoData(){const month=monthOf(today()),previous=shiftMonth(month,-1);const id=()=>newId();const tx=(date,type,description,category,amount,method='Debit card',scheduled=null)=>({id:id(),date,type,description,category,amount_cents:amount,payment_method:method,scheduled_for:scheduled,deleted_at:null,created_at:new Date().toISOString()});return {profile:{...emptyProfile,display_name:'Alex',opening_date:`${previous}-01`,opening_balance_cents:42500},configs:[{month:`${month}-01`,frequency:'weekly',anchor_date:`${month}-02`,monthly_day:1,second_day:15,expected_amount_cents:85000,budget_cents:240000}],transactions:[tx(`${previous}-10`,'income','Pay received','Pay',310000,'Bank transfer'),tx(`${previous}-20`,'expense','Last month’s expenses','Other',285000),tx(`${month}-02`,'income','Weekly pay','Pay',85000,'Bank transfer',`${month}-02`),tx(`${month}-09`,'income','Weekly pay','Pay',90000,'Bank transfer',`${month}-09`),tx(`${month}-16`,'income','Weekly pay','Pay',85000,'Bank transfer',`${month}-16`),tx(`${month}-01`,'expense','Monthly rent','Rent',105000,'Bank transfer'),tx(`${month}-03`,'expense','Weekly groceries','Groceries',8249),tx(`${month}-05`,'expense','Car fuel','Fuel',4620),tx(`${month}-08`,'expense','Lunch with friends','Food & dining',2875),tx(`${month}-11`,'expense','Car fuel','Fuel',4310),tx(`${month}-12`,'expense','Phone plan','Phone & internet',6500),tx(`${month}-15`,'expense','Weekly groceries','Groceries',7350),tx(`${month}-18`,'expense','Car fuel','Fuel',4900),tx(`${month}-20`,'expense','Streaming subscription','Subscriptions',1599)]};}
export function readDemo(){try{const value=JSON.parse(localStorage.getItem(DEMO_KEY));if(value&&Array.isArray(value.transactions)&&Array.isArray(value.configs)&&value.profile)return value;}catch{}return demoData();}
export function saveDemo(value){localStorage.setItem(DEMO_KEY,JSON.stringify(value));}
export function clearDemo(){localStorage.removeItem(DEMO_KEY);}
export async function loadAccount(userId,client=supabase,{timeoutMs=15000}={}){
 return requestWithDeadline(async signal=>{
  const checked=async query=>{const result=await query.abortSignal(signal).retry(false);if(result.error)throw result.error;return result.data;};
  const pages=async(table,configure)=>{const rows=[];for(let offset=0;;offset+=1000){signal.throwIfAborted();const batch=await checked(configure(client.from(table).select('*').eq('user_id',userId)).range(offset,offset+999));rows.push(...batch);if(batch.length<1000)return rows;}};
  const [stored,configs,transactions,deletedMonths]=await Promise.all([
   checked(client.from('expense_profiles').select('*').eq('user_id',userId).maybeSingle()),
   checked(client.from('expense_months').select('*').eq('user_id',userId)),
   pages('expense_transactions',query=>query.order('date',{ascending:false}).order('id')),
   pages('expense_deleted_months',query=>query.is('restored_at',null).order('deleted_at',{ascending:false}).order('id'))
  ]);
  let profile=stored;
  if(!profile){await checked(client.from('expense_profiles').upsert({...emptyProfile,user_id:userId,opening_date:`${monthOf(today())}-01`},{onConflict:'user_id',ignoreDuplicates:true}));profile=await checked(client.from('expense_profiles').select('*').eq('user_id',userId).single());}
  return {profile,configs,transactions,deletedMonths};
 },{timeoutMs,message:'Loading your records took too long. Check your connection and try again.'});
}
