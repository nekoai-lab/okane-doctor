/**
 * 診断の対象外の世帯を見分ける（2026-10-16・QA で blocking）。
 *
 * **配偶者なし・独立前の子ありの世帯（ひとり親）は、いまのエンジンでは算定できない。**
 * `calcDeath` の算定期間は「遺される配偶者が年金を受け取るまで」なので、配偶者がいないと 0年になり、
 * 子の生活費が丸ごと抜けた金額が**普通の診断として**出てしまう。
 * 間違った金額を黙って出すより、対象外と言って止める（期限切れパラメータで止めるのと同じ考え）。
 *
 * **判定は算定の入口（`diagnose`）に置く。** 画面・診断 API・言語化 API のどこから入っても
 * 同じところで止まるようにするため（画面だけで止めると、API からは誤った金額が返る）。
 *
 * ひとり親の算定（子の生活費・遺族基礎年金・検算）を入れたら、この判定を外す。
 */
import { type ParamSet, v } from "../params/index.js";
import type { DiagnoseInput } from "./index.js";

export type OutOfScope = "single_parent";

export function outOfScope(p: ParamSet, input: DiagnoseInput): OutOfScope | null {
  if (input.spouse) return null;
  // 独立年齢は params から読む（算定と同じ値。コードに数字を書かない）
  const indepAge = v(p, "childIndepAge");
  return input.children.some((age) => age < indepAge) ? "single_parent" : null;
}

/** 対象外の世帯で `diagnose` を呼んだときに投げる。API はこれを 422 にする */
export class OutOfScopeError extends Error {
  constructor(readonly reason: OutOfScope) {
    super(
      "配偶者がいなくて、独立前のお子さんがいる世帯の計算は、いま準備中です。お子さんの生活費を正しく計算できないため、金額と判定は出していません。",
    );
    this.name = "OutOfScopeError";
  }
}
