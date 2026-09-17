import {escapeHtml as e, productPrice, availability, canRequest, safeImageUrl} from './model.js';
import {imageFor,categoryImage} from './data.js';
import {icon} from './icons.js';
export const $=selector=>document.querySelector(selector);
export function toast(message){const el=$('#toast');if(!el)return;clearTimeout(toast.timer);el.textContent=message;el.hidden=false;toast.timer=setTimeout(()=>{el.hidden=true;},5000);}
export function messageBox(message,type='error'){return `<div class="notice ${type}" role="${type==='error'?'alert':'status'}">${e(message)}</div>`;}
export function errorState(message,button='Try again'){return `<div class="empty"><h2>Unable to load this content</h2><p>${e(message||'Check your connection and try again.')}</p><button class="btn btn-primary" data-retry>${e(button)}</button><p class="small">You can also <a class="red-link" href="contact.html">contact Bill’s directly</a>.</p></div>`;}
export function categoryCard(c,mode='sale'){
 const rental=mode==='rental'||(c.sale_count===0&&c.rental_count>0);
 return `<a class="category-card" href="${rental?'rentals':'products'}.html?category=${encodeURIComponent(c.id)}"><h3>${e(c.name)}</h3><img src="${e(safeImageUrl(categoryImage(c)))}" alt="${e(c.name)} equipment" width="240" height="145" loading="lazy"><span class="red-link">${rental?'View Rentals':'View Products'} ${icon('arrow')}</span></a>`;
}
export function productCard(p,mode='sale'){
 if(mode==='all')mode=p.listing_type==='rental'?'rental':'sale';
 const url=`${mode==='rental'?'rentalDesc':'productDesc'}.html?id=${encodeURIComponent(p.id)}`,a=availability(p);
 return `<article class="product-card"><a class="product-card-image" href="${url}" tabindex="-1" aria-hidden="true"><img src="${e(safeImageUrl(imageFor(p)))}" alt="" width="240" height="190" loading="lazy">${p.featured?'<span class="pill">Featured</span>':''}</a><div class="product-card-body"><span class="product-brand">${e(p.brand||'Equipment')}</span><h3><a href="${url}">${e(p.name)}</a></h3><p class="product-meta">${p.model?'Model: '+e(p.model):p.sku?'SKU: '+e(p.sku):'Equipment details & information'}</p><div class="product-price">${e(productPrice(p,mode))}</div><div class="product-availability ${a.key}">${e(a.label)}</div>${canRequest(p,mode)?`<button class="btn btn-primary" data-add="${e(p.id)}" data-mode="${mode}">${icon('cart')} Add to Request</button>`:`<a class="btn" href="${url}">View details ${icon('arrow')}</a>`}</div></article>`;
}
export function initImages(){document.addEventListener('error',event=>{const img=event.target;if(img instanceof HTMLImageElement&&!img.dataset.fallback){img.dataset.fallback='true';img.src='assets/equipment-placeholder.svg';}},true);}
