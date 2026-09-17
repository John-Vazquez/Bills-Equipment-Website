import {getClient} from './client.js';
import {normalizeProduct} from './model.js';
import {DEFAULT_SETTINGS,LOCAL_PREVIEW} from './config.js';
export async function rpc(name,args={}){if(LOCAL_PREVIEW)throw new Error('Local preview is read-only. Use the approved deployed employee website for changes.');const c=await getClient();const {data,error}=await c.rpc(name,args);if(error)throw error;return data;}
export async function adminSnapshot(){
 const c=await getClient();const {data,error}=await c.rpc('bills_admin_snapshot');
 if(error&&['PGRST202','42883'].includes(error.code)){
  let products=[];for(let offset=0;offset<20000;offset+=500){const {data:rows,error:e}=await c.from('products').select('*,product_images(*)').order('id').range(offset,offset+499);if(e)throw e;products.push(...rows);if(rows.length<500)break;if(offset===19500)throw new Error('The legacy inventory is too large to load without the database upgrade.');}
  const {data:categories,error:e}=await c.from('categories').select('*').order('sort_order');if(e)throw e;
  return {legacy:true,products:products.map(normalizeProduct),categories,catalogs:[],settings:{...DEFAULT_SETTINGS}};
 }
 if(error)throw error;if(data.version!==2)throw new Error('Unexpected database version. Do not run an older update over a newer schema.');return {...data,products:data.products.map(normalizeProduct)};
}
export async function listEnquiries({page=1,status='',reference=''}={}){
 const c=await getClient();let q=c.from('bills_enquiries').select('id,reference,kind,customer_name,customer_email,customer_phone,company,message,start_date,end_date,status,staff_notes,created_at,updated_at,notification_status,notification_attempts,notification_sent_at,notification_error,bills_enquiry_items(id,product_id,product_name,model,sku,mode,quantity,listed_price,availability)',{count:'exact'}).order('created_at',{ascending:false});
 if(status)q=q.eq('status',status);if(reference)q=q.ilike('reference','%'+reference.replace(/[%_]/g,'')+'%');
 const {data,error,count}=await q.range((page-1)*25,page*25-1);if(error)throw error;return {items:data||[],total:count||0};
}
export async function changeLog(){const c=await getClient();const {data,error}=await c.from('bills_change_log').select('id,at,actor,entity,entity_id,action,changes').order('id',{ascending:false}).limit(100);if(error)throw error;return data||[];}
