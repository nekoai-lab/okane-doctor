/**
 * 遺族の就労収入の感度（仕様 §5.3 T-E）
 *
 * **判定を支えている前提が外れたら何が起きるか**を、就労収入を
 * `現状 / その半額 / ゼロ` の3前提で回し直して測る。
 *
 * ここに置く理由：
 * - **画面から呼ぶ前に単体で検査できるようにする。** 分岐が画面の中にあると、
 *   「実データでたまたま出た分岐」しか確かめられない
 * - 金額を作るのは `src/calc` だけ（CLAUDE.md 責務境界）。画面は返った値を差し込むだけ
 *
 * **軸を間違えない。** ここが返す判定は `Verdict3`（保障と必要額の過不足）で、
 * カードのバッジと同じ軸である。`DeathResult.verdict`（`ample` / `shortage` など）は
 * **必要額が出るかどうかのニーズ軸**で、別物。
 * 2026-09-21、この2つを取り違えて「感度表では shortage なのにカードは変わらない」という
 * 食い違いの報告が出た。実際は両方とも正しく、比べていた軸が違っただけだった。
 */
import type { ParamSet } from "../params/index.js";
import { v } from "../params/index.js";
import { envelope } from "./envelope.js";
import { type DiagnoseInput, diagnose } from "./index.js";
import type { Verdict3 } from "./verdict3.js";
import { verdict3 } from "./verdict3.js";
import { survivorWorkPlan, survivorWorkYears } from "./work.js";

/** どちらのケースの感度を測るか。`self` は本人が亡くなるケース */
export type DeathCase = "self" | "spouse";

export type SensitivityBranch =
  /** 半額でもゼロでも判定が動く */
  | "both_change"
  /** 半額では動かず、ゼロで動く */
  | "zero_only"
  /** どちらでも判定は動かない（必要額は動きうる） */
  | "no_verdict_change";

export interface Range {
  low: number;
  high: number;
}

export interface SurvivorIncomeSensitivity {
  branch: SensitivityBranch;
  verdictNow: Verdict3;
  verdictAtHalf: Verdict3;
  verdictAtZero: Verdict3;
  /** 遺族の就労収入の合計（円・手取りベース） */
  workTotal: number;
  /** 回答された年収（円・額面） */
  annualGross: number;
  /** 計算に使っている年額（円・手取り） */
  annualNet: number;
  /** 半額にしたときの手取り年額（円） */
  halfNet: number;
  /** 末子独立後に使っている年額（円・手取り）。`annualNet` と違うと単純な掛け算にならない */
  netAfter: number;
  /** 就労収入を入れた年数（終わりの年齢まで・`work.ts`）。算定期間の年数とは違う */
  yearsDependent: number;
  yearsAlone: number;
  yearsTotal: number;
  /** 就労収入を見込む年齢の上限 */
  workEndAge: number;
  needNow: Range;
  needAtHalf: Range;
  needAtZero: Range;
}

/**
 * 3つの判定から分岐を選ぶ。**純粋関数**。
 *
 * ゼロは半額より必ず厳しいので「半額で動いてゼロで戻る」は起きないが、
 * 起きたとしても `both_change` に落ちて言い過ぎにならない側に倒す。
 */
export function pickBranch(now: Verdict3, atHalf: Verdict3, atZero: Verdict3): SensitivityBranch {
  if (atHalf === now && atZero === now) return "no_verdict_change";
  if (atHalf === now) return "zero_only";
  return "both_change";
}

