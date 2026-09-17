import {SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY} from '../supabase-config.js';
let promise;
/** Shared lazy client: a CDN/network failure does not remove the site's static header or contact details. */
export function getClient() {
  if(!promise) promise=(async()=>{
    if(!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY || /sb_secret_|service_role/.test(SUPABASE_PUBLISHABLE_KEY)) throw new Error('Public Supabase configuration is missing or unsafe.');
    if(!globalThis.supabase?.createClient) await new Promise((resolve,reject)=>{
      const script=document.createElement('script');script.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/dist/umd/supabase.js';script.crossOrigin='anonymous';
      const timeout=setTimeout(()=>{script.remove();reject(new Error('The catalog connection timed out. Please retry.'));},15000);
      script.onload=()=>{clearTimeout(timeout);resolve();};script.onerror=()=>{clearTimeout(timeout);script.remove();reject(new Error('The catalog library could not load. Check your connection and retry.'));};document.head.append(script);
    });
    const client=globalThis.supabase.createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
    return client;
  })().catch(e=>{promise=null;throw e;});
  return promise;
}
export const imageURL=(bucket,path)=>path ? `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${String(path).split('/').map(encodeURIComponent).join('/')}` : 'assets/equipment-placeholder.svg';
export const functionURL=()=>`${SUPABASE_URL}/functions/v1/bills-enquiries`;
