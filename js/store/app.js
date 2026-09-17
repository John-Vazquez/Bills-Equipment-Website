import {$,toast,errorState,categoryCard,productCard,initImages,messageBox} from './ui.js';
import {initShell,openCart,applySettings} from './shell.js';
import {getSnapshot,categoriesFor,searchProducts,getProduct,childCategories,imageFor,getCartProducts} from './data.js';
import {DEFAULT_SETTINGS,PAGE_SIZE} from './config.js';
import {escapeHtml as e,filtersFromURL,filtersURL,safeImageUrl,productPrice,availability,canRequest,money,numericPrice,UUID,allowsMode,isPublic} from './model.js';
import {addToCart,getCart,changeQuantity,removeItem,removeSubmittedItems,isCartPersistent} from './cart.js';
import {mountRequestForm,captureForm} from './forms.js';
import {icon} from './icons.js';
import {imageURL} from './client.js';
import {PRODUCT_BUCKET} from './config.js';
initImages();
const page=document.body.dataset.page;
const shell=initShell().catch(error=>{console.warn('Catalog connection:',error.message);return null;});
const hasFilterPage=['products','rentals'].includes(page);let listSequence=0,cartSequence=0,submittingCart=false;
function brandLink(name){return `<a class="brand-link" href="products.html?brand=${encodeURIComponent(name)}">${e(name)}</a>`;}
async function renderBrowse(){
 const target=$('#categoryContent');
 try{
 const snapshot=await getSnapshot(),slug=new URLSearchParams(location.search).get('catalog')||'equipment';const catalog=snapshot.catalogs.find(c=>c.slug===slug);
 if(!catalog){target.innerHTML='<div class="empty"><h2>Catalog not found</h2><p>This department may no longer be available.</p><a class="btn" href="index.html">Browse equipment</a></div>';return;}
 $('#catalogTitle').textContent=`View all ${catalog.name}`;document.title=`${catalog.name} Catalog | Bill’s Equipment & Rentals`;
 if(catalog.description){$('#catalogDescription').textContent=catalog.description;$('#catalogDescription').hidden=false;}
 $('#browseTabs').innerHTML=snapshot.catalogs.filter(c=>['equipment','construction','concrete','small-engine'].includes(c.slug)).sort((a,b)=>a.slug==='equipment'?-1:b.slug==='equipment'?1:0).map(c=>`<a href="catalog.html?catalog=${encodeURIComponent(c.slug)}" class="${c.slug===slug?'active':''}" ${c.slug===slug?'aria-current="page"':''}>${c.slug==='equipment'?'All':e(c.name)}</a>`).join('')+'<a href="rentals.html">Rentals</a>';
 const cats=categoriesFor(snapshot,slug);
 target.innerHTML=cats.length?`<div class="category-grid">${cats.map(c=>categoryCard(c)).join('')}</div>`:'<div class="empty"><h2>This catalog is being organized</h2><p>Contact Bill’s for equipment in this department.</p><a class="btn btn-primary" href="contact.html">Contact Bill’s</a></div>';
 $('#allProductsLink').href=filtersURL({catalog:slug},'products.html');
 if(snapshot.brands?.length){$('#homeBrands').hidden=false;$('#brandPreview').innerHTML=snapshot.brands.slice(0,8).map(brandLink).join('');}
 }catch(error){target.innerHTML=errorState(error.message);}
}
function currentFilters(){const f=filtersFromURL(location.search);if(page==='rentals')f.mode='rental';if(f.mode==='all'&&['price-low','price-high'].includes(f.sort))f.sort='recommended';return f;}
async function setupFilters(){
 const s=await getSnapshot();const f=currentFilters();
 $('#filterCategory').innerHTML='<option value="">All categories</option>'+s.categories.filter(c=>c.active!==false).map(c=>`<option value="${e(c.id)}">${e(c.name)}</option>`).join('');
 $('#filterBrand').innerHTML='<option value="">All brands</option>'+(s.brands||[]).map(b=>`<option value="${e(b)}">${e(b)}</option>`).join('');
 syncFilterControls(f);if(matchMedia('(max-width:740px)').matches)$('#filterPanel').open=false;
 let timer;$('#filterForm').addEventListener('submit',event=>{event.preventDefault();clearTimeout(timer);updateFilters();});
 $('#filterForm').addEventListener('change',updateFilters);$('#sortSelect').addEventListener('change',updateFilters);
 $('#filterQuery').addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(updateFilters,300);});
 $('#clearFilters').addEventListener('click',()=>{clearTimeout(timer);history.pushState({},'',page==='rentals'?'rentals.html':'products.html');syncFilterControls(currentFilters());renderListings();});
 $('#pagination').addEventListener('click',event=>{const button=event.target.closest('[data-page-number]');if(button){const f=currentFilters();f.page=Number(button.dataset.pageNumber);history.pushState({},'',filtersURL(f,page==='rentals'?'rentals.html':'products.html'));renderListings();$('#resultCount').scrollIntoView({block:'center',behavior:'smooth'});}});
 window.addEventListener('popstate',()=>{syncFilterControls(currentFilters());renderListings();});
}
function syncFilterControls(f){$('#sortSelect').querySelectorAll('option').forEach(o=>{if(o.value.startsWith('price-')){o.hidden=f.mode==='all';o.textContent=(f.mode==='rental'?'Daily rate':'Price')+(o.value==='price-low'?': low to high':': high to low');}});$('#filterQuery').value=f.q;$('#headerSearch').value=f.q;$('#filterCategory').value=f.category;$('#filterBrand').value=f.brand;$('#filterAvailability').value=f.availability;$('#sortSelect').value=['recommended','name','newest','price-low','price-high'].includes(f.sort)?f.sort:'recommended';}
function updateFilters(){const f={...currentFilters(),q:$('#filterQuery').value.trim(),category:$('#filterCategory').value,brand:$('#filterBrand').value,availability:$('#filterAvailability').value,sort:$('#sortSelect').value,page:1};history.pushState({},'',filtersURL(f,page==='rentals'?'rentals.html':'products.html'));renderListings();}
async function renderListings(){
 const seq=++listSequence,target=$('#productResults'),f=currentFilters();target.setAttribute('aria-busy','true');$('#resultCount').textContent='Loading equipment…';
 try{
 const [s,result]=await Promise.all([getSnapshot(),searchProducts(f)]);if(seq!==listSequence)return;
 const selected=s.categories.find(c=>c.id===f.category),catalog=s.catalogs.find(c=>c.slug===f.catalog);let title=selected?.name||catalog?.name||(f.mode==='rental'?'Equipment Rentals':'Browse Equipment');if(f.q)title=`Results for “${f.q}”`;
 $('#listingTitle').textContent=title;document.title=`${title} | Bill’s Equipment & Rentals`;
 $('#resultCount').textContent=result.total?`${result.total} product${result.total===1?'':'s'} · ${((result.page-1)*PAGE_SIZE)+1}–${Math.min(result.page*PAGE_SIZE,result.total)}`:'No matching products';
 const children=selected?childCategories(s,selected.id):[];$('#childCategories').hidden=!children.length;$('#childCategories').innerHTML=children.map(c=>`<a href="${e(filtersURL({...f,category:c.id,page:1}))}">${e(c.name)}</a>`).join('');
 target.innerHTML=result.items.length?result.items.map(p=>productCard(p,f.mode)).join(''):'<div class="empty"><h2>No matching equipment</h2><p>Try a different search or category. The team at Bill’s can help locate what you need.</p><a class="btn" href="products.html">Browse all equipment</a><a class="btn btn-primary" href="contact.html">Contact Bill’s</a></div>';
 const pages=result.pages||Math.max(1,Math.ceil(result.total/PAGE_SIZE));
 $('#pagination').innerHTML=pages>1?`<button class="btn btn-small" data-page-number="${result.page-1}" ${result.page<=1?'disabled':''}>Previous</button><span class="small">Page ${result.page} of ${pages}</span><button class="btn btn-small" data-page-number="${result.page+1}" ${result.page>=pages?'disabled':''}>Next</button>`:'';
 }catch(error){if(seq===listSequence){target.innerHTML=errorState(error.message);$('#resultCount').textContent='Products could not be loaded';$('#pagination').innerHTML='';}}
 finally{if(seq===listSequence)target.removeAttribute('aria-busy');}
}
async function renderDetail(){
 const target=$('#detailContent'),params=new URLSearchParams(location.search),id=params.get('id')||document.body.dataset.productId,slug=params.get('slug');const mode=page==='rental-detail'?'rental':'sale';
 try{
 const product=(!id||UUID.test(id))&&(id||slug)?await getProduct(id,slug):null;
 if(!product||!isPublic(product)||!allowsMode(product,mode)){document.title='Equipment not found | Bill’s Equipment & Rentals';target.innerHTML='<div class="empty"><h1>Listing not found</h1><p>This listing may no longer be public, or is not available in this catalog.</p><a class="btn btn-primary" href="products.html">Browse equipment</a></div>';return;}
 const s=await getSnapshot(),p=product,a=availability(p),images=p.product_images||[],detailURL=`${location.origin}${location.pathname}?id=${encodeURIComponent(p.id)}`;
 document.title=`${p.name} | Bill’s Equipment & Rentals`;document.querySelector('link[rel=canonical]').href=detailURL;
 for(const [selector,value] of [['meta[name=description]',(p.description||`Equipment details for ${p.name}`).slice(0,170)],['meta[property="og:title"]',p.name],['meta[property="og:url"]',detailURL],['meta[property="og:image"]',safeImageUrl(imageFor(p))]])document.querySelector(selector)?.setAttribute('content',value);
 const cat=s.categories.find(c=>c.id===p.category_id);$('#productBreadcrumb').innerHTML=`<a href="index.html">Home</a><span>›</span><a href="${mode==='rental'?'rentals':'products'}.html">${mode==='rental'?'Rentals':'Equipment'}</a>${cat?`<span>›</span><a href="${e(filtersURL({category:cat.id,mode}))}">${e(cat.name)}</a>`:''}<span>›</span><span>${e(p.name)}</span>`;
 target.innerHTML=`<section class="detail-layout"><div class="gallery"><button class="gallery-main" id="openImage" aria-label="Enlarge product image"><img id="mainProductImage" src="${e(safeImageUrl(imageFor(p)))}" alt="${e(p.name)}" width="600" height="420" fetchpriority="high"></button><div class="gallery-thumbs">${images.map((i,index)=>`<button class="gallery-thumb" data-image-index="${index}" aria-label="View photo ${index+1}" aria-pressed="${index===0}"><img src="${e(safeImageUrl(imageURL(PRODUCT_BUCKET,i.storage_path)))}" alt="${e(i.alt_text||p.name)}" width="66" height="66" loading="lazy"></button>`).join('')}</div></div><div class="detail-info"><span class="product-brand">${e(p.brand||'Equipment')}</span><h1>${e(p.name)}</h1><span class="pill ${a.key==='in_stock'?'active':'warning'}">${e(a.label)}</span><dl class="detail-meta">${[['Brand',p.brand],['Model',p.model],['SKU',p.sku],['Condition',p.condition==='unspecified'?'Not specified':p.condition],['Category',cat?.name]].filter(x=>x[1]).map(([k,v])=>`<dt>${k}</dt><dd>${e(v)}</dd>`).join('')}</dl><div class="detail-price">${e(productPrice(p,mode))}</div><p class="muted small">${mode==='rental'?'Rental dates and rates must be confirmed by Bill’s.':'Listed pricing, where shown, is subject to confirmation. No online payment is collected.'}</p>${canRequest(p,mode)?`<div class="detail-actions"><label class="sr-only" for="detailQuantity">Quantity</label><input class="quantity-input" type="number" id="detailQuantity" value="1" min="1" max="99" step="1"><button class="btn btn-primary" data-add="${p.id}" data-mode="${mode}" data-detail-add>${icon('cart')} Add to Request</button></div>`:`<p class="notice" style="margin-top:20px">${p.status==='sold'?'This listing is unavailable. Ask Bill’s about alternatives.':'Contact Bill’s for information about this equipment.'}</p>`}<div class="actions" style="margin-top:12px"><a class="btn" data-phone-sales href="tel:+19547899459">${icon('phone')}<span>954-789-9459</span></a><a class="red-link" href="contact.html">Ask about this item ${icon('arrow')}</a></div><p class="small muted" style="margin-top:20px">An item in your request cart is not reserved. Our team will confirm availability before any purchase or rental.</p>${p.listing_type==='both'?`<a class="red-link small" style="margin-top:15px" href="${mode==='sale'?'rentalDesc':'productDesc'}.html?id=${p.id}">${mode==='sale'?'Also listed for rental':'View sale listing'} ${icon('arrow')}</a>`:''}</div></section><section class="details-section"><h2>Product information</h2><p class="detail-description">${e(p.description||'Contact Bill’s for more information about this equipment.')}</p></section>${p.website?.specifications?`<section class="details-section"><h2>Specifications</h2><div class="specs">${e(p.website.specifications)}</div></section>`:''}<section class="featured-section" id="relatedSection" hidden><div class="section-heading"><h2>Related equipment</h2></div><div class="product-grid" id="relatedProducts"></div></section>`;
 applySettings(s.settings);
 target.querySelector('.gallery-thumbs').addEventListener('click',event=>{const b=event.target.closest('[data-image-index]');if(!b)return;const i=images[Number(b.dataset.imageIndex)];$('#mainProductImage').src=imageURL(PRODUCT_BUCKET,i.storage_path);delete $('#mainProductImage').dataset.fallback;$('#mainProductImage').alt=i.alt_text||p.name;target.querySelectorAll('.gallery-thumb').forEach(n=>n.setAttribute('aria-pressed',String(n===b)));});
 $('#openImage').addEventListener('click',()=>{$('#largeImage').src=$('#mainProductImage').src;$('#largeImage').alt=$('#mainProductImage').alt;$('#imageDialog').showModal();});$('#closeImage').addEventListener('click',()=>$('#imageDialog').close());
 // Product structured data intentionally omits offers/stock unless business checkout is implemented.
 const structured={"@context":"https://schema.org","@type":"Product",name:p.name,description:(p.description||'').slice(0,5000),...(p.sku?{sku:p.sku}:{}),...(p.brand?{brand:{'@type':'Brand',name:p.brand}}:{}),...(images.length?{image:images.map(i=>imageURL(PRODUCT_BUCKET,i.storage_path))}:{})};
 let json=document.getElementById('productStructuredData');if(!json){json=document.createElement('script');json.id='productStructuredData';json.type='application/ld+json';document.head.append(json);}json.textContent=JSON.stringify(structured);
 if(cat){try{const related=await searchProducts({category:cat.id,mode});const items=related.items.filter(x=>x.id!==p.id).slice(0,4);if(items.length){$('#relatedSection').hidden=false;$('#relatedProducts').innerHTML=items.map(x=>productCard(x,mode)).join('');}}catch{/* Related items are supplemental; the requested product stays usable. */}}
 }catch(error){target.innerHTML=errorState(error.message);}
}
async function renderCartPage(){
 if(submittingCart||$('#requestForm')?.dataset.busy)return;
 const sequence=++cartSequence,container=$('#cartPage'),savedValues=captureForm($('#cartFormMount'));const lines=getCart();
 if(!lines.length){container.innerHTML='<section class="empty" style="margin-bottom:45px"><h2>Your request cart is empty</h2><p>Add equipment from the catalog, then request pricing and availability from Bill’s.</p><a class="btn btn-primary" href="catalog.html?catalog=equipment">Browse equipment</a></section>';return;}
 try{
 const [products,s]=await Promise.all([getCartProducts(lines),getSnapshot()]);if(sequence!==cartSequence)return;
 let estimate=0,unknown=0;
 const rows=lines.map(line=>{const p=products.get(line.id),valid=p&&canRequest(p,line.mode);if(p&&line.mode==='sale'&&numericPrice(p)!==null)estimate+=numericPrice(p)*line.quantity;else unknown++;
 return `<article class="cart-line"><img src="${e(safeImageUrl(p?imageFor(p):''))}" alt="" width="105" height="105"><div><h3>${p?`<a href="${line.mode==='rental'?'rentalDesc':'productDesc'}.html?id=${line.id}">${e(p.name)}</a>`:'Listing no longer available'}</h3><small>${line.mode==='rental'?'Rental enquiry':'Equipment enquiry'}${p?.model?' · '+e(p.model):''}</small><small>${p?e(productPrice(p,line.mode)):''}</small>${!valid?'<small class="notice error">Remove this item before submitting.</small>':''}</div><div class="cart-line-tools"><label class="sr-only" for="qty-${line.id}-${line.mode}">Quantity for ${e(p?.name||'item')}</label><input class="quantity-input" id="qty-${line.id}-${line.mode}" type="number" min="1" max="99" step="1" value="${line.quantity}" data-cart-quantity="${line.id}" data-mode="${line.mode}"><button class="icon-btn" data-cart-delete="${line.id}" data-mode="${line.mode}" aria-label="Remove ${e(p?.name||'item')}">${icon('trash')}</button></div></article>`;}).join('');
 container.innerHTML=`<div class="cart-layout"><section aria-label="Selected equipment"><div class="cart-lines">${rows}</div><div class="cart-summary"><div class="summary-row"><strong>Listed item estimate</strong><strong>${estimate>0?money(estimate):'To be quoted'}</strong></div><p class="small muted" style="margin-top:10px">${unknown?`${unknown} item${unknown===1?'':'s'} require${unknown===1?'s':''} a quote or rental rate. `:''}This is not an order total. Final pricing, any tax, pickup or delivery arrangements must be confirmed by Bill’s.</p></div>${isCartPersistent()?'':messageBox('Browser storage is unavailable. Keep this page open to retain your request.','warning')}<a class="red-link small" href="products.html" style="margin-top:18px">Continue browsing ${icon('arrow')}</a></section><div id="cartFormMount"></div></div>`;
 await mountRequestForm($('#cartFormMount'),{settings:s.settings,lines,products,values:savedValues,onSubmitted:submitted=>{submittingCart=true;removeSubmittedItems(submitted);}});
 }catch(error){if(sequence===cartSequence)container.innerHTML=errorState(error.message);}
}
document.addEventListener('click',async event=>{
 const retry=event.target.closest('[data-retry]');if(retry){location.reload();return;}
 const add=event.target.closest('[data-add]');if(add){
   add.disabled=true;
   try{const p=await getProduct(add.dataset.add);if(!p||!canRequest(p,add.dataset.mode))throw new Error('This item is no longer available for requests. Contact Bill’s.');const quantity=add.hasAttribute('data-detail-add')?Number($('#detailQuantity').value):1;addToCart(p.id,add.dataset.mode,quantity);await openCart();}catch(error){toast(error.message);}finally{add.disabled=false;}
 }
 const del=event.target.closest('[data-cart-delete]');if(del){removeItem(del.dataset.cartDelete,del.dataset.mode);}
});
document.addEventListener('change',event=>{const input=event.target.closest('[data-cart-quantity]');if(input){try{changeQuantity(input.dataset.cartQuantity,input.dataset.mode,Number(input.value));}catch(error){toast(error.message);input.value=String(getCart().find(l=>l.id===input.dataset.cartQuantity&&l.mode===input.dataset.mode)?.quantity||1);}}});
(async()=>{
 if(['home','catalog'].includes(page))await renderBrowse();
 else if(hasFilterPage){try{await setupFilters();await renderListings();}catch(error){$('#productResults').innerHTML=errorState(error.message);$('#resultCount').textContent='Products could not be loaded';}}
 else if(['product','rental-detail'].includes(page))await renderDetail();
 else if(page==='brands'){try{$('#allBrands').innerHTML=(await getSnapshot()).brands.map(brandLink).join('')||'<p class="notice">Brands will appear when equipment listings are available.</p>';}catch(error){$('#allBrands').innerHTML=errorState(error.message);}}
 else if(page==='contact'){const s=await shell;await mountRequestForm($('#contactFormMount'),{settings:s?.settings||DEFAULT_SETTINGS});}
 else if(page==='cart'){await renderCartPage();window.addEventListener('bills:cart',renderCartPage);$('#printRequest').addEventListener('click',()=>window.print());}
})();
