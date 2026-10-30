import { useEffect, useRef, useState } from 'react';
import { shallowEqual } from 'react-redux';
import GridLayout from 'react-grid-layout';
import { LayoutDashboard, Plus, Undo2, Sparkles } from 'lucide-react';
import { ChartWidget } from './ChartWidget';
import { Upload } from './Upload';
import { Button } from './ui/button';
import { actions, useAppDispatch, useAppSelector } from '../state/store';
import { dataClient } from '../services/worker';
import { validateSpec } from '../core/schema';
export function Canvas(){
 const {widgets,dataset,undo}=useAppSelector(s=>({widgets:s.widgets,dataset:s.dataset,undo:s.undo}),shallowEqual),dispatch=useAppDispatch();const ref=useRef<HTMLDivElement>(null),[width,setWidth]=useState(800),[errors,setErrors]=useState<Record<string,string>>({});
 useEffect(()=>{const observer=new ResizeObserver(entries=>setWidth(entries[0].contentRect.width));if(ref.current)observer.observe(ref.current);return()=>observer.disconnect();},[]);
 const signature=JSON.stringify(widgets.map(w=>({id:w.id,spec:w.spec})));
 useEffect(()=>{const controller=new AbortController();setErrors({});if(dataset)for(const w of widgets){try{validateSpec(w.spec,dataset.columns);dataClient.analyze(w.spec,controller.signal).then(data=>{if(!controller.signal.aborted)dispatch(actions.result({id:w.id,data}));}).catch(e=>{if(!controller.signal.aborted)setErrors(prev=>({...prev,[w.id]:e.message}));});}catch(e){setErrors(prev=>({...prev,[w.id]:(e as Error).message}));}}return()=>controller.abort();},[signature,dataset,dispatch]);
 const narrow=width<650;
 return <section className="canvas-panel"><div className="panel-heading"><div><span className="eyebrow">YOUR WORKSPACE</span><h2>Dashboard canvas <span className="count-badge">{widgets.length}</span></h2></div><Button variant="ghost" size="sm" disabled={!undo.length} onClick={()=>dispatch(actions.undo())}><Undo2 size={15}/>Undo</Button></div>
 <div className="canvas-scroll" ref={ref}>{!dataset?<Upload/>:!widgets.length?<div className="canvas-empty"><div className="empty-grid"><LayoutDashboard size={32}/><Plus size={16}/></div><h2>Your next insight starts here</h2><p>Ask a question on the left. We’ll turn your data<br/>into a chart you can explore, adjust, and save.</p><div className="empty-example"><Sparkles size={16}/><span>Try “Show total revenue by region”</span></div><small>Powered by your data. Not guesswork.</small></div>:<GridLayout width={width} cols={narrow?1:12} rowHeight={30} margin={[16,16]} containerPadding={[0,0]} draggableHandle=".drag-handle" draggableCancel="button,select" isDraggable={!narrow} isResizable={!narrow} layout={widgets.map(w=>({i:w.id,x:narrow?0:w.x,y:narrow?widgets.indexOf(w)*12:w.y,w:narrow?1:w.w,h:w.h,minW:narrow?1:5,minH:10}))} onLayoutChange={layout=>{if(!narrow)dispatch(actions.layout(layout));}}>{widgets.map(w=><div key={w.id}><ChartWidget widget={w} error={!dataset?'Load the matching CSV to calculate this chart.':errors[w.id]}/></div>)}</GridLayout>}</div>
 <div className="canvas-note"><span className="privacy-dot"/>Private by design · Data processing happens on your device<span>Drag to arrange · Resize from corners</span></div></section>;
}
