# Project State

## Current Status
- Đã hoàn thành Khởi tạo Frontend React (Vite + Tailwind CSS).
- Giao diện đã kết nối thành công với Backend Mock Data.
- Đã hoàn thành Phase 3: CSDL PostgreSQL với Supabase và dữ liệu lịch sử thực.

## Active Phase
- In progress: Phase 6 (Stock reconciliation & reporting)

## Phase 4 Progress
- Backend product endpoint now reads from PostgreSQL through `DATABASE_URL`.
- `backend/.env.example` documents the required server-only configuration.
- Automated endpoint tests pass with repository/service test doubles.
- The backend has been verified against the live Supabase database using the
  local, ignored `backend/.env` connection string.

## Phase 5 Progress
- The frontend now displays the 20 live products and their batch-derived
  remaining stock, rather than mock data.
- A cart and checkout form collect an optional customer name plus cash or bank
  transfer destination.
- `POST /api/checkout` creates the order, order items, FIFO allocations, batch
  stock updates, and payment log in a single PostgreSQL transaction. It rolls
  everything back if any product is unavailable or an error occurs.
- Backend tests, frontend lint/build, and a local browser check against the
  live database all pass. The browser check did not submit an order, so no
  production inventory was changed during verification.

## Phase 6 Progress
- Added `monthly_stock_reconciliation`, a live month-end ledger view with
  opening, received, sold, closing, and negative-stock status per product.
- The POS now includes a month selector and stock tracker backed by
  `GET /api/reports/monthly-stock`.
- Added a monthly finance view and report for revenue, discounts, known FIFO
  cost, known gross profit, and orders whose cost is still pending.
- Added monthly payment reconciliation for cash, shop-account, and
  personal-account receipts; 841 positive historical payment logs were
  backfilled from verified order payment fields.
- Added month-filtered order history with product lines, payment destination,
  recorded cost, and gross profit per completed order.
- Split the POS into five focused pages under the top navigation: Create Order,
  Stock, Order History, Finance, and Payments. The navigation sits directly
  below the Make It Grain brand.
- Normalized PostgreSQL `DATE` values at the API boundary so calendar months
  and order dates do not shift by one day/month in the browser timezone.
- Order History now supports editing a completed order’s customer, payment
  destination, discount, products, quantities, and historical unit prices.
  Each correction is transactional, reallocates its FIFO stock, refreshes its
  payment log, and records before/after values in `order_change_logs`.
- Create Order now supports saved-customer name/link lookup, an optional
  discount, and fulfillment details: offline appointment time or online phone
  number plus delivery address.

## Phase 3 Progress
- Supabase product catalog: 20 products, including the seven confirmed additions.
- Forward migration `database/migrations/002_phase3_import_schema.sql` has been
  applied to the existing database; it preserves the 12 legacy inventory rows.
- Row Level Security is enabled on `products`, `inventory_batches`, `orders`,
  `order_items`, `inventory_allocations`, and `payment_logs`.
- Reviewed history is ready for import: 843 orders, 1,124 order items, and 108
  inventory-batch rows. Eighty-six numbered but otherwise blank source rows
  were excluded. The source history is imported and reconciled.
- FIFO is allocated for all 2,107 sold rolls across 1,161 allocation rows.
  Six cost-pending opening batches cover 38 rolls from unrecorded historic
  stock; this flags 12 order items and 11 orders as `cost_pending` instead of
  inventing supplier costs.

## Completed Phases
- Phase 1 (Setup Backend Node.js với Mock Data)
- Phase 2 (Khởi tạo Frontend React)
- Phase 3 (Thiết kế CSDL PostgreSQL)
