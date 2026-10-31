import {summarize,summarizeYear,categoryTotals,monthLabel,money} from './finance.mjs';

export function buildReport({transactions,profile,scope,year,month,demo=false}){
 const annual=scope==='annual';
 const summary=annual?summarizeYear(transactions,year,profile):summarize(transactions,month,profile);
 return {scope:annual?'annual':'monthly',period:annual?String(year):monthLabel(month),filename:`expense-report-${annual?year:month}`,demo,summary,categories:categoryTotals(summary.rows),transactions:[...summary.rows].sort((a,b)=>a.date.localeCompare(b.date)||(a.created_at||'').localeCompare(b.created_at||''))};
}

export function reportCSV(report,{includeTransactions=true}={}){
 const cash=cents=>Number((cents/100).toFixed(2));
 const s=report.summary;
 const rows=[['Expense Tracker',`${report.scope==='annual'?'Annual':'Monthly'} report`,report.period],['Data',report.demo?'SAMPLE DATA - demo workspace':'Personal account records'],['Currency','USD'],[],['Summary','Amount (USD)'],['Opening / starting balance',cash(s.opening)],['Income received',cash(s.income)],['Expenses paid',cash(s.expense)],['Net income less expenses',cash(s.net)],['Closing balance',cash(s.closing)],[]];
 if(s.months){rows.push(['Month','Income (USD)','Expenses (USD)','Net (USD)','Closing balance (USD)']);for(const m of s.months)rows.push([monthLabel(m.month),cash(m.income),cash(m.expense),cash(m.net),cash(m.closing)]);rows.push([]);}
 rows.push(['Category','Expenses (USD)']);for(const c of report.categories)rows.push([c.name,cash(c.value)]);if(!report.categories.length)rows.push(['No expenses',0]);
 if(includeTransactions){rows.push([],['Date','Type','Description','Category','Amount (USD)','Payment method']);for(const t of report.transactions)rows.push([t.date,t.type,t.description,t.category,cash(t.amount_cents),t.payment_method]);if(!report.transactions.length)rows.push(['No transactions']);}
 const quote=value=>{let text=String(value??'');if(typeof value==='string'&&/^[\s]*[=+\-@\t\r]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
 return '\ufeff'+rows.map(row=>row.map(quote).join(',')).join('\r\n');
}

export async function reportPDF(report,{includeTransactions=true,fontBytes}={}){
 const [{PDFDocument,rgb},fontkit]=await Promise.all([import('pdf-lib'),import('@pdf-lib/fontkit')]);
 const pdf=await PDFDocument.create();pdf.registerFontkit(fontkit.default);
 if(!fontBytes){const response=await fetch('/fonts/DejaVuSans.ttf');if(!response.ok)throw new Error('The report font could not be loaded. Please try again.');fontBytes=new Uint8Array(await response.arrayBuffer());}
 const font=await pdf.embedFont(fontBytes,{subset:true});
 const green=rgb(.07,.36,.28),ink=rgb(.16,.23,.19),gray=rgb(.45,.51,.46),line=rgb(.88,.92,.87),pale=rgb(.95,.97,.94);
 let page,y;const margin=40,width=532;
 const text=(value,x,top,size=9,color=ink)=>page.drawText(String(value).replace(/[\u0000-\u001f]/g,' '),{x,y:top,size,font,color});
 const newPage=()=>{page=pdf.addPage([612,792]);y=745;text('Expense Tracker',margin,y,17,green);text(`${report.scope==='annual'?'Annual':'Monthly'} report | ${report.period}`,margin,y-23,11,gray);if(report.demo){text('SAMPLE DATA - DEMO WORKSPACE',margin,y-42,9,green);y-=64;}else y-=48;page.drawLine({start:{x:margin,y:y+6},end:{x:572,y:y+6},thickness:.7,color:line});};
 const ensure=height=>{if(y-height<60)newPage();};
 const wrap=(value,colWidth,size=8.5)=>{const all=String(value??'').replace(/[\u0000-\u001f]/g,' ');const lines=[];let current='';for(const ch of Array.from(all)){const next=current+ch;if(current&&font.widthOfTextAtSize(next,size)>colWidth-12){lines.push(current.trimEnd());current=ch.trimStart();}else current=next;}lines.push(current||'');return lines;};
 const section=title=>{ensure(220);y-=18;text(title,margin,y,12,green);y-=22;};
 const table=(headers,rows,widths,numeric=[])=>{
  const header=()=>{ensure(30);page.drawRectangle({x:margin,y:y-22,width,height:24,color:pale});let x=margin;headers.forEach((h,i)=>{text(h,x+6,y-14,8,green);x+=widths[i];});y-=27;};header();
  for(const row of rows){const wrapped=row.map((v,i)=>wrap(v,widths[i]));const height=Math.max(...wrapped.map(lines=>lines.length))*12+10;if(y-height<60){newPage();header();}let x=margin;wrapped.forEach((lines,i)=>{lines.forEach((str,j)=>{const size=8.5;const offset=numeric.includes(i)?Math.max(6,widths[i]-6-font.widthOfTextAtSize(str,size)):6;text(str,x+offset,y-10-j*12,size);});x+=widths[i];});y-=height;page.drawLine({start:{x:margin,y},end:{x:572,y},thickness:.4,color:line});y-=3;}
 };
 newPage();section('Summary');const s=report.summary;table(['Measure','Amount (USD)'],[['Opening / starting balance',money(s.opening)],['Income received',money(s.income)],['Expenses paid',money(s.expense)],['Net income less expenses',money(s.net)],['Closing balance',money(s.closing)]],[350,182],[1]);
 if(s.months){section('Month by month');table(['Month','Income','Expenses','Net','Closing'],s.months.map(m=>[monthLabel(m.month),money(m.income),money(m.expense),money(m.net),money(m.closing)]),[132,100,100,100,100],[1,2,3,4]);}
 section('Spending by category');table(['Category','Expenses (USD)'],report.categories.length?report.categories.map(c=>[c.name,money(c.value)]):[['No expenses',money(0)]],[350,182],[1]);
 if(includeTransactions){section(`Transactions (${report.transactions.length})`);table(['Date','Description / payment method','Category','Income','Expense'],report.transactions.length?report.transactions.map(t=>[t.date,`${t.description} | ${t.payment_method}`,t.category,t.type==='income'?money(t.amount_cents):'',t.type==='expense'?money(t.amount_cents):'']):[['','No transactions','','','']],[65,205,102,80,80],[3,4]);}
 const pages=pdf.getPages();for(let i=0;i<pages.length;i++){page=pages[i];text('USD | Actual recorded transactions; expected pay excluded',40,30,7,gray);text(`${i+1} / ${pages.length}`,535,30,7,gray);}
 pdf.setTitle(`Expense Tracker - ${report.period} ${report.scope} report`);pdf.setSubject(report.demo?'Sample data report':'Personal income and expense report');pdf.setCreator('Expense Tracker');
 return pdf.save();
}

export function downloadFile(bytes,filename,type){const url=URL.createObjectURL(new Blob([bytes],{type}));const link=document.createElement('a');link.href=url;link.download=filename;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);}
