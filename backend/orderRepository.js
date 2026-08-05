const database = require('./database');

function validateMonth(month) {
  if (month !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(month)) {
    const error = new Error('Month must use YYYY-MM-DD format.');
    error.status = 400;
    throw error;
  }
}

async function listOrders(month) {
  validateMonth(month);
  const { rows: availableMonths } = await database.query(
    `select distinct to_char(date_trunc('month', order_date)::date, 'YYYY-MM-DD') as month_start
     from public.orders
     where status = 'completed'
     order by month_start desc`,
  );
  const selectedMonth = month || availableMonths[0]?.month_start;

  if (!selectedMonth) return { monthStart: null, months: [], orders: [] };

  const { rows } = await database.query(
    `select
       o.id, o.source_order_key, to_char(o.order_date, 'YYYY-MM-DD') as order_date,
       o.date_precision, o.customer_name,
       o.total_amount, o.discount, o.total_cost, o.cost_status,
       o.payment_method, o.payment_destination,
       json_agg(
         json_build_object(
           'productId', oi.product_id,
           'productName', p.name,
           'exposures', p.exposures,
           'quantity', oi.quantity,
           'unitPrice', oi.unit_price
         ) order by oi.id
       ) as items,
       string_agg(
         p.name || case when p.exposures is not null then ' (' || p.exposures || ' exp)' else '' end
         || ' × ' || oi.quantity,
         '; ' order by oi.id
       ) as products
     from public.orders o
     join public.order_items oi on oi.order_id = o.id
     join public.products p on p.id = oi.product_id
     where date_trunc('month', o.order_date)::date = $1
       and o.status = 'completed'
     group by o.id
     order by o.order_date desc, o.id desc`,
    [selectedMonth],
  );

  return {
    monthStart: selectedMonth,
    months: availableMonths.map(({ month_start: monthStart }) => monthStart),
    orders: rows.map((order) => ({
      ...order,
      total_amount: Number(order.total_amount),
      discount: Number(order.discount),
      total_cost: order.total_cost === null ? null : Number(order.total_cost),
      items: order.items.map((item) => ({ ...item, unitPrice: Number(item.unitPrice) })),
    })),
  };
}

module.exports = { listOrders };
