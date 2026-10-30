import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { createApiHandler } from './api.ts';

const root=resolve('dist');
const api=createApiHandler(process.env.AI_STACK_BASE_URL||'http://72.62.135.252:8080');
const types:Record<string,string>={'.html':'text/html','.js':'application/javascript','.css':'text/css','.csv':'text/csv','.svg':'image/svg+xml','.png':'image/png','.json':'application/json'};
createServer((req,res)=>{
 void api(req,res,()=>{void (async()=>{
  try{
   if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
   const pathname=decodeURIComponent(new URL(req.url||'/', 'http://localhost').pathname);
   const path=resolve(root,'.'+pathname);
   if(path!==root&&!path.startsWith(root+sep)){res.writeHead(403);res.end();return;}
   let file=path;let content:Buffer;
   try{content=await readFile(file);}catch{if(extname(path)){res.writeHead(404);res.end();return;}file=resolve(root,'index.html');content=await readFile(file);}
   res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:content);
  }catch{res.writeHead(500);res.end('Build the application before starting the server.');}
 })();});
}).listen(Number(process.env.PORT||3000),process.env.HOST||'127.0.0.1',()=>console.log(`InsightFlow listening on http://${process.env.HOST||'127.0.0.1'}:${process.env.PORT||3000}`));
