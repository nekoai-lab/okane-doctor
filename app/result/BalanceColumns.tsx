/**
 * 金額の根拠：出ていくお金と入ってくるお金を、同じ目盛りの縦2本に積む（2026-10-18・レポート形式）。
 *
 * 旧来の滝（横棒の引き算）は「横棒が並んでいるだけ」で読みにくいという指摘（オーナー・2026-10-18）を受けて置き換えた。
 * 2本の高さの差がそのまま「保険で備える額」になる形にして、引き算を図そのもので見せる。
 *
 * **金額はここで作らない。** 支出・収入の内訳と合計、差引き（`rawNeed`）・余剰（`margin`）は
 * すべて算定結果（`DeathResult`）の値をそのまま描く。図の高さの比も同じ値から取る。
 */
import type { ReactNode } from "react";
import type { DecisionPoint } from "../../src/calc/decisionPoints.js";
import { formatMan } from "../../src/design/tokens.js";
import { RangeText, WithAmounts } from "./AmountText.js";
import r from "./report.module.css";

export interface BalanceItem {
  label: string;
  amount: number;
  /** 根拠（出典・当社基準・回答）。無ければ空文字 */
  basis: string;
  /** 図の区画の中に書く短い呼び名（狭い列で3行に折れないように）。無ければ `label` */
  short?: string;
}

/** 区画の中に文字を入れる下限（列の高さに対する割合）。これより薄い区画は明細の色見本で読む */
const LABEL_MIN_SHARE = 0.11;
/** 文字を白にできる濃い色の数（`--chart-out-1・2`、`--chart-in-1`） */
const DARK_OUT = 2;
const DARK_IN = 1;

function Column({
  head,
  total,
  items,
  kind,
  scaleMax,
  top,
}: {
  head: string;
  total: ReactNode;
  items: BalanceItem[];
  kind: "out" | "in";
  scaleMax: number;
  top: ReactNode;
}) {
  const dark = kind === "out" ? DARK_OUT : DARK_IN;
  return (
    <div>
      <p className={r.colHead}>{head}</p>
      <p className={r.colTotal}>{total}</p>
      <div aria-hidden="true" className={r.stack}>
        {items.map((x, i) => (
          <div
            className={`${r.seg} ${i >= dark ? r.segLight : ""}`}
            key={x.label}
            style={{
              flex: `${x.amount / 10_000} 1 0`,
              background: `var(--chart-${kind}-${Math.min(i + 1, 5)})`,
            }}
          >
            {x.amount / scaleMax >= LABEL_MIN_SHARE && (
              <>
                {x.short ?? x.label}
                <span>{formatMan(x.amount)}</span>
              </>
            )}
          </div>
        ))}
        {top}
      </div>
    </div>
  );
}

