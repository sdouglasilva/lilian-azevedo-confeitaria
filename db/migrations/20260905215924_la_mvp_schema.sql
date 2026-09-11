-- Canonical source: LA-CONFEITARIA-DELIVERY-PACK, revision 2026-09-05.1.
-- All structural changes are applied as tracked Supabase migrations.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create extension if not exists pgcrypto with schema extensions;

create table public.products (
  id uuid primary key default gen_random_uuid(), name text not null check (length(trim(name)) between 1 and 120),
  short_description text check (length(short_description) <= 600), image_path text,
  base_price_cents integer check (base_price_cents between 0 and 100000000),
  status text not null default 'ACTIVE' check (status in ('ACTIVE','INACTIVE')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), updated_by_admin_id uuid
);
create table public.productions (
  id uuid primary key default gen_random_uuid(), public_slug text not null unique check (public_slug ~ '^[a-z0-9][a-z0-9-]{2,79}$'),
  mode text not null check (mode in ('SURVEY','RESERVATION')),
  status text not null default 'DRAFT' check (status in ('DRAFT','ACTIVE','CLOSED','COMPLETED','CANCELLED')),
  fulfillment_at timestamptz, order_cutoff_at timestamptz,
  payment_window_minutes integer not null default 360 check (payment_window_minutes between 1 and 10080),
  reminder_before_minutes integer not null default 120 check (reminder_before_minutes between 0 and 10080),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), updated_by_admin_id uuid,
  check (fulfillment_at is null or order_cutoff_at is null or order_cutoff_at <= fulfillment_at)
);
create table public.production_items (
  id uuid primary key default gen_random_uuid(), production_id uuid not null references public.productions(id),
  product_id uuid not null references public.products(id), price_cents integer check (price_cents between 0 and 100000000),
  capacity integer check (capacity between 1 and 1000000), offer_enabled boolean not null default true,
  unique(production_id,product_id)
);
create table public.customers (
  id uuid primary key default gen_random_uuid(), name text not null, email text not null, email_normalized text not null,
  phone text not null, phone_normalized text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(email_normalized,phone_normalized)
);
create table public.orders (
  id uuid primary key, customer_id uuid not null references public.customers(id), production_id uuid not null references public.productions(id),
  status text not null default 'AWAITING_PAYMENT' check (status in ('AWAITING_PAYMENT','PAYMENT_CONFIRMED','EXPIRED','CANCELLED','COMPLETED')),
  access_token_hash text not null check (access_token_hash ~ '^[0-9a-f]{64}$'),
  idempotency_key uuid not null unique, request_hash text not null,
  expires_at timestamptz not null, reminder_sent_at timestamptz, payment_confirmed_at timestamptz, completed_at timestamptz, cancelled_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), updated_by_admin_id uuid
);
create table public.order_items (
  id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id),
  production_item_id uuid not null references public.production_items(id), quantity integer not null check(quantity between 1 and 9999),
  unit_price_cents integer not null check (unit_price_cents between 0 and 100000000), unique(order_id,production_item_id)
);
create table public.intentions (
  id uuid primary key, customer_id uuid not null references public.customers(id), product_id uuid not null references public.products(id),
  source_production_id uuid references public.productions(id), status text not null default 'ACTIVE' check (status in ('ACTIVE','WITHDRAWN')),
  access_token_hash text not null check(access_token_hash ~ '^[0-9a-f]{64}$'), idempotency_key uuid not null unique, request_hash text not null,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index intentions_one_active on public.intentions(customer_id,product_id) where status='ACTIVE';
create index orders_production_status on public.orders(production_id,status);
create index orders_due on public.orders(expires_at) where status='AWAITING_PAYMENT';
create index orders_customer on public.orders(customer_id);
create index production_items_product on public.production_items(product_id);
create index order_items_capacity on public.order_items(production_item_id,order_id);
create index intentions_production on public.intentions(source_production_id);
create index intentions_product on public.intentions(product_id);

-- A delivery receipt ledger: no payload, token, recipient, queue or worker.
create table private.email_deliveries (
  entity_id uuid not null, kind text not null check (kind in ('received','reminder','confirmed','closed','intention')),
  delivery_key uuid not null default gen_random_uuid(), status text not null check(status in ('SENDING','SENT','FAILED','UNKNOWN')),
  first_attempt_at timestamptz not null default now(), lease_until timestamptz not null, sent_at timestamptz,
  provider_id text, error_code text, primary key(entity_id,kind)
);
create table private.request_limits (bucket text primary key, count integer not null, expires_at timestamptz not null);
alter table private.email_deliveries enable row level security;
alter table private.request_limits enable row level security;

create function private.is_admin() returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from auth.users u where u.id=(select auth.uid())
    and u.email_confirmed_at is not null and lower(u.email) = 'douglas.ernesto.silva@gmail.com');
