import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(fileURLToPath(new URL('../',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.wasm':'application/wasm'};
export function createStaticServer(){return http.createServer(async(req,res)=>{
 try{
  const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
  const local=resolve(root,'.'+pathname);
  if(local!==root&&!local.startsWith(root+sep)){res.writeHead(403);res.end('Forbidden');return}
  let full=local;const s=await stat(full);if(s.isDirectory())full=resolve(full,'index.html');
  const data=await readFile(full);res.writeHead(200,{'Content-Type':types[extname(full)]||'application/octet-stream','Cache-Control':'no-cache','Access-Control-Allow-Origin':'*'});res.end(data);
 }catch{res.writeHead(404);res.end('Not found')}})}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const port=Number(process.env.PORT||4173);createStaticServer().listen(port,'127.0.0.1',()=>console.log(`Tools dashboard: http://127.0.0.1:${port}/`));
}
