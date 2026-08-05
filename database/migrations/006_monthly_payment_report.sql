-- Monthly cash and bank-transfer reconciliation, grouped by destination.
create or replace view public.monthly_payment_report as
select
  date_trunc('month', o.order_date)::date as month_start,
  case
    when pl.payment_method = 'cash' then 'cash'
    else pl.destination_account
  end as payment_destination,
  count(*)::integer as payment_count,
  coalesce(sum(pl.amount), 0)::numeric as amount
from public.payment_logs pl
join public.orders o on o.id = pl.order_id
group by 1, 2;
