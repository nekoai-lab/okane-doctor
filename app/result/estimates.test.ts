/**
 * 当社基準の見立てを回答と取り違えさせない（UX レビュー #4）。
 */
import { describe, expect, it } from "vitest";
import { resultFigures } from "../../src/calc/figures.js";
import { loadParams } from "../../src/params/index.js";
import { toCompleteSelections } from "../../src/wizard/complete.js";
import { resultInputs } from "../../src/wizard/resultInputs.js";
import { decodeSelections } from "../../src/wizard/url.js";
import { ownStandardEstimates, workDeductionSource } from "./estimates.js";

const P = loadParams("2026-08");
const AS_OF = new Date("2026-10-17T12:00:00+09:00");

function figuresOf(query: string) {
  const complete = toCompleteSelections(decodeSelections(query));
  if (!complete) throw new Error("入力が足りない");
  const ri = resultInputs(P, complete, "asis", AS_OF);
  return resultFigures(P, ri.input, ri.bands, AS_OF);
}

describe("不足世帯（配偶者は無職・年収0円）", () => {
  const f = figuresOf(
    "v=1&sb=1986&emp=self&sp=1&spb=1988&spe=none&ch=2018-2021&edu=private&inc=lt400&sinc=none&as=lt100&liv=lt35&ho=rent&cvs=none&cvsp=none",
  );
  it("就労収入が入っている（当社基準の見立て）", () => {
    expect(f.self.point.income.survivorWork).toBeGreaterThan(0);
  });
  it("滝の就労収入の出どころは「回答」ではなく「当社基準」", () => {
    const src = workDeductionSource(f.self.point, "配偶者");
    expect(src.fromLabel).toBe("当社基準");
    expect(src.from).toContain("答えた年収は0円");
  });
  it("STEP1 の推定で補った項目に入る（「ありません」と言わせない）", () => {
    const e = ownStandardEstimates(f.self.point, "配偶者");
    expect(e).toHaveLength(1);
    expect(e[0].label).toBe("配偶者の就労収入（当社基準の見立て）");
    expect(e[0].note).toContain("当社基準");
  });
});

describe("年収を答えた世帯", () => {
  const f = figuresOf(
    "v=1&sb=1989&emp=employee&sp=1&spb=1991&spe=employee&ch=2024&edu=public&inc=lt600&sinc=lt400&as=lt500&liv=lt30&ho=own_loan&loan=lt3000&dan=yes&cvs=m2000&cvsp=none",
  );
  it("出どころは回答で、主語は遺される側（配偶者が亡くなるケースでは「あなたの年収」）", () => {
    expect(workDeductionSource(f.self.point, "配偶者")).toEqual({
      fromLabel: "回答",
      from: "配偶者の年収",
    });
    const sp = f.spouse;
    if (!sp) throw new Error("配偶者のケースが無い");
    expect(workDeductionSource(sp.point, "あなた").from).toBe("あなたの年収");
  });
  it("当社基準の推定は足さない", () => {
    expect(ownStandardEstimates(f.self.point, "配偶者")).toEqual([]);
  });
});
