const database = require('./database');
const { CheckoutError } = require('./checkoutService');

// A deleted POS order must return every allocated roll to its original batch
// before the order records are removed, otherwise stock and FIFO reporting
// would remain understated.
async function deleteOrder(orderId) {
  const id = Number(orderId);
  if (!Number.isInteger(id) || id <= 0) throw new CheckoutError('Invalid order ID.', 400);

  const client = await database.getClient();
  try {
    await client.query('begin');
    const order = await client.query(
      `select id from public.orders where id = $1 and status = 'completed' for update`,
      [id],
    );
    if (!order.rows[0]) throw new CheckoutError('Completed order not found.', 404);

    const allocations = await client.query(
      `select ia.inventory_batch_id, ia.quantity
       from public.inventory_allocations ia
       join public.order_items oi on oi.id = ia.order_item_id
       where oi.order_id = $1
       for update`,
      [id],
    );
    for (const allocation of allocations.rows) {
      await client.query(
        'update public.inventory_batches set remaining_quantity = remaining_quantity + $1 where id = $2',
        [allocation.quantity, allocation.inventory_batch_id],
      );
    }

    await client.query('delete from public.inventory_allocations where order_item_id in (select id from public.order_items where order_id = $1)', [id]);
    await client.query('delete from public.payment_logs where order_id = $1', [id]);
    await client.query('delete from public.order_change_logs where order_id = $1', [id]);
    await client.query('delete from public.order_items where order_id = $1', [id]);
    await client.query('delete from public.orders where id = $1', [id]);
    await client.query('commit');
    return { orderId: id };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { deleteOrder };
