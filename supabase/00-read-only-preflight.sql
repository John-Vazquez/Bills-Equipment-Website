-- READ ONLY. Run in the Bill's project (rvgyfacefruqgclcbwgb), not the Speedpack project.
-- This exports definitions and counts, not passwords, tokens, or customer enquiries.
begin read only;
select current_database() as database, version() as postgres_version;
select table_name,column_name,data_type,udt_name,is_nullable,column_default
from information_schema.columns where table_schema='public'
and table_name in ('products','categories','product_images','admin_profiles') order by table_name,ordinal_position;
select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_policies where schemaname in ('public','storage') order by schemaname,tablename,policyname;
select table_name,grantee,privilege_type from information_schema.role_table_grants
where table_schema='public' and grantee in ('anon','authenticated') order by table_name,grantee;
select conrelid::regclass as table_name,conname,pg_get_constraintdef(oid) as definition
from pg_constraint where connamespace='public'::regnamespace order by conrelid::regclass::text,conname;
select id,name,public,file_size_limit,allowed_mime_types from storage.buckets;
select count(*) as total,count(*) filter(where is_published) as published,
 count(*) filter(where quantity=0) as zero_quantity,count(*) filter(where category_id is null) as uncategorized from public.products;
select c.id,c.name,c.active,count(p.id) as products from public.categories c
left join public.products p on p.category_id=c.id group by c.id,c.name,c.active order by c.name;
select role,active,count(*) as profile_count from public.admin_profiles group by role,active;
select source,count(*) from public.products group by source;
select proname,prosecdef,proacl from pg_proc where pronamespace='public'::regnamespace order by proname;
-- Preserve these fingerprints before migration. Matching values afterward establish that
-- the migration itself did not change the existing rows (not a replacement for a backup).
select 'products' as entity,count(*) as rows,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by t.id),'')) as rows_fingerprint from public.products t
union all select 'categories',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by t.id),'')) from public.categories t
union all select 'product_images',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by t.id),'')) from public.product_images t
union all select 'admin_profiles',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by t.id),'')) from public.admin_profiles t;
rollback;