$$;
create function private.require_admin() returns void language plpgsql security definer set search_path='' as $$
begin if not private.is_admin() then raise exception 'FORBIDDEN' using errcode='42501'; end if; end;
$$;
create function private.require_server(p_secret text) returns void language plpgsql security definer set search_path='' as $$
declare v_secret text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name='cron_secret';
  if v_secret is null or length(v_secret)<32 or p_secret is null or
    extensions.digest(p_secret,'sha256')<>extensions.digest(v_secret,'sha256') then
    raise exception 'FORBIDDEN' using errcode='42501';
  end if;
end;
$$;
create function private.touch() returns trigger language plpgsql set search_path='' as $$
begin new.updated_at=clock_timestamp(); return new; end;
$$;
do $$ declare t text; begin
  foreach t in array array['products','productions','customers','orders','intentions'] loop
    execute format('create trigger touch before update on public.%I for each row execute function private.touch()',t);
  end loop;
  foreach t in array array['products','productions','production_items','customers','orders','order_items','intentions'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('create policy admin_read on public.%I for select to authenticated using ((select private.is_admin()))',t);
  end loop;
end $$;
grant usage on schema private to authenticated;
grant execute on function private.is_admin() to authenticated;

create function private.contact(p_contact jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_email text=lower(trim(p_contact->>'email')); v_phone text=regexp_replace(p_contact->>'phone','[^0-9]','','g'); v_name text=trim(p_contact->>'name');
begin
  if length(v_phone) in (10,11) then v_phone='55'||v_phone; end if;
  if v_name is null or length(v_name) not between 2 and 120 or v_email is null or length(v_email)>254
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or v_phone is null or length(v_phone) not between 12 and 15 then
    raise exception 'INVALID_CONTACT';
  end if;
  insert into public.customers(name,email,email_normalized,phone,phone_normalized) values(v_name,v_email,v_email,v_phone,v_phone)
    on conflict(email_normalized,phone_normalized) do update set name=excluded.name returning id into v_id;
  return v_id;
end;
$$;
create function private.occupied(p_item uuid,p_now timestamptz) returns bigint language sql stable set search_path='' as $$
  select coalesce(sum(oi.quantity),0) from public.order_items oi join public.orders o on o.id=oi.order_id
    where oi.production_item_id=p_item and (o.status='PAYMENT_CONFIRMED' or (o.status='AWAITING_PAYMENT' and o.expires_at>p_now));
$$;
create function private.order_json(p_id uuid) returns jsonb language sql stable set search_path='' as $$
  select jsonb_build_object('id',o.id,'production_id',o.production_id,'status',
      case when o.status='AWAITING_PAYMENT' and o.expires_at<=clock_timestamp() then 'EXPIRED' else o.status end,
    'expires_at',o.expires_at,'created_at',o.created_at,'payment_confirmed_at',o.payment_confirmed_at,
    'fulfillment_at',p.fulfillment_at,'public_slug',p.public_slug,
    'total_cents',(select coalesce(sum(oi.quantity::bigint*oi.unit_price_cents),0) from public.order_items oi where oi.order_id=o.id),
    'items',(select coalesce(jsonb_agg(jsonb_build_object('id',oi.id,'name',pr.name,'quantity',oi.quantity,'unit_price_cents',oi.unit_price_cents,'product_id',pr.id) order by pr.name),'[]')
      from public.order_items oi join public.production_items pi on pi.id=oi.production_item_id join public.products pr on pr.id=pi.product_id where oi.order_id=o.id))
  from public.orders o join public.productions p on p.id=o.production_id where o.id=p_id;
$$;
create function public.la_rate_limit(p_secret text,p_bucket text,p_limit integer,p_seconds integer) returns boolean language plpgsql security definer set search_path='' as $$
declare v_count integer;
begin
  perform private.require_server(p_secret);
  if p_bucket !~ '^[0-9a-f]{64}$' or p_limit not between 1 and 500 or p_seconds not between 1 and 3600 then raise exception 'INVALID_INPUT'; end if;
  insert into private.request_limits(bucket,count,expires_at) values(p_bucket,1,clock_timestamp()+make_interval(secs=>p_seconds))
    on conflict(bucket) do update set count=case when private.request_limits.expires_at<=clock_timestamp() then 1 else private.request_limits.count+1 end,
      expires_at=case when private.request_limits.expires_at<=clock_timestamp() then excluded.expires_at else private.request_limits.expires_at end returning count into v_count;
  return v_count<=p_limit;
end;
$$;
create function public.la_public_production(p_slug text) returns jsonb language sql security definer set search_path='' as $$
  select jsonb_build_object('id',p.id,'public_slug',p.public_slug,'mode',p.mode,'status',p.status,'fulfillment_at',p.fulfillment_at,
    'order_cutoff_at',p.order_cutoff_at,'payment_window_minutes',p.payment_window_minutes,
    'accepting',p.status='ACTIVE' and (p.order_cutoff_at is null or p.order_cutoff_at>clock_timestamp()),
    'items',coalesce((select jsonb_agg(jsonb_build_object('id',pi.id,'product_id',pr.id,'name',pr.name,'short_description',pr.short_description,
        'image_path',pr.image_path,'price_cents',coalesce(pi.price_cents,pr.base_price_cents),
        'remaining',case when pi.capacity is null then null else greatest(0,pi.capacity-private.occupied(pi.id,clock_timestamp())) end) order by pr.name)
      from public.production_items pi join public.products pr on pr.id=pi.product_id where pi.production_id=p.id and pi.offer_enabled and pr.status='ACTIVE'),'[]'))
    from public.productions p where p.public_slug=p_slug and p.status<>'DRAFT';
$$;

create function public.la_create_order(p_secret text,p_id uuid,p_key uuid,p_hash text,p_token_hash text,p_production uuid,p_contact jsonb,p_items jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_prod public.productions; v_existing public.orders; v_item record; v_n integer; v_now timestamptz; v_expires timestamptz; v_customer uuid;
begin
  perform private.require_server(p_secret);
  if p_id is null or p_key is null or p_hash !~ '^[0-9a-f]{64}$' or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_INPUT'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_key::text,0));
  select * into v_existing from public.orders where idempotency_key=p_key;
  if found then
    if v_existing.request_hash<>p_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('id',v_existing.id,'reused',true);
  end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 30 then raise exception 'INVALID_ITEMS'; end if;
  select * into v_prod from public.productions where id=p_production for update;
  if not found then raise exception 'PRODUCTION_UNAVAILABLE'; end if;
  perform pi.id from public.production_items pi where pi.production_id=p_production and pi.id in
    (select (x->>'id')::uuid from jsonb_array_elements(p_items) x) order by pi.id for update;
  v_now=clock_timestamp();
  if v_prod.status<>'ACTIVE' or v_prod.mode<>'RESERVATION' or v_prod.order_cutoff_at<=v_now then raise exception 'PRODUCTION_UNAVAILABLE'; end if;
  select count(distinct x->>'id') into v_n from jsonb_array_elements(p_items) x;
  if v_n<>jsonb_array_length(p_items) then raise exception 'INVALID_ITEMS'; end if;
  for v_item in select pi.*,pr.status as product_status,coalesce(pi.price_cents,pr.base_price_cents) as effective_price,(x->>'quantity')::integer as qty
    from jsonb_array_elements(p_items) x join public.production_items pi on pi.id=(x->>'id')::uuid
    join public.products pr on pr.id=pi.product_id where pi.production_id=p_production loop
    v_n=v_n-1;
    if not v_item.offer_enabled or v_item.product_status<>'ACTIVE' or v_item.effective_price is null or v_item.qty is null or v_item.qty not between 1 and 9999 then raise exception 'INVALID_ITEMS'; end if;
    if v_item.capacity is not null and private.occupied(v_item.id,v_now)+v_item.qty>v_item.capacity then raise exception 'CAPACITY_EXCEEDED'; end if;
  end loop;
  if v_n<>0 then raise exception 'INVALID_ITEMS'; end if;
  v_customer=private.contact(p_contact);
  v_expires=v_now+make_interval(mins=>v_prod.payment_window_minutes);
  if v_prod.order_cutoff_at is not null then v_expires=least(v_expires,v_prod.order_cutoff_at); end if;
  insert into public.orders(id,customer_id,production_id,access_token_hash,idempotency_key,request_hash,expires_at,created_at)
    values(p_id,v_customer,p_production,p_token_hash,p_key,p_hash,v_expires,v_now);
  insert into public.order_items(order_id,production_item_id,quantity,unit_price_cents)
    select p_id,pi.id,(x->>'quantity')::integer,coalesce(pi.price_cents,pr.base_price_cents)
      from jsonb_array_elements(p_items) x join public.production_items pi on pi.id=(x->>'id')::uuid join public.products pr on pr.id=pi.product_id;
  return jsonb_build_object('id',p_id,'reused',false);
end;
$$;
create function public.la_get_order(p_secret text,p_id uuid,p_token_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  perform private.require_server(p_secret);
  if not exists(select 1 from public.orders where id=p_id and access_token_hash=p_token_hash) then return null; end if;
  return private.order_json(p_id);
end;
$$;
create function public.la_cancel_order(p_secret text,p_id uuid,p_token_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_prod uuid; v_order public.orders;
begin
  perform private.require_server(p_secret);
  select production_id into v_prod from public.orders where id=p_id and access_token_hash=p_token_hash;
  if not found then raise exception 'NOT_FOUND'; end if;
  perform id from public.productions where id=v_prod for update;
  select * into v_order from public.orders where id=p_id for update;
  if v_order.status='CANCELLED' then return private.order_json(p_id); end if;
  if v_order.status<>'AWAITING_PAYMENT' or v_order.expires_at<=clock_timestamp() then raise exception 'CANCELLATION_UNAVAILABLE'; end if;
  update public.orders set status='CANCELLED',cancelled_at=clock_timestamp() where id=p_id;
  return private.order_json(p_id);
end;
$$;
create function public.la_create_intention(p_secret text,p_id uuid,p_key uuid,p_hash text,p_token_hash text,p_production uuid,p_product uuid,p_contact jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_customer uuid; v_prod public.productions; v_existing public.intentions;
begin
  perform private.require_server(p_secret);
  if p_id is null or p_key is null or p_hash !~ '^[0-9a-f]{64}$' or p_token_hash !~ '^[0-9a-f]{64}$' then raise exception 'INVALID_INPUT'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_key::text,0));
  select * into v_existing from public.intentions where idempotency_key=p_key;
  if found then
    if v_existing.request_hash<>p_hash then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
    return jsonb_build_object('id',v_existing.id,'reused',true);
  end if;
  select * into v_prod from public.productions where id=p_production for update;
  if not found or v_prod.mode<>'SURVEY' or v_prod.status<>'ACTIVE' or v_prod.order_cutoff_at<=clock_timestamp() then raise exception 'PRODUCTION_UNAVAILABLE'; end if;
  if not exists(select 1 from public.production_items pi join public.products pr on pr.id=pi.product_id where pi.production_id=p_production and pi.product_id=p_product and pi.offer_enabled and pr.status='ACTIVE') then raise exception 'INVALID_ITEMS'; end if;
  v_customer=private.contact(p_contact);
  if exists(select 1 from public.intentions where customer_id=v_customer and product_id=p_product and status='ACTIVE') then
    return jsonb_build_object('already_active',true);
  end if;
  insert into public.intentions(id,customer_id,product_id,source_production_id,access_token_hash,idempotency_key,request_hash)
    values(p_id,v_customer,p_product,p_production,p_token_hash,p_key,p_hash);
  return jsonb_build_object('id',p_id,'reused',false);
end;
$$;
create function public.la_get_intention(p_secret text,p_id uuid,p_token_hash text,p_withdraw boolean default false) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb;
begin
  perform private.require_server(p_secret);
  if p_withdraw then update public.intentions set status='WITHDRAWN' where id=p_id and access_token_hash=p_token_hash and status='ACTIVE'; end if;
  select jsonb_build_object('id',i.id,'status',i.status,'name',pr.name,'public_slug',p.public_slug,'created_at',i.created_at) into v_result
    from public.intentions i join public.products pr on pr.id=i.product_id left join public.productions p on p.id=i.source_production_id
    where i.id=p_id and i.access_token_hash=p_token_hash;
  return v_result;
end;
$$;

create function public.la_save_product(p_id uuid,p_data jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid;
begin
  perform private.require_admin();
  if p_data->>'image_path' is not null and p_data->>'image_path' !~ '^products/[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$' then raise exception 'INVALID_IMAGE'; end if;
  if p_id is null then
    insert into public.products(name,short_description,base_price_cents,status,image_path,updated_by_admin_id)
      values(trim(p_data->>'name'),nullif(trim(p_data->>'short_description'),''),(p_data->>'base_price_cents')::integer,coalesce(p_data->>'status','ACTIVE'),p_data->>'image_path',auth.uid()) returning id into v_id;
  else
    update public.products set name=trim(p_data->>'name'),short_description=nullif(trim(p_data->>'short_description'),''),base_price_cents=(p_data->>'base_price_cents')::integer,
      status=p_data->>'status',image_path=p_data->>'image_path',updated_by_admin_id=auth.uid() where id=p_id returning id into v_id;
    if not found then raise exception 'NOT_FOUND'; end if;
  end if;
  return v_id;
end;
$$;
create function public.la_save_production(p_id uuid,p_data jsonb,p_items jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_current public.productions; v_item record; v_now timestamptz=clock_timestamp();
begin
  perform private.require_admin();
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 30 then raise exception 'INVALID_ITEMS'; end if;
  if p_id is not null then
    select * into v_current from public.productions where id=p_id for update;
    if not found then raise exception 'NOT_FOUND'; end if;
    if v_current.status not in ('DRAFT','ACTIVE') then raise exception 'EDIT_UNAVAILABLE'; end if;
    if v_current.status='ACTIVE' and v_current.mode<>p_data->>'mode' then raise exception 'EDIT_UNAVAILABLE'; end if;
    update public.productions set mode=p_data->>'mode',fulfillment_at=(p_data->>'fulfillment_at')::timestamptz,
      order_cutoff_at=(p_data->>'order_cutoff_at')::timestamptz,payment_window_minutes=(p_data->>'payment_window_minutes')::integer,
      reminder_before_minutes=(p_data->>'reminder_before_minutes')::integer,updated_by_admin_id=auth.uid() where id=p_id;
    v_id=p_id;
  else
    insert into public.productions(public_slug,mode,fulfillment_at,order_cutoff_at,payment_window_minutes,reminder_before_minutes,updated_by_admin_id)
      values(p_data->>'public_slug',p_data->>'mode',(p_data->>'fulfillment_at')::timestamptz,(p_data->>'order_cutoff_at')::timestamptz,
      (p_data->>'payment_window_minutes')::integer,(p_data->>'reminder_before_minutes')::integer,auth.uid()) returning id into v_id;
  end if;
  delete from public.production_items where production_id=v_id and product_id not in (select (x->>'product_id')::uuid from jsonb_array_elements(p_items) x);
  for v_item in select * from jsonb_to_recordset(p_items) as x(product_id uuid,price_cents integer,capacity integer,offer_enabled boolean) loop
    insert into public.production_items(production_id,product_id,price_cents,capacity,offer_enabled)
      values(v_id,v_item.product_id,v_item.price_cents,v_item.capacity,coalesce(v_item.offer_enabled,true))
      on conflict(production_id,product_id) do update set price_cents=excluded.price_cents,capacity=excluded.capacity,offer_enabled=excluded.offer_enabled;
  end loop;
  if exists(select 1 from public.production_items where production_id=v_id and capacity is not null and capacity<private.occupied(id,v_now)) then raise exception 'CAPACITY_BELOW_RESERVED'; end if;
  if v_current.status='ACTIVE' and p_data->>'mode'='RESERVATION' and exists(select 1 from public.production_items pi join public.products pr on pr.id=pi.product_id
    where pi.production_id=v_id and pi.offer_enabled and coalesce(pi.price_cents,pr.base_price_cents) is null) then raise exception 'PRICE_REQUIRED'; end if;
  return v_id;
end;
$$;
create function public.la_transition_production(p_id uuid,p_status text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_current public.productions; v_cancelled jsonb='[]';
begin
  perform private.require_admin();
  select * into v_current from public.productions where id=p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_current.status=p_status then return jsonb_build_object('id',p_id,'cancelled_orders',v_cancelled); end if;
  if not ((v_current.status='DRAFT' and p_status='ACTIVE') or (v_current.status='ACTIVE' and p_status in ('CLOSED','CANCELLED')) or (v_current.status='CLOSED' and p_status='COMPLETED')) then raise exception 'INVALID_TRANSITION'; end if;
  if p_status='ACTIVE' then
    if v_current.order_cutoff_at<=clock_timestamp() then raise exception 'CUTOFF_PASSED'; end if;
    if not exists(select 1 from public.production_items pi join public.products pr on pr.id=pi.product_id where pi.production_id=p_id and pi.offer_enabled and pr.status='ACTIVE') then raise exception 'INVALID_ITEMS'; end if;
    if v_current.mode='RESERVATION' and exists(select 1 from public.production_items pi join public.products pr on pr.id=pi.product_id where pi.production_id=p_id and pi.offer_enabled and coalesce(pi.price_cents,pr.base_price_cents) is null) then raise exception 'PRICE_REQUIRED'; end if;
  end if;
  if p_status='COMPLETED' and exists(select 1 from public.orders where production_id=p_id and status in ('AWAITING_PAYMENT','PAYMENT_CONFIRMED')) then raise exception 'UNFINISHED_ORDERS'; end if;
  if p_status='CANCELLED' then
    with changed as (update public.orders set status='CANCELLED',cancelled_at=clock_timestamp(),updated_by_admin_id=auth.uid()
      where production_id=p_id and status in ('AWAITING_PAYMENT','PAYMENT_CONFIRMED') returning id)
      select coalesce(jsonb_agg(id),'[]') into v_cancelled from changed;
  end if;
  update public.productions set status=p_status,updated_by_admin_id=auth.uid() where id=p_id;
  return jsonb_build_object('id',p_id,'cancelled_orders',v_cancelled);
end;
$$;
create function public.la_transition_order(p_id uuid,p_status text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_order public.orders; v_prod uuid;
begin
  perform private.require_admin();
  select production_id into v_prod from public.orders where id=p_id;
  perform id from public.productions where id=v_prod for update;
  select * into v_order from public.orders where id=p_id for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  if v_order.status=p_status then return private.order_json(p_id); end if;
  if v_order.status='AWAITING_PAYMENT' and v_order.expires_at<=clock_timestamp() then
    update public.orders set status='EXPIRED',updated_by_admin_id=auth.uid() where id=p_id;
    return private.order_json(p_id);
  end if;
  if not ((v_order.status='AWAITING_PAYMENT' and p_status in ('PAYMENT_CONFIRMED','CANCELLED')) or (v_order.status='PAYMENT_CONFIRMED' and p_status in ('COMPLETED','CANCELLED'))) then raise exception 'INVALID_TRANSITION'; end if;
  update public.orders set status=p_status,updated_by_admin_id=auth.uid(),
    payment_confirmed_at=case when p_status='PAYMENT_CONFIRMED' then clock_timestamp() else payment_confirmed_at end,
    cancelled_at=case when p_status='CANCELLED' then clock_timestamp() else cancelled_at end,
    completed_at=case when p_status='COMPLETED' then clock_timestamp() else completed_at end where id=p_id;
  return private.order_json(p_id);
end;
$$;
create function public.la_process_pending(p_secret text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_prod uuid; v_expired jsonb='[]'; v_ids jsonb; v_reminders jsonb; v_now timestamptz;
begin
  perform private.require_server(p_secret);
  -- All writers lock production then order; expiration uses exactly the same order.
  for v_prod in select distinct production_id from public.orders where status='AWAITING_PAYMENT' and expires_at<=clock_timestamp() order by production_id limit 100 loop
    perform id from public.productions where id=v_prod for update;
    with changed as (update public.orders set status='EXPIRED' where production_id=v_prod and status='AWAITING_PAYMENT' and expires_at<=clock_timestamp() returning id)
      select coalesce(jsonb_agg(id),'[]') into v_ids from changed;
    v_expired=v_expired||v_ids;
  end loop;
  v_now=clock_timestamp();
  select coalesce(jsonb_agg(id),'[]') into v_reminders from (
    select o.id from public.orders o join public.productions p on p.id=o.production_id
      where o.status='AWAITING_PAYMENT' and o.expires_at>v_now and o.reminder_sent_at is null and p.reminder_before_minutes>0
        and o.expires_at-make_interval(mins=>p.reminder_before_minutes)>o.created_at
        and v_now>=o.expires_at-make_interval(mins=>p.reminder_before_minutes) order by o.expires_at limit 30) due;
  delete from private.request_limits where expires_at<clock_timestamp()-interval '1 day';
  return jsonb_build_object('expired',v_expired,'reminders',v_reminders);
end;
$$;
create function public.la_email_context(p_secret text,p_id uuid,p_kind text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_result jsonb;
begin
  perform private.require_server(p_secret);
  if p_kind='intention' then
    select jsonb_build_object('id',i.id,'status',i.status,'name',pr.name,'customer',jsonb_build_object('name',c.name,'email',c.email)) into v_result
      from public.intentions i join public.customers c on c.id=i.customer_id join public.products pr on pr.id=i.product_id where i.id=p_id and i.status='ACTIVE';
  else
    select private.order_json(o.id)||jsonb_build_object('customer',jsonb_build_object('name',c.name,'email',c.email)) into v_result
      from public.orders o join public.customers c on c.id=o.customer_id where o.id=p_id and
      ((p_kind in ('received','reminder') and o.status='AWAITING_PAYMENT' and o.expires_at>clock_timestamp()) or
       (p_kind='confirmed' and o.status in ('PAYMENT_CONFIRMED','COMPLETED')) or (p_kind='closed' and o.status in ('CANCELLED','EXPIRED')));
  end if;
  return v_result;
end;
$$;
create function public.la_claim_email(p_secret text,p_id uuid,p_kind text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_delivery private.email_deliveries;
begin
  perform private.require_server(p_secret);
  if public.la_email_context(p_secret,p_id,p_kind) is null then return null; end if;
  insert into private.email_deliveries(entity_id,kind,status,lease_until) values(p_id,p_kind,'SENDING',clock_timestamp()+interval '90 seconds') on conflict do nothing returning * into v_delivery;
  if found then return jsonb_build_object('key',v_delivery.delivery_key); end if;
  select * into v_delivery from private.email_deliveries where entity_id=p_id and kind=p_kind for update;
  if v_delivery.status='SENT' or (v_delivery.status='SENDING' and v_delivery.lease_until>clock_timestamp()) then return null; end if;
  -- An ambiguous transport result is only retried within the provider's dedupe window.
  if v_delivery.status in ('SENDING','UNKNOWN') and clock_timestamp()>v_delivery.first_attempt_at+interval '14 minutes' then return null; end if;
  update private.email_deliveries set status='SENDING',lease_until=clock_timestamp()+interval '90 seconds' where entity_id=p_id and kind=p_kind;
  return jsonb_build_object('key',v_delivery.delivery_key);
end;
$$;
create function public.la_finish_email(p_secret text,p_id uuid,p_kind text,p_key uuid,p_status text,p_provider_id text default null,p_error text default null) returns void language plpgsql security definer set search_path='' as $$
begin
  perform private.require_server(p_secret);
  if p_status not in ('SENT','FAILED','UNKNOWN') then raise exception 'INVALID_INPUT'; end if;
  update private.email_deliveries set status=p_status,sent_at=case when p_status='SENT' then clock_timestamp() else null end,
    provider_id=left(p_provider_id,200),error_code=left(p_error,80),lease_until=clock_timestamp()
    where entity_id=p_id and kind=p_kind and delivery_key=p_key and status<>'SENT';
  if found and p_status='SENT' and p_kind='reminder' then update public.orders set reminder_sent_at=coalesce(reminder_sent_at,clock_timestamp()) where id=p_id; end if;
end;
$$;

-- No caller inherits EXECUTE on security-definer helpers through PUBLIC.
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.is_admin() to authenticated;
do $$ declare f record; begin
  for f in select p.oid::regprocedure as signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname like 'la\_%' escape '\' loop
    execute format('revoke all on function %s from public,anon,authenticated',f.signature);
    if f.proname in ('la_save_product','la_save_production','la_transition_production','la_transition_order') then
      execute format('grant execute on function %s to authenticated',f.signature);
    else execute format('grant execute on function %s to anon,authenticated',f.signature);
    end if;
  end loop;
end $$;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('product-images','product-images',true,5242880,array['image/webp'])
  on conflict(id) do update set public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy product_images_read on storage.objects for select to anon,authenticated using(bucket_id='product-images');
create policy product_images_insert on storage.objects for insert to authenticated with check(bucket_id='product-images' and (select private.is_admin()) and name ~ '^products/[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$');
create policy product_images_update on storage.objects for update to authenticated using(bucket_id='product-images' and (select private.is_admin())) with check(bucket_id='product-images' and (select private.is_admin()) and name ~ '^products/[0-9a-f-]{36}/[0-9a-f-]{36}\.webp$');
create policy product_images_delete on storage.objects for delete to authenticated using(bucket_id='product-images' and (select private.is_admin()));
