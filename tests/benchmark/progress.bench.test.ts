import { describe, expect, it } from "vitest";
import { performance } from "node:perf_hooks";
import { questions, verifiedQuestions } from "../../src/data/questions";
import { createInitialProgress, reviewIdsFor, submitAnswer } from "../../src/features/progress/progressStore";

describe("progress benchmark", () => {
  it("derives the verified bank sequence within the release budget", () => {
    const started = performance.now();
    const sequence = [...questions]
      .sort((left, right) => left.order - right.order)
      .map((question) => question.options.findIndex((option) => option.id === question.correctOptionId));
    const elapsed = performance.now() - started;
    expect(sequence).toHaveLength(questions.length);
    expect(sequence.every((index) => index >= 0)).toBe(true);
    expect(elapsed).toBeLessThan(500);
  });

  it("updates and derives a synthetic 1,000-question queue quickly", () => {
    const synthetic = Array.from({ length: 1000 }, (_, index) => ({ id: questions[index % questions.length].id + `-${index}` }));
    const started = performance.now();
    let progress = createInitialProgress();
    for (const question of synthetic) progress = submitAnswer(progress, question.id, false);
    const elapsed = performance.now() - started;
    expect(Object.keys(progress.questionProgress)).toHaveLength(1000);
    expect(elapsed).toBeLessThan(1000);
    const queueStarted = performance.now();
    const reviewQueue = reviewIdsFor(progress, synthetic.map((question) => question.id));
    const queueElapsed = performance.now() - queueStarted;
    expect(reviewQueue).toHaveLength(1000);
    expect(queueElapsed).toBeLessThan(1000);
  });

  it("serializes the public shell payload within the release budget", () => {
    const started = performance.now();
    const payload = JSON.stringify({
      allCount: verifiedQuestions.length,
      reviewCount: 0,
      sourceNotes: verifiedQuestions.map((question) => `${question.source.printedPage ?? "—"}:${question.source.questionIndexOnPage}`),
    });
    const parsed = JSON.parse(payload) as { allCount: number; reviewCount: number; sourceNotes: string[] };
    const elapsed = performance.now() - started;
    expect(parsed.allCount).toBe(questions.length);
    expect(parsed.reviewCount).toBe(0);
    expect(parsed.sourceNotes).toHaveLength(questions.length);
    expect(payload.length).toBeLessThan(10_000);
    expect(elapsed).toBeLessThan(500);
  });
});
