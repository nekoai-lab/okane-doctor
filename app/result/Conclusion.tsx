/**
 * 結果画面の最初の2画面（2026-10-17・最初の2画面の作り直し）。
 *
 * 初期表示（390×844 の約2画面）に置くのは次の3つだけ（§5「情報の並べ直し案」）：
 *   1. 結論：過不足の判定バッジ（軸名つき）＋1文＋人ごとの行（必要額・いまの保障・差／すべてレンジ）＋数直線1本
 *   2. 次の一歩（1つ）：判定の組み合わせから組み立てた行動の文1つ＋見直しの時期
 *   3. この結論を決めている前提（1点）：図1つ＋感度文1つ
 * 根拠（リスク別の診断表 → STEP1〜4 → 配偶者 → よみとき）はこの下に続く。
 *
 * **旧ヒーロー（`Hero.tsx`）を置き換える**（置換であって共存ではない）。旧ヒーローは世帯合計の不足額を
 * 見出しに入れており、カード（1人分）の金額と食い違って見えた。ここは**人ごとに**出し、2人分を足さない。
 *
 * 視覚の DoD：(b) 主金額は Shippori Mincho の独立した大きな数字（文の中に埋めない）、
 * (c) 判定は「アイコン＋ラベル＋色」で行ごとに同じ位置。
 *
 * **金額はここで作らない。** 受け取った文字列と、算定結果の円を描くだけ。
 */

import type { Verdict3 } from "../../src/calc/verdict3.js";
import { RangeText, WithAmounts } from "./AmountText.js";
import { AxisBadge } from "./AxisBadge.js";
import s from "./conclusion.module.css";
import type { KeyPremise, PersonRow, WorkEndCompare } from "./conclusionModel.js";
import { VERDICT_ICON, VERDICT_TONE } from "./conclusionModel.js";

function Badge({ verdict, label }: { verdict: Verdict3; label: string }) {
  return (
    <AxisBadge badgeClassName={`${s.badge} ${s[VERDICT_TONE[verdict]]}`}>
      <span aria-hidden="true" className={s.icon}>
        {VERDICT_ICON[verdict]}
      </span>
      {label}
    </AxisBadge>
  );
}

/**
 * 数直線1本。**目盛りは全員で共通**にする（人ごとに目盛りが違うと、行どうしを見比べられない）。
 * 帯（橙）＝必要額の幅、縦線（墨）＝いまの保障。診断表のミニ数直線と同じ文法。
 * 左端は0円、右端は必要額と保障の大きいほう（算定結果そのもの。見栄えで伸ばさない）。
 */
function PeopleLine({ rows, fmt }: { rows: PersonRow[]; fmt: (yen: number) => string }) {
  const max = Math.max(...rows.map((r) => Math.max(r.needHigh, r.coverage ?? 0)));
  const pct = (v: number) => (max <= 0 ? 4 : 4 + (v / max) * 92);
  const ROW = 40;
  const h = rows.length * ROW;
  const label = rows
    .map(
      (r) =>
        `${r.title}：必要額は${fmt(r.needLow)}から${fmt(r.needHigh)}、いまの保障は${r.coverage === null ? "未入力" : fmt(r.coverage)}`,
    )
    .join("。");
  return (
    <div className={s.lineWrap}>
      <svg className={s.line} height={h} role="img" aria-label={label}>
        {rows.map((r, i) => {
          const y = i * ROW;
          const left = pct(r.needLow);
          const width = pct(r.needHigh) - left;
          return (
            <g key={r.who}>
              <text className={s.lineName} x="4%" y={y + 10}>
                {r.who === "self" ? "あなた" : "配偶者"}
              </text>
              <line className={s.axis} x1="4%" x2="96%" y1={y + 30} y2={y + 30} />
              {width < 1 ? (
                <line
                  className={s.needTick}
                  x1={`${left}%`}
                  x2={`${left}%`}
                  y1={y + 23}
                  y2={y + 37}
                />
              ) : (
                <rect
                  className={s.band}
                  x={`${left}%`}
                  width={`${width}%`}
                  y={y + 25}
                  height="10"
                />
              )}
              {r.coverage !== null && (
                <line
                  className={s.hold}
                  x1={`${pct(r.coverage)}%`}
                  x2={`${pct(r.coverage)}%`}
                  y1={y + 21}
                  y2={y + 39}
                />
              )}
            </g>
          );
        })}
      </svg>
      <div className={s.lineTicks}>
        <span>0</span>
        <span>{fmt(max)}</span>
      </div>
      <p className={s.lineKey}>
        <span aria-hidden="true" className={s.keyBand} />
        必要額の幅
        <span aria-hidden="true" className={s.keyHold} />
        いまの保障
      </p>
    </div>
  );
}

/**
 * 見出しの括弧書き（「（当社の見立て）」）を途中で折らない。入らなければ括弧ごと次の行へ送る
 * （390px で「見立／て」と折れていた・PR #5 の UX 再レビュー）
 */
