import {getClient,imageURL} from './client.js';
import {DEFAULT_SETTINGS,PRODUCT_BUCKET,MEDIA_BUCKET,PAGE_SIZE} from './config.js';
import {normalizeProduct,legacyCatalogs,filterProducts,primaryImage,descendants} from './model.js';
let snapshotPromise,legacyProducts;
const missing = error => ['PGRST202','42883','42P01'].includes(error?.code);
export const imageFor = p => {const i=primaryImage(p);return i?.storage_path ? imageURL(PRODUCT_BUCKET,i.storage_path):'assets/equipment-placeholder.svg';};
export function categoryImage(c) {return c.image_path ? imageURL(MEDIA_BUCKET,c.image_path) : c.product_image_path ? imageURL(PRODUCT_BUCKET,c.product_image_path) : 'assets/equipment-placeholder.svg';}
async function readLegacy() {
  const client=await getClient();let rows=[];
  for(let offset=0;offset<20000;offset+=500){
    const {data,error}=await client.from('products').select('id,name,slug,description,brand,model,sku,category_id,listing_type,condition,price,call_for_price,quantity,status,featured,is_published,display_order,created_at,updated_at,product_images(id,storage_path,alt_text,sort_order,is_primary)').eq('is_published',true).neq('status','hidden').order('id').range(offset,offset+499);
    if(error)throw error;rows.push(...(data||[]));if((data||[]).length<500)break;if(offset===19500)throw new Error('This catalog requires the included database upgrade to load safely.');
  }
  legacyProducts=rows.map(normalizeProduct);
  const {data:cats,error}=await client.from('categories').select('id,name,slug,active,sort_order').eq('active',true).order('sort_order').order('name');if(error)throw error;
  const categories=(cats||[]).map(c=>{const products=legacyProducts.filter(p=>p.category_id===c.id);return {...c,parent_id:null,count:products.length,sale_count:products.filter(p=>['product','both'].includes(p.listing_type)).length,rental_count:products.filter(p=>['rental','both'].includes(p.listing_type)).length,product_image_path:primaryImage(products.find(p=>primaryImage(p))||{})?.storage_path||'',description:''};});
  return {version:1,legacy:true,categories,catalogs:legacyCatalogs(categories),settings:{...DEFAULT_SETTINGS},brands:[...new Set(rows.map(p=>p.brand).filter(Boolean))].sort()};
}
export function getSnapshot(refresh=false) {
  if(refresh)snapshotPromise=null;
  if(!snapshotPromise)snapshotPromise=(async()=>{
    const client=await getClient();const {data,error}=await client.rpc('bills_public_catalog');
    if(error){if(missing(error))return readLegacy();throw error;}
    if(!data || data.version!==2)throw new Error('The catalog database version does not match this website.');
    return {...data,settings:{...DEFAULT_SETTINGS,...data.settings}};
  })().catch(e=>{snapshotPromise=null;throw e;});
  return snapshotPromise;
}
export async function searchProducts(filters={}) {
  const snapshot=await getSnapshot();
  if(snapshot.legacy){const filtered=filterProducts(legacyProducts,filters,snapshot);const pages=Math.max(1,Math.ceil(filtered.length/PAGE_SIZE));const page=Math.min(pages,Math.max(1,Number(filters.page)||1));return {items:filtered.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE),total:filtered.length,page,pages};}
  const client=await getClient();const {data,error}=await client.rpc('bills_search_products',{p_query:filters.q||'',p_category_id:filters.category||null,p_catalog_slug:filters.catalog||null,p_brand:filters.brand||null,p_availability:filters.availability||null,p_mode:filters.mode||'sale',p_sort:filters.sort||'recommended',p_page:Math.max(1,Number(filters.page)||1),p_limit:PAGE_SIZE});if(error)throw error;
  return {...data,items:(data.items||[]).map(normalizeProduct)};
}
export async function getProduct(id,slug) {
  const s=await getSnapshot();
  if(s.legacy)return legacyProducts.find(p=>id ? p.id===id:p.slug===slug)||null;
  const c=await getClient();const {data,error}=await c.rpc('bills_public_product',{p_id:id||null,p_slug:slug||null});if(error)throw error;return data?normalizeProduct(data):null;
}
export async function getCartProducts(lines) {
  // Refreshes details instead of trusting names, prices or eligibility stored in the browser.
  const results=await Promise.all([...new Set(lines.map(x=>x.id))].map(async id=>[id,await getProduct(id)]));return new Map(results);
}
export function categoriesFor(snapshot,slug='equipment') {
  const catalog=snapshot.catalogs.find(c=>c.slug===slug); if(!catalog)return [];
  const ids=new Set(catalog.category_ids||[]);
  return (catalog.category_ids||[]).map(id=>snapshot.categories.find(c=>c.id===id)).filter(c=>c && c.active!==false && (c.show_empty || c.count>0) && !(c.parent_id && ids.has(c.parent_id)));
}
export function childCategories(snapshot,id) {return snapshot.categories.filter(c=>c.parent_id===id && c.active!==false && (c.count>0||c.show_empty));}
export async function checkStaff() {
  const c=await getClient();const {data:{session},error}=await c.auth.getSession();if(error||!session?.user)return null;
  const {data,error:e}=await c.from('admin_profiles').select('id,role,active,display_name').eq('id',session.user.id).eq('active',true).maybeSingle();
  if(e || !data || !['admin','editor'].includes(data.role))return null;return data;
}
