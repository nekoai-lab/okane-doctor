/**
 * 診断の対象外の世帯を見分ける（2026-10-16・QA で blocking）。
 *
 * **配偶者なし・独立前の子ありの世帯（ひとり親）は、いまのエンジンでは算定できない。**
 * `calcDeath` の算定期間は「遺される配偶者が年金を受け取るまで」なので、配偶者がいないと 0年になり、
 * 子の生活費が丸ごと抜けた金額が**普通の診断として**出てしまう。
 * 間違った金額を黙って出すより、対象外と言って止める（期限切れパラメータで止めるのと同じ考え）。
 *
 * ひとり親の算定（子の生活費・遺族基礎年金・検算）を入れたら、この判定を外す。
 */
import { type ParamSet, v } from "../params/index.js";
import type { WizardSelections } from "./types.js";

export type OutOfScope = "single_parent";

export function outOfScope(
  p: ParamSet,
  sel: WizardSelections,
  asOfYear: number,
): OutOfScope | null {
  if (sel.hasSpouse) return null;
  // 独立年齢は params から読む（算定と同じ値。コードに数字を書かない）
  const indepAge = v(p, "childIndepAge");
  const hasDependentChild = sel.childrenBirthYears.some((y) => asOfYear - y < indepAge);
  return hasDependentChild ? "single_parent" : null;
}
