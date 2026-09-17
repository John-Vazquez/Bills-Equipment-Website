-- BILL'S EQUIPMENT ONLY — project rvgyfacefruqgclcbwgb.
-- Unapplied release migration. Review 00-read-only-preflight.sql and back up database + images first.
-- Does NOT change auth.users, passwords, existing product identifiers, or inventory quantities.
-- Keeps the original tables. New website metadata lives in bills_* extension tables.
begin;
set local lock_timeout='8s';
set local statement_timeout='120s';

-- Fail the entire transaction on an incompatible baseline or an unknown namespace collision.
do $$
declare r record; actual text;
begin
 for r in select * from (values
 ('products','id','uuid'),('categories','id','uuid'),('product_images','id','uuid'),
 ('product_images','product_id','uuid'),('products','category_id','uuid'),
 ('admin_profiles','id','uuid'),('admin_profiles','active','bool'),
 ('products','is_published','bool'),('products','created_at','timestamptz'),('products','updated_at','timestamptz')
 ) as v(t,c,expected)
 loop
  select udt_name into actual from information_schema.columns where table_schema='public' and table_name=r.t and column_name=r.c;
  if actual is distinct from r.expected then raise exception 'Preflight mismatch: %.% expected %, found %. No changes applied.',r.t,r.c,r.expected,actual;end if;
 end loop;
 for r in select * from (values ('products','name'),('products','slug'),('products','description'),('products','brand'),('products','model'),('products','sku'),('products','listing_type'),('products','condition'),('products','price'),('products','call_for_price'),('products','quantity'),('products','status'),('products','featured'),('products','display_order'),('products','source'),('products','external_id'),('categories','name'),('categories','slug'),('categories','active'),('categories','sort_order'),('product_images','storage_path'),('product_images','alt_text'),('product_images','sort_order'),('product_images','is_primary'),('admin_profiles','role')) v(t,c)
 loop
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name=r.t and column_name=r.c) then raise exception 'Missing baseline column %.%. Run the read-only preflight before migrating.',r.t,r.c;end if;
 end loop;
 if not exists(select 1 from public.admin_profiles where active and role::text in ('admin','editor')) then raise exception 'No active employee profile. Refusing to install a manager that would lock out staff.';end if;
 if to_regclass('public.bills_schema_version') is null and (exists(select 1 from pg_class where relnamespace='public'::regnamespace and left(relname,6)='bills_') or exists(select 1 from pg_proc where pronamespace='public'::regnamespace and left(proname,6)='bills_')) then raise exception 'Unknown bills_* tables or functions already exist. Review before installing; do not overwrite them blindly.';end if;
 if to_regclass('public.bills_schema_version') is not null then
  execute 'select case when exists(select 1 from public.bills_schema_version where version>2) then ''newer'' else ''ok'' end' into actual;
  if actual='newer' then raise exception 'A newer website schema is installed. Refusing to downgrade.';end if;
 end if;
end $$;

create table if not exists public.bills_schema_version(id boolean primary key default true check(id),version integer not null,installed_at timestamptz not null default now());
create or replace function public.bills_is_staff() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.admin_profiles where id=(select auth.uid()) and active=true and role::text in ('admin','editor'));
$$;
create or replace function public.bills_is_admin() returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.admin_profiles where id=(select auth.uid()) and active=true and role::text='admin');
$$;

create table if not exists public.bills_catalogs(
 id uuid primary key default gen_random_uuid(),name text not null check(length(trim(name)) between 1 and 80),
 slug text not null unique check(slug ~ '^[a-z0-9][a-z0-9-]{0,99}$'),description text not null default '' check(length(description)<=1000),
 active boolean not null default true,sort_order integer not null default 0,updated_at timestamptz not null default now()
);
create table if not exists public.bills_category_settings(
 category_id uuid primary key references public.categories(id) on delete restrict,
 parent_id uuid references public.categories(id) on delete restrict,
 description text not null default '' check(length(description)<=1000),
 image_path text not null default '',show_empty boolean not null default false,
 updated_at timestamptz not null default now(),check(parent_id is distinct from category_id)
);
create table if not exists public.bills_catalog_categories(
 catalog_id uuid not null references public.bills_catalogs(id) on delete cascade,
 category_id uuid not null references public.categories(id) on delete restrict,
 sort_order integer not null default 0,primary key(catalog_id,category_id)
);
create index if not exists bills_catalog_categories_category_idx on public.bills_catalog_categories(category_id);
create table if not exists public.bills_product_categories(
 product_id uuid not null references public.products(id) on delete cascade,
 category_id uuid not null references public.categories(id) on delete restrict,
 is_primary boolean not null default false,sort_order integer not null default 0,primary key(product_id,category_id)
);
create unique index if not exists bills_product_one_primary_idx on public.bills_product_categories(product_id) where is_primary;
create index if not exists bills_product_categories_category_idx on public.bills_product_categories(category_id,product_id);
create table if not exists public.bills_product_settings(
 product_id uuid primary key references public.products(id) on delete cascade,
 purchase_mode text not null default 'quote' check(purchase_mode in ('quote','information')),
 online_purchase_eligible boolean not null default false,
 availability text not null default 'confirm' check(availability in ('confirm','in_stock','unavailable','backorder')),
 stock_verified_at timestamptz,
 rental_call_for_price boolean not null default true,
 rental_day numeric(12,2) check(rental_day>0),rental_week numeric(12,2) check(rental_week>0),rental_month numeric(12,2) check(rental_month>0),
 specifications text not null default '' check(length(specifications)<=20000),updated_at timestamptz not null default now()
);
create table if not exists public.bills_site_settings(
 id boolean primary key default true check(id),
 phone_main text not null default '305-591-3933',phone_sales text not null default '954-789-9459',
 email text not null default 'earenas@billsequipment.net',address text not null default '3500 NW 115th Ave, Doral, FL 33178',
 tagline text not null default 'If you need it, Bill’s has it!',
 hero_title text not null default 'Built for the Jobsite',
 hero_subtitle text not null default 'Sales  |  Rentals  |  Parts  |  Expert Support',hero_image_path text not null default '',
 enquiries_enabled boolean not null default false,turnstile_site_key text not null default '',updated_at timestamptz not null default now()
);
insert into public.bills_site_settings(id) values(true) on conflict do nothing;
create table if not exists public.bills_change_log(
 id bigint generated always as identity primary key,at timestamptz not null default now(),actor uuid,
 entity text not null,entity_id text not null,action text not null,changes jsonb not null default '{}'
);
create table if not exists public.bills_mutation_receipts(
 operation_id uuid primary key,actor uuid not null,fingerprint text not null,result jsonb not null,created_at timestamptz not null default now()
);
create table if not exists public.bills_enquiries(
 id uuid primary key default gen_random_uuid(),submission_id uuid not null unique,fingerprint text not null,
 reference text not null unique,
 kind text not null check(kind in ('contact','quote','rental','mixed')),
 customer_name text not null,customer_email text not null,customer_phone text not null,company text not null default '',
 message text not null default '',start_date date,end_date date,
 consent_version text not null default 'request-response-v1',
 status text not null default 'new' check(status in ('new','in_progress','awaiting_customer','closed','spam')),
 staff_notes text not null default '',created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 notification_status text not null default 'pending' check(notification_status in ('pending','sending','sent','failed')),
 notification_claimed_at timestamptz,notification_first_attempt_at timestamptz,notification_attempts integer not null default 0,notification_sent_at timestamptz,notification_error text,
 check(end_date is null or (start_date is not null and end_date>=start_date))
);
alter table public.bills_enquiries add column if not exists notification_first_attempt_at timestamptz;
create index if not exists bills_enquiries_status_created_idx on public.bills_enquiries(status,created_at desc);
create table if not exists public.bills_enquiry_items(
 id bigint generated always as identity primary key,enquiry_id uuid not null references public.bills_enquiries(id) on delete cascade,
 product_id uuid references public.products(id) on delete set null,
 product_name text not null,model text,sku text,mode text not null check(mode in ('sale','rental')),
 quantity integer not null check(quantity between 1 and 99),listed_price numeric(12,2),availability text not null,
 unique(enquiry_id,product_id,mode)
);
create table if not exists public.bills_request_limits(
 key text not null,window_at timestamptz not null,total integer not null,primary key(key,window_at)
);

