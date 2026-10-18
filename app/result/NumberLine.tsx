/**
 * STEP4 数直線＋判定カード＋判断ポイント3行（仕様 §5.3・照合表 #8a〜#8c）
 *
 * **移植元は `docs/design-mock/result.html` の STEP 4。**
 * 目盛り・必要額レンジ帯・現保障マーカーという構成を変えない。
 * 座標系だけ 390px 用に組み直す（モックは 900px の絶対配置）。
 *
 * **診断表のミニ数直線とは役割が違うので、両方残す。**
 * あちらは玄関の一覧（カードごとに目盛りが違う）、こちらは根拠の提示（目盛りを明示する）。
 *
 * **金額はここで作らない。** 受け取った額を描くだけ。
 */
import { RangeText, WithAmounts } from "./AmountText.js";
import { VERDICT_AXIS } from "./verdictLabels.js";
import type { DecisionPoint } from "../../src/calc/decisionPoints.js";
import s from "./numberLine.module.css";

export interface NumberLineProps {
  /** 必要額レンジ（円） */
  need: { low: number; high: number };
  /** いまの保障（円）。未入力なら null */
  coverage: number | null;
  fmt: (yen: number) => string;
  /** 過不足の判定（バッジと同じ enum をバインドする） */
  verdict: { label: string; tone: "ok" | "check" | "short" | "none"; body: string };
  points: DecisionPoint[];
}

const MAN = 10_000;

/** 目盛りは1,000万円刻み。上端はデータを含む倍数まで */
function ticksFor(max: number): number[] {
  const step = max > 5000 * MAN ? 2000 * MAN : 1000 * MAN;
  const out: number[] = [];
  for (let v = 0; v <= max; v += step) out.push(v);
  return out;
}

/**
 * **文字を付ける目盛りは4つまで**（2026-10-17・UX レビュー2回目）。
 *
 * 390px では線の幅がおよそ 290px で、「10,000万」級の文字は1つ 45px ほどある。
 * 7本すべてに文字を付けると隣どうしが重なり、必要額と現在額の位置関係が読めなかった。
 * 目盛りの線は全部残し、文字は 0 から等間隔に間引く。
 */
export const MAX_TICK_LABELS = 4;
export function labeledTicks(ticks: number[]): Set<number> {
  const n = ticks.length;
  if (n <= MAX_TICK_LABELS) return new Set(ticks);
  // 0 から等間隔に、文字が4つ以下になる最小の間隔
  const every = Math.ceil((n - 1) / (MAX_TICK_LABELS - 1));
  return new Set(ticks.filter((_, i) => i % every === 0));
}

/** 目盛りの文字。1億以上は「億」で書く（「12,000万」ではなく「1.2億」） */
export function tickText(v: number): string {
  if (v === 0) return "0";
  const man = v / MAN;
  if (man >= 10_000)
    return `${(man / 10_000).toLocaleString("ja-JP", { maximumFractionDigits: 1 })}億`;
  return `${man.toLocaleString("ja-JP")}万`;
}

