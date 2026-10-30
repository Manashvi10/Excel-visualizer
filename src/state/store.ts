import { configureStore, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';
import type { ChartData, Dataset } from '../core/schema';
import { readState, writeState, type Dashboard, type Widget } from '../services/persistence';
const initial=readState();
type Message={id:string;role:'user'|'assistant';text:string};
const slice=createSlice({name:'app',initialState:{...initial,dataset:null as Dataset|null,results:{} as Record<string,ChartData>,selected:null as string|null,status:'',error:'',undo:[] as Widget[][]},reducers:{
 dataset(s,a:PayloadAction<Dataset>){s.dataset=a.payload;s.results={};s.error='';},
 resetDataset(s){s.dataset=null;s.results={};s.status='';},
 theme(s){s.theme=s.theme==='light'?'dark':'light';},
 message(s,a:PayloadAction<Message>){s.messages.push(a.payload);s.messages=s.messages.slice(-40);},clear(s){s.messages=[];},
 status(s,a:PayloadAction<string>){s.status=a.payload;},error(s,a:PayloadAction<string>){s.error=a.payload;},
 upsert(s,a:PayloadAction<Widget>){s.undo=[s.widgets.map(w=>({...w})),...s.undo].slice(0,10);const i=s.widgets.findIndex(w=>w.id===a.payload.id);if(i<0)s.widgets.push(a.payload);else s.widgets[i]=a.payload;s.selected=a.payload.id;},
 result(s,a:PayloadAction<{id:string;data:ChartData}>){s.results[a.payload.id]=a.payload.data;},
 remove(s,a:PayloadAction<string>){s.undo=[s.widgets,...s.undo].slice(0,10);s.widgets=s.widgets.filter(w=>w.id!==a.payload);delete s.results[a.payload];if(s.selected===a.payload)s.selected=null;},
 select(s,a:PayloadAction<string>){s.selected=a.payload;},
 layout(s,a:PayloadAction<{i:string;x:number;y:number;w:number;h:number}[]>){for(const l of a.payload){const w=s.widgets.find(w=>w.id===l.i);if(w)Object.assign(w,{x:l.x,y:l.y,w:l.w,h:l.h});}},
 restore(s,a:PayloadAction<Widget[]>){s.undo=[s.widgets,...s.undo].slice(0,10);s.widgets=a.payload;s.results={};s.selected=a.payload[0]?.id??null;},
 undo(s){const prev=s.undo.shift();if(prev){s.widgets=prev;s.results={};}},
 save(s,a:PayloadAction<Dashboard>){const i=s.saved.findIndex(d=>d.id===a.payload.id);if(i<0)s.saved.push(a.payload);else s.saved[i]=a.payload;},
 deleteSaved(s,a:PayloadAction<string>){s.saved=s.saved.filter(d=>d.id!==a.payload);}
}});
export const actions=slice.actions;
export const store=configureStore({reducer:slice.reducer});
let timer:ReturnType<typeof setTimeout>;
let storageWarning=false;
store.subscribe(()=>{clearTimeout(timer);timer=setTimeout(()=>{const s=store.getState();if(!writeState({version:1,theme:s.theme,widgets:s.widgets,saved:s.saved,messages:s.messages})&&!storageWarning){storageWarning=true;window.dispatchEvent(new Event('storage-failed'));}},250);});
export type RootState=ReturnType<typeof store.getState>;
export const useAppSelector=useSelector.withTypes<RootState>();
export const useAppDispatch=useDispatch.withTypes<typeof store.dispatch>();
