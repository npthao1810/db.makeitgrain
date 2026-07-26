// backend/mockData.js
// Giả lập cấu trúc dữ liệu danh sách cuộn phim.
// Bao gồm mảng `batches` (các lô hàng nhập) để phục vụ cho thuật toán tính lợi nhuận (Margin) bằng FIFO.

const products = [
  {
    id: 1,
    name: "Kodak Portra 400",
    format: "35mm",
    price: 350000, // Giá bán lẻ tới khách hàng
    stock: 15,     // Tổng tồn kho hiện tại (bằng tổng quantity của các batches)
    // Các lô hàng đã nhập của loại phim này (để tính giá vốn FIFO)
    batches: [
      { batch_id: 101, quantity: 5, cost: 280000 },  // Lô cũ nhất: Nhập 5 cuộn, giá 280k
      { batch_id: 102, quantity: 10, cost: 300000 }  // Lô mới hơn: Nhập 10 cuộn, giá đã tăng lên 300k
    ]
  },
  {
    id: 2,
    name: "Fujifilm C200",
    format: "35mm",
    price: 200000,
    stock: 8,
    batches: [
      { batch_id: 201, quantity: 8, cost: 150000 }
    ]
  },
  {
    id: 3,
    name: "Ilford HP5 Plus (Trắng Đen)",
    format: "120",
    price: 220000,
    stock: 5,
    batches: [
      { batch_id: 301, quantity: 5, cost: 180000 }
    ]
  }
];

module.exports = {
  products
};
