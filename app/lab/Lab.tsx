"use client";
import Link from "next/link";
import { useState } from "react";
import type { LabData, LabPoint } from "../../src/calc/lab.js";
import {
  type LabRiseCause,
  labCoverageDifference,
  labRisingIntervals,
} from "../../src/calc/labView.js";
import { AppHeader, Button, VerdictBadge } from "../../src/design/fintech/index.js";
import { VERDICT_BADGE } from "../../src/design/fintech/verdict.js";
import { formatMan, formatRange } from "../../src/design/tokens.js";
import {
  describeLabChanges,
  type LabChanges,
  type LabScenarioId,
  WORK_IDS,
} from "../../src/lab/words.js";
import { linearScale } from "../result/chartScale.js";
import { Fold } from "../result/Fold.js";
import { HERO_BADGE } from "../result/Hero.js";
import { SAVINGS_LABEL as SAVINGS_VERDICT } from "../result/verdictLabels.js";
import s from "./page.module.css";
import { Ledger, NEED_LABEL } from "./Ledger.js";
import { Words } from "./Words.js";
import { workPlanNote, zeroIncomeNote } from "./workNote.js";

const SCENARIO_TITLE: Record<string, string> = {
  hospital: "短期入院・手術",
  injury: "けがによる3か月の休職",
  stroke: "脳卒中・心筋梗塞による半年の休職",
  cancer: "がんによる1年の休職",
  mental: "こころの不調による休職",
};
/** 貯蓄の判定の言葉は結果画面と同じ表。アイコンは VerdictBadge が VERDICT_BADGE から付ける（✓ ↔ ! …） */
const SAVINGS_LABEL = { ...SAVINGS_VERDICT, pending: "未算定" };
const WORK_LABEL = ["回答どおり", "半分", "ゼロ"] as const;

/** 必要額が上がる理由。どれを出すかはエンジンの材料（labRisingIntervals）が決める */
const RISE_REASON: Record<LabRiseCause, (workEndAge: number) => string> = {
  work_end: (age) => `配偶者が${age}歳になる年から就労収入を見込まないので、支えが減るためです。`,
  range_rule: () =>
    "不足や余裕が小さくなると、葬儀・予備費に生活費の数か月分を足した幅で示すためです。",
  support_drop: () =>
    "年齢が進むと、減る支出より、減る支え（年金や就労収入）のほうが大きくなるためです。",
  other: () => "この年齢で計算の内訳が変わるためです。",
};

/** 年収の表示。0円に「約」を付けない（少しの収入があるように読める・PR #32 の UX レビュー） */
function incomeText(yen: number): string {
  return yen === 0 ? "0円" : `約${formatMan(yen)}`;
}

function AmountRange({ low, high }: { low: number; high: number }) {
  const [start, end] = formatRange(low, high).split("〜");
  return (
    <span className={s.amountRange}>
      <span className={s.amountEnd}>
        {start}
        {end !== undefined && "〜"}
      </span>
      {end !== undefined && (
        <>
          <wbr />
          <span className={s.amountEnd}>{end}</span>
        </>
      )}
    </span>
  );
}
function Comparison({ point }: { point: LabPoint }) {
  return (
    <span className={s.verdictBadge}>
      <VerdictBadge
        {...VERDICT_BADGE[point.verdict]}
        label={HERO_BADGE[point.verdict]}
        axis="過不足の判定"
      />
    </span>
  );
}
function SavingsBadge({
  verdict,
  small = false,
}: {
  verdict: keyof typeof SAVINGS_LABEL;
  /** 閉じた行の見出しに添える小さい版（2026-10-17・Codex の UX レビュー） */
  small?: boolean;
}) {
  return (
    <span className={small ? s.rowBadge : s.verdictBadge}>
      <VerdictBadge {...VERDICT_BADGE[verdict]} label={SAVINGS_LABEL[verdict]} axis="貯蓄の判定" />
    </span>
  );
}

/** 言葉で変えた条件を、効いている図のすぐ上で名乗る（文はコードの表。2026-10-17 UX レビュー） */
function AppliedNote({ changes }: { changes: LabChanges }) {
  return (
    <p className={s.wordsApplied}>言葉で変えた条件：{describeLabChanges(changes).join("・")}</p>
  );
}

