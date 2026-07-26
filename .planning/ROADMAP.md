# Project Roadmap

## Phase 1: Setup Backend Node.js với Mock Data
- Init Node.js project.
- Install express, cors.
- Tạo API GET `/api/products` trả về dữ liệu phim giả (mock data).

## Phase 2: Khởi tạo Frontend React
- Create React app using Vite.
- Gọi API mock data từ Backend Node.js.
- Hiển thị danh sách cuộn phim lên giao diện Web.

## Phase 3: Thiết kế CSDL PostgreSQL
- Lên Schema cho 3 bảng: `Products`, `Orders`, `Order_Items`.
- Viết lệnh `INSERT` để tạo dữ liệu phim thực tế mẫu trong DB.

## Phase 4: Kết nối Backend với PostgreSQL
- Cài đặt `pg` module.
- Cấu hình chuỗi kết nối DB.
- Cập nhật API lấy dữ liệu sản phẩm từ DB PostgreSQL thay vì dữ liệu mock.

## Phase 5: Chức năng Bán Hàng (POS)
- Frontend: Thiết kế giao diện Giỏ hàng (Cart) và nút Thanh toán.
- Backend: Tạo API POST `/api/checkout` sử dụng DB Transaction (Tạo Order, Tạo Order_Items, Trừ Tồn Kho Products).

## Phase 6: Báo cáo tài chính (Data Analytics)
- Backend: Viết SQL JOIN và SUM để xuất doanh thu/lợi nhuận theo tháng, tạo API `/api/finance/monthly-report`.
- Frontend: Giao diện Báo cáo sử dụng thư viện Chart.js để vẽ biểu đồ tài chính trực quan.
