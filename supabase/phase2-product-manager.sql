-- Bill's Equipment Website
-- Phase 2: product manager fields / future MX compatibility
-- Run once in the Bill's Supabase project SQL Editor.

begin;

alter table public.products
    add column if not exists source text;

update public.products
set source = 'manual'
where source is null;

alter table public.products
    alter column source set default 'manual',
    alter column source set not null;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'products_source_check'
          and conrelid = 'public.products'::regclass
    ) then
        alter table public.products
            add constraint products_source_check
            check (source in ('manual', 'mx'));
    end if;
end
$$;

alter table public.products
    add column if not exists external_id text;

alter table public.products
    add column if not exists display_order integer;

update public.products
set display_order = 0
where display_order is null;

alter table public.products
    alter column display_order set default 0,
    alter column display_order set not null;

create index if not exists products_display_order_idx
    on public.products(display_order, updated_at desc);

create index if not exists products_source_idx
    on public.products(source);

create unique index if not exists products_source_external_id_unique
    on public.products(source, external_id)
    where external_id is not null;

commit;