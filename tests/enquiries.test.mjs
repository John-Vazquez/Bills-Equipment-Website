import test from 'node:test';import assert from 'node:assert/strict';import {webcrypto} from 'node:crypto';
import {createHandler,validateSubmission,digest} from '../supabase/functions/bills-enquiries/handler.js';
const id='10000000-0000-4000-8000-000000000001',origin='https://bills.test',now=new Date('2026-09-17T16:00:00Z');
const env={SUPABASE_URL:'https://fixture.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'TEST_ONLY',BILLS_ALLOWED_ORIGINS:origin,TURNSTILE_ALLOWED_HOSTNAMES:'bills.test',RATE_LIMIT_SALT:'a'.repeat(40),TURNSTILE_SECRET_KEY:'TEST_ONLY',RESEND_API_KEY:'TEST_ONLY',BILLS_MAIL_FROM:'Bill <website@bills.test>',BILLS_NOTIFY_TO:'employee@bills.test'};
const body=()=>({submission_id:id,kind:'quote',customer:{name:'Test Customer',email:'test@example.com',phone:'3055550100',company:''},message:'Please confirm availability.',items:[{product_id:id,mode:'sale',quantity:2}],consent:true,start_date:null,end_date:null,turnstile_token:'test-token',website:''});
function fixture(options={}){
 const calls=[],receipts=new Map();let savedRecord=null,notificationSent=false;
 const fetchImpl=async(url,o={})=>{
  calls.push({url,options:o,body:o.body?JSON.parse(o.body):undefined});
  const json=(data,status=200)=>new Response(JSON.stringify(data),{status});
  if(url.includes('siteverify'))return json(options.captcha||{success:true,action:'enquiry',hostname:'bills.test'});
  if(url.endsWith('/auth/v1/user'))return options.staff===false?json({},401):json({id});
  if(url.includes('admin_profiles?'))return json([{id,active:options.staffActive!==false,role:options.staffRole||'admin'}]);
  if(url.includes('bills_schema_version?'))return json([{version:options.version||2}]);
  if(url.includes('bills_site_settings?'))return json([{enquiries_enabled:options.enabled!==false,turnstile_site_key:'test-public'}]);
  if(url.endsWith('rpc/bills_submit_enquiry')){
   if(options.dbFailure)return json({code:options.dbFailure,message:options.dbMessage||'INTERNAL SECRET'},400);
   const p=JSON.parse(o.body);const old=receipts.get(p.p_submission_id);if(old&&old.fingerprint!==p.p_fingerprint)return json({code:'P0001',message:'Request token was used for different details.'},400);
   savedRecord={id,reference:'BE-A12345678901',kind:p.p_kind,customer_name:p.p_customer.name,customer_email:p.p_customer.email,customer_phone:p.p_customer.phone,company:p.p_customer.company,message:p.p_message,items:[{product_name:'Trusted DB name',sku:'DB-SKU',mode:'sale',quantity:2,listed_price:900}]};
   const receipt={id,reference:savedRecord.reference,duplicate:!!old};receipts.set(p.p_submission_id,{...receipt,fingerprint:p.p_fingerprint});return json(receipt);
  }
  if(url.endsWith('rpc/bills_claim_notification'))return json(notificationSent?null:savedRecord);
  if(url.includes('bills_enquiries?id=')&&o.method==='PATCH'){if(JSON.parse(o.body).notification_status==='sent')notificationSent=true;return new Response(null,{status:204});}
  if(url==='https://api.resend.com/emails')return options.emailFailure?json({message:'secret provider failure'},500):json({id:'email-test'});
  throw new Error('Unexpected mocked URL '+url);
 };
 const handler=createHandler({env:{...env,...options.env},fetchImpl,cryptoAPI:webcrypto,now:()=>now});
 const request=(data=body(),headers={})=>handler(new Request('https://fixture.supabase.co/functions/v1/bills-enquiries',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...headers},body:JSON.stringify(data)}));
 return {handler,request,calls,receipts};
}
test('valid request returns a reference after database acceptance',async()=>{const f=fixture(),r=await f.request();assert.equal(r.status,201);assert.equal((await r.json()).reference,'BE-A12345678901');assert.equal(f.receipts.size,1);});
test('server never trusts client product prices or names',async()=>{const f=fixture(),b=body();b.items[0].price=0;b.items[0].name='HACKED';await f.request(b);const rpc=f.calls.find(c=>c.url.endsWith('rpc/bills_submit_enquiry')).body;assert.deepEqual(rpc.p_items,[{product_id:id,mode:'sale',quantity:2}]);const email=f.calls.find(c=>c.url==='https://api.resend.com/emails').body;assert.ok(email.text.includes('Trusted DB name'));assert.ok(!email.text.includes('HACKED'));});
test('idempotent retry returns the same reference without another email',async()=>{const f=fixture();await f.request();const retry=await f.request();assert.equal(retry.status,200);assert.equal((await retry.json()).duplicate,true);assert.equal(f.receipts.size,1);assert.equal(f.calls.filter(c=>c.url==='https://api.resend.com/emails').length,1);});
test('email failure still reports honestly that the database received the request',async()=>{const f=fixture({emailFailure:true}),r=await f.request(),data=await r.json();assert.equal(r.status,201);assert.equal(data.received,true);assert.equal(data.notification_status,'failed');assert.ok(f.calls.some(c=>c.body?.notification_status==='failed'));});
test('CAPTCHA is checked server-side including action and exact hostname',async()=>{for(const captcha of [{success:false},{success:true,action:'other',hostname:'bills.test'},{success:true,action:'enquiry',hostname:'evil.test'}]){const f=fixture({captcha});assert.equal((await f.request()).status,400);assert.equal(f.receipts.size,0);}});
test('unauthorized origin is blocked before any upstream call',async()=>{const f=fixture();assert.equal((await f.request(body(),{Origin:'https://evil.test'})).status,403);assert.equal(f.calls.length,0);});
test('preflight advertises only the explicitly allowed origin',async()=>{const f=fixture(),r=await f.handler(new Request(origin,{method:'OPTIONS',headers:{Origin:origin}}));assert.equal(r.status,204);assert.equal(r.headers.get('access-control-allow-origin'),origin);});
test('health fails closed when config or deployed schema is not ready',async()=>{for(const options of [{env:{RATE_LIMIT_SALT:''}},{version:1},{enabled:false}]){const f=fixture(options),r=await f.handler(new Request(origin,{headers:{Origin:origin}}));assert.equal((await r.json()).ready,false);}});
test('SQL rate-limit failure is returned as 429 with no internal data',async()=>{const f=fixture({dbFailure:'P0429'}),r=await f.request();assert.equal(r.status,429);assert.ok(!(await r.text()).includes('INTERNAL SECRET'));});
test('unrecognized database errors do not expose credentials or SQL',async()=>{const f=fixture({dbFailure:'42501'}),r=await f.request();assert.equal(r.status,503);assert.ok(!(await r.text()).includes('INTERNAL SECRET'));});
test('a reused operation id with different content is rejected',async()=>{const f=fixture();await f.request();const b=body();b.message='Different details';assert.equal((await f.request(b)).status,409);});
test('request size is bounded even without content-length',async()=>{const f=fixture(),b=body();b.message='x'.repeat(45000);assert.equal((await f.request(b)).status,413);assert.equal(f.receipts.size,0);});
test('non-JSON submissions are rejected',async()=>{const f=fixture();assert.equal((await f.request(body(),{'Content-Type':'text/plain'})).status,415);});
test('honeypot, missing consent and invalid quantities fail before database writes',async()=>{for(const mutate of [b=>b.website='spam',b=>b.consent=false,b=>b.items[0].quantity=0,b=>b.items[0].quantity=1.2,b=>b.items.push({...b.items[0]})]){const f=fixture(),b=body();mutate(b);assert.equal((await f.request(b)).status,400);assert.equal(f.receipts.size,0);}});
test('rental dates are semantic, in order and not in the past',()=>{const b=body();b.items[0].mode='rental';b.kind='rental';for(const [start,end] of [['2026-02-30','2026-09-19'],['2026-09-16','2026-09-18'],['2026-09-20','2026-09-18']])assert.throws(()=>validateSubmission({...b,start_date:start,end_date:end},now));assert.equal(validateSubmission({...b,start_date:'2026-09-17',end_date:'2026-09-18'},now).payload.kind,'rental');});
test('contact enquiries require a message, not an empty cart masquerading as a quote',()=>{const b=body();b.items=[];assert.throws(()=>validateSubmission(b,now));b.kind='contact';assert.doesNotThrow(()=>validateSubmission(b,now));b.message='Hi';assert.throws(()=>validateSubmission(b,now));});
test('notification retry requires an actual validated active staff account',async()=>{const b={action:'retry_notification',enquiry_id:id};assert.equal((await fixture().request(b)).status,401);assert.equal((await fixture({staff:false}).request(b,{Authorization:'Bearer invalid'})).status,401);assert.equal((await fixture({staffActive:false}).request(b,{Authorization:'Bearer test'})).status,403);assert.equal((await fixture({staffRole:'customer'}).request(b,{Authorization:'Bearer test'})).status,403);});
test('email rate key is HMAC hashed and provider retry key stays stable',async()=>{const f=fixture();await f.request();const call=f.calls.find(c=>c.url.endsWith('rpc/bills_submit_enquiry')).body;assert.match(call.p_email_hash,/^[a-f0-9]{64}$/);assert.notEqual(call.p_email_hash,await digest('test@example.com',webcrypto));assert.equal(f.calls.find(c=>c.url==='https://api.resend.com/emails').options.headers['Idempotency-Key'],'bills-enquiry/'+id);});
