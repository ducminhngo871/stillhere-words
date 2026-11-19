# StillHere Words

**Words that stay.** Học từ hôm nay, vẫn nhớ tháng sau.

StillHere Words là trang tự học và kiểm tra từ vựng IELTS và SAT, được tạo bởi [Still Here Duc](https://stillhereduc.com) (Ngô Minh Đức), giáo viên IELTS và SAT.

## Tính năng

- **Học từ**: IELTS 500 từ học thuật, SAT 834 từ gốc. Bốn cách học: Flashcard (có phát âm từ và câu ví dụ), Học thích ứng, Nghe chép, Ghép cặp tính giờ.
- **Kiểm tra**: tạo đề ngẫu nhiên theo phạm vi, số câu, độ khó và thời gian.
  - IELTS: 8 dạng bài (từ ↔ nghĩa, định nghĩa, đồng nghĩa, trái nghĩa, điền từ giữ và đổi dạng, đoạn văn), 3 mức độ.
  - SAT: 5 dạng bài, gồm Words in Context có giải thích từng lựa chọn và mã bẫy T1–T8.
  - Kết quả theo từng phần, danh sách từ sai, luyện lại từ sai.
- **Từ đã học**: lịch ôn ngắt quãng 1 → 3 → 7 → 14 → 30 → 60 ngày, ba cách ôn (chọn nghĩa, gõ từ, nghe và gõ).
- **Tiền tố – hậu tố – gốc từ**: bảng phụ tố và họ từ IELTS; 54 gốc Latin/Hy Lạp cho SAT, tách từ, đoán từ loại, tìm từ cùng gốc.
- **Hướng dẫn**: cách học từ, mẹo IELTS, mẹo SAT Words in Context.
- **Song ngữ Việt/Anh**, chế độ sáng/tối, hiển thị tốt từ điện thoại 320px đến màn hình lớn.
- **Tài khoản** bằng email hoặc Google (Firebase), đồng bộ tiến độ học giữa các thiết bị.

## Công nghệ

HTML, CSS và JavaScript thuần, không framework, không bước build. Font Lora và Inter. Tài khoản và đồng bộ dùng Firebase Authentication và Firestore.

## Cấu trúc

| Thư mục | Nội dung |
|---|---|
| `app/split/` | Ứng dụng: `index.html`, `css/`, `js/app.js`, `assets/` |
| `assets/` | Icon, cờ ngôn ngữ, ảnh giới thiệu |
| `tools/` | Script hỗ trợ soạn nội dung, dịch giao diện, tách gốc từ |
| `tests/` | Kiểm thử tự động (jsdom, Playwright) |
