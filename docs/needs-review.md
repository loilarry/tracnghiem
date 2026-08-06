# Câu hỏi chờ đối soát

Cập nhật tự động từ data/questions.raw.json: 1 câu thuộc ảnh nguồn chính chưa được phát hành vào production. Không dùng danh sách này để thi cho đến khi mở ảnh gốc và xác nhận cả nội dung lẫn đáp án được đánh dấu.

| Ảnh nguồn | Số câu | ID raw |
| --- | ---: | --- |
| `1785934222142_8013660885024387896_8013660885024387896_ae848f778e58028cc796477304320b59.jpg` | 1 | `q-026` |

Lý do giữ lại:
- `q-026`: Ảnh nguồn chỉ còn tiêu đề ở cuối trang; các nhóm A-D ở đầu ảnh khác đã được ghép cho câu khác, không có continuationImage đủ chắc chắn cho q-026. Cần xác nhận bản gốc trước khi phát hành.

Ghi chú: 1 ảnh trùng checksum được bỏ khỏi hàng đợi; câu của ảnh trùng dùng bản ghi đã đối soát ở ảnh gốc canonical.

Quy trình: mở ảnh trong `images/`, sửa câu và options, xác nhận dấu đáp án, rồi thêm bản ghi với `verification.status = "verified"` vào `src/data/questions.json`; cuối cùng chạy `npm run validate:data`.
