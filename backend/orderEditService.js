const database = require('./database');
const { CheckoutError } = require('./checkoutService');

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new CheckoutError('An order needs at least one product.');
  }

  const itemsByProduct = new Map();
  for (const item of items) {
    const productId = Number(item.productId);
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);
    if (!Number.isInteger(productId) || !Number.isInteger(quantity) || quantity <= 0
      || !Number.isInteger(unitPrice) || unitPrice < 0) {
      throw new CheckoutError('Each line needs a valid product, quantity, and whole-VND unit price.');
    }
    const existing = itemsByProduct.get(productId);
    itemsByProduct.set(productId, {
      productId,
      quantity: quantity + (existing?.quantity || 0),
      unitPrice,
    });
  }
  return [...itemsByProduct.values()];
}

function paymentDetails(paymentMethod, paymentDestination) {
  if (paymentMethod === 'cash') return { paymentMethod, paymentDestination: null };
  if (paymentMethod === 'bank_transfer' && ['shop_account', 'personal_account'].includes(paymentDestination)) {
    return { paymentMethod, paymentDestination };
  }
  throw new CheckoutError('Choose a valid payment method and destination account.');
}

async function updateOrder(orderId, payload) {
  const id = Number(orderId);
  if (!Number.isInteger(id) || id <= 0) throw new CheckoutError('Invalid order ID.', 400);

  const items = normalizeItems(payload.items);
  const payment = paymentDetails(payload.paymentMethod, payload.paymentDestination);
  const discount = Number(payload.discount || 0);
  if (!Number.isInteger(discount) || discount < 0) {
    throw new CheckoutError('Discount must be a whole, non-negative VND amount.');
  }

  const client = await database.getClient();
  try {
    await client.query('begin');
    const existingOrder = await client.query(
      `select id, customer_name, discount, payment_method, payment_destination, total_amount
       from public.orders where id = $1 and status = 'completed' for update`,
      [id],
    );
    if (!existingOrder.rows[0]) throw new CheckoutError('Completed order not found.', 404);

    const oldItems = await client.query(
      `select oi.id, oi.product_id, oi.quantity, oi.unit_price, p.name
       from public.order_items oi join public.products p on p.id = oi.product_id
       where oi.order_id = $1 order by oi.id`,
      [id],
    );
    const oldAllocations = await client.query(
      `select ia.inventory_batch_id, ia.quantity
       from public.inventory_allocations ia
       join public.order_items oi on oi.id = ia.order_item_id
       where oi.order_id = $1
       for update`,
      [id],
    );
    const beforeData = {
      customerName: existingOrder.rows[0].customer_name,
      discount: Number(existingOrder.rows[0].discount),
      paymentMethod: existingOrder.rows[0].payment_method,
      paymentDestination: existingOrder.rows[0].payment_destination,
      totalAmount: Number(existingOrder.rows[0].total_amount),
      items: oldItems.rows.map((item) => ({ productId: item.product_id, productName: item.name, quantity: item.quantity, unitPrice: Number(item.unit_price) })),
    };

    for (const allocation of oldAllocations.rows) {
      await client.query(
        'update public.inventory_batches set remaining_quantity = remaining_quantity + $1 where id = $2',
        [allocation.quantity, allocation.inventory_batch_id],
      );
    }
    await client.query(
      `delete from public.inventory_allocations where order_item_id in
       (select id from public.order_items where order_id = $1)`, [id],
    );
    await client.query('delete from public.order_items where order_id = $1', [id]);

    let subtotal = 0;
    let orderCost = 0;
    let pendingCost = false;
    const savedItems = [];
    for (const item of items) {
      const productResult = await client.query(
        'select id, name from public.products where id = $1 and is_active = true for update', [item.productId],
      );
      const product = productResult.rows[0];
      if (!product) throw new CheckoutError('A product in this order is unavailable.', 409);

      const batches = await client.query(
        `select id, remaining_quantity, cost_price, cost_status
         from public.inventory_batches where product_id = $1 and remaining_quantity > 0
         order by received_at nulls last, id for update`, [item.productId],
      );
      const stock = batches.rows.reduce((total, batch) => total + Number(batch.remaining_quantity), 0);
      if (stock < item.quantity) throw new CheckoutError(`${product.name} has only ${stock} rolls remaining.`, 409);

      subtotal += item.unitPrice * item.quantity;
      const orderItem = await client.query(
        `insert into public.order_items (order_id, product_id, quantity, unit_price, base_unit_price, raw_product_name, total_cost, cost_status, price_source)
         values ($1, $2, $3, $4, $4, $5, 0, 'known', 'order_edit') returning id`,
        [id, item.productId, item.quantity, item.unitPrice, product.name],
      );
      let remaining = item.quantity;
      let itemCost = 0;
      let itemPending = false;
      for (const batch of batches.rows) {
        if (!remaining) break;
        const quantity = Math.min(remaining, Number(batch.remaining_quantity));
        const isPending = batch.cost_status === 'pending';
        await client.query(
          `insert into public.inventory_allocations (order_item_id, inventory_batch_id, quantity, unit_cost, cost_status)
           values ($1, $2, $3, $4, $5)`,
          [orderItem.rows[0].id, batch.id, quantity, isPending ? null : batch.cost_price, isPending ? 'pending' : 'known'],
        );
        await client.query('update public.inventory_batches set remaining_quantity = remaining_quantity - $1 where id = $2', [quantity, batch.id]);
        if (isPending) itemPending = true;
        else itemCost += quantity * Number(batch.cost_price);
        remaining -= quantity;
      }
      await client.query(
        'update public.order_items set total_cost = $1, cost_status = $2 where id = $3',
        [itemPending ? null : itemCost, itemPending ? 'pending' : 'known', orderItem.rows[0].id],
      );
      if (itemPending) pendingCost = true;
      else orderCost += itemCost;
      savedItems.push({ productId: item.productId, productName: product.name, quantity: item.quantity, unitPrice: item.unitPrice });
    }

    if (discount > subtotal) throw new CheckoutError('Discount cannot exceed the order subtotal.');
    const totalAmount = subtotal - discount;
    const customerName = payload.customerName?.trim() || null;
    await client.query(
      `update public.orders set customer_name = $1, discount = $2, total_amount = $3, total_cost = $4,
       cost_status = $5, payment_method = $6, payment_destination = $7 where id = $8`,
      [customerName, discount, totalAmount, pendingCost ? null : orderCost, pendingCost ? 'pending' : 'known', payment.paymentMethod, payment.paymentDestination, id],
    );
    await client.query('delete from public.payment_logs where order_id = $1', [id]);
    if (totalAmount > 0) {
      await client.query(
        `insert into public.payment_logs (order_id, payment_method, destination_account, amount)
         values ($1, $2, $3, $4)`, [id, payment.paymentMethod, payment.paymentDestination, totalAmount],
      );
    }
    const afterData = { customerName, discount, paymentMethod: payment.paymentMethod, paymentDestination: payment.paymentDestination, totalAmount, items: savedItems };
    await client.query(
      `insert into public.order_change_logs (order_id, before_data, after_data, change_note)
       values ($1, $2::jsonb, $3::jsonb, $4)`,
      [id, JSON.stringify(beforeData), JSON.stringify(afterData), payload.changeNote?.trim() || null],
    );

    await client.query('commit');
    return { orderId: id, totalAmount, costStatus: pendingCost ? 'pending' : 'known' };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { updateOrder };