export function NumberLine({ need, coverage, fmt, verdict, points }: NumberLineProps) {
  const top = Math.max(need.high, coverage ?? 0);
  const step = top > 5000 * MAN ? 2000 * MAN : 1000 * MAN;
  /**
   * **上限は最大値の1目盛り先に取る。**
   * ぴったりに取ると、最大値のマーカーが右端に張り付いて見切れる
   * （2026-09-21：保障3,000万・上限3,000万でマーカーが端に重なった）。
   * 視覚の DoD (c)「色と位置で一覧走査できる」は、端が見えていないと成立しない。
   */
  const max = Math.ceil((top + 1) / step) * step;
  const pct = (v: number) => 4 + (v / max) * 92;
  const ticks = ticksFor(max);
  const labeled = labeledTicks(ticks);

  return (
    <div className={s.wrap}>
      <p className={s.lead}>
        必要額の幅と、いまの保障を1本の数直線に重ねます。過不足の判定の根拠はこの位置関係だけです。
      </p>

      <div className={s.lineBox}>
        <svg
          className={s.line}
          height="76"
          role="img"
          aria-label={`必要額は${fmt(need.low)}から${fmt(need.high)}、いまの保障は${coverage === null ? "未入力" : fmt(coverage)}。`}
        >
          <line className={s.axis} x1="4%" x2="96%" y1="46" y2="46" />

          {ticks.map((v) => (
            <g key={v}>
              <line className={s.tick} x1={`${pct(v)}%`} x2={`${pct(v)}%`} y1="46" y2="53" />
              {labeled.has(v) && (
                <text className={s.tickText} x={`${pct(v)}%`} y="66" textAnchor="middle">
                  {tickText(v)}
                </text>
              )}
            </g>
          ))}

          {/* 必要額の幅。**幅が無いときは帯ではなく目盛り**（他の図と同じ文法） */}
          {need.low === need.high ? (
            <line
              className={s.needTick}
              x1={`${pct(need.low)}%`}
              x2={`${pct(need.low)}%`}
              y1="32"
              y2="46"
            />
          ) : (
            <rect
              className={s.band}
              x={`${pct(need.low)}%`}
              width={`${pct(need.high) - pct(need.low)}%`}
              y="32"
              height="14"
            />
          )}

          {coverage !== null && (
            <line
              className={s.cov}
              x1={`${pct(coverage)}%`}
              x2={`${pct(coverage)}%`}
              y1="8"
              y2="46"
            />
          )}
        </svg>

        <div className={s.marks}>
          <span className={s.markNeed}>
            必要額のめやす{" "}
            <RangeText
              text={need.low === need.high ? fmt(need.low) : `${fmt(need.low)}〜${fmt(need.high)}`}
            />
          </span>
          <span className={s.markCov}>
            いまの保障 <RangeText text={coverage === null ? "未入力" : fmt(coverage)} />
          </span>
        </div>
      </div>

      <div className={`${s.verdict} ${s[verdict.tone]}`}>
        <p className={s.verdictTitle}>
          <span aria-hidden="true">{TONE_ICON[verdict.tone]} </span>
          {VERDICT_AXIS}：{verdict.label}
        </p>
        <p className={s.verdictBody}>{verdict.body}</p>
      </div>

      <p className={s.rule}>
        過不足の判定のルール
        —「減らせる」は、厳しめの前提（幅の右端）で計算しても保障が上回るときにだけ言い切ります。
        幅がいまの保障を跨ぐときは、言い切らずに「要精査」に降ろします。
      </p>

      {/* #8c 判断ポイント。**全行がエンジンの導出値**で、手書きの固定文ではない */}
      <div className={s.points}>
        <p className={s.pointsHead}>あなたの判断ポイント — {points.length}行で</p>
        <ol className={s.pointList}>
          {points.map((p, i) => (
            <li className={s.point} key={p.label}>
              <span className={s.pointNum}>{i + 1}</span>
              <div>
                <p className={s.pointLabel}>
                  <WithAmounts text={p.label} />
                </p>
                <p className={s.pointBody}>
                  <WithAmounts text={p.body} />
                </p>
              </div>
            </li>
          ))}
        </ol>
        {/*
          閉じ文（照合表 #8c）。**#4 のトグルが存在して初めて真になる文**なので、
          トグルと同時に入れた（2026-09-21）。
        */}
        <p className={s.closing}>
          この{points.length}点を頭に置いて、上の「暮らし方の前提」を選び直してみてください。
          {/* モックは「判定が連動して変わります」。ample 世帯では偽になるので同じ型に揃える */}
          下の計算と判定は、その前提で計算し直されます。
        </p>
        {/* ラボは未実装。**押せないことを黙らせない** */}
        <p className={s.pending}>もしもラボで「この場合は？」を試す（準備中）</p>
      </div>
    </div>
  );
}

/** 判定カードの見出しの記号。判定は記号＋ラベル＋色の3点で出す（診断表のバッジと同じ記号） */
const TONE_ICON = { ok: "✓", check: "↔", short: "!", none: "…" } as const;
