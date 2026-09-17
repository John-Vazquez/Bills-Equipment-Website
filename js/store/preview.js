import {initShell,applySettings} from './shell.js';
import {checkStaff,imageFor} from './data.js';
import {adminSnapshot} from './admin-data.js';
import {imageURL} from './client.js';
import {PRODUCT_BUCKET} from './config.js';
import {UUID,escapeHtml as e,safeImageUrl,productPrice,availability} from './model.js';
import {initImages,errorState} from './ui.js';
initImages();initShell().catch(()=>{});
const mount=document.querySelector('#privatePreview');
(async()=>{
 try{
  if(!await checkStaff()){mount.className='empty';mount.innerHTML='<h1>Employee login required</h1><p>Draft previews are not public.</p><a class="btn btn-primary" href="admin-login.html">Employee login</a>';return;}
  const params=new URLSearchParams(location.search),id=params.get('id');if(!UUID.test(id||''))throw new Error('Invalid product link.');
  const db=await adminSnapshot(),p=db.products.find(x=>x.id===id);if(!p)throw new Error('This product could not be found.');
  const mode=params.get('mode')==='rental'?'rental':'sale';applySettings(db.settings);mount.className='';
  mount.innerHTML=`<div class="notice" style="margin:24px 0"><strong>Employee preview — ${p.is_published&&p.status!=='hidden'?'published listing':'unpublished draft'}</strong><p>This shows the last saved version. Changes still open in the editor are not included. Customers cannot use this preview link to see drafts.</p><a class="red-link" href="admin.html">Back to manager</a></div><section class="detail-layout"><div class="gallery"><div class="gallery-main"><img id="previewImage" src="${e(safeImageUrl(imageFor(p)))}" alt="${e(p.name)}" width="600" height="420"></div><div class="gallery-thumbs">${p.product_images.map((i,k)=>`<button class="gallery-thumb" data-preview-image="${k}" aria-label="View image ${k+1}"><img src="${e(safeImageUrl(imageURL(PRODUCT_BUCKET,i.storage_path)))}" alt="${e(i.alt_text||p.name)}" width="66" height="66"></button>`).join('')}</div></div><div class="detail-info"><span class="product-brand">${e(p.brand)}</span><h1>${e(p.name)}</h1><span class="pill warning">${e(availability(p).label)}</span><dl class="detail-meta">${[['Model',p.model],['SKU',p.sku],['Categories',p.category_ids.map(id=>db.categories.find(c=>c.id===id)?.name).filter(Boolean).join(', ')],['Customer action',p.website?.purchase_mode==='information'?'Information only':'Add to quote request']].filter(x=>x[1]).map(([k,v])=>`<dt>${k}</dt><dd>${e(v)}</dd>`).join('')}</dl><div class="detail-price">${e(productPrice(p,mode))}</div><p class="muted">Cart actions are disabled in an employee preview.</p></div></section><section class="details-section"><h2>Product information</h2><div class="detail-description">${e(p.description||'Contact Bill’s for more information about this equipment.')}</div></section>${p.website?.specifications?`<section class="details-section"><h2>Specifications</h2><div class="specs">${e(p.website.specifications)}</div></section>`:''}`;
  mount.addEventListener('click',event=>{const b=event.target.closest('[data-preview-image]');if(b){const image=p.product_images[Number(b.dataset.previewImage)];document.querySelector('#previewImage').src=safeImageUrl(imageURL(PRODUCT_BUCKET,image.storage_path));}});
 }catch(error){mount.className='';mount.innerHTML=errorState(error.message);}
})();
document.addEventListener('click',event=>{if(event.target.closest('[data-retry]'))location.reload();});
