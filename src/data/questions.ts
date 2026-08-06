import rawQuestions from "./questions.json";
import type { QuizQuestion } from "../types";

export const datasetVersion = "2026-08-05.5";
export const questions = [...(rawQuestions as QuizQuestion[])].sort((left, right) => left.order - right.order);
export const verifiedQuestions = questions.filter((question) => question.verification.status === "verified");

export function getQuestionById(id: string) {
  return verifiedQuestions.find((question) => question.id === id);
}
