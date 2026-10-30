import type { WorkerRequest, WorkerResponse } from '../core/protocol';
import { createId } from '../core/id';
import type { AnalysisSpec, ChartData, Dataset, Row } from '../core/schema';
type Request = WorkerRequest extends infer T ? T extends WorkerRequest ? Omit<T,'id'> : never : never;
class DataClient {
 private worker:Worker|undefined;
 private pending=new Map<string,{resolve:(v:unknown)=>void;reject:(e:Error)=>void;progress?:(n:number)=>void;cleanup:()=>void}>();
 private connect(){if(this.worker)return;this.worker=new Worker(new URL('../workers/data.worker.ts',import.meta.url),{type:'module'});this.worker.onmessage=(event:MessageEvent<WorkerResponse>)=>{const m=event.data,p=this.pending.get(m.id);if(!p)return;if(m.type==='PARSE_PROGRESS'){p.progress?.(m.progress);return;}this.pending.delete(m.id);p.cleanup();if('error'in m)p.reject(new Error(m.error));else if('data'in m)p.resolve(m.data);};this.worker.onerror=()=>{this.reset('The data worker stopped. Reload your CSV to recover.');};}
 reset(message='Operation cancelled.') {this.worker?.terminate();this.worker=undefined;for(const p of this.pending.values()){p.cleanup();p.reject(new Error(message));}this.pending.clear();}
 request<T>(request:Request,signal?:AbortSignal,progress?:(n:number)=>void):Promise<T>{this.connect();return new Promise((resolve,reject)=>{const id=createId();const abort=()=>{this.worker?.postMessage({id:createId(),type:'CANCEL_OPERATION',target:id});this.pending.delete(id);reject(new DOMException('Operation cancelled','AbortError'));};if(signal?.aborted){abort();return;}signal?.addEventListener('abort',abort,{once:true});this.pending.set(id,{resolve:resolve as (v:unknown)=>void,reject,progress,cleanup:()=>signal?.removeEventListener('abort',abort)});this.worker!.postMessage({...request,id});});}
 parse(file:File,signal?:AbortSignal,progress?:(n:number)=>void){return this.request<Dataset>({type:'PARSE_CSV',file},signal,progress);}
 analyze(spec:AnalysisSpec,signal?:AbortSignal){return this.request<ChartData>({type:'RUN_ANALYSIS',spec},signal);}
 table(offset:number,limit:number,search:string,sort?:{field:string;direction:'asc'|'desc'},filter?:{field:string;value:string},signal?:AbortSignal){return this.request<{rows:Row[];total:number}>({type:'GET_TABLE_ROWS',offset,limit,search,sort,filter},signal);}
}
export const dataClient=new DataClient();
