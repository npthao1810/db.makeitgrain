-- Replace every <...> value with real inventory data before running this file.
-- Prices and costs are stored as whole Vietnamese dong amounts.

begin;

-- Insert one row per product. A product is unique by its name and format.
insert into products (name, format, selling_price)
values ('<film name>', '<35mm or 120>', <selling price in VND>);

-- Insert one row for every delivery/purchase batch. Do not combine batches
-- bought at different costs: FIFO depends on their separate received dates.
insert into inventory_batches (
  product_id,
  received_quantity,
  remaining_quantity,
  unit_cost,
  received_at
)
values (
  <product id from products>,
  <quantity received>,
  <quantity currently in stock>,
  <cost per roll in VND>,
  '<YYYY-MM-DD>T<HH:MM:SS>+07:00'
);

commit;
