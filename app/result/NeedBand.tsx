/**
 * いつ見直すか：年ごとの必要額の幅（帯）と、公的年金・大学の時期の年表（2026-10-18・レポート形式）。
 *
 * **帯の値はもしもラボと同じもの**（`labDeath` の「回答どおり」の系列）を受け取って描くだけ。
 * 画面で年ごとの必要額を作らない。年表の年と出来事は `projectDeath` の年次（エンジンが
 * 金額の変化から書いた `events`）から取る ── 次の一歩の「次の見直しのめやす」と同じ材料。
 */
import type { Projection } from "../../src/calc/projection.js";
import { manDigits, toMonthlyDisplay } from "../../src/design/ledgerRound.js";
import { formatMan, formatRange } from "../../src/design/tokens.js";
import { RangeText } from "./AmountText.js";
import { ChartFrame, plotBottom, plotTop, xAt, yAt } from "./ChartFrame.js";
import { linearScale } from "./chartScale.js";
import r from "./report.module.css";

export interface BandPoint {
  year: number;
  low: number;
  high: number;
}

/** 図で並べて見せる「いま」と、その何年後か */
const LATER = 10;
/** 月1,000円未満の動きは「公的年金が変わる」と呼ばない（STEP2 の段差と同じ基準） */
const STEP_THRESHOLD = 1000;

interface TimelineItem {
  year: number;
  head: string;
  body: string;
}

function pensionOf(row: Projection["rows"][number]): number {
  return toMonthlyDisplay(
    row.income.pensionBasic + row.income.pensionKosei + row.income.chukoreiKafu,
  );
}

/** 年表。公的年金が変わる年・大学の時期・算定の終わり。**無い出来事は書かない** */
export function timelineItems(
  pj: Projection,
  reviewYear: number | null,
  survivorLabel: string,
): TimelineItem[] {
  const rows = pj.rows;
  const items: TimelineItem[] = [];
  for (let i = 1; i < rows.length; i++) {
    const before = pensionOf(rows[i - 1]);
    const after = pensionOf(rows[i]);
    if (Math.abs(after - before) < STEP_THRESHOLD) continue;
    const events = rows[i].events.filter((e) => e !== "診断の起点");
    items.push({
      year: rows[i].year,
      head: `${rows[i].year}年${rows[i].year === reviewYear ? "　次の見直しのめやす" : ""}`,
      body: `${events.length > 0 ? `${events.join("。")}。` : ""}公的年金 月${manDigits(before)}万円→${after === 0 ? "0円" : `${manDigits(after)}万円`}。`,
    });
  }
  const uni = rows.filter((x) => x.ages.children.some((a) => a >= 18 && a <= 21));
  if (uni.length > 0) {
    const from = uni[0].year;
    const to = uni[uni.length - 1].year;
    items.push({
      year: from,
      head: from === to ? `${from}年　大学の学費` : `${from}〜${to}年　大学の学費`,
      body: "支出が膨らむ時期です。備えの厚みが要るのはこの期間です。",
    });
  }
  const last = rows[rows.length - 1];
  if (last) {
    items.push({
      year: last.year,
      head: `${last.year}年　算定はここまで`,
      body: `${survivorLabel}が65歳になるまでの${rows.length}年を見ています。`,
    });
  }
  // 同じ年なら、年金の変化 → 大学 → 算定の終わり の順（push の順）を保つ
  return items
    .map((x, i) => ({ x, i }))
    .sort((a, b) => a.x.year - b.x.year || a.i - b.i)
    .map(({ x }) => x);
}

