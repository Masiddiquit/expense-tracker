import {CATEGORIES} from './finance.mjs';

const INCOME_CATEGORIES=['Pay','Freelance','Gift','Refund','Other income'];
const normalize=name=>String(name??'').trim().replace(/\s+/gu,' ');
const identity=name=>normalize(name).toLocaleLowerCase('en-US');
export const categoryKey=type=>type==='income'?'income_categories':'expense_categories';
export function categoryOptions(type,profile={},transactions=[],selected=''){
 const defaults=type==='income'?INCOME_CATEGORIES:CATEGORIES;
 const saved=Array.isArray(profile[categoryKey(type)])?profile[categoryKey(type)]:[];
 const names=[...defaults,...saved,...transactions.filter(t=>t.type===type).map(t=>t.category),selected];
 const seen=new Set();return names.map(normalize).filter(name=>{const id=identity(name);if(!name||name.length>64||seen.has(id))return false;seen.add(id);return true;});
}
export function prepareCategory(input,type,profile={},transactions=[]){
 const name=normalize(input);if(!name)throw new Error('Enter a category name.');
 if(name.length>64)throw new Error('Use a category name with 64 characters or fewer.');
 const key=categoryKey(type),values=Array.isArray(profile[key])?profile[key]:[];
 const existing=categoryOptions(type,profile,transactions).find(c=>identity(c)===identity(name));
 // Historical categories remain reusable even if they were never explicitly saved.
 if(existing&&((type==='income'?INCOME_CATEGORIES:CATEGORIES).some(c=>identity(c)===identity(existing))||values.some(c=>identity(c)===identity(existing))))return {name:existing,key,values,created:false};
 if(values.length>=200)throw new Error('You can save up to 200 custom categories for each transaction type.');
 return {name:existing||name,key,values:[...values,existing||name],created:true};
}
