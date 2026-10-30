import { analyze } from './engine';
import { validateSpec, type AnalysisSpec, type ChartData, type Column, type Row } from './schema';
export class AnalysisCache {
 private entries=new Map<string,ChartData>();
 clear(){this.entries.clear();}
 run(rows:Row[],spec:AnalysisSpec,columns:Column[]){
  validateSpec(spec,columns);
  const key=JSON.stringify({...spec,chartType:undefined,title:undefined,explanation:undefined});
  let data=this.entries.get(key);
  if(!data){data=analyze(rows,{...spec,chartType:'bar'},columns);if(this.entries.size>=40)this.entries.delete(this.entries.keys().next().value!);this.entries.set(key,data);}
  if(spec.chartType==='pie'){
   if(data.rows.some(r=>Number(r[spec.metrics[0].field])<0))throw new Error('Negative values cannot be represented meaningfully as a pie chart. Choose bar instead.');
   if(data.rows.length>12)throw new Error('Too many categories for a pie chart. Request the top five or use a bar chart.');
  }
  return data;
 }
}
