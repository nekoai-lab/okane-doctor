"use client";
import Link from "next/link";
import { useState } from "react";
import type { LabData, LabPoint } from "../../src/calc/lab.js";
import { formatMan, formatRange } from "../../src/design/tokens.js";
import { Fold } from "../result/Fold.js";
import { linearScale } from "../result/chartScale.js";
import s from "./page.module.css";

const LABEL = {
  reducible: "↓ 減らせる可能性",
  uncertain: "↔ 圏内・要精査",
  shortage: "! 不足の可能性",
  pending: "… 判定は保留",
};
const SCENARIO_TITLE: Record<string, string> = {
  hospital: "短期入院・手術",
  injury: "けがによる3か月の休職",
  stroke: "脳卒中・心筋梗塞による半年の休職",
  cancer: "がんによる1年の休職",
  mental: "こころの不調による休職",
};
const SAVINGS_LABEL = {
  reducible: "✓ 大丈夫のめやす",
  uncertain: "↔ 圏内・要精査",
  shortage: "! 備え不足の可能性",
  pending: "… 未算定",
};
function Comparison({ point }: { point: LabPoint }) {
  return (
    <strong className={`${s.badge} ${s[point.verdict]}`}>
      過不足の判定：{LABEL[point.verdict]}
    </strong>
  );
}
function SavingsBadge({ verdict }: { verdict: keyof typeof SAVINGS_LABEL }) {
  return (
    <strong className={`${s.badge} ${s[verdict]}`}>貯蓄の判定：{SAVINGS_LABEL[verdict]}</strong>
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
  const font = mobile ? 13 : 11;
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
            {formatMan(t)}
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
        fill="var(--color-warning)"
        fillOpacity="0.18"
      />
      <polyline
        points={coords(points, (p) => p.middle)}
        fill="none"
        stroke="var(--color-warning)"
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
          />
          <text
            x={(left + right) / 2}
            y={Math.max(14, y(coverage) - 8)}
            textAnchor="middle"
            fontSize={font}
            fill="var(--color-text)"
          >
            {coverage === 0 ? "いまの保険 なし" : `いまの保険 約${formatMan(coverage)}`}
          </text>
        </>
      )}
      {!mobile && coverage !== null && points.some((p) => coverage > p.high) && (
        <text x="400" y="108" textAnchor="middle" fontSize={font} fill="var(--color-success-text)">
          緑の差 = 見直しの余地
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
        fill="var(--color-warning)"
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
        .map((p) => (
          <g key={p.age} textAnchor="middle" fill="var(--color-text-muted)">
            <text x={x(p.age)} y={bottom + 18} fontSize={font}>
              {p.age}歳
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
}: {
  data: LabData;
  back: string;
  date: string;
  version: string;
  estimations: string[];
}) {
  const [work, setWork] = useState(0);
  const [age, setAge] = useState(data.minAge);
  const scenario = data.work[work];
  const point = scenario.points.find((p) => p.age === age);
  const duration = `${Math.floor(data.maxBenefitMonths / 12)}年${data.maxBenefitMonths % 12}か月`;
  return (
    <main className={s.page}>
      <nav>
        <Link href={back}>← 結果画面へ戻る</Link>
      </nav>
      <header>
        <p className={s.eyebrow}>MOSHIMO LAB / もしもを確かめる</p>
        <h1>もしもラボ</h1>
        <p>いまの前提で、時期や働き方による備えの違いを確かめます。</p>
        <p className={s.note}>
          概算・要精査 ／ 算定基準日 {date}
          <br />
          パラメータ版 {version}
        </p>
      </header>
      <section className={s.card} id="timing">
        <h2>万一の時期と必要額</h2>
        <p>今後の貯蓄や返済が進めば、必要額は下がりえます。</p>
        {point ? (
          <>
            <div className={s.readout} aria-live="polite">
              <span>
                本人の万一：{point.age}歳（{point.year}年）
              </span>
              <span>必要な死亡保障のめやす</span>
              <strong className={s.amount}>{formatRange(point.low, point.high)}</strong>
              <Comparison point={point} />
            </div>
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
            <Curve points={scenario.points} selected={point} coverage={data.coverage} />
            <Curve points={scenario.points} selected={point} coverage={data.coverage} mobile />
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
                      <td>{formatRange(p.low, p.high)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Fold>
          </>
        ) : (
          <strong className={s.amount}>対象期間外</strong>
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
              制度改正は予測していません。現保障は満期・更新を確認していないため水平線です。緑の塗りは必要額の上端を上回る部分です。
            </li>
            <li>対象は現在年齢以上の40〜64歳です。死亡シナリオは現在の年齢で計算します。</li>
            <li>
              {point?.children.length
                ? `選択年齢のお子さん：${point.children.map((a) => `${a}歳`).join("・")}`
                : "選択年齢のお子さんなし"}
              。{point?.crossing ?? "回答の幅を必要額の帯に反映しています。"}
            </li>
          </ul>
        </Fold>
        <p className={s.next}>次の一歩：保険証券で保障の満期を確認しましょう。</p>
      </section>
      {data.hasSpouse && (
        <section className={s.card}>
          <h2>配偶者の就労シナリオ</h2>
          {data.work[0].now.annualIncome === 0 ? (
            <p>配偶者の収入が0円の回答なので、この切り替えは使いません</p>
          ) : (
            <>
              <fieldset className={s.buttons}>
                <legend>配偶者の就労収入</legend>
                {["回答額", "半分", "ゼロ"].map((label, i) => (
                  <button
                    type="button"
                    key={label}
                    aria-pressed={work === i}
                    onClick={() => setWork(i)}
                  >
                    {label}
                  </button>
                ))}
              </fieldset>
              <div className={s.readout} aria-live="polite">
                <span>現在の年齢で必要な死亡保障</span>
                <strong className={s.amount}>
                  {formatRange(scenario.now.low, scenario.now.high)}
                </strong>
                <Comparison point={scenario.now} />
              </div>
              <p>
                就労収入ゼロでも独立後の収入を見込むため、
                <br />
                働けない場合は必要額が増えます。
              </p>
            </>
          )}
          <Fold label="就労の試算の前提" count="（3項目）">
            <ul>
              <li>
                試算する年収は約{formatMan(scenario.now.annualIncome ?? 0)}
                です。回答額・半分・ゼロを比較します。
              </li>
              <li>
                区分の年収は代表値で表示します。必要額には回答帯の幅も反映します。死亡の場合だけに適用し、生活費は固定します。
              </li>
              <li>
                末子独立後は最低でも年約{formatMan(data.postIndepMinIncome)}
                の手取り就労収入を推定します（当社基準）。ゼロでも推定は残り、働けない場合は必要額が増えます。
              </li>
            </ul>
          </Fold>
          <p className={s.next}>次の一歩：続けられそうな働き方を家族で確認しましょう。</p>
        </section>
      )}
      <section className={s.card}>
        <h2>病気・けが・死亡</h2>
        <p>それぞれ単独で起きる試算なので、金額は足し合わせません。</p>
        <div className={s.scenarios}>
          {data.sickness.map((item, i) => (
            <Fold
              key={item.id}
              label={`${i + 1}. ${SCENARIO_TITLE[item.id]}`}
              count="（1シナリオ）"
              open={i === 0}
            >
              <div className={s.readout}>
                <span>貯蓄を差し引く前の負担</span>
                <strong className={s.amount}>{formatRange(item.need.low, item.need.high)}</strong>
                <SavingsBadge verdict={item.savingsVerdict} />
              </div>
              <p>
                {item.id === "mental"
                  ? `休職が${duration}を超えると、生活資金がさらに必要です。`
                  : `休職${item.months}か月の試算で、長引けば負担は増えます。`}
              </p>
              <Fold label="制度と計算の前提" count={`（${item.need.assumptions.length + 5}項目）`}>
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
                    貯蓄の回答帯{formatRange(data.savings.low, data.savings.high)}
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
              <p className={s.next}>次の一歩：休職中に使える勤務先の保障を確認しましょう。</p>
            </Fold>
          ))}
          <Fold label="6. 障害による長期の休職" count="（1シナリオ）">
            <div className={s.readout}>
              <span>必要額</span>
              <strong className={s.amount}>未算定</strong>
              <SavingsBadge verdict="pending" />
            </div>
            <p>障害年金を含めた算定は未対応で、必要額は出せません。</p>
            <Fold label="算定の対応状況" count="（1項目）">
              <p>
                長期の収入減と本人の生活費が続くケースです。障害年金の受給条件を含めた算定に未対応です。
              </p>
            </Fold>
            <p className={s.next}>次の一歩：年金窓口で障害年金の受給条件を確認しましょう。</p>
          </Fold>
          <Fold label="7. 死亡（現在の年齢）" count="（1シナリオ）">
            <div className={s.readout}>
              <span>資産を差し引いた後の必要保障額</span>
              <strong className={s.amount}>
                {formatRange(scenario.now.low, scenario.now.high)}
              </strong>
              <Comparison point={scenario.now} />
            </div>
            <p>
              遺される配偶者を妻として計算し、
              <br />
              夫の場合は必要額が増えることがあります。
            </p>
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
            <Link className={s.next} href={back}>
              次の一歩：結果画面の内訳を確認
            </Link>
          </Fold>
        </div>
        <Link className={s.next} href={back}>
          次の一歩：結果画面で備えの全体を確認
        </Link>
      </section>
      <section className={`${s.card} ${s.pending}`}>
        <h2>言葉による条件の変更</h2>
        <strong className={s.amount}>準備中</strong>
        <p>自然言語で前提を変える機能は、まだ使えません。</p>
        <Fold label="機能の予定" count="（1項目）">
          <p>
            AIは言葉を前提に翻訳し、計算は本編と同じエンジンが行う予定です。解釈した前提も表示します。
          </p>
        </Fold>
        <Link className={s.next} href="#timing">
          次の一歩：時期による違いを確認
        </Link>
      </section>
      <Fold label="入力の推定" count={`（${estimations.length}項目）`}>
        <ul>
          {estimations.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
        {!estimations.length && <p>推定で補った入力はありません。</p>}
      </Fold>
      <footer className={s.card}>
        {scenario.now.verdict !== "reducible" ? (
          <p>
            現在の死亡保障で減らせる箇所は、
            <br />
            この試算では見つかりませんでした。
            {scenario.now.verdict === "pending" && "現保障が不明のため、確認できていません。"}
          </p>
        ) : (
          <p>いまの前提では、現在の死亡保障に減らせる可能性があります。</p>
        )}
        <Fold label="保存とロードマップの対応状況" count="（1項目）">
          <p>保存とロードマップは準備中です。</p>
        </Fold>
        <Link className={s.cta} href={back}>
          結果画面へ戻る
        </Link>
      </footer>
    </main>
  );
}