/** 目盛りの数字（万円・単位は軸の上に1回だけ）。「1億5,000万円」のような長い目盛りが描く幅を食っていた */
function tickMan(yen: number): string {
  return Math.round(yen / 10_000).toLocaleString("ja-JP");
}

/** lab.html の帯・中央線・差の塗り・選択線を移植。座標だけ回答データに結び付ける。 */
function Curve({
  points,
  selected,
  coverage,
  mobile = false,
}: {
  points: LabPoint[];
  selected: LabPoint;
  coverage: number | null;
  mobile?: boolean;
}) {
  const scale = linearScale(0, Math.max(coverage ?? 0, ...points.map((p) => p.high)));
  /*
   * 描く幅を広げる（2026-10-18・Codex の UX 再判定）。目盛りを「万円」の数字だけにして単位は軸の上に1回置き、
   * 両端の年齢は内側にそろえて余白を削った。390px で描画域が 304px 中 161px（53%）しかなかった
   */
  const left = mobile ? 46 : 56;
  const right = mobile ? 254 : 648;
  const bottom = mobile ? 276 : 200;
  const font = mobile ? 13 : 12.5;
  const x = (age: number) =>
    left +
    ((age - points[0].age) / Math.max(1, points[points.length - 1].age - points[0].age)) *
      (right - left);
  const y = (amount: number) => bottom - scale.pos(amount) * (bottom - 40);
  const coords = (ps: LabPoint[], value: (p: LabPoint) => number) =>
    ps.map((p) => `${x(p.age)},${y(value(p))}`).join(" ");
  return (
    <svg
      className={`${s.chart} ${mobile ? s.mobileChart : s.desktopChart}`}
      viewBox={mobile ? "0 0 260 318" : "0 0 660 238"}
      role="img"
      aria-label="本人が亡くなった年齢ごとの必要保障額。帯は必要額の幅、黒線は現保障、緑の塗りは必要額の上端を上回る部分。単位は万円。"
    >
      {scale.ticks.map((t) => (
        <g key={t}>
          <line x1={left} x2={right} y1={y(t)} y2={y(t)} stroke="var(--color-border)" />
          <text
            x={left - 4}
            y={y(t) + 4}
            textAnchor="end"
            fontSize={font}
            fill="var(--color-text-muted)"
          >
            {tickMan(t)}
          </text>
        </g>
      ))}
      {/* 目盛りの単位。数字だけの目盛りの桁が分かるよう、軸の上に1回だけ置く */}
      <text x={left - 4} y={28} textAnchor="end" fontSize={font} fill="var(--color-text-muted)">
        万円
      </text>
      {coverage !== null && (
        <polygon
          points={`${coords(points, () => coverage)} ${coords([...points].reverse(), (p) => Math.min(coverage, p.high))}`}
          fill="var(--color-success)"
          fillOpacity="0.12"
        />
      )}
      <polygon
        points={`${coords(points, (p) => p.high)} ${coords([...points].reverse(), (p) => p.low)}`}
        fill="var(--chart-need-range, var(--color-warning))"
        fillOpacity="var(--chart-need-range-opacity, 0.18)"
      />
      <polyline
        points={coords(points, (p) => p.middle)}
        fill="none"
        stroke="var(--chart-need-line, var(--color-warning))"
        strokeWidth="2.5"
      />
      {coverage !== null && (
        <>
          <line
            x1={left}
            x2={right}
            y1={y(coverage)}
            y2={y(coverage)}
            stroke="var(--color-text)"
            strokeWidth="3"
            strokeDasharray="8 5"
          />
          {/* 点線＝いまの額を延ばした仮定。確かなのは左端（いま）だけなので、そこにだけ点を打つ（2026-10-17 UX） */}
          {coverage > 0 && <circle cx={left} cy={y(coverage)} r="5" fill="var(--color-text)" />}
          {coverage > 0 && (
            <text
              x={(left + right) / 2}
              y={Math.max(14, y(coverage) - 8)}
              textAnchor="middle"
              fontSize={font}
              fill="var(--color-text)"
            >
              {`いまの保険 約${formatMan(coverage)}`}
            </text>
          )}
        </>
      )}
      {coverage !== null && points.some((p) => coverage > p.high) && (
        <text
          x={mobile ? 130 : 400}
          // 図の上の余白に置く。中ほどに置くと「いまの保険」のラベルと重なる（1280px・2026-10-18 UX レビュー2回目）
          y={14}
          textAnchor="middle"
          fontSize={font}
          fill="var(--color-success-text)"
        >
          緑の差＝見直しの余地
        </text>
      )}
      <text
        x={mobile ? 186 : 500}
        y={mobile ? 204 : 152}
        textAnchor="middle"
        fontSize={font}
        fill="var(--chart-need-line, var(--color-warning-text))"
      >
        {mobile ? "必要額の幅" : "必要額のめやす（幅）"}
      </text>
      <line
        x1={x(selected.age)}
        x2={x(selected.age)}
        y1="26"
        y2={bottom}
        stroke="var(--color-text)"
        strokeDasharray="4 4"
      />
      <circle
        cx={x(selected.age)}
        cy={y(selected.middle)}
        r="6"
        fill="var(--chart-need-line, var(--color-warning))"
        stroke="var(--color-surface)"
        strokeWidth="2"
      />
      <line x1={left} x2={right} y1={bottom} y2={bottom} stroke="var(--color-border)" />
      {/* 途中の年齢にも目盛り（5歳ごと）。スマホは年齢だけ、両端だけ西暦も添える（2026-10-18・Codex） */}
      {points
        .filter((p, i) => i > 0 && i < points.length - 1 && p.age % 5 === 0)
        .map((p) => (
          <line
            key={`t${p.age}`}
            x1={x(p.age)}
            x2={x(p.age)}
            y1={bottom}
            y2={bottom + 5}
            stroke="var(--color-border)"
          />
        ))}
      {(() => {
        const label = (p: LabPoint, i: number) => (i === 0 ? `いま（${p.age}歳）` : `${p.age}歳`);
        // 文字幅の見積もり（数字は全角の約0.6）。重なる途中の年齢は出さない（目盛りの線は残す）
        const width = (text: string) =>
          [...text].reduce((w, c) => w + (/[0-9]/.test(c) ? 0.6 : 1), 0) * font;
        const first = points[0];
        const last = points[points.length - 1];
        const firstEnd = x(first.age) + width(label(first, 0)) + 6;
        const lastStart = x(last.age) - width(label(last, 1)) - 6;
        const middle: LabPoint[] = [];
        for (const p of points.slice(1, -1)) {
          if (p.age % 5 !== 0) continue;
          const half = width(label(p, 1)) / 2;
          const prev = middle[middle.length - 1];
          if (x(p.age) - half < firstEnd || x(p.age) + half > lastStart) continue;
          if (prev && x(p.age) - half < x(prev.age) + width(label(prev, 1)) / 2 + 6) continue;
          middle.push(p);
        }
        const shown = [first, ...middle, ...(points.length > 1 ? [last] : [])];
        return shown.map((p, i) => {
          const isFirst = i === 0;
          const isLast = i === shown.length - 1 && points.length > 1;
          // 両端は内側にそろえる（中央ぞろえだと viewBox からはみ出すので、そのぶん余白が要った）
          const anchor = isFirst ? "start" : isLast ? "end" : "middle";
          return (
            <g key={p.age} textAnchor={anchor} fill="var(--color-text-muted)">
              <text x={x(p.age)} y={bottom + 18} fontSize={font}>
                {label(p, isFirst ? 0 : 1)}
              </text>
              {(!mobile || isFirst || isLast) && (
                <text x={x(p.age)} y={bottom + 34} fontSize={font}>
                  {p.year}年
                </text>
              )}
            </g>
          );
        });
      })()}
    </svg>
  );
}

