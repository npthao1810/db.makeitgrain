const database = require('./database');
const { CheckoutError } = require('./checkoutService');

const PRODUCTS_QUERY = `
  select
    p.id,
    p.name,
    p.exposures,
    p.price,
    coalesce(sum(b.remaining_quantity), 0) as stock
  from public.products p
  left join public.inventory_batches b on b.product_id = p.id
  where p.is_active = true
  group by p.id, p.name, p.exposures, p.price
  order by
    (coalesce(sum(b.remaining_quantity), 0) = 0) asc,
    p.price asc,
    p.name asc,
    p.exposures asc;
`;

async function listProducts() {
  const { rows } = await database.query(PRODUCTS_QUERY);

  return rows.map((product) => ({
    id: product.id,
    name: product.name,
    exposures: product.exposures,
    format: product.exposures ? `${product.exposures} exp` : 'Film',
    price: Number(product.price),
    stock: Number(product.stock),
  }));
}

async function createProduct({ name, exposures, price }) {
  const normalizedName = name?.trim();
  const normalizedExposures = Number(exposures);
  const normalizedPrice = Number(price);
  if (!normalizedName) throw new CheckoutError('Product name is required.');
  if (!Number.isInteger(normalizedExposures) || normalizedExposures <= 0) {
    throw new CheckoutError('Exposures must be a positive whole number.');
  }
  if (!Number.isInteger(normalizedPrice) || normalizedPrice < 0) {
    throw new CheckoutError('Selling price must be a whole, non-negative VND amount.');
  }

  const existing = await database.query(
    'select id from public.products where lower(name) = lower($1) and exposures = $2',
    [normalizedName, normalizedExposures],
  );
  if (existing.rows[0]) throw new CheckoutError('This product already exists.', 409);

  const { rows } = await database.query(
    `insert into public.products (name, exposures, price, is_active)
     values ($1, $2, $3, true)
     returning id, name, exposures, price`,
    [normalizedName, normalizedExposures, normalizedPrice],
  );
  return { ...rows[0], price: Number(rows[0].price) };
}

module.exports = {
  listProducts,
  createProduct,
};
