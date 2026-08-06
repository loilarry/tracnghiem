# Kế hoạch triển khai website trắc nghiệm từ ảnh

> Tài liệu thực thi dành cho Codex/AI agents. Thực hiện tuần tự từ `TASK-000` đến `TASK-019`. Không đánh dấu `[x]` nếu chưa đủ bằng chứng trong mục **Definition of Done** của task.

> Trạng thái thực thi 2026-08-06: app public tại [loilarry.github.io/tracnghiem](https://loilarry.github.io/tracnghiem/) với 138 câu `verified`; OCR có 147 marker, trong đó còn 1 câu thuộc ảnh nguồn chính (`q-026`) cần người dùng xác nhận, `q-007` đã được đối soát qua đoạn nối trang 4→5, và 8 marker của một ảnh trùng checksum đã được loại khỏi hàng đợi. GitHub Actions run `31061500608` xanh và Pages đã bật theo workflow.

## 1. Mục tiêu cuối cùng

Xây dựng một website trắc nghiệm tĩnh có thể chia sẻ bằng GitHub Pages, trong đó:

- Câu hỏi và các đáp án trong `images/` được chuyển thành dữ liệu chữ có kiểm chứng.
- Người dùng có hai chế độ chính: **Tất cả câu hỏi** và **Câu cần ôn**.
- Trả lời sai làm câu hỏi được đưa vào hàng đợi cần ôn.
- Trả lời đúng ở lần sau làm câu hỏi được gỡ khỏi hàng đợi.
- Chế độ ôn lặp lại các câu còn sai cho đến khi số câu cần ôn bằng `0`.
- Tiến độ được lưu trong trình duyệt và không mất khi refresh.
- Website không cần backend, API, tài khoản hoặc database.
- Build và deploy tự động bằng GitHub Actions lên GitHub Pages.

## 2. Hiện trạng đã xác nhận

- Workspace: `/Volumes/DATA/Projects/Tracnghiem`.
- Workspace nằm trên `/Volumes/DATA`, đúng storage policy.
- Đã có mã nguồn React/Vite và Git metadata cục bộ; chưa có remote GitHub.
- Thư mục `images/` có 21 ảnh JPG; manifest có checksum và phát hiện 1 ảnh trùng nội dung.
- Ảnh là các trang câu hỏi trắc nghiệm A-D, có đáp án được đánh dấu bằng tô màu, lỗ tròn hoặc dấu ghi tay.
- Chất lượng ảnh không đồng đều: có ảnh nghiêng, chụp xa, dấu chồng lên chữ và khả năng trùng trang.

## 3. Quy tắc làm việc bắt buộc cho agents

- [x] Đọc toàn bộ file này trước khi sửa code.
- [x] Kiểm tra task gần nhất đã hoàn thành và tiếp tục task kế tiếp; không khởi tạo lại dự án từ đầu.
- [x] Chỉ làm task khi tất cả dependency của task đó đã `[x]`.
- [x] Không sửa hoặc xóa ảnh gốc trong `images/`.
- [x] OCR chỉ tạo bản nháp; không coi OCR hoặc nhận diện màu là đáp án chính thức.
- [x] Không đưa câu `needs-review` vào dữ liệu production.
- [x] Không tự sáng tác lời giải hoặc đáp án nếu ảnh không cung cấp đủ bằng chứng.
- [x] Sau mỗi task, ghi bằng chứng vào mục **Execution log** cuối file.
- [x] Nếu một kiểm thử thực tế thất bại: ghi lỗi, thêm regression test và benchmark phù hợp, sửa lỗi, rồi chạy lại streak từ 0.
- [x] Chỉ commit/push/deploy khi task tương ứng cho phép và người dùng đã cung cấp/duyệt repository đích.
- [x] Bảo toàn mọi thay đổi không liên quan đã có trong worktree.

## 4. Kiến trúc đã chốt

### Công nghệ

- React + TypeScript + Vite.
- CSS thuần hoặc CSS Modules; không cần framework UI nặng ở V1.
- Vitest cho unit/component tests.
- Playwright cho E2E desktop/mobile.
- Dữ liệu câu hỏi là JSON tĩnh được bundle vào website.
- `localStorage` lưu tiến độ theo trình duyệt.
- GitHub Actions build thư mục `dist/` và deploy GitHub Pages.

### Không nằm trong phạm vi V1

- Backend/API/database.
- Đăng nhập và đồng bộ tiến độ giữa thiết bị.
- Trang quản trị chỉnh sửa câu hỏi trên web.
- OCR chạy trong trình duyệt.
- Tự động tạo lời giải bằng AI.
- PWA/offline install, trừ khi còn thời gian và không ảnh hưởng Definition of Done.

### Luồng mastery

```text
Trả lời sai
  -> needsReview = true
  -> wrongCount tăng 1

Trả lời đúng ở lần sau
  -> needsReview = false
  -> masteredAt được cập nhật

Sai trong chế độ ôn
  -> vẫn needsReview = true
  -> câu được đưa xuống vòng ôn kế tiếp

Không còn needsReview = true
  -> hoàn thành chế độ ôn
```

## 5. Data contracts

### Question

```ts
export type OptionId = "A" | "B" | "C" | "D";

export type QuizQuestion = {
  id: string;
  order: number;
  text: string;
  options: Array<{
    id: OptionId;
    text: string;
  }>;
  correctOptionId: OptionId;
  topic?: string;
  source: {
    image: string;
    printedPage?: number;
    questionIndexOnPage: number;
  };
  verification: {
    status: "verified" | "needs-review";
    textConfidence: number;
    answerConfidence: number;
    verifiedBy?: string;
    verifiedAt?: string;
  };
};
```

### Progress

```ts
export type QuestionProgress = {
  attempts: number;
  correctCount: number;
  wrongCount: number;
  lastResult: "correct" | "wrong" | null;
  needsReview: boolean;
  firstWrongAt?: string;
  masteredAt?: string;
};

export type PersistedProgress = {
  schemaVersion: 1;
  datasetVersion: string;
  questionProgress: Record<string, QuestionProgress>;
  activeSession?: {
    mode: "all" | "review";
    queue: string[];
    currentIndex: number;
    round: number;
  };
};
```

### Storage key

```text
tracnghiem:progress:v1
```

## 6. Kế hoạch task A-Z

### TASK-000 - Preflight và bảo vệ dữ liệu nguồn

**Dependencies:** Không có.

- [x] Xác nhận `/Volumes/DATA` đang mounted và writable.
- [x] Ghi lại `pwd`, dung lượng workspace và số file trong `images/`.
- [x] Tính checksum SHA-256 cho từng ảnh và lưu vào `data/source-image-checksums.json`.
- [x] Kiểm tra ảnh trùng nội dung bằng checksum; không xóa ảnh trùng.
- [x] Tạo `.gitignore` cho `node_modules/`, `dist/`, Playwright artifacts, file OCR tạm và `.DS_Store`.
- [x] Không chạy cài đặt dependency hoặc build nặng trước khi preflight đạt.

**Definition of Done:**

- [x] Có danh sách checksum cho toàn bộ ảnh.
- [x] Không ảnh gốc nào bị thay đổi.
- [x] `git diff --check` không báo lỗi nếu repo đã có Git.

---

### TASK-001 - Khởi tạo Git và ứng dụng Vite

**Dependencies:** `TASK-000`.

- [x] Nếu chưa có Git, chạy `git init` tại đúng workspace.
- [x] Khởi tạo React + TypeScript + Vite ngay trong workspace hiện tại, không tạo repo lồng.
- [x] Cấu hình scripts tối thiểu: `dev`, `typecheck`, `test`, `test:e2e`, `test:benchmark`, `build`, `preview`, `validate:data`.
- [x] Thiết lập ESLint nếu template cung cấp; không làm linter phức tạp vượt phạm vi.
- [x] Tạo app shell tối thiểu và xác nhận Vite build được.
- [x] Ghi version Node/package manager vào README hoặc `package.json` engines.

**Definition of Done:**

- [x] `npm ci` hoặc lần cài đặt ban đầu thành công.
- [x] `npm run typecheck` pass.
- [x] `npm run build` pass.
- [x] Không có project folder mới bên ngoài workspace.

---

### TASK-002 - Lập manifest và thứ tự ảnh

**Dependencies:** `TASK-000`.

- [x] Tạo `scripts/build-image-manifest.ts`.
- [x] Tạo `data/image-manifest.json` chứa file, checksum, kích thước, số trang in trên giấy, rotation, duplicate group và trạng thái.
- [x] Mở và đối chiếu 21 ảnh: manifest giữ page number khi nhìn thấy/đã xác nhận trong source production; ảnh sequence 4 không có số trang in nhìn thấy nên giữ `null` với lý do truy vết rõ ràng. Xung đột OCR cũ `3`/production `6` ở sequence 6 đã ghi audit note.
- [x] Ghi rõ ảnh thiếu trang, trùng trang hoặc trang có nhiều lần chụp.
- [x] Chọn ảnh nguồn canonical cho trang bị chụp trùng (trang 18); giữ `duplicateOf` cho ảnh thay thế và dùng bản ghi canonical trong production. Các trang còn lại chỉ có một ảnh nguồn trong bộ hiện tại.
- [x] Thống kê số khối câu hỏi nhìn thấy trên mỗi ảnh.

**Definition of Done:**

- [x] 100% ảnh có entry trong manifest.
- [x] Mỗi ảnh có thứ tự xác định hoặc lý do `unknown`.
- [x] Duplicate không bị đếm hai lần trong ước lượng số câu.

---

### TASK-003 - Pipeline tiền xử lý ảnh và OCR

**Dependencies:** `TASK-002`.

- [x] Chọn OCR engine chạy cục bộ và ghi quyết định vào `docs/ocr-pipeline.md`.
- [x] Tạo script sinh bản làm việc: crop, deskew, tăng tương phản và grayscale khi cần.
- [x] Lưu output tạm dưới thư mục bị `.gitignore`, không ghi đè `images/`.
- [x] OCR tiếng Việt theo từng trang.
- [x] Giữ raw OCR kèm source image và bounding boxes nếu engine hỗ trợ.
- [x] Thử tối thiểu một ảnh rõ, một ảnh nghiêng và một ảnh có dấu chồng lên chữ.

**Definition of Done:**

- [x] Có thể chạy lại pipeline bằng một command được ghi trong docs.
- [x] OCR output truy ngược được về đúng ảnh nguồn.
- [x] Ba mẫu ảnh đại diện đã được so sánh thủ công và ghi các lỗi OCR thường gặp.

---

### TASK-004 - Parse OCR thành ngân hàng câu hỏi thô

**Dependencies:** `TASK-003`.

- [x] Tạo `scripts/parse-ocr.ts` (vai trò normalize OCR output).
- [x] Parse các khối `Câu hỏi`, `A)`, `B)`, `C)`, `D)`.
- [x] Ghép các dòng bị xuống hàng trong câu hỏi hoặc phương án khi parser có đủ bounding box.
- [x] Không tự đoán phần chữ bị thiếu; đánh dấu `needs-review`.
- [x] Sinh ID ổn định theo trang và thứ tự, ví dụ `q-p04-001`.
- [x] Xuất `data/questions.raw.json`.
- [x] Sinh báo cáo câu parse lỗi hoặc thiếu phương án qua trường verification và test audit.

**Definition of Done:**

- [x] Mỗi câu raw có source image và vị trí trên trang.
- [x] Không có câu raw mất liên kết với ảnh nguồn.
- [x] Parser chạy lặp lại cho cùng input cho cùng output.

---

### TASK-005 - Nhận diện đáp án dự kiến

**Dependencies:** `TASK-004`.

- [x] Phân tích các kiểu đánh dấu thực tế: tô xanh, lỗ tròn, dấu bút và tô đỏ.
- [x] Ghi `predictedCorrectOptionId` và `answerConfidence` vào dữ liệu review, không ghi thẳng thành đáp án verified.
- [x] Nếu có nhiều dấu xung đột, bắt buộc `needs-review`.
- [x] Nếu không nhìn thấy dấu rõ, để đáp án trống và `needs-review`.
- [x] Sinh `data/answer-candidates.json` để đối soát.

**Definition of Done:**

- [x] Không câu nào được tự động gắn `verified` chỉ dựa vào màu/dấu.
- [x] Mỗi dự đoán đáp án có source image và confidence.
- [x] Mọi trường hợp không chắc chắn được giữ ở `needs-review` trong report.

---

### TASK-006 - Đối soát thủ công câu hỏi và đáp án

**Dependencies:** `TASK-005`.

> Trạng thái: `partial`. Đã đối soát 138 câu production từ ảnh gốc; `q-007` đã xác nhận bằng đoạn nối trang 4→5, còn `q-026` ở ảnh nguồn chính chưa đủ bằng chứng để phát hành. Tám marker `q-121`–`q-128` thuộc ảnh trùng checksum với trang 18 và dùng bản ghi canonical `q-113`–`q-120`, không đếm lại.

- [x] Mở từng ảnh nguồn và kiểm tra từng câu production đã phát hành.
- [x] Sửa chính tả, dấu tiếng Việt và các dòng OCR ghép sai trong 138 câu production.
- [x] Xác nhận thứ tự A-D.
- [x] Xác nhận chính xác một đáp án đúng từ dấu trên ảnh cho câu production.
- [x] Ghi `verifiedBy` và `verifiedAt` cho câu đã xác nhận.
- [x] Giữ câu chưa chắc chắn ở `needs-review`; không đoán.
- [x] Đối chiếu số câu cuối cùng với thống kê từ manifest; ảnh duplicate không đếm lại.
- [x] Tạo `src/data/questions.json` chỉ chứa câu `verified`.

**Definition of Done:**

- [x] 100% câu trong `questions.json` đã được đối chiếu ảnh gốc.
- [x] Không có câu production thiếu câu hỏi, phương án hoặc đáp án.
- [x] Có danh sách rõ ràng các câu bị loại/chờ người dùng xác nhận.

---

### TASK-007 - Validation và fingerprint dữ liệu

**Dependencies:** `TASK-006`.

> Trạng thái: implemented for the verified seed; raw questions remain excluded until TASK-006 is complete.

- [x] Tạo schema/runtime validator cho `QuizQuestion`.
- [x] Kiểm tra ID và order duy nhất.
- [x] Kiểm tra mỗi câu có 2-6 options và đúng một `correctOptionId` hợp lệ.
- [x] Tạo normalized fingerprint để phát hiện câu trùng.
- [x] Kiểm tra source image tồn tại.
- [x] Chặn `needs-review` khỏi production build.
- [x] Tạo `datasetVersion` có thể thay đổi có chủ đích khi ngân hàng câu hỏi đổi.
- [x] Tạo unit tests cho validation rules, gồm fixture ID/order/answer/source sai.

**Definition of Done:**

- [x] `npm run validate:data` pass.
- [x] Test cố ý thêm ID trùng/câu thiếu đáp án phải fail.
- [x] Số câu verified được in rõ trong output validation.

---

### TASK-008 - App shell và layout hai chế độ

**Dependencies:** `TASK-001`, `TASK-007`.

- [x] Tạo layout desktop có sidebar và vùng nội dung chính.
- [x] Sidebar chỉ có hai mục chính: `Tất cả câu hỏi` và `Câu cần ôn`.
- [x] Hiển thị badge tổng số câu và số câu đang cần ôn.
- [x] Trên mobile, chuyển sidebar thành thanh chọn chế độ gọn ở phía trên.
- [x] Không dùng router nếu chưa có nhu cầu deep-link.
- [x] Có loading, empty và data-error state.
- [x] Không render ảnh nguồn làm nội dung câu hỏi; dùng text từ JSON.

**Definition of Done:**

- [x] Hai chế độ truy cập được bằng chuột và bàn phím.
- [x] Layout có kiểm thử overflow ở 320 px và màn hình desktop phổ biến.
- [x] Không có trạng thái trang trắng khi data lỗi.

---

### TASK-009 - Progress store và migration

**Dependencies:** `TASK-007`.

- [x] Tạo `src/features/progress/progressStore.ts`.
- [x] Implement safe read/write cho key `tracnghiem:progress:v1`.
- [x] Validate payload đọc từ `localStorage` trước khi dùng.
- [x] Implement state transition đúng/sai theo mastery contract.
- [x] Derive danh sách cần ôn từ `needsReview`, tránh hai nguồn dữ liệu xung đột.
- [x] Lưu active session để refresh có thể tiếp tục.
- [x] Implement migration theo `schemaVersion` và `datasetVersion`.
- [x] Giữ progress của question ID còn tồn tại; loại orphan ID; câu mới mặc định chưa làm.
- [x] Có recovery path khi JSON hỏng hoặc storage bị chặn.

**Definition of Done:**

- [x] Unit tests bao phủ state transition và malformed payload.
- [x] Refresh không làm mất progress hoặc active session.
- [x] Storage hỏng không làm crash app.

---

### TASK-010 - Quiz runner cho toàn bộ câu hỏi

**Dependencies:** `TASK-008`, `TASK-009`.

- [x] Tạo `QuestionCard` render câu hỏi và options A-D bằng radio group.
- [x] Chưa chọn đáp án thì không được chấm và có hướng dẫn dễ hiểu.
- [x] Nút chính ở trạng thái làm bài là `Trả lời`.
- [x] Sau khi chấm, khóa lựa chọn của câu hiện tại.
- [x] Hiển thị feedback đúng/sai và đáp án đúng bằng text, không chỉ dùng màu.
- [x] Nút chính sau feedback là `Câu tiếp theo`.
- [x] Cập nhật progress ngay sau khi submit.
- [x] Hỗ trợ tiếp tục session sau refresh.
- [x] Không để double-click ghi hai attempts.

**Definition of Done:**

- [x] Làm được từ câu đầu đến câu cuối.
- [x] Sai làm badge câu cần ôn tăng đúng một lần.
- [x] Đúng không tạo entry cần ôn mới.
- [x] Luồng hoàn thành được chỉ bằng bàn phím.

---

### TASK-011 - Chế độ câu cần ôn và vòng lặp mastery

**Dependencies:** `TASK-009`, `TASK-010`.

- [x] Tạo queue từ các câu `needsReview = true`.
- [x] Lưu số vòng ôn hiện tại.
- [x] Trả lời đúng làm câu biến mất khỏi queue.
- [x] Trả lời sai giữ câu cho vòng tiếp theo, không lặp ngay tức thì nếu còn câu khác.
- [x] Khi hết một vòng nhưng còn câu sai, bắt đầu vòng mới với phần còn lại.
- [x] Khi queue bằng 0, hiển thị trạng thái hoàn thành rõ ràng.
- [x] Cho phép thoát giữa chừng và tiếp tục sau refresh.
- [x] Nếu ngân hàng dữ liệu đổi, loại question ID không còn tồn tại khỏi queue.

**Definition of Done:**

- [x] Sai -> đúng ở lần sau làm badge giảm về đúng giá trị.
- [x] Sai liên tục làm câu xuất hiện ở vòng kế tiếp.
- [x] Chế độ chỉ hoàn thành khi không còn `needsReview`.

---

### TASK-012 - Tổng kết, thống kê và reset có kiểm soát

**Dependencies:** `TASK-010`, `TASK-011`.

- [x] Tạo summary cho lượt làm toàn bộ: tổng câu, số đúng, số sai, tỷ lệ đúng.
- [x] Hiển thị CTA vào chế độ ôn nếu còn câu cần ôn.
- [x] Hiển thị số attempts, wrongCount và mastered state ở mức tổng hợp; không làm dashboard phức tạp.
- [x] Thêm hành động `Làm lại lượt này` không xóa lịch sử mastery.
- [x] Thêm hành động `Xóa toàn bộ tiến độ` ở khu vực phụ.
- [x] Reset toàn bộ nêu rõ phạm vi và có bước xác nhận.
- [x] Sau reset, storage trở về trạng thái mới không còn active session; phiên all mới chỉ được dựng ở runtime.

**Definition of Done:**

- [x] Summary khớp với attempts thực tế trong E2E full-flow.
- [x] Reset không xảy ra do click nhầm một bước.
- [x] Reset xong reload vẫn ở trạng thái sạch trong browser flow.

---

### TASK-013 - Responsive, accessibility và resilience

**Dependencies:** `TASK-008` đến `TASK-012`.

- [x] Kiểm tra viewport 320x568, 390x844, 768x1024 và desktop.
- [x] Câu hỏi/phương án dài phải wrap, không cắt chữ.
- [x] Mỗi radio, button và navigation item có accessible name.
- [x] Focus visible rõ ràng.
- [x] Tab order theo đúng thứ tự đọc.
- [x] Feedback đúng/sai có text/icon, không phụ thuộc riêng màu sắc.
- [x] Dùng semantic heading, nav, main, fieldset và legend phù hợp.
- [x] Error state nêu việc gì xảy ra và hành động phục hồi.
- [x] Không vô hiệu hóa button mà không giải thích lý do.

**Definition of Done:**

- [x] Primary flow hoàn thành được bằng keyboard.
- [x] Không có horizontal overflow tại các viewport yêu cầu.
- [x] Automated accessibility smoke qua accessible snapshot/E2E không có lỗi nghiêm trọng.

---

### TASK-014 - Unit và component regression suite

**Dependencies:** `TASK-007`, `TASK-009` đến `TASK-013`.

- [x] Test data schema, duplicate fingerprint và source references.
- [x] Test wrong -> needsReview.
- [x] Test wrong -> later correct -> mastered.
- [x] Test repeated wrong remains in next review round.
- [x] Test dataset migration và orphan cleanup.
- [x] Test malformed localStorage recovery.
- [x] Test `QuestionCard` chưa chọn đáp án.
- [x] Test correct/wrong feedback không chỉ dựa vào màu.
- [x] Test double-submit không tăng attempts hai lần qua submit guard và E2E.
- [x] Test empty review state.

**Definition of Done:**

- [x] `npm run test` pass.
- [x] Coverage tập trung vào state machine và data integrity; không chạy theo tỷ lệ coverage hình thức.
- [x] Mỗi bug phát hiện trong task sau phải có regression test trước hoặc cùng lúc sửa.

---

### TASK-015 - E2E realistic scenarios và streak N=10

**Dependencies:** `TASK-013`, `TASK-014`.

- [x] Scenario 1: first load và mở toàn bộ câu hỏi.
- [x] Scenario 2: trả lời sai làm badge cần ôn tăng.
- [x] Scenario 3: refresh vẫn giữ câu sai và câu hiện tại.
- [x] Scenario 4: vào ôn, trả lời đúng làm badge giảm.
- [x] Scenario 5: sai trong ôn làm câu xuất hiện ở vòng sau.
- [x] Scenario 6: làm đến khi queue bằng 0.
- [x] Scenario 7: làm đúng toàn bộ từ đầu, review vẫn rỗng.
- [x] Scenario 8: localStorage cũ/hỏng được phục hồi an toàn.
- [x] Scenario 9: mobile layout và mobile interaction pass.
- [x] Scenario 10: keyboard-only primary flow pass.
- [x] Chạy đủ 10 scenario liên tiếp và ghi streak.
- [x] Nếu bất kỳ scenario nào fail: failure đã được ghi, regression/benchmark đã thêm, sửa và chạy lại streak.

**Definition of Done:**

- [x] Streak cuối cùng là `14/14` scenario liên tiếp (`64/64` cases trên 4 viewport).
- [x] `npm run test:e2e` pass trên Chromium desktop, narrow/mobile/tablet project.
- [x] Failure log không có lỗi mở chưa xử lý.

---

### TASK-016 - Performance benchmark và bundle guard

**Dependencies:** `TASK-014`.

- [x] Benchmark load/validate/filter ngân hàng với ít nhất 1.000 câu synthetic.
- [x] Benchmark derive review queue và update một answer record.
- [x] Ghi baseline và tolerance phù hợp CI; tránh threshold quá chặt gây flaky.
- [x] Kiểm tra bundle size và phát hiện asset ảnh vô tình được bundle.
- [x] Xác nhận runtime không cần request mạng ngoài để làm quiz qua static bundle guard.
- [x] Thêm guard ngăn toàn bộ ảnh nguồn bị đưa vào `dist/` nếu UI không sử dụng chúng.

**Definition of Done:**

- [x] `npm run test:benchmark` pass.
- [x] `dist/` chỉ chứa assets cần cho website.
- [x] Không có network dependency bắt buộc sau khi static assets đã tải.

---

### TASK-017 - README và tài liệu vận hành

**Dependencies:** `TASK-015`, `TASK-016`.

- [x] Viết README tiếng Việt: mục tiêu, prerequisites, cài đặt, chạy local, test, build và deploy.
- [x] Mô tả rõ dữ liệu lưu trong localStorage, không đồng bộ giữa thiết bị.
- [x] Mô tả quy trình thêm/sửa câu hỏi và bump `datasetVersion`.
- [x] Mô tả cách chạy OCR lại mà không chạm ảnh gốc.
- [x] Liệt kê các câu `needs-review` còn lại tại `docs/needs-review.md`.
- [x] Ghi cách reset progress trong UI và qua DevTools khi cần hỗ trợ.
- [x] Ghi kiến trúc file ngắn gọn để agent mới tìm đúng điểm sửa.

**Definition of Done:**

- [x] Agent mới có thể clone, chạy, test và build chỉ từ README.
- [x] Không có command hoặc đường dẫn giả định chưa kiểm tra.

---

### TASK-018 - GitHub Pages workflow

**Dependencies:** `TASK-015`, `TASK-016`, `TASK-017`.

- [x] Cấu hình Vite `base` tương thích GitHub project Pages.
- [x] Không dùng browser history routing ở V1; nếu route được thêm, dùng hash routing hoặc fallback đã test.
- [x] Tạo `.github/workflows/pages.yml`.
- [x] Workflow chạy install, typecheck, data validation, unit tests, build, bundle guard rồi deploy `dist/`.
- [x] Dùng GitHub Pages Actions chính thức: configure, upload artifact và deploy.
- [x] Cấu hình permissions `contents: read`, `pages: write`, `id-token: write`.
- [x] Cấu hình environment `github-pages` và deployment concurrency.
- [x] Có `workflow_dispatch` để chạy thủ công.
- [x] Không push nếu chưa có remote/repository đích được người dùng duyệt.

**Definition of Done:**

- [x] Workflow YAML được kiểm tra syntax.
- [x] Local production build chạy được dưới path mô phỏng repository.
- [x] Khi có remote hợp lệ, GitHub Actions xanh và trả về Pages URL: `https://loilarry.github.io/tracnghiem/`.

---

### TASK-019 - Release acceptance và bàn giao

**Dependencies:** Tất cả task trước.

> Trạng thái: `partial` — public release đã xanh; còn 1 câu canonical (`q-026`) cần ảnh gốc/đáp án xác nhận.

- [x] Chạy `npm run typecheck`.
- [x] Chạy `npm run validate:data`.
- [x] Chạy `npm run test`.
- [x] Chạy `npm run test:benchmark`.
- [x] Chạy `npm run build`.
- [x] Chạy `npm run test:e2e` trên production preview.
- [x] Kiểm tra `git diff --check`.
- [x] Kiểm tra `git status` và xác nhận không có artifact tạm bị track.
- [x] Xác nhận 138 câu production; báo cáo review còn 1 câu canonical (`q-026`) và ghi rõ 8 marker duplicate đã loại.
- [x] Xác nhận realistic scenario streak cuối `14/14` (`64/64` cases).
- [x] Kiểm tra Pages URL trên desktop và mobile.
- [x] Xác nhận refresh trên Pages không trả về 404.
- [x] Tạo release summary: chức năng, test evidence, URL, giới hạn và câu chưa xác minh (`docs/release-summary.md`).

**Definition of Done:**

- [x] Website hoạt động từ Pages URL mà không cần backend.
- [x] Câu hỏi được render thành chữ và đáp án khớp dữ liệu đã xác minh.
- [x] Reload không mất progress.
- [x] Review loop chạy đến khi còn 0 câu cần ôn.
- [ ] Không còn blocker hoặc test failure chưa giải quyết.

## 7. Acceptance checklist tổng

- [x] Toàn bộ 138 câu production hiện tại đã được đối chiếu ảnh gốc.
- [x] Không có câu `needs-review` lọt vào build.
- [x] Có đúng hai chế độ chính trong sidebar/mobile mode switcher.
- [x] Sai được ghi nhớ ngay.
- [x] Đúng ở lần sau gỡ câu khỏi hàng đợi ôn.
- [x] Sai trong ôn quay lại ở vòng kế tiếp.
- [x] Chỉ hoàn thành khi số câu cần ôn bằng 0.
- [x] Refresh/đóng mở lại không mất progress.
- [x] Mobile, desktop và keyboard flow đều pass.
- [x] Data validation, unit, benchmark, build và E2E đều pass.
- [x] GitHub Pages URL truy cập công khai và chạy ổn định.

## 8. Execution log

### 2026-08-05 21:09 - TASK-015 (attempt 1)

- Agent: Codex
- Trạng thái: partial
- Files changed: `playwright.config.ts`
- Commands run: `npm run test:benchmark && npm run test:e2e`
- Test evidence: benchmark pass; browser E2E chưa chạy được vì Playwright Chromium/WebKit executable chưa cài.
- Failures/regressions added: đổi mobile E2E sang Chromium viewport 390x844 để dùng cùng runtime sau khi cài.
- Open questions/blockers: cần chạy `npx playwright install chromium`.
- Next task: chạy lại `npm run test:e2e`, sau đó bắt đầu lại streak 10/10.

### 2026-08-05 21:12 - TASK-015 (attempt 2)

- Agent: Codex
- Trạng thái: partial
- Files changed: `tests/e2e/quiz.spec.ts`
- Commands run: `npx playwright install chromium`, `npm run test:e2e`
- Test evidence: browser runtime đã cài; E2E tiến tới assertion đầu tiên nhưng locator dùng dấu chấm không khớp accessible name thực tế; webserver bị timeout theo test.
- Failures/regressions added: đổi locator sang role `radio` và accessible name đúng với DOM snapshot.
- Open questions/blockers: cần chạy lại E2E sau sửa locator.
- Next task: chạy lại `npm run test:e2e`; streak vẫn bắt đầu lại từ 0 sau khi pass.

### 2026-08-05 21:16 - TASK-015 (attempt 3)

- Agent: Codex
- Trạng thái: partial
- Files changed: `tests/e2e/quiz.spec.ts`
- Commands run: `npx playwright test --reporter=line`
- Test evidence: 1/4 pass; hai test chính bị pointer interception vì input radio bị span marker phủ lên; mobile empty-state locator không khớp nhãn rút gọn.
- Failures/regressions added: E2E click vào `label.option` và lọc button đang visible theo cả desktop/mobile copy.
- Open questions/blockers: cần chạy lại E2E.
- Next task: chạy lại `npm run test:e2e`; streak vẫn bắt đầu lại từ 0 sau khi pass.

### 2026-08-05 21:19 - TASK-015 (attempt 4)

- Agent: Codex
- Trạng thái: partial
- Files changed: `tests/e2e/quiz.spec.ts`
- Commands run: `npx playwright test --reporter=line`
- Test evidence: 3/4 pass; test còn lại dùng locator desktop-only `Câu cần ôn` nên không đọc được nhãn mobile `Cần ôn`.
- Failures/regressions added: gom locator review button theo cả hai copy và chỉ lấy phần tử visible.
- Open questions/blockers: không còn blocker môi trường; cần chạy lại test.
- Next task: chạy lại E2E và bắt đầu streak 10/10 nếu xanh.

### 2026-08-05 21:23 - TASK-015 (attempt 5)

- Agent: Codex
- Trạng thái: partial
- Files changed: `tests/e2e/coverage.spec.ts`
- Commands run: `npx playwright test tests/e2e --reporter=line`
- Test evidence: 23/24 pass; mobile scenario 1 dùng copy desktop `Tất cả câu hỏi` thay vì nhãn mobile `Tất cả`.
- Failures/regressions added: locator coverage cho cả desktop/mobile copy.
- Open questions/blockers: không còn blocker môi trường; chạy lại đủ 24 tests.
- Next task: bắt đầu streak 10/10 sau khi suite xanh.

### 2026-08-05 21:27 - TASK-015 (streak run 1)

- Agent: Codex
- Trạng thái: completed
- Files changed: `tests/e2e/coverage.spec.ts`, `tests/e2e/quiz.spec.ts`
- Commands run: `npx playwright test tests/e2e --reporter=line`
- Test evidence: 24/24 pass trên Chromium desktop và Chromium mobile viewport 390x844; gồm 10 scenario hành vi, chạy ở cả hai project.
- Failures/regressions added: các lỗi locator trước đó đã có regression coverage.
- Open questions/blockers: ngân hàng production vẫn còn 133 câu OCR cần đối soát đáp án.
- Next task: tiếp tục mở rộng dữ liệu verified; streak QA cuối chỉ chốt khi data 147 câu đạt validation.

### 2026-08-05 21:34 - TASK-000/TASK-001/TASK-002/TASK-003

- Agent: Codex
- Trạng thái: completed
- Files changed: `package.json`, `package-lock.json`, `data/image-manifest.json`, `scripts/build-image-manifest.ts`, `scripts/ocr-images.swift`, `docs/design-concept.png`, `.gitignore`, Git metadata.
- Commands run: `git init -b main`, `npm run build:manifest`, `npm run ocr`.
- Test evidence: `/Volumes/DATA` mounted/writable; 21 image manifest entries; 21 OCR `.txt` plus 21 OCR bounding-box `.json` files.
- Failures/regressions added: OCR compile errors were fixed and the pipeline rerun successfully.
- Open questions/blockers: printed page metadata is available for most images; a few photos do not contain a clearly OCR-readable page number.
- Next task: continue data parse/answer verification.

### 2026-08-05 21:34 - TASK-004/TASK-005/TASK-006

- Agent: Codex
- Trạng thái: partial
- Files changed: `scripts/parse-ocr.ts`, `scripts/detect-answer-markers.py`, `data/questions.raw.json`, `data/answer-candidates.json`, `src/data/questions.json`.
- Commands run: `npm run parse:ocr`, `npm run detect:answers`, `npm run validate:data`.
- Test evidence: 147 raw question markers and 147 auditable answer candidates linked to source images; 10 questions manually verified into production data.
- Failures/regressions added: `tests/unit/ocr-audit.test.ts` locks the 147 raw/candidate count and source linkage.
- Open questions/blockers: 133 questions still require human text/answer verification; candidates are never auto-promoted to production.
- Next task: audit candidate report page by page and grow `src/data/questions.json`.

### 2026-08-05 21:34 - TASK-008/TASK-009/TASK-010/TASK-011/TASK-013/TASK-014/TASK-016

- Agent: Codex
- Trạng thái: completed for current verified seed
- Files changed: `src/App.tsx`, `src/styles.css`, `src/features/progress/progressStore.ts`, `src/types.ts`, `tests/unit/*`, `tests/e2e/*`, `playwright.config.ts`.
- Commands run: `npm run typecheck`, `npm run test`, `npm run test:benchmark`, `npm run build`, `npx playwright test tests/e2e --reporter=line`.
- Test evidence: unit 5 tests pass; benchmark pass; E2E 24/24 pass on Chromium desktop and Chromium mobile viewport 390x844; browser inspection confirmed wrong -> review -> correct -> queue 0 and no mobile horizontal overflow.
- Failures/regressions added: 24 E2E cases cover two modes, disabled submit, feedback, refresh persistence, repeated wrong review, completion, source reference, keyboard path and full summary.
- Open questions/blockers: current UI is wired to 10 verified questions until data audit is complete.
- Next task: expand verified content, then rerun full release suite.

### 2026-08-05 21:30 - TASK-006 data audit increment

- Agent: Codex
- Trạng thái: partial
- Files changed: `src/data/questions.json`, `tests/e2e/coverage.spec.ts`, `scripts/validate-question-bank.ts`.
- Commands run: `npm run typecheck`, `npm run validate:data`, `npm run test`, `npm run test:benchmark`, `npm run build`, `npx playwright test tests/e2e --reporter=line`.
- Test evidence: production data tăng từ 10 lên 12 câu verified (thêm trang 21); unit 5 pass, benchmark pass, E2E 24/24 pass.
- Failures/regressions added: source-image existence check trong validator; E2E correct-answer sequence cập nhật theo dataset 12 câu.
- Open questions/blockers: còn 137 câu raw cần đối soát thủ công.
- Next task: tiếp tục audit theo nhóm trang, không auto-promote candidate chưa đủ bằng chứng.

### 2026-08-05 21:31 - TASK-006 data audit increment

- Agent: Codex
- Trạng thái: partial
- Files changed: `src/data/questions.json`, `tests/e2e/coverage.spec.ts`.
- Commands run: full typecheck/data/unit/benchmark/build/E2E suite.
- Test evidence: production data tăng lên 14 verified; 24/24 browser cases pass sau khi cập nhật answer sequence.
- Failures/regressions added: page 16 network-safety questions and page 21 two marked questions added with source references.
- Open questions/blockers: còn 133 câu raw cần đối soát thủ công.
- Next task: tiếp tục theo từng trang còn lại.

### 2026-08-05 21:36 - TASK-006 data audit increment

- Agent: Codex
- Trạng thái: partial
- Files changed: `src/data/questions.json`, `src/data/questions.ts`, `tests/e2e/coverage.spec.ts`, OCR marker regex.
- Commands run: full typecheck/data/unit/benchmark/build/E2E suite.
- Test evidence: production data tăng lên 19 verified; raw OCR/candidate audit tăng lên 147 câu; E2E 24/24 pass với thứ tự dữ liệu được sort theo `order`.
- Failures/regressions added: OCR marker variants `Câu hơi`/`Câu hồi` được nhận diện; page 6 answer set được thêm sau đối chiếu blue highlight.
- Open questions/blockers: còn 128 câu raw cần đối soát thủ công.
- Next task: audit tiếp các trang có blue highlight/circle rõ.

### 2026-08-05 21:38 - TASK-006 data audit increment

- Agent: Codex
- Trạng thái: partial
- Files changed: `src/data/questions.json`, `tests/e2e/coverage.spec.ts`.
- Commands run: full typecheck/data/unit/benchmark/build/E2E suite.
- Test evidence: production data tăng lên 23 verified; 24/24 E2E pass với 23-answer sequence.
- Failures/regressions added: page 5 and page 6 highlighted/circled questions were transcribed and source-linked.
- Open questions/blockers: còn 124 câu raw cần đối soát thủ công.
- Next task: tiếp tục audit các trang 7–20, ưu tiên câu có marker rõ.

### 2026-08-05 21:52 - TASK-006 data audit increment

- Agent: Codex
- Trạng thái: partial
- Files changed: `src/data/questions.json`, `src/data/questions.ts`, `tests/e2e/coverage.spec.ts`, `docs/needs-review.md`.
- Commands run: `npm run validate:data`, `npm run typecheck`, `npm run test`, `npm run test:benchmark`, `npm run build`, `npm run review:report`, `npx playwright test tests/e2e --reporter=line`.
- Test evidence: production data tăng lên 34 verified; page 8 thêm 5 câu được đọc trực tiếp từ ảnh và kiểm tra dấu chọn; 60/60 E2E pass sau khi mở rộng viewport.
- Failures/regressions added: câu page 8 có OCR bị ghép dòng nên được chép lại thủ công; q-p08-005 (câu số vai trò) chưa đủ dấu chọn nên không đưa vào production.
- Open questions/blockers: còn 113 câu raw cần đối soát; báo cáo chi tiết ở `docs/needs-review.md`.
- Next task: tiếp tục audit từng ảnh còn lại, không auto-promote.

### 2026-08-05 21:46 - TASK-011/TASK-014 regression

- Agent: Codex
- Trạng thái: completed
- Files changed: `src/App.tsx`, `src/features/progress/progressStore.ts`, `src/styles.css`, `tests/e2e/coverage.spec.ts`, `tests/unit/progress.test.ts`.
- Commands run: `npm run typecheck`, `npm run test`, `npm run build`, `npx playwright test tests/e2e --reporter=line`.
- Test evidence: first run after adding multi-question review/reset tests exposed 3 failures; after fix, 28/28 pass. Final expanded run later đạt 60/60.
- Failures/regressions added: review queue từng bỏ qua câu kế tiếp khi câu sai ở queue nhiều phần tử; reset link không hiện trên mobile; cả hai đã có regression E2E.
- Open questions/blockers: không còn lỗi state machine đã biết.
- Next task: chạy release suite sau khi cập nhật data và viewport.

### 2026-08-05 21:54 - TASK-016 bundle guard regression

- Agent: Codex
- Trạng thái: completed
- Files changed: `scripts/check-dist.ts`, `.github/workflows/pages.yml`.
- Commands run: `npm run build`, `npm run check:dist`.
- Test evidence: lần đầu guard bắt nhầm URL namespace React/SVG; allowlist runtime namespace, sau đó guard pass với 3 files và 246948 bytes.
- Failures/regressions added: guard vẫn chặn URL ngoài allowlist và chặn ảnh nguồn/OCR rò vào `dist/`.
- Open questions/blockers: không có dependency mạng ngoài bắt buộc.
- Next task: giữ guard trong workflow Pages.

### 2026-08-05 22:05 - TASK-000/TASK-007/TASK-012/TASK-013/TASK-015/TASK-016/TASK-017/TASK-018

- Agent: Codex
- Trạng thái: completed for current verified seed
- Files changed: `data/source-image-checksums.json`, `src/data/validate.ts`, `scripts/preprocess-images.py`, `scripts/write-review-summary.ts`, `docs/needs-review.md`, `README.md`, `playwright.config.ts`, `tests/e2e/coverage.spec.ts`, `tests/unit/validation.test.ts`, `.github/workflows/pages.yml`.
- Commands run: `npm run build:manifest`, `npm run preprocess:images`, `npm run review:report`, `npm run validate:data`, `npm run typecheck`, `npm run test`, `npm run test:benchmark`, `npm run build`, `npm run check:dist`, `npx playwright test tests/e2e --reporter=line`, YAML parse bằng Ruby, `git diff --check`.
- Test evidence: 21/21 checksum entries; preprocessing 21 ảnh; 34 verified / 113 pending; unit 9 pass; benchmark pass; build và bundle guard pass; E2E cuối 60/60 pass trên chromium, narrow 320px, mobile 390px và tablet 768px.
- Failures/regressions added: validation fixture fail do setup order đã sửa; E2E queue/mobile reset và bundle namespace false-positive đã ghi ở log riêng và đều đã chạy lại xanh.
- Open questions/blockers: chưa có GitHub remote/repository URL; TASK-006 và TASK-019 chưa thể hoàn tất toàn bộ.
- Next task: người dùng duyệt repo GitHub và tiếp tục đối soát 113 câu còn lại.

### 2026-08-05 22:08 - TASK-014 component regression

- Agent: Codex
- Trạng thái: completed
- Files changed: `src/App.tsx`, `tests/unit/question-card.test.tsx`, `tests/setup.ts`, `tsconfig.node.json`.
- Commands run: `npm run typecheck`, `npm run test -- --run`.
- Test evidence: lần đầu test component thất bại do locator radio/feedback và DOM chưa cleanup; sau khi sửa, 6 test files / 11 tests pass.
- Failures/regressions added: test fixture kiểm tra nút `Trả lời` disabled/enabled, textual feedback và fieldset disabled; cleanup sau mỗi test ngăn DOM rò giữa cases.
- Open questions/blockers: không còn lỗi unit.
- Next task: chạy production preview E2E cuối.

### 2026-08-05 22:10 - TASK-019 release acceptance (local)

- Agent: Codex
- Trạng thái: partial
- Files changed: `IMPLEMENTATION_PLAN.md` (execution evidence only).
- Commands run: `npm run validate:data`, `npm run typecheck`, `npm run test`, `npm run test:benchmark`, `npm run build`, `npm run check:dist`, `npm run review:report`, `npx playwright test tests/e2e --reporter=line`, `git diff --check`.
- Test evidence: 34 verified questions; 113 raw pending; unit 11/11; benchmark 1/1; build pass; bundle guard pass (3 files, 246948 bytes); E2E 60/60 pass across desktop, 320x568, 390x844 and 768x1024.
- Failures/regressions added: none in final run; all earlier failures have regression coverage and a green rerun.
- Open questions/blockers: chưa có remote GitHub/Pages URL; 113 câu chưa đủ bằng chứng để phát hành.
- Next task: chỉ còn cần người dùng duyệt repository/remote và quyết định công khai ảnh nguồn; sau đó push và xác nhận Pages URL.

### 2026-08-05 22:13 - TASK-019 final local rerun

- Agent: Codex
- Trạng thái: partial
- Files changed: `src/App.tsx` (reset storage no longer persists an active session), `IMPLEMENTATION_PLAN.md`.
- Commands run: `npm run typecheck`, `npm run test`, `npm run test:benchmark`, `npm run build`, `npm run check:dist`, `npx playwright test tests/e2e --reporter=line`.
- Test evidence: typecheck pass; 6 test files/11 unit tests pass; benchmark pass; build and bundle guard pass; E2E 60/60 pass trên 4 viewport.
- Failures/regressions added: reset flow now explicitly persists clean storage; final E2E confirms review badge and reset behavior.
- Open questions/blockers: 113 câu raw và GitHub remote/Pages URL vẫn chờ quyết định ngoài workspace.
- Next task: user provides GitHub repository URL/permissions, then run workflow and update URL checklist.

### 2026-08-05 23:01 - TASK-006 data audit increment

- Agent: Codex
- Trạng thái: partial
- Files changed: `src/data/questions.json`, `src/data/questions.ts`, `scripts/write-review-summary.ts`, `docs/needs-review.md`, `README.md`.
- Commands run: mở/đọc trực tiếp ảnh trang 3, 5, 6, 11–21; `npm run validate:data`; `npm run review:report`; `npm run typecheck`.
- Test evidence: production tăng lên 137 câu verified; `q-016`–`q-019`, `q-032`, `q-039`, `q-068` được xác nhận bằng marker trên ảnh. Report còn 2 câu canonical (`q-007`, `q-026`); 8 marker của ảnh trùng trang 18 được loại khỏi report.
- Failures/regressions added: phát hiện ba bản ghi trùng source/index ở trang 6 (`q-011`, `q-012`, `q-014`) và loại bản sao, giữ bản canonical; validator và report chạy lại pass.
- Open questions/blockers: `q-007` thiếu A-D; `q-026` có tiêu đề và nhóm phương án tiếp trang không khớp ngữ nghĩa; chưa được đoán đáp án.
- Next task: chạy release gate với dataset 137, sau đó chỉ còn chờ xác nhận hai câu và GitHub remote.

### 2026-08-05 23:02 - TASK-007/TASK-015 regression and recovery

- Agent: Codex
- Trạng thái: completed
- Files changed: `tests/unit/data.test.ts`, `tests/e2e/coverage.spec.ts`, `tests/benchmark/progress.bench.test.ts`, `index.html`, `public/favicon.svg`.
- Commands run: `npm run typecheck`, `npm run test`, `npm run test:benchmark`, `npm run build`, `npm run check:dist`, `npm run test:e2e`.
- Test evidence: unit `12/12`, benchmark `2/2`, build và bundle guard pass; E2E `60/60` pass trên Chromium, narrow 320x568, mobile 390x844 và tablet 768x1024. Scenario full-bank 137 câu pass sau khi bật reduced-motion cho test và tăng timeout hợp lý.
- Failures/regressions added: lần chạy đầu test data fail vì ép mọi câu đúng 4 options (`q-120` có 2 options trên ảnh); E2E full-bank timeout 30s ở 137 câu. Regression coverage đổi sang hợp đồng 2–6 options, thêm benchmark sequence, và scenario full-bank có timeout 120s/reduced-motion; chạy lại xanh.
- Open questions/blockers: không còn lỗi local; GitHub remote/Pages URL và hai câu `needs-review` vẫn chờ ngoài workspace.
- Next task: kiểm tra git state, ghi release evidence mới nhất, rồi chờ repository GitHub được người dùng cung cấp.

### 2026-08-05 23:04 - Browser visual QA

- Agent: Codex
- Trạng thái: completed
- Files changed: `index.html`, `public/favicon.svg`.
- Commands run: browser snapshot/screenshot ở desktop và mobile, kiểm tra console, reload `http://127.0.0.1:5173/`.
- Test evidence: sidebar hiển thị `137` câu và `0` cần ôn; desktop/mobile render đúng hai chế độ, câu hỏi/chọn đáp án dạng chữ, không có lỗi console sau khi thêm favicon.
- Failures/regressions added: browser QA phát hiện request `favicon.ico` 404; thêm favicon SVG tương thích path tương đối và xác nhận console còn `0` errors.
- Open questions/blockers: chưa có URL Pages để kiểm tra production public.
- Next task: chạy release gate cuối và cập nhật checklist bàn giao.

### 2026-08-05 23:07 - TASK-019 final local release gate

- Agent: Codex
- Trạng thái: partial
- Files changed: `src/data/questions.json`, `src/data/questions.ts`, `scripts/write-review-summary.ts`, `docs/needs-review.md`, `tests/unit/data.test.ts`, `tests/benchmark/progress.bench.test.ts`, `tests/e2e/coverage.spec.ts`, `index.html`, `public/favicon.svg`, `.gitignore`, `README.md`, `IMPLEMENTATION_PLAN.md`.
- Commands run: `npm run typecheck`, `npm run validate:data`, `npm run test`, `npm run test:benchmark`, `npm run build`, `npm run check:dist`, `npm run review:report`, `npm run test:e2e`, `git status --ignored --short`.
- Test evidence: validation `137` verified; unit `12/12`; benchmark `2/2`; build pass; dist guard pass với 4 files/335737 bytes; E2E `60/60` trên bốn viewport; review report còn đúng `q-007`, `q-026`.
- Failures/regressions added: không có lỗi ở lượt cuối; các regression options/full-bank timeout/favicon đã có test hoặc browser recheck và chạy lại xanh.
- Open questions/blockers: chưa có GitHub remote/repository URL và chưa có Pages URL; không tự push khi người dùng chưa duyệt repository đích.
- Next task: người dùng cung cấp repository GitHub đích (hoặc cho phép tạo) và quyết định hai câu `needs-review`; sau đó push branch `main`, chạy Actions và kiểm tra URL Pages.

### 2026-08-05 23:10 - TASK-018 GitHub preflight

- Agent: Codex
- Trạng thái: partial
- Files changed: không đổi; chỉ kiểm tra read-only.
- Commands run: `gh auth status`, `gh repo list loilarry`, `git remote -v`.
- Test evidence: GitHub CLI đã đăng nhập tài khoản `loilarry`; không có repository phù hợp được xác định và local worktree chưa có remote.
- Failures/regressions added: không có.
- Open questions/blockers: cần owner/repository đích được người dùng xác nhận trước khi tạo remote, commit và push.
- Next task: nhận repository URL hoặc xác nhận tạo repository public mới.

### 2026-08-05 23:18 - TASK-003/TASK-009 completion audit and regression recovery

- Agent: Codex
- Trạng thái: completed locally
- Files changed: `scripts/preprocess-images.py`, `docs/ocr-pipeline.md`, `src/features/progress/progressStore.ts`, `tests/unit/progress.test.ts`, `IMPLEMENTATION_PLAN.md`.
- Commands run: `python3 scripts/preprocess-images.py images .tmp-ocr/preprocessed-sample-20260805 --crop-margin 12 --deskew-angle 0.6`, `npm run typecheck`, `npm run test`, `npm run test:benchmark`, `npm run validate:data`, `npm run review:report`, `npm run build`, `npm run check:dist`, `npm run test:e2e`.
- Test evidence: preprocessor generated 21 working copies and a report; three representative images (pages 5, 16, 18) were visually inspected. Unit `14/14`, benchmark `2/2`, validation `137`, build/bundle guard pass, E2E `60/60` across four viewport projects.
- Failures/regressions added: audit found persisted sessions could keep duplicate/orphan review IDs, an out-of-range cursor, or an active session after dataset-version change. Added normalization, review queue reconciliation, cursor clamping and two unit regressions; rerun green.
- Open questions/blockers: two source images have no visible printed page number; `q-007`/`q-026` still require source confirmation; GitHub remote/Pages URL still needs user approval.
- Next task: obtain the approved GitHub repository/owner and confirm whether the two ambiguous source questions are excluded from V1 or supplied with an answer key.

### 2026-08-05 23:21 - TASK-002 manifest evidence closure

- Agent: Codex
- Trạng thái: completed locally
- Files changed: `scripts/build-image-manifest.ts`, `data/image-manifest.json`, `IMPLEMENTATION_PLAN.md`.
- Commands run: `npm run build:manifest`; visual inspection of the source images for page labels and duplicate selection.
- Test evidence: manifest contains 21 checksummed entries, resolves sequence 2 and 6 to printed page 6 using production source evidence, records the OCR/page conflict on sequence 6, and preserves sequence 4 as `printedPage: null` because no printed number is visible. The exact page-18 duplicate retains `duplicateOf` and production uses the canonical image.
- Failures/regressions added: OCR had an incorrect page candidate (`3`) for the image visibly marked `6`; generator now prefers the manually audited production page while retaining the old candidate in notes.
- Open questions/blockers: no remaining local manifest task; GitHub remote/Pages and the two ambiguous questions remain user decisions.
- Next task: obtain approved GitHub repository/owner, then run the Pages workflow and public smoke test.

### 2026-08-05 23:24 - TASK-019 local release gate after manifest audit

- Agent: Codex
- Trạng thái: partial (local acceptance complete; public deployment pending)
- Files changed: no code changes after the manifest audit; generated review report refreshed.
- Commands run: `npm run typecheck`, `npm run validate:data`, `npm run test`, `npm run test:benchmark`, `npm run review:report`, `npm run build`, `npm run check:dist`, `npm run test:e2e`.
- Test evidence: validation `137` verified; unit `14/14`; benchmark `2/2`; build pass; bundle guard `4 files / 336131 bytes` with no source images or external URLs; E2E `60/60` on Chromium, narrow 320x568, mobile 390x844 and tablet 768x1024; review report remains exactly `q-007`, `q-026`.
- Failures/regressions added: none in the rerun; the session normalization and manifest page-conflict regressions remain covered and green.
- Open questions/blockers: no approved GitHub remote/Pages URL; two source questions need confirmation or explicit V1 exclusion; source-image public exposure still awaits approval.
- Next task: after repository approval, create/attach remote, commit intentionally, push `main`, monitor Actions, and test the public URL including refresh.

### 2026-08-05 23:31 - TASK-006 continuation-page recovery

- Agent: Codex
- Trạng thái: completed locally for `q-007`; `q-026` remains partial.
- Files changed: `src/data/questions.json`, `src/data/questions.ts`, `src/types.ts`, `src/data/validate.ts`, `scripts/write-review-summary.ts`, `tests/unit/data.test.ts`, `docs/needs-review.md`, `README.md`, `IMPLEMENTATION_PLAN.md`.
- Commands run: visual inspection of the page-4/page-5 source images; `npm run validate:data`, `npm run review:report`, `npm run typecheck`, `npm run test`, `npm run test:benchmark`, `npm run build`, `npm run check:dist`, `npm run test:e2e`.
- Test evidence: `q-007` is now published with options from the page-5 continuation, marked answer `B`, and `source.continuationImage`; validator reports `138` verified questions, unit `15/15`, benchmark `2/2`, build/bundle guard pass, E2E `60/60` across four viewport projects, and review report contains only `q-026`.
- Failures/regressions added: source provenance now validates continuation images and a data regression locks `q-007` answer/provenance. No failures in the final rerun.
- Open questions/blockers: `q-026` still ends at a page boundary without a semantically matching visible option block; GitHub remote/Pages approval remains external.
- Next task: resolve or explicitly exclude `q-026`, then attach the approved GitHub repository and run public Pages smoke tests.

### 2026-08-05 23:33 - TASK-019 metadata-corrected local gate

- Agent: Codex
- Trạng thái: partial (local gate green; public deployment pending)
- Files changed: `src/data/questions.ts`, `src/data/questions.json`, `README.md`, `IMPLEMENTATION_PLAN.md` (date/version consistency only).
- Commands run: `npm run typecheck`, `npm run validate:data`, `npm run test`, `npm run test:benchmark`, `npm run build`, `npm run check:dist`.
- Test evidence: dataset `2026-08-05.5`, validation `138`, unit `15/15`, benchmark `2/2`, build and bundle guard pass (`4 files / 336950 bytes`). The preceding q-007 rerun remains green at E2E `60/60`.
- Failures/regressions added: none; corrected the dataset/verification date to the current workspace date.
- Open questions/blockers: only `q-026` source confirmation/exclusion and GitHub repository/Pages approval remain.
- Next task: receive the approved repository, then push and execute the public Pages smoke-test checklist.

### 2026-08-05 23:34 - TASK-002 continuation provenance index

- Agent: Codex
- Trạng thái: completed locally
- Files changed: `scripts/build-image-manifest.ts`, `data/image-manifest.json`, `IMPLEMENTATION_PLAN.md`.
- Commands run: `npm run build:manifest`, `npm run typecheck`.
- Test evidence: manifest now records `continuationFor: ["q-007"]` on the page-5 image while retaining checksum, page and duplicate metadata for all 21 images.
- Failures/regressions added: none; this makes the page-break provenance discoverable without scanning the question JSON.
- Open questions/blockers: `q-026` and public GitHub deployment remain unresolved externally.
- Next task: user confirms q-026 handling and repository target.

### 2026-08-05 23:36 - TASK-016/TASK-018 GitHub path guard

- Agent: Codex
- Trạng thái: completed locally
- Files changed: `scripts/check-dist.ts`, `IMPLEMENTATION_PLAN.md`.
- Commands run: `npm run build`, `npm run check:dist`.
- Test evidence: dist guard now rejects root-relative `/assets/` paths and requires `./assets/` plus `./favicon.svg`; current production build passes with 4 files and 336950 bytes.
- Failures/regressions added: none; guard closes the remaining untested repository-subpath deployment risk.
- Open questions/blockers: public Pages URL cannot be verified without an approved remote.
- Next task: attach approved repository and run the workflow/public path smoke test.

### 2026-08-05 23:40 - TASK-019 final local smoke rerun

- Agent: Codex
- Trạng thái: partial (public deployment pending)
- Files changed: none after the path guard.
- Commands run: `npm run test:e2e`.
- Test evidence: all `60/60` E2E cases pass across Chromium desktop, 320x568 narrow, 390x844 mobile and 768x1024 tablet, including full-bank completion, wrong-answer persistence, review rotation, reset and keyboard flow.
- Failures/regressions added: none.
- Open questions/blockers: no approved GitHub remote/Pages URL; q-026 remains outside production pending source confirmation.
- Next task: receive external decisions, then deploy and validate the public URL.

### 2026-08-05 23:43 - TASK-009 truncated all-session recovery

- Agent: Codex
- Trạng thái: completed locally
- Files changed: `src/features/progress/progressStore.ts`, `tests/unit/progress.test.ts`, `IMPLEMENTATION_PLAN.md`.
- Commands run: `npm run typecheck`, `npm run test`, `npm run test:benchmark`, `npm run validate:data`, `npm run review:report`, `npm run build`, `npm run check:dist`, `npm run test:e2e`.
- Test evidence: malformed/truncated all-question sessions now self-heal to the complete 138-ID bank; unit `16/16`, benchmark `2/2`, validation `138`, build/bundle guard `4 files / 337030 bytes`, E2E `60/60`.
- Failures/regressions added: added a regression that proves duplicate/orphan/truncated all queues cannot skip the bank tail; no failure remained after rerun.
- Open questions/blockers: q-026 source confirmation and approved GitHub remote/Pages URL remain external.
- Next task: use the approved repository and run public deployment checks.

### 2026-08-05 23:48 - TASK-015 continuation-page E2E coverage

- Agent: Codex
- Trạng thái: completed locally
- Files changed: `tests/e2e/coverage.spec.ts`, `IMPLEMENTATION_PLAN.md`.
- Commands run: `npx playwright test tests/e2e/coverage.spec.ts -g 'page-break question'`, `npx playwright test --reporter=dot`.
- Test evidence: added scenario 14 for q-007 continuation rendering, source reference and answer B; targeted run `4/4`, full run `64/64` across all four viewport projects.
- Failures/regressions added: none.
- Open questions/blockers: q-026 and GitHub remote/Pages remain unresolved external inputs.
- Next task: deploy the verified local release after repository approval.

Agents thêm entry theo mẫu sau, không xóa log cũ:

```md
### YYYY-MM-DD HH:mm - TASK-XXX

- Agent:
- Trạng thái: completed | partial | blocked
- Files changed:
- Commands run:
- Test evidence:
- Failures/regressions added:
- Open questions/blockers:
- Next task:
```

## 9. Open decisions cần người dùng duyệt khi đến đúng task

- [x] GitHub repository/remote đích và tên repo dùng cho Pages: `loilarry/tracnghiem`.
- [ ] Câu còn mơ hồ sau `TASK-006`: người dùng xác nhận hoặc loại `q-026` khỏi V1.
- [x] Công khai ảnh nguồn trong repo để audit; `dist/` không ship ảnh gốc.
- [ ] Có cần xáo trộn thứ tự câu/options hay giữ đúng thứ tự tài liệu; mặc định giữ thứ tự để dễ đối soát.

### 2026-08-06 08:02 - TASK-018/TASK-019 public release and smoke regression

- Agent: Codex
- Trạng thái: completed for public deployment; `q-026` remains partial by design.
- Files changed: `.github/workflows/pages.yml` (no workflow logic change after first run), `tests/e2e/coverage.spec.ts`, `tests/benchmark/progress.bench.test.ts`, `README.md`, `docs/release-summary.md`, `IMPLEMENTATION_PLAN.md`.
- Commands run: `gh repo create loilarry/tracnghiem --public`, `git push -u origin agent/publish-public-quiz`, `git push -u origin main`, `gh api --method POST repos/loilarry/tracnghiem/pages -f build_type=workflow`, `gh run rerun 31061053646 --failed`, `gh run watch 31061053646 --exit-status`, public Playwright smoke at `https://loilarry.github.io/tracnghiem/`.
- Test evidence: initial workflow failed only because the new repo had Pages disabled; after enabling Pages, run `31061053646` passed the original release gate and final run `31061500608` passed build, data validation, typecheck, unit, benchmark, browser E2E, build guard and deploy. Public smoke had no 4xx responses; desktop/mobile reload passed after the locator contract was corrected. Release summary records 17/17 unit, 3/3 benchmark, 68/68 E2E and the public URL.
- Failures/regressions added: first public smoke assertion incorrectly expected a brand heading and desktop sidebar names on mobile; the page itself returned no HTTP errors. Added scenario 15 with responsive locator selection and a shell-payload benchmark, then reran the corrected smoke checks successfully.
- Open questions/blockers: `q-026` is still excluded from production because the source image ends at its heading; it needs the original continuation/options before promotion.
- Next task: user provides the missing q-026 source/answer evidence; add it as a verified question, bump `datasetVersion`, and rerun the full release gate.
