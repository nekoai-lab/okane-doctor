/**
 * 遺族の就労収入（手取り・年額）の見込み（ADR-030・2026-10-18 オーナー決定）。
 *
 * **式はここ1か所。** 死亡の総額（`death.ts`）・年次の台帳（`projection.ts`）・感度・もしもラボは、
 * すべてこの関数を通る。2か所に書くと、総額と年次の合計が黙ってずれる。
 *
 * 就労収入を見込むのは `survivorWorkEndAge`（既定60歳）まで。**職種を問わず同じ年齢**にする
 * （自営業だけ65歳にすると、同じ年収でも職種だけで5年分の差が出る＝ADR-008 が避けた崖の再来）。
 * 60歳は法律で決まった退職年齢ではなく、就労収入を少なめに見込む当社の備え方。
 * 生活費・遺族年金の算定期間（`pensionAge`＝65歳）はここでは動かさない。
 */
import type { ParamSet } from "../params/index.js";
import { v } from "../params/index.js";
import type { Person } from "./types.js";

export interface WorkPlan {
  /** 末子が独立するまでの年額（手取り） */
  netNow: number;
  /** 末子の独立後の年額（手取り）。当社基準の下限 `postIndepMinIncome` を含む */
  netAfter: number;
  /** この年齢になった年から就労収入を入れない */
  endAge: number;
}

export function survivorWorkPlan(p: ParamSet, survivor: Person): WorkPlan {
  // 「就労なし」を明示したときは、当社基準の下限（年100万円）より優先する。
  // 年収0円を入れただけでは下限が効く（独立後に働き始める見立て）ので、意味が違う
  if (survivor.noWork) return { netNow: 0, netAfter: 0, endAge: survivor.age };

  const netNow = survivor.income * v(p, "netIncomeRatio");
  const endAge = survivor.workEndAge ?? v(p, "survivorWorkEndAge");
  // 例外と下限は、ラボが進めた年齢ではなく診断した時点の年齢で決める
  const ageAtDiagnosis = survivor.diagnosedAge ?? survivor.age;
  /**
   * **すでに終わりの年齢を過ぎて働いている人**には、いまの収入をそのまま算定期間の終わりまで使う。
   * いま60歳以上で働いている事実があるのに即0にしない。過去の減収も重ねない。
   * 働き始める見立ての下限（`postIndepMinIncome`）は、この年齢では置かない
   */
  if (ageAtDiagnosis >= endAge) {
    return { netNow, netAfter: netNow, endAge: v(p, "pensionAge") };
  }
  // 65歳まで働く比較で、いま60歳以上の人に「働き始める見立て」の下限を後から足さない
  const floor = ageAtDiagnosis < v(p, "survivorWorkEndAge") ? v(p, "postIndepMinIncome") : 0;
  return { netNow, netAfter: Math.max(netNow, floor), endAge };
}

/** その年の就労収入。`ageNow` はその年の遺族の年齢、`inDependent` は末子の独立前か */
export function survivorWorkAt(plan: WorkPlan, ageNow: number, inDependent: boolean): number {
  if (ageNow >= plan.endAge) return 0;
  return inDependent ? plan.netNow : plan.netAfter;
}

/** 就労収入を入れる年数（子育て期・独立後）。感度文の掛け算を読者の手元で合わせるため */
export function survivorWorkYears(
  plan: WorkPlan,
  survivorAge: number,
  yDep: number,
  yTotal: number,
): { dependent: number; alone: number } {
  const work = Math.max(0, Math.min(yTotal, plan.endAge - survivorAge));
  return { dependent: Math.min(yDep, work), alone: Math.max(0, work - yDep) };
}

/** 算定期間の就労収入の合計 */
export function survivorWorkTotal(
  plan: WorkPlan,
  survivorAge: number,
  yDep: number,
  yTotal: number,
): number {
  const y = survivorWorkYears(plan, survivorAge, yDep, yTotal);
  return plan.netNow * y.dependent + plan.netAfter * y.alone;
}

/**
 * 本人・配偶者の両方に、遺族になったときの就労の終わりの年齢を入れた入力（結果画面の「65歳まで働く場合」の比較）。
 * どちらが遺族になるかは死亡ケースで決まるので、両方に入れる
 */
export function workingUntil<T extends { self: Person; spouse: Person | null }>(
  x: T,
  age: number,
): T {
  return {
    ...x,
    self: { ...x.self, workEndAge: age },
    spouse: x.spouse ? { ...x.spouse, workEndAge: age } : null,
  };
}
