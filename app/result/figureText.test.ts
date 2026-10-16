/**
 * 結果画面の金額の文（UX レビュー #1・#5）。金額は `resultFigures` から来たものだけを使う。
 * 軸名：ここの判定は過不足の判定（過不足軸）。
 */
import { describe, expect, it } from "vitest";
import { resultFigures } from "../../src/calc/figures.js";
import { formatRange } from "../../src/design/tokens.js";
import { loadParams } from "../../src/params/index.js";
import { toCompleteSelections } from "../../src/wizard/complete.js";
import { resultInputs } from "../../src/wizard/resultInputs.js";
import { decodeSelections } from "../../src/wizard/url.js";
import {
  bandWidenedNote,
  gapSentence,
  heroBreakdownNote,
  heroCoverageText,
  heroDiffText,
  heroNeedQualifier,
  heroTotalLabel,
  partialNote,
  rebalanceNote,
} from "./figureText.js";

const P = loadParams("2026-08");
const AS_OF = new Date("2026-10-17T12:00:00+09:00");

function figuresOf(query: string) {
  const complete = toCompleteSelections(decodeSelections(query));
  if (!complete) throw new Error("入力が足りない");
  const ri = resultInputs(P, complete, "asis", AS_OF);
  return resultFigures(P, ri.input, ri.bands, AS_OF);
}

const SHORT =
  "v=1&sb=1986&emp=self&sp=1&spb=1988&spe=none&ch=2018-2021&edu=private&inc=lt400&sinc=none&as=lt100&liv=lt35&ho=rent&cvs=none&cvsp=none";
const REBALANCE =
  "v=1&sb=1989&emp=employee&sp=1&spb=1991&spe=employee&ch=2024&edu=public&inc=lt600&sinc=lt400&as=lt500&liv=lt30&ho=own_loan&loan=lt3000&dan=yes&cvs=m2000&cvsp=none";
const SINGLE = "v=1&sb=1996&emp=employee&sp=0&ch=&inc=lt600&as=lt500&liv=lt25&ho=rent&cvs=m1000";

describe("不足世帯：ヒーローの金額は2人分の合計だと名乗り、内訳がカードと同じ", () => {
  const f = figuresOf(SHORT);
  it("見出しの差額は不足額の幅（1点ではない）", () => {
    expect(heroDiffText(f)).toBe(
      formatRange(f.household.shortageRange.low, f.household.shortageRange.high),
    );
    expect(heroDiffText(f)).toContain("〜");
  });
  it("内訳の1行に、本人分（カードと同じ幅）と配偶者分が出る", () => {
    const note = heroBreakdownNote(f) ?? "";
    expect(note).toContain("あなたと配偶者の分を足した額");
    expect(note).toContain(`あなたに万一のとき ${formatRange(f.self.need.low, f.self.need.high)}`);
    expect(heroTotalLabel(f)).toBe("2人分の合計");
  });
  it("本人カードの差の文は、最終の必要額との差（保障0なので必要額そのもの）", () => {
    expect(gapSentence(f.self)).toBe(
      `いまの保障より、${formatRange(f.self.need.low, f.self.need.high)} 足りていません。`,
    );
  });
  it("STEP3 の最終行が代表値より広いなら、その旨と代表値の幅を言う", () => {
    const note = bandWidenedNote(f.self) ?? "";
    expect(note).toContain(formatRange(f.self.point.range.low, f.self.point.range.high));
  });
});

describe("組み替え世帯：減らせる額も不足額も幅で、不足している側を名指す", () => {
  const f = figuresOf(REBALANCE);
  it("世帯は組み替えの余地", () => {
    expect(f.household.verdict).toBe("rebalanceable");
  });
  it("添える1行は両方とも householdSummary の幅", () => {
    expect(rebalanceNote(f)).toBe(
      `${formatRange(f.household.reducibleRange.low, f.household.reducibleRange.high)}は減らせる一方、配偶者の保障に${formatRange(f.household.shortageRange.low, f.household.shortageRange.high)}足りません。`,
    );
  });
  it("差額は片方ずつ別の向きなので、合計の内訳文は出さない", () => {
    expect(heroBreakdownNote(f)).toBeNull();
  });
});

describe("圏内は「足りています」と言わない", () => {
  it("uncertain の文", () => {
    const f = figuresOf(SINGLE);
    const fake = {
      ...f.self,
      verdict: "uncertain" as const,
      gap: { kind: "none" as const, low: 0, high: 0 },
    };
    expect(gapSentence(fake)).not.toContain("足りています");
    expect(gapSentence(fake)).toContain("言い切りません");
  });
  it("単身では合計の呼び名を付けない", () => {
    expect(heroTotalLabel(figuresOf(SINGLE))).toBeNull();
  });
});

describe("保険内容が分からない人がいるとき、世帯の結論を両方見たように言わない（設計レビュー #3）", () => {
  const base = figuresOf(REBALANCE);
  it("配偶者が分からない：本人の分だけで出していると書き、保障は「一部未入力」", () => {
    const f = {
      ...base,
      household: { ...base.household, pendingCount: 1, totalCoverage: null },
      spouse: base.spouse ? { ...base.spouse, verdict: "pending" as const, coverage: null } : null,
    };
    expect(partialNote(f)).toBe(
      "配偶者の保険内容が分からないため、この結論はあなたの分だけで出しています。配偶者の分の過不足は、まだ出していません。",
    );
    expect(heroCoverageText(f)).toBe("一部未入力");
  });
  it("全員わかっていれば何も足さない", () => {
    expect(partialNote(base)).toBeNull();
    expect(heroCoverageText(base)).toContain("約");
  });
});

describe("1点の必要額は、何の額かを名乗る（UX レビュー #5）", () => {
  it("単身：葬儀・予備費の定額", () => {
    const f = figuresOf(SINGLE);
    expect(f.household.totalNeed.low).toBe(f.household.totalNeed.high);
    expect(heroNeedQualifier(f)).toBe("（葬儀・予備費の定額）");
  });
  it("幅がある世帯は（幅）", () => {
    expect(heroNeedQualifier(figuresOf(SHORT))).toBe("（幅）");
  });
});
