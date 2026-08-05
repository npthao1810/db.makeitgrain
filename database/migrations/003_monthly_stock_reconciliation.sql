-- Month-end stock ledger built from dated receipts and completed sales.
-- One row per active product per calendar month.
create or replace view public.monthly_stock_reconciliation as
with bounds as (
  select
    date_trunc(
      'month',
      least(
        (select min(received_at) from public.inventory_batches),
        (select min(order_date) from public.orders)
      )
    )::date as first_month,
    date_trunc(
      'month',
      greatest(
        (select max(received_at) from public.inventory_batches),
        (select max(order_date) from public.orders)
      )
    )::date as last_month
),
months as (
  select generate_series(first_month, last_month, interval '1 month')::date as month_start
  from bounds
),
receipts as (
  select
    date_trunc('month', received_at)::date as month_start,
    product_id,
    sum(quantity)::integer as received_quantity
  from public.inventory_batches
  group by 1, 2
),
sales as (
  select
    date_trunc('month', o.order_date)::date as month_start,
    oi.product_id,
    sum(oi.quantity)::integer as sold_quantity
  from public.orders o
  join public.order_items oi on oi.order_id = o.id
  where o.status = 'completed'
  group by 1, 2
),
monthly_movements as (
  select
    m.month_start,
    p.id as product_id,
    p.name as product_name,
    p.exposures,
    coalesce(r.received_quantity, 0) as received_quantity,
    coalesce(s.sold_quantity, 0) as sold_quantity
  from months m
  cross join public.products p
  left join receipts r on r.month_start = m.month_start and r.product_id = p.id
  left join sales s on s.month_start = m.month_start and s.product_id = p.id
  where p.is_active = true
)
select
  month_start,
  product_id,
  product_name,
  exposures,
  sum(received_quantity - sold_quantity) over (
    partition by product_id
    order by month_start
    rows between unbounded preceding and 1 preceding
  )::integer as opening_stock,
  received_quantity,
  sold_quantity,
  sum(received_quantity - sold_quantity) over (
    partition by product_id
    order by month_start
    rows between unbounded preceding and current row
  )::integer as closing_stock,
  case
    when sum(received_quantity - sold_quantity) over (
      partition by product_id
      order by month_start
      rows between unbounded preceding and current row
    ) < 0 then 'negative_stock'
    else 'ok'
  end as reconciliation_status
from monthly_movements;
