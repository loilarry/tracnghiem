import { datasetVersion, verifiedQuestions } from "../../data/questions";
import type { PersistedProgress, QuestionProgress, QuizMode } from "../../types";

export const STORAGE_KEY = "tracnghiem:progress:v1";

export function emptyQuestionProgress(): QuestionProgress {
  return { attempts: 0, correctCount: 0, wrongCount: 0, lastResult: null, needsReview: false };
}

export function createInitialProgress(): PersistedProgress {
  return { schemaVersion: 1, datasetVersion, questionProgress: {} };
}

function isQuestionProgress(value: unknown): value is QuestionProgress {
  if (!value || typeof value !== "object") return false;
  const candidate = value as QuestionProgress;
  return (
    Number.isInteger(candidate.attempts) && candidate.attempts >= 0 &&
    Number.isInteger(candidate.correctCount) && candidate.correctCount >= 0 &&
    Number.isInteger(candidate.wrongCount) && candidate.wrongCount >= 0 &&
    (candidate.lastResult === null || candidate.lastResult === "correct" || candidate.lastResult === "wrong") &&
    typeof candidate.needsReview === "boolean"
  );
}

export function parseProgress(raw: string | null): PersistedProgress {
  if (!raw) return createInitialProgress();
  try {
    const parsed = JSON.parse(raw) as Partial<PersistedProgress>;
    if (parsed.schemaVersion !== 1 || !parsed.questionProgress || typeof parsed.questionProgress !== "object") {
      return createInitialProgress();
    }
    const validIds = new Set(verifiedQuestions.map((question) => question.id));
    const questionProgress = Object.fromEntries(
      Object.entries(parsed.questionProgress).filter(([id, value]) => validIds.has(id) && isQuestionProgress(value)),
    );
    const session = parsed.activeSession;
    const datasetChanged = parsed.datasetVersion !== datasetVersion;
    const clampInteger = (value: unknown, minimum: number, fallback: number) => {
      const numberValue = typeof value === "number" ? value : Number(value);
      return Number.isFinite(numberValue) ? Math.max(minimum, Math.floor(numberValue)) : fallback;
    };
    const sessionQueue = session && Array.isArray(session.queue)
      ? [...new Set(session.queue.filter((id): id is string => typeof id === "string" && validIds.has(id)))]
      : [];
    const reviewQueue = session?.mode === "review"
      ? sessionQueue.filter((id) => questionProgress[id]?.needsReview === true)
      : sessionQueue;
    const queuedReviewIds = new Set(reviewQueue);
    const missingReviewIds = session?.mode === "review"
      ? verifiedQuestions.map((question) => question.id).filter((id) => questionProgress[id]?.needsReview === true && !queuedReviewIds.has(id))
      : [];
    const queuedAllIds = new Set(sessionQueue);
    const missingAllIds = session?.mode === "all"
      ? verifiedQuestions.map((question) => question.id).filter((id) => !queuedAllIds.has(id))
      : [];
    const queue = session?.mode === "review" ? [...reviewQueue, ...missingReviewIds] : [...sessionQueue, ...missingAllIds];
    const currentIndex = queue.length
      ? Math.min(clampInteger(session?.currentIndex, 0, 0), queue.length - 1)
      : 0;
    return {
      schemaVersion: 1,
      datasetVersion,
      questionProgress,
      activeSession:
        !datasetChanged && session && (session.mode === "all" || session.mode === "review") && Array.isArray(session.queue)
          ? {
              mode: session.mode,
              queue,
              currentIndex,
              round: clampInteger(session.round, 1, 1),
            }
          : undefined,
    };
  } catch {
    return createInitialProgress();
  }
}

export function loadProgress(): PersistedProgress {
  if (typeof window === "undefined") return createInitialProgress();
  try {
    return parseProgress(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return createInitialProgress();
  }
}

export function saveProgress(progress: PersistedProgress) {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    } catch {
      // Private browsing/storage quota errors must not interrupt a quiz session.
    }
  }
}

export function progressFor(progress: PersistedProgress, questionId: string): QuestionProgress {
  return progress.questionProgress[questionId] ?? emptyQuestionProgress();
}

export function submitAnswer(progress: PersistedProgress, questionId: string, correct: boolean): PersistedProgress {
  const previous = progressFor(progress, questionId);
  const next: QuestionProgress = {
    ...previous,
    attempts: previous.attempts + 1,
    correctCount: previous.correctCount + (correct ? 1 : 0),
    wrongCount: previous.wrongCount + (correct ? 0 : 1),
    lastResult: correct ? "correct" : "wrong",
    needsReview: !correct ? true : false,
    ...(correct ? { masteredAt: new Date().toISOString() } : { firstWrongAt: previous.firstWrongAt ?? new Date().toISOString() }),
  };
  return { ...progress, questionProgress: { ...progress.questionProgress, [questionId]: next } };
}

export function reviewIdsFor(progress: PersistedProgress, questionIds: string[]) {
  return questionIds.filter((questionId) => progressFor(progress, questionId).needsReview);
}

export function reviewIds(progress: PersistedProgress) {
  return reviewIdsFor(progress, verifiedQuestions.map((question) => question.id));
}

export function startSession(progress: PersistedProgress, mode: QuizMode): PersistedProgress {
  const queue = mode === "review" ? reviewIds(progress) : verifiedQuestions.map((question) => question.id);
  return { ...progress, activeSession: { mode, queue, currentIndex: 0, round: 1 } };
}

export function clearProgress(): PersistedProgress {
  return createInitialProgress();
}
