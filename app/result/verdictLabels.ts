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
  uncertain: "幅の中・要確認",
  shortage: "不足の可能性",
  pending: "判定は保留",
};

/**
 * 過不足の判定（過不足軸）の**軸名**。バッジの直前に必ず添える（`AxisBadge`）。
 * 無印の「判定」を画面に出さない（CLAUDE.md「判定には必ず軸名を添える」・2026-10-17 UX レビュー）。
 */
export const VERDICT_AXIS = "過不足の判定";

/**
 * 病気・けが・失業の行の**貯蓄の判定**のラベル（`verdictBySavings`）。結果の診断表ともしもラボが同じ表を引く。
 *
 * 2026-10-18 UX レビュー（24回目）：保留側を「貯蓄と同じくらい」にしたら、範囲が少し重なるだけでも出るため
 * 「ほぼ同額」と読め、足りない側を小さく見せた（必要額 約58〜333万円・貯蓄 約50万円の世帯）。
 * 重なる＝答えの幅しだいで足りないこともある、なのでそのまま書く。「大丈夫」も何がかを書く。
 */
export const SAVINGS_LABEL: Record<Verdict3, string> = {
  reducible: "貯蓄で足りるめやす",
  uncertain: "足りない場合あり",
  shortage: "備え不足の可能性",
  pending: "判定できません",
};