export function NeedBand({
  points,
  coverage,
  pj,
  reviewYear,
  survivorLabel,
}: {
  points: BandPoint[];
  /** いまの死亡保障額。分からない（未入力）なら null */
  coverage: number | null;
  pj: Projection;
  /** 次の一歩の「次の見直しのめやす」と同じ年。年表の該当行に添える */
  reviewYear: number | null;
  /** 遺される側の呼び名 */
  survivorLabel: string;
}) {
  const items = timelineItems(pj, reviewYear, survivorLabel);
  if (points.length === 0) return null;

  const n = points.length;
  const now = points[0];
  const laterIndex = Math.min(LATER, n - 1);
  const later = laterIndex > 0 ? points[laterIndex] : null;
  const maxHigh = Math.max(...points.map((p) => p.high));
  const showChart = n >= 2 && maxHigh > 0;
  const hasCoverageLine = coverage !== null && coverage > 0;
  const scale = linearScale(0, Math.max(maxHigh, coverage ?? 0));
  const years = points.map((p) => p.year);
  const indexOf = (year: number) => years.indexOf(year);

  const drops = pj.rows
    .filter(
      (row, i) => i > 0 && Math.abs(pensionOf(row) - pensionOf(pj.rows[i - 1])) >= STEP_THRESHOLD,
    )
    .map((row) => indexOf(row.year))
    .filter((i) => i >= 0);
  const uni = pj.rows
    .filter((row) => row.ages.children.some((a) => a >= 18 && a <= 21))
    .map((row) => indexOf(row.year))
    .filter((i) => i >= 0);
  const half = (plotWidthOf(n) / 2) | 0;

  const band = `${points.map((p, i) => `${xAt(i, n).toFixed(1)},${yAt(scale, p.high).toFixed(1)}`).join(" ")} ${points
    .map((_, k) => {
      const i = n - 1 - k;
      return `${xAt(i, n).toFixed(1)},${yAt(scale, points[i].low).toFixed(1)}`;
    })
    .join(" ")}`;

  const marker = (i: number, label: string) => {
    const p = points[i];
    const x = xAt(i, n);
    const yTop = yAt(scale, p.high);
    const yLow = yAt(scale, p.low);
    const right = i < n * 0.7;
    return (
      <g key={label}>
        <line stroke="var(--fa-navy-700)" strokeWidth="3" x1={x} x2={x} y1={yTop} y2={yLow} />
        <text
          className={r.halo}
          fill="var(--fa-navy-700)"
          fontSize="13.5"
          fontWeight="700"
          textAnchor={right ? "start" : "end"}
          x={x + (right ? 6 : -6)}
          y={(yTop + yLow) / 2 + 5}
        >
          {label}
        </text>
      </g>
    );
  };

  const rangeSummary = (p: BandPoint) => formatRange(p.low, p.high);

  return (
    <>
      <div className={r.pair}>
        <div>
          <span className={r.pairYear}>いま（{now.year}年）</span>
          <span className={r.pairValue}>
            <RangeText text={rangeSummary(now)} />
          </span>
        </div>
        {later && (
          <div>
            <span className={r.pairYear}>
              {laterIndex === LATER ? `${LATER}年後` : `${laterIndex}年後`}（{later.year}年）
            </span>
            <span className={r.pairValue}>
              <RangeText text={rangeSummary(later)} />
            </span>
          </div>
        )}
      </div>

      {/*
        いまの保障の線は、契約がその年まで続くと読まれないよう、図の前後で前提を言う（UX 33回目。ラボと同じ誤読）
      */}
      {showChart && hasCoverageLine && (
        <p className={r.note}>
          いまの保障は、今の額のまま続くものとして横線で描いています。
        </p>
      )}
      {showChart && (
        <ChartFrame
          labelEvery={n > 25 ? 10 : 5}
          legend={[
            {
              label: "その年にあなたに万一があった場合の必要額の幅",
              color: "var(--chart-need-soft)",
            },
            ...(coverage !== null && coverage > 0
              ? [
                  {
                    label: `いまの保障 約${formatMan(coverage)}`,
                    color: "var(--color-accent)",
                    line: true,
                  },
                ]
              : []),
          ]}
          scale={scale}
          summary={`年ごとの必要額の幅。${now.year}年の${rangeSummary(now)}から、${points[n - 1].year}年の${rangeSummary(points[n - 1])}まで。単位は万円。`}
          title="年ごとの必要額の幅（もしもラボと同じ値・万円）"
          years={years}
        >
          {uni.length > 0 && (
            <rect
              fill="var(--color-text)"
              fillOpacity="0.06"
              height={plotBottom - plotTop}
              width={xAt(uni[uni.length - 1], n) - xAt(uni[0], n) + half * 2}
              x={xAt(uni[0], n) - half}
              y={plotTop}
            />
          )}
          <polygon
            fill="var(--chart-need-soft)"
            points={band}
            stroke="var(--chart-need)"
            strokeWidth="1.5"
          />
          {coverage !== null && coverage > 0 && (
            <line
              stroke="var(--color-accent)"
              strokeWidth="2"
              x1={xAt(0, n)}
              x2={xAt(n - 1, n)}
              y1={yAt(scale, coverage)}
              y2={yAt(scale, coverage)}
            />
          )}
          {drops.map((i) => (
            <line
              key={`d${i}`}
              stroke="var(--fa-navy-700)"
              strokeDasharray="3 3"
              x1={xAt(i, n)}
              x2={xAt(i, n)}
              y1={plotTop}
              y2={plotBottom}
            />
          ))}
          {marker(0, "いま")}
          {later && marker(laterIndex, `${laterIndex}年後`)}
        </ChartFrame>
      )}
      {showChart && (
        <p className={r.note}>
          {drops.length > 0 ? "点線：公的年金が変わる年。" : ""}
          {uni.length > 0 ? "灰色：大学の学費の時期。" : ""}
          縦の線：その年の幅。
          {hasCoverageLine && "いまの保障額を一定として表示。満期・更新は反映していません。"}
        </p>
      )}

      {items.length > 0 && (
        <ul className={r.timeline}>
          {items.map((it) => (
            <li key={it.head}>
              <span className={r.timelineHead}>{it.head}</span>
              <span className={r.timelineBody}>{it.body}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** 1年ぶんの横幅（大学の灰色の帯を、年の境目まで広げるため） */
function plotWidthOf(n: number): number {
  return n <= 1 ? 0 : xAt(1, n) - xAt(0, n);
}
