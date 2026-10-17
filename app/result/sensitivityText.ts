/**
 * 感度文（仕様 §5.3 T-E・2026-09-21 オーナー承認の文型）を組み立てる。
 *
 * 分岐と数値は `survivorIncomeSensitivity`（src/calc）が出す。ここは返った値を文に差し込むだけ。
 *
 * **判定が動かない理由を1つに決めつけない**（設計レビュー #6・UX レビュー #3・2026-10-17）。
 * 以前は `no_verdict_change` を一律「いまの保障が上回るため判定は変わりません」と書いており、
 * いまの保障が約0万円で「不足の可能性」のままの配偶者カードにも「上回る」と出ていた。
 * 判定が動かないのは、3ケースとも減らせる・圏内・不足・保留のどれでも起きる。
 * 理由は実際の判定から言い、必要額が動かないなら「増えます」と言わない。
 *
 * 軸名（CLAUDE.md）：ここの判定は**過不足の判定（過不足軸）**。ラベルはバッジと同じ表を引く。
 */
import type { SurvivorIncomeSensitivity } from "../../src/calc/sensitivity.js";
import { formatMan, formatRange } from "../../src/design/tokens.js";
import { DEATH_LABEL } from "./verdictLabels.js";

const sameRange = (a: { low: number; high: number }, b: { low: number; high: number }) =>
  a.low === b.low && a.high === b.high;

/** 判定が動かないときの後半。**実際の判定から**理由を言う */
function unchangedTail(sv: SurvivorIncomeSensitivity): string {
  switch (sv.verdictNow) {
    case "reducible":
      return `いまの保障がそれでも上回るため、過不足の判定は「${DEATH_LABEL.reducible}」のままです。`;
    case "pending":
      return "いまの保障が分からないため、過不足の判定は出していません。";
    default:
      return `過不足の判定は「${DEATH_LABEL[sv.verdictNow]}」のままです。`;
  }
}

/**
 * 前提が外れたら必要額と過不足の判定がどう動くか（感度文の後半）。
 * 結果画面の冒頭「この結論を決めている前提」は、前半（就労収入の内訳）を図に任せ、ここだけを使う。
 */
export function sensitivityMove(sv: SurvivorIncomeSensitivity): string {
  const bare = (yen: number) => formatMan(yen).replace("万円", "");
  /**
   * **半額の軸を裸にしない。** 動かしているのは回答された年収（額面）なので、そう書く。
   */
  const halfGross = `年収が半分（${bare(sv.annualGross / 2)}万円）`;
  if (sv.branch === "no_verdict_change") {
    // 必要額が動かないなら「増えます」と言わない
    const move = sameRange(sv.needNow, sv.needAtZero)
      ? `収入がなくなっても、必要額は${formatRange(sv.needNow.low, sv.needNow.high)}のままです。`
      : `収入がなくなると、必要額は${formatRange(sv.needNow.low, sv.needNow.high)}から${formatRange(sv.needAtZero.low, sv.needAtZero.high)}に増えます。`;
    return `${move}${unchangedTail(sv)}`;
  }
  if (sv.branch === "zero_only") {
    return `${halfGross}になっても過不足の判定は変わりませんが、働けない場合は「${DEATH_LABEL[sv.verdictAtZero]}」に変わります。`;
  }
  return `${halfGross}になると「${DEATH_LABEL[sv.verdictAtHalf]}」、働けない場合は「${DEATH_LABEL[sv.verdictAtZero]}」に変わります。`;
}

export function sensitivityText(sv: SurvivorIncomeSensitivity, who: "self" | "spouse"): string {
  const label = who === "self" ? "遺されたご家族" : "あなた";
  const total = `約${formatMan(sv.workTotal)}`;
  const bare = (yen: number) => formatMan(yen).replace("万円", "");
  /**
   * **括弧の掛け算が読者の手元で合うようにする。**
   * 末子独立後に下限（年100万円）が効く世帯は単純な掛け算にならないので、2本立てで書く。
   */
  const breakdown =
    sv.annualNet === sv.netAfter
      ? `手取り 年${bare(sv.annualNet)}万円×${sv.yearsTotal}年`
      : `手取り 年${bare(sv.annualNet)}万円×${sv.yearsDependent}年＋年${bare(sv.netAfter)}万円×${sv.yearsAlone}年`;
  const lead = `この判定を支えているのは、${label}の就労収入 ${total}（${breakdown}）です。`;
  return `${lead}${sensitivityMove(sv)}`;
}
