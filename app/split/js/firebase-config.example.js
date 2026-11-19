// Cấu hình web của dự án Firebase (Firebase Console → Project settings → Your apps → Web app).
// Các giá trị này không phải bí mật: Firebase thiết kế để chúng nằm trong code phía trình duyệt.
// Bảo vệ thật nằm ở: tên miền được phép (Authentication), luật Firestore, giới hạn API key theo tên miền,
// và functions/_middleware.js (chỉ trả dữ liệu cho tài khoản đã xác minh email).
// Để null: trang chạy ở chế độ cục bộ, nạp dữ liệu trực tiếp, không cần đăng nhập (dùng khi phát triển).
const FIREBASE_CONFIG = null;
// Ví dụ:
// const FIREBASE_CONFIG = { apiKey: "...", authDomain: "...", projectId: "...", appId: "..." };
