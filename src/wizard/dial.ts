/**
 * 暮らし方の目盛り（D-02・ADR-022）の URL 状態
 *
 * 仕様 §3：**状態は URL クエリの「診療記録」に持つ。金額は載せない。**
 * 目盛りはウィザードの設問ではなく結果画面で動かすものなので、
 * `WizardSelections` とは別にここで扱う（設問の器に結果画面の状態を混ぜない）。
 *
 * **既定（`asis`）は URL に書かない。**
 * 既定を書くと、同じ状態を指す URL が2通りできて「同じ診療記録か」の判定が要らぬ仕事になる。
 * 未知の値も `asis` に倒す ── URL は本人が書き換えられる前提なので、
 * **壊さずに既定へ**（`decodeSelections` と同じ方針）。
 */

export type LivingLevel = "tight" | "asis" | "roomy";

export const LIVING_LEVELS: readonly LivingLevel[] = ["tight", "asis", "roomy"];

/** 既定。これだけは URL に書かない */
export const DEFAULT_LIVING_LEVEL: LivingLevel = "asis";

/** URL のキー */
export const DIAL_KEY = "dial";

export function decodeLivingLevel(query: string | URLSearchParams): LivingLevel {
  const q = typeof query === "string" ? new URLSearchParams(query) : query;
  const raw = q.get(DIAL_KEY);
  return LIVING_LEVELS.includes(raw as LivingLevel) ? (raw as LivingLevel) : DEFAULT_LIVING_LEVEL;
}

/**
 * いまのクエリに目盛りを足した新しいクエリ文字列を作る。
 * **既定は消す**（書かない規約）。
 */
export function withLivingLevel(query: string | URLSearchParams, level: LivingLevel): string {
  const q = new URLSearchParams(typeof query === "string" ? query : query.toString());
  if (level === DEFAULT_LIVING_LEVEL) q.delete(DIAL_KEY);
  else q.set(DIAL_KEY, level);
  return q.toString();
}

/**
 * ラベルとサブラベルは仕様 §4-6 の表と同文（「切り詰める＝今の7割」は誤りだった）。
 *
 * `delta` は**そのサブラベルが既に言っている数**（1割しぼる／同じ水準／1割のゆとり）を
 * 数字で書き出したもの。ADR-022 の乗数 `m`（0.9 / 1.0 / 1.1）と同じ値で、
 * **新しい基準を作っていない**。文中に沈んでいた数を、あるべき声量にするだけ。
 *
 * **ヒーローの「暮らし方の前提」もこの表を読む**（設計レビュー #4・2026-10-17）。
 * 以前はヒーローだけ「いま通り」を直書きしており、目盛りを変えても最上部の表示が変わらなかった。
 */
export const LIVING_LEVEL_LABEL: Record<LivingLevel, { name: string; sub: string; delta: string }> =
  {
    tight: { name: "切り詰める", sub: "いまの生活費から1割しぼる前提", delta: "−10%" },
    asis: { name: "いま通り", sub: "いまと同じ水準（既定）", delta: "±0%" },
    roomy: { name: "ゆとりを持つ", sub: "1割のゆとりを見る前提", delta: "+10%" },
  };