function TitleText({ text }: { text: string }) {
  const i = text.indexOf("（");
  if (i <= 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <wbr />
      <span className={s.nowrap}>{text.slice(i)}</span>
    </>
  );
}

function PremiseFigure({ p, fmt }: { p: KeyPremise; fmt: (yen: number) => string }) {
  if (p.kind === "work") {
    const share = p.incomeTotal > 0 ? Math.min(1, p.work / p.incomeTotal) : 0;
    return (
      <div className={s.premiseFig}>
        <div className={s.premiseStats}>
          <p className={s.premiseStat}>
            <span className={s.subLabel}>
              {p.estimated ? "見立てた就労収入" : "見込んだ就労収入"}
            </span>
            <span className={s.premiseValue}>
              <RangeText text={fmt(p.work)} />
            </span>
          </p>
          <p className={s.premiseStat}>
            <span className={s.subLabel}>見込んだ収入・資産の合計</span>
            <span className={s.subValue}>
              <RangeText text={fmt(p.incomeTotal)} />
            </span>
          </p>
        </div>
        <div
          className={s.shareBar}
          role="img"
          aria-label={`見込んだ収入・資産 ${fmt(p.incomeTotal)} のうち ${fmt(p.work)} が、配偶者の就労収入です。`}
        >
          <span style={{ width: `${Math.round(share * 100)}%` }} />
        </div>
      </div>
    );
  }
  // 単身：いまの保障と、必要額の内訳を1か所で見せる（UX_REVIEW 1回目「単身の内訳」）
  const top = Math.max(p.need.high, p.coverage ?? 0);
  const w = (v: number) => `${top > 0 ? Math.max(1, Math.round((v / top) * 100)) : 0}%`;
  const needText =
    p.need.low === p.need.high ? fmt(p.need.low) : `${fmt(p.need.low)}〜${fmt(p.need.high)}`;
  return (
    <div className={s.premiseFig}>
      {p.coverage !== null && (
        <div className={s.pairRow}>
          <span className={s.subLabel}>いまの死亡保障</span>
          <span className={s.premiseValue}>
            <RangeText text={fmt(p.coverage)} />
          </span>
          <span aria-hidden="true" className={s.pairBar}>
            <span className={s.pairHold} style={{ width: w(p.coverage) }} />
          </span>
        </div>
      )}
      <div className={s.pairRow}>
        <span className={s.subLabel}>{p.needLabel}</span>
        <span className={s.premiseValue}>
          <RangeText text={needText} />
        </span>
        <span aria-hidden="true" className={s.pairBar}>
          <span className={s.pairNeed} style={{ width: w(p.need.high) }} />
        </span>
      </div>
    </div>
  );
}

