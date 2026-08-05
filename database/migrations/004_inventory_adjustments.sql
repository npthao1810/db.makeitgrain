-- Auditable non-sale stock movements, such as personal use or stock damage.
create table if not exists public.inventory_adjustments (
  id bigserial primary key,
  product_id integer not null references public.products(id),
  inventory_batch_id integer references public.inventory_batches(id),
  quantity integer not null check (quantity > 0),
  adjustment_type text not null check (adjustment_type in ('personal_usage', 'damage', 'stock_count')),
  occurred_at date not null,
  unit_cost numeric,
  note text,
  created_at timestamptz not null default now()
);

create index if not exists inventory_adjustments_product_date_idx
  on public.inventory_adjustments (product_id, occurred_at, id);

alter table public.inventory_adjustments enable row level security;

-- Replace the monthly view so non-sale stock withdrawals are visible and
-- reduce closing stock without being misrepresented as customer sales.
create or replace view public.monthly_stock_reconciliation as
with bounds as (
  select
    date_trunc(
      'month',
      least(
        (select min(received_at) from public.inventory_batches),
        (select min(order_date) from public.orders),
        (select min(occurred_at) from public.inventory_adjustments)
      )
    )::date as first_month,
    date_trunc(
      'month',
      greatest(
        (select max(received_at) from public.inventory_batches),
        (select max(order_date) from public.orders),
        (select max(occurred_at) from public.inventory_adjustments)
      )
    )::date as last_month
),
months as (
  select generate_series(first_month, last_month, interval '1 month')::date as month_start
  from bounds
),
receipts as (
  select date_trunc('month', received_at)::date as month_start, product_id, sum(quantity)::integer as received_quantity
  from public.inventory_batches
  group by 1, 2
),
sales as (
  select date_trunc('month', o.order_date)::date as month_start, oi.product_id, sum(oi.quantity)::integer as sold_quantity
  from public.orders o
  join public.order_items oi on oi.order_id = o.id
  where o.status = 'completed'
  group by 1, 2
),
adjustments as (
  select date_trunc('month', occurred_at)::date as month_start, product_id, sum(quantity)::integer as personal_usage_quantity
  from public.inventory_adjustments
  where adjustment_type = 'personal_usage'
  group by 1, 2
),
monthly_movements as (
  select
    m.month_start,
    p.id as product_id,
    p.name as product_name,
    p.exposures,
    coalesce(r.received_quantity, 0) as received_quantity,
    coalesce(s.sold_quantity, 0) as sold_quantity,
    coalesce(a.personal_usage_quantity, 0) as personal_usage_quantity
  from months m
  cross join public.products p
  left join receipts r on r.month_start = m.month_start and r.product_id = p.id
  left join sales s on s.month_start = m.month_start and s.product_id = p.id
  left join adjustments a on a.month_start = m.month_start and a.product_id = p.id
  where p.is_active = true
)
select
  month_start,
  product_id,
  product_name,
  exposures,
  sum(received_quantity - sold_quantity - personal_usage_quantity) over (
    partition by product_id order by month_start rows between unbounded preceding and 1 preceding
  )::integer as opening_stock,
  received_quantity,
  sold_quantity,
  sum(received_quantity - sold_quantity - personal_usage_quantity) over (
    partition by product_id order by month_start rows between unbounded preceding and current row
  )::integer as closing_stock,
  case when sum(received_quantity - sold_quantity - personal_usage_quantity) over (
    partition by product_id order by month_start rows between unbounded preceding and current row
  ) < 0 then 'negative_stock' else 'ok' end as reconciliation_status,
  personal_usage_quantity
from monthly_movements;
