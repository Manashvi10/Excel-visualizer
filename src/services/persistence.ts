import { z } from 'zod';
import Dexie, { type Table } from 'dexie';
import { analysisSchema } from '../core/schema';
export const widgetSchema=z.object({id:z.string(),spec:analysisSchema,x:z.number(),y:z.number(),w:z.number(),h:z.number()});
export type Widget=z.infer<typeof widgetSchema>;
export const dashboardSchema=z.object({id:z.string(),name:z.string().min(1).max(100),widgets:z.array(widgetSchema).max(40),datasetName:z.string().optional(),updated:z.string()});
export type Dashboard=z.infer<typeof dashboardSchema>;
const persistedSchema=z.object({version:z.literal(1),theme:z.enum(['light','dark']),widgets:z.array(widgetSchema).max(40),saved:z.array(dashboardSchema).max(50),messages:z.array(z.object({id:z.string(),role:z.enum(['user','assistant']),text:z.string()})).max(40)});
export type Persisted=z.infer<typeof persistedSchema>;
export const storageKey='insightflow:v1';
export function readState():Persisted {const fallback:Persisted={version:1,theme:'light',widgets:[],saved:[],messages:[]};try{const raw=localStorage.getItem(storageKey);return raw?persistedSchema.parse(JSON.parse(raw)):fallback;}catch{return fallback;}}
export function writeState(value:Persisted){try{localStorage.setItem(storageKey,JSON.stringify(persistedSchema.parse(value)));return true;}catch{return false;}}
class LocalFiles extends Dexie { files!:Table<{id:string;file:File},string>;constructor(){super('insightflow-files');this.version(1).stores({files:'id'});} }
export const localFiles=new LocalFiles();
export function encodeShare(dashboard:Dashboard){return btoa(Array.from(new TextEncoder().encode(JSON.stringify(dashboard)),c=>String.fromCharCode(c)).join(''));}
export function decodeShare(value:string){if(value.length>100000)throw new Error('Configuration is too large.');return dashboardSchema.parse(JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(value),c=>c.charCodeAt(0)))));}
