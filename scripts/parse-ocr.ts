import { readdir, readFile, writeFile } from "node:fs/promises";

type OCRLine = { text: string; x: number; y: number; width: number; height: number };
type RawQuestion = {
  id: string;
  order: number;
  text: string;
  options: Array<{ id: "A" | "B" | "C" | "D"; text: string }>;
  correctOptionId: null;
  source: { image: string; printedPage: number | null; questionIndexOnPage: number };
  verification: { status: "needs-review"; textConfidence: number; answerConfidence: number };
};

const dir = "data/ocr";
const files = (await readdir(dir)).filter((file) => file.endsWith(".json")).sort();
const result: RawQuestion[] = [];
let order = 1;

function clean(value: string) {
  return value.replace(/\s+/g, " ").replace(/^Câu hỏi\s*:?\s*/i, "").trim();
}

function optionId(value: string): "A" | "B" | "C" | "D" | null {
  const normalized = value.trim().toUpperCase().replace("Ơ", "B").replace(/^0(?=\s*[\).:]|$)/, "D");
  const match = normalized.match(/^([ABCD])\s*(?:[\).:]|$)/);
  return match ? (match[1] as "A" | "B" | "C" | "D") : null;
}

for (const file of files) {
  const sourceImage = file.replace(/\.json$/, ".jpg");
  // Vision returns lines in reading order. Preserve that order: sorting only by
  // y can move a bottom-of-row answer in front of the next "Câu hỏi" marker.
  const lines = (JSON.parse(await readFile(`${dir}/${file}`, "utf8")) as OCRLine[])
    .filter((line) => line.text.trim());
  const printedPage = lines
    .slice(0, Math.max(1, lines.findIndex((line) => /^Câu\s+h[ỏoôơồ]i/i.test(line.text.trim()))))
    .map((line) => Number.parseInt(line.text.trim(), 10))
    .find((value) => Number.isFinite(value) && value > 0 && value < 100) ?? null;
  let current: { text: string[]; options: RawQuestion["options"]; page: number | null; questionDone: boolean } | null = null;
  let pageQuestionIndex = 0;

  const flush = () => {
    if (!current || !current.text.length) return;
    const questionText = clean(current.text.join(" "));
    pageQuestionIndex += 1;
    result.push({
      id: `q-${String(order).padStart(3, "0")}`,
      order,
      text: questionText,
      options: current.options,
      correctOptionId: null,
      source: { image: sourceImage, printedPage: current.page ?? printedPage, questionIndexOnPage: pageQuestionIndex },
      verification: { status: "needs-review", textConfidence: 0, answerConfidence: 0 },
    });
    order += 1;
  };

  for (const line of lines) {
    const text = line.text.trim();
    if (/^Câu\s+h[ỏoôơồ]i\s*:?/i.test(text)) {
      flush();
      const inlinePrompt = text.replace(/^Câu\s+h[ỏoôơồ]i\s*:?\s*/i, "").trim();
      current = { text: inlinePrompt ? [inlinePrompt] : [], options: [], page: printedPage, questionDone: false };
      if (inlinePrompt.includes("?")) current.questionDone = true;
      continue;
    }
    if (!current) {
      const pageNumber = Number.parseInt(text, 10);
      if (Number.isFinite(pageNumber) && pageNumber < 100) {
        // The printed page number is useful metadata, but not question text.
        continue;
      }
      continue;
    }

    const id = optionId(text);
    if (!current.questionDone) {
      const questionPart = clean(text);
      current.text.push(questionPart);
      if (questionPart.includes("?") || id) {
        current.questionDone = true;
        if (id) {
          current.text.pop();
          current.options.push({ id, text: clean(text.replace(/^[^\).:]+[\).:]/, "")) });
        }
      }
      continue;
    }
    if (id) {
      current.options.push({ id, text: clean(text.replace(/^[^\).:]+[\).:]/, "")) });
    } else if (!current.options.length) {
      current.options.push({ id: "A", text: clean(text) });
    } else {
      const last = current.options[current.options.length - 1];
      last.text = clean(`${last.text} ${text}`);
    }
  }
  flush();
}

await writeFile("data/questions.raw.json", `${JSON.stringify(result, null, 2)}\n`);
console.log(`Parsed ${result.length} raw questions from ${files.length} OCR files.`);
