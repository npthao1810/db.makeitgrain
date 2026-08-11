const assert = require('node:assert/strict');
const test = require('node:test');
const { createApp } = require('../app');
const { CheckoutError } = require('../checkoutService');

test('GET /api/health confirms that the API and database are reachable', async (t) => {
  const app = createApp({ health: { check: async () => ({ status: 'ok', database: 'connected' }) } });
  const server = app.listen(0);
  t.after(() => server.close());

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/health`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok', database: 'connected' });
});

test('GET /api/health reports a safe unavailable status when the database ping fails', async (t) => {
  const app = createApp({ health: { check: async () => { throw new Error('connection failed'); } }, logger: { error() {} } });
  const server = app.listen(0);
  t.after(() => server.close());

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/health`);

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), { status: 'unavailable', database: 'disconnected' });
});

test('protected API routes use the configured authentication middleware', async (t) => {
  const app = createApp({
    auth: {
      requireUser(req, res) {
        res.status(401).json({ error: 'Sign in is required.' });
      },
    },
  });
  const server = app.listen(0);
  t.after(() => server.close());

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/products`);

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { error: 'Sign in is required.' });
});

test('GET /api/products returns products from the repository', async (t) => {
  const app = createApp({
    products: {
      listProducts: async () => [{
        id: 16,
        name: 'Colorplus 200',
        exposures: 36,
        format: '36 exp',
        price: 250000,
        stock: 20,
      }],
    },
  });
  const server = app.listen(0);
  t.after(() => server.close());

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/products`);

  assert.equal(response.status, 200);

  const products = await response.json();
  assert.deepEqual(products, [{
    id: 16,
    name: 'Colorplus 200',
    exposures: 36,
    format: '36 exp',
    price: 250000,
    stock: 20,
  }]);
});

test('GET /api/products returns a safe error when the database fails', async (t) => {
  const app = createApp({
    products: {
      listProducts: async () => {
        throw new Error('connection failed');
      },
    },
    logger: { error() {} },
  });
  const server = app.listen(0);
  t.after(() => server.close());

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/products`);

  assert.equal(response.status, 500);
  assert.deepEqual(await response.json(), { error: 'Unable to load products.' });
});

test('POST /api/products creates a catalog product', async (t) => {
  const app = createApp({
    products: {
      createProduct: async (body) => {
        assert.deepEqual(body, { name: 'Kodak Gold 200', exposures: 24, price: 210000 });
        return { id: 21, name: 'Kodak Gold 200', exposures: 24, price: 210000 };
      },
    },
  });
  const server = app.listen(0);
  t.after(() => server.close());
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/products`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Kodak Gold 200', exposures: 24, price: 210000 }),
  });
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { id: 21, name: 'Kodak Gold 200', exposures: 24, price: 210000 });
});

test('GET /api/customers returns saved customer profiles', async (t) => {
  const app = createApp({
    customers: { listCustomerProfiles: async () => [{ customerName: 'Thao', customerContact: '0900000000', customerLink: null, phoneNumber: '0900000000', address: '243 Le Thuoc' }] },
  });
  const server = app.listen(0);
  t.after(() => server.close());
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/customers`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), [{ customerName: 'Thao', customerContact: '0900000000', customerLink: null, phoneNumber: '0900000000', address: '243 Le Thuoc' }]);
});

test('POST /api/inventory/receipts records a received batch', async (t) => {
  const app = createApp({
    inventory: {
      receiveStock: async (body) => {
        assert.deepEqual(body, { productId: 4, quantity: 20, unitCost: 210000, receivedAt: '2026-08-06' });
        return { batchId: 120, productName: 'Ultramax 400', quantity: 20 };
      },
    },
  });
  const server = app.listen(0);
  t.after(() => server.close());
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/inventory/receipts`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ productId: 4, quantity: 20, unitCost: 210000, receivedAt: '2026-08-06' }),
  });
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { batchId: 120, productName: 'Ultramax 400', quantity: 20 });
});

test('POST /api/inventory/personal-usage records a FIFO stock adjustment', async (t) => {
  const app = createApp({
    inventory: {
      recordPersonalUsage: async (body) => {
        assert.equal(body.productId, 4);
        assert.equal(body.quantity, 2);
        return { productName: 'Ultramax 400', quantity: 2 };
      },
    },
  });
  const server = app.listen(0);
  t.after(() => server.close());
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/inventory/personal-usage`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ productId: 4, quantity: 2, occurredAt: '2026-08-06', note: 'Personal use' }),
  });
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { productName: 'Ultramax 400', quantity: 2 });
});

test('GET /api/reports/monthly-stock returns the selected month stock report', async (t) => {
  const app = createApp({
    stockReports: {
      getMonthlyStock: async (month) => {
        assert.equal(month, '2025-01-01');
        return {
          monthStart: month,
          months: ['2025-01-01'],
          totals: { received_quantity: 245, sold_quantity: 193, closing_stock: 466 },
          products: [],
        };
      },
    },
  });
  const server = app.listen(0);
  t.after(() => server.close());

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/reports/monthly-stock?month=2025-01-01`);

  assert.equal(response.status, 200);
  assert.equal((await response.json()).totals.closing_stock, 466);
});

