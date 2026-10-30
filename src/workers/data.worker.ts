import { parseCSV, tableRows } from '../core/engine';
import { AnalysisCache } from '../core/analysis-cache';
const cache=new AnalysisCache();
import type { Dataset, Row } from '../core/schema';
import type { WorkerRequest, WorkerResponse } from '../core/protocol';
let rows:Row[]=[],dataset:Dataset|undefined;
const cancelled=new Set<string>();
function send(message:WorkerResponse){if(!cancelled.has(message.id))self.postMessage(message);}
self.onmessage=async(event:MessageEvent<WorkerRequest>)=>{
 const m=event.data;
 if(m.type==='CANCEL_OPERATION'){cancelled.add(m.target);return;}
 try {
  if(m.type==='PARSE_CSV'){
   send({id:m.id,type:'PARSE_PROGRESS',progress:10});
   const text=await m.file.text();
   if(cancelled.has(m.id))return;
   send({id:m.id,type:'PARSE_PROGRESS',progress:40});
   const parsed=parseCSV(text,m.file.name);
   rows=parsed.rows;dataset=parsed.dataset;cache.clear();
   send({id:m.id,type:'PARSE_SUCCESS',data:dataset});
  } else if(m.type==='GET_PREVIEW')send({id:m.id,type:'PREVIEW_SUCCESS',data:rows.slice(0,8)});
  else {if(!dataset)throw new Error('Load a dataset first.');if(m.type==='RUN_ANALYSIS')send({id:m.id,type:'ANALYSIS_SUCCESS',data:cache.run(rows,m.spec,dataset.columns)});else send({id:m.id,type:'TABLE_SUCCESS',data:tableRows(rows,m.offset,m.limit,m.search,m.sort,m.filter)});}
 }catch(e){send({id:m.id,type:m.type==='PARSE_CSV'?'PARSE_ERROR':'ERROR',error:e instanceof Error?e.message:'Data operation failed.'});}
};