export function Lab({
  data,
  back,
  date,
  version,
  estimations,
  query,
  aiEnabled,
}: {
  data: LabData;
  back: string;
  date: string;
  version: string;
  estimations: string[];
  /** 結果画面と同じ回答のクエリ（言葉の翻訳に渡す。金額は載っていない） */
  query: string;
  /** 鍵が無いときは言葉の入力を出さず「準備中」のまま（AI を止めてもラボは成立する） */
  aiEnabled: boolean;
}) {
  const [work, setWork] = useState(0);
  const [age, setAge] = useState(data.minAge);
  const [openScenario, setOpenScenario] = useState<LabScenarioId | null>(null);
  const [applied, setApplied] = useState<LabChanges | null>(null);
  /** 言葉で受け取った変更を、ふだんの操作と同じ state に当てる（計算はここでは起きない） */
  const applyWords = (c: LabChanges) => {
    setApplied(c);
    if (c.deathAge !== undefined) setAge(c.deathAge);
    if (c.spouseWork) setWork(WORK_IDS.indexOf(c.spouseWork));
    if (c.scenario) setOpenScenario(c.scenario);
    const target =
      c.deathAge !== undefined
        ? "timing"
        : c.spouseWork
          ? "work"
          : c.scenario
            ? `scenario-${c.scenario}`
            : null;
    if (target)
      requestAnimationFrame(() =>
        document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
  };
  const scenario = data.work[work];
  const base = data.work[0].points.find((p) => p.age === data.minAge);
  const changed = age !== data.minAge || work !== 0;
  const spouseIncomeIsZero = data.work[0].now.annualIncome === 0;
  const point = scenario.points.find((p) => p.age === age);
  const difference = point ? labCoverageDifference(data.coverage, point.low, point.high) : null;
  const rising = labRisingIntervals(scenario.points);
  const duration = `${Math.floor(data.maxBenefitMonths / 12)}年${data.maxBenefitMonths % 12}か月`;
  return (
    <>
      <AppHeader title="お金の町医者" />
      <main className={s.page}>
        <nav className={s.back}>
          <Link href={back}>← 結果画面で全体を見る</Link>
        </nav>
        <header>
          <p className={s.eyebrow}>もしもを確かめる</p>
          <h1>もしもラボ</h1>
          <p className={s.lead}>
            軽く短いもしもは公的な支えと貯蓄で受け止め、保険は重く長いもしもの足りない分に備えます。
          </p>
          <p>時期や働き方で、その必要額がどう変わるかを確かめます。</p>
          <p className={s.note}>
            概算・要精査 ／ 算定基準日 {date} ／ 使用パラメータ版 {version}
          </p>
        </header>
        {/* 言葉の入口は先頭。カードは小さく保つ（ヘッダーから最初の図までを1画面に収める・視覚 DoD (a)） */}
        {aiEnabled && <Words query={query} hasSpouse={data.hasSpouse} onApply={applyWords} />}
        {/* 死亡保障のカードは1枚（2026-10-18・UX レビュー：時期のカードと「現在の年齢」のカードに
            同じ金額と判定が2回出ていた）。スライダーの初期値がいまの年齢なので、ここが現在の年齢の死亡保障を兼ねる */}
        <section className={s.card} id="timing">
          <span id="scenario-death" />
          <h2>{point ? `死亡保障：あなたが${point.age}歳で亡くなった場合` : "死亡保障"}</h2>
          {applied?.deathAge === age && <AppliedNote changes={{ deathAge: age }} />}
          {applied?.scenario === "death" && <AppliedNote changes={{ scenario: "death" }} />}
          {point ? (
            <>
              <div className={s.readout} aria-live="polite">
                <span>
                  本人の万一：{point.age}歳（{point.year}年）
                </span>
                <span>{NEED_LABEL[point.ledger.rangeVerdict]}</span>
                <strong className={s.amount}>
                  {<AmountRange low={point.low} high={point.high} />}
                </strong>
                <span>
                  {point.children.length
                    ? `お子さん：${point.children.map((a) => `${a}歳`).join("・")}`
                    : "お子さんなし"}
                </span>
                {/* 保険なしの世帯では差＝必要額そのもので、同じ額の繰り返しになるので出さない */}
                {difference && data.coverage !== 0 && (
                  <p data-difference="">
                    {difference.verdict === "pending" ? (
                      "いまの保険が不明のため、差は未算定です。"
                    ) : difference.verdict === "uncertain" ? (
                      "いまの前提では、いまの保険は必要額の幅の中に収まる可能性があります。"
                    ) : (
                      // 何が何を上回る（足りない）のかを先に名乗る。必要額と差は別の事実なので、
                      // 両端の和がいまの保険と同じ世帯で同じ数字になっても、ラベルを分けて出す（PR #32 の UX レビュー）
                      <>
                        {difference.verdict === "shortage"
                          ? "いまの保険が必要額に足りない分："
                          : "いまの保険が必要額を上回る分："}
                        <AmountRange low={difference.low!} high={difference.high!} />
                      </>
                    )}
                  </p>
                )}
                <Comparison point={point} />
              </div>
              {changed && base && (
                // 直前の状態ではなく、いつも診断時の条件と比べる（サンプル v2）。いまの額は上の読み出しが持つ
                <div className={s.compare}>
                  <p>
                    診断時の条件（{base.age}歳・{WORK_LABEL[0]}）では
                    <AmountRange low={base.low} high={base.high} />
                    {base.verdict === point.verdict
                      ? "で、過不足の判定は変わりません。"
                      : "でした。過不足の判定が変わります。"}
                  </p>
                  <button
                    type="button"
                    className={s.linkButton}
                    onClick={() => {
                      setAge(data.minAge);
                      setWork(0);
                    }}
                  >
                    診断時の条件に戻す
                  </button>
                </div>
              )}
              <p className={s.note}>
                下の病気・けが・休職の金額とは算定対象が異なるため、金額の大小を直接比較しません。
              </p>
              <label className={s.sliderLabel} htmlFor="lab-age">
                万一の年齢：{age}歳
              </label>
              <input
                className={s.slider}
                id="lab-age"
                type="range"
                min={data.minAge}
                max={64}
                step={1}
                value={age}
                aria-valuetext={`${age}歳、必要保障額${formatRange(point.low, point.high)}`}
                disabled={data.minAge === 64}
                onChange={(e) => setAge(Number(e.target.value))}
              />
              <div className={s.sliderEnds}>
                <span>いま（{data.minAge}歳）</span>
                <span>64歳</span>
              </div>
              {data.hasSpouse && (
                <div id="work" className={s.workBox}>
                  {applied?.spouseWork && applied.spouseWork === WORK_IDS[work] && (
                    <AppliedNote changes={{ spouseWork: applied.spouseWork }} />
                  )}
                  {spouseIncomeIsZero ? (
                    <p className={s.note}>
                      配偶者の年収は0円の回答なので、働き方の切り替えはありません。
                      {data.spouseWork && zeroIncomeNote(data.spouseWork)}
                    </p>
                  ) : (
                    <fieldset className={s.buttons}>
                      <legend>配偶者の就労収入</legend>
                      {WORK_LABEL.map((label, i) => (
                        <button
                          type="button"
                          key={label}
                          aria-pressed={work === i}
                          onClick={() => setWork(i)}
                        >
                          {work === i && <span aria-hidden="true">✓ </span>}
                          {label}
                          <span className={s.buttonIncome}>
                            年収 {incomeText(data.work[i].now.annualIncome ?? 0)}
                          </span>
                        </button>
                      ))}
                    </fieldset>
                  )}
                  {work === 2 && (
                    <p className={s.note}>
                      「ゼロ」は働かない前提です。当社基準で見込んでいた就労収入も外して計算しています。
                    </p>
                  )}
                </div>
              )}
              <p className={s.chartPremise}>
                いまの収入・生活費・貯蓄・ローン残高のまま、家族の年齢だけを進めた試算です。
              </p>
              <p className={s.legend}>
                {[
                  "帯：必要額の幅",
                  "線：まんなかの目安",
                  "点：選択した年齢",
                  ...(data.coverage !== null && data.coverage > 0 ? ["黒い点線：いまの保険"] : []),
                ].map((item, i) => (
                  <span key={item}>
                    {i > 0 && "／"}
                    <span className={s.legendItem}>{item}</span>
                  </span>
                ))}
              </p>
              <Curve points={scenario.points} selected={point} coverage={data.coverage} />
              <Curve points={scenario.points} selected={point} coverage={data.coverage} mobile />
              {data.coverage === 0 && <p className={s.note}>いまの保険 なし</p>}
              {data.coverage !== null && data.coverage > 0 && (
                <p className={s.note}>
                  満期・更新は見ていません。満期が先に来る保険なら、その年齢からの保障はこの点線より少なくなります。
                </p>
              )}
              {rising.length > 0 && (
                <p className={s.note}>
                  {(["work_end", "range_rule", "support_drop", "other"] as const)
                    .map((cause) => ({ cause, ages: rising.filter((r) => r.cause === cause) }))
                    .filter((g) => g.ages.length > 0)
                    .map(
                      (g) =>
                        `${g.ages.map((r) => `${r.from}〜${r.to}歳`).join("・")}では必要額が上がります。${RISE_REASON[g.cause](data.spouseWork?.endAge ?? 0)}`,
                    )
                    .join("")}
                </p>
              )}
              <Fold label="年齢ごとの金額" count={`（${scenario.points.length}年分）`}>
                <table className={s.table}>
                  <thead>
                    <tr>
                      <th>本人の年齢</th>
                      <th>必要保障額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scenario.points.map((p) => (
                      <tr key={p.age}>
                        <td>
                          {p.age}歳<br />
                          {p.year}年
                        </td>
                        <td>{<AmountRange low={p.low} high={p.high} />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Fold>
            </>
          ) : (
            <div className={s.readout} aria-live="polite">
              <span>資産を差し引いた後の必要保障額（現在の年齢）</span>
              <strong className={s.amount}>
                {<AmountRange low={scenario.now.low} high={scenario.now.high} />}
              </strong>
              <Comparison point={scenario.now} />
            </div>
          )}
          <Fold label="時期の試算の前提" count="（5項目）">
            <ul>
              <li>
                本人が亡くなった場合の必要保障額です。成長に伴い変わり、必ず下がるとは限りません。
              </li>
              <li>
                現在の制度・収入・生活費・資産・ローン残高を固定し、家族の年齢だけを進めます。今後の貯蓄や返済が進めば必要額は下がりえます。
              </li>
              <li>
                制度改正は予測していません。現保障は満期・更新を確認していないため、いまの額を延ばした点線です。緑の塗りは必要額の上端を上回る部分です。
              </li>
              <li>対象はいまの年齢から64歳までです。死亡シナリオは現在の年齢で計算します。</li>
              <li>
                {point?.children.length
                  ? `選択年齢のお子さん：${point.children.map((a) => `${a}歳`).join("・")}`
                  : "選択年齢のお子さんなし"}
                。{point?.crossing ?? "回答の幅を必要額の帯に反映しています。"}
              </li>
            </ul>
          </Fold>
          <Fold label="死亡算定の前提" count={`（${scenario.now.assumptions.length + 4}項目）`}>
            <ul>
              <li>
                生活費・教育費から遺族年金・就労収入・資産を差し引きます。葬儀・予備費などの当社基準も含みます。資産は反映済みなので、貯蓄と再比較せず保障の過不足を示します。
              </li>
              <li>
                遺族年金は、亡くなった方に支えられていた家族への年金です。配偶者は妻として計算し、夫の場合は受給条件により必要額が増えることがあります。
              </li>
              <li>{scenario.now.crossing ?? "回答の幅を必要額に反映しています。"}</li>
              {scenario.now.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
              <li>出典：{data.deathSource}</li>
            </ul>
          </Fold>
          {data.hasSpouse && !spouseIncomeIsZero && (
            <Fold label="就労の前提" count="（3項目）">
              <ul>
                <li>
                  試算する年収は{incomeText(scenario.now.annualIncome ?? 0)}
                  です。回答額・半分・ゼロを比較します。
                </li>
                <li>
                  区分の年収は代表値で表示します。必要額には回答帯の幅も反映します。死亡の場合だけに適用し、生活費は固定します。
                </li>
                {data.spouseWork && <li>{workPlanNote(data.spouseWork)}</li>}
              </ul>
            </Fold>
          )}
        </section>
        {point && <Ledger data={data} point={point} work={work} />}
        <section className={s.card}>
          <h2>病気・けが・休職</h2>
          <p>
            <strong>金額は、貯蓄を差し引く前の負担です。</strong>
            それぞれ単独の試算なので、足し合わせません。
          </p>
          <div className={s.scenarios}>
            {data.sickness.map((item, i) => (
              <Fold
                key={item.id}
                label={`${i + 1}. ${SCENARIO_TITLE[item.id]}`}
                count={
                  <>
                    <AmountRange low={item.need.low} high={item.need.high} />
                    <SavingsBadge verdict={item.savingsVerdict} small />
                  </>
                }
                countClassName={s.scenarioAmount}
                id={`scenario-${item.id}`}
                open={openScenario ? openScenario === item.id : i === 0}
              >
                {applied?.scenario === item.id && <AppliedNote changes={{ scenario: item.id }} />}
                <dl className={s.sickList}>
                  <div>
                    <dt>使う公的な支え</dt>
                    <dd>
                      {data.employee
                        ? "保険診療の自己負担には高額療養費で月ごとの上限があります。働けない間の傷病手当金を見込みます。"
                        : "保険診療の自己負担には高額療養費で月ごとの上限があります。傷病手当金は見込んでいません。"}
                    </dd>
                  </div>
                  <div>
                    <dt>家計への影響</dt>
                    <dd>
                      {item.id === "mental"
                        ? `休職が${duration}を超えると、生活資金がさらに必要です。`
                        : `休職${item.months}か月の医療費・収入の減りを見ています。長引けば負担は増えます。`}
                    </dd>
                  </div>
                </dl>
                <Fold
                  label="制度と計算の前提"
                  count={`（${item.need.assumptions.length + 5}項目）`}
                >
                  <ul>
                    <li>
                      休職{item.months}
                      か月の制度式による概算です。病名ごとの医療費予測ではありません。貯蓄を差し引く前の負担です。
                    </li>
                    <li>
                      高額療養費は、保険診療の自己負担に月ごとの上限を設ける制度です。
                      {data.employee
                        ? "働けない間の収入を支える傷病手当金も見込みます。"
                        : "この就業形態では傷病手当金を見込んでいません。"}
                    </li>
                    <li>
                      貯蓄の回答帯{<AmountRange low={data.savings.low} high={data.savings.high} />}
                      と負担の幅を比べています。休職が長引けば負担は増えます。
                      {item.id === "mental" &&
                        `傷病手当金の上限${duration}を超える生活資金は含みません。`}
                    </li>
                    <li>{item.need.premises[0].note}</li>
                    {item.need.assumptions.map((a) => (
                      <li key={a}>{a}</li>
                    ))}
                    <li>出典：{item.need.sources.join(" ／ ")}</li>
                  </ul>
                </Fold>
              </Fold>
            ))}
            <Fold
              label="6. 障害による長期の休職"
              count="未算定"
              countClassName={s.scenarioAmount}
              id="scenario-disability"
              open={openScenario === "disability"}
            >
              {applied?.scenario === "disability" && (
                <AppliedNote changes={{ scenario: "disability" }} />
              )}
              <p>
                長期の収入減と生活費が続くケースです。障害年金の受給条件を含めた算定に未対応のため、必要額は出していません。
              </p>
            </Fold>
          </div>
        </section>
        {estimations.length > 0 && (
          <Fold label="入力の推定" count={`（${estimations.length}項目）`}>
            <ul>
              {estimations.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </Fold>
        )}
        <footer className={s.card}>
          {/* 減らせる箇所は「無い」ときも必ず書く（CLAUDE.md の出力の必須）。
              ある場合は死亡保障カードの判定（減らせる可能性）が同じ事実なので、ここでは繰り返さない */}
          {scenario.now.verdict !== "reducible" && (
            <p>
              現在の死亡保障で減らせる箇所は、この試算では見つかりませんでした。
              {scenario.now.verdict === "pending" && "現保障が不明のため、確認できていません。"}
            </p>
          )}
          <p className={s.next}>
            次の一歩：
            {data.coverage === 0
              ? "必要額の幅を家族で共有しましょう。"
              : data.coverage === null
                ? "いま加入している死亡保障の有無と金額を確認しましょう。"
                : "保険証券で保障の満期を確認しましょう。"}
          </p>
          <Button href={back} full>
            結果画面で全体を見る
          </Button>
        </footer>
      </main>
    </>
  );
}
