const database = require('./database');

class CheckoutError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function normalizeItems(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new CheckoutError('Add at least one product to the cart.');
  }

  const quantitiesByProduct = new Map();
  for (const item of items) {
    const productId = Number(item.productId);
    const quantity = Number(item.quantity);
    if (!Number.isInteger(productId) || !Number.isInteger(quantity) || quantity <= 0) {
      throw new CheckoutError('Each cart item needs a valid product and quantity.');
    }
    quantitiesByProduct.set(productId, (quantitiesByProduct.get(productId) || 0) + quantity);
  }

  return [...quantitiesByProduct].map(([productId, quantity]) => ({ productId, quantity }));
}

function paymentDetails(paymentMethod, paymentDestination) {
  if (paymentMethod === 'cash') {
    return { paymentMethod, paymentDestination: null };
  }
  if (paymentMethod === 'bank_transfer' && ['shop_account', 'personal_account'].includes(paymentDestination)) {
    return { paymentMethod, paymentDestination };
  }
  throw new CheckoutError('Choose a valid payment method and destination account.');
}

function fulfillmentDetails(fulfillmentMethod, appointmentTime, phoneNumber, address) {
  if (fulfillmentMethod === 'offline') {
    if (!appointmentTime?.trim()) throw new CheckoutError('Add an appointment time for an offline order.');
    return {
      fulfillmentMethod,
      appointmentTime: appointmentTime.trim(),
      phoneNumber: null,
      address: null,
    };
  }
  if (fulfillmentMethod === 'online') {
    if (!phoneNumber?.trim() || !address?.trim()) {
      throw new CheckoutError('Add a phone number and address for an online order.');
    }
    return {
      fulfillmentMethod,
      appointmentTime: null,
      phoneNumber: phoneNumber.trim(),
      address: address.trim(),
    };
  }
  throw new CheckoutError('Choose Offline or Online for this order.');
}

function orderDateValue(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new CheckoutError('Order date must use YYYY-MM-DD format.');
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new CheckoutError('Order date must be a real calendar date.');
  }
  return value;
}

async function checkout({
  customerName = null,
  customerLink = null,
  orderDate = null,
  discount = 0,
  fulfillmentMethod,
  appointmentTime = null,
  phoneNumber = null,
  address = null,
  paymentMethod = 'cash',
  paymentDestination = null,
  items,
}) {
  const cartItems = normalizeItems(items);
  const payment = paymentDetails(paymentMethod, paymentDestination);
  const fulfillment = fulfillmentDetails(fulfillmentMethod, appointmentTime, phoneNumber, address);
  const selectedOrderDate = orderDateValue(orderDate);
  const orderDiscount = Number(discount || 0);
  if (!Number.isInteger(orderDiscount) || orderDiscount < 0) {
    throw new CheckoutError('Discount must be a whole, non-negative VND amount.');
  }
  const client = await database.getClient();

  try {
    await client.query('begin');
    const preparedItems = [];
    let totalAmount = 0;

    for (const cartItem of cartItems) {
      const productResult = await client.query(
        'select id, name, price from public.products where id = $1 and is_active = true for update',
        [cartItem.productId],
      );
      const product = productResult.rows[0];
      if (!product) {
        throw new CheckoutError('A product in the cart is unavailable.', 409);
      }

      const batchResult = await client.query(
        `select id, remaining_quantity, cost_price, cost_status
         from public.inventory_batches
         where product_id = $1 and remaining_quantity > 0
         order by received_at nulls last, id
         for update`,
        [cartItem.productId],
      );
      const availableStock = batchResult.rows.reduce((sum, batch) => sum + Number(batch.remaining_quantity), 0);
      if (availableStock < cartItem.quantity) {
        throw new CheckoutError(`${product.name} has only ${availableStock} rolls remaining.`, 409);
      }

      const unitPrice = Number(product.price);
      totalAmount += unitPrice * cartItem.quantity;
      preparedItems.push({ ...cartItem, product, unitPrice, batches: batchResult.rows });
    }

    if (orderDiscount > totalAmount) {
      throw new CheckoutError('Discount cannot exceed the order subtotal.');
    }
    totalAmount -= orderDiscount;
    const orderResult = await client.query(
      `insert into public.orders (
        customer_name, customer_link, discount, fulfillment_method, appointment_note,
        delivery_phone, delivery_address, status, total_amount, total_cost,
        payment_method, payment_destination, order_date, cost_status
      ) values ($1, $2, $3, $4, $5, $6, $7, 'completed', $8, 0, $9, $10, coalesce($11::date, current_date), 'known')
      returning id, to_char(order_date, 'YYYY-MM-DD') as order_date`,
      [
        customerName?.trim() || null,
        customerLink?.trim() || null,
        orderDiscount,
        fulfillment.fulfillmentMethod,
        fulfillment.appointmentTime,
        fulfillment.phoneNumber,
        fulfillment.address,
        totalAmount,
        payment.paymentMethod,
        payment.paymentDestination,
        selectedOrderDate,
      ],
    );
    const orderId = orderResult.rows[0].id;
    let orderCost = 0;
    let orderHasPendingCost = false;

    for (const item of preparedItems) {
      const orderItemResult = await client.query(
        `insert into public.order_items (
          order_id, product_id, quantity, unit_price, total_cost, cost_status
        ) values ($1, $2, $3, $4, 0, 'known') returning id`,
        [orderId, item.productId, item.quantity, item.unitPrice],
      );
      const orderItemId = orderItemResult.rows[0].id;
      let quantityToAllocate = item.quantity;
      let itemCost = 0;
      let itemHasPendingCost = false;

      for (const batch of item.batches) {
        if (quantityToAllocate === 0) break;
        const allocatedQuantity = Math.min(quantityToAllocate, Number(batch.remaining_quantity));
        const costIsPending = batch.cost_status === 'pending';

        await client.query(
          `insert into public.inventory_allocations (
            order_item_id, inventory_batch_id, quantity, unit_cost, cost_status
          ) values ($1, $2, $3, $4, $5)`,
          [
            orderItemId,
            batch.id,
            allocatedQuantity,
            costIsPending ? null : batch.cost_price,
            costIsPending ? 'pending' : 'known',
          ],
        );
        await client.query(
          'update public.inventory_batches set remaining_quantity = remaining_quantity - $1 where id = $2',
          [allocatedQuantity, batch.id],
        );

        if (costIsPending) {
          itemHasPendingCost = true;
        } else {
          itemCost += allocatedQuantity * Number(batch.cost_price);
        }
        quantityToAllocate -= allocatedQuantity;
      }

      await client.query(
        'update public.order_items set total_cost = $1, cost_status = $2 where id = $3',
        [itemHasPendingCost ? null : itemCost, itemHasPendingCost ? 'pending' : 'known', orderItemId],
      );
      if (itemHasPendingCost) {
        orderHasPendingCost = true;
      } else {
        orderCost += itemCost;
      }
    }

    await client.query(
      'update public.orders set total_cost = $1, cost_status = $2 where id = $3',
      [orderHasPendingCost ? null : orderCost, orderHasPendingCost ? 'pending' : 'known', orderId],
    );
    if (totalAmount > 0) {
      await client.query(
        `insert into public.payment_logs (order_id, payment_method, destination_account, amount)
         values ($1, $2, $3, $4)`,
        [orderId, payment.paymentMethod, payment.paymentDestination, totalAmount],
      );
    }

    await client.query('commit');
    return {
      orderId,
      orderDate: orderResult.rows[0].order_date,
      totalAmount,
      costStatus: orderHasPendingCost ? 'pending' : 'known',
    };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  CheckoutError,
  checkout,
};
