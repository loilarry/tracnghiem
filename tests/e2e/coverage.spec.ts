import { expect, test, type Page } from "@playwright/test";
import rawQuestions from "../../src/data/questions.json" with { type: "json" };

const correctIndexes = [...rawQuestions]
  .sort((left, right) => left.order - right.order)
  .map((question) => question.options.findIndex((option) => option.id === question.correctOptionId));
const questionCount = correctIndexes.length;

function reviewButton(page: Page) {
  return page.locator("button").filter({ hasText: /Câu cần ôn|Cần ôn/, visible: true });
}

test("scenario 1: first load exposes the two required modes", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Tất cả câu hỏi" })).toBeVisible();
  await expect(page.locator("button").filter({ hasText: /Tất cả câu hỏi|Tất cả/, visible: true })).toContainText(String(questionCount));
  await expect(reviewButton(page)).toContainText("0");
});

test("scenario 2: submit stays disabled until an option is selected", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Trả lời" })).toBeDisabled();
  await page.locator("label.option").nth(0).click();
  await expect(page.getByRole("button", { name: "Trả lời" })).toBeEnabled();
});

test("scenario 3: a correct answer advances to the next question", async ({ page }) => {
  await page.goto("/");
  await page.locator("label.option").nth(0).click();
  await page.getByRole("button", { name: "Trả lời" }).click();
  await expect(page.getByText("Câu trả lời đúng")).toBeVisible();
  await page.getByRole("button", { name: "Câu tiếp theo" }).click();
  await expect(page.getByText(`Câu hỏi 2 / ${questionCount}`)).toBeVisible();
});

test("scenario 4: a wrong answer is visible in review count", async ({ page }) => {
  await page.goto("/");
  await page.locator("label.option").nth(1).click();
  await page.getByRole("button", { name: "Trả lời" }).click();
  await expect(page.getByText("Chưa đúng lần này")).toBeVisible();
  await expect(reviewButton(page)).toContainText("1");
});

test("scenario 5: wrong progress survives a refresh", async ({ page }) => {
  await page.goto("/");
  await page.locator("label.option").nth(1).click();
  await page.getByRole("button", { name: "Trả lời" }).click();
  await page.reload();
  await expect(reviewButton(page)).toContainText("1");
  await reviewButton(page).click();
  await expect(page.getByText("Câu hỏi 1 / 1")).toBeVisible();
});

test("scenario 6: wrong answer remains after another wrong review attempt", async ({ page }) => {
  await page.goto("/");
  await page.locator("label.option").nth(1).click();
  await page.getByRole("button", { name: "Trả lời" }).click();
  await reviewButton(page).click();
  await page.locator("label.option").nth(1).click();
  await page.getByRole("button", { name: "Trả lời" }).click();
  await page.getByRole("button", { name: "Câu tiếp theo" }).click();
  await expect(reviewButton(page)).toContainText("1");
  await expect(page.getByRole("heading", { name: "Câu cần ôn" })).toBeVisible();
});

test("scenario 7: a correct review answer clears the queue", async ({ page }) => {
  await page.goto("/");
  await page.locator("label.option").nth(1).click();
  await page.getByRole("button", { name: "Trả lời" }).click();
  await reviewButton(page).click();
  await page.locator("label.option").nth(0).click();
  await page.getByRole("button", { name: "Trả lời" }).click();
  await page.getByRole("button", { name: "Câu tiếp theo" }).click();
  await expect(page.getByText("Bạn không còn câu nào cần ôn")).toBeVisible();
  await expect(reviewButton(page)).toContainText("0");
});

test("scenario 8: the source reference is visible with each question", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Nguồn: trang 4 · câu 1")).toBeVisible();
});

test("scenario 9: keyboard can select and submit", async ({ page }) => {
  await page.goto("/");
  const firstRadio = page.getByRole("radio").first();
  await firstRadio.focus();
  await firstRadio.press("Space");
  await page.getByRole("button", { name: "Trả lời" }).press("Enter");
  await expect(page.getByText("Câu trả lời đúng")).toBeVisible();
});

test("scenario 10: answering all questions reaches the summary", async ({ page }) => {
  test.setTimeout(120_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  for (const [index, optionIndex] of correctIndexes.entries()) {
    await page.locator("label.option").nth(optionIndex).click();
    await page.getByRole("button", { name: "Trả lời" }).click();
    if (index < correctIndexes.length - 1) await page.getByRole("button", { name: "Câu tiếp theo" }).click();
  }
  await page.getByRole("button", { name: "Câu tiếp theo" }).click();
  await expect(page.getByText("Bạn đã hoàn thành lượt câu hỏi")).toBeVisible();
});

test("scenario 11: wrong review answers rotate to the next queued question", async ({ page }) => {
  await page.goto("/");
  await page.locator("label.option").nth(1).click();
  await page.getByRole("button", { name: "Trả lời" }).click();
  await page.getByRole("button", { name: "Câu tiếp theo" }).click();
  await page.locator("label.option").nth(0).click();
  await page.getByRole("button", { name: "Trả lời" }).click();
  await page.getByRole("button", { name: /Câu cần ôn|Cần ôn/ }).filter({ visible: true }).click();
  await expect(page.getByText("Câu hỏi 1 / 2")).toBeVisible();
  await page.locator("label.option").nth(1).click();
  await page.getByRole("button", { name: "Trả lời" }).click();
  await page.getByRole("button", { name: "Câu tiếp theo" }).click();
  await expect(page.getByText("Nguồn: trang 4 · câu 2")).toBeVisible();
  await page.locator("label.option").nth(0).click();
  await page.getByRole("button", { name: "Trả lời" }).click();
  await page.getByRole("button", { name: "Câu tiếp theo" }).click();
  await expect(page.getByText("Câu hỏi 1 / 2")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Một trong những giải pháp phòng chống/ })).toBeVisible();
});

test("scenario 12: reset progress requires confirmation and clears the review badge", async ({ page }) => {
  await page.goto("/");
  await page.locator("label.option").nth(1).click();
  await page.getByRole("button", { name: "Trả lời" }).click();
  await expect(reviewButton(page)).toContainText("1");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Xóa tiến độ" }).click();
  await expect(reviewButton(page)).toContainText("0");
  await expect(page.getByRole("heading", { name: "Tất cả câu hỏi" })).toBeVisible();
});

test("scenario 13: required viewports do not introduce horizontal overflow", async ({ page }) => {
  await page.goto("/");
  const metrics = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    content: document.documentElement.scrollWidth,
  }));
  expect(metrics.content).toBeLessThanOrEqual(metrics.viewport + 1);
});

test("scenario 14: page-break question renders its verified continuation", async ({ page }) => {
  await page.goto("/");
  for (const optionIndex of correctIndexes.slice(0, 6)) {
    await page.locator("label.option").nth(optionIndex).click();
    await page.getByRole("button", { name: "Trả lời" }).click();
    await page.getByRole("button", { name: "Câu tiếp theo" }).click();
  }
  await expect(page.getByRole("heading", { name: "Chủ nghĩa đế quốc coi chiến lược" })).toBeVisible();
  await expect(page.getByText("Nguồn: trang 4 · câu 7")).toBeVisible();
  await page.locator("label.option").filter({ hasText: "Là chiến lược cơ bản" }).click();
  await page.getByRole("button", { name: "Trả lời" }).click();
  await expect(page.getByText("Câu trả lời đúng")).toBeVisible();
});
