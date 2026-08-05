const database = require('./database');

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

module.exports = {
  listProducts,
};