/**
 * 遺族の就労収入を動かして、判定と必要額がどう動くかを返す。
 *
 * **変えるのは遺族（survivor）の収入。** 本人が亡くなるケースなら配偶者の収入、
 * 配偶者が亡くなるケースなら本人の収入を動かす。亡くなる側の収入を動かすと
 * 遺族年金の額まで変わってしまい、測りたいものが測れない。
 *
 * 遺族の収入が元から0の世帯は `null`（動かす余地が無い）。
 *
 * **入力の暮らし方の目盛り（`lifestyleDial`）をそのまま使う**（設計レビュー #5・2026-10-17）。
 * 以前は `simulate` 経由で回しており、`simulate` が目盛りを `assumptions.livingLevel`（未指定＝いま通り）で
 * 上書きしたため、目盛りを変えた診断に「いま通り」の感度文が付いていた。
 *
 * **`bands`（回答の幅の両端）を渡すと、必要額と判定を幅の包絡で測る。**
 * カードのバッジは幅の包絡レンジで判定しているので、感度だけ代表値で測ると
 * 「判定は変わりません」の「判定」がバッジと別のものになる。両端それぞれの遺族の年収を同じ割合で動かす。
 */
export function survivorIncomeSensitivity(
  p: ParamSet,
  input: DiagnoseInput,
  who: DeathCase,
  asOf: Date,
  bands: DiagnoseInput[] | null = null,
): SurvivorIncomeSensitivity | null {
  const survivor = who === "self" ? input.spouse : input.self;
  const coverage = who === "self" ? input.coverageSelf : input.coverageSpouse;
  if (!survivor || survivor.income <= 0) return null;

  /**
   * 遺族の年収だけを差し替えた入力。目盛りなど他の前提は入力のまま。
   * **0 は「働けない」の明示**なので `noWork` も立てる。年収0円を入れただけだと
   * 当社基準の下限（独立後 年100万円）が残り、「働けない場合」が働けない場合にならない（2026-10-18）
   */
  const withSurvivorIncome = (x: DiagnoseInput, f: (income: number) => number): DiagnoseInput => {
    const swap = <T extends { income: number }>(person: T): T => {
      const income = f(person.income);
      return income === 0 ? { ...person, income, noWork: true } : { ...person, income };
    };
    if (who === "self") return x.spouse ? { ...x, spouse: swap(x.spouse) } : x;
    return { ...x, self: swap(x.self) };
  };
  const caseOf = (x: DiagnoseInput) => {
    const d = diagnose(p, x, asOf);
    return who === "self" ? d.self : d.spouse;
  };
  const half = (income: number) => Math.round(income / 2);
  const zero = () => 0;

  const now = caseOf(input);
  const halfGross = half(survivor.income);
  const atHalf = caseOf(withSurvivorIncome(input, half));
  const atZero = caseOf(withSurvivorIncome(input, zero));
  if (!now || !atHalf || !atZero) return null;

  const useBands = bands !== null && bands.length >= 2;
  const rangeOf = (f: (income: number) => number, pointRange: Range): Range => {
    if (!useBands) return pointRange;
    const e = envelope(
      p,
      bands.map((x) => withSurvivorIncome(x, f)),
      asOf,
      who,
    );
    return { low: e.low, high: e.high };
  };
  const needNow = rangeOf((x) => x, now.range);
  const needAtHalf = rangeOf(half, atHalf.range);
  const needAtZero = rangeOf(zero, atZero.range);

  const verdictNow = verdict3(coverage, needNow.low, needNow.high);
  const verdictAtHalf = verdict3(coverage, needAtHalf.low, needAtHalf.high);
  const verdictAtZero = verdict3(coverage, needAtZero.low, needAtZero.high);

  const ratio = v(p, "netIncomeRatio");
  const annualNet = survivor.income * ratio;
  const plan = survivorWorkPlan(p, survivor);
  const workYears = survivorWorkYears(plan, survivor.age, now.years.dependent, now.years.total);

  return {
    branch: pickBranch(verdictNow, verdictAtHalf, verdictAtZero),
    verdictNow,
    verdictAtHalf,
    verdictAtZero,
    workTotal: now.income.survivorWork,
    annualGross: survivor.income,
    annualNet,
    halfNet: halfGross * ratio,
    netAfter: plan.netAfter,
    yearsDependent: workYears.dependent,
    yearsAlone: workYears.alone,
    yearsTotal: workYears.dependent + workYears.alone,
    workEndAge: plan.endAge,
    needNow,
    needAtHalf,
    needAtZero,
  };
}
