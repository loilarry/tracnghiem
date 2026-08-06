import { describe, expect, it } from "vitest";
import { questions, verifiedQuestions } from "../../src/data/questions";
import { createInitialProgress, parseProgress, progressFor, reviewIds, submitAnswer } from "../../src/features/progress/progressStore";

describe("progress state machine", () => {
  it("adds a wrong answer to review and clears it after a later correct answer", () => {
    const id = questions[0].id;
    const initial = createInitialProgress();
    const wrong = submitAnswer(initial, id, false);
    expect(reviewIds(wrong)).toEqual([id]);
    expect(progressFor(wrong, id).wrongCount).toBe(1);
    const correct = submitAnswer(wrong, id, true);
    expect(reviewIds(correct)).toEqual([]);
    expect(progressFor(correct, id).attempts).toBe(2);
    expect(progressFor(correct, id).masteredAt).toBeDefined();
  });

  it("drops unknown IDs and recovers malformed storage", () => {
    const id = questions[0].id;
    const raw = JSON.stringify({ schemaVersion: 1, datasetVersion: "old", questionProgress: { [id]: progressFor(createInitialProgress(), id), unknown: { needsReview: true } } });
    const parsed = parseProgress(raw);
    expect(Object.keys(parsed.questionProgress)).toEqual([id]);
    expect(parseProgress("not-json").questionProgress).toEqual({});
  });

  it("rejects negative or fractional counters from localStorage", () => {
    const id = questions[0].id;
    const raw = JSON.stringify({
      schemaVersion: 1,
      questionProgress: {
        [id]: { attempts: -1, correctCount: 0, wrongCount: 0, lastResult: null, needsReview: false },
        other: { attempts: 1.5, correctCount: 0, wrongCount: 0, lastResult: null, needsReview: false },
      },
    });
    expect(parseProgress(raw).questionProgress).toEqual({});
  });

  it("normalizes a persisted session queue and clamps its cursor", () => {
    const [first, second, third] = questions;
    const progress = submitAnswer(createInitialProgress(), first.id, false);
    const withAnotherWrong = submitAnswer(progress, third.id, false);
    const raw = JSON.stringify({
      schemaVersion: 1,
      datasetVersion: withAnotherWrong.datasetVersion,
      questionProgress: withAnotherWrong.questionProgress,
      activeSession: {
        mode: "review",
        queue: [first.id, first.id, second.id, "unknown"],
        currentIndex: 99,
        round: 2,
      },
    });
    const parsed = parseProgress(raw);
    expect(parsed.activeSession).toMatchObject({ mode: "review", queue: [first.id, third.id], currentIndex: 1, round: 2 });
  });

  it("drops an active session when the dataset version changes", () => {
    const id = questions[0].id;
    const raw = JSON.stringify({
      schemaVersion: 1,
      datasetVersion: "older-dataset",
      questionProgress: { [id]: progressFor(createInitialProgress(), id) },
      activeSession: { mode: "all", queue: [id], currentIndex: 0, round: 1 },
    });
    expect(parseProgress(raw).activeSession).toBeUndefined();
    expect(parseProgress(raw).questionProgress[id]).toBeDefined();
  });

  it("repairs a truncated all-questions session instead of skipping the bank tail", () => {
    const first = verifiedQuestions[0].id;
    const raw = JSON.stringify({
      schemaVersion: 1,
      datasetVersion: "2026-08-05.5",
      questionProgress: {},
      activeSession: { mode: "all", queue: [first, first, "unknown"], currentIndex: 0, round: 1 },
    });
    const parsed = parseProgress(raw);
    expect(parsed.activeSession?.queue).toHaveLength(verifiedQuestions.length);
    expect(parsed.activeSession?.queue[0]).toBe(first);
    expect(new Set(parsed.activeSession?.queue).size).toBe(verifiedQuestions.length);
  });
});
