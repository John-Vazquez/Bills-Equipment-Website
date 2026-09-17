import {LOCAL_PREVIEW} from './config.js';
import {escapeHtml as e, canRequest, productPrice} from './model.js';
import {functionURL} from './client.js';
import {messageBox,toast} from './ui.js';
import {icon} from './icons.js';
let turnstileLoader;
export function requestText(values,lines=[],products=new Map()) {
  const items=lines.map(line=>{const p=products.get(line.id);return `${line.quantity} × ${p?.name||line.id} (${line.mode==='rental'?'Rental':'Equipment'})${p?.model?' — '+p.model:''}${p?.sku?' — SKU '+p.sku:''}`;});
  return ['Equipment enquiry for Bill’s',`Name: ${values.name||''}`,`Email: ${values.email||''}`,`Phone: ${values.phone||''}`,values.company?`Company: ${values.company}`:'',items.length?'\nRequested equipment:\n'+items.join('\n'):'',values.start_date?`\nRequested rental dates: ${values.start_date} to ${values.end_date||''}`:'','\n'+(values.message||''),'\nPlease confirm pricing and availability.'].filter(Boolean).join('\n');
}
async function loadTurnstile(){
 if(globalThis.turnstile)return;
 if(!turnstileLoader)turnstileLoader=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';s.async=true;const t=setTimeout(()=>reject(new Error('The security check could not load.')),15000);s.onload=()=>{clearTimeout(t);resolve();};s.onerror=()=>{clearTimeout(t);reject(new Error('The security check could not load.'));};document.head.append(s);}).catch(err=>{turnstileLoader=null;throw err;});
 return turnstileLoader;
}
async function stableRequestId(payload){
 const signature=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(payload))))).map(x=>x.toString(16).padStart(2,'0')).join('');
 let previous;try{previous=JSON.parse(sessionStorage.getItem('bills.enquiry.retry')||'null');}catch{}
 const record=previous?.signature===signature?previous:{id:crypto.randomUUID(),signature};
 try{sessionStorage.setItem('bills.enquiry.retry',JSON.stringify(record));}catch{}
 return record.id;
}
export function captureForm(mount){const form=mount?.querySelector('form');return form?Object.fromEntries(new FormData(form)):{};}
export async function mountRequestForm(mount,{settings,lines=[],products=new Map(),values={},onSubmitted=()=>{}}){
 const isCart=lines.length>0,hasRental=lines.some(l=>l.mode==='rental');let token='',widgetId=null,submitting=false;
 const today=new Date().toLocaleDateString('en-CA'); // local date; no UTC shift for requested rental dates
 const actualToday=`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-${String(new Date().getDate()).padStart(2,'0')}`;
 mount.innerHTML=`<form class="request-form" id="requestForm"><h2>${isCart?'Request pricing & availability':'Send an enquiry'}</h2><p>${isCart?'Bill’s will confirm your equipment request directly. This is not a purchase or rental booking.':'Tell us what you need. For urgent questions, please call Bill’s.'}</p><div class="field-row"><label class="field"><span>Your name <span aria-hidden="true">*</span></span><input name="name" autocomplete="name" required maxlength="120" value="${e(values.name)}"></label><label class="field"><span>Company</span><input name="company" autocomplete="organization" maxlength="160" value="${e(values.company)}"></label></div><label class="field"><span>Email <span aria-hidden="true">*</span></span><input name="email" type="email" autocomplete="email" required maxlength="254" value="${e(values.email)}"></label><label class="field"><span>Phone <span aria-hidden="true">*</span></span><input name="phone" type="tel" autocomplete="tel" required minlength="7" maxlength="40" value="${e(values.phone)}"></label>${hasRental?`<div class="field-row"><label class="field"><span>Requested start date *</span><input name="start_date" type="date" min="${actualToday}" required value="${e(values.start_date)}"></label><label class="field"><span>Requested end date *</span><input name="end_date" type="date" min="${actualToday}" required value="${e(values.end_date)}"></label></div><p>Dates are a request only. Bill’s must confirm availability and rates.</p>`:''}<label class="field"><span>How can we help? ${isCart?'':'*'}</span><textarea name="message" rows="4" maxlength="5000" ${isCart?'':'required minlength="10"'} placeholder="Job requirements, equipment questions or other details">${e(values.message)}</textarea></label><div class="honeypot" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div><label class="field-check"><input type="checkbox" name="consent" required ${values.consent?'checked':''}><span>I agree that Bill’s may use these details to respond to this enquiry. <a class="red-link" href="privacy.html" target="_blank" rel="noopener">Website information</a></span></label><div class="captcha-mount"></div><div class="form-status" role="status" aria-live="polite"></div><button class="btn btn-primary wide" type="submit" disabled>${isCart?'Submit quote request':'Send enquiry'} ${icon('arrow')}</button><div class="actions"><button class="btn btn-small" type="button" data-email-draft>Email instead ${icon('mail')}</button><button class="btn btn-small" type="button" data-copy-request>Copy enquiry</button></div><small class="muted">Email opens a draft in your email app; you still need to send it.</small></form>`;
 const form=mount.querySelector('form'),status=form.querySelector('.form-status'),submit=form.querySelector('[type=submit]');
 function valuesNow(){return Object.fromEntries(new FormData(form));}
 form.querySelector('[data-copy-request]').addEventListener('click',async()=>{const text=requestText(valuesNow(),lines,products);try{await navigator.clipboard.writeText(text);toast('Enquiry copied. Nothing has been sent.');}catch{status.innerHTML=`${messageBox('Clipboard access was blocked. Copy the text below; nothing has been sent.','warning')}<label class="field"><span>Enquiry text</span><textarea readonly rows="8">${e(text)}</textarea></label>`;}});
 form.querySelector('[data-email-draft]').addEventListener('click',()=>{const body=requestText(valuesNow(),lines,products);if(body.length>1700){status.innerHTML=messageBox('This enquiry is long. Use Copy enquiry, then paste it into an email to '+settings.email+'.','warning');return;}location.href=`mailto:${encodeURIComponent(settings.email)}?subject=${encodeURIComponent(isCart?'Equipment quote request':'Website enquiry')}&body=${encodeURIComponent(body)}`;});
 form.addEventListener('submit',async event=>{
   event.preventDefault();if(submitting||submit.disabled)return;if(!form.reportValidity())return;
   const v=valuesNow();if(hasRental&&v.end_date<v.start_date){status.innerHTML=messageBox('The end date must be on or after the start date.');return;}
   if(lines.some(l=>!products.get(l.id)||!canRequest(products.get(l.id),l.mode))){status.innerHTML=messageBox('Remove unavailable or information-only listings from the cart before submitting.');return;}
   if(!token){status.innerHTML=messageBox('Complete the security check before submitting.');return;}
   const payload={kind:isCart?(hasRental?(lines.every(l=>l.mode==='rental')?'rental':'mixed'):'quote'):'contact',customer:{name:v.name.trim(),email:v.email.trim(),phone:v.phone.trim(),company:v.company.trim()},message:v.message.trim(),items:lines.map(l=>({product_id:l.id,mode:l.mode,quantity:l.quantity})),start_date:v.start_date||null,end_date:v.end_date||null,consent:true};
   submitting=true;form.dataset.busy='true';submit.disabled=true;submit.textContent='Submitting…';status.textContent='';
   try{
     const id=await stableRequestId(payload);
     const response=await fetch(functionURL(),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,submission_id:id,turnstile_token:token,website:v.website||''}),signal:AbortSignal.timeout(25000)});
     const result=await response.json().catch(()=>({}));
     if(!response.ok||!result.reference)throw new Error(result.message||'The request could not be confirmed. Your details have been kept. Retry or contact Bill’s directly.');
     onSubmitted(lines,result);
     mount.innerHTML=`<section class="submission-success" role="status"><h2>Request received</h2><p>Your reference is <strong>${e(result.reference)}</strong>.</p><p>Bill’s will review your enquiry. This is not a confirmed purchase or rental booking.</p><p class="small muted">For urgent questions, call ${e(settings.phone_main)} and mention your reference.</p><a class="btn" href="index.html">Continue browsing</a></section>`;
     try{sessionStorage.removeItem('bills.enquiry.retry');}catch{}
   }catch(err){status.innerHTML=messageBox(err.name==='TimeoutError'?'We could not confirm the response. Your details have been kept. Retry with the same details; the server prevents duplicate requests.':err.message);token='';if(widgetId!==null)globalThis.turnstile?.reset(widgetId);}
   finally{submitting=false;delete form.dataset.busy;if(form.isConnected){submit.disabled=false;submit.textContent=isCart?'Submit quote request':'Send enquiry';}}
 });
 if(LOCAL_PREVIEW||!settings.enquiries_enabled||!settings.turnstile_site_key){status.innerHTML=messageBox('Online submission is not currently enabled. Call Bill’s or use Email instead to send your enquiry.','warning');return;}
 try{
   const response=await fetch(functionURL(),{signal:AbortSignal.timeout(10000)});const health=await response.json();if(!response.ok||!health.ready)throw new Error('Online submission is temporarily unavailable. Call Bill’s or use Email instead.');
   if(!form.isConnected)return;
   await loadTurnstile();if(!form.isConnected)return;
   widgetId=globalThis.turnstile.render(form.querySelector('.captcha-mount'),{sitekey:settings.turnstile_site_key,action:'enquiry',theme:'light',size:'flexible',callback:value=>{token=value;},'expired-callback':()=>{token='';},'error-callback':()=>{token='';status.innerHTML=messageBox('The security check failed. Please retry or contact Bill’s directly.');}});submit.disabled=false;
 }catch(err){if(form.isConnected)status.innerHTML=messageBox(err.message||'Online submission is temporarily unavailable. Use Email instead.','warning');}
}
