import { describe, expect, it } from "vitest";
import { questions } from "../../src/data/questions";
import { validateQuestions } from "../../src/data/validate";

describe("question-bank validation", () => {
  it("accepts the production bank", () => {
    expect(validateQuestions(questions, () => true)).toEqual([]);
  });

  it("rejects duplicate IDs/orders, missing answers and missing sources", () => {
    const invalid = [{ ...questions[0], correctOptionId: "Z", order: questions[0].order, source: { ...questions[0].source, image: "missing.jpg" } }, questions[0]] as never;
    const failures = validateQuestions(invalid, () => false);
    expect(failures).toEqual(expect.arrayContaining(["q-p04-001: duplicate id", "q-p04-001: duplicate order", "q-p04-001: missing correct option", "q-p04-001: source image not found"]));
  });
});
