import {MAX_CART_LINES, MAX_QUANTITY, DEFAULT_CATALOGS} from './config.js';
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const slugify = value => String(value ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,100);
export const money = value => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(Number(value));
export const numericPrice = p => !p.call_for_price && p.price !== null && p.price !== undefined && Number.isFinite(Number(p.price)) && Number(p.price) >= 0 ? Number(p.price) : null;
export const sortPrice = (p,mode='sale') => mode==='rental' ? (p.website?.rental_call_for_price===false && Number(p.website.rental_day)>0 ? Number(p.website.rental_day) : null) : numericPrice(p);
export const primaryImage = p => (p.product_images || []).find(i => i.is_primary) || [...(p.product_images || [])].sort((a,b)=>(a.sort_order||0)-(b.sort_order||0))[0];
export const isPublic = p => p.is_published === true && p.status !== 'hidden';
export const allowsMode = (p, mode='sale') => mode === 'all' ? ['product','rental','both'].includes(p.listing_type) : mode === 'rental' ? ['rental','both'].includes(p.listing_type) : ['product','both'].includes(p.listing_type);
export function availability(p, now = Date.now()) {
  if (['sold','out_of_stock'].includes(p.status)) return {key:'unavailable',label:p.status === 'sold' ? 'Sold / unavailable' : 'Currently unavailable'};
  const s=p.website || {};
  if (s.availability === 'unavailable') return {key:'unavailable',label:'Currently unavailable'};
  if (s.availability === 'backorder') return {key:'backorder',label:'Ask about lead time'};
  const verified = Date.parse(s.stock_verified_at || '');
  if (s.availability === 'in_stock' && Number(p.quantity)>0 && verified<=now && now-verified<=30*86400000) return {key:'in_stock',label:'Stock confirmed'};
  return {key:'confirm',label:'Confirm availability'};
}
export function canRequest(p,mode='sale') {
  return isPublic(p) && allowsMode(p,mode) && p.status !== 'sold' && p.website?.purchase_mode !== 'information';
}
export function productPrice(p,mode='sale') {
  if (mode==='rental') {
    const s=p.website||{};
    if (s.rental_call_for_price !== false) return 'Request rental rate';
    for(const [key,period] of [['rental_day','day'],['rental_week','week'],['rental_month','month']]) {
      if(s[key]!==null && s[key]!==undefined && Number.isFinite(Number(s[key])) && Number(s[key])>0) return `${money(s[key])} / ${period}`;
    }
    return 'Request rental rate';
  }
  const n=numericPrice(p); return n===null ? 'Request a quote' : money(n);
}
export function normalizeProduct(p) {
  return {...p,website:p.website||{}, category_ids:[...new Set([...(p.category_ids||[]),p.category_id].filter(Boolean))], product_images:[...(p.product_images||[])].sort((a,b)=>(b.is_primary===true)-(a.is_primary===true)||(a.sort_order||0)-(b.sort_order||0))};
}
export function validateCart(raw) {
  if (!Array.isArray(raw)) return [];
  const map=new Map();
  for(const row of raw.slice(0,MAX_CART_LINES)) {
    if(!row || !UUID.test(String(row.id)) || !['sale','rental'].includes(row.mode)) continue;
    const q=Number(row.quantity);
    if(!Number.isInteger(q) || q<1 || q>MAX_QUANTITY) continue;
    const id=String(row.id).toLowerCase(),key=`${id}:${row.mode}`;
    map.set(key,{id,mode:row.mode,quantity:Math.min(MAX_QUANTITY,q+(map.get(key)?.quantity||0))});
  }
  return [...map.values()];
}
export function descendants(categories,id) {
  const ids=new Set([id]);let changed=true;
  while(changed) {changed=false; for(const c of categories) if(c.active!==false && c.parent_id && ids.has(c.parent_id) && !ids.has(c.id)) {ids.add(c.id);changed=true;}}
  return ids;
}
export function legacyCatalogs(categories) {
  const rules={construction:/aerial|lift|compac|roller|air compressor|air tool|water pump|generator|scaffold|rammer/i,concrete:/concrete|mortar|mixer|saw|cutting|rebar|curb|screed|finisher|grind|scarifi|vibrat/i,'small-engine':/engine|generator|water pump/i,'pressure-washing':/pressure|washer/i,'shop-supplies':/safety|hand tool|power tool|laser|hardware|supply|supplies/i};
  return DEFAULT_CATALOGS.map(c=>({...c,category_ids:categories.filter(cat=>c.slug==='equipment'||rules[c.slug]?.test(cat.name)).map(cat=>cat.id)}));
}
export function filterProducts(products, filters={}, snapshot={categories:[],catalogs:[]}) {
  let eligible=null;
  if(filters.category) eligible=descendants(snapshot.categories,filters.category);
  if(filters.catalog) {
    const catalog=snapshot.catalogs.find(c=>c.slug===filters.catalog);
    const allowed=new Set((catalog?.category_ids||[]).flatMap(id=>[...descendants(snapshot.categories,id)]));
    eligible=eligible ? new Set([...eligible].filter(id=>allowed.has(id))) : allowed;
  }
  const terms=String(filters.q||'').trim().toLowerCase().split(/\s+/).filter(Boolean);
  const list=products.filter(p => isPublic(p) && allowsMode(p,filters.mode||'sale') &&
    (!eligible || (p.category_ids||[p.category_id]).some(id=>eligible.has(id))) &&
    (!filters.brand || String(p.brand||'').toLowerCase()===String(filters.brand).toLowerCase()) &&
    (!filters.availability || availability(p).key===filters.availability) &&
    terms.every(t=>[p.name,p.brand,p.model,p.sku,p.description].filter(Boolean).join(' ').toLowerCase().includes(t)));
  const sort=filters.sort||'recommended';
  list.sort((a,b)=>{
    if(sort==='price-low'||sort==='price-high') {
      const ap=sortPrice(a,filters.mode),bp=sortPrice(b,filters.mode);
      if(ap===null && bp!==null)return 1;if(bp===null && ap!==null)return -1;
      if(ap!==bp)return sort==='price-high'?bp-ap:ap-bp;
    }
    if(sort==='name')return String(a.name).localeCompare(String(b.name));
    if(sort==='newest') {const diff=Date.parse(b.created_at||0)-Date.parse(a.created_at||0);if(diff)return diff;}
    return Number(b.featured)-Number(a.featured)||(Number(a.display_order)||0)-(Number(b.display_order)||0)||String(a.name).localeCompare(String(b.name))||String(a.id).localeCompare(String(b.id));
  });
  return list;
}
export function safeImageUrl(value, base=globalThis.location?.href||'https://www.billsequipmentandrentals.com/') {
  if(!value) return 'assets/equipment-placeholder.svg';
  try {const u=new URL(value,base);return ['https:','http:'].includes(u.protocol)?u.href:'assets/equipment-placeholder.svg';} catch {return 'assets/equipment-placeholder.svg';}
}
export function normalizeBrand(value) {
  const s=String(value||'').trim().replace(/\s+/g,' ');
  const names={'honda':'Honda','stihl':'STIHL','makita':'Makita','milwaukee':'Milwaukee','wacker':'Wacker','wacker neuson':'Wacker Neuson','multiquip':'Multiquip','genie':'Genie','mbw':'MBW','edco':'EDCO','dewalt':'DeWalt'};
  return names[s.toLowerCase()]||s;
}
export function filtersFromURL(search) {
  const p=new URLSearchParams(search); return {q:(p.get('q')||'').slice(0,200),catalog:p.get('catalog')||'',category:p.get('category')||'',brand:p.get('brand')||'',availability:p.get('availability')||'',sort:p.get('sort')||'recommended',mode:['rental','all'].includes(p.get('mode'))?p.get('mode'):'sale',page:Math.max(1,parseInt(p.get('page'),10)||1)};
}
export function filtersURL(filters,path='products.html') {
  const p=new URLSearchParams();for(const [k,v] of Object.entries(filters))if(v!==''&&v!=null&&!(k==='page'&&Number(v)===1)&&!(k==='sort'&&v==='recommended')&&!(k==='mode'&&v==='sale'))p.set(k,String(v));
  return `${path}${p.size?'?'+p:''}`;
}
