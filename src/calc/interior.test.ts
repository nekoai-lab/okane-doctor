/**
 * 区分の内側の必要額を、最終の必要額が取りこぼさないこと（2026-10-17・11回目の QA で blocking）。
 *
 * 軸名（CLAUDE.md）：`point.verdict` と各候補の `verdict` は**必要額の判定（ニーズ軸）**、
 * `f.self.verdict` / `f.household.verdict` は**過不足の判定（過不足軸・`Verdict3`）**。
 *
 * 必要額は回答区分の中で単調ではない。上乗せが要る（`shortage`）側から外れた直後は
 * 「当座資金」（`sufficient`・生活費だけで決まる）に切り替わり、そこから余裕（`ample`）に入ると
 * 葬儀・予備費だけになる。**いちばん高い当座資金は、区分の角ではなく枝の境目の手前にある。**
 * 角だけで包絡を取っていた9回目の直しでは、代表値（600〜1,000万円）が最終の必要額（200〜800万円）の
 * 外にはみ出し、保障1,000万円の世帯を「減らせる」と判定していた。
 *
 * ここでは**実装の候補の作り方に頼らずに**、区分の内側を細かい格子で回し、
 * どの点の必要額も最終の必要額の内側にあることを確かめる。
 */
import { describe, expect, it } from "vitest";
import { GOLDEN, type GoldenCase } from "../__tests__/households.js";
import { loadParams } from "../params/index.js";
import { toCompleteSelections } from "../wizard/complete.js";
import { type LivingLevel, LIVING_LEVELS } from "../wizard/dial.js";
import { resultInputs } from "../wizard/resultInputs.js";
import type {
  AssetCode,
  CoverageCode,
  IncomeCode,
  LivingCode,
  LoanCode,
  WizardSelections,
} from "../wizard/types.js";
import { inputAtEnds } from "../wizard/uncertainty.js";
import { decodeSelections } from "../wizard/url.js";
import { resultFigures } from "./figures.js";
import { type DiagnoseInput, diagnose } from "./index.js";

const P = loadParams("2026-08");
const AS_OF = new Date("2026-10-17T12:00:00+09:00");
const MAN = 10_000;

/** 11回目の QA の再現世帯：50代共働き・子なし・生活費は年収から推定・本人の保障 1,000万円 */
const QA11 =
  "v=1&sb=1970&emp=employee&sp=1&spb=1970&spe=employee&ch=&edu=public&inc=lt800&sinc=lt400&as=lt100&liv=estimate&ho=rent&cvs=m1000&cvsp=none";
/** 9回目の QA の再現世帯（`figures.test.ts` と同じ） */
const QA9_1 =
  "v=1&sb=1986&emp=employee&sp=1&spb=1988&spe=employee&ch=2018-2021&edu=public&inc=lt600&sinc=lt400&as=lt100&liv=estimate&ho=rent&cvs=m1500&cvsp=m300";
const QA9_2 =
  "v=1&sb=1988&emp=employee&sp=1&spb=1990&spe=employee&ch=2021-2024&edu=public&inc=lt600&sinc=lt400&as=lt1000&liv=lt30&ho=rent&cvs=m1000&cvsp=m300";
/** CLAUDE.md の代表3世帯 */
const REPRESENTATIVE: Array<[string, string]> = [
  [
    "組み替えの余地",
    "v=1&sb=1989&emp=employee&sp=1&spb=1991&spe=employee&ch=2024&edu=public&inc=lt600&sinc=lt400&as=lt500&liv=lt30&ho=own_loan&loan=lt3000&dan=yes&cvs=m2000&cvsp=none",
  ],
  [
    "不足",
    "v=1&sb=1986&emp=self&sp=1&spb=1988&spe=none&ch=2018-2021&edu=private&inc=lt400&sinc=none&as=lt100&liv=lt35&ho=rent&cvs=none&cvsp=none",
  ],
  ["単身", "v=1&sb=1996&emp=employee&sp=0&ch=&inc=lt600&as=lt500&liv=lt25&ho=rent&cvs=m1000"],
];

