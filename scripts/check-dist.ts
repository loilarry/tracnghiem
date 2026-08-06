import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const distDir = "dist";

async function filesUnder(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await filesUnder(path)));
    else files.push(path);
  }
  return files;
}

const files = await filesUnder(distDir);
const relativeFiles = files.map((file) => file.slice(distDir.length + 1));
const htmlPath = join(distDir, "index.html");
const html = await readFile(htmlPath, "utf8");
if (!html.includes('src="./assets/') || !html.includes('href="./assets/') || !html.includes('href="./favicon.svg"')) {
  console.error("GitHub Pages path guard failed: dist/index.html must use relative asset and favicon paths");
  process.exit(1);
}
if (html.includes('src="/assets/') || html.includes('href="/assets/')) {
  console.error("GitHub Pages path guard failed: dist/index.html contains root-relative asset paths");
  process.exit(1);
}
const forbiddenSourceAssets = relativeFiles.filter((file) => /(^|\/)(images|ocr)(\/|$)|\.(jpe?g|png)$/i.test(file));
if (forbiddenSourceAssets.length) {
  console.error(`Source image/OCR assets leaked into dist/:\n${forbiddenSourceAssets.join("\n")}`);
  process.exit(1);
}

const textAssets = files.filter((file) => /\.(html|css|js|map)$/i.test(file));
const externalUrls: string[] = [];
const allowedRuntimeReferences = ["https://react.dev/", "http://www.w3.org/", "http://www.w3.org"];
for (const file of textAssets) {
  const content = await readFile(file, "utf8");
  const matches = content.match(/https?:\/\/[^"'\s)]+/g) ?? [];
  externalUrls.push(...matches.filter((url) => !allowedRuntimeReferences.some((allowed) => url.startsWith(allowed))).map((url) => `${file}: ${url}`));
}
if (externalUrls.length) {
  console.error(`Unexpected external URLs in static bundle:\n${externalUrls.join("\n")}`);
  process.exit(1);
}

const totalBytes = (await Promise.all(files.map(async (file) => (await stat(file)).size))).reduce((sum, size) => sum + size, 0);
console.log(`dist guard passed: ${files.length} files, ${totalBytes} bytes, no source images or external URLs`);
