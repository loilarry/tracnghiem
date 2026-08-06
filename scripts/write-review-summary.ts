import { readFile, writeFile } from "node:fs/promises";

type RawQuestion = { id: string; source: { image: string; printedPage?: number | null; questionIndexOnPage: number } };
const raw = JSON.parse(await readFile("data/questions.raw.json", "utf8")) as RawQuestion[];
const production = JSON.parse(await readFile("src/data/questions.json", "utf8")) as Array<{ source: { image: string; questionIndexOnPage: number } }>;
const manifest = JSON.parse(await readFile("data/image-manifest.json", "utf8")) as { images: Array<{ file: string; duplicateOf?: string | null }> };
const duplicateImages = new Set(manifest.images.filter((image) => image.duplicateOf).map((image) => image.file));
const published = new Set(production.map((question) => `${question.source.image}:${question.source.questionIndexOnPage}`));
const pending = raw.filter((question) => !duplicateImages.has(question.source.image) && !published.has(`${question.source.image}:${question.source.questionIndexOnPage}`));
const byImage = new Map<string, RawQuestion[]>();
for (const question of pending) byImage.set(question.source.image, [...(byImage.get(question.source.image) ?? []), question]);

const lines = [
  "# Câu hỏi chờ đối soát",
  "",
  `Cập nhật tự động từ data/questions.raw.json: ${pending.length} câu thuộc ảnh nguồn chính chưa được phát hành vào production. Không dùng danh sách này để thi cho đến khi mở ảnh gốc và xác nhận cả nội dung lẫn đáp án được đánh dấu.`,
  "",
  "| Ảnh nguồn | Số câu | ID raw |",
  "| --- | ---: | --- |",
];
for (const [image, questions] of byImage) {
  const page = questions.find((question) => question.source.printedPage)?.source.printedPage;
  lines.push(`| ${page ? `trang ${page} · ` : ""}\`${image}\` | ${questions.length} | ${questions.map((question) => `\`${question.id}\``).join(", ")} |`);
}
const reviewReasons: Record<string, string> = {
  "q-026": "Ảnh nguồn chỉ còn tiêu đề ở cuối trang; các nhóm A-D ở đầu ảnh khác đã được ghép cho câu khác, không có continuationImage đủ chắc chắn cho q-026. Cần xác nhận bản gốc trước khi phát hành.",
};
const reasonLines = pending.filter((question) => reviewReasons[question.id]).map((question) => `- \`${question.id}\`: ${reviewReasons[question.id]}`);
if (reasonLines.length) lines.push("", "Lý do giữ lại:", ...reasonLines);
if (duplicateImages.size) {
  lines.push("", `Ghi chú: ${duplicateImages.size} ảnh trùng checksum được bỏ khỏi hàng đợi; câu của ảnh trùng dùng bản ghi đã đối soát ở ảnh gốc canonical.`);
}
lines.push("", "Quy trình: mở ảnh trong `images/`, sửa câu và options, xác nhận dấu đáp án, rồi thêm bản ghi với `verification.status = \"verified\"` vào `src/data/questions.json`; cuối cùng chạy `npm run validate:data`.", "");
await writeFile("docs/needs-review.md", lines.join("\n"));
console.log(`Wrote ${pending.length} pending questions to docs/needs-review.md`);