function selFromQuery(query: string): WizardSelections {
  const complete = toCompleteSelections(decodeSelections(query));
  if (!complete) throw new Error("入力が足りない");
  return complete;
}

/**
 * ゴールデン10世帯を、同じ世帯がウィザードで答える区分に写す（検査用）。
 * 金額の期待値は使わない（ここで見るのは「代表値が最終の必要額の内側にあるか」だけ）。
 */
function band<T extends string>(x: number, cuts: Array<[number, T]>, top: T): T {
  for (const [lt, code] of cuts) if (x < lt) return code;
  return top;
}
const incomeCode = (x: number): IncomeCode =>
  band(
    x,
    [
      [400 * MAN, "lt400"],
      [600 * MAN, "lt600"],
      [800 * MAN, "lt800"],
      [1000 * MAN, "lt1000"],
    ],
    "gte1000",
  );
const coverageCode = (x: number | null | undefined): CoverageCode => {
  if (x === null || x === undefined) return "unknown";
  return band(
    x,
    [
      [300 * MAN, "none"],
      [500 * MAN, "m300"],
      [1000 * MAN, "m500"],
      [1500 * MAN, "m1000"],
      [2000 * MAN, "m1500"],
      [3000 * MAN, "m2000"],
      [5000 * MAN, "m3000"],
      [10000 * MAN, "m5000"],
    ],
    "gte10000",
  );
};
function goldenSelections(g: GoldenCase): WizardSelections {
  const y = AS_OF.getFullYear();
  const i = g.input;
  const h = i.housing;
  const loan = h.type === "own" ? (h.loan ?? 0) : 0;
  return {
    selfBirthYear: y - i.self.age,
    selfEmployment: i.self.employment === "self" ? "self" : "employee",
    hasSpouse: i.spouse !== null,
    ...(i.spouse
      ? {
          spouseBirthYear: y - i.spouse.age,
          spouseEmployment:
            i.spouse.income === 0 ? "none" : i.spouse.employment === "self" ? "self" : "employee",
          spouseIncome: i.spouse.income === 0 ? "none" : incomeCode(i.spouse.income),
        }
      : {}),
    childrenBirthYears: i.children.map((a) => y - a),
    educationPlan: i.educationPlan,
    selfIncome: incomeCode(i.self.income),
    assets: band<AssetCode>(
      i.assets,
      [
        [100 * MAN, "lt100"],
        [300 * MAN, "lt300"],
        [500 * MAN, "lt500"],
        [1000 * MAN, "lt1000"],
      ],
      "gte1000",
    ),
    livingCost: band<LivingCode>(
      i.monthlyLiving,
      [
        [20 * MAN, "lt20"],
        [25 * MAN, "lt25"],
        [30 * MAN, "lt30"],
        [35 * MAN, "lt35"],
      ],
      "gte35",
    ),
    housing: h.type === "rent" ? "rent" : loan > 0 ? "own_loan" : "own_noloan",
    ...(h.type === "own" && loan > 0
      ? {
          loan: band<LoanCode>(
            loan,
            [
              [500 * MAN, "lt500"],
              [1000 * MAN, "lt1000"],
              [1500 * MAN, "lt1500"],
              [2000 * MAN, "lt2000"],
              [3000 * MAN, "lt3000"],
            ],
            "gte3000",
          ),
          danshin: h.danshin === false ? ("no" as const) : ("yes" as const),
        }
      : {}),
    coverageSelf: coverageCode(i.coverageSelf),
    ...(i.spouse ? { coverageSpouse: coverageCode(i.coverageSpouse) } : {}),
  };
}

