const assert = require('node:assert/strict');
const test = require('node:test');
const app = require('../app');

test('GET /api/products returns the mock product list', async (t) => {
  const server = app.listen(0);
  t.after(() => server.close());

  const { port } = server.address();
  const response = await fetch(`http://127.0.0.1:${port}/api/products`);

  assert.equal(response.status, 200);

  const products = await response.json();
  assert.ok(Array.isArray(products));
  assert.equal(products.length, 3);
  assert.deepEqual(Object.keys(products[0]).sort(), [
    'batches',
    'format',
    'id',
    'name',
    'price',
    'stock',
  ]);
});