-- Backfill relationships only. Do not republish, reprice or reset quantities.
insert into public.bills_product_categories(product_id,category_id,is_primary,sort_order)
select id,category_id,true,0 from public.products where category_id is not null on conflict do nothing;
insert into public.bills_product_settings(product_id) select id from public.products on conflict do nothing;
insert into public.bills_category_settings(category_id) select id from public.categories on conflict do nothing;
-- Seed mappings only on first installation so rerunning cannot overwrite employee organization.
do $$ begin
 if not exists(select 1 from public.bills_schema_version where id=true) then
insert into public.bills_catalogs(slug,name,sort_order,active) values
('construction','Construction',10,true),('concrete','Concrete',20,true),('equipment','Equipment',30,true),
('small-engine','Small Engine',40,true),('pressure-washing','Pressure Washing',50,true),('shop-supplies','Shop Supplies',60,true),
('oem-catalogs','OEM Catalogs',70,false),('parts','Parts',80,false) on conflict(slug) do nothing;
  insert into public.bills_catalog_categories(catalog_id,category_id,sort_order)
  select cat.id,c.id,coalesce(c.sort_order,0) from public.bills_catalogs cat cross join public.categories c
  where c.active=true and (
   cat.slug='equipment' or
   (cat.slug='construction' and c.name ~* 'aerial|lift|compac|roller|air compressor|air tool|water pump|generator|scaffold|rammer') or
   (cat.slug='concrete' and c.name ~* 'concrete|mortar|mixer|saw|cutting|rebar|curb|screed|finisher|grind|scarifi|vibrat') or
   (cat.slug='small-engine' and c.name ~* 'engine|generator|water pump') or
   (cat.slug='pressure-washing' and c.name ~* 'pressure|washer') or
   (cat.slug='shop-supplies' and c.name ~* 'safety|hand tool|power tool|laser|hardware|supply|supplies')
  ) on conflict do nothing;
 end if;
end $$;

-- Compatibility: category_id remains the primary category; secondary assignments remain independent.
create or replace function public.bills_sync_primary_category() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if TG_OP='UPDATE' and old.category_id is not distinct from new.category_id then return new;end if;
 if TG_OP='UPDATE' then delete from public.bills_product_categories where product_id=new.id and is_primary and category_id is distinct from new.category_id;end if;
 update public.bills_product_categories set is_primary=false where product_id=new.id;
 if new.category_id is not null then
  insert into public.bills_product_categories(product_id,category_id,is_primary) values(new.id,new.category_id,true)
  on conflict(product_id,category_id) do update set is_primary=true;
 end if;
 return new;
end $$;
drop trigger if exists bills_primary_category on public.products;
create trigger bills_primary_category after insert or update of category_id on public.products for each row execute function public.bills_sync_primary_category();

create or replace function public.bills_log_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare before_data jsonb;after_data jsonb;entity_key text;
begin
 before_data=case when TG_OP in ('UPDATE','DELETE') then to_jsonb(old) else '{}'::jsonb end;
 after_data=case when TG_OP in ('INSERT','UPDATE') then to_jsonb(new) else '{}'::jsonb end;
 entity_key=coalesce(after_data->>'id',after_data->>'product_id',after_data->>'category_id',before_data->>'id',before_data->>'product_id',before_data->>'category_id','settings');
 if TG_TABLE_NAME='bills_enquiries' then
  before_data=jsonb_build_object('status',before_data->>'status');after_data=jsonb_build_object('status',after_data->>'status','reference',after_data->>'reference');
 end if;
 insert into public.bills_change_log(actor,entity,entity_id,action,changes) values(auth.uid(),TG_TABLE_NAME,entity_key,TG_OP,jsonb_build_object('before',before_data,'after',after_data));
 if TG_OP='DELETE' then return old;else return new;end if;
end $$;
do $$ declare t text;begin
 foreach t in array array['products','categories','bills_catalogs','bills_category_settings','bills_product_settings','bills_site_settings','bills_enquiries'] loop
  execute format('drop trigger if exists bills_change_log_trigger on public.%I',t);
  execute format('create trigger bills_change_log_trigger after insert or update or delete on public.%I for each row execute function public.bills_log_change()',t);
 end loop;
end $$;

-- Read policies plus restrictive guards: an older permissive policy cannot broaden public access.
alter table public.admin_profiles enable row level security;
revoke all on public.admin_profiles from public,anon,authenticated;
grant select on public.admin_profiles to authenticated;
drop policy if exists bills_own_profile_allow on public.admin_profiles;
create policy bills_own_profile_allow on public.admin_profiles for select to authenticated using(id=auth.uid());
drop policy if exists bills_own_profile_guard on public.admin_profiles;
create policy bills_own_profile_guard on public.admin_profiles as restrictive for select to authenticated using(id=auth.uid());
-- Table revokes do not necessarily remove historical column grants. Explicit restrictive guards
-- also prevent an old permissive policy from allowing self-promotion through such a grant.
drop policy if exists bills_no_profile_insert on public.admin_profiles;
create policy bills_no_profile_insert on public.admin_profiles as restrictive for insert to anon,authenticated with check(false);
drop policy if exists bills_no_profile_update on public.admin_profiles;
create policy bills_no_profile_update on public.admin_profiles as restrictive for update to anon,authenticated using(false) with check(false);
drop policy if exists bills_no_profile_delete on public.admin_profiles;
create policy bills_no_profile_delete on public.admin_profiles as restrictive for delete to anon,authenticated using(false);

