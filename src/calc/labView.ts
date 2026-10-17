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

/** 上昇する隣接区間をまとめ、曲線と同じ中央値から注記の年齢を返す。 */
export function labRisingIntervals(points: Pick<LabPoint, "age" | "middle">[]) {
  const intervals: { from: number; to: number }[] = [];
  for (let i = 1; i < points.length; i++) {
    if (points[i].middle <= points[i - 1].middle) continue;
    const last = intervals.at(-1);
    if (last?.to === points[i - 1].age) last.to = points[i].age;
    else intervals.push({ from: points[i - 1].age, to: points[i].age });
  }
  return intervals;
}
