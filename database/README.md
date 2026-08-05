# Database setup (Phase 3)

This folder contains the PostgreSQL schema for the film-store POS. The schema
is ready for Supabase PostgreSQL, but it uses standard PostgreSQL features and
also works with other PostgreSQL hosts.

## What is stored

- `products`: one record for each film product and its current selling price.
- `inventory_batches`: each purchase/delivery, including the remaining units
  and unit cost.
- `orders` and `order_items`: sales history.
- `inventory_allocations`: the exact batches consumed by each sale item. This
  is required when one sale consumes stock from multiple FIFO batches.
- `payment_logs`: cash or bank-transfer payment details.

All monetary values are whole Vietnamese dong (`numeric(12, 0)`). Quantities
are whole film rolls.

## Apply the schema in Supabase

1. Create a Supabase project and open **SQL Editor**.
2. For a new, empty database, run `migrations/001_initial_schema.sql`.
   For the existing project database, run `migrations/002_phase3_import_schema.sql`
   instead. It keeps the tables and rows already present in Supabase.
3. Confirm that all six tables appear in the Table Editor.
4. Copy `seeds/001_inventory.template.sql`, replace every `<...>` placeholder
   with actual stock information, then run the completed SQL in the SQL Editor.

Do not commit the Supabase connection string or password. Phase 4 will add a
backend `.env` configuration and use the connection string to query this data.

## Validate real inventory

After entering stock, this query lists products and the inventory calculated
from their remaining batches:

```sql
select
  p.id,
  p.name,
  p.format,
  p.selling_price,
  coalesce(sum(b.remaining_quantity), 0) as stock
from products p
left join inventory_batches b on b.product_id = p.id
group by p.id
order by p.name, p.format;
```

The `remaining_quantity` values should match the physical stock count. Keep
batches separate whenever their purchase cost or received date differs.
