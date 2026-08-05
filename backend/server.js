// backend/server.js
require('dotenv').config();

const app = require('./app');
const PORT = process.env.PORT || 5001;

// Khởi động server
app.listen(PORT, () => {
  console.log(`🚀 Server Backend đã khởi động thành công tại http://localhost:${PORT}`);
  console.log(`👉 Bạn có thể kiểm tra dữ liệu tại: http://localhost:${PORT}/api/products`);
});
