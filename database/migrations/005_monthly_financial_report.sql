-- Revenue and margin report that keeps orders with missing historical cost
-- separate from fully-costed profit figures.
create or replace view public.monthly_financial_report as
select
  date_trunc('month', order_date)::date as month_start,
  count(*)::integer as completed_orders,
  coalesce(sum(total_amount), 0)::numeric as revenue,
  coalesce(sum(discount), 0)::numeric as discounts,
  count(*) filter (where cost_status = 'known')::integer as known_cost_orders,
  coalesce(sum(total_amount) filter (where cost_status = 'known'), 0)::numeric as known_cost_revenue,
  coalesce(sum(total_cost) filter (where cost_status = 'known'), 0)::numeric as known_cost,
  (
    coalesce(sum(total_amount) filter (where cost_status = 'known'), 0)
    - coalesce(sum(total_cost) filter (where cost_status = 'known'), 0)
  )::numeric as known_gross_profit,
  count(*) filter (where cost_status = 'pending')::integer as pending_cost_orders,
  coalesce(sum(total_amount) filter (where cost_status = 'pending'), 0)::numeric as pending_cost_revenue
from public.orders
where status = 'completed'
group by 1;
