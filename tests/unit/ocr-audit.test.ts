import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("OCR audit artifacts", () => {
  it("keeps every parsed question linked to a source image", () => {
    const raw = JSON.parse(readFileSync("data/questions.raw.json", "utf8")) as Array<{ id: string; source: { image: string }; verification: { status: string } }>;
    const candidates = JSON.parse(readFileSync("data/answer-candidates.json", "utf8")) as Array<{ questionId: string }>;
    expect(raw.length).toBe(147);
    expect(candidates.length).toBe(raw.length);
    expect(new Set(raw.map((question) => question.id)).size).toBe(raw.length);
    expect(raw.every((question) => question.source.image.endsWith(".jpg"))).toBe(true);
    expect(raw.every((question) => question.verification.status === "needs-review")).toBe(true);
  });
});