/** 就労収入を見込む年齢の前提と、60歳まで・65歳までの必要額（本人・配偶者は別の行・ADR-030） */
function WorkEnd({ w }: { w: WorkEndCompare }) {
  return (
    <div className={s.workEnd}>
      <p className={s.note}>{w.lead}</p>
      {w.rows.map((r) => (
        <div className={s.workEndRow} key={r.who}>
          <p className={s.workEndTitle}>{r.title}</p>
          <div className={s.subs}>
            {r.lines.map((x) => (
              <p className={s.sub} key={x.label}>
                <span className={s.subLabel}>{x.label}</span>
                <span className={s.subValue}>
                  <RangeText text={x.text} />
                </span>
              </p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function Conclusion({
  caption,
  householdBadge,
  householdTone,
  householdIcon,
  headline,
  reason,
  partialNote,
  noReducible,
  rows,
  modeText,
  fmt,
  nextStep,
  reviewYear,
  reviewReason,
  bookmarkHint,
  premise,
  workEnd,
  premiseFmt,
}: {
  caption: string;
  /** 世帯の過不足の判定（過不足軸）の文言と色（`HERO_BADGE` / `HERO_TONE`） */
  householdBadge: string;
  householdTone: string;
  /** 世帯のバッジのアイコン（`HERO_ICON`） */
  householdIcon: string;
  headline: string;
  reason: string | null;
  partialNote: string | null;
  noReducible: string | null;
  rows: PersonRow[];
  modeText: string;
  /** 数直線の目盛りの書式（`約◯万円`） */
  fmt: (yen: number) => string;
  nextStep: string;
  /** 次の見直しのめやす（段差チャートと同じ `projectDeath` の節目）。無ければ null */
  reviewYear: number | null;
  /** その年を見直しのめやすにする理由（エンジンの年次表の出来事から・`reviewReasonSentence`） */
  reviewReason: string | null;
  /** 見返す方法（ブックマーク）をここで言うか。お知らせ（保存）が動いているときは、その導線のカードが言う */
  bookmarkHint: boolean;
  premise: KeyPremise | null;
  /** 就労収入の終わりの年齢と、65歳まで見込んだ場合の必要額（`workEndCompare`）。動かなければ null */
  workEnd: WorkEndCompare | null;
  /** 前提の図の金額の書式（内訳と同じ丸め単位） */
  premiseFmt: (yen: number) => string;
}) {
  return (
    <>
      {/* 1. 結論 */}
      <section className={s.card} aria-labelledby="hero-head">
        <div className={s.topline}>
          <span className={s.eyebrow}>診断結果</span>
          <span className={s.caption}>{caption}</span>
        </div>
        <div>
          {/* 冒頭のバッジも「アイコン＋ラベル＋色」の3点で出す（人ごとの行と同じ・PR #5 の UX レビュー） */}
          <AxisBadge badgeClassName={`${s.badge} ${s[householdTone] ?? ""}`}>
            <span aria-hidden="true" className={s.icon}>
              {householdIcon}
            </span>
            {householdBadge}
          </AxisBadge>
        </div>
        <h1 className={s.head} id="hero-head">
          {/* 見出し・文の中の金額も数字の途中で折らない（PR #1 の UX レビュー2回目の直しをこの置き場所に当てた） */}
          <WithAmounts text={headline} />
        </h1>
        {reason && (
          <p className={s.note}>
            <WithAmounts text={reason} />
          </p>
        )}
        {partialNote && (
          <p className={s.note}>
            <WithAmounts text={partialNote} />
          </p>
        )}

        <ul className={s.people}>
          {rows.map((r) => (
            <li className={s.person} key={r.who} data-person={r.who}>
              <div className={s.personHead}>
                <p className={s.personTitle}>{r.title}</p>
                <Badge label={r.verdictLabel} verdict={r.verdict} />
              </div>
              <p className={s.mainLabel}>{r.mainLabel}</p>
              <p className={`${s.mainValue} ${s[`v_${VERDICT_TONE[r.verdict]}`] ?? ""}`}>
                <RangeText text={r.mainText} />
              </p>
              <div className={s.subs}>
                {r.subs.map((x) => (
                  <p className={s.sub} key={x.label}>
                    <span className={s.subLabel}>{x.label}</span>
                    <span className={s.subValue}>
                      <RangeText text={x.text} />
                    </span>
                  </p>
                ))}
              </div>
            </li>
          ))}
        </ul>

        <PeopleLine fmt={fmt} rows={rows} />

        {/* 就労収入の前提カードが無い世帯だけ、ここに置く（下の「この結論を決めている前提」を参照） */}
        {workEnd && premise?.kind !== "work" && <WorkEnd w={workEnd} />}

        {noReducible && (
          <p className={s.note}>
            <WithAmounts text={noReducible} />
          </p>
        )}
        <p className={s.mode}>暮らし方の前提：{modeText}（「前提の確認と次へ」で変えられます）</p>
      </section>

      {/* 2. 次の一歩（1つ） */}
      <section className={s.card} aria-labelledby="next-step">
        <h2 className={s.h2} id="next-step">
          次の一歩
        </h2>
        <p className={s.step}>
          <WithAmounts text={nextStep} />
        </p>
        {reviewYear !== null && (
          <p className={s.review}>
            <span className={s.subLabel}>次の見直しのめやす</span>
            <span className={s.reviewValue}>{reviewYear}年ごろ</span>
          </p>
        )}
        {/*
          **いま使えるもの（ブックマークと見直す時期）を言う**（PR #1 の UX レビュー2回目「お知らせの説明」を
          この置き場所に当てた）。お知らせが止まっているあいだは準備中の導線を出さないので、見返す方法はここで1回だけ言う。
          年の理由とは1段落にまとめる（不足の世帯で前提の文の結びが最初の2画面に入るように・PR #5 の UX レビュー）
        */}
        {/* 商品を勧めない一文も同じ段落に入れる（段落の間の余白で前提の文が2画面から押し出された・PR #22 の UX レビュー） */}
        <p className={s.small}>
          {reviewYear !== null && reviewReason}
          {reviewYear !== null &&
            bookmarkHint &&
            "URLをブックマークすると、その頃に見返して答え直せます。"}
          このサービスは特定の商品を勧めたり、申込みへ誘導したりしません。
        </p>
      </section>

      {/* 3. この結論を決めている前提（1点） */}
      {premise && (
        <section className={s.card} aria-labelledby="key-premise-title" id="key-premise">
          <p className={s.eyebrow}>この結論を決めている前提</p>
          <h2 className={s.h2} id="key-premise-title">
            <TitleText text={premise.title} />
          </h2>
          {/*
            文を図より先に置く（2026-10-18・PR #5 の UX レビュー）。不足の世帯では図の後ろに置いた文の結び
            （前提が外れたら判定がどう動くか）が最初の2画面に入らなかった。結びがこのカードの要点なので先に読ませる
          */}
          <p className={s.step}>
            <WithAmounts text={premise.text} />
          </p>
          <PremiseFigure fmt={premiseFmt} p={premise} />
          {/*
            60歳は当社の既定なので、65歳まで働く場合の必要額を初期表示に並べる（ADR-030）。
            就労収入の前提の話なのでこのカードに置く。結論のカードに置くと、不足の世帯で
            このカードが最初の2画面から押し出された（e2e の #key-premise）
          */}
          {workEnd && premise.kind === "work" && <WorkEnd w={workEnd} />}
        </section>
      )}
    </>
  );
}