const HOUSEHOLDS: Array<[string, WizardSelections]> = [
  ...GOLDEN.map((g): [string, WizardSelections] => [`${g.id} 相当`, goldenSelections(g)]),
  ...REPRESENTATIVE.map(([name, q]): [string, WizardSelections] => [name, selFromQuery(q)]),
  ["11回目の QA", selFromQuery(QA11)],
  ["9回目の QA #1", selFromQuery(QA9_1)],
  ["9回目の QA #2", selFromQuery(QA9_2)],
  /**
   * 探索がいちばん重い世帯（8,640世帯の総当たりで最大）。軸が5本そろい（2人の年収・生活費・資産・団信なしのローン）、
   * 2人とも年収が最下位の区分なので、遺族の就労収入の折れ点が両方の年収の軸に入る
   */
  [
    "探索がいちばん重い世帯",
    selFromQuery(
      "v=1&sb=1996&emp=employee&sp=1&spb=1998&spe=employee&ch=2024&edu=public&inc=lt400&sinc=lt400&as=lt1000&liv=lt20&ho=own_loan&loan=lt3000&dan=no&cvs=m1000&cvsp=m300",
    ),
  ],
];

function figuresOf(sel: WizardSelections, level: LivingLevel = "asis") {
  const ri = resultInputs(P, sel, level, AS_OF);
  return { ri, f: resultFigures(P, ri.input, ri.bands, AS_OF) };
}

describe("11回目の QA：区分の内側の必要額を取りこぼさない", () => {
  it("回帰：代表値は 600〜1,000万円なのに、最終の必要額が 200〜800万円で「減らせる」と出ていた", () => {
    const { f } = figuresOf(selFromQuery(QA11));
    // 前提の確認（この世帯がまだ被験体であること）：代表値は当座資金（必要額の判定・ニーズ軸 sufficient）
    expect(f.self.point.verdict).toBe("sufficient");
    expect(f.self.point.range).toEqual({ low: 600 * MAN, high: 1000 * MAN });
    // 最終の必要額は代表値を内側に含む
    expect(f.self.need.low).toBeLessThanOrEqual(f.self.point.range.low);
    expect(f.self.need.high).toBeGreaterThanOrEqual(f.self.point.range.high);
    // 過不足の判定（過不足軸）：保障1,000万円は幅の中なので、減らせるとは言わない
    expect(f.self.coverage).toBe(1000 * MAN);
    expect(f.self.verdict).not.toBe("reducible");
    expect(f.household.verdict).not.toBe("reducible");
    expect(f.diagnosis.self.gap.kind).not.toBe("excess");
  });
});

describe("不変条件：代表値のレンジは、いつも最終の必要額の内側にある", () => {
  for (const [name, sel] of HOUSEHOLDS) {
    for (const level of LIVING_LEVELS) {
      it(`${name}（目盛り ${level}）`, () => {
        const { f } = figuresOf(sel, level);
        for (const fx of [f.self, f.spouse]) {
          if (!fx) continue;
          expect(fx.need.low, `${fx.who} の下端`).toBeLessThanOrEqual(fx.point.range.low);
          expect(fx.need.high, `${fx.who} の上端`).toBeGreaterThanOrEqual(fx.point.range.high);
        }
      });
    }
  }
});

/**
 * **区分の内側を細かく回す**（実装より細かく、実装とは独立に組む）。
 *
 * 軸の端は `inputAtEnds`（緩め端・厳しめ端）から読む。内側は2通りで埋める。
 * - **等間隔の格子**：軸の数に応じて刻みを決め、1世帯あたり約 `GRID_BUDGET` 点に収める（最低でも4等分）
 * - **低食い違い列（Halton 列）**：格子の目のあいだを `HALTON` 点で埋める（乱数を使わず、毎回同じ点）
 *
 * 生活費の推定（§4.2.1）は検査側でも同じ式で組み直す（QA #1 の検査と同じやり方）。
 */
