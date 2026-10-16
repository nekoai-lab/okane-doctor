/**
 * 結果画面の金額の文（2026-10-17・UX レビュー「判断を誤らせる」#1）。
 *
 * **金額は `ResultFigures`（src/calc/figures.ts）からだけ取る。** ここは幅を文字にするだけで、
 * 引き算も合計もしない（差額の幅は `figures.ts` / `householdSummary` が作っている）。
 *
 * 軸名（CLAUDE.md）：ここで扱う判定は**過不足の判定（過不足軸・`Verdict3`）**。
 */
import type { DeathFigures, ResultFigures } from "../../src/calc/figures.js";
import { formatRange } from "../../src/design/tokens.js";

const WHO_CASE: Record<DeathFigures["who"], string> = {
  self: "あなたに万一のとき",
  spouse: "配偶者に万一のとき",
};

const WHO_COVERAGE: Record<DeathFigures["who"], string> = {
  self: "あなたの保障",
  spouse: "配偶者の保障",
};

function people(f: ResultFigures): DeathFigures[] {
  return [f.self, ...(f.spouse ? [f.spouse] : [])];
}

/** ヒーローの見出しに差し込む差額（幅）。差額を言わない判定では null */
export function heroDiffText(f: ResultFigures): string | null {
  const h = f.household;
  if (h.verdict === "shortage") return formatRange(h.shortageRange.low, h.shortageRange.high);
  if (h.totalReducible > 0) return formatRange(h.reducibleRange.low, h.reducibleRange.high);
  return null;
}

/**
 * 見出しの差額が**2人分の合計**のとき、そう書いて内訳を添える。
 *
 * 2026-10-17 の UX レビューで、不足世帯のヒーロー「約1億700万円ほど足りない」が
 * 本人分＋配偶者分の合計だと分からず、カード（本人分）の金額と食い違って見えた。
 * 1人分しか差額が無いなら、その人の差額そのものなので添えない。
 */
export function heroBreakdownNote(f: ResultFigures): string | null {
  const v = f.household.verdict;
  const kind = v === "shortage" ? "shortage" : v === "reducible" ? "reducible" : null;
  if (!kind) return null;
  const parts = people(f).filter((x) => x.gap.kind === kind);
  if (parts.length < 2) return null;
  const each = parts.map((x) => `${WHO_CASE[x.who]} ${formatRange(x.gap.low, x.gap.high)}`);
  return `あなたと配偶者の分を足した額です（${each.join("、")}）。`;
}

/**
 * `組み替えの余地` に添える金額の1行（仕様 §5.3）。両金額は `householdSummary` の幅。
 * 不足している側は**過不足軸**で名指す。
 */
export function rebalanceNote(f: ResultFigures): string | null {
  const h = f.household;
  if (h.verdict !== "rebalanceable") return null;
  const shortSides = people(f)
    .filter((x) => x.verdict === "shortage")
    .map((x) => WHO_COVERAGE[x.who]);
  // 名指す相手が取れないときは、どこに足りないのかを言えないので出さない
  if (shortSides.length === 0) return null;
  return `${formatRange(h.reducibleRange.low, h.reducibleRange.high)}は減らせる一方、${shortSides.join("と")}に${formatRange(h.shortageRange.low, h.shortageRange.high)}足りません。`;
}

/** 世帯合計の3列に添える呼び名。2人分を足しているときだけ言う */
export function heroTotalLabel(f: ResultFigures): string | null {
  return f.spouse ? "2人分の合計" : null;
}

/**
 * ケースごとの「いまの保障との差」の1文。**最終の必要額（`need`）との差**を幅で言う。
 * 圏内を「過不足なく足りています」と言わない（幅を跨いでいるだけで、足りているとは言えない）。
 */
export function gapSentence(x: DeathFigures): string {
  switch (x.verdict) {
    case "pending":
      return "現在の保険が未入力のため、過不足の判定は保留しています。証券が見つかったら再診断できます。";
    case "shortage":
      return `いまの保障より、${formatRange(x.gap.low, x.gap.high)} 足りていません。`;
    case "reducible":
      return `いまの保障は、${formatRange(x.gap.low, x.gap.high)} 減らせそうです。`;
    default:
      return "いまの保障は、必要額の幅の中にあります。減らせるとも足りないとも言い切りません。";
  }
}

/**
 * STEP3 の最終行に添える1文。**棒は代表値の内訳、最終行は答えの幅まで広げたレンジ**であることを言う。
 * 言わないと、棒の引き算（代表値）と最終行（幅）が合わないように見える。幅が代表値と同じなら出さない。
 */
export function bandWidenedNote(x: DeathFigures): string | null {
  const p = x.point.range;
  if (p.low === x.need.low && p.high === x.need.high) return null;
  return `上の棒は、答えた区分の代表値で計算した内訳です。この額は、答えた区分の上下端でも計算して広げた幅です（代表値だけなら${formatRange(p.low, p.high)}）。`;
}
