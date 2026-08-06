import type { QuizQuestion } from "../types";

export function questionFingerprint(question: QuizQuestion) {
  return `${question.text}::${question.options.map((option) => option.text).join("|")}`
    .toLocaleLowerCase("vi-VN")
    .replace(/\s+/g, " ")
    .trim();
}

export function validateQuestions(questions: QuizQuestion[], sourceExists: (image: string) => boolean): string[] {
  const ids = new Set<string>();
  const orders = new Set<number>();
  const fingerprints = new Map<string, string>();
  const failures: string[] = [];

  for (const question of questions) {
    if (ids.has(question.id)) failures.push(`${question.id}: duplicate id`);
    ids.add(question.id);
    if (orders.has(question.order)) failures.push(`${question.id}: duplicate order`);
    orders.add(question.order);
    if (!question.text.trim()) failures.push(`${question.id}: empty question`);
    if (question.options.length < 2 || question.options.length > 6) failures.push(`${question.id}: invalid option count`);
    const optionIds = new Set(question.options.map((option) => option.id));
    if (optionIds.size !== question.options.length) failures.push(`${question.id}: duplicate option id`);
    if (!optionIds.has(question.correctOptionId)) failures.push(`${question.id}: missing correct option`);
    if (question.verification.status !== "verified") failures.push(`${question.id}: not verified`);
    if (!sourceExists(question.source.image)) failures.push(`${question.id}: source image not found`);
    if (question.source.continuationImage && !sourceExists(question.source.continuationImage)) failures.push(`${question.id}: continuation image not found`);
    const fingerprint = questionFingerprint(question);
    const previous = fingerprints.get(fingerprint);
    if (previous) failures.push(`${question.id}: duplicate content of ${previous}`);
    fingerprints.set(fingerprint, question.id);
  }
  return failures;
}
