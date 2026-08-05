const database = require('./database');

async function listMonthlyFinance() {
  const { rows } = await database.query(
    `select to_char(month_start, 'YYYY-MM-DD') as month_start,
            completed_orders, revenue, discounts, known_cost_orders,
            known_cost_revenue, known_cost, known_gross_profit, pending_cost_orders,
            pending_cost_revenue
     from public.monthly_financial_report
     order by month_start desc`,
  );

  return rows.map((row) => ({
    ...row,
    completed_orders: Number(row.completed_orders),
    revenue: Number(row.revenue),
    discounts: Number(row.discounts),
    known_cost_orders: Number(row.known_cost_orders),
    known_cost_revenue: Number(row.known_cost_revenue),
    known_cost: Number(row.known_cost),
    known_gross_profit: Number(row.known_gross_profit),
    pending_cost_orders: Number(row.pending_cost_orders),
    pending_cost_revenue: Number(row.pending_cost_revenue),
  }));
}

module.exports = { listMonthlyFinance };
