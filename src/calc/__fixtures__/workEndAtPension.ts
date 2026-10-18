/**
 * **テスト専用**：遺族の就労収入を算定期間の終わり（65歳）まで見込む params（2026-10-18）。
 *
 * ADR-030 で就労収入を60歳までにしたとき、回答の幅・包絡・跨ぎを確かめる検査の
 * **被験体の世帯が性質を失った**（代表値の判定が ample → sufficient などに動いた）。
 * 検査が確かめたいのは包絡や呼び名の規則で、就労の前提ではないので、
 * 被験体を保つために就労の終わりだけを変更前（65歳）に戻して回す（CLAUDE.md「ズレを解消したら…」）。
 *
 * **制度・当社基準の正本ではない。** 値は `params/` を見ること。
 */
import { type ParamSet, v } from "../../params/index.js";

export function withWorkEndAtPension(p: ParamSet): ParamSet {
  const q = structuredClone(p);
  q.ownStandard.survivorWorkEndAge = {
    ...q.ownStandard.survivorWorkEndAge,
    value: v(q, "pensionAge"),
  };
  return q;
}
