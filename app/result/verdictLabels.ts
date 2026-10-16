/**
 * 死亡の行の**過不足の判定（過不足軸・`Verdict3`）**のラベル。
 *
 * 診断表のバッジ・STEP4 の判定カード・感度文が同じ表を引く（CLAUDE.md「判定ラベルは手打ちで再入力しない」）。
 * 2026-10-17 まで、ページ内に同じ判定の表が2つあり、保留の呼び名が「判定できません」と「判定は保留」に割れていた。
 * ヒーロー（`HERO_BADGE.pending`）と同じ「判定は保留」にそろえる。
 */
import type { Verdict3 } from "../../src/calc/verdict3.js";

export const DEATH_LABEL: Record<Verdict3, string> = {
  reducible: "減らせる可能性",
  uncertain: "圏内・要精査",
  shortage: "不足の可能性",
  pending: "判定は保留",
};
