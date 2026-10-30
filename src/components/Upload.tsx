import { useRef, useState } from 'react';
import { UploadCloud, FileSpreadsheet, Download, LoaderCircle, X } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { dataClient } from '../services/worker';
import { localFiles } from '../services/persistence';
import { actions, store, useAppDispatch } from '../state/store';
let active:AbortController|undefined;
export function Upload({compact=false}:{compact?:boolean}){
 const input=useRef<HTMLInputElement>(null),dispatch=useAppDispatch();const [busy,setBusy]=useState(false),[progress,setProgress]=useState(0),[error,setError]=useState(''),[remember,setRemember]=useState(false);
 async function load(file:File){
  if(!file.name.toLowerCase().endsWith('.csv')){setError('Please choose a .csv file.');return;}
  if(store.getState().dataset&&!window.confirm('Replace the active dataset? Existing charts will recalculate against the new columns.'))return;
  active?.abort();dataClient.reset();dispatch(actions.resetDataset());const controller=new AbortController();active=controller;setBusy(true);setError('');setProgress(0);
  try{const dataset=await dataClient.parse(file,controller.signal,setProgress);if(controller.signal.aborted)return;dispatch(actions.dataset(dataset));if(remember){try{await localFiles.files.put({id:'remembered',file});toast.success('CSV remembered on this device.');}catch{toast.error('Dataset loaded, but device storage failed.');}}toast.success(`${dataset.rows.toLocaleString()} rows ready to explore`);}
  catch(e){if(!controller.signal.aborted)setError(e instanceof Error?e.message:'Unable to load file.');}
  finally{if(active===controller){setBusy(false);active=undefined;}}
 }
 async function sample(){try{const response=await fetch('/sample-data/sales-demo.csv');if(!response.ok)throw new Error('Sample file could not be loaded.');await load(new File([await response.blob()],'sales-demo.csv',{type:'text/csv'}));}catch(e){setError((e as Error).message);}}
 return <div className={compact?'upload-compact':'upload-card'} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();if(e.dataTransfer.files[0])void load(e.dataTransfer.files[0]);}}>
  <input ref={input} type="file" accept=".csv,text/csv" className="sr-only" aria-label="Upload CSV file" onChange={e=>{if(e.target.files?.[0])void load(e.target.files[0]);e.target.value='';}}/>
  {!compact&&<><span className="upload-symbol"><UploadCloud size={28}/></span><h2>A little data. A lot of possibilities.</h2><p>Drop a CSV here to turn your questions into insights.<br/>Your data stays in your browser.</p></>}
  <div className="upload-actions"><Button variant={compact?'outline':'default'} onClick={()=>input.current?.click()} disabled={busy}><UploadCloud size={16}/>{busy?`Parsing ${progress}%`:'Upload CSV'}</Button>{!compact&&<Button variant="outline" onClick={()=>void sample()} disabled={busy}><FileSpreadsheet size={16}/>Load sample data</Button>}{busy&&<Button variant="ghost" aria-label="Cancel upload" onClick={()=>{active?.abort();dataClient.reset();setBusy(false);}}><X size={16}/></Button>}</div>
  {!compact&&<><label className="remember"><input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/> Remember this CSV on this device (optional)</label><a className="text-link" href="/sample-data/sales-demo.csv" download><Download size={13}/> Download sample CSV · 1,200 rows</a><small>CSV format · ISO dates (YYYY-MM-DD) · No account or API key needed</small></>}
  {busy&&<div role="status" className="muted"><LoaderCircle size={14} className="spin"/> Reading file in a dedicated worker…</div>}{error&&<p role="alert" className="error">{error}</p>}
 </div>;
}