do $$ declare t text;pred text;cmd text;begin
 foreach t in array array['products','categories','product_images'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to anon,authenticated',t);
  execute format('grant insert,update,delete on public.%I to authenticated',t);
  pred=case t when 'products' then '(is_published=true and status::text<>''hidden'')'
   when 'categories' then '(active=true)'
   else 'exists(select 1 from public.products p where p.id=product_id and p.is_published=true and p.status::text<>''hidden'')' end;
  execute format('drop policy if exists bills_read_allow on public.%I',t);
  execute format('drop policy if exists bills_read_guard on public.%I',t);
  execute format('create policy bills_read_allow on public.%I for select to anon,authenticated using(public.bills_is_staff() or %s)',t,pred);
  execute format('create policy bills_read_guard on public.%I as restrictive for select to anon,authenticated using(public.bills_is_staff() or %s)',t,pred);
  foreach cmd in array array['insert','update','delete'] loop
   execute format('drop policy if exists bills_%s_allow on public.%I',cmd,t);
   execute format('drop policy if exists bills_%s_guard on public.%I',cmd,t);
   if cmd='insert' then
    execute format('create policy bills_insert_allow on public.%I for insert to authenticated with check(public.bills_is_staff())',t);
    execute format('create policy bills_insert_guard on public.%I as restrictive for insert to anon,authenticated with check(public.bills_is_staff())',t);
   elsif cmd='update' then
    execute format('create policy bills_update_allow on public.%I for update to authenticated using(public.bills_is_staff()) with check(public.bills_is_staff())',t);
    execute format('create policy bills_update_guard on public.%I as restrictive for update to anon,authenticated using(public.bills_is_staff()) with check(public.bills_is_staff())',t);
   else
    execute format('create policy bills_delete_allow on public.%I for delete to authenticated using(public.bills_is_staff())',t);
    execute format('create policy bills_delete_guard on public.%I as restrictive for delete to anon,authenticated using(public.bills_is_staff())',t);
   end if;
  end loop;
 end loop;
 foreach t in array array['bills_schema_version','bills_catalogs','bills_category_settings','bills_catalog_categories','bills_product_categories','bills_product_settings','bills_site_settings','bills_change_log','bills_mutation_receipts','bills_enquiries','bills_enquiry_items','bills_request_limits'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant all on public.%I to service_role',t);
  if t not in ('bills_mutation_receipts','bills_request_limits') then
   execute format('grant select on public.%I to authenticated',t);
   execute format('drop policy if exists bills_staff_read on public.%I',t);
   execute format('create policy bills_staff_read on public.%I for select to authenticated using(public.bills_is_staff())',t);
  end if;
 end loop;
end $$;
-- No public direct writes to enquiry tables; only the verified Edge Function can submit.

create or replace function public.bills_category_descendants(p_id uuid) returns uuid[]
language sql stable security definer set search_path='' as $$
 with recursive nodes as (
  select id from public.categories where id=p_id and active=true
  union
  select c.id from public.categories c join public.bills_category_settings s on s.category_id=c.id join nodes n on n.id=s.parent_id where c.active=true
 ) select coalesce(array_agg(id),'{}'::uuid[]) from nodes;
$$;
create or replace function public.bills_effective_availability(p public.products,s public.bills_product_settings) returns text
language sql stable set search_path='' as $$
 select case when p.status::text in ('sold','out_of_stock') or s.availability='unavailable' then 'unavailable'
 when s.availability='backorder' then 'backorder'
 when s.availability='in_stock' and p.quantity>0 and s.stock_verified_at between now()-interval '30 days' and now() then 'in_stock' else 'confirm' end;
$$;
create or replace function public.bills_product_payload(p public.products) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
  'id',p.id,'name',p.name,'slug',p.slug,'description',p.description,'brand',p.brand,'model',p.model,'sku',p.sku,
  'category_id',p.category_id,'category_ids',coalesce((select jsonb_agg(pc.category_id order by pc.is_primary desc,pc.sort_order,pc.category_id) from public.bills_product_categories pc join public.categories c on c.id=pc.category_id where pc.product_id=p.id and c.active=true),'[]'::jsonb),
  'listing_type',p.listing_type,'condition',p.condition,'price',p.price,'call_for_price',p.call_for_price,
  'quantity',case when public.bills_effective_availability(p,s)='in_stock' then p.quantity else null end,
  'status',p.status,'featured',p.featured,'is_published',p.is_published,'display_order',p.display_order,'created_at',p.created_at,'updated_at',p.updated_at,
  'website',coalesce(to_jsonb(s)-'product_id','{}'::jsonb),
  'product_images',coalesce((select jsonb_agg(jsonb_build_object('id',i.id,'storage_path',i.storage_path,'alt_text',i.alt_text,'sort_order',i.sort_order,'is_primary',i.is_primary) order by i.is_primary desc,i.sort_order,i.id) from public.product_images i where i.product_id=p.id),'[]'::jsonb))
 from (select 1) dummy left join public.bills_product_settings s on s.product_id=p.id;
$$;
create or replace function public.bills_public_catalog() returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('version',2,
 'settings',(select to_jsonb(s)-'id' from public.bills_site_settings s where id=true),
 'catalogs',coalesce((select jsonb_agg(jsonb_build_object('id',cat.id,'name',cat.name,'slug',cat.slug,'description',cat.description,'active',cat.active,'sort_order',cat.sort_order,
 'category_ids',coalesce((select jsonb_agg(cc.category_id order by cc.sort_order,c.name,c.id) from public.bills_catalog_categories cc join public.categories c on c.id=cc.category_id where cc.catalog_id=cat.id and c.active=true),'[]'::jsonb)) order by cat.sort_order,cat.name) from public.bills_catalogs cat where cat.active=true),'[]'::jsonb),
 'categories',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'slug',c.slug,'active',c.active,'sort_order',c.sort_order,'parent_id',cs.parent_id,'description',coalesce(cs.description,''),'image_path',coalesce(cs.image_path,''),'show_empty',coalesce(cs.show_empty,false),
 'count',(select count(distinct p.id) from public.products p join public.bills_product_categories pc on pc.product_id=p.id where p.is_published and p.status::text<>'hidden' and pc.category_id=any(public.bills_category_descendants(c.id))),
 'sale_count',(select count(distinct p.id) from public.products p join public.bills_product_categories pc on pc.product_id=p.id where p.is_published and p.status::text<>'hidden' and p.listing_type::text in ('product','both') and pc.category_id=any(public.bills_category_descendants(c.id))),
 'rental_count',(select count(distinct p.id) from public.products p join public.bills_product_categories pc on pc.product_id=p.id where p.is_published and p.status::text<>'hidden' and p.listing_type::text in ('rental','both') and pc.category_id=any(public.bills_category_descendants(c.id))),
 'product_image_path',(select i.storage_path from public.products p join public.bills_product_categories pc on pc.product_id=p.id join public.product_images i on i.product_id=p.id where p.is_published and p.status::text<>'hidden' and pc.category_id=any(public.bills_category_descendants(c.id)) order by p.featured desc,p.display_order,i.is_primary desc,i.sort_order,i.id limit 1)) order by c.sort_order,c.name) from public.categories c left join public.bills_category_settings cs on cs.category_id=c.id where c.active=true),'[]'::jsonb),
 'brands',coalesce((select jsonb_agg(brand order by lower(brand)) from (select distinct trim(brand) as brand from public.products where is_published and status::text<>'hidden' and nullif(trim(brand),'') is not null) b),'[]'::jsonb));
$$;
create or replace function public.bills_public_product(p_id uuid default null,p_slug text default null) returns jsonb
language sql stable security definer set search_path='' as $$
 select public.bills_product_payload(p) from public.products p where p.is_published=true and p.status::text<>'hidden' and ((p_id is not null and p.id=p_id) or (p_id is null and p.slug=p_slug)) limit 1;
