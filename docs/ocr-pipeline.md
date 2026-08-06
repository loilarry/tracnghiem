# OCR và đối soát answer key

## Nguyên tắc

Ảnh trong `images/` là nguồn gốc. OCR chỉ tạo văn bản nháp; đáp án được phát hành phải được đối chiếu trực tiếp với ảnh. Không dùng OCR để tự suy đoán đáp án khi dấu chọn không rõ.

## Chạy pipeline

Phần tiền xử lý cần Python 3 và Pillow (`python3 -m pip install pillow` trong môi trường làm việc riêng). Phần OCR Vision cần macOS vì dùng framework `Vision`; đây là pipeline tạo dữ liệu, không phải dependency của website tĩnh.

```bash
npm run build:manifest
npm run preprocess:images
npm run ocr
npm run parse:ocr
npm run validate:data
```

- `data/image-manifest.json`: checksum, kích thước và thứ tự ảnh.
- `data/ocr/*.txt`: văn bản OCR để đọc nhanh.
- `data/ocr/*.json`: dòng OCR kèm bounding box normalized từ Vision.
- `data/questions.raw.json`: câu hỏi parse được, còn `needs-review` và chưa có answer key.
- `src/data/questions.json`: chỉ câu đã đối soát và được phép chạy production.

`npm run preprocess:images` chỉ tạo bản làm việc trong `.tmp-ocr/preprocessed/` (EXIF orientation, grayscale, autocontrast và upscale 2x khi ảnh nhỏ). Khi cần thử ảnh khó, script hỗ trợ crop biên và deskew đồng nhất cho một lượt chạy:

```bash
python3 scripts/preprocess-images.py images .tmp-ocr/preprocessed-sample --crop-margin 12 --deskew-angle 0.6
```

Mặc định `--crop-margin 0 --deskew-angle 0`, nên không có biến đổi hình học ngoài EXIF; điều này giữ an toàn cho các dấu đáp án gần mép. OCR mặc định vẫn chạy trên ảnh gốc để giữ bounding box audit trail; có thể đổi thư mục đầu vào trong lệnh Swift khi cần so sánh chất lượng. Bản tiền xử lý chỉ là bản làm việc, không được dùng để tự gắn đáp án verified.

Đã thử ba mẫu đại diện trong đợt audit: ảnh rõ (trang 16), ảnh có phối cảnh/độ nghiêng nhẹ (trang 5) và ảnh có dấu chồng lên chữ (trang 18). So sánh cho thấy grayscale + autocontrast giữ được dấu chọn; crop/deskew chỉ dùng khi kiểm tra thủ công vì có thể cắt mất dấu ở biên. Những trường hợp OCR sai dấu tiếng Việt hoặc ghép dòng vẫn phải sửa từ ảnh gốc.

## Đối soát một câu

1. Tìm `source.image` và `questionIndexOnPage` trong `questions.raw.json`.
2. Mở ảnh gốc tại `images/<source.image>`.
3. Sửa câu hỏi, phương án, dấu tiếng Việt và thứ tự A-D.
4. Xác định đúng phương án được đánh dấu trên ảnh.
5. Chuyển câu sang `src/data/questions.json`, đặt `verification.status = "verified"` và ghi ngày/nguồn.
6. Chạy `npm run validate:data`.

## Không làm

- Không sửa ảnh gốc để làm OCR đẹp hơn.
- Không để `needs-review` lọt vào `src/data/questions.json`.
- Không tạo lời giải hoặc đáp án mới nếu ảnh không cung cấp căn cứ.
- Không đổi ID đã phát hành; nếu cần thay câu, giữ alias/migration.