const GRID_BUDGET = 2000;
const HALTON = 1500;
const PRIMES = [2, 3, 5, 7, 11];
function halton(i: number, base: number): number {
  let f = 1;
  let r = 0;
  let k = i;
  while (k > 0) {
    f /= base;
    r += f * (k % base);
    k = Math.floor(k / base);
  }
  return r;
}
type Sample = { input: DiagnoseInput; who: "self" | "spouse"; low: number; high: number };
function denseNeeds(sel: WizardSelections, dial: number): Sample[] {
  const ri = resultInputs(P, sel, "asis", AS_OF);
  const base = { ...ri.rawInput, lifestyleDial: dial };
  const all = (end: "loose" | "strict") =>
    inputAtEnds(P, sel, AS_OF, {
      selfIncome: end,
      spouseIncome: end,
      living: end,
      assets: end,
      loan: end,
    });
  const L = all("loose");
  const S = all("strict");
  const loanOf = (x: DiagnoseInput) => (x.housing.type === "own" ? (x.housing.loan ?? 0) : 0);
  const estimate = sel.livingCost === "estimate";
  // [下端, 上端]。幅の無い軸は1点
  const span = (a: number, b: number): [number, number] => [Math.min(a, b), Math.max(a, b)];
  const axes = {
    self: span(L.self.income, S.self.income),
    spouse: span(L.spouse?.income ?? 0, S.spouse?.income ?? 0),
    living: estimate ? span(base.monthlyLiving, base.monthlyLiving) : span(L.monthlyLiving, S.monthlyLiving),
    assets: span(L.assets, S.assets),
    loan: span(loanOf(L), loanOf(S)),
  };
  const keys = (Object.keys(axes) as Array<keyof typeof axes>).filter(
    (k) => axes[k][0] < axes[k][1],
  );
  const at = (k: keyof typeof axes, t: number) =>
    Math.round(axes[k][0] + (axes[k][1] - axes[k][0]) * t);

  const make = (t: Partial<Record<keyof typeof axes, number>>): DiagnoseInput => {
    const v = (k: keyof typeof axes) => (t[k] === undefined ? axes[k][0] : at(k, t[k] ?? 0));
    const si = v("self");
    const pi = v("spouse");
    return {
      ...base,
      self: { ...base.self, income: si },
      spouse: base.spouse ? { ...base.spouse, income: pi } : null,
      monthlyLiving: estimate
        ? Math.round(
            ((si + (base.spouse ? pi : 0)) *
              P.ownStandard.netIncomeRatio.value *
              P.ownStandard.livingCostEstimateRatio.value) /
              12,
          )
        : v("living"),
      assets: v("assets"),
      housing:
        base.housing.type === "own" && base.housing.loan
          ? { ...base.housing, loan: v("loan") }
          : base.housing,
    };
  };

  const points: Array<Partial<Record<keyof typeof axes, number>>> = [];
  const steps = Math.max(4, Math.floor(GRID_BUDGET ** (1 / Math.max(1, keys.length))) - 1);
  const walk = (i: number, t: Partial<Record<keyof typeof axes, number>>) => {
    if (i === keys.length) {
      points.push(t);
      return;
    }
    for (let s = 0; s <= steps; s++) walk(i + 1, { ...t, [keys[i]]: s / steps });
  };
  walk(0, {});
  if (keys.length > 0) {
    for (let n = 1; n <= HALTON; n++) {
      const t: Partial<Record<keyof typeof axes, number>> = {};
      keys.forEach((k, j) => {
        t[k] = halton(n, PRIMES[j]);
      });
      points.push(t);
    }
  }

  const out: Sample[] = [];
  for (const t of points) {
    const input = make(t);
    const d = diagnose(P, input, AS_OF);
    out.push({ input, who: "self", ...d.self.range });
    if (d.spouse) out.push({ input, who: "spouse", ...d.spouse.range });
  }
  return out;
}

describe("性質：区分の内側を細かく回しても、どの点の必要額も最終の必要額の内側にある", () => {
  for (const [name, sel] of HOUSEHOLDS) {
    for (const level of LIVING_LEVELS) {
      it(`${name}（目盛り ${level}）`, () => {
        const { ri, f } = figuresOf(sel, level);
        const misses: string[] = [];
        for (const s of denseNeeds(sel, ri.dial)) {
          const fx = s.who === "self" ? f.self : f.spouse;
          if (!fx) continue;
          if (s.low < fx.need.low || s.high > fx.need.high) {
            misses.push(
              `${s.who} 本人${s.input.self.income} 配偶者${s.input.spouse?.income} 生活費${s.input.monthlyLiving} 資産${s.input.assets}: ${s.low}〜${s.high} ⊄ ${fx.need.low}〜${fx.need.high}`,
            );
          }
        }
        expect(misses.slice(0, 5)).toEqual([]);
      });
    }
  }
});
