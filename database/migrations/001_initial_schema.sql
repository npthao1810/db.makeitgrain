-- Phase 3: PostgreSQL schema for inventory, POS sales, FIFO cost tracking,
-- and payment reporting. Run this file once against an empty PostgreSQL database.

begin;

create table products (
  id bigint generated always as identity primary key,
  name text not null,
  format text not null,
  selling_price numeric(12, 0) not null check (selling_price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name, format)
);

create table inventory_batches (
  id bigint generated always as identity primary key,
  product_id bigint not null references products(id),
  received_quantity integer not null check (received_quantity > 0),
  remaining_quantity integer not null check (
    remaining_quantity >= 0 and remaining_quantity <= received_quantity
  ),
  unit_cost numeric(12, 0) not null check (unit_cost >= 0),
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table orders (
  id bigint generated always as identity primary key,
  status text not null default 'completed' check (status in ('completed', 'cancelled')),
  total_amount numeric(12, 0) not null check (total_amount >= 0),
  ordered_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table order_items (
  id bigint generated always as identity primary key,
  order_id bigint not null references orders(id),
  product_id bigint not null references products(id),
  quantity integer not null check (quantity > 0),
  unit_price numeric(12, 0) not null check (unit_price >= 0),
  created_at timestamptz not null default now()
);

-- An order item can consume several batches. This preserves the exact FIFO
-- cost and inventory history for each portion of a sale.
create table inventory_allocations (
  id bigint generated always as identity primary key,
  order_item_id bigint not null references order_items(id),
  inventory_batch_id bigint not null references inventory_batches(id),
  quantity integer not null check (quantity > 0),
  unit_cost numeric(12, 0) not null check (unit_cost >= 0),
  created_at timestamptz not null default now(),
  unique (order_item_id, inventory_batch_id)
);

create table payment_logs (
  id bigint generated always as identity primary key,
  order_id bigint not null references orders(id),
  payment_method text not null check (payment_method in ('cash', 'bank_transfer')),
  destination_account text,
  amount numeric(12, 0) not null check (amount > 0),
  paid_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  check (
    (payment_method = 'cash' and destination_account is null)
    or (payment_method = 'bank_transfer' and destination_account is not null)
  )
);

create index inventory_batches_product_fifo_idx
  on inventory_batches (product_id, received_at, id)
  where remaining_quantity > 0;

create index order_items_order_id_idx on order_items (order_id);
create index order_items_product_id_idx on order_items (product_id);
create index inventory_allocations_order_item_id_idx on inventory_allocations (order_item_id);
create index payment_logs_order_id_idx on payment_logs (order_id);
create index orders_ordered_at_idx on orders (ordered_at);

create function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger products_set_updated_at
before update on products
for each row
execute function set_updated_at();

commit;