$$;
create or replace function public.bills_search_products(
 p_query text default '',p_category_id uuid default null,p_catalog_slug text default null,p_brand text default null,
 p_availability text default null,p_mode text default 'sale',p_sort text default 'recommended',p_page integer default 1,p_limit integer default 24
) returns jsonb language sql stable security definer set search_path='' as $$
 with scope as (
 select case when p_category_id is null then null else public.bills_category_descendants(p_category_id) end as category_ids,
 case when p_catalog_slug is null then null else coalesce((select array_agg(distinct d.id) from public.bills_catalogs c join public.bills_catalog_categories cc on cc.catalog_id=c.id cross join lateral unnest(public.bills_category_descendants(cc.category_id)) d(id) where c.slug=p_catalog_slug and c.active=true),'{}'::uuid[]) end as catalog_ids
 ),filtered as (
 select p as product,case when p_mode='rental' then case when not s.rental_call_for_price then s.rental_day end else case when not p.call_for_price then p.price end end as sort_price from public.products p left join public.bills_product_settings s on s.product_id=p.id cross join scope sc
 where p.is_published=true and p.status::text<>'hidden'
 and ((p_mode='all' and p.listing_type::text in ('product','rental','both')) or (p_mode='rental' and p.listing_type::text in ('rental','both')) or (p_mode='sale' and p.listing_type::text in ('product','both')))
 and (sc.category_ids is null or exists(select 1 from public.bills_product_categories pc where pc.product_id=p.id and pc.category_id=any(sc.category_ids)))
 and (sc.catalog_ids is null or exists(select 1 from public.bills_product_categories pc where pc.product_id=p.id and pc.category_id=any(sc.catalog_ids)))
 and (p_brand is null or lower(trim(p.brand))=lower(trim(p_brand)))
 and (p_availability is null or public.bills_effective_availability(p,s)=p_availability)
 and not exists(select 1 from regexp_split_to_table(lower(trim(left(coalesce(p_query,''),200))),'\s+') term where term<>'' and position(term in lower(concat_ws(' ',p.name,p.brand,p.model,p.sku,p.description)))=0)
 ),totals as (select count(*) as total,greatest(1,least(coalesce(p_limit,24),60)) as size from filtered),
 pagination as (select total,size,greatest(1,ceil(total::numeric/size)::integer) as pages,least(greatest(1,coalesce(p_page,1)),greatest(1,ceil(total::numeric/size)::integer)) as page from totals),
 page_items as (
 select f.product from filtered f
 order by
 case when p_sort='name' then lower((f.product).name) end asc nulls last,
 case when p_sort='newest' then (f.product).created_at end desc nulls last,
 case when p_sort='price-low' and p_mode<>'all' then f.sort_price end asc nulls last,
 case when p_sort='price-high' and p_mode<>'all' then f.sort_price end desc nulls last,
 (f.product).featured desc,(f.product).display_order,lower((f.product).name),(f.product).id
 limit (select size from pagination) offset (select (page-1)*size from pagination)
 ) select jsonb_build_object('items',coalesce((select jsonb_agg(public.bills_product_payload(product)) from page_items),'[]'::jsonb),'total',total,'page',page,'pages',pages) from pagination;
$$;
create or replace function public.bills_admin_snapshot() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.bills_is_staff() then raise exception 'Employee access required.' using errcode='42501';end if;
 if (select count(*) from public.products)>10000 then raise exception 'This inventory requires the paginated manager upgrade. No partial inventory was returned.';end if;
 return jsonb_build_object('version',2,
 'products',coalesce((select jsonb_agg(to_jsonb(p)||jsonb_build_object('website',coalesce((select to_jsonb(s) from public.bills_product_settings s where s.product_id=p.id),'{}'::jsonb),'category_ids',coalesce((select jsonb_agg(pc.category_id order by pc.is_primary desc,pc.sort_order,pc.category_id) from public.bills_product_categories pc where pc.product_id=p.id),'[]'::jsonb),'product_images',coalesce((select jsonb_agg(to_jsonb(i) order by i.is_primary desc,i.sort_order,i.id) from public.product_images i where i.product_id=p.id),'[]'::jsonb)) order by p.display_order,p.name) from public.products p),'[]'::jsonb),
 'categories',coalesce((select jsonb_agg(to_jsonb(c)||coalesce(to_jsonb(s)-'category_id','{}'::jsonb) order by c.sort_order,c.name) from public.categories c left join public.bills_category_settings s on s.category_id=c.id),'[]'::jsonb),
 'catalogs',coalesce((select jsonb_agg(to_jsonb(c)||jsonb_build_object('category_ids',coalesce((select jsonb_agg(cc.category_id order by cc.sort_order,cc.category_id) from public.bills_catalog_categories cc where cc.catalog_id=c.id),'[]'::jsonb)) order by c.sort_order,c.name) from public.bills_catalogs c),'[]'::jsonb),
 'settings',(select to_jsonb(s) from public.bills_site_settings s where id=true));
end $$;

