alter table public.orders
  add column if not exists fulfillment_method text,
  add column if not exists delivery_phone text,
  add column if not exists delivery_address text;

alter table public.orders
  drop constraint if exists orders_fulfillment_method_check,
  add constraint orders_fulfillment_method_check
    check (fulfillment_method is null or fulfillment_method in ('offline', 'online'));
