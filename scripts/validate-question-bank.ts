import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import type { QuizQuestion } from "../src/types";
import { validateQuestions } from "../src/data/validate";

const questions = JSON.parse(await readFile("src/data/questions.json", "utf8")) as QuizQuestion[];
const failures = validateQuestions(questions, (image) => existsSync(`images/${image}`));

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`Validated ${questions.length} verified questions.`);
