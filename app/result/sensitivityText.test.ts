/**
 * 感度文（設計レビュー #6・UX レビュー #3）。判定が動かない理由を、実際の過不足の判定（過不足軸）から言う。
 */
import { describe, expect, it } from "vitest";
import type { SurvivorIncomeSensitivity } from "../../src/calc/sensitivity.js";
import { survivorIncomeSensitivity } from "../../src/calc/sensitivity.js";
import { loadParams } from "../../src/params/index.js";
import { toCompleteSelections } from "../../src/wizard/complete.js";
import { resultInputs } from "../../src/wizard/resultInputs.js";
import { decodeSelections } from "../../src/wizard/url.js";
import { sensitivityText } from "./sensitivityText.js";

const MAN = 10_000;
const base: SurvivorIncomeSensitivity = {
  branch: "no_verdict_change",
  verdictNow: "reducible",
  verdictAtHalf: "reducible",
  verdictAtZero: "reducible",
  workTotal: 4800 * MAN,
  annualGross: 400 * MAN,
  annualNet: 320 * MAN,
  halfNet: 160 * MAN,
  netAfter: 320 * MAN,
  yearsDependent: 15,
  yearsAlone: 0,
  yearsTotal: 15,
  workEndAge: 60,
  needNow: { low: 200 * MAN, high: 200 * MAN },
  needAtHalf: { low: 200 * MAN, high: 200 * MAN },
  needAtZero: { low: 2100 * MAN, high: 3200 * MAN },
};

describe("判定が動かないときの理由", () => {
  it("減らせる可能性のまま：保障が上回ると言ってよい", () => {
    expect(sensitivityText(base, "self")).toContain("いまの保障がそれでも上回るため");
  });
  it("不足の可能性のまま：「上回る」と言わない", () => {
    const t = sensitivityText(
      { ...base, verdictNow: "shortage", verdictAtHalf: "shortage", verdictAtZero: "shortage" },
      "spouse",
    );
    expect(t).not.toContain("上回る");
    expect(t).toContain("過不足の判定は「不足の可能性」のままです。");
    expect(t).toContain("約2,100〜3,200万円に増えます");
  });
  it("保留のまま：保障が分からないと言う", () => {
    const t = sensitivityText(
      { ...base, verdictNow: "pending", verdictAtHalf: "pending", verdictAtZero: "pending" },
      "self",
    );
    expect(t).toContain("いまの保障が分からないため");
    expect(t).not.toContain("上回る");
  });
  it("必要額が動かないなら「増えます」と言わない", () => {
    const t = sensitivityText({ ...base, needAtZero: base.needNow }, "self");
    expect(t).not.toContain("増えます");
    expect(t).toContain("のままです");
  });
});

describe("実世帯：組み替え世帯の配偶者カード（保障0・不足）", () => {
  it("「いまの保障が上回る」と言わない", () => {
    const P = loadParams("2026-08");
    const asOf = new Date("2026-10-17T12:00:00+09:00");
    const complete = toCompleteSelections(
      decodeSelections(
        "v=1&sb=1989&emp=employee&sp=1&spb=1991&spe=employee&ch=2024&edu=public&inc=lt600&sinc=lt400&as=lt500&liv=lt30&ho=own_loan&loan=lt3000&dan=yes&cvs=m2000&cvsp=none",
      ),
    );
    if (!complete) throw new Error("入力が足りない");
    const ri = resultInputs(P, complete, "asis", asOf);
    const sv = survivorIncomeSensitivity(P, ri.input, "spouse", asOf, ri.bands);
    if (!sv) throw new Error("感度が出ない");
    expect(sv.verdictNow).toBe("shortage");
    expect(sensitivityText(sv, "spouse")).not.toContain("上回る");
  });
});
