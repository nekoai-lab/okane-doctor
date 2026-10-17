import { expect, type Page, test } from "@playwright/test";

/**
 * もしもラボの文言の床（2026-10-18 文言の整理・design/LAB_COPY.md）。
 * UX レビューの直しで文を足すたびに膨らむのを、数で止める。
 *
 * - 同じ金額は、見えている文字の中で1回だけ（開いた中で閉じた行の金額を繰り返さない）
 * - 「次の一歩」はページに1つ
 * - 何もできない状態表示（「準備中」「ありません」）を出さない
 * - カード1枚の見えている文字数に上限（閉じた折りたたみの中は数えない）
 *
 * 世帯は design/screenshots/lab-fintech-* と同じ代表3世帯。金額の正しさは src/calc/lab.test.ts が持つ。
 */
const HOUSEHOLDS = {
  rebalance:
    "v=1&sb=1989&emp=employee&sp=1&spb=1991&spe=employee&ch=2024&edu=public&inc=lt600&sinc=lt400&as=lt500&liv=lt30&ho=own_loan&loan=lt3000&dan=yes&cvs=m2000&cvsp=none",
  shortage:
    "v=1&sb=1986&emp=self&sp=1&spb=1988&spe=none&ch=2018-2021&edu=private&inc=lt400&sinc=none&as=lt100&liv=lt35&ho=rent&cvs=none&cvsp=none",
  single: "v=1&sb=1996&emp=employee&sp=0&ch=&inc=lt600&as=lt500&liv=lt25&ho=rent&cvs=m1000",
};

/** カード1枚の見えている文字数の上限（空白を除く）。2026-10-18 の整理後の最大 + 1割ほど */
const CARD_CHAR_LIMIT = 370;

/** 見えている文字だけ（閉じた details の中・ボタン・図は除く）をカードごとに返す */
async function visibleTexts(page: Page) {
  return page.evaluate(() => {
    const visible = (root: Element) => {
      const out: string[] = [];
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const el = n.parentElement;
        if (!el || el.closest("button, svg, [aria-hidden='true']")) continue;
        if (!el.checkVisibility()) continue;
        out.push(n.textContent ?? "");
      }
      return out.join("");
    };
    const main = document.querySelector("main");
    if (!main) throw new Error("main が無い");
    return {
      page: visible(main),
      cards: [...main.querySelectorAll("section, footer")].map((c) => ({
        title: c.querySelector("h2")?.textContent ?? "(見出しなし)",
        text: visible(c),
      })),
    };
  });
}

for (const [name, query] of Object.entries(HOUSEHOLDS)) {
  test(`もしもラボの文言の床（${name}）`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/lab?${query}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("もしもラボ");
    const { page: text, cards } = await visibleTexts(page);

    const amounts = text.match(/約[\d,億]+(?:万)?(?:〜[\d,億]+)?万円/g) ?? [];
    const repeated = [...new Set(amounts.filter((a, i) => amounts.indexOf(a) !== i))];
    expect(repeated, `同じ金額が2回以上見えている（${name}）`).toEqual([]);

    expect(text.split("次の一歩").length - 1, `「次の一歩」の数（${name}）`).toBe(1);
    expect(text).not.toContain("準備中");
    expect(text).not.toMatch(/ありません。$/m);

    for (const c of cards) {
      const n = c.text.replace(/\s/g, "").length;
      console.log(`${name}｜${c.title}｜${n}字`);
      expect(n, `カード「${c.title}」の文字数（${name}）`).toBeLessThanOrEqual(CARD_CHAR_LIMIT);
    }
  });
}
