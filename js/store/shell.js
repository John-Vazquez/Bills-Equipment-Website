import {DEFAULT_SETTINGS} from './config.js';
import {categoryCard,$,toast,messageBox} from './ui.js';
import {getSnapshot,categoriesFor,getCartProducts,imageFor,checkStaff} from './data.js';
import {getCart,cartCount,removeItem,isCartPersistent} from './cart.js';
import {escapeHtml as e,safeImageUrl,productPrice} from './model.js';
import {icon} from './icons.js';
import {imageURL} from './client.js';
import {MEDIA_BUCKET} from './config.js';
let snapshot=null,activeCatalog='',previousOpener=null,drawerSequence=0;
export function applySettings(s={}) {
 const settings={...DEFAULT_SETTINGS,...s};
 for(const [key,attr] of [['phone_main','data-phone-main'],['phone_sales','data-phone-sales']])document.querySelectorAll(`[${attr}]`).forEach(a=>{a.href=`tel:+${settings[key].replace(/\D/g,'').replace(/^(\d{10})$/,'1$1')}`;const text=a.querySelector('span')||a;text.textContent=settings[key];});
 document.querySelectorAll('[data-email]').forEach(a=>{a.href='mailto:'+settings.email;const text=a.querySelector('span')||a;text.textContent=settings.email;});
 document.querySelectorAll('[data-address]').forEach(n=>{n.textContent=settings.address;});
 document.querySelectorAll('[data-map]').forEach(a=>{a.href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(settings.address);});
 document.querySelectorAll('[data-tagline]').forEach(n=>{n.textContent=settings.tagline;});
 if($('[data-hero-title]'))$('[data-hero-title]').textContent=settings.hero_title;
 if($('[data-hero-subtitle]'))$('[data-hero-subtitle]').textContent=settings.hero_subtitle;
 if(settings.hero_image_path&&$('.hero-art'))$('.hero-art').style.backgroundImage=`linear-gradient(90deg,#202020 0%,#20202070 25%,#20202000 70%),url("${imageURL(MEDIA_BUCKET,settings.hero_image_path)}")`;
}
function closeDepartments(focus=false){$('#departmentPanel').hidden=true;document.querySelectorAll('[data-catalog]').forEach(a=>a.setAttribute('aria-expanded','false'));activeCatalog='';if(focus)previousOpener?.focus();}
function openDepartments(slug,opener){
 if(activeCatalog===slug){closeDepartments();return;}
 const cat=snapshot?.catalogs.find(c=>c.slug===slug);if(!cat)return;
 previousOpener=opener;activeCatalog=slug;$('#panelAllLink').innerHTML=`View all ${e(cat.name)} ${icon('arrow')}`;$('#panelAllLink').href=`catalog.html?catalog=${encodeURIComponent(slug)}`;
 const cats=categoriesFor(snapshot,slug);$('#departmentGrid').innerHTML=cats.length?cats.map(categoryCard).join(''):'<p class="notice">Categories are being organized. <a class="red-link" href="contact.html">Ask Bill’s about this department.</a></p>';
 $('#departmentPanel').hidden=false;document.querySelectorAll('[data-catalog]').forEach(a=>a.setAttribute('aria-expanded',String(a.dataset.catalog===slug)));$('#departmentLinks').classList.remove('mobile-open');$('#mobileMenuButton')?.setAttribute('aria-expanded','false');
}
function updateCount(){document.querySelectorAll('[data-cart-count]').forEach(n=>{n.textContent=String(cartCount());});$('#openCart')?.setAttribute('aria-label',`Open request cart, ${cartCount()} items`);}
export async function renderDrawer(){
 const seq=++drawerSequence,lines=getCart(),target=$('#drawerContent');if(!target)return;
 if(!lines.length){target.innerHTML=`<div class="empty"><h3>Your cart is empty</h3><p>Add equipment to request pricing and availability.</p><a class="btn btn-primary" href="catalog.html?catalog=equipment">Browse equipment</a></div>`;return;}
 target.innerHTML='<div class="loading">Checking your equipment…</div>';
 try{const products=await getCartProducts(lines);if(seq!==drawerSequence)return;
 target.innerHTML=`<div class="drawer-items">${lines.map(line=>{const p=products.get(line.id);return `<article class="drawer-item"><img src="${e(safeImageUrl(p?imageFor(p):''))}" alt="" width="75" height="75"><div><h3>${p?e(p.name):'Listing no longer available'}</h3><p>${line.mode==='rental'?'Rental enquiry':'Equipment enquiry'} · Qty ${line.quantity}</p><p>${p?e(productPrice(p,line.mode)):'Remove this item to submit your request.'}</p></div><button class="icon-btn" data-cart-remove="${line.id}" data-mode="${line.mode}" aria-label="Remove ${e(p?.name||'item')}">${icon('close')}</button></article>`;}).join('')}</div><div class="drawer-foot"><p class="muted small">This is a quote request, not an online purchase. Bill’s will confirm prices and availability.</p>${isCartPersistent()?'':messageBox('Browser storage is unavailable. Keep this page open to retain your cart.','warning')}<a class="btn btn-primary wide" href="cart.html">Review & request quote ${icon('arrow')}</a><button class="btn wide" id="continueShopping">Continue browsing</button></div>`;
 }catch{if(seq===drawerSequence)target.innerHTML=`${messageBox('We could not recheck the selected equipment. Your cart has been kept.')}<a class="btn wide" href="cart.html">Review your cart</a>`;}
}
export async function openCart(){closeDepartments();const dialog=$('#cartDialog');if(!dialog.open)dialog.showModal();await renderDrawer();}
export function initShell(){
 updateCount();applySettings();
 $('#openCart')?.addEventListener('click',openCart);$('#closeCart')?.addEventListener('click',()=>$('#cartDialog').close());
 $('#cartDialog')?.addEventListener('click',event=>{if(event.target===$('#cartDialog')){const r=event.target.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)event.target.close();}const rm=event.target.closest('[data-cart-remove]');if(rm)removeItem(rm.dataset.cartRemove,rm.dataset.mode);if(event.target.closest('#continueShopping'))$('#cartDialog').close();});
 window.addEventListener('bills:cart',()=>{updateCount();if($('#cartDialog')?.open)renderDrawer();});
 $('#mobileMenuButton')?.addEventListener('click',()=>{closeDepartments();const open=$('#departmentLinks').classList.toggle('mobile-open');$('#mobileMenuButton').setAttribute('aria-expanded',String(open));});
 $('#departmentLinks')?.addEventListener('click',event=>{const link=event.target.closest('[data-catalog]');if(link&&snapshot){event.preventDefault();openDepartments(link.dataset.catalog,link);}});
 $('#closeDepartments')?.addEventListener('click',()=>closeDepartments(true));
 document.addEventListener('keydown',event=>{if(event.key==='Escape'){closeDepartments(true);$('#departmentLinks')?.classList.remove('mobile-open');$('#mobileMenuButton')?.setAttribute('aria-expanded','false');}});
 document.addEventListener('click',event=>{if(activeCatalog&&!event.target.closest('.department-bar'))closeDepartments();});
 return getSnapshot().then(s=>{
   snapshot=s;applySettings(s.settings);const mode=document.body.dataset.page;
   const current=['home','catalog'].includes(mode)?new URLSearchParams(location.search).get('catalog')||'equipment':new URLSearchParams(location.search).get('catalog');
   $('#departmentLinks').innerHTML=s.catalogs.filter(c=>c.active!==false).map(c=>`<a class="department-link" data-catalog="${e(c.slug)}" href="catalog.html?catalog=${encodeURIComponent(c.slug)}" aria-expanded="false" aria-controls="departmentPanel" ${c.slug===current?'aria-current="page"':''}>${e(c.name)}${icon('chevron')}</a>`).join('')+`<a class="department-link" href="rentals.html" ${mode==='rentals'?'aria-current="page"':''}>Rentals</a><a class="department-link" href="brands.html" ${mode==='brands'?'aria-current="page"':''}>Brands</a>`;
   checkStaff().then(profile=>{if(!profile)return;document.querySelectorAll('[data-employee-link]').forEach(a=>{a.href='admin.html';a.innerHTML=`${icon('edit')}<span><strong>Website Manager</strong><small>Employee tools</small></span>`;});document.querySelectorAll('[data-catalog-manager]').forEach(a=>{a.hidden=false;const catalog=new URLSearchParams(location.search).get('catalog');a.href='admin.html?tab=organization'+(catalog?'&catalog='+encodeURIComponent(catalog):'');});}).catch(()=>{});
   return s;
 });
}
