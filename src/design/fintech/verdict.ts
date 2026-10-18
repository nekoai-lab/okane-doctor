/**
 * 判定 → バッジの見た目（Modern Fintech A）。
 *
 * **ここに書くのは色の系統とアイコンだけ。ラベルの言葉は持たない。** 言葉は
 * `app/result/verdictLabels.ts`（死亡の過不足）などの表から呼び出し側が渡す
 * （CLAUDE.md「判定ラベルは手打ちで再入力しない」）。
 *
 * 判定は必ず「アイコン＋ラベル＋色」の3点で出す。色だけで意味を伝えない。
 * 不足はエラーではないので赤にしない。不足専用のピンク（shortage）で、CTA の色とも分ける。
 * 「幅の中・要確認」は色を足さず、青みの灰（check）に記号 ↔ とラベルで区別する（2026-10-18・オーナー）。
 */
import type { Verdict3 } from "../../calc/verdict3.js";

export type BadgeTone = "positive" | "shortage" | "check" | "neutral";

export const VERDICT_BADGE: Record<Verdict3, { tone: BadgeTone; icon: string }> = {
  reducible: { tone: "positive", icon: "✓" },
  uncertain: { tone: "check", icon: "↔" },
  shortage: { tone: "shortage", icon: "!" },
  pending: { tone: "neutral", icon: "…" },
};
