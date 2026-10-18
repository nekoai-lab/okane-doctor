// クライアント（app/lab/Lab.tsx）から呼ぶ純粋関数。lab.ts は params（node:fs）を読むので、
// ブラウザ側のバンドルに入らないようにこちらへ分けた。
import { verdict3 } from "./verdict3.js";
import type { LabPoint } from "./lab.js";

/** 現保障との差の幅。判定の境界は既存 verdict3 に委譲する。 */
export function labCoverageDifference(coverage: number | null, low: number, high: number) {
  const verdict = verdict3(coverage, low, high);
  if (coverage === null) return { verdict, low: null, high: null };
  if (verdict === "reducible") return { verdict, low: coverage - high, high: coverage - low };
  if (verdict === "shortage") return { verdict, low: low - coverage, high: high - coverage };
  return { verdict, low: coverage - low, high: high - coverage };
}

/**
 * 必要額が上がる理由（エンジンの材料から決める。画面に理由を書き写さない）。
 * - `work_end`：配偶者の就労収入を見込む年齢（当社基準・ADR-030）を過ぎ、支えが減った
 * - `range_rule`：必要額の判定（ニーズ軸）が変わり、幅の作り方が切り替わった
 *   （小さな不足や小さな余裕は、葬儀・予備費に生活費の数か月分を足した幅で示す）
 * - `support_drop`：1年進むと、減る支出より減る支え（年金・就労収入など）のほうが大きい
 *   （回答の代表条件で確かめる）
 * - `other`：上のどれでもない
 */
export type LabRiseCause = "work_end" | "range_rule" | "support_drop" | "other";

type RisePoint = Pick<LabPoint, "age" | "middle"> &
  Partial<Pick<LabPoint, "spouseWorkCounted" | "needVerdicts" | "expenseTotal" | "incomeTotal">>;

function riseCause(prev: RisePoint, cur: RisePoint): LabRiseCause {
  if (prev.spouseWorkCounted && cur.spouseWorkCounted === false) return "work_end";
  if (
    prev.needVerdicts &&
    cur.needVerdicts &&
    prev.needVerdicts.some((v, i) => v !== cur.needVerdicts?.[i])
  )
    return "range_rule";
  if (
    prev.expenseTotal !== undefined &&
    prev.incomeTotal !== undefined &&
    cur.expenseTotal !== undefined &&
    cur.incomeTotal !== undefined &&
    prev.incomeTotal - cur.incomeTotal > prev.expenseTotal - cur.expenseTotal
  )
    return "support_drop";
  return "other";
}

/** 上昇する隣接区間をまとめ、曲線と同じ中央値から注記の年齢を返す。理由は区間の中で最も根に近いもの */
export function labRisingIntervals(points: RisePoint[]) {
  const intervals: { from: number; to: number; cause: LabRiseCause }[] = [];
  const rank: LabRiseCause[] = ["work_end", "range_rule", "support_drop", "other"];
  for (let i = 1; i < points.length; i++) {
    if (points[i].middle <= points[i - 1].middle) continue;
    const cause = riseCause(points[i - 1], points[i]);
    const last = intervals.at(-1);
    if (last?.to === points[i - 1].age) {
      last.to = points[i].age;
      if (rank.indexOf(cause) < rank.indexOf(last.cause)) last.cause = cause;
    } else intervals.push({ from: points[i - 1].age, to: points[i].age, cause });
  }
  return intervals;
}
