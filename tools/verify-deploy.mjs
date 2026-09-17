/** Read-only verification. Never publishes, changes DNS or sends credentials. */
import {readFile,readdir} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
export function siteURL(value){
 const url=new URL(value);
 if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw new Error('Use the HTTPS site address, without credentials, a query or a fragment.');
 if(!url.pathname.endsWith('/'))url.pathname+='/';return url;
}
export function hash(bytes){return createHash('sha256').update(bytes).digest('hex');}
export async function verify(value,fetcher=fetch){
 const base=siteURL(value);const dist=join(root,'dist');
 const expected=JSON.parse(await readFile(join(dist,'version.json'),'utf8').catch(()=>{throw new Error('Build the site first: npm run build');}));
 async function request(path){
  const url=new URL(path.split('/').map(encodeURIComponent).join('/'),base);url.searchParams.set('bills_verify',expected.release);
  const response=await fetcher(url,{redirect:'manual',signal:AbortSignal.timeout(12000),headers:{'Cache-Control':'no-cache'}});
  if(response.status>=300&&response.status<400)throw new Error(`${path}: redirected. Use the final HTTPS host address and disable HTML fallbacks for asset paths.`);
  if(!response.ok)throw new Error(`${path}: HTTP ${response.status}`);return response;
 }
 const version=await(await request('version.json')).json();
 if(version.release!==expected.release||version.content_sha256!==expected.content_sha256)throw new Error('The deployed version does not match this local build. Nothing was changed.');
 const paths=[];async function walk(dir,prefix=''){for(const entry of await readdir(dir,{withFileTypes:true})){if(entry.isDirectory())await walk(join(dir,entry.name),prefix+entry.name+'/');else if(!['version.json','_headers'].includes(prefix+entry.name))paths.push(prefix+entry.name);}}
 await walk(dist);const failures=[];let checked=0;let headersPresent=false;
 // Bound requests to four concurrent GETs. Compare bytes, not only HTTP success.
 let next=0;await Promise.all(Array.from({length:4},async()=>{while(next<paths.length){const path=paths[next++];try{const response=await request(path);const actual=new Uint8Array(await response.arrayBuffer());if(hash(actual)!==hash(await readFile(join(dist,path))))throw new Error(`${path}: content differs from the local build`);if(path==='index.html')headersPresent=!!response.headers.get('content-security-policy');checked++;}catch(error){failures.push(error.message);}}}));
 if(failures.length)throw new Error(`${checked}/${paths.length} public files matched.\n${failures.join('\n')}`);
 return {release:expected.release,files_verified:checked,security_headers_observed:headersPresent,url:base.href};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const value=process.argv.slice(2).find(x=>x.startsWith('--url='))?.slice(6)||process.argv[2]||'https://www.billsequipmentandrentals.com/';const result=await verify(value);console.log(JSON.stringify(result,null,2));if(!result.security_headers_observed)console.warn('WARNING: Content-Security-Policy was not returned. Configure the host to apply dist/_headers or an equivalent policy.');console.log('File deployment verified. This does not verify Supabase permissions, form delivery, payments or DNS ownership.');}
 catch(error){console.error(error.message);process.exitCode=1;}
}
