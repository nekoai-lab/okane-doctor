/**
 * 結果画面の「最終の金額と判定」が1組であること（2026-10-17・UX／設計レビュー #1）。
 *
 * 軸名（CLAUDE.md）：ここで扱う判定はすべて**過不足の判定（過不足軸・`Verdict3`）**。
 */
import { describe, expect, it } from "vitest";
import { GOLDEN } from "../__tests__/households.js";
import { loadParams } from "../params/index.js";
import { toCompleteSelections } from "../wizard/complete.js";
import { resultInputs } from "../wizard/resultInputs.js";
import { decodeSelections } from "../wizard/url.js";
import { envelope } from "./envelope.js";
import { resultFigures } from "./figures.js";
import { diagnose } from "./index.js";
import { verdict3 } from "./verdict3.js";

const P = loadParams("2026-08");
const AS_OF = new Date("2026-10-17T12:00:00+09:00");
const MAN = 10_000;

function fromQuery(query: string) {
  const complete = toCompleteSelections(decodeSelections(query));
  if (!complete) throw new Error("入力が足りない");
  const ri = resultInputs(P, complete, "asis", AS_OF);
  return { ri, f: resultFigures(P, ri.input, ri.bands, AS_OF) };
}

/** コーディネーター指摘の世帯：代表値 400〜700万・回答の幅 200〜2,000万・本人の保障 1,000万 */
const WIDE =
  "v=1&sb=1988&emp=employee&sp=1&spb=1990&spe=employee&ch=2021-2024&edu=public&inc=lt600&sinc=lt400&as=lt300&liv=lt30&ho=rent&cvs=m1000&cvsp=m300";
/** 視覚の DoD の「不足」世帯 */
const SHORT =
  "v=1&sb=1986&emp=self&sp=1&spb=1988&spe=none&ch=2018-2021&edu=private&inc=lt400&sinc=none&as=lt100&liv=lt35&ho=rent&cvs=none&cvsp=none";

describe("最終の必要額は回答の幅を包絡したレンジで、判定もそこから出す", () => {
  it("回帰：代表値では減らせるが、回答の幅では圏内の世帯で、冒頭も「圏内・要精査」になる", () => {
    const { f } = fromQuery(WIDE);
    // 前提の確認（この世帯がまだ被験体であること）：代表値と幅でレンジが違う
    expect(f.self.point.range).toEqual({ low: 400 * MAN, high: 700 * MAN });
    expect(f.self.need).toEqual({ low: 200 * MAN, high: 2000 * MAN });
    // 診断表と同じ判定（保障1,000万は幅の中）
    expect(f.self.verdict).toBe("uncertain");
    // 冒頭の世帯判定も同じ幅から：減らせるとは言わない
    expect(f.household.verdict).toBe("uncertain");
    expect(f.household.totalNeed.low).toBe(f.self.need.low + (f.spouse?.need.low ?? 0));
    expect(f.household.totalNeed.high).toBe(f.self.need.high + (f.spouse?.need.high ?? 0));
    // よみときに渡す形も同じ結論
    expect(f.diagnosis.householdHeadline.kind).toBe("uncertain");
    expect(f.diagnosis.self.range).toEqual(f.self.need);
    expect(f.diagnosis.self.gap.kind).toBe("adequate");
    // 減らせる額は、減らせる判定の人（配偶者）の分だけ
    expect(f.spouse?.verdict).toBe("reducible");
    expect(f.household.totalReducible).toBe(f.spouse?.gap.low);
  });

  it("不足世帯：ヒーロー・カード・STEP3/4 が同じ本人のレンジを読む", () => {
    const { ri, f } = fromQuery(SHORT);
    const env = envelope(P, ri.bands, AS_OF, "self");
    expect(f.self.need).toEqual({ low: env.low, high: env.high });
    expect(f.self.verdict).toBe("shortage");
    // 保障0なので不足額＝必要額
    expect(f.self.gap).toEqual({ kind: "shortage", low: env.low, high: env.high });
    // 世帯の不足は2人分の和で、下端は既存の totalShortage と同じ
    const sp = f.spouse;
    if (!sp) throw new Error("配偶者のケースが無い");
    expect(f.household.shortageRange).toEqual({
      low: f.self.gap.low + sp.gap.low,
      high: f.self.gap.high + sp.gap.high,
    });
    expect(f.household.totalShortage).toBe(f.household.shortageRange.low);
    expect(f.diagnosis.self.range).toEqual(f.self.need);
  });

  it("内訳（支出・収入・年数）は代表値のまま書き戻す", () => {
    const { ri, f } = fromQuery(SHORT);
    const d = diagnose(P, ri.input, AS_OF);
    expect(f.diagnosis.self.expense).toEqual(d.self.expense);
    expect(f.diagnosis.self.income).toEqual(d.self.income);
    expect(f.diagnosis.self.verdict).toBe(d.self.verdict);
  });
});

describe("幅を渡さない経路では代表値と同じ（既存の算定を動かさない）", () => {
  for (const g of GOLDEN) {
    it(`${g.id}：bands=null なら必要額は diagnose のレンジ、判定は verdict3`, () => {
      const f = resultFigures(P, g.input, null, AS_OF);
      const d = diagnose(P, g.input, AS_OF);
      expect(f.self.need).toEqual(d.self.range);
      expect(f.self.verdict).toBe(
        verdict3(g.input.coverageSelf, d.self.range.low, d.self.range.high),
      );
    });
  }
});
