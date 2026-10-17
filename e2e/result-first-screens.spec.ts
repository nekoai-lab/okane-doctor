/**
 * 結果画面の最初の2画面（2026-10-17・最初の2画面の作り直し）。
 *
 * 初期表示（約2画面＝844×2）に、結論（人ごとの行）・次の一歩・決定的な前提1点が入っていること、
 * 不足額を2人分の合計で出していないことを、代表3世帯で固定する。
 * 軸名：ここで見るバッジは過不足の判定（過不足軸）。
 */
import { expect, test } from "@playwright/test";

const TWO_SCREENS = 844 * 2;

const HOUSEHOLDS = [
  {
    name: "組み替えの余地",
    query:
      "v=1&sb=1989&emp=employee&sp=1&spb=1991&spe=employee&ch=2024&edu=public&inc=lt600&sinc=lt400&as=lt500&liv=lt30&ho=own_loan&loan=lt3000&dan=yes&cvs=m2000&cvsp=none",
    people: ["self", "spouse"],
  },
  {
    name: "不足",
    query:
      "v=1&sb=1986&emp=self&sp=1&spb=1988&spe=none&ch=2018-2021&edu=private&inc=lt400&sinc=none&as=lt100&liv=lt35&ho=rent&cvs=none&cvsp=none",
    people: ["self", "spouse"],
  },
  {
    name: "単身",
    query: "v=1&sb=1996&emp=employee&sp=0&ch=&inc=lt600&as=lt500&liv=lt25&ho=rent&cvs=m1000",
    people: ["self"],
  },
];

for (const h of HOUSEHOLDS) {
  test(`${h.name}：最初の2画面に、人ごとの行・次の一歩・前提1点がある`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/result?${h.query}`);
    const top = async (selector: string) =>
      page.locator(selector).first().evaluate((el) => el.getBoundingClientRect().top + scrollY);

    const rows = page.locator("[data-person]");
    await expect(rows).toHaveCount(h.people.length);
    expect(await rows.evaluateAll((els) => els.map((e) => e.getAttribute("data-person")))).toEqual(
      h.people,
    );
    for (let i = 0; i < h.people.length; i++) {
      // 人ごとの行に軸名つきのバッジがある
      await expect(rows.nth(i)).toContainText("過不足の判定");
    }
    expect(await top("[data-person]:last-of-type")).toBeLessThan(TWO_SCREENS);
    expect(await top("#next-step")).toBeLessThan(TWO_SCREENS);
    expect(await top("#key-premise")).toBeLessThan(TWO_SCREENS);

    // 2人分の合計という呼び名を初期表示に出さない
    await expect(page.locator("section").first()).not.toContainText("2人分");
  });
}
