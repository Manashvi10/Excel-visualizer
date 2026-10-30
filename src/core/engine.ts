import Papa from 'papaparse';
import { validateSpec, type AnalysisSpec, type Cell, type ChartData, type Column, type Dataset, type Row } from './schema';
const numeric = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/;
export function isDate(v:string) { if(!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false; const d=new Date(v); return !isNaN(+d) && d.toISOString().slice(0,10)===v; }
export function inferColumn(name:string, values:string[]):Column {
  const present=values.filter(v=>v.trim()!=='');
  return {name,type:present.length && present.every(v=>numeric.test(v)&&Number.isFinite(Number(v)))?'number':present.length && present.every(isDate)?'date':'string',missing:values.length-present.length};
}
export function parseCSV(text:string,name:string):{dataset:Dataset;rows:Row[]} {
  if(!text.trim()) throw new Error('This file is empty. Choose a CSV with a header and data rows.');
  if(/[\u0000\uFFFD]/.test(text)) throw new Error('CSV must be readable UTF-8 text. Re-export this file with UTF-8 encoding.');
  const result=Papa.parse<string[]>(text.replace(/^\uFEFF/,''),{delimiter:',',skipEmptyLines:'greedy'});
  if(result.errors.length) throw new Error(`Malformed CSV: ${result.errors[0].message}`);
  const [headers,...raw]=result.data;
  if(!headers || headers.some(h=>!h.trim()) || new Set(headers).size!==headers.length) throw new Error('Column headers must be unique and non-blank.');
  if(headers.length<2) throw new Error('Expected a comma-separated CSV with at least two columns.');
  if(headers.every(h=>numeric.test(h))) throw new Error('A named header row is required before the data.');
  if(!raw.length) throw new Error('The CSV has a header but no data rows.');
  const bad=raw.findIndex(r=>r.length!==headers.length);
  if(bad>=0) throw new Error(`Row ${bad+2} has a different number of fields than the header.`);
  const columns=headers.map((h,i)=>inferColumn(h,raw.map(r=>r[i])));
  const rows=raw.map(r=>Object.fromEntries(columns.map((c,i)=>[c.name,r[i].trim()===''?null:c.type==='number'?Number(r[i]):r[i]])) as Row);
  return {dataset:{name,rows:rows.length,columns,preview:rows.slice(0,8)},rows};
}
export function matches(row:Row,filters:AnalysisSpec['filters']) {
  return filters.every(f=>{ const v=row[f.field]; if(v===null || v===undefined) return false; switch(f.operator){case 'eq':return String(v).toLowerCase()===String(f.value).toLowerCase();case 'contains':return String(v).toLowerCase().includes(String(f.value).toLowerCase());case 'gte':return v>=f.value;case 'lte':return v<=f.value;case 'year':return String(v).slice(0,4)===String(f.value);} });
}
function bucket(v:Cell,group:AnalysisSpec['dateGrouping']) { if(v===null)return '(Missing)'; const s=String(v); if(group==='month')return s.slice(0,7); if(group==='year')return s.slice(0,4); if(group==='quarter')return `${s.slice(0,4)}-Q${Math.ceil(Number(s.slice(5,7))/3)}`; return s; }
export function analyze(rows:Row[],input:AnalysisSpec,columns:Column[]):ChartData {
  const spec=validateSpec(input,columns), groups=new Map<string,{count:number; values:number[][]}>(); let matched=0;
  for(const row of rows) { if(!matches(row,spec.filters))continue; matched++; const key=bucket(row[spec.dimension],spec.dateGrouping); let g=groups.get(key); if(!g){g={count:0,values:spec.metrics.map(()=>[])};groups.set(key,g);} g.count++; spec.metrics.forEach((m,i)=>{const v=row[m.field]; if(typeof v==='number' && Number.isFinite(v))g.values[i].push(v);}); }
  let result:Row[]=Array.from(groups,([key,g])=>{const r:Row={[spec.dimension]:key};spec.metrics.forEach((m,i)=>{const v=g.values[i];r[m.field]=m.aggregation==='count'?g.count:!v.length?null:m.aggregation==='sum'?v.reduce((a,b)=>a+b,0):m.aggregation==='average'?v.reduce((a,b)=>a+b,0)/v.length:m.aggregation==='min'?v.reduce((a,b)=>Math.min(a,b),Infinity):v.reduce((a,b)=>Math.max(a,b),-Infinity);});return r;});
  const sort=spec.sort || {field:spec.dimension,direction:'asc'};
  result.sort((a,b)=>{const x=a[sort.field],y=b[sort.field];const n=typeof x==='number'&&typeof y==='number'?x-y:String(x??'').localeCompare(String(y??''));return sort.direction==='asc'?n:-n;});
  const warnings:string[]=[];
  if(spec.chartType==='pie' && result.some(r=>Number(r[spec.metrics[0].field])<0)) throw new Error('Negative values cannot be represented meaningfully as a pie chart. Choose bar instead.');
  if(spec.chartType==='pie' && result.length>12 && !spec.limit) throw new Error('Too many categories for a pie chart. Request the top five or use a bar chart.');
  if(result.length>(spec.limit??100))warnings.push(`Showing ${spec.limit??100} of ${result.length} groups.`);
  result=result.slice(0,spec.limit??100);
  return {rows:result,matched,warnings};
}
export function tableRows(rows:Row[], offset:number,limit:number,search:string,sort?:{field:string;direction:'asc'|'desc'},filter?:{field:string;value:string}) {
  let selected=rows.filter(r=>(!search||Object.values(r).some(v=>String(v??'').toLowerCase().includes(search.toLowerCase())))&&(!filter||String(r[filter.field]??'').toLowerCase().includes(filter.value.toLowerCase())));
  if(sort)selected.sort((a,b)=>{const x=a[sort.field],y=b[sort.field];return (typeof x==='number'&&typeof y==='number'?x-y:String(x??'').localeCompare(String(y??'')))*(sort.direction==='asc'?1:-1);});
  return {rows:selected.slice(offset,offset+limit),total:selected.length};
}
