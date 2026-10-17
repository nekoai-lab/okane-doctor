/**
 * 当社基準で補った前提を、回答と取り違えさせない（UX レビュー「判断を誤らせる」#4・2026-10-17）。
 *
 * 遺される人の年収が0円の世帯でも、算定は「末子独立後に年100万円ほど働く」（当社基準 `postIndepMinIncome`）を置き、
 * 不足世帯ではそれだけで約1,000万円の就労収入が入る。以前の画面は
 * - 滝グラフの「就労収入 ▲約1,000万円」に `回答: 配偶者の年収` と添え、
 * - STEP1 は「推定で補った項目はありません」と書いていた。
 * 出どころは `death.ts` が `survivor.income`（reason: estimated）として記録している。ここはそれを読むだけ。
 */
import type { DeathResult } from "../../src/calc/types.js";
import { formatMan } from "../../src/design/tokens.js";

const FIELD = "survivor.income";

function estimatedWork(r: DeathResult) {
  return r.assumptions.find((a) => a.field === FIELD && a.reason === "estimated");
}

/** STEP1 の「推定で補った項目」に足す行。ウィザードの推定と同じ形 */
export function ownStandardEstimates(
  r: DeathResult,
  survivorLabel: string,
): { field: string; label: string; note: string }[] {
  const a = estimatedWork(r);
  if (!a) return [];
  return [{ field: FIELD, label: `${survivorLabel}の就労収入（当社基準の見立て）`, note: a.note }];
}

/** 滝グラフの就労収入の行の出どころ。回答から来たのか、当社基準の見立てなのかを名乗る */
export function workDeductionSource(
  r: DeathResult,
  survivorLabel: string,
): { fromLabel: string; from: string } {
  const a = estimatedWork(r);
  if (a && typeof a.value === "number") {
    return {
      fromLabel: "当社基準",
      from: `お子さんの独立後に年${formatMan(a.value)}ほど働く前提（答えた年収は0円）`,
    };
  }
  return { fromLabel: "回答", from: `${survivorLabel}の年収` };
}
