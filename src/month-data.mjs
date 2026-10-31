import {monthOf,newId,validDate} from './finance.mjs';

export function monthDataInfo(data,month){
 const rows=data.transactions.filter(t=>!t.deleted_at&&monthOf(t.date)===month);
 const config=data.configs.find(c=>!c.deleted_at&&monthOf(c.month)===month);
 return {rows,config,income:rows.filter(t=>t.type==='income').reduce((a,t)=>a+Number(t.amount_cents),0),expense:rows.filter(t=>t.type==='expense').reduce((a,t)=>a+Number(t.amount_cents),0)};
}
export function deleteMonthData(data,month,{id=newId(),timestamp=new Date().toISOString()}={}){
 if(!/^\d{4}-\d{2}$/.test(month)||!validDate(`${month}-01`)||month<'1900-01'||month>'2100-12')throw new Error('Choose a valid calendar month.');
 const info=monthDataInfo(data,month);
 if(!info.rows.length&&!info.config)throw new Error('There is no data to delete in this month.');
 const batch={id,month:`${month}-01`,deleted_at:timestamp,restored_at:null,transaction_count:info.rows.length,had_schedule:!!info.config};
 const mark=row=>({...row,deleted_at:timestamp,month_deletion_id:id});
 return {batch,data:{...data,transactions:data.transactions.map(t=>!t.deleted_at&&monthOf(t.date)===month?mark(t):t),configs:data.configs.map(c=>!c.deleted_at&&monthOf(c.month)===month?mark(c):c),deletedMonths:[batch,...(data.deletedMonths||[])]}};
}
export function restoreMonthData(data,id,{timestamp=new Date().toISOString()}={}){
 const batch=(data.deletedMonths||[]).find(b=>b.id===id&&!b.restored_at);
 if(!batch)throw new Error('This deleted month is unavailable or already restored.');
 if(data.transactions.some(t=>t.month_deletion_id===id&&t.deleted_at&&t.date<data.profile.opening_date))throw new Error('These transactions are before your starting balance date. Move the starting date earlier in Settings before restoring.');
 const restore=row=>row.month_deletion_id===id&&row.deleted_at?{...row,deleted_at:null,month_deletion_id:null}:row;
 return {...data,transactions:data.transactions.map(restore),configs:data.configs.map(restore),deletedMonths:data.deletedMonths.map(b=>b.id===id?{...b,restored_at:timestamp}:b)};
}
export function purgeMonthData(data,ids){
 const selected=new Set(ids);
 if(!selected.size)throw new Error('Choose deleted month data to remove.');
 if([...selected].some(id=>!(data.deletedMonths||[]).some(b=>b.id===id&&!b.restored_at)))throw new Error('Some selected data is already removed or restored. Check saved data before trying again.');
 const keep=row=>!(row.deleted_at&&selected.has(row.month_deletion_id));
 return {...data,transactions:data.transactions.filter(keep),configs:data.configs.filter(keep),deletedMonths:data.deletedMonths.filter(b=>!selected.has(b.id))};
}
