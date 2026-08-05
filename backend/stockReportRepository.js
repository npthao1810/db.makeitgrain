const database = require('./database');

function validateMonth(month) {
  if (month !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(month)) {
    const error = new Error('Month must use YYYY-MM-DD format.');
    error.status = 400;
    throw error;
  }
}

async function getMonthlyStock(month) {
  validateMonth(month);

  const { rows: availableMonths } = await database.query(
    `select distinct to_char(month_start, 'YYYY-MM-DD') as month_start
     from public.monthly_stock_reconciliation
     order by month_start desc`,
  );
  const selectedMonth = month || availableMonths[0]?.month_start;

  if (!selectedMonth) {
    return { monthStart: null, months: [], totals: null, products: [] };
  }

  const [{ rows: products }, { rows: totals }] = await Promise.all([
    database.query(
      `select to_char(month_start, 'YYYY-MM-DD') as month_start,
              product_id, product_name, exposures, opening_stock, received_quantity,
              sold_quantity, closing_stock, reconciliation_status, personal_usage_quantity
       from public.monthly_stock_reconciliation
       where month_start = $1
       order by closing_stock desc, product_name, exposures`,
      [selectedMonth],
    ),
    database.query(
      `select sum(received_quantity)::integer as received_quantity,
              sum(sold_quantity)::integer as sold_quantity,
              sum(personal_usage_quantity)::integer as personal_usage_quantity,
              sum(closing_stock)::integer as closing_stock
       from public.monthly_stock_reconciliation
       where month_start = $1`,
      [selectedMonth],
    ),
  ]);

  return {
    monthStart: selectedMonth,
    months: availableMonths.map(({ month_start: monthStart }) => monthStart),
    totals: totals[0],
    products: products.map((product) => ({
      ...product,
      opening_stock: Number(product.opening_stock || 0),
      received_quantity: Number(product.received_quantity || 0),
      sold_quantity: Number(product.sold_quantity || 0),
      personal_usage_quantity: Number(product.personal_usage_quantity || 0),
      closing_stock: Number(product.closing_stock || 0),
    })),
  };
}

module.exports = { getMonthlyStock };
