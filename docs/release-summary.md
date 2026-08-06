# Release summary — public GitHub Pages

- Repository: [loilarry/tracnghiem](https://github.com/loilarry/tracnghiem)
- Website: [https://loilarry.github.io/tracnghiem/](https://loilarry.github.io/tracnghiem/)
- Release commit: `2490b06`
- Dataset: `2026-08-05.5`, 138 câu verified
- Review queue: lưu bằng `localStorage`; câu sai xuất hiện ở mục **Câu cần ôn** và biến mất sau khi trả lời đúng
- Source audit: 21 ảnh JPG giữ trong repo; bundle deploy không chứa ảnh nguồn hoặc URL ngoài

## Checks

- GitHub Actions run `31061053646`: success
- Unit: 16/16
- Benchmark: 3/3
- Browser E2E: 64/64 trên Chromium, 320x568, 390x844 và 768x1024
- Public smoke: desktop và mobile tải được, reload không 404, hai chế độ và số câu hiển thị đúng

## Known data boundary

`q-026` chưa đưa vào bài thi vì ảnh nguồn chỉ có tiêu đề ở cuối trang, chưa có nhóm A-D đủ chắc chắn. Xem [docs/needs-review.md](./needs-review.md) và ảnh nguồn được ghi trong đó để bổ sung nếu có bản gốc rõ hơn.
