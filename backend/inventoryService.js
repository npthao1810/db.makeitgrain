const database = require('./database');
const { CheckoutError } = require('./checkoutService');

function wholePositiveNumber(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw new CheckoutError(`${label} must be a positive whole number.`);
  }
  return number;
}

function wholeNonNegativeNumber(value, label) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) {
    throw new CheckoutError(`${label} must be a whole, non-negative VND amount.`);
  }
  return number;
}

function dateValue(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new CheckoutError(`${label} must use YYYY-MM-DD.`);
  }
  return value;
}

async function activeProduct(client, productId) {
  const { rows } = await client.query(
    'select id, name from public.products where id = $1 and is_active = true for update',
    [productId],
  );
  if (!rows[0]) throw new CheckoutError('Choose an active product.', 404);
  return rows[0];
}

async function receiveStock({ productId, quantity, unitCost, receivedAt }) {
  const normalizedProductId = wholePositiveNumber(productId, 'Product ID');
  const normalizedQuantity = wholePositiveNumber(quantity, 'Quantity');
  const normalizedCost = wholeNonNegativeNumber(unitCost, 'Unit cost');
  const normalizedDate = dateValue(receivedAt, 'Received date');
  const client = await database.getClient();
  try {
    await client.query('begin');
    const product = await activeProduct(client, normalizedProductId);
    const { rows } = await client.query(
      `insert into public.inventory_batches (
        product_id, quantity, remaining_quantity, cost_price, cost_status, received_at, raw_product_name
      ) values ($1, $2, $2, $3, 'known', $4, $5)
      returning id`,
      [normalizedProductId, normalizedQuantity, normalizedCost, normalizedDate, product.name],
    );
    await client.query('commit');
    return { batchId: rows[0].id, productName: product.name, quantity: normalizedQuantity };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

async function recordPersonalUsage({ productId, quantity, occurredAt, note = null }) {
  const normalizedProductId = wholePositiveNumber(productId, 'Product ID');
  const normalizedQuantity = wholePositiveNumber(quantity, 'Quantity');
  const normalizedDate = dateValue(occurredAt, 'Usage date');
  const client = await database.getClient();
  try {
    await client.query('begin');
    const product = await activeProduct(client, normalizedProductId);
    const { rows: batches } = await client.query(
      `select id, remaining_quantity, cost_price
       from public.inventory_batches
       where product_id = $1 and remaining_quantity > 0
       order by received_at nulls last, id
       for update`,
      [normalizedProductId],
    );
    const stock = batches.reduce((total, batch) => total + Number(batch.remaining_quantity), 0);
    if (stock < normalizedQuantity) {
      throw new CheckoutError(`${product.name} has only ${stock} rolls available.`, 409);
    }

    let remaining = normalizedQuantity;
    for (const batch of batches) {
      if (!remaining) break;
      const used = Math.min(remaining, Number(batch.remaining_quantity));
      await client.query(
        `insert into public.inventory_adjustments (
          product_id, inventory_batch_id, quantity, adjustment_type, occurred_at, unit_cost, note
        ) values ($1, $2, $3, 'personal_usage', $4, $5, $6)`,
        [normalizedProductId, batch.id, used, normalizedDate, batch.cost_price, note?.trim() || null],
      );
      await client.query(
        'update public.inventory_batches set remaining_quantity = remaining_quantity - $1 where id = $2',
        [used, batch.id],
      );
      remaining -= used;
    }
    await client.query('commit');
    return { productName: product.name, quantity: normalizedQuantity };
  } catch (error) {
    await client.query('rollback');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { receiveStock, recordPersonalUsage };
