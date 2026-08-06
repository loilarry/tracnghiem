import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import { questions, verifiedQuestions } from "../../src/data/questions";
import checksums from "../../data/source-image-checksums.json";

describe("question bank", () => {
  it("contains only verified questions with one valid answer", () => {
    expect(questions.length).toBeGreaterThan(0);
    expect(verifiedQuestions).toHaveLength(questions.length);
    expect(new Set(questions.map((question) => question.id)).size).toBe(questions.length);
    for (const question of questions) {
      expect(question.text).not.toBe("");
      expect(question.options.length).toBeGreaterThanOrEqual(2);
      expect(question.options.length).toBeLessThanOrEqual(6);
      expect(question.options.some((option) => option.id === question.correctOptionId)).toBe(true);
      expect(question.source.image).toMatch(/\.jpg$/);
    }
  });

  it("keeps a checksum entry for every source image", () => {
    const images = readdirSync("images").filter((file) => /\.jpe?g$/i.test(file));
    expect(Object.keys(checksums)).toHaveLength(images.length);
    expect(images.every((file) => /^[a-f0-9]{64}$/.test(checksums[file as keyof typeof checksums]))).toBe(true);
  });

  it("keeps continuation provenance for the page-break question", () => {
    const question = questions.find((candidate) => candidate.id === "q-007");
    expect(question?.correctOptionId).toBe("B");
    expect(question?.source.continuationImage).toMatch(/\.jpg$/);
  });
});
