const database = require('./database');
const { CheckoutError } = require('./checkoutService');

async function cancelOrder(orderId, { reason = null } = {}) {
  const id = Number(orderId);
  if (!Number.isInteger(id) || id <= 0) throw new CheckoutError('Invalid order ID.', 400);

  const client = await database.getClient();
  try {
    await client.query('begin');
    const { rows: orders } = await client.query(
      `select id, total_amount from public.orders
       where id = $1 and status = 'completed' for update`,
      [id],
    );
    if (!orders[0]) throw new CheckoutError('Completed order not found.', 404);

    const { rows: allocations } = await client.query(
      `select ia.inventory_batch_id, ia.quantity
       from public.inventory_allocations ia
       join public.order_items oi on oi.id = ia.order_item_id
       where oi.order_id = $1
       for update`,
      [id],
    );
    for (const allocation of allocations) {
      await client.query(
        'update public.inventory_batches set remaining_quantity = remaining_quantity + $1 where id = $2',
        [allocation.quantity, allocation.inventory_batch_id],
      );
    }
    await client.query('delete from public.inventory_allocations where order_item_id in (select id from public.order_items where order_id = $1)', [id]);
    await client.query('delete from public.payment_logs where order_id = $1', [id]);
    await client.query(`update public.orders set status = 'cancelled' where id = $1`, [id]);
    await client.query(
      `insert into public.order_change_logs (order_id, before_data, after_data, change_note)
       values ($1, $2::jsonb, $3::jsonb, $4)`,
      [id, JSON.stringify({ status: 'completed', totalAmount: Number(orders[0].total_amount) }), JSON.stringify({ status: 'cancelled' }), reason?.trim() || 'Order cancelled'],
    );
    await client.query('commit');
    return { orderId: id, status: 'cancelled' };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { cancelOrder };
