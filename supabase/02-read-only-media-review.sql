-- CANDIDATES ONLY. Never execute storage metadata DELETEs to remove files.
-- Files can also be used in old HTML/descriptions/external links not represented here.
-- Check those references and back up the bytes before any separately approved cleanup.
begin read only;
select o.bucket_id,o.name,o.created_at,o.metadata->>'size' as bytes,
'Unreferenced in current gallery/category/hero metadata; review other uses before removal' as reason
from storage.objects o
where o.bucket_id in ('bills-product-images','bills-site-media')
and o.created_at<now()-interval '14 days'
and not exists(select 1 from public.product_images i where i.storage_path=o.name and o.bucket_id='bills-product-images')
and not exists(select 1 from public.bills_category_settings s where s.image_path=o.name and o.bucket_id='bills-site-media')
and not exists(select 1 from public.bills_site_settings s where s.hero_image_path=o.name and o.bucket_id='bills-site-media')
order by o.created_at;
rollback;
