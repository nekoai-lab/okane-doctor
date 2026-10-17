import { expect, test } from "@playwright/test";
import { RUSHING_WORDS, SELF_PRAISE_WORDS } from "../src/narrate/guard.js";

/**
 * トップページ（LP・2026-10-17 最終承認版）：試算例は幅で出し、「中心目安」を言わない。
 * 入口が /wizard、試算例の結果画面、もしもラボに通じる。どの幅でも横スクロールが出ない。
 * 金額そのものの正しさは src/calc/topExample.test.ts が持つ（ここでは形だけ見る）。
 */
const WIDTHS = [320, 375, 390, 430, 1280];

for (const width of WIDTHS) {
  test(`トップは ${width}px で横スクロールが出ない`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth, `横スクロールが出ている（/・${width}px）`).toBeLessThanOrEqual(
      clientWidth + 1,
    );
  });
}

test("試算例は幅で出し、過不足の判定に軸名を添える", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("大丈夫");
  await expect(page.getByText("中心目安")).toHaveCount(0);
  await expect(page.getByText(/約[\d,]+〜[\d,]+万円/).first()).toBeVisible();
  await expect(page.getByText("過不足の判定").first()).toBeVisible();
});

test("急かす語と品質の自称を使わない", async ({ page }) => {
  await page.goto("/");
  const text = await page.locator("main").innerText();
  for (const w of [...RUSHING_WORDS, ...SELF_PRAISE_WORDS]) expect(text).not.toContain(w);
});

test("入口は診断・試算例の結果画面・もしもラボに通じる", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "診断結果の例を見る" })).toHaveAttribute(
    "href",
    /^\/result\?v=1&/,
  );
  await expect(page.getByRole("link", { name: /試算例でもしもラボを見る/ })).toHaveAttribute(
    "href",
    /^\/lab\?v=1&/,
  );
  await page.getByRole("link", { name: /約10問で診断する/ }).first().click();
  await expect(page).toHaveURL(/\/wizard/);
});
