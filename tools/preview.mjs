import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,join,sep,extname,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from './build.mjs';
const root=await build();const port=Number(process.env.PORT||8787);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('PORT must be an integer between 1024 and 65535.');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.ico':'image/x-icon','.json':'application/json','.webmanifest':'application/manifest+json','.xml':'application/xml','.txt':'text/plain; charset=utf-8'};
const server=createServer(async(req,res)=>{
 try{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  const url=new URL(req.url,'http://127.0.0.1');const rel=decodeURIComponent(url.pathname).replace(/^\//,'')||'index.html';
  if(rel.split(/[\\/]/).some(s=>s.startsWith('.')||s==='_headers')){res.writeHead(404);res.end();return;}
  const path=resolve(root,rel);if(!path.startsWith(root+sep)){res.writeHead(403);res.end();return;}
  const info=await stat(path);if(!info.isFile()){res.writeHead(404);res.end();return;}
  const bytes=await readFile(path);res.writeHead(200,{'Content-Type':mime[extname(path)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(req.method==='HEAD'?undefined:bytes);
 }catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
});
server.on('error',err=>{console.error('Preview could not start:',err.message);process.exitCode=1;});
server.listen(port,'127.0.0.1',()=>console.log(`\nOpen http://127.0.0.1:${port}\nLocal preview is read-only; it may READ the current public Supabase catalog.\nPublic browser SDK/images require internet. No fake inventory is supplied.\nPress Ctrl+C to stop.\n`));
