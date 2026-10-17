"use client";
import Link from "next/link";
import { useState } from "react";
import type { LabData, LabPoint } from "../../src/calc/lab.js";
import { labCoverageDifference, labRisingIntervals } from "../../src/calc/labView.js";
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
import s from "./page.module.css";
import { Words } from "./Words.js";

const SCENARIO_TITLE: Record<string, string> = {
  hospital: "短期入院・手術",
  injury: "けがによる3か月の休職",
  stroke: "脳卒中・心筋梗塞による半年の休職",
  cancer: "がんによる1年の休職",
  mental: "こころの不調による休職",
};
/** 貯蓄の判定の言葉。アイコンは VerdictBadge が VERDICT_BADGE から付ける（✓ ↔ ! …） */
const SAVINGS_LABEL = {
  reducible: "大丈夫のめやす",
  uncertain: "圏内・要精査",
  shortage: "備え不足の可能性",
  pending: "未算定",
};
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
  const left = mobile ? 92 : 80;
  // 両端の目盛り文字が viewBox からはみ出さない余白（390px で「1億5,000万円」「2050年」が切れた）
  const right = mobile ? 230 : 620;
  const bottom = mobile ? 276 : 200;
  const font = mobile ? 13 : 12;
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
            {t === 0 ? "0円" : formatMan(t)}
          </text>
        </g>
      ))}
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
        fill="var(--color-warning-text)"
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
      {points
        .filter(
          (p, i) =>
            i === 0 ||
            i === points.length - 1 ||
            (!mobile && p.age % 5 === 0 && i > 1 && i < points.length - 2),
        )
        .map((p, i) => (
          <g key={p.age} textAnchor="middle" fill="var(--color-text-muted)">
            <text x={x(p.age)} y={bottom + 18} fontSize={font}>
              {i === 0 ? `いま（${p.age}歳）` : `${p.age}歳`}
            </text>
            <text x={x(p.age)} y={bottom + 34} fontSize={font}>
              {p.year}年
            </text>
          </g>
        ))}
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
  const spouseIncomeIsZero = data.work[0].now.annualIncome === 0;
  const point = scenario.points.find((p) => p.age === age);
  const difference = point ? labCoverageDifference(data.coverage, point.low, point.high) : null;
  const rising = labRisingIntervals(scenario.points);
  const duration = `${Math.floor(data.maxBenefitMonths / 12)}年${data.maxBenefitMonths % 12}か月`;
  /** スライダーの年齢の点。64歳を過ぎて推移が無いときは、いまの年齢の死亡保障を出す */
  const shown = point ?? scenario.now;
  const deathPremises = [
    "本人が亡くなった場合の必要保障額です。生活費・教育費から遺族年金・就労収入・資産を差し引き、葬儀・予備費などの当社基準も含みます。資産は反映済みなので、貯蓄と再比較せず保障の過不足を示します。",
    `遺族年金は、亡くなった方に支えられていた家族への年金です。${data.hasSpouse ? "配偶者は妻として計算し、夫の場合は受給条件により必要額が増えることがあります。" : ""}`,
    ...(point
      ? [
          "年齢の推移は、現在の制度・収入・生活費・資産・ローン残高を固定し、家族の年齢だけを進めます。今後の貯蓄や返済が進めば必要額は下がりえます。成長に伴い変わり、必ず下がるとは限りません。対象はいまの年齢から64歳までです。",
          "制度改正は予測していません。いまの保険の点線は、満期・更新を確認せず、いまの額を延ばしたものです。緑の塗りは必要額の上端を上回る部分です。",
        ]
      : []),
    shown.crossing ?? "回答の幅を必要額に反映しています。",
    ...(data.hasSpouse && !spouseIncomeIsZero
      ? [
          `配偶者の年収は、回答額・半分・ゼロで比べます（いまの選択：約${formatMan(scenario.now.annualIncome ?? 0)}）。区分で答えた年収はまんなかの値で表示し、必要額には回答の幅も反映します。死亡の場合だけに適用し、生活費は固定します。`,
        ]
      : []),
    ...(data.hasSpouse
      ? [
          `末子独立後は、配偶者に最低でも年約${formatMan(data.postIndepMinIncome)}の手取り就労収入を推定します（当社基準）。ゼロでも推定は残り、働けない場合は必要額が増えます。`,
        ]
      : []),
    ...scenario.now.assumptions,
    `出典：${data.deathSource}`,
  ];
  const nextStep =
    data.coverage === null
      ? "いま加入している死亡保障の有無と金額を確認しましょう。"
      : data.coverage > 0
        ? "保険証券で保障の満期を確認しましょう。"
        : "必要額の幅を家族で共有しましょう。";
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
          <p>時期や働き方を変えて、備えの違いを確かめます。</p>
          {/* 全体の読み方は冒頭に1行（2026-10-18 文言の整理。以前はページの最下部） */}
          <p className={s.lead}>
            軽く短いもしもは公的な支えと貯蓄で受け止め、保険は重く長いもしもで足りない分に備えるものです。
          </p>
          <p className={s.note}>
            <span className={s.legendItem}>概算・要精査</span> ／{" "}
            <span className={s.legendItem}>算定基準日 {date}</span> ／{" "}
            <span className={s.legendItem}>パラメータ版 {version}</span>
          </p>
        </header>
        {/* 言葉の入口は先頭。カードは小さく保つ（ヘッダーから最初の図までを1画面に収める・視覚 DoD (a)） */}
        {aiEnabled && <Words query={query} hasSpouse={data.hasSpouse} onApply={applyWords} />}
        {/* 死亡保障は1枚にまとめる（2026-10-18 文言の整理）。いまの年齢の必要額・スライダーの左端・
            就労の「回答どおり」は同じ計算（calculateLab の now と points[0]）なので、別カードにすると同じ金額が3回並んでいた */}
        <section className={s.card} id="timing">
          <h2>
            {point
              ? `あなたが${point.age}歳（${point.year}年）で亡くなった場合`
              : "あなたがいま亡くなった場合"}
          </h2>
          {applied?.deathAge === age && <AppliedNote changes={{ deathAge: age }} />}
          {applied?.scenario === "death" && <AppliedNote changes={{ scenario: "death" }} />}
          <div className={s.readout} aria-live="polite" id="scenario-death">
            <span>資産を差し引いた後の必要保障額</span>
            <strong className={s.amount}>
              <AmountRange low={shown.low} high={shown.high} />
            </strong>
            {point && (
              <span>
                {point.children.length
                  ? `お子さん：${point.children.map((a) => `${a}歳`).join("・")}`
                  : "お子さんなし"}
              </span>
            )}
            {difference && (
              <p>
                {difference.verdict === "pending" ? (
                  "いまの保険が不明のため、差は未算定です。"
                ) : data.coverage === 0 ? (
                  // いまの保険が0円なら差は必要額と同じ。同じ金額を2回並べない
                  "いまの保険がないため、必要額の幅がそのまま不足する可能性があります。"
                ) : difference.verdict === "uncertain" ? (
                  "いまの前提では、いまの保険は必要額の幅の中に収まる可能性があります。"
                ) : (
                  <>
                    いまの前提では、
                    <AmountRange low={difference.low!} high={difference.high!} />{" "}
                    {difference.verdict === "shortage"
                      ? "不足する可能性があります。"
                      : "上回る可能性があります。"}
                  </>
                )}
              </p>
            )}
            <Comparison point={shown} />
          </div>
          {data.hasSpouse && (
            <p className={s.note}>
              遺される配偶者を妻として計算しています。夫の場合は必要額が増えることがあります。
            </p>
          )}
          {data.hasSpouse &&
            (spouseIncomeIsZero ? (
              <p className={s.note} id="work">
                配偶者の収入が0円の回答なので、配偶者が働かない前提の試算です。
              </p>
            ) : (
              <div id="work">
                {applied?.spouseWork && applied.spouseWork === WORK_IDS[work] && (
                  <AppliedNote changes={{ spouseWork: applied.spouseWork }} />
                )}
                <fieldset className={s.buttons}>
                  <legend>配偶者の働き方を変える</legend>
                  {["回答どおり", "半分", "ゼロ"].map((label, i) => (
                    <button
                      type="button"
                      key={label}
                      aria-pressed={work === i}
                      onClick={() => setWork(i)}
                    >
                      {label}
                      <span className={s.buttonIncome}>
                        年収 約{formatMan(data.work[i].now.annualIncome ?? 0)}
                      </span>
                    </button>
                  ))}
                </fieldset>
              </div>
            ))}
          {point ? (
            <>
              <label className={s.sliderLabel} htmlFor="lab-age">
                亡くなる年齢を動かす：{age}歳
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
              <p className={s.chartPremise}>
                いまの収入・生活費・貯蓄・ローン残高のまま、家族の年齢だけを進めた試算です。
              </p>
              <p className={s.legend}>
                {[
                  "帯：必要額の幅",
                  "線：まんなかの目安",
                  "点：選んだ年齢",
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
                  点線はいまの保障額を延ばした線です。満期が先に来る保険なら、その年齢からの保障はこの点線より少なくなります。
                </p>
              )}
              {rising.length > 0 && (
                <p className={s.note}>
                  {rising.map((r) => `${r.from}〜${r.to}歳`).join("・")}
                  は必要額が上がります（家族の年齢で公的な支えや支出が変わるため）。
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
            <p className={s.note}>年齢の推移は64歳までが対象のため、表示しません。</p>
          )}
          <Fold label="死亡保障の計算の前提" count={`（${deathPremises.length}項目）`}>
            <ul>
              {deathPremises.map((text) => (
                <li key={text}>{text}</li>
              ))}
            </ul>
          </Fold>
        </section>
        <section className={s.card}>
          <h2>病気・けが・休職</h2>
          <p className={s.basis}>金額は、貯蓄を差し引く前の負担です。</p>
          <p className={s.note}>
            1つずつ起きた場合の試算で、足し合わせません。死亡保障とは算定対象が異なるため、金額の大小を比べません。
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
                {/* 金額と判定は閉じた行に出ているので、開いた中では繰り返さない（2026-10-18 文言の整理） */}
                {applied?.scenario === item.id && <AppliedNote changes={{ scenario: item.id }} />}
                <p>
                  {item.id === "mental"
                    ? `休職が${duration}を超えると、生活資金がさらに必要です。`
                    : `休職${item.months}か月の試算です。長引けば負担は増えます。`}
                </p>
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
                長期の収入減と本人の生活費が続くケースです。障害年金の受給条件を含めた算定に未対応のため、必要額は出せません。
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
        {/* 次の一歩はページに1つ（2026-10-18 文言の整理。以前はカードごとに計4つ） */}
        <footer className={s.card}>
          {/* 減らせる箇所は、無いときも「見つかりませんでした」と言う（CLAUDE.md「出力に必ず含めること」） */}
          {scenario.now.verdict !== "reducible" ? (
            <p>
              いまの死亡保障で減らせる箇所は、この試算では見つかりませんでした。
              {scenario.now.verdict === "pending" &&
                "いまの保険が不明のため、確かめられていません。"}
            </p>
          ) : (
            <p>いまの前提では、いまの死亡保障を減らせる可能性があります。</p>
          )}
          <p className={s.next}>次の一歩：{nextStep}</p>
          <Button href={back} full>
            結果画面で全体を見る
          </Button>
        </footer>
      </main>
    </>
  );
}