-- Product + placements + image metadata are one database transaction.
-- Files are staged separately by the browser; ambiguous failures are retried with the same operation ID.
create or replace function public.bills_save_product(p_product jsonb,p_settings jsonb,p_category_ids uuid[],p_images jsonb,p_expected_updated_at text,p_operation_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_id uuid;v_old public.products%rowtype;v_new public.products%rowtype;v_existing boolean;
 v_settings public.bills_product_settings%rowtype;v_receipt public.bills_mutation_receipts%rowtype;
 v_hash text;v_result jsonb;v_removed jsonb;v_image jsonb;v_path text;v_index integer=0;v_primary uuid;
begin
 if not public.bills_is_staff() then raise exception 'Employee access required.' using errcode='42501';end if;
 if p_operation_id is null then raise exception 'A save operation ID is required.';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_operation_id::text,714));
 v_hash=md5(jsonb_build_object('product',p_product,'settings',p_settings,'categories',p_category_ids,'images',p_images,'expected',p_expected_updated_at)::text);
 select * into v_receipt from public.bills_mutation_receipts where operation_id=p_operation_id;
 if found then
  if v_receipt.actor<>auth.uid() or v_receipt.fingerprint<>v_hash then raise exception 'This save token was already used for different changes. Refresh before saving.';end if;
  return v_receipt.result;
 end if;
 v_id=(p_product->>'id')::uuid;
 if v_id is null or length(trim(coalesce(p_product->>'name',''))) not between 1 and 200 then raise exception 'A product ID and name are required (maximum 200 characters).';end if;
 if length(coalesce(p_product->>'description',''))>30000 then raise exception 'Description is too long.';end if;
 if jsonb_typeof(p_images)<>'array' or jsonb_array_length(p_images)>12 then raise exception 'A product can have up to 12 photos.';end if;
 if cardinality(coalesce(p_category_ids,'{}'))>40 then raise exception 'Choose at most 40 categories.';end if;
 if cardinality(coalesce(p_category_ids,'{}'))<>(select count(distinct x) from unnest(p_category_ids) x) then raise exception 'Duplicate category assignments.';end if;
 if exists(select 1 from unnest(p_category_ids) x where not exists(select 1 from public.categories c where c.id=x)) then raise exception 'A selected category no longer exists.';end if;
 select * into v_old from public.products where id=v_id for update;v_existing=found;
 if v_existing then
  if p_expected_updated_at is null or v_old.updated_at is distinct from p_expected_updated_at::timestamptz then raise exception 'This product changed in another session. Close and reopen it before saving.' using errcode='40001';end if;
 else
  if p_expected_updated_at is not null then raise exception 'The product no longer exists. Your changes were not applied.';end if;
 end if;
 -- Only this explicit field set is writable. source, external_id and created_at are preserved.
 select * into v_new from jsonb_populate_record(v_old,jsonb_build_object(
 'id',v_id,'name',trim(p_product->>'name'),'slug',case when v_existing then coalesce(nullif(v_old.slug,''),p_product->>'slug') else p_product->>'slug' end,
 'description',coalesce(p_product->>'description',''),'brand',nullif(trim(p_product->>'brand'),''),'model',nullif(trim(p_product->>'model'),''),'sku',nullif(trim(p_product->>'sku'),''),
 'category_id',p_category_ids[1],'listing_type',p_product->>'listing_type','condition',p_product->>'condition',
 'price',case when coalesce((p_product->>'call_for_price')::boolean,true) then null else nullif(p_product->>'price','')::numeric end,
 'call_for_price',coalesce((p_product->>'call_for_price')::boolean,true),'quantity',coalesce((p_product->>'quantity')::integer,0),
 'status',p_product->>'status','is_published',coalesce((p_product->>'is_published')::boolean,false),'featured',coalesce((p_product->>'featured')::boolean,false),
 'display_order',coalesce((p_product->>'display_order')::integer,0)));
 if v_new.listing_type::text not in ('product','rental','both') or v_new.status::text not in ('active','out_of_stock','sold','hidden') or v_new.condition::text not in ('unspecified','new','used','refurbished') then raise exception 'Invalid product type, status or condition.';end if;
 if v_new.quantity<0 or v_new.quantity>1000000 or (not v_new.call_for_price and (v_new.price is null or v_new.price<0)) then raise exception 'Enter a non-negative stock quantity and a valid price, or choose Call for Price.';end if;
 if v_new.slug is null or v_new.slug !~ '^[a-z0-9][a-z0-9-]{0,149}$' then raise exception 'Invalid product slug.';end if;
 if v_new.is_published and cardinality(coalesce(p_category_ids,'{}'))=0 then raise exception 'Assign at least one category before publishing.';end if;
 if coalesce(p_settings->>'purchase_mode','quote') not in ('quote','information') then raise exception 'Online checkout is not enabled. Choose Quote or Information only.';end if;
 if coalesce(p_settings->>'availability','confirm') not in ('confirm','in_stock','unavailable','backorder') then raise exception 'Invalid availability.';end if;
 select * into v_settings from public.bills_product_settings where product_id=v_id;
 if p_settings->>'availability'='in_stock' and ((coalesce(v_settings.availability,'confirm')<>'in_stock' and coalesce((p_settings->>'verify_stock_now')::boolean,false)=false) or v_new.quantity<=0) then raise exception 'Confirm physical stock and enter a positive quantity before selecting Stock confirmed.';end if;
 -- Prevent an employee accidentally linking a photo that belongs to another product.
 for v_image in select value from jsonb_array_elements(p_images) loop
  if (v_image->>'id')::uuid is null or nullif(v_image->>'storage_path','') is null then raise exception 'Every image requires an ID and storage path.';end if;
  v_path=v_image->>'storage_path';
  if exists(select 1 from public.product_images i where i.id=(v_image->>'id')::uuid and i.product_id<>v_id) then raise exception 'Image belongs to a different product.';end if;
  if not exists(select 1 from public.product_images i where i.product_id=v_id and i.storage_path=v_path) then
   if v_path !~ ('^'||v_id::text||'/[0-9a-f-]+\.(webp|jpg|jpeg|png|avif)$') or not exists(select 1 from storage.objects o where o.bucket_id='bills-product-images' and o.name=v_path) then raise exception 'An uploaded image is missing or has an invalid path.';end if;
  end if;
 end loop;
 if (select count(*) from jsonb_array_elements(p_images))<>(select count(distinct value->>'id') from jsonb_array_elements(p_images)) then raise exception 'Duplicate image IDs.';end if;
 select coalesce(jsonb_agg(storage_path),'[]'::jsonb) into v_removed from public.product_images i where i.product_id=v_id and not exists(select 1 from public.product_images other where other.storage_path=i.storage_path and other.product_id<>v_id) and not exists(select 1 from jsonb_array_elements(p_images) j where j->>'storage_path'=i.storage_path);
 if v_existing then
  update public.products set name=v_new.name,description=v_new.description,brand=v_new.brand,model=v_new.model,sku=v_new.sku,category_id=v_new.category_id,
  listing_type=v_new.listing_type,condition=v_new.condition,price=v_new.price,call_for_price=v_new.call_for_price,quantity=v_new.quantity,status=v_new.status,
  is_published=v_new.is_published,featured=v_new.featured,display_order=v_new.display_order,updated_at=clock_timestamp() where id=v_id;
 else
  insert into public.products(id,name,slug,description,brand,model,sku,category_id,listing_type,condition,price,call_for_price,quantity,status,is_published,featured,display_order,source,created_at,updated_at)
  values(v_id,v_new.name,v_new.slug,v_new.description,v_new.brand,v_new.model,v_new.sku,v_new.category_id,v_new.listing_type,v_new.condition,v_new.price,v_new.call_for_price,v_new.quantity,v_new.status,v_new.is_published,v_new.featured,v_new.display_order,'manual',clock_timestamp(),clock_timestamp());
 end if;
 delete from public.bills_product_categories where product_id=v_id;
 insert into public.bills_product_categories(product_id,category_id,is_primary,sort_order) select v_id,x.id,x.ord=1,x.ord::integer from unnest(p_category_ids) with ordinality x(id,ord);
 insert into public.bills_product_settings(product_id,purchase_mode,online_purchase_eligible,availability,stock_verified_at,rental_call_for_price,rental_day,rental_week,rental_month,specifications)
 values(v_id,coalesce(p_settings->>'purchase_mode','quote'),coalesce((p_settings->>'online_purchase_eligible')::boolean,false),coalesce(p_settings->>'availability','confirm'),
 case when p_settings->>'availability'='in_stock' then case when coalesce((p_settings->>'verify_stock_now')::boolean,false) then clock_timestamp() else v_settings.stock_verified_at end else null end,
 coalesce((p_settings->>'rental_call_for_price')::boolean,true),nullif(p_settings->>'rental_day','')::numeric,nullif(p_settings->>'rental_week','')::numeric,nullif(p_settings->>'rental_month','')::numeric,coalesce(p_settings->>'specifications',''))
 on conflict(product_id) do update set purchase_mode=excluded.purchase_mode,online_purchase_eligible=excluded.online_purchase_eligible,availability=excluded.availability,stock_verified_at=excluded.stock_verified_at,rental_call_for_price=excluded.rental_call_for_price,rental_day=excluded.rental_day,rental_week=excluded.rental_week,rental_month=excluded.rental_month,specifications=excluded.specifications,updated_at=clock_timestamp();
 if exists(select 1 from public.bills_product_settings where product_id=v_id and not rental_call_for_price and rental_day is null and rental_week is null and rental_month is null) then raise exception 'Set a rental rate or choose Request rental rate.';end if;
 delete from public.product_images where product_id=v_id and id not in(select (value->>'id')::uuid from jsonb_array_elements(p_images));
 update public.product_images set is_primary=false where product_id=v_id;
 v_index=0;
 for v_image in select value from jsonb_array_elements(p_images) loop
  insert into public.product_images(id,product_id,storage_path,alt_text,sort_order,is_primary) values((v_image->>'id')::uuid,v_id,v_image->>'storage_path',left(coalesce(v_image->>'alt_text',v_new.name),250),v_index,v_index=0)
  on conflict(id) do update set storage_path=excluded.storage_path,alt_text=excluded.alt_text,sort_order=excluded.sort_order,is_primary=excluded.is_primary;
  v_index=v_index+1;
 end loop;
 v_result=jsonb_build_object('id',v_id,'updated_at',(select updated_at from public.products where id=v_id),'removed_paths',v_removed);
 insert into public.bills_mutation_receipts(operation_id,actor,fingerprint,result) values(p_operation_id,auth.uid(),v_hash,v_result);
 return v_result;
end $$;

