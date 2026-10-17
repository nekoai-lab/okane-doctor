/**
 * 世帯の過不足の判定（過不足軸・§1 の世帯4値＋保留）のバッジの文言と色。
 *
 * **旧ヒーロー（冒頭カード）は `Conclusion.tsx` に置き換えた**（2026-10-17・最初の2画面の作り直し）。
 * 旧ヒーローは世帯合計の差額を見出しに入れていたが、新しい結論は人ごとの行で出す。
 * バッジの文言はここ1か所から引く（CLAUDE.md「判定ラベルは手打ちで再入力しない」）。
 */

/** §1 の世帯4値。`pending` は現保障が未入力で判定しない */
export type HeroVerdict = "reducible" | "uncertain" | "shortage" | "rebalanceable" | "pending";

/**
 * バッジの文言。**export して「よみとき」のサマリーからも同じものをバインドする**
 * ── 同じ判定に2つの呼び名ができるのを防ぐ（CLAUDE.md「判定ラベルは手打ちで再入力しない」）。
 */
export const HERO_BADGE: Record<HeroVerdict, string> = {
  reducible: "減らせる可能性",
  uncertain: "圏内・要精査",
  shortage: "不足の可能性",
  rebalanceable: "組み替えの余地",
  pending: "判定は保留",
};

/** バッジの色チャンネル（判定バッジのステータス体系）。よみときのサマリーと共有する */
export const HERO_TONE: Record<HeroVerdict, string> = {
  reducible: "ok",
  uncertain: "check",
  shortage: "short",
  rebalanceable: "check",
  pending: "none",
};

/**
 * バッジのアイコン（判定は「アイコン＋ラベル＋色」の3点で出す・CLAUDE.md）。
 * 人ごとの行の `VERDICT_ICON` と同じ記号を使い、世帯にしかない「組み替えの余地」だけ足す。
 */
export const HERO_ICON: Record<HeroVerdict, string> = {
  reducible: "↓",
  uncertain: "≒",
  shortage: "!",
  rebalanceable: "⇄",
  pending: "?",
};
