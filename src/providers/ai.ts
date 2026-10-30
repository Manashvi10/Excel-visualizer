import { analysisSchema, validateSpec, type AnalysisSpec, type Column } from '../core/schema';
import { z } from 'zod';
export interface AnalysisRequest { question:string; columns:Column[]; current?:AnalysisSpec }
export interface AnalysisResponse { spec:AnalysisSpec; text:string; update:boolean }
export interface AIProvider { analyze(request:AnalysisRequest,signal:AbortSignal,onStage:(stage:string)=>void):Promise<AnalysisResponse> }
export const suggestions=['Show total revenue by region','Show monthly revenue','Compare revenue and profit by month','Show the top five products by revenue','Show profit by category as a pie chart','Show average order value by region'];
const responseSchema=z.object({spec:analysisSchema,text:z.string(),update:z.boolean()});
const pause=(ms:number,signal:AbortSignal)=>new Promise<void>((resolve,reject)=>{if(signal.aborted){reject(new DOMException('Cancelled','AbortError'));return;}const abort=()=>{clearTimeout(t);reject(new DOMException('Cancelled','AbortError'));};const t=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},ms);signal.addEventListener('abort',abort,{once:true});});
export class MockAIProvider implements AIProvider {
 async analyze(request:AnalysisRequest,signal:AbortSignal,onStage:(s:string)=>void){
  for(const stage of ['Understanding your question','Preparing the chart specification']){onStage(stage);await pause(Number(import.meta.env.VITE_MOCK_DELAY_MS??120),signal);}
  const result=this.interpret(request);onStage('Validating the specification');result.spec=validateSpec(result.spec,request.columns);return result;
 }
 interpret({question,columns,current}:AnalysisRequest):AnalysisResponse {
  const q=question.toLowerCase().trim();
  if(!q)throw new Error('Ask a question about your data.');
  const find=(pattern:RegExp)=>columns.find(c=>pattern.test(c.name.toLowerCase()))?.name;
  const date=columns.find(c=>c.type==='date')?.name;
  const update=/^(change|filter|show only|sort|switch|make this|use |remove filters)/.test(q);
  if(update&&!current)throw new Error('Create a chart first, then change its type, sorting, or filters.');
  let spec:AnalysisSpec;
  if(update)spec=structuredClone(current!);
  else {
   const metrics=columns.filter(c=>c.type==='number'&&new RegExp(`\\b${c.name.replaceAll('_','[ _]')}\\b`).test(q)).map(c=>({field:c.name,aggregation:(/average|avg/.test(q)?'average':/minimum|\bmin\b/.test(q)?'min':/maximum|\bmax\b/.test(q)?'max':'sum') as 'sum'|'average'|'min'|'max'}));
   if(/average order value/.test(q)){const revenue=find(/^revenue$/);if(revenue)metrics.splice(0,metrics.length,{field:revenue,aggregation:'average'});}
   if(/\bcount\b|number of orders/.test(q)){const field=columns[0]?.name;if(field)metrics.splice(0,metrics.length,{field,aggregation:'count' as never});}
   if(!metrics.length && /sales channels/.test(q)){const revenue=find(/^revenue$/);if(revenue)metrics.push({field:revenue,aggregation:'sum'});}
   const dimension=/monthly|by month|by quarter|by year|daily/.test(q)?date:columns.find(c=>new RegExp(`(?:by |comparing |compare |across |per |top (?:five|\\d+) )${c.name.replaceAll('_','[ _]')}s?\\b`).test(q))?.name??(/sales channels/.test(q)?find(/^channel$/):undefined);
   if(!dimension||!metrics.length)throw new Error('I could not identify a metric and grouping. Try “Show total revenue by region”, or name a numeric column and a category from your dataset. Demo mode supports sums, averages, counts, min/max, dates, top-N, filters, and chart changes.');
   spec={chartType:/monthly|by month|daily/.test(q)?'line':'bar',title:question.replace(/[.!?]+$/,''),dimension,metrics:metrics.slice(0,3),filters:[]};
   if(/monthly|by month/.test(q))spec.dateGrouping='month';else if(/by quarter/.test(q))spec.dateGrouping='quarter';else if(/by year/.test(q))spec.dateGrouping='year';else if(/daily/.test(q))spec.dateGrouping='day';
  }
  const type=q.match(/\b(bar|line|area|pie)(?: chart)?\b/);if(type)spec.chartType=type[1] as AnalysisSpec['chartType'];
  const year=q.match(/\b(20\d{2})\b/);if(year){if(!date)throw new Error('No unambiguous ISO date column was detected.');spec.filters=spec.filters.filter(f=>f.operator!=='year');spec.filters.push({field:date,operator:'year',value:year[1]});}
  const region=q.match(/\b(north|south|east|west)\b/);if(region){const field=find(/^region$/);if(!field)throw new Error('This dataset has no region column.');spec.filters=spec.filters.filter(f=>f.field!==field);spec.filters.push({field,operator:'eq',value:region[1]});}
  if(/remove filters/.test(q))spec.filters=[];
  const top=q.match(/top (five|ten|\d+)/);if(top){spec.limit=top[1]==='five'?5:top[1]==='ten'?10:Number(top[1]);spec.sort={field:spec.metrics[0].field,direction:'desc'};}
  if(/sort/.test(q)){const field=spec.metrics.find(m=>q.includes(m.field))?.field??spec.metrics[0].field;spec.sort={field,direction:/ascending|\basc\b/.test(q)?'asc':'desc'};}
  if(update&&!type&&!year&&!region&&!/sort|remove filters/.test(q))throw new Error('That follow-up is not supported in demo mode. Try changing the chart type, filtering to a year or region, or sorting the results.');
  return {spec:validateSpec(spec,columns),text:`${update?'Updated your selected chart':'Created a chart'} using ${spec.metrics.map(m=>`${m.aggregation} of ${m.field}`).join(' and ')} by ${spec.dimension}${spec.dateGrouping?` (${spec.dateGrouping})`:''}. All values are calculated locally from your CSV.`,update};
 }
}
export class HttpAIProvider implements AIProvider {
 async analyze(request:AnalysisRequest,signal:AbortSignal,onStage:(s:string)=>void){onStage('Requesting a chart specification from live AI');const endpoint=import.meta.env.VITE_AI_ENDPOINT||'/api/ai/analyze';const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal});if(!response.ok){const body=await response.json().catch(()=>null);throw new Error(body?.error||(response.status===429?'Rate limit reached. Please retry later.':`Analysis server returned ${response.status}.`));}onStage('Validating the AI specification');const result=responseSchema.parse(await response.json());return {...result,spec:validateSpec(result.spec,request.columns)};}
}
export const isMock=import.meta.env.VITE_AI_MODE==='mock';
export const provider:AIProvider=isMock?new MockAIProvider():new HttpAIProvider();