function Ledger({
  caption,
  items,
  kind,
  total,
}: {
  caption: string;
  items: BalanceItem[];
  kind: "out" | "in";
  total: number;
}) {
  return (
    <table className={r.ledger}>
      <caption>{caption}</caption>
      <tbody>
        {items.map((x, i) => (
          <tr key={x.label}>
            <td>
              <span
                aria-hidden="true"
                className={r.sw}
                style={{ background: `var(--chart-${kind}-${Math.min(i + 1, 5)})` }}
              />
              {x.label}
              {x.basis && <span className={r.ledgerSrc}>{x.basis}</span>}
            </td>
            <td>
              <RangeText text={formatMan(x.amount)} />
            </td>
          </tr>
        ))}
        <tr className={r.ledgerSum}>
          <td>合計</td>
          <td>
            <RangeText text={formatMan(total)} />
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function BalanceColumns({
  expense,
  expenseTotal,
  income,
  incomeTotal,
  rawNeed,
  margin,
  fmt,
  needRangeText,
  resultLabel,
  resultNote,
  footnotes,
  points,
}: {
  expense: BalanceItem[];
  expenseTotal: number;
  income: BalanceItem[];
  incomeTotal: number;
  /** 差引きの必要額（代表値・丸め前・0以上）。`DeathResult.rawNeed` */
  rawNeed: number;
  /** 余剰（収入 − 支出）。`DeathResult.margin` */
  margin: number;
  /** 代表値の差額の表示（丸め単位で丸めて「約」を付ける） */
  fmt: (yen: number) => string;
  /** 最終の必要額（回答の幅を包絡したレンジ・`formatRange` 済み） */
  needRangeText: string;
  /** 最終の必要額の呼び名（「民間保険で備える額（…）」） */
  resultLabel: string;
  /** 最終の必要額の意味の説明（`RESULT_NOTE`＋幅の注記） */
  resultNote: string;
  /** 図と明細に添える注記（遺族年金の前提・団信など） */
  footnotes: string[];
  /** 金額を読むときのポイント（`decisionPoints` から、見直しの年表と重ならないもの） */
  points: DecisionPoint[];
}) {
  const short = rawNeed > 0;
  const scaleMax = Math.max(expenseTotal, incomeTotal + rawNeed, 1);
  return (
    <>
      <div
        aria-label={
          short
            ? `出ていくお金 ${formatMan(expenseTotal)}、入ってくるお金 ${formatMan(incomeTotal)}。差の ${fmt(rawNeed)} が保険で備える額（まんなかの目安）`
            : `出ていくお金 ${formatMan(expenseTotal)}、入ってくるお金 ${formatMan(incomeTotal)}。入ってくるお金が ${fmt(margin)} 上回る見込み`
        }
        className={r.balance}
        role="img"
      >
        <Column
          head="出ていくお金"
          items={expense}
          kind="out"
          scaleMax={scaleMax}
          top={
            !short && margin > 0 ? (
              <div className={r.spacer} style={{ flex: `${margin / 10_000} 1 0` }} />
            ) : null
          }
          total={formatMan(expenseTotal)}
        />
        <Column
          // 不足の世帯では、右の列に足りない分も積むので、収入に読まれないよう列の名前で言う（UX 33回目）
          head={short ? "収入・資産と、足りない分" : "入ってくるお金"}
          items={income}
          kind="in"
          scaleMax={scaleMax}
          top={
            short ? (
              <div className={r.gap} style={{ flex: `${rawNeed / 10_000} 1 0` }}>
                保険で備える額
                <span className={r.gapValue}>
                  <RangeText text={fmt(rawNeed)} />
                </span>
                <span className={r.gapSmall}>まんなかの目安</span>
              </div>
            ) : null
          }
          // 列の名前に合わせ、合計も「収入・資産 ＋ 足りない分」と2つに分けて書く（UX 33回目）
          total={
            short ? (
              <>
                <RangeText text={formatMan(incomeTotal)} /> ＋{" "}
                <span className={r.eqGap}>
                  <RangeText text={fmt(rawNeed)} />
                </span>
              </>
            ) : (
              formatMan(incomeTotal)
            )
          }
        />
      </div>
      <p className={r.note}>
        {short
          ? "左右の高さは同じ目盛りです。ピンクの部分が、公的年金・就労収入・資産では埋まらず、保険で備える分です。"
          : "左右の高さは同じ目盛りです。入ってくるお金のほうが多い見込みです。"}
      </p>

      <p className={r.eq}>
        {short ? (
          <>
            出ていくお金 <strong>{formatMan(expenseTotal)}</strong> − 入ってくるお金{" "}
            <strong>{formatMan(incomeTotal)}</strong>
            <br />＝ 保険で備える額{" "}
            <strong className={r.eqGap}>
              <RangeText text={fmt(rawNeed)} />
            </strong>
            （まんなかの目安）
          </>
        ) : (
          <>
            入ってくるお金 <strong>{formatMan(incomeTotal)}</strong> − 出ていくお金{" "}
            <strong>{formatMan(expenseTotal)}</strong>
            <br />＝ 上回る分{" "}
            <strong>
              <RangeText text={fmt(margin)} />
            </strong>
            （まんなかの目安）
          </>
        )}
        <br />
        {/* 不足の世帯では、図の差と同じものの幅なので名前を繰り返さない。それ以外は額の性質が変わるので呼び名を出す */}
        {short ? "答えた区分の幅を入れると" : resultLabel}：
        <strong>
          <RangeText text={needRangeText} />
        </strong>
      </p>
      <p className={r.note}>
        <WithAmounts text={resultNote} />
      </p>

      <div className={r.ledgers}>
        <Ledger caption="出ていくお金の明細" items={expense} kind="out" total={expenseTotal} />
        <Ledger caption="入ってくるお金の明細" items={income} kind="in" total={incomeTotal} />
      </div>
      {footnotes.map((f) => (
        <p className={r.note} key={f}>
          <WithAmounts text={f} />
        </p>
      ))}

      {points.length > 0 && (
        <ul className={r.points}>
          {points.map((p) => (
            <li className={r.point} key={p.label}>
              <strong>
                <WithAmounts text={p.label} />
              </strong>
              <WithAmounts text={p.body} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
