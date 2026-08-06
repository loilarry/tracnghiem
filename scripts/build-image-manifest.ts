import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";

const imageDir = "images";
const outputPath = "data/image-manifest.json";
const checksumsPath = "data/source-image-checksums.json";
const files = (await readdir(imageDir)).filter((file) => /\.(jpe?g|png)$/i.test(file)).sort();
let rawQuestions: Array<{ source?: { image?: string; printedPage?: number | null } }> = [];
try {
  rawQuestions = JSON.parse(await readFile("data/questions.raw.json", "utf8"));
} catch {
  // The manifest is also useful before OCR has been run.
}
let publishedQuestions: Array<{ id?: string; source?: { image?: string; printedPage?: number | null; continuationImage?: string } }> = [];
try {
  publishedQuestions = JSON.parse(await readFile("src/data/questions.json", "utf8"));
} catch {
  // Production data is optional while the OCR pipeline is being bootstrapped.
}

const entries = await Promise.all(
  files.map(async (file, index) => {
    const path = join(imageDir, file);
    const [contents, info] = await Promise.all([readFile(path), stat(path)]);
    const sourceQuestions = rawQuestions.filter((question) => question.source?.image === file);
    const publishedSourceQuestions = publishedQuestions.filter((question) => question.source?.image === file);
    const continuationFor = publishedQuestions
      .filter((question) => question.source?.continuationImage === file)
      .map((question) => question.id)
      .filter((id): id is string => typeof id === "string");
    const rawPages = [...new Set(sourceQuestions.map((question) => question.source?.printedPage).filter((page): page is number => typeof page === "number"))];
    const publishedPages = [...new Set(publishedSourceQuestions.map((question) => question.source?.printedPage).filter((page): page is number => typeof page === "number"))];
    const printedPages = publishedPages.length ? publishedPages : rawPages;
    const pageConflict = rawPages.length > 0 && publishedPages.length > 0 && rawPages.some((page) => !publishedPages.includes(page));
    const pageNote = printedPages.length
      ? publishedSourceQuestions.length
        ? pageConflict
          ? `Số trang production đã đối chiếu (${publishedPages.join(", ")}); OCR cũ có giá trị khác (${rawPages.join(", ")}) và được giữ lại trong audit. Ảnh gốc vẫn là nguồn chuẩn.`
          : "Số trang đã đối chiếu trong source của câu production; ảnh gốc vẫn là nguồn chuẩn."
        : "Số trang là ứng viên từ OCR; cần đối chiếu ảnh trước khi phát hành câu mới."
      : "Không thấy số trang in trong ảnh; giữ null và dùng sequence/source image để truy vết.";
    return {
      file,
      sourcePath: path,
      checksumSha256: createHash("sha256").update(contents).digest("hex"),
      bytes: info.size,
      sequence: index + 1,
      printedPage: printedPages.length === 1 ? printedPages[0] : null,
      questionBlocksVisible: sourceQuestions.length,
      continuationFor,
      duplicateOf: null as string | null,
      status: "pending" as const,
      notes: pageNote,
    };
  }),
);

const checksumFirst = new Map<string, string>();
for (const entry of entries) {
  const previous = checksumFirst.get(entry.checksumSha256);
  if (previous) entry.duplicateOf = previous;
  else checksumFirst.set(entry.checksumSha256, entry.file);
}

await mkdir("data", { recursive: true });
await writeFile(
  outputPath,
  `${JSON.stringify({ generatedAt: new Date().toISOString(), imageCount: entries.length, images: entries }, null, 2)}\n`,
);
await writeFile(
  checksumsPath,
  `${JSON.stringify(Object.fromEntries(entries.map((entry) => [entry.file, entry.checksumSha256])), null, 2)}\n`,
);
console.log(`Wrote ${entries.length} image entries to ${outputPath}`);