create or replace function public.bills_save_catalog(p_catalog jsonb,p_category_ids uuid[],p_expected_updated_at text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_id uuid=(p_catalog->>'id')::uuid;v_old public.bills_catalogs%rowtype;v_new public.bills_catalogs%rowtype;v_exists boolean;
begin
 if not public.bills_is_staff() then raise exception 'Employee access required.' using errcode='42501';end if;
 if v_id is null then raise exception 'Catalog ID required.';end if;
 select * into v_old from public.bills_catalogs where id=v_id for update;v_exists=found;
 if v_exists and (p_expected_updated_at is null or v_old.updated_at is distinct from p_expected_updated_at::timestamptz) then raise exception 'This catalog changed. Reopen it before saving.' using errcode='40001';end if;
 if cardinality(coalesce(p_category_ids,'{}'))<>(select count(distinct x) from unnest(p_category_ids) x) then raise exception 'Duplicate categories.';end if;
 insert into public.bills_catalogs(id,name,slug,description,active,sort_order) values(v_id,trim(p_catalog->>'name'),p_catalog->>'slug',coalesce(p_catalog->>'description',''),coalesce((p_catalog->>'active')::boolean,true),coalesce((p_catalog->>'sort_order')::integer,0))
 on conflict(id) do update set name=excluded.name,slug=excluded.slug,description=excluded.description,active=excluded.active,sort_order=excluded.sort_order,updated_at=clock_timestamp() returning * into v_new;
 delete from public.bills_catalog_categories where catalog_id=v_id;
 insert into public.bills_catalog_categories(catalog_id,category_id,sort_order) select v_id,x.id,x.ord::integer*10 from unnest(p_category_ids) with ordinality x(id,ord);
 return to_jsonb(v_new);
end $$;
create or replace function public.bills_save_category(p_category jsonb,p_catalog_ids uuid[],p_expected_updated_at text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare v_id uuid=(p_category->>'id')::uuid;v_parent uuid=nullif(p_category->>'parent_id','')::uuid;v_path text=coalesce(p_category->>'image_path','');v_old public.bills_category_settings%rowtype;v_exists boolean;
begin
 if not public.bills_is_staff() then raise exception 'Employee access required.' using errcode='42501';end if;
 if v_id is null or length(trim(coalesce(p_category->>'name',''))) not between 1 and 120 or coalesce(p_category->>'slug','') !~ '^[a-z0-9][a-z0-9-]{0,149}$' then raise exception 'Category name and a valid slug are required.';end if;
 -- Serializes hierarchy edits to prevent two simultaneous saves from creating a cycle.
 perform pg_advisory_xact_lock(9172026);
 perform 1 from public.categories where id=v_id for update;v_exists=found;
 select * into v_old from public.bills_category_settings where category_id=v_id;
 if v_exists and v_old.category_id is not null and (p_expected_updated_at is null or v_old.updated_at is distinct from p_expected_updated_at::timestamptz) then raise exception 'This category changed. Reopen it before saving.' using errcode='40001';end if;
 if v_parent=v_id or (v_parent is not null and exists(with recursive children as(select category_id from public.bills_category_settings where parent_id=v_id union select s.category_id from public.bills_category_settings s join children c on s.parent_id=c.category_id) select 1 from children where category_id=v_parent)) then raise exception 'A category cannot be inside itself or its own subcategory.';end if;
 if v_path<>'' and v_path is distinct from v_old.image_path and (v_path !~ ('^categories/'||v_id::text||'/[0-9a-f-]+\.webp$') or not exists(select 1 from storage.objects where bucket_id='bills-site-media' and name=v_path)) then raise exception 'The category image upload is missing or invalid.';end if;
 insert into public.categories(id,name,slug,active,sort_order) values(v_id,trim(p_category->>'name'),p_category->>'slug',coalesce((p_category->>'active')::boolean,true),coalesce((p_category->>'sort_order')::integer,0))
 on conflict(id) do update set name=excluded.name,slug=excluded.slug,active=excluded.active,sort_order=excluded.sort_order;
 insert into public.bills_category_settings(category_id,parent_id,description,image_path,show_empty) values(v_id,v_parent,coalesce(p_category->>'description',''),v_path,coalesce((p_category->>'show_empty')::boolean,false))
 on conflict(category_id) do update set parent_id=excluded.parent_id,description=excluded.description,image_path=excluded.image_path,show_empty=excluded.show_empty,updated_at=clock_timestamp();
 delete from public.bills_catalog_categories where category_id=v_id and catalog_id<>all(coalesce(p_catalog_ids,'{}'));
 insert into public.bills_catalog_categories(catalog_id,category_id,sort_order) select x,v_id,coalesce((select max(sort_order)+10 from public.bills_catalog_categories where catalog_id=x),10) from unnest(p_catalog_ids) x on conflict do nothing;
 return (select to_jsonb(s) from public.bills_category_settings s where category_id=v_id);
end $$;
create or replace function public.bills_set_product_visibility(p_ids uuid[],p_published boolean,p_expected jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare r public.products%rowtype;n integer=0;
begin
 if not public.bills_is_staff() then raise exception 'Employee access required.' using errcode='42501';end if;
 if cardinality(p_ids) not between 1 and 200 then raise exception 'Select between 1 and 200 products.';end if;
 for r in select * from public.products where id=any(p_ids) order by id for update loop
  if (p_expected->>r.id::text) is null or r.updated_at is distinct from (p_expected->>r.id::text)::timestamptz then raise exception 'A selected product changed. Refresh before publishing.' using errcode='40001';end if;
  if p_published and not exists(select 1 from public.bills_product_categories where product_id=r.id) then raise exception '% needs a category before publishing.',r.name;end if;
  update public.products set is_published=p_published,updated_at=clock_timestamp() where id=r.id;n=n+1;
 end loop;
 if n<>cardinality(p_ids) then raise exception 'One of the selected products no longer exists.';end if;
 return n;
end $$;
create or replace function public.bills_bulk_categories(p_ids uuid[],p_category_id uuid,p_action text,p_expected jsonb) returns integer
language plpgsql security definer set search_path='' as $$
declare r public.products%rowtype;n integer=0;new_primary uuid;
begin
 if not public.bills_is_staff() then raise exception 'Employee access required.' using errcode='42501';end if;
 if cardinality(p_ids) not between 1 and 200 or p_action not in ('add','remove') then raise exception 'Invalid bulk category operation.';end if;
 if not exists(select 1 from public.categories where id=p_category_id) then raise exception 'Category no longer exists.';end if;
 for r in select * from public.products where id=any(p_ids) order by id for update loop
  if (p_expected->>r.id::text) is null or r.updated_at is distinct from (p_expected->>r.id::text)::timestamptz then raise exception 'A selected product changed. Refresh and try again.' using errcode='40001';end if;
  if p_action='add' then
   insert into public.bills_product_categories(product_id,category_id) values(r.id,p_category_id) on conflict do nothing;
   update public.products set category_id=coalesce(category_id,p_category_id),updated_at=clock_timestamp() where id=r.id;
  else
   delete from public.bills_product_categories where product_id=r.id and category_id=p_category_id;
   if r.is_published and not exists(select 1 from public.bills_product_categories where product_id=r.id) then raise exception '% would have no category. Unpublish it or assign another category first.',r.name;end if;
   new_primary=r.category_id;
   if r.category_id=p_category_id then select category_id into new_primary from public.bills_product_categories where product_id=r.id order by sort_order,category_id limit 1;end if;
   update public.products set category_id=new_primary,updated_at=clock_timestamp() where id=r.id;
  end if;
  n=n+1;
 end loop;
 if n<>cardinality(p_ids) then raise exception 'A selected product no longer exists.';end if;
 return n;
end $$;
create or replace function public.bills_reorder_catalogs(p_ids uuid[],p_expected jsonb) returns boolean
language plpgsql security definer set search_path='' as $$
declare r public.bills_catalogs%rowtype;i integer=0;
begin
 if not public.bills_is_staff() then raise exception 'Employee access required.' using errcode='42501';end if;
 if exists(select 1 from unnest(p_ids) x where not exists(select 1 from public.bills_catalogs c where c.id=x)) or cardinality(p_ids)<>(select count(*) from public.bills_catalogs) or cardinality(p_ids)<>(select count(distinct x) from unnest(p_ids) x) then raise exception 'The catalog list changed. Refresh first.';end if;
 for r in select * from public.bills_catalogs order by id for update loop
  if r.updated_at is distinct from (p_expected->>r.id::text)::timestamptz then raise exception 'A catalog changed. Refresh first.' using errcode='40001';end if;
 end loop;
 update public.bills_catalogs c set sort_order=x.ord::integer*10,updated_at=clock_timestamp() from unnest(p_ids) with ordinality x(id,ord) where c.id=x.id;
 return true;
end $$;
create or replace function public.bills_save_settings(p_settings jsonb,p_expected_updated_at text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.bills_site_settings%rowtype;p text=coalesce(p_settings->>'hero_image_path','');
begin
 if not public.bills_is_admin() then raise exception 'Administrator access required for site settings.' using errcode='42501';end if;
 select * into r from public.bills_site_settings where id=true for update;
 if p_expected_updated_at is null or r.updated_at is distinct from p_expected_updated_at::timestamptz then raise exception 'Site settings changed. Refresh before saving.' using errcode='40001';end if;
 if length(coalesce(p_settings->>'phone_main','')) not between 7 and 40 or length(coalesce(p_settings->>'phone_sales','')) not between 7 and 40 then raise exception 'Valid phone numbers are required.';end if;
 if coalesce(p_settings->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(p_settings->>'email')>254 then raise exception 'A valid public email is required.';end if;
 if length(coalesce(p_settings->>'address','')) not between 5 and 250 or length(coalesce(p_settings->>'tagline','')) not between 1 and 150 or length(coalesce(p_settings->>'hero_title','')) not between 1 and 90 or length(coalesce(p_settings->>'hero_subtitle',''))>150 then raise exception 'Check the address, tagline and hero text lengths.';end if;
 if length(coalesce(p_settings->>'turnstile_site_key',''))>200 or coalesce(p_settings->>'turnstile_site_key','') ~ '(sb_secret_|service_role|^eyJ)' then raise exception 'Enter a public Turnstile site key only, not a secret.';end if;
 if coalesce((p_settings->>'enquiries_enabled')::boolean,false) and nullif(p_settings->>'turnstile_site_key','') is null then raise exception 'Enter the public Turnstile site key before enabling online requests.';end if;
 if p<>'' and p is distinct from r.hero_image_path and (p !~ '^hero/[0-9a-f-]+\.webp$' or not exists(select 1 from storage.objects where bucket_id='bills-site-media' and name=p)) then raise exception 'The hero image upload is missing or invalid.';end if;
 update public.bills_site_settings set phone_main=trim(p_settings->>'phone_main'),phone_sales=trim(p_settings->>'phone_sales'),email=trim(p_settings->>'email'),address=trim(p_settings->>'address'),tagline=p_settings->>'tagline',hero_title=p_settings->>'hero_title',hero_subtitle=coalesce(p_settings->>'hero_subtitle',''),hero_image_path=p,enquiries_enabled=coalesce((p_settings->>'enquiries_enabled')::boolean,false),turnstile_site_key=trim(coalesce(p_settings->>'turnstile_site_key','')),updated_at=clock_timestamp() where id=true returning * into r;
 return to_jsonb(r);
end $$;
create or replace function public.bills_update_enquiry(p_id uuid,p_status text,p_notes text,p_expected_updated_at text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.bills_enquiries%rowtype;
begin
 if not public.bills_is_staff() then raise exception 'Employee access required.' using errcode='42501';end if;
 select * into r from public.bills_enquiries where id=p_id for update;
 if not found then raise exception 'Enquiry not found.';end if;
 if p_expected_updated_at is null or r.updated_at is distinct from p_expected_updated_at::timestamptz then raise exception 'This enquiry changed. Reopen it before saving.' using errcode='40001';end if;
 if length(p_notes)>10000 then raise exception 'Notes are too long.';end if;
 update public.bills_enquiries set status=p_status,staff_notes=coalesce(p_notes,''),updated_at=clock_timestamp() where id=p_id returning * into r;
 return jsonb_build_object('id',r.id,'updated_at',r.updated_at);
end $$;

-- Only the Edge Function (service_role) may call this function, after CAPTCHA validation.
create or replace function public.bills_submit_enquiry(p_submission_id uuid,p_fingerprint text,p_customer jsonb,p_kind text,p_message text,p_items jsonb,p_start_date date,p_end_date date,p_email_hash text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.bills_enquiries%rowtype;p public.products%rowtype;s public.bills_product_settings%rowtype;item jsonb;
 v_total integer;v_key text;v_id uuid=gen_random_uuid();has_rental boolean=false;has_sale boolean=false;v_price numeric;
begin
 if p_submission_id is null or p_fingerprint !~ '^[0-9a-f]{64}$' or p_email_hash !~ '^[0-9a-f]{64}$' then raise exception 'Invalid request identifiers.';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_submission_id::text,891));
 select * into r from public.bills_enquiries where submission_id=p_submission_id;
 if found then
  if r.fingerprint<>p_fingerprint then raise exception 'Request token was used for different details.';end if;
  return jsonb_build_object('id',r.id,'reference',r.reference,'duplicate',true);
 end if;
 if not exists(select 1 from public.bills_site_settings where id=true and enquiries_enabled) then raise exception 'Online requests are not enabled.';end if;
 if length(trim(coalesce(p_customer->>'name',''))) not between 1 and 120 or length(coalesce(p_customer->>'email','')) not between 3 and 254 or coalesce(p_customer->>'email','') !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(coalesce(p_customer->>'phone','')) not between 7 and 40 or length(coalesce(p_customer->>'company',''))>160 then raise exception 'Invalid contact information.';end if;
 if p_kind not in ('contact','quote','rental','mixed') or length(coalesce(p_message,''))>5000 or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)>50 then raise exception 'Invalid enquiry.';end if;
 if p_kind='contact' and (length(trim(coalesce(p_message,'')))<10 or jsonb_array_length(p_items)<>0) then raise exception 'Add a message of at least 10 characters.';end if;
 if p_kind<>'contact' and jsonb_array_length(p_items)=0 then raise exception 'The request cart is empty.';end if;
 if exists(select 1 from jsonb_array_elements(p_items) i group by i->>'product_id',i->>'mode' having count(*)>1) then raise exception 'Duplicate request items.';end if;
 -- Per-address and global rate limits are atomic and do not store raw IP addresses.
 foreach v_key in array array['email:'||p_email_hash,'global'] loop
  insert into public.bills_request_limits(key,window_at,total) values(v_key,date_trunc('hour',now()),1)
  on conflict(key,window_at) do update set total=public.bills_request_limits.total+1 returning total into v_total;
  if (v_key='global' and v_total>200) or (v_key<>'global' and v_total>5) then raise exception 'Too many requests. Please call Bill’s or try again later.' using errcode='P0429';end if;
 end loop;
 delete from public.bills_request_limits where window_at<now()-interval '2 days';
 -- Lock requested rows in consistent order to validate a current, coherent snapshot.
 perform 1 from public.products where id in(select (i->>'product_id')::uuid from jsonb_array_elements(p_items) i) order by id for share;
 insert into public.bills_enquiries(id,submission_id,fingerprint,reference,kind,customer_name,customer_email,customer_phone,company,message,start_date,end_date)
 values(v_id,p_submission_id,p_fingerprint,'BE-'||upper(substr(replace(v_id::text,'-',''),1,12)),p_kind,trim(p_customer->>'name'),lower(trim(p_customer->>'email')),trim(p_customer->>'phone'),trim(coalesce(p_customer->>'company','')),coalesce(p_message,''),p_start_date,p_end_date) returning * into r;
 for item in select value from jsonb_array_elements(p_items) loop
  if item->>'mode' not in ('sale','rental') or (item->>'quantity')::numeric<>trunc((item->>'quantity')::numeric) or (item->>'quantity')::integer not between 1 and 99 then raise exception 'Invalid request quantity or type.';end if;
  select * into p from public.products where id=(item->>'product_id')::uuid and is_published=true and status::text not in ('hidden','sold');
  if not found then raise exception 'A requested item is no longer available. Refresh your cart.';end if;
  select * into s from public.bills_product_settings where product_id=p.id;
  if s.purchase_mode='information' then raise exception 'An item is information-only. Remove it and contact Bill’s.';end if;
  if (item->>'mode'='rental' and p.listing_type::text not in ('rental','both')) or (item->>'mode'='sale' and p.listing_type::text not in ('product','both')) then raise exception 'A requested item is not available for the selected sale/rental type.';end if;
  has_rental=has_rental or item->>'mode'='rental';has_sale=has_sale or item->>'mode'='sale';
  v_price=case when item->>'mode'='sale' and not p.call_for_price then p.price else null end;
  insert into public.bills_enquiry_items(enquiry_id,product_id,product_name,model,sku,mode,quantity,listed_price,availability)
  values(v_id,p.id,p.name,p.model,p.sku,item->>'mode',(item->>'quantity')::integer,v_price,public.bills_effective_availability(p,s));
 end loop;
 if (p_kind='quote' and (has_rental or not has_sale)) or (p_kind='rental' and (has_sale or not has_rental)) or (p_kind='mixed' and not(has_sale and has_rental)) then raise exception 'The enquiry type does not match the selected items.';end if;
 if has_rental and (p_start_date is null or p_end_date is null or p_start_date<(now() at time zone 'America/New_York')::date or p_end_date<p_start_date) then raise exception 'Valid rental start and end dates are required.';end if;
 if not has_rental and (p_start_date is not null or p_end_date is not null) then raise exception 'Rental dates require a rental item.';end if;
 return jsonb_build_object('id',r.id,'reference',r.reference,'duplicate',false);
end $$;
create or replace function public.bills_claim_notification(p_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r public.bills_enquiries%rowtype;
begin
 select * into r from public.bills_enquiries where id=p_id for update;
 if not found or r.notification_status='sent' then return null;end if;
 if r.notification_status='sending' and r.notification_claimed_at>now()-interval '2 minutes' then return null;end if;
 -- The email provider's idempotency retention is finite. Never automatically resend an ambiguous old send.
 if r.notification_attempts>0 and coalesce(r.notification_first_attempt_at,r.notification_claimed_at)<now()-interval '23 hours' then
  update public.bills_enquiries set notification_status='failed',notification_error='Verify email delivery manually before sending again; previous attempt is older than 23 hours.' where id=p_id;return null;
 end if;
 update public.bills_enquiries set notification_status='sending',notification_claimed_at=clock_timestamp(),notification_first_attempt_at=coalesce(notification_first_attempt_at,clock_timestamp()),notification_attempts=notification_attempts+1 where id=p_id returning * into r;
 return to_jsonb(r)||jsonb_build_object('items',coalesce((select jsonb_agg(to_jsonb(i) order by i.id) from public.bills_enquiry_items i where enquiry_id=p_id),'[]'::jsonb));
end $$;

-- Storage: preserve the existing product bucket; add a public bucket exclusively for site imagery.
-- Public bucket bytes (including unpublished product photos with a known URL) are NOT confidential.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('bills-site-media','bills-site-media',true,10485760,array['image/jpeg','image/png','image/webp','image/avif']) on conflict(id) do nothing;
drop policy if exists bills_media_staff_allow on storage.objects;
create policy bills_media_staff_allow on storage.objects for all to authenticated using(bucket_id in ('bills-site-media','bills-product-images') and public.bills_is_staff()) with check(bucket_id in ('bills-site-media','bills-product-images') and public.bills_is_staff());
-- Restrictive guards apply only to Bill's media buckets and do not affect other buckets.
drop policy if exists bills_media_insert_guard on storage.objects;
create policy bills_media_insert_guard on storage.objects as restrictive for insert to anon,authenticated with check(bucket_id not in ('bills-site-media','bills-product-images') or public.bills_is_staff());
drop policy if exists bills_media_update_guard on storage.objects;
create policy bills_media_update_guard on storage.objects as restrictive for update to anon,authenticated using(bucket_id not in ('bills-site-media','bills-product-images') or public.bills_is_staff()) with check(bucket_id not in ('bills-site-media','bills-product-images') or public.bills_is_staff());
drop policy if exists bills_media_delete_guard on storage.objects;
create policy bills_media_delete_guard on storage.objects as restrictive for delete to anon,authenticated using(bucket_id not in ('bills-site-media','bills-product-images') or public.bills_is_staff());
drop policy if exists bills_media_list_guard on storage.objects;
create policy bills_media_list_guard on storage.objects as restrictive for select to anon,authenticated using(bucket_id not in ('bills-site-media','bills-product-images') or public.bills_is_staff());

-- No function is executable by PUBLIC by accident. Grant the exact public and employee facades.
do $$ declare r record;begin
 for r in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array['bills_admin_snapshot','bills_bulk_categories','bills_category_descendants','bills_claim_notification','bills_effective_availability','bills_is_admin','bills_is_staff','bills_log_change','bills_product_payload','bills_public_catalog','bills_public_product','bills_reorder_catalogs','bills_save_catalog','bills_save_category','bills_save_product','bills_save_settings','bills_search_products','bills_set_product_visibility','bills_submit_enquiry','bills_sync_primary_category','bills_update_enquiry']) loop
  execute format('revoke all on function %s from public,anon,authenticated',r.signature);
  execute format('grant execute on function %s to service_role',r.signature);
 end loop;
end $$;
grant execute on function public.bills_is_staff(),public.bills_is_admin(),public.bills_public_catalog(),public.bills_public_product(uuid,text),public.bills_search_products(text,uuid,text,text,text,text,text,integer,integer) to anon,authenticated;
grant execute on function public.bills_admin_snapshot(),public.bills_save_product(jsonb,jsonb,uuid[],jsonb,text,uuid),public.bills_save_catalog(jsonb,uuid[],text),public.bills_save_category(jsonb,uuid[],text),public.bills_set_product_visibility(uuid[],boolean,jsonb),public.bills_bulk_categories(uuid[],uuid,text,jsonb),public.bills_reorder_catalogs(uuid[],jsonb),public.bills_save_settings(jsonb,text),public.bills_update_enquiry(uuid,text,text,text) to authenticated;
insert into public.bills_schema_version(id,version) values(true,2) on conflict(id) do update set version=2;
notify pgrst,'reload schema';
commit;
