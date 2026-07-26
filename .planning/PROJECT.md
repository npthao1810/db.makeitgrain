# Project Context: db.makeitgrain

## Vision
Hệ thống quản lý kho và bán hàng (POS) Full-stack dành cho cửa hàng bán cuộn phim (analog film rolls). Hệ thống cung cấp công cụ quản lý giỏ hàng nhanh chóng, quy trình thanh toán an toàn với Database Transaction và báo cáo tài chính trực quan.

## Target Audience
- Nhân viên bán hàng tại quầy (Thao tác bán hàng, chốt đơn)
- Chủ cửa hàng (Xem báo cáo tài chính, quản lý tồn kho)

## Core Tech Stack
- Frontend: React (Vite)
- Backend: Node.js & Express
- Database: PostgreSQL (Neon/Supabase)
- Thư viện khác: Chart.js (Frontend), pg (Backend)

## Key Workflows
1. Nhân viên chọn cuộn phim, thêm vào giỏ hàng trên giao diện Web POS.
2. Nhân viên thực hiện thanh toán (chốt đơn), Backend xử lý transaction ghi nhận hóa đơn và trừ tồn kho trong PostgreSQL.
3. Chủ cửa hàng xem báo cáo tài chính hàng tháng (doanh thu, lợi nhuận) trực tiếp trên Web.
