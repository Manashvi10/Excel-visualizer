import { useEffect, useRef, useState } from 'react';
import { shallowEqual } from 'react-redux';
import { Sparkles, ArrowUp, Square, Trash2, RotateCcw, ArrowRight, Check, MessageSquareText } from 'lucide-react';
import { toast } from 'sonner';
import { actions, store, useAppDispatch, useAppSelector } from '../state/store';
import { provider, suggestions, isMock } from '../providers/ai';
import { dataClient } from '../services/worker';
import { Button } from './ui/button';
export function Assistant(){
 const {dataset,messages,status,error,selected,widgets}=useAppSelector(s=>({dataset:s.dataset,messages:s.messages,status:s.status,error:s.error,selected:s.selected,widgets:s.widgets}),shallowEqual),dispatch=useAppDispatch();const [question,setQuestion]=useState(''),[last,setLast]=useState('');const controller=useRef<AbortController|null>(null),end=useRef<HTMLDivElement>(null);
 useEffect(()=>{end.current?.scrollIntoView({behavior:'instant'});},[messages,status,error]);
 useEffect(()=>()=>controller.current?.abort(),[]);
 useEffect(()=>{controller.current?.abort();controller.current=null;dispatch(actions.status(''));},[dataset,dispatch]);
 async function submit(text:string){
  if(controller.current||!text.trim())return;if(!dataset){toast.info('Load a CSV or the sample dataset first.');return;}
  const abort=new AbortController();controller.current=abort;setLast(text);setQuestion('');dispatch(actions.error(''));dispatch(actions.message({id:crypto.randomUUID(),role:'user',text}));
  try{
   const state=store.getState(),current=state.widgets.find(w=>w.id===state.selected);
   const response=await provider.analyze({question:text,columns:dataset.columns,current:current?.spec},abort.signal,s=>{if(!abort.signal.aborted)dispatch(actions.status(s));});
   if(abort.signal.aborted)return;dispatch(actions.status('Analysing the dataset'));const data=await dataClient.analyze(response.spec,abort.signal);if(abort.signal.aborted)return;
   const id=response.update&&current?current.id:crypto.randomUUID();
   const widget=response.update&&current?{...current,spec:response.spec}:{id,spec:response.spec,x:0,y:Math.max(0,...state.widgets.map(w=>w.y+w.h)),w:12,h:10};
   dispatch(actions.upsert(widget));dispatch(actions.result({id,data}));dispatch(actions.message({id:crypto.randomUUID(),role:'assistant',text:response.text}));toast.success(response.update?'Chart updated':'Chart added to your dashboard');
  }catch(e){if(!abort.signal.aborted)dispatch(actions.error((e as Error).message));}
  finally{if(controller.current===abort){controller.current=null;dispatch(actions.status(''));}}
 }
 function stop(){controller.current?.abort();controller.current=null;dispatch(actions.status(''));dispatch(actions.message({id:crypto.randomUUID(),role:'assistant',text:'Analysis stopped. You can refine your question and try again.'}));}
 const current=widgets.find(w=>w.id===selected);
 return <aside className="assistant-panel"><header className="assistant-header"><div className="assistant-avatar"><Sparkles size={19}/></div><div><h2>AI data analyst</h2><p><span className="privacy-dot"/>{isMock?'Local demo assistant':'Server-connected assistant'}</p></div><Button variant="ghost" size="icon" title="Clear conversation" aria-label="Clear conversation" disabled={!messages.length||!!status} onClick={()=>{if(window.confirm('Clear this conversation? Your charts will stay.')){dispatch(actions.clear());dispatch(actions.error(''));}}}><Trash2 size={16}/></Button></header>
 <div className="conversation" aria-live="polite">{!messages.length?<div className="assistant-welcome"><span className="welcome-icon"><Sparkles size={26}/></span><h2>What would you like<br/>to discover?</h2><p>Ask questions in plain English.<br/>Get clear answers, built from your data.</p><span className="eyebrow">A FEW IDEAS TO GET STARTED</span><div className="suggestions">{suggestions.slice(0,4).map((s,i)=><button key={s} disabled={!!status} onClick={()=>void submit(s)}><span className={`prompt-icon p${i}`}><MessageSquareText size={15}/></span>{s}<ArrowRight size={14}/></button>)}</div><div className="demo-note"><Sparkles size={14}/><p><strong>{isMock?'A transparent demo':'Live AI, local calculations'}</strong><br/>{isMock?'Deterministic rules, not a live LLM. Your questions and data stay local.':'Your question, column names and current chart are sent to the AI service. CSV rows stay on this device.'}</p></div></div>:messages.map(m=><div key={m.id} className={`message ${m.role}`}><span className="message-label">{m.role==='user'?'You':<><Sparkles size={12}/>InsightFlow</>}</span><p>{m.text}</p>{m.role==='assistant'&&<span className="message-done"><Check size={12}/>Processed locally</span>}</div>)}{status&&<div className="analysis-stage" role="status"><span className="pulse"/>{status}…</div>}{error&&<div className="chat-error" role="alert"><strong>Let’s try that another way</strong><p>{error}</p><Button variant="outline" size="sm" onClick={()=>void submit(last)}><RotateCcw size={13}/>Retry</Button></div>}<div ref={end}/></div>
 <div className="composer-wrap">{current&&<div className="context-tag"><span className="privacy-dot"/>Following up on: <strong>{current.spec.title}</strong></div>}<form className="composer" onSubmit={e=>{e.preventDefault();void submit(question);}}><textarea aria-label="Ask about your data" placeholder={dataset?'Ask a question about your data…':'Load a dataset to start exploring…'} value={question} onChange={e=>setQuestion(e.target.value)} disabled={!!status} rows={2} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void submit(question);}}}/><div className="composer-footer"><span>Shift + Enter for a new line</span>{status?<Button type="button" size="icon" aria-label="Stop generation" title="Stop generation" onClick={stop}><Square size={14}/></Button>:<Button type="submit" size="icon" aria-label="Send question" title="Send question" disabled={!question.trim()||!dataset}><ArrowUp size={18}/></Button>}</div></form><small className="composer-disclaimer">{isMock?'Demo mode · No external AI requests':'AI suggestions are validated before execution'} · Verify important results</small></div></aside>;
}
