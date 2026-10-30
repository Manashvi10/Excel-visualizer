import { z } from 'zod';
export type Cell = string | number | null;
export type Row = Record<string, Cell>;
export const columnSchema = z.object({ name: z.string(), type: z.enum(['number','date','string']), missing: z.number() });
export type Column = z.infer<typeof columnSchema>;
export const datasetSchema = z.object({ name:z.string(), rows:z.number(), columns:z.array(columnSchema), preview:z.array(z.record(z.string(),z.union([z.string(),z.number(),z.null()]))) });
export type Dataset = z.infer<typeof datasetSchema>;
export const analysisSchema = z.object({
  chartType: z.enum(['bar','line','area','pie']), title:z.string().min(1).max(160), dimension:z.string().min(1),
  metrics:z.array(z.object({ field:z.string(), aggregation:z.enum(['sum','average','count','min','max']) })).min(1).max(3),
  filters:z.array(z.object({ field:z.string(), operator:z.enum(['eq','contains','gte','lte','year']), value:z.union([z.string(),z.number()]) })).max(20).default([]),
  dateGrouping:z.enum(['day','month','quarter','year']).optional(),
  sort:z.object({ field:z.string(), direction:z.enum(['asc','desc']) }).optional(), limit:z.number().int().min(1).max(100).optional(), explanation:z.string().optional()
}).strict();
export type AnalysisSpec = z.infer<typeof analysisSchema>;
export type ChartData = { rows:Row[]; matched:number; warnings:string[] };
export function validateSpec(input:unknown, columns:Column[]):AnalysisSpec {
  const spec=analysisSchema.parse(input);
  const col=(name:string)=>{ const c=columns.find(c=>c.name===name); if(!c) throw new Error(`Column “${name}” is not in this dataset. Load the matching CSV or create a new chart.`); return c; };
  const dimension=col(spec.dimension);
  if(new Set(spec.metrics.map(m=>m.field)).size!==spec.metrics.length || spec.metrics.some(m=>m.field===spec.dimension)) throw new Error('Use distinct metric fields separate from the grouping column.');
  for(const m of spec.metrics) if(col(m.field).type!=='number' && m.aggregation!=='count') throw new Error(`${m.field} requires a count aggregation.`);
  if(spec.dateGrouping && dimension.type!=='date') throw new Error('Date grouping requires an ISO date column.');
  for(const f of spec.filters) {
    const c=col(f.field);
    if(f.operator==='year' && (c.type!=='date' || !/^\d{4}$/.test(String(f.value)))) throw new Error('Year filters require a date column and four-digit year.');
    if(f.operator==='contains' && c.type!=='string') throw new Error('Text contains filters require a categorical column.');
    if(c.type==='number' && (String(f.value).trim()==='' || !Number.isFinite(Number(f.value)))) throw new Error('Numeric filters require a finite number.');
    if(['gte','lte'].includes(f.operator) && c.type==='string') throw new Error('Range filters require a numeric or date column.');
    if(c.type==='date' && f.operator!=='year') { const v=String(f.value),d=new Date(v); if(!/^\d{4}-\d{2}-\d{2}$/.test(v)||isNaN(+d)||d.toISOString().slice(0,10)!==v) throw new Error('Date filters require a valid YYYY-MM-DD value.'); }
  }
  if(spec.sort && ![spec.dimension,...spec.metrics.map(m=>m.field)].includes(spec.sort.field)) throw new Error('Sort column must be part of the result.');
  if(spec.chartType==='pie' && (spec.metrics.length!==1 || dimension.type==='number')) throw new Error('Pie charts require one metric and a categorical or date dimension.');
  return spec;
}
