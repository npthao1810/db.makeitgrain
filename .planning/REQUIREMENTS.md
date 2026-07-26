# System Requirements

## Functional Requirements
- **Quản lý sản phẩm & Tồn kho**: Liệt kê cuộn phim đang có, giá bán. Quản lý nhập hàng theo **Lô hàng (Batches)** để tính giá vốn chính xác (FIFO - First In First Out).
- **Tính toán Lợi nhuận (Margin)**: Khi bán, hệ thống tự động trừ tồn kho từ lô hàng cũ nhất trước (FIFO). Lợi nhuận = Giá bán - Giá nhập của chính lô hàng bị trừ.
- **Cart & POS**: Giao diện giỏ hàng, chốt đơn dành cho nội bộ cửa hàng (Internal Use Only).
- **Payment Tracking**: Theo dõi hình thức thanh toán (Tiền mặt / Chuyển khoản) và Đích thanh toán (Tài khoản ngân hàng nào nhận tiền).
- **Database**: Cấu trúc dữ liệu (Products, Inventory_Batches, Orders, Order_Items, Payment_Logs).
- **Transactions**: Ghi nhận đơn, trừ kho theo lô, log thanh toán trong 1 transaction an toàn.
- **Reporting**: Báo cáo doanh thu/lợi nhuận theo tháng.

## Non-Functional Requirements
- **Performance**: Frontend tối ưu bằng Vite, tải trang nhanh.
- **UI/UX**: Sử dụng **Tailwind CSS**. Phong cách thiết kế **Vintage nhưng Minimal** (Tối giản, gọn gàng, hoài cổ).

## Out of Scope (Initial Version)
- Trang web E-commerce công khai cho khách hàng.
- Tích hợp cổng thanh toán bên thứ ba (Chỉ tracking thủ công).
- User Authentication phức tạp (Chỉ dùng nội bộ).
