export type OptionId = "A" | "B" | "C" | "D";

export type QuizQuestion = {
  id: string;
  order: number;
  text: string;
  options: Array<{ id: OptionId; text: string }>;
  correctOptionId: OptionId;
  topic?: string;
  source: {
    image: string;
    continuationImage?: string;
    printedPage?: number;
    questionIndexOnPage: number;
  };
  verification: {
    status: "verified" | "needs-review";
    textConfidence: number;
    answerConfidence: number;
    verifiedBy?: string;
    verifiedAt?: string;
  };
};

export type QuestionProgress = {
  attempts: number;
  correctCount: number;
  wrongCount: number;
  lastResult: "correct" | "wrong" | null;
  needsReview: boolean;
  firstWrongAt?: string;
  masteredAt?: string;
};

export type QuizMode = "all" | "review";

export type PersistedProgress = {
  schemaVersion: 1;
  datasetVersion: string;
  questionProgress: Record<string, QuestionProgress>;
  activeSession?: {
    mode: QuizMode;
    queue: string[];
    currentIndex: number;
    round: number;
  };
};

export type AnswerFeedback = {
  selectedOptionId: OptionId;
  correct: boolean;
};
