# Ôn thi — Trắc nghiệm

Website tĩnh chuyển bộ câu hỏi trắc nghiệm chụp từ giấy thành chữ để luyện trên trình duyệt. Người học có hai chế độ: **Tất cả câu hỏi** và **Câu cần ôn**. Câu trả lời sai được lưu trong trình duyệt; câu chỉ rời hàng đợi khi được trả lời đúng ở lần sau.

## Chạy local

Yêu cầu Node.js 22 trở lên.

```bash
npm ci
npm run dev
```

Mở `http://127.0.0.1:5173/`.

## Kiểm tra

```bash
npm run typecheck
npm run validate:data
npm run test
npm run test:benchmark
npm run build
npm run check:dist
npm run test:e2e
```

E2E dùng Chromium desktop, narrow `320x568`, mobile `390x844` và tablet `768x1024`. Lần đầu cần `npx playwright install chromium`.

## Dữ liệu

- Ảnh nguồn: `images/`.
- Manifest và checksum: `data/image-manifest.json`.
- OCR audit trail: `data/ocr/`.
- OCR working copies (never committed): `.tmp-ocr/preprocessed/` via `npm run preprocess:images`.
- Câu raw chưa đối soát: `data/questions.raw.json`.
- Danh sách câu chờ đối soát: `docs/needs-review.md` (tạo lại bằng `npm run review:report`).
- Câu production đã verified: `src/data/questions.json` (138 câu ở dataset `2026-08-05.5`). `q-007` được đối soát qua đoạn nối trang 4→5; `q-026` vẫn nằm trong `docs/needs-review.md`; tám marker còn lại là ảnh trùng checksum đã loại khỏi hàng đợi.
- Progress key: `tracnghiem:progress:v1` trong `localStorage`.

Khi thêm hoặc sửa câu, chạy pipeline OCR/data validation và cập nhật `datasetVersion` trong `src/data/questions.ts`. Không xóa ID đã phát hành nếu không có migration.

Nút **Xóa tiến độ** ở khu vực phụ chỉ xóa progress trên thiết bị hiện tại sau khi xác nhận; nút **Làm lại lượt này** chỉ tạo session mới và giữ lịch sử mastery.

## Deploy GitHub Pages

Website public: [https://loilarry.github.io/tracnghiem/](https://loilarry.github.io/tracnghiem/). Mã nguồn public: [github.com/loilarry/tracnghiem](https://github.com/loilarry/tracnghiem). Workflow `.github/workflows/pages.yml` sẽ validate data, chạy test, build `dist/` và deploy static artifact từ `main`.

Sau khi đã duyệt tên repository, có thể tạo remote và push bằng GitHub CLI:

```bash
gh repo create <owner>/<repo> --public --source . --remote origin --push
```

Repo hiện đã được tạo ở chế độ public; thư mục `images/` được giữ lại để audit nguồn, nhưng `dist/` không chứa ảnh gốc.

V1 không có backend và không đồng bộ progress giữa thiết bị; mỗi trình duyệt có progress riêng.

## Quy trình agent

Đọc [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) trước khi sửa. Agents phải làm theo thứ tự task, ghi evidence vào Execution log và không đánh dấu Definition of Done nếu chưa có test/output tương ứng.
