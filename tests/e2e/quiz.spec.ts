import { expect, test } from "@playwright/test";

test("wrong answers persist and can be cleared in review mode", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Tất cả câu hỏi" })).toBeVisible();
  await page.locator("label.option").filter({ hasText: "Nâng cao sự nghiệp công nghiệp hóa" }).click();
  await page.getByRole("button", { name: "Trả lời" }).click();
  await expect(page.getByText("Chưa đúng lần này")).toBeVisible();
  const reviewButton = page.locator("button").filter({ hasText: /Câu cần ôn|Cần ôn/, visible: true });
  await expect(reviewButton).toContainText("1");
  await reviewButton.click();
  await expect(page.getByRole("heading", { name: "Câu cần ôn" })).toBeVisible();
  await page.locator("label.option").filter({ hasText: "Đẩy lùi tệ quan liêu" }).click();
  await page.getByRole("button", { name: "Trả lời" }).click();
  await expect(page.getByText("Câu trả lời đúng")).toBeVisible();
});

test("review empty state survives a fresh page", async ({ page }) => {
  await page.goto("/");
  await page.locator("button").filter({ hasText: /Câu cần ôn|Cần ôn/ , visible: true }).click();
  await expect(page.getByText("Bạn không còn câu nào cần ôn")).toBeVisible();
});
