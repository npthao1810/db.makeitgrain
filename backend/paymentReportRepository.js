const database = require('./database');

async function listMonthlyPayments() {
  const { rows } = await database.query(
    `select to_char(month_start, 'YYYY-MM-DD') as month_start,
            payment_destination, payment_count, amount
     from public.monthly_payment_report
     order by month_start desc, payment_destination`,
  );

  return rows.map((row) => ({
    ...row,
    payment_count: Number(row.payment_count),
    amount: Number(row.amount),
  }));
}

module.exports = { listMonthlyPayments };
