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

/**
 * 感度文が**誰の収入を動かし、誰の判定を言っているか**（2026-10-18・PR #5 の UX レビュー「直さないと誤る」）。
 *
 * 結果画面の冒頭は人ごとの行が2つ並ぶので、「年収が半分になると『圏内・要精査』」だけでは
 * どちらの行の判定が動くのか、誰の年収なのかが読めない。カードの中（`sensitivityText`）は
 * 前半の文が人を名指しているので空のまま使う。
 */
export interface SensitivitySubject {
  /** 動かす年収の持ち主（例：「配偶者の」）。空なら付けない */
  earner: string;
  /** どの行の過不足の判定か（例：「あなたに万一のときの」）。空なら付けない */
  verdictOf: string;
}

const NO_SUBJECT: SensitivitySubject = { earner: "", verdictOf: "" };

/** 判定が動かないときの後半。**実際の判定から**理由を言う */
function unchangedTail(sv: SurvivorIncomeSensitivity, sub: SensitivitySubject): string {
  const axis = `${sub.verdictOf}過不足の判定`;
  switch (sv.verdictNow) {
    case "reducible":
      return `いまの保障がそれでも上回るため、${axis}は「${DEATH_LABEL.reducible}」のままです。`;
    case "pending":
      return `いまの保障が分からないため、${axis}は出していません。`;
    default:
      return `${axis}は「${DEATH_LABEL[sv.verdictNow]}」のままです。`;
  }
}

/**
 * 前提が外れたら必要額と過不足の判定がどう動くか（感度文の後半）。
 * 結果画面の冒頭「この結論を決めている前提」は、前半（就労収入の内訳）を図に任せ、ここだけを使う。
 */
export function sensitivityMove(
  sv: SurvivorIncomeSensitivity,
  sub: SensitivitySubject = NO_SUBJECT,
): string {
  const bare = (yen: number) => formatMan(yen).replace("万円", "");
  /**
   * **半額の軸を裸にしない。** 動かしているのは回答された年収（額面）なので、そう書く。
   */
  const halfGross = `${sub.earner}年収が半分（${bare(sv.annualGross / 2)}万円）`;
  const axis = `${sub.verdictOf}過不足の判定`;
  if (sv.branch === "no_verdict_change") {
    // 必要額が動かないなら「増えます」と言わない
    const move = sameRange(sv.needNow, sv.needAtZero)
      ? `${sub.earner}収入がなくなっても、必要額は${formatRange(sv.needNow.low, sv.needNow.high)}のままです。`
      : `${sub.earner}収入がなくなると、必要額は${formatRange(sv.needNow.low, sv.needNow.high)}から${formatRange(sv.needAtZero.low, sv.needAtZero.high)}に増えます。`;
    return `${move}${unchangedTail(sv, sub)}`;
  }
  if (sv.branch === "zero_only") {
    return `${halfGross}になっても${axis}は変わりませんが、働けない場合は「${DEATH_LABEL[sv.verdictAtZero]}」に変わります。`;
  }
  // 半分でも0でも同じ判定なら1回で言う（「圏内・要精査」、働けない場合は「圏内・要精査」と同じ語を重ねない）
  if (sv.verdictAtHalf === sv.verdictAtZero) {
    return `${halfGross}になるか働けない場合、${axis}は「${DEATH_LABEL[sv.verdictAtHalf]}」に変わります。`;
  }
  return `${halfGross}になると、${axis}は「${DEATH_LABEL[sv.verdictAtHalf]}」、働けない場合は「${DEATH_LABEL[sv.verdictAtZero]}」に変わります。`;
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
  // 掛けている年数は算定期間ではなく、就労収入を見込む年齢まで（work.ts）。年数の出どころを同じ括弧で名乗る
  const lead = `この判定を支えているのは、${label}の就労収入 ${total}（${breakdown}・${sv.workEndAge}歳まで）です。`;
  return `${lead}${sensitivityMove(sv)}`;
}
