import {payDates,monthOf} from './finance.mjs';

function match(row,month,config,dates){
 if(row.deleted_at||row.type!=='income')return null;
 if(row.scheduled_for&&dates.includes(row.scheduled_for))return row.scheduled_for;
 // Explicit links to a different month must not also credit this month.
 if(monthOf(row.date)!==month||(row.scheduled_for&&monthOf(row.scheduled_for)!==month))return null;
 const isPay=String(row.category).trim().toLowerCase()==='pay';
 const oldLink=!!row.scheduled_for;
 if(!isPay&&!oldLink)return null;
 if(dates.includes(row.date))return row.date;
 // Split or late monthly pay still belongs to the single monthly payday.
 if(config?.frequency==='monthly'&&dates.length===1)return dates[0];
 return null;
}
export function paydayAssignments(month,config,rows){
 const dates=payDates(month,config),byDate=Object.fromEntries(dates.map(d=>[d,[]])),unassigned=[];
 for(const row of rows){const date=match(row,month,config,dates);if(date)byDate[date].push(row);else if(!row.deleted_at&&row.type==='income'&&monthOf(row.date)===month&&(!row.scheduled_for||monthOf(row.scheduled_for)===month)&&(String(row.category).trim().toLowerCase()==='pay'||row.scheduled_for))unassigned.push(row);}
 return {dates,byDate,unassigned};
}