test('GET /api/reports/monthly-finance returns monthly finance rows', async (t) => {
  const app = createApp({
    financialReports: {
      listMonthlyFinance: async () => [{ month_start: '2025-01-01', revenue: 1000000 }],
    },
  });
  const server = app.listen(0);
  t.after(() => server.close());

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/reports/monthly-finance`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), [{ month_start: '2025-01-01', revenue: 1000000 }]);
});

test('GET /api/reports/monthly-payments returns monthly payment rows', async (t) => {
  const app = createApp({
    paymentReports: {
      listMonthlyPayments: async () => [{ month_start: '2025-01-01', payment_destination: 'shop_account', amount: 500000 }],
    },
  });
  const server = app.listen(0);
  t.after(() => server.close());

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/reports/monthly-payments`);

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), [{ month_start: '2025-01-01', payment_destination: 'shop_account', amount: 500000 }]);
});

test('GET /api/orders returns month-filtered order history', async (t) => {
  const app = createApp({
    orders: {
      listOrders: async (month) => {
        assert.equal(month, '2025-01-01');
        return { monthStart: month, months: [month], orders: [] };
      },
    },
  });
  const server = app.listen(0);
  t.after(() => server.close());

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/orders?month=2025-01-01`);

  assert.equal(response.status, 200);
  assert.equal((await response.json()).monthStart, '2025-01-01');
});

test('POST /api/checkout returns the completed order', async (t) => {
  const app = createApp({
    checkout: {
      checkout: async ({ items, orderDate }) => {
        assert.deepEqual(items, [{ productId: 16, quantity: 2 }]);
        assert.equal(orderDate, '2026-08-11');
        return { orderId: 845, totalAmount: 500000, costStatus: 'known' };
      },
    },
  });
  const server = app.listen(0);
  t.after(() => server.close());

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/checkout`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ items: [{ productId: 16, quantity: 2 }], orderDate: '2026-08-11' }),
  });

  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { orderId: 845, totalAmount: 500000, costStatus: 'known' });
});

test('POST /api/checkout returns a checkout error without creating an order', async (t) => {
  const app = createApp({
    checkout: {
      checkout: async () => {
        throw new CheckoutError('Colorplus 200 has only 1 rolls remaining.', 409);
      },
    },
  });
  const server = app.listen(0);
  t.after(() => server.close());

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/checkout`, { method: 'POST' });

  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { error: 'Colorplus 200 has only 1 rolls remaining.' });
});

test('PUT /api/orders/:id updates an order through the edit service', async (t) => {
  const app = createApp({
    orderEdits: {
      updateOrder: async (id, body) => {
        assert.equal(id, '845');
        assert.equal(body.customerName, 'Thao');
        return { orderId: 845, totalAmount: 500000, costStatus: 'known' };
      },
    },
  });
  const server = app.listen(0);
  t.after(() => server.close());

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/orders/845`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ customerName: 'Thao', items: [{ productId: 16, quantity: 2, unitPrice: 250000 }] }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { orderId: 845, totalAmount: 500000, costStatus: 'known' });
});

test('DELETE /api/orders/:id deletes an order through the delete service', async (t) => {
  const app = createApp({
    orderDeletes: {
      deleteOrder: async (id) => {
        assert.equal(id, '845');
        return { orderId: 845 };
      },
    },
  });
  const server = app.listen(0);
  t.after(() => server.close());

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/orders/845`, { method: 'DELETE' });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { orderId: 845 });
});

test('POST /api/orders/:id/cancel cancels an order through the cancel service', async (t) => {
  const app = createApp({
    orderCancels: {
      cancelOrder: async (id, body) => {
        assert.equal(id, '845');
        assert.equal(body.reason, 'Customer changed their mind');
        return { orderId: 845, status: 'cancelled' };
      },
    },
  });
  const server = app.listen(0);
  t.after(() => server.close());
  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/orders/845/cancel`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ reason: 'Customer changed their mind' }),
  });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { orderId: 845, status: 'cancelled' });
});
