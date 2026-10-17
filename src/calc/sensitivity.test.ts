/**
 * 感度の分岐（仕様 §5.3 T-E）の検査
 *
 * **「実データでたまたま出た分岐」で確かめない。** 期待する判定遷移を先に決め、
 * それが出る入力を合成して3分岐それぞれを固定する。
 *
 * 合成の作り方：**同じ世帯の現保障（coverage）だけを動かす。**
 * 必要額のほうは就労収入で動くので、保障を3か所に置けば3分岐が作れる。
 * `docs/算定テスト_10世帯.xlsx` には足さない（正本は実在的世帯のまま・ADR-021）。
 *
 * **軸の取り違えを二度とやらないために、判定は `Verdict3` で固定する。**
 * `DeathResult.verdict`（`ample` / `shortage`）はニーズ軸で、カードのバッジとは別物。
 */
import { describe, expect, it } from "vitest";
import { loadParams } from "../params/index.js";
import { GOLDEN } from "../__tests__/households.js";
import { toCompleteSelections } from "../wizard/complete.js";
import { resultInputs } from "../wizard/resultInputs.js";
import { decodeSelections } from "../wizard/url.js";
import { resultFigures } from "./figures.js";
import { diagnose } from "./index.js";
import { pickBranch, survivorIncomeSensitivity } from "./sensitivity.js";

const P = loadParams("2026-08");
const AS_OF = new Date("2026-08-01T00:00:00+09:00");
const man = (n: number) => n * 10_000;

/** 配偶者あり・子ありの世帯を土台にする（遺族の就労収入が効く形） */
const BASE = GOLDEN.find((g) => g.input.spouse && g.input.spouse.income > 0)!.input;

describe("pickBranch：3つの判定から分岐を選ぶ", () => {
  it("どちらでも変わらなければ no_verdict_change", () => {
    expect(pickBranch("reducible", "reducible", "reducible")).toBe("no_verdict_change");
  });

  it("半額で変わらず、ゼロで変われば zero_only", () => {
    expect(pickBranch("reducible", "reducible", "shortage")).toBe("zero_only");
  });

  it("半額から変われば both_change", () => {
    expect(pickBranch("reducible", "uncertain", "shortage")).toBe("both_change");
  });

  it("**言い過ぎない側に倒す。** 半額で動いてゼロで戻る形も both_change にする", () => {
    // 単調なので現実には起きないが、起きたときに「変わりません」と言わせない
    expect(pickBranch("reducible", "shortage", "reducible")).toBe("both_change");
  });
});

