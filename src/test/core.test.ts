import { describe,it,expect,beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { analyze,inferColumn,parseCSV,tableRows } from '../core/engine';
import { AnalysisCache } from '../core/analysis-cache';
import { analysisSchema,validateSpec,type AnalysisSpec } from '../core/schema';
import { MockAIProvider } from '../providers/ai';
import { readState,writeState,storageKey,encodeShare,decodeShare } from '../services/persistence';
const csv='order_id,order_date,region,product,category,revenue,profit,channel\nA,2025-01-01,North,Desk,Office,100,20,Online\nB,2025-01-15,South,Lamp,Office,200,60,Retail\nC,2024-02-01,North,Desk,Office,300,90,Online\nD,2025-02-01,South,Lamp,Office,,10,Retail';
const {rows,dataset}=parseCSV(csv,'test.csv');
const base:AnalysisSpec={title:'Revenue',chartType:'bar',dimension:'region',metrics:[{field:'revenue',aggregation:'sum'}],filters:[]};
describe('CSV inference and validation',()=>{
 it('conservatively infers types and preserves missing values',()=>{expect(inferColumn('x',['01','2']).type).toBe('string');expect(inferColumn('x',['1','bad']).type).toBe('string');expect(inferColumn('d',['2025-02-30']).type).toBe('string');expect(dataset.columns.find(c=>c.name==='order_date')?.type).toBe('date');expect(rows[3].revenue).toBeNull();});
 it.each(['','a,a\n1,2','a,\n1,2','a,b\n1,2,3','a,b','1,2\n3,4','a;b\n1;2','a,b\n\u0000,2'])('rejects invalid CSV %s',text=>expect(()=>parseCSV(text,'x.csv')).toThrow());
 it('validates specs and column compatibility',()=>{expect(analysisSchema.safeParse(base).success).toBe(true);expect(analysisSchema.safeParse({...base,chartType:'radar'}).success).toBe(false);expect(()=>validateSpec({...base,dimension:'unknown'},dataset.columns)).toThrow();expect(()=>validateSpec({...base,metrics:[{field:'region',aggregation:'sum'}]},dataset.columns)).toThrow();});
});
describe('real analytics',()=>{
 it('reuses aggregates for visual changes and invalidates on replacement',()=>{const cache=new AnalysisCache();const first=cache.run(rows,base,dataset.columns);expect(cache.run(rows,{...base,chartType:'line',title:'Updated'},dataset.columns)).toBe(first);cache.clear();expect(cache.run(rows,base,dataset.columns)).not.toBe(first);});
 it('groups, sums, sorts and limits',()=>{const r=analyze(rows,{...base,sort:{field:'revenue',direction:'desc'},limit:1},dataset.columns);expect(r.rows).toEqual([{region:'North',revenue:400}]);expect(r.matched).toBe(4);});
 it.each([['average',200],['min',100],['max',300],['count',2]] as const)('supports %s', (aggregation,value)=>expect(analyze(rows,{...base,metrics:[{field:'revenue',aggregation}]},dataset.columns).rows[0].revenue).toBe(value));
 it('filters by year and region and groups dates',()=>{const r=analyze(rows,{...base,dimension:'order_date',dateGrouping:'month',filters:[{field:'order_date',operator:'year',value:2025}]},dataset.columns);expect(r.rows).toEqual([{order_date:'2025-01',revenue:300},{order_date:'2025-02',revenue:null}]);});
 it('handles empty results',()=>expect(analyze(rows,{...base,filters:[{field:'region',operator:'eq',value:'missing'}]},dataset.columns).rows).toEqual([]));
 it('sorts and searches worker table pages',()=>expect(tableRows(rows,0,1,'north',{field:'revenue',direction:'desc'}).rows[0].revenue).toBe(300));
});
describe('mock provider',()=>{
 const provider=new MockAIProvider();
 it.each(['Show total revenue by region','Show monthly revenue','Compare revenue and profit by month','Show the top five products by revenue','Show profit by category as a pie chart','Create a chart comparing sales channels','Show average order value by region'])('interprets %s',question=>{const r=provider.interpret({question,columns:dataset.columns});expect(r.spec).toBeTruthy();expect(analyze(rows,r.spec,dataset.columns).matched).toBe(4);});
 it('updates instead of duplicating and preserves filters',()=>{const filtered=provider.interpret({question:'Filter the data to 2025',columns:dataset.columns,current:base});const line=provider.interpret({question:'Change the current chart to a line chart',columns:dataset.columns,current:filtered.spec});expect(line.update).toBe(true);expect(line.spec.filters).toEqual(filtered.spec.filters);expect(line.spec.dimension).toBe('region');expect(line.spec.chartType).toBe('line');});
 it('rejects unrelated or unsupported prompts',()=>expect(()=>provider.interpret({question:'Predict my future',columns:dataset.columns})).toThrow());
 it('cancels asynchronous stages',async()=>{const abort=new AbortController();abort.abort();await expect(provider.analyze({question:'Show revenue by region',columns:dataset.columns},abort.signal,()=>{})).rejects.toThrow();});
});
describe('storage and sharing',()=>{
 beforeEach(()=>localStorage.clear());
 it('recovers malformed and outdated state',()=>{localStorage.setItem(storageKey,'broken');expect(readState().widgets).toEqual([]);localStorage.setItem(storageKey,'{"version":0}');expect(readState().version).toBe(1);});
 it('round trips validated compact state',()=>{const s=readState();s.theme='dark';expect(writeState(s)).toBe(true);expect(readState().theme).toBe('dark');});
 it('shares configurations without dataset rows',()=>{const d={id:'1',name:'Résumé',widgets:[],updated:'today'};expect(decodeShare(encodeShare(d))).toEqual(d);expect(encodeShare(d)).not.toContain('order_id');});
});
describe('actual bundled datasets',()=>{
 it('verifies 1,200 and 100,000 rows, variety, relationships and aggregation',()=>{for(const [file,count] of [['sales-demo.csv',1200],['sales-100k.csv',100000]] as const){const parsed=parseCSV(readFileSync(`public/sample-data/${file}`,'utf8'),file);expect(parsed.rows).toHaveLength(count);expect(new Set(parsed.rows.map(r=>r.region)).size).toBe(4);expect(new Set(parsed.rows.map(r=>r.product)).size).toBe(8);for(const r of parsed.rows){expect(Number(r.revenue)).toBe(Number(r.quantity)*Number(r.unit_price));expect(Number(r.profit)).toBeCloseTo(Number(r.revenue)-Number(r.cost),2);}const result=analyze(parsed.rows,base,parsed.dataset.columns);expect(result.rows).toHaveLength(4);expect(result.matched).toBe(count);}},30000);
});
