import { toast } from 'sonner';
import { createId } from '../core/id';
import type { Dataset } from '../core/schema';
import { provider } from '../providers/ai';
import { actions, store } from '../state/store';
import { dataClient } from './worker';

type Run={controller:AbortController;dataset:Dataset;messageId:string};
let active:Run|undefined;
function cancel(message?:string){
 const run=active;active=undefined;run?.controller.abort();
 store.dispatch(actions.status(''));
 if(run&&message)store.dispatch(actions.message({id:createId(),role:'assistant',text:message}));
}
export function stopAnalysis(){cancel('Analysis stopped. You can refine your question and try again.');}
store.subscribe(()=>{
 if(!active)return;
 const state=store.getState();
 if(state.dataset!==active.dataset)cancel('Analysis stopped because the dataset changed. Ask your question again using the newly loaded CSV.');
 else if(!state.messages.some(m=>m.id===active?.messageId))cancel();
});
export async function startAnalysis(text:string):Promise<void>{
 if(active||!text.trim())return;
 const state=store.getState(),dataset=state.dataset;
 if(!dataset){toast.info('Load a CSV or the sample dataset first.');return;}
 const run:Run={controller:new AbortController(),dataset,messageId:createId()};
 const current=state.widgets.find(w=>w.id===state.selected);
 store.dispatch(actions.message({id:run.messageId,role:'user',text}));
 active=run;store.dispatch(actions.error(''));store.dispatch(actions.status('Preparing analysis'));
 const signal=run.controller.signal,isCurrent=()=>active===run&&!signal.aborted;
 try{
  const response=await provider.analyze({question:text,columns:dataset.columns,current:current?.spec},signal,stage=>{if(isCurrent())store.dispatch(actions.status(stage));});
  if(!isCurrent())return;
  store.dispatch(actions.status('Analysing the dataset'));
  const data=await dataClient.analyze(response.spec,signal);
  if(!isCurrent())return;
  const widgets=store.getState().widgets,target=response.update&&current?widgets.find(w=>w.id===current.id):undefined;
  if(response.update&&current&&!target)throw new Error('The selected chart was removed while analysis was running. Ask your question again.');
  const id=target?.id??createId();
  const widget=target?{...target,spec:response.spec}:{id,spec:response.spec,x:0,y:Math.max(0,...widgets.map(w=>w.y+w.h)),w:12,h:10};
  store.dispatch(actions.upsert(widget));store.dispatch(actions.result({id,data}));
  store.dispatch(actions.message({id:createId(),role:'assistant',text:response.text}));
  toast.success(response.update?'Chart updated':'Chart added to your dashboard');
 }catch(e){if(isCurrent()){const message=e instanceof Error?e.message:'Analysis failed. Please retry.';store.dispatch(actions.error(message));toast.error(message);}}
 finally{if(active===run){active=undefined;store.dispatch(actions.status(''));}}
}