describe("survivorIncomeSensitivity：合成入力で3分岐を固定する", () => {
  /** 就労収入を動かしたときの必要額。ここを土台に coverage を置く */
  const needs = (() => {
    const s = survivorIncomeSensitivity(P, { ...BASE, coverageSelf: 0 }, "self", AS_OF)!;
    return { now: s.needNow, half: s.needAtHalf, zero: s.needAtZero };
  })();

  it("土台の確認：収入を減らすほど必要額は増える（分岐を作る前提）", () => {
    expect(needs.half.high).toBeGreaterThan(needs.now.high);
    expect(needs.zero.high).toBeGreaterThan(needs.half.high);
  });

  it("保障が最も厳しい前提すら上回るなら no_verdict_change", () => {
    // ゼロにしたときの上端より上に保障を置く → どの前提でも reducible
    const coverageSelf = needs.zero.high + man(1000);
    const s = survivorIncomeSensitivity(P, { ...BASE, coverageSelf }, "self", AS_OF)!;
    expect([s.verdictNow, s.verdictAtHalf, s.verdictAtZero]).toEqual([
      "reducible",
      "reducible",
      "reducible",
    ]);
    expect(s.branch).toBe("no_verdict_change");
  });

  it("半額の上端は超えるが、ゼロの下端に届かないなら zero_only", () => {
    const coverageSelf = Math.round((needs.half.high + needs.zero.low) / 2);
    const s = survivorIncomeSensitivity(P, { ...BASE, coverageSelf }, "self", AS_OF)!;
    expect(s.verdictNow).toBe("reducible");
    expect(s.verdictAtHalf).toBe("reducible");
    expect(s.verdictAtZero).toBe("shortage");
    expect(s.branch).toBe("zero_only");
  });

  it("半額のレンジに跨り、ゼロでは届かないなら both_change", () => {
    const coverageSelf = Math.round((needs.half.low + needs.half.high) / 2);
    const s = survivorIncomeSensitivity(P, { ...BASE, coverageSelf }, "self", AS_OF)!;
    expect(s.verdictNow).toBe("reducible");
    expect(s.verdictAtHalf).toBe("uncertain");
    expect(s.verdictAtZero).toBe("shortage");
    expect(s.branch).toBe("both_change");
  });

  it("遺族の収入が元から0なら測らない（動かす余地が無い）", () => {
    const input = { ...BASE, spouse: { ...BASE.spouse!, income: 0 } };
    expect(survivorIncomeSensitivity(P, input, "self", AS_OF)).toBeNull();
  });

  /**
   * **括弧の掛け算が合うこと。** 審査員は検算する。
   * 額面と手取りが同じ文に混ざると `700万円 × 25年 = 1億4,000万円` のような
   * 合わない式が出る（実際に出た・2026-09-21）。
   */
  it("手取り × 年数 が就労収入の合計に一致する（床が効かない世帯）", () => {
    const s = survivorIncomeSensitivity(P, BASE, "self", AS_OF)!;
    if (s.annualNet !== s.netAfter) return; // 床が効く世帯は2本立ての表記にする
    expect(Math.round(s.annualNet * s.yearsTotal)).toBe(Math.round(s.workTotal));
  });

  it("床が効く世帯でも、子育て期と独立後を足せば合計に一致する", () => {
    // 手取りが下限（年100万円）を下回る低収入の遺族を合成する
    const input = { ...BASE, spouse: { ...BASE.spouse!, income: man(50) } };
    const s = survivorIncomeSensitivity(P, input, "self", AS_OF)!;
    expect(s.netAfter).toBeGreaterThan(s.annualNet);
    expect(Math.round(s.annualNet * s.yearsDependent + s.netAfter * s.yearsAlone)).toBe(
      Math.round(s.workTotal),
    );
  });
});

describe("感度は、カードと同じ暮らし方の目盛り・同じ回答の幅で測る（設計レビュー #5）", () => {
  const AS_OF_1017 = new Date("2026-10-17T12:00:00+09:00");
  const fromQuery = (query: string, level: "tight" | "asis" | "roomy") => {
    const complete = toCompleteSelections(decodeSelections(query));
    if (!complete) throw new Error("入力が足りない");
    return resultInputs(P, complete, level, AS_OF_1017);
  };
  const REBALANCE =
    "v=1&sb=1989&emp=employee&sp=1&spb=1991&spe=employee&ch=2024&edu=public&inc=lt600&sinc=lt400&as=lt500&liv=lt30&ho=own_loan&loan=lt3000&dan=yes&cvs=m2000&cvsp=none";

  it("目盛りを付けた入力では、その目盛りで回した必要額を返す（いま通りで上書きしない）", () => {
    const input = { ...BASE, coverageSelf: 0, lifestyleDial: 1.1 };
    const s = survivorIncomeSensitivity(P, input, "self", AS_OF);
    if (!s || !input.spouse) throw new Error("感度が出ない");
    const zero = { ...input, spouse: { ...input.spouse, income: 0 } };
    // 働けない場合（生活費が効く側）で比べる。目盛り1.1と1.0で必要額が違うこと自体も確かめる
    expect(s.needAtZero).toEqual(diagnose(P, zero, AS_OF).self.range);
    expect(s.needAtZero).not.toEqual(diagnose(P, { ...zero, lifestyleDial: 1 }, AS_OF).self.range);
  });

  it("幅を渡すと、いまの判定はカードのバッジ（resultFigures）と同じになる", () => {
    for (const level of ["tight", "asis", "roomy"] as const) {
      const ri = fromQuery(REBALANCE, level);
      const f = resultFigures(P, ri.input, ri.bands, AS_OF_1017);
      for (const who of ["self", "spouse"] as const) {
        const s = survivorIncomeSensitivity(P, ri.input, who, AS_OF_1017, ri.bands);
        if (!s) continue;
        const card = who === "self" ? f.self : f.spouse;
        expect(s.verdictNow, `${level}・${who}`).toBe(card?.verdict);
        expect(s.needNow, `${level}・${who}`).toEqual(card?.need);
      }
    }
  });
});
