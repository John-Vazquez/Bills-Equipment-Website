-- AFTER a separately reviewed/applied migration, in Bill's project only.
-- Read-only structural checks. These are not substitutes for anon/staff HTTP tests.
begin read only;
select version,installed_at from public.bills_schema_version;
select enquiries_enabled,turnstile_site_key<>'' as public_captcha_key_present from public.bills_site_settings;
-- At initial installation version must be 2 and enquiries_enabled must be false.
select 'products' as entity,count(*) as rows,md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by t.id),'')) as rows_fingerprint from public.products t
union all select 'categories',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by t.id),'')) from public.categories t
union all select 'product_images',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by t.id),'')) from public.product_images t
union all select 'admin_profiles',count(*),md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by t.id),'')) from public.admin_profiles t;
-- All rows in the following result must show RLS enabled.
select c.relname,c.relrowsecurity from pg_class c where c.relnamespace='public'::regnamespace and c.relkind='r'
and (left(c.relname,6)='bills_' or c.relname in ('products','categories','product_images','admin_profiles')) order by c.relname;
-- Expected false for every private table/public role privilege listed here.
select r.role,t.table_name,
has_table_privilege(r.role,'public.'||t.table_name,'SELECT') as can_select,
has_table_privilege(r.role,'public.'||t.table_name,'INSERT') as can_insert,
has_table_privilege(r.role,'public.'||t.table_name,'UPDATE') as can_update,
has_table_privilege(r.role,'public.'||t.table_name,'DELETE') as can_delete
from (values('anon')) r(role) cross join (values('bills_enquiries'),('bills_enquiry_items'),('bills_request_limits'),('bills_change_log'),('bills_mutation_receipts')) t(table_name);
-- Every anon public mutation entry below must be false.
select p.oid::regprocedure as function_name,has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
has_function_privilege('authenticated',p.oid,'EXECUTE') as signed_in_execute,
has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute
from pg_proc p where p.pronamespace='public'::regnamespace and left(p.proname,6)='bills_' order by p.proname;
-- No customer-record data is returned by this report.
select (public.bills_public_catalog()->>'version')::integer as public_schema_version;
select count(*) as unassigned_published from public.products p where p.is_published and p.status::text<>'hidden'
and not exists(select 1 from public.bills_product_categories pc where pc.product_id=p.id);
select count(*) as more_than_one_primary from
(select product_id from public.bills_product_categories where is_primary group by product_id having count(*)>1) x;
select c.name,c.active,count(cc.category_id) as categories from public.bills_catalogs c
left join public.bills_catalog_categories cc on cc.catalog_id=c.id group by c.id,c.name,c.active order by c.name;
-- Review ALL older SECURITY DEFINER functions separately; a new restrictive policy
-- cannot certify that unrelated existing functions are safe.
select p.oid::regprocedure as function_name,p.prosecdef,p.proacl
from pg_proc p where p.pronamespace='public'::regnamespace and p.prosecdef and left(p.proname,6)<>'bills_' order by p.proname;
rollback;
