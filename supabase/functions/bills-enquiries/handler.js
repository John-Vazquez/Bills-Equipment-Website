/** Public enquiry endpoint. All database access is server-side; never import this into the storefront. */
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const encoder=new TextEncoder();
export class RequestError extends Error{constructor(message,status=400){super(message);this.status=status;}}
function text(value,name,min,max){if(typeof value!=='string')throw new RequestError(`Enter a valid ${name}.`);const s=value.trim();if(s.length<min||s.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(s))throw new RequestError(`Enter a valid ${name}.`);return s;}
function date(value){if(value===null||value===undefined||value==='')return null;if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)throw new RequestError('Enter valid rental dates.');return value;}
export function validateSubmission(body,now=new Date()){
 if(!body||typeof body!=='object'||Array.isArray(body))throw new RequestError('Invalid enquiry.');
 if(body.website)throw new RequestError('The request could not be accepted.');
 if(!UUID.test(body.submission_id||''))throw new RequestError('Refresh the form and try again.');
 if(body.consent!==true)throw new RequestError('Consent to being contacted is required.');
 const c=body.customer;if(!c||typeof c!=='object'||Array.isArray(c))throw new RequestError('Contact information is required.');
 const customer={name:text(c.name,'name',1,120),email:text(c.email,'email address',3,254).toLowerCase(),phone:text(c.phone,'phone number',7,40),company:text(c.company??'','company',0,160)};
 if(!EMAIL.test(customer.email)||/[\r\n]/.test(customer.email)||/[\r\n]/.test(customer.phone)||customer.phone.replace(/\D/g,'').length<7)throw new RequestError('Enter a valid email address and phone number.');
 const message=text(body.message??'','message',0,5000);
 if(!Array.isArray(body.items)||body.items.length>50)throw new RequestError('A request can contain up to 50 items.');
 const seen=new Set();const items=body.items.map(item=>{
  if(!item||!UUID.test(item.product_id||'')||!['sale','rental'].includes(item.mode)||!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>99)throw new RequestError('Invalid item or quantity. Refresh the cart.');
  const product_id=item.product_id.toLowerCase(),key=product_id+':'+item.mode;if(seen.has(key))throw new RequestError('Remove duplicate items from the cart.');seen.add(key);
  // The database, not this request, supplies name, price and availability.
  return {product_id,mode:item.mode,quantity:item.quantity};
 }).sort((a,b)=>a.product_id.localeCompare(b.product_id)||a.mode.localeCompare(b.mode));
 const hasRental=items.some(i=>i.mode==='rental'),hasSale=items.some(i=>i.mode==='sale');
 const kind=items.length?(hasRental?(hasSale?'mixed':'rental'):'quote'):'contact';
 if(body.kind!==kind)throw new RequestError('The request type does not match the selected items.');
 if(kind==='contact'&&message.length<10)throw new RequestError('Add a message of at least 10 characters.');
 const start_date=date(body.start_date),end_date=date(body.end_date);
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 if(hasRental&&(!start_date||!end_date||start_date<today||end_date<start_date))throw new RequestError('Select valid rental start and end dates.');
 if(!hasRental&&(start_date||end_date))throw new RequestError('Rental dates require a rental item.');
 const token=text(body.turnstile_token,'security check',1,2048);
 return {submission_id:body.submission_id.toLowerCase(),turnstile_token:token,payload:{kind,customer,message,items,start_date,end_date,consent:true}};
}
export async function digest(value,cryptoAPI=globalThis.crypto){return [...new Uint8Array(await cryptoAPI.subtle.digest('SHA-256',encoder.encode(value)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function emailHash(email,salt,cryptoAPI){const key=await cryptoAPI.subtle.importKey('raw',encoder.encode(salt),{name:'HMAC',hash:'SHA-256'},false,['sign']);return [...new Uint8Array(await cryptoAPI.subtle.sign('HMAC',key,encoder.encode(email)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function limitedJSON(request,max=40000){
 if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new RequestError('Send JSON content.',415);
 if(Number(request.headers.get('content-length')||0)>max)throw new RequestError('Request too large.',413);
 if(!request.body)throw new RequestError('Empty request.');
 const reader=request.body.getReader(),chunks=[];let total=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>max){await reader.cancel();throw new RequestError('Request too large.',413);}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(total);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}
 try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{throw new RequestError('Invalid JSON.');}
}
function csv(v){return (v||'').split(',').map(s=>s.trim()).filter(Boolean);}
/** Dependency injection keeps tests isolated from live Supabase, email and CAPTCHA. */
export function createHandler({env,fetchImpl=globalThis.fetch,cryptoAPI=globalThis.crypto,now=()=>new Date(),log=()=>{}}){
 const get=n=>typeof env==='function'?env(n):env[n];
 const base=(get('SUPABASE_URL')||'').replace(/\/$/,'');
 const service=get('SUPABASE_SERVICE_ROLE_KEY')||'';
 const origins=new Set(csv(get('BILLS_ALLOWED_ORIGINS'))),hosts=new Set(csv(get('TURNSTILE_ALLOWED_HOSTNAMES')).map(s=>s.toLowerCase()));
 const salt=get('RATE_LIMIT_SALT')||'',secret=get('TURNSTILE_SECRET_KEY')||'';
 const resend=get('RESEND_API_KEY')||'',from=get('BILLS_MAIL_FROM')||'',recipients=csv(get('BILLS_NOTIFY_TO'));
 const coreConfigured=/^https:\/\/[^/]+\.supabase\.co$/.test(base)&&!!service&&origins.size>0&&hosts.size>0&&!!secret&&salt.length>=32;
 const notificationConfigured=!!resend&&!!from&&!/[\r\n]/.test(from)&&recipients.length>0&&recipients.length<=5&&recipients.every(v=>EMAIL.test(v)&&!/[\r\n]/.test(v));
 const configured=coreConfigured&&notificationConfigured;
 async function fetchJSON(url,options={},ms=6500){const response=await fetchImpl(url,{...options,signal:AbortSignal.timeout(ms)});const data=await response.json().catch(()=>null);return {response,data};}
 async function db(path,method='GET',body,extra={}){
  const result=await fetchJSON(base+'/rest/v1/'+path,{method,headers:{apikey:service,Authorization:'Bearer '+service,'Content-Type':'application/json',...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
  if(!result.response.ok){const error=new Error('Database request failed.');error.code=result.data?.code;error.publicMessage=result.data?.code==='P0001'?result.data?.message:null;throw error;}return result.data;
 }
 async function readiness(){if(!configured)return {configured:false,ready:false};try{const [version,settings]=await Promise.all([db('bills_schema_version?select=version&id=eq.true'),db('bills_site_settings?select=enquiries_enabled,turnstile_site_key&id=eq.true')]);return {configured:true,ready:version?.[0]?.version===2&&settings?.[0]?.enquiries_enabled===true&&!!settings?.[0]?.turnstile_site_key};}catch{return {configured:true,ready:false};}}
 async function notify(id){
  let claim;
  try{
   if(!notificationConfigured)return 'pending';
   claim=await db('rpc/bills_claim_notification','POST',{p_id:id});if(!claim)return 'unchanged';
   const lines=(claim.items||[]).map(i=>`${i.quantity} × ${i.product_name} (${i.mode})${i.sku?' | SKU: '+i.sku:''}${i.model?' | Model: '+i.model:''}${i.listed_price!==null&&i.listed_price!==undefined?' | Listed price: $'+Number(i.listed_price).toFixed(2):' | Price to confirm'}`);
   const body={from,to:recipients,reply_to:claim.customer_email,subject:`Bill's Equipment — ${claim.reference} — ${claim.kind} enquiry`,text:[`New enquiry: ${claim.reference}`,`Name: ${claim.customer_name}`,`Company: ${claim.company||'—'}`,`Email: ${claim.customer_email}`,`Phone: ${claim.customer_phone}`,claim.start_date?`Requested rental dates: ${claim.start_date} to ${claim.end_date}`:'',...lines,'',claim.message||'', '', 'This is an enquiry, not a paid order or confirmed rental. Review it in the website employee manager.'].filter(v=>v!==null).join('\n')};
   const {response,data}=await fetchJSON('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+resend,'Content-Type':'application/json','Idempotency-Key':'bills-enquiry/'+id},body:JSON.stringify(body)},6500);
   if(!response.ok||!data?.id)throw new Error('Email provider did not confirm acceptance.');
   // Sent means accepted by provider, NOT delivered to an inbox. Delivery must be checked separately.
   await db('bills_enquiries?id=eq.'+encodeURIComponent(id),'PATCH',{notification_status:'sent',notification_sent_at:now().toISOString(),notification_error:null},{Prefer:'return=minimal'});
   return 'sent';
  }catch{
   log('notification_unconfirmed',{enquiry_id:id});
   if(claim)try{await db('bills_enquiries?id=eq.'+encodeURIComponent(id),'PATCH',{notification_status:'failed',notification_error:'Email acceptance could not be confirmed. Staff may retry within 23 hours; check delivery before retrying an older request.'},{Prefer:'return=minimal'});}catch{/* Enquiry remains stored. A fresh claim expires after two minutes. */}
   return 'failed';
  }
 }
 async function requireStaff(request){
  const authorization=request.headers.get('authorization')||'';if(!/^Bearer \S+$/i.test(authorization))throw new RequestError('Employee login required.',401);
  const {response,data}=await fetchJSON(base+'/auth/v1/user',{headers:{apikey:service,Authorization:authorization}});
  if(!response.ok||!UUID.test(data?.id||''))throw new RequestError('Employee login required.',401);
  const profiles=await db('admin_profiles?select=id,active,role&id=eq.'+encodeURIComponent(data.id));
  if(!profiles?.some(p=>p.active===true&&['admin','editor'].includes(p.role)))throw new RequestError('Employee access required.',403);
 }
 return async function handler(request){
  const origin=request.headers.get('origin')||'';
  const allowed=origins.has(origin);
  const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin','X-Content-Type-Options':'nosniff',...(allowed?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'content-type, authorization, apikey, x-client-info','Access-Control-Max-Age':'600'}:{})};
  const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
  if(!allowed)return respond({message:'Origin not permitted.'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(request.method==='GET')return respond(await readiness());
  if(request.method!=='POST')return respond({message:'Method not allowed.'},405);
  if(!coreConfigured)return respond({message:'Online submission is not configured. Please contact Bill’s directly.'},503);
  try{
   const body=await limitedJSON(request);
   if(body?.action==='retry_notification'){
    await requireStaff(request);if(!UUID.test(body.enquiry_id||''))throw new RequestError('Invalid enquiry.');
    if(!notificationConfigured)throw new RequestError('Email notifications are not configured.',503);
    const status=await notify(body.enquiry_id);return respond({notification_status:status,message:status==='sent'?'The email provider accepted the notification. Inbox delivery is not verified.':'No new email acceptance was confirmed. Check the enquiry notification status.'});
   }
   const checked=validateSubmission(body,now());
   const {response,data:captcha}=await fetchJSON('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({secret,response:checked.turnstile_token,idempotency_key:await tokenAttemptId(checked.submission_id,checked.turnstile_token,cryptoAPI)})});
   if(!response.ok||captcha?.success!==true||captcha.action!=='enquiry'||!hosts.has(String(captcha.hostname||'').toLowerCase())||String(captcha.hostname||'').toLowerCase()!==new URL(origin).hostname.toLowerCase())throw new RequestError('The security check expired or failed. Complete it again and retry.',400);
   const p=checked.payload;
   const fingerprint=await digest(JSON.stringify(p),cryptoAPI),email_hash=await emailHash(p.customer.email,salt,cryptoAPI);
   const saved=await db('rpc/bills_submit_enquiry','POST',{p_submission_id:checked.submission_id,p_fingerprint:fingerprint,p_customer:p.customer,p_kind:p.kind,p_message:p.message,p_items:p.items,p_start_date:p.start_date,p_end_date:p.end_date,p_email_hash:email_hash});
   if(!UUID.test(saved?.id||'')||!/^BE-[A-F0-9]{12}$/.test(saved?.reference||''))throw new Error('The server did not return a receipt.');
   const notification_status=await notify(saved.id);
   return respond({reference:saved.reference,received:true,duplicate:!!saved.duplicate,notification_status},saved.duplicate?200:201);
  }catch(error){
   if(error instanceof RequestError)return respond({message:error.message},error.status);
   if(error.code==='P0429')return respond({message:'Too many requests. Please call Bill’s or try again later.'},429);
   const allowedDBMessages=['A requested item is no longer available. Refresh your cart.','An item is information-only. Remove it and contact Bill’s.','A requested item is not available for the selected sale/rental type.','Online requests are not enabled.','Valid rental start and end dates are required.','Request token was used for different details.'];
   if(allowedDBMessages.includes(error.publicMessage))return respond({message:error.publicMessage},409);
   log('request_unconfirmed',{code:error.code||'upstream_failure'});
   return respond({message:'We could not confirm your request. Your form details have been kept. Retry with the same details or contact Bill’s directly.'},503);
  }
 };
}
/** Stable per-token UUID: a new CAPTCHA on a submission retry gets a different Siteverify key. */
async function tokenAttemptId(id,token,cryptoAPI){const h=await digest(id+':'+token,cryptoAPI);return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;}
