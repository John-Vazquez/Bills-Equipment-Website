// Browser test adapter ONLY. Never copied into dist or deployed. No live API calls.
(() => {
 const opts=window.__fixtureOptions||{},uuid=n=>`10000000-0000-4000-8000-${String(n).padStart(12,'0')}`,time='2026-09-17T15:00:00Z';
 const names=['Concrete Vibrators','Floor Grinders & Scarifiers','Reversible Plate Compactors','Single Direction Plate Compactors','Pumps','Walk-Behind Saws','Rammers','Concrete Saws','Mixers','Generators','Scissor Lifts','Pressure Washers'];
 const categories=names.map((name,index)=>({id:uuid(100+index),name,slug:name.toLowerCase().replace(/[^a-z]+/g,'-'),active:true,sort_order:index*10,updated_at:time,parent_id:null,image_path:'',product_image_path:`demo/category-${index+1}.webp`,count:1,sale_count:index===10?0:1,rental_count:index===10?1:0,show_empty:false}));
 const catalogs=[{name:'Construction',slug:'construction',category_ids:[102,103,104,106,109,110]},{name:'Concrete',slug:'concrete',category_ids:[100,101,105,107,108]},{name:'Equipment',slug:'equipment',category_ids:categories.map((_,i)=>100+i)},{name:'Small Engine',slug:'small-engine',category_ids:[104,109]},{name:'Pressure Washing',slug:'pressure-washing',category_ids:[111]},{name:'Shop Supplies',slug:'shop-supplies',category_ids:[101]},{name:'OEM Catalogs',slug:'oem-catalogs',active:false,category_ids:[]},{name:'Parts',slug:'parts',active:false,category_ids:[]}].map((c,i)=>({...c,id:uuid(200+i),description:'',active:c.active!==false,sort_order:(i+1)*10,updated_at:time,category_ids:c.category_ids.map(uuid)}));
 const products=categories.map((c,i)=>({id:uuid(i+1),name:'Demo '+(i===7?'Concrete Saw':i===10?'Scissor Lift':c.name),slug:'demo-equipment-'+(i+1),description:'Demonstration data for isolated browser testing. This is not verified live inventory.',brand:['Honda','Wacker Neuson','Multiquip','STIHL'][i%4],model:'DEMO-'+(i+1),sku:'TEST-'+(i+1),category_id:c.id,category_ids:[c.id],listing_type:i===10?'rental':'product',condition:'unspecified',quantity:1,price:i===7?799:null,call_for_price:i!==7,status:'active',is_published:true,featured:i===7,display_order:i*10,created_at:time,updated_at:time,source:'manual',external_id:null,website:{purchase_mode:'quote',availability:'confirm',rental_call_for_price:true},product_images:[{id:uuid(300+i),product_id:uuid(i+1),storage_path:`demo/category-${i+1}.webp`,alt_text:'Illustrative test equipment',sort_order:0,is_primary:true}]}));
 products.push({...structuredClone(products[0]),id:uuid(80),name:'Demo Draft — private',slug:'demo-draft',is_published:false,product_images:[]});
 products.push({...structuredClone(products[7]),id:uuid(81),name:'Demo Sold Saw',model:'DEMO-SOLD',sku:'TEST-SOLD',slug:'demo-sold',status:'sold',product_images:[]});
 const settings={id:true,phone_main:'305-591-3933',phone_sales:'954-789-9459',email:'earenas@billsequipment.net',address:'3500 NW 115th Ave, Doral, FL 33178',tagline:'If you need it, Bill’s has it!',hero_title:'Built for the Jobsite',hero_subtitle:'Sales  |  Rentals  |  Parts  |  Expert Support',hero_image_path:'',enquiries_enabled:!!opts.enquiries,turnstile_site_key:opts.enquiries?'TEST-PUBLIC':'',updated_at:time};
 let signedIn=!!opts.staff;const session=()=>signedIn?{user:{id:uuid(500),email:'test-staff@example.invalid'},access_token:'fake-test-token'}:null;
 const db=window.__fixtureDB={products,categories,catalogs,settings,receipts:{},calls:[],storage:{},failAfterCommit:!!opts.failAfterCommit,enquiries:[],history:[]};
 if(opts.manyProducts){for(let i=0;i<36;i++)db.products.push({...structuredClone(products[0]),id:uuid(600+i),name:'Pagination fixture '+i,product_images:[]});}
 const publicProduct=p=>p&&p.is_published&&p.status!=='hidden';
 const modeMatch=(p,mode)=>mode==='all'||p.listing_type==='both'||p.listing_type===(mode==='rental'?'rental':'product');
 const clone=v=>structuredClone(v);
 const ok=data=>({data:clone(data),error:null});
 const fail=(message,code='P0001')=>({data:null,error:{message,code}});
 const updated=()=>new Date().toISOString();
 const client={
  auth:{getSession:async()=>ok({session:session()}),signInWithPassword:async()=>{signedIn=true;return ok({session:session()});},signOut:async()=>{signedIn=false;return ok(null);},onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})},
  rpc:async(name,args={})=>{
   db.calls.push({name,args:clone(args)});
   if(opts.legacy&&name.startsWith('bills_'))return fail('Function not found','PGRST202');
   if(opts.networkError&&name.startsWith('bills_public'))return fail('Simulated network failure','NETWORK');
   if(name==='bills_public_catalog')return ok({version:2,settings,categories:categories.filter(c=>c.active),catalogs:catalogs.filter(c=>c.active),brands:[...new Set(products.filter(publicProduct).map(p=>p.brand))].sort()});
   if(name==='bills_public_product')return ok(products.find(p=>publicProduct(p)&&(args.p_id?p.id===args.p_id:p.slug===args.p_slug))||null);
   if(name==='bills_search_products'){
    let rows=products.filter(p=>publicProduct(p)&&modeMatch(p,args.p_mode));
    if(args.p_category_id)rows=rows.filter(p=>p.category_ids.includes(args.p_category_id));
    if(args.p_catalog_slug){const allowed=catalogs.find(c=>c.slug===args.p_catalog_slug)?.category_ids||[];rows=rows.filter(p=>p.category_ids.some(id=>allowed.includes(id)));}
    if(args.p_brand)rows=rows.filter(p=>p.brand===args.p_brand);
    if(args.p_query)rows=rows.filter(p=>args.p_query.toLowerCase().split(/\s+/).every(t=>[p.name,p.brand,p.model,p.sku,p.description].join(' ').toLowerCase().includes(t)));
    if(args.p_availability)rows=rows.filter(p=>(p.status==='sold'?'unavailable':'confirm')===args.p_availability);
    if(args.p_sort==='name')rows.sort((a,b)=>a.name.localeCompare(b.name));
    if(args.p_sort?.startsWith('price-'))rows.sort((a,b)=>{const x=a.call_for_price?null:a.price,y=b.call_for_price?null:b.price;if(x===null)return y===null?0:1;if(y===null)return -1;return args.p_sort==='price-low'?x-y:y-x;});
    const total=rows.length,pages=Math.max(1,Math.ceil(total/(args.p_limit||24))),page=Math.min(pages,args.p_page||1);return ok({items:rows.slice((page-1)*24,page*24),total,pages,page});
   }
   if(name==='bills_admin_snapshot')return signedIn?ok({version:2,products,categories,catalogs,settings}):fail('Employee access required.','42501');
   if(!signedIn)return fail('Employee access required.','42501');
   if(name==='bills_save_product'){
    const receipt=db.receipts[args.p_operation_id];if(receipt)return ok(receipt);
    let p=products.find(x=>x.id===args.p_product.id);if(p&&p.updated_at!==args.p_expected_updated_at)return fail('Product changed.','40001');
    if(!p){p={id:args.p_product.id,created_at:updated(),source:'manual',external_id:null};products.push(p);}
    Object.assign(p,args.p_product,{category_ids:args.p_category_ids,category_id:args.p_category_ids[0]||null,website:args.p_settings,product_images:args.p_images.map((i,k)=>({...i,is_primary:k===0,sort_order:k,product_id:p.id})),updated_at:updated()});
    const result={id:p.id,updated_at:p.updated_at,removed_paths:[]};db.receipts[args.p_operation_id]=result;
    if(db.failAfterCommit){db.failAfterCommit=false;return fail('Simulated lost save response','NETWORK');}return ok(result);
   }
   if(name==='bills_save_catalog'){
    const p={...args.p_catalog,category_ids:args.p_category_ids,updated_at:updated()},old=catalogs.find(x=>x.id===p.id);if(old)Object.assign(old,p);else catalogs.push(p);return ok(p);
   }
   if(name==='bills_save_category'){
    const p={...args.p_category,updated_at:updated()},old=categories.find(x=>x.id===p.id);if(old)Object.assign(old,p);else categories.push(p);
    for(const cat of catalogs){cat.category_ids=cat.category_ids.filter(id=>id!==p.id);if(args.p_catalog_ids.includes(cat.id))cat.category_ids.push(p.id);}return ok(p);
   }
   if(name==='bills_save_settings'){Object.assign(settings,args.p_settings,{updated_at:updated()});return ok(settings);}
   if(name==='bills_set_product_visibility'){for(const p of products.filter(p=>args.p_ids.includes(p.id))){p.is_published=args.p_published;p.updated_at=updated();}return ok(args.p_ids.length);}
   if(name==='bills_bulk_categories'){for(const p of products.filter(p=>args.p_ids.includes(p.id))){p.category_ids=args.p_action==='add'?[...new Set([...p.category_ids,args.p_category_id])]:p.category_ids.filter(id=>id!==args.p_category_id);p.category_id=p.category_ids[0]||null;p.updated_at=updated();}return ok(args.p_ids.length);}
   if(name==='bills_reorder_catalogs'){args.p_ids.forEach((id,i)=>{const c=catalogs.find(c=>c.id===id);c.sort_order=i*10;c.updated_at=updated();});return ok(true);}
   return fail('Unhandled fixture RPC '+name);
  },
  from:table=>{
   let filters=[],range=null,limit=null,one=false,count=false;
   const q={select:(fields,options={})=>{count=options.count==='exact';return q;},eq:(key,value)=>{filters.push(r=>r[key]===value);return q;},neq:(key,value)=>{filters.push(r=>r[key]!==value);return q;},ilike:(key,value)=>{filters.push(r=>String(r[key]).includes(value.replaceAll('%','')));return q;},order:()=>q,range:(from,to)=>{range=[from,to];return q;},limit:n=>{limit=n;return q;},maybeSingle:()=>{one=true;return q;},then:(resolve,reject)=>{
    let rows=table==='products'?products:table==='categories'?categories:table==='admin_profiles'?[{id:uuid(500),active:true,role:'admin',display_name:'billsadmin'}]:table==='bills_enquiries'?db.enquiries:table==='bills_change_log'?db.history:[];
    if(table==='admin_profiles'&&!signedIn)rows=[];rows=rows.filter(r=>filters.every(fn=>fn(r)));const total=rows.length;if(range)rows=rows.slice(range[0],range[1]+1);if(limit)rows=rows.slice(0,limit);return Promise.resolve({...ok(one?rows[0]||null:rows),count:count?total:undefined}).then(resolve,reject);
   }};return q;
  },
  storage:{from:bucket=>({upload:async(path,blob)=>{if(db.storage[bucket+path])return {data:null,error:{statusCode:409,message:'already exists'}};db.storage[bucket+path]=blob;return ok({path});},download:async path=>({data:db.storage[bucket+path],error:null}),remove:async paths=>{for(const p of paths)delete db.storage[bucket+p];return ok([]);}})}
 };
 window.supabase={createClient:()=>client};
 window.turnstile={render:(element,options)=>{element.textContent='Security check passed (isolated test)';queueMicrotask(()=>options.callback('test-token'));return 'test-widget';},reset:()=>{},remove:()=>{}};
})();
