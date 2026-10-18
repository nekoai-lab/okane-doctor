/**
 * リスク別の診断表（結果画面の玄関・仕様 §5.3）
 *
 * **3列の表にする（2026-10-18 オーナー決定・AUDIT 2-3）。** 列は「必要額／いまの保障・貯蓄／判定」。
 * カードごとに上限が違うミニ数直線は、カードどうしで棒の長さを比べる誤読を招き、
 * 「目盛りがカードごとに違います」の注意書きで補っていた。表なら縦に走査するだけで比べられる。
 *
 * 390px では「リスク名の行」と「3つの値の行」を2段にする。列は3つのまま。
 * 所見と前提は表の下の折りたたみにまとめる（1行＝見出し・金額・判定）。
 * **答えの幅で判定が変わるときの一文だけは、その行の直下に畳まずに出す**（T-H・2026-09-23）。
 * 計算未対応の行は表に空欄で並べず、表の下の1文にまとめる（AUDIT 1-7）。
 *
 * **金額はここで作らない。** 受け取った文字列を描くだけ（CLAUDE.md「本番UIに金額をハードコードしない」）。
 */
import Link from "next/link";
import { RangeText, WithAmounts } from "./AmountText.js";
import { Fold } from "./Fold.js";
import {
  PremiseDisclosure,
  type PremiseSensitivity,
  type PremiseWeight,
} from "./PremiseDisclosure.js";
import s from "./riskTable.module.css";
import { VERDICT_AXIS } from "./verdictLabels.js";

/** 金額の主役2つ。ラベルは行ごとに変わる（いまの保障／いまの貯蓄） */
export interface RiskFigures {
  needLabel: string;
  needText: string;
  holdLabel: string;
  holdText: string;
}

/**
 * ミニ数直線の描画に要る値（円）。
 *
 * **軸の右端は `needHigh` と `hold` の大きいほうそのもの**にする。
 * 見栄えのために 1.15 倍した端を置くと、画面に出る目盛りが
 * 算定結果のどれでもない数字になってしまう（金額を作る場所は `src/calc` だけ）。
 */
export interface RiskScale {
  needLow: number;
  needHigh: number;
  /** 受け皿（死亡＝保障額／病気・失業＝貯蓄）。null なら未入力で判定しない */
  hold: number | null;
  /** 右端の目盛りに出す文字列。needText か holdText のどちらかと同じもの */
  axisMaxText: string;
}

export interface RiskRow {
  key: string;
  title: string;
  subtitle: string;
  /** 判定の見た目。`none` は未診断 */
  tone: "ok" | "check" | "short" | "none";
  verdictLabel: string;
  precisionLabel: string;
  /** 精度もモックどおりピル型バッジで出す。色は tokens.css の意味色に対応 */
  precisionTone: "calculated" | "statutory" | "unsupported";
  /** 計算未対応の行は null */
  figures: RiskFigures | null;
  /** 計算未対応の行は null。空の軌道だけを出す */
  scale: RiskScale | null;
  /** 所見。**2文以内**。金額はここに書かず figures に出す */
  note: string;
  /**
   * 判定を支えている前提（仕様 §5.3 の開示6点）。
   * **畳まない。** 必要額が1点に潰れる世帯では、前提が外れたときの動きが幅から読めないので、
   * ここが唯一の手がかりになる。折りたたむと開示にならない。
   */
  assumptions: { label?: string; note: string }[];
  /** 前提の重み（帯）。初期表示に出す2つのうちの1つ */
  premiseWeight: PremiseWeight | null;
  /** 前提が外れたときの判定遷移（T-E）。初期表示に出す2つのうちの1つ */
  premiseSensitivity: PremiseSensitivity | null;
  /**
   * **答えの幅の中で判定が変わるときの一文**（T-H・2026-09-23）。
   * レンジ表示の直下（露出部）に出す。**畳まない** ── 判定が動きうるという事実は、
   * 開いてもらって初めて伝わる場所に置かない
   */
  crossingNote?: string | null;
  /** 同ページ内へのアンカー、または準備中の表示 */
  link: { href: string; label: string } | { pending: string };
}

export function RiskTable({
  rows,
  caption,
  sharedSavingsText = null,
  countUnit = null,
  unsupportedCount = 0,
  lead = null,
}: {
  rows: RiskRow[];
  caption: string;
  /**
   * 並べた行の数に添える語（「つのリスク」）。数は `rows.length`。
   * 旧「この診断で分かること」の箱から移した（範囲の説明はページ末尾の折りたたみへ・2026-10-17）
   */
  countUnit?: string | null;
  /**
   * 計算未対応で空欄の行の数。**文に埋めず、数字として立てる**（2026-10-17・PR #1 の UX レビュー2回目の直しを
   * この置き場所に当てた）。「6つのリスクを並べました（うち1つは未算定）」の1文では数が文の中にあった
   */
  unsupportedCount?: number;
  /** 表の前に置く世帯ごとの案内（単身世帯の §6-10）。無ければ機能の1文 */
  lead?: string | null;
  /**
   * 病気・けが・失業の行が**共通の**受け皿にしている貯蓄（整形済み・各カードの「いまの貯蓄」と同じ文字列）。
   * 計算した貯蓄の行が無ければ null
   */
  sharedSavingsText?: string | null;
}) {
  const computed = rows.filter((r) => r.figures !== null);
  const unsupported = rows.filter((r) => r.figures === null);
  return (
    <section className={s.wrap} aria-labelledby="risk-table-heading">
      <h2 className={s.heading} id="risk-table-heading">
        あなたのリスク別の<span className={s.nowrap}>診断表</span>
      </h2>
      {/* 自称語（正直・安心など）を使わない。機能を書く（UIラベル規約・2026-10-17 §指摘） */}
      {countUnit && (
        <p
          className={s.count}
          data-risk-shown={rows.length}
          data-risk-unsupported={unsupportedCount}
        >
          <span className={s.countStat}>
            <span className={s.countNum}>{rows.length}</span>
            <span className={s.countUnit}>{countUnit}</span>
          </span>
          {unsupportedCount > 0 && (
            <span className={s.countStat}>
              <span className={s.countUnit}>うち未算定</span>
              <span className={s.countSubNum}>{unsupportedCount}</span>
              <span className={s.countUnit}>つ</span>
            </span>
          )}
        </p>
      )}
      <p className={s.lead}>{lead ?? "死亡・病気・失業を、同じ表で並べて見ています。"}</p>
      <p className={s.caption}>{caption}</p>

      <table className={s.table}>
        <thead>
          <tr>
            <th scope="col">必要額</th>
            <th scope="col">いまの保障・貯蓄</th>
            <th className={s.verdictCell} scope="col">
              {VERDICT_AXIS}
            </th>
          </tr>
        </thead>
        {computed.map((r) => (
          <tbody className={s.group} key={r.key}>
            <tr>
              <th className={s.rowHead} colSpan={3} scope="colgroup">
                <div className={s.rowHeadInner}>
                  <span className={s.rowHeadText}>
                    <span className={s.title}>{r.title}</span>
                    <span className={s.subtitle}>
                      {r.subtitle}・{r.precisionLabel}
                    </span>
                  </span>
                  {/* 狭い画面では判定の列を見出しの下に軸名つきで出す（金額の2列に幅を渡す）。CSS で片方だけ出す */}
                  <span className={s.badgeNarrow}>
                    <span className={s.narrowAxis}>{VERDICT_AXIS}</span>
                    <Badge tone={r.tone} label={r.verdictLabel} />
                  </span>
                </div>
              </th>
            </tr>
            <tr className={s.values}>
              <td>
                <span className={s.figValue}>
                  <RangeText text={r.figures?.needText ?? ""} />
                </span>
              </td>
              <td>
                <span className={s.figValue}>
                  <RangeText text={r.figures?.holdText ?? ""} />
                </span>
              </td>
              <td className={s.verdictCell}>
                <Badge tone={r.tone} label={r.verdictLabel} />
              </td>
            </tr>
            {/* 答えの幅で判定が変わるときの一文（T-H・2026-09-23 オーナー裁定）。**畳まない** */}
            {r.crossingNote ? (
              <tr>
                <td className={s.crossing} colSpan={3}>
                  <WithAmounts text={r.crossingNote} />
                </td>
              </tr>
            ) : null}
          </tbody>
        ))}
      </table>

      {unsupported.length > 0 && (
        <p className={s.unsupportedNote}>
          {unsupported.map((r) => r.title).join("、")}は、今回は計算していません。
          {"href" in unsupported[0].link ? (
            <>
              {" "}
              <Link className={s.link} href={unsupported[0].link.href}>
                もしもラボで見る
              </Link>
            </>
          ) : null}
        </p>
      )}

      {/*
        仕様 §5.3：**緑が3つ並んだときに実力以上の安心を売らない**ための注記。
        病気・けが・失業の3行は、同じ貯蓄を受け皿として**単独で**判定している。
        法的免責のような小さい文字にしない（12px以上・本文色）。
      */}
      {/*
        **注記が指している貯蓄の額を、注記の中で立てる**（2026-10-17・視覚の DoD (a)）。
        この注記の要点は「3行の受け皿は1つの同じお金」で、その額はカードに3回出ている「いまの貯蓄」そのもの。
        不足世帯では計算未対応の2行が続き、ここまで図も大きな数字も無い区間が 1,002px あった。
        額は各カードと同じ文字列（入力の金融資産）で、ここで作っていない。
      */}
      <div className={s.overlapNote}>
        {sharedSavingsText && (
          <p className={s.overlapStat}>
            <span className={s.overlapStatLabel}>各行の受け皿にしている貯蓄（同じお金）</span>
            <span className={s.overlapStatValue}>
              <RangeText text={sharedSavingsText} />
            </span>
          </p>
        )}
        <p className={s.overlapText}>
          病気・けが・失業の過不足の判定は、それぞれ<strong>単独で起きた場合</strong>の見立てです。
          同じ貯蓄を各行の受け皿として見ています。
        </p>
      </div>

      {/*
        凡例・図の読み方・精度の説明。**参照材なのでまとめて畳む**
        （2026-09-21・視覚の DoD (a)）。3項目で 828px あり、
        カードの図が終わったあとに文字だけの区間を作っていた。
        露出は件数を明示した1行、中身はそのまま（開示の規約）。
      */}
      {/*
        各行の所見・前提・ラボへの導線。**参照材なのでまとめて畳む**（1行＝見出し・金額・判定・2026-10-18）。
        露出は件数つきの1行、中身はそのまま（開示の規約）。
      */}
      <div className={s.legendFold}>
        <Fold count={`（${computed.length}行）`} label="各行の見方と前提">
          <dl className={s.notes}>
            {computed.map((r) => (
              <div key={r.key}>
                <dt>{r.title}</dt>
                <dd>
                  <p className={s.note}>{r.note}</p>
                  <PremiseDisclosure
                    items={r.assumptions}
                    sensitivity={r.premiseSensitivity}
                    weight={r.premiseWeight}
                  />
                  {"href" in r.link ? (
                    <Link className={s.link} href={r.link.href}>
                      {r.link.label}
                    </Link>
                  ) : null}
                </dd>
              </div>
            ))}
          </dl>
          <p className={s.legendText}>
            「計算済み」はあなたの回答からの試算、「制度式で概算」は公的制度の計算式どおりの概算です。
          </p>
        </Fold>
      </div>
    </section>
  );
}

/** 判定は記号＋ラベル＋色の3点で出す（色だけで意味を伝えない・2026-10-18 UX レビュー24回目） */
const TONE_ICON: Record<RiskRow["tone"], string> = { ok: "✓", check: "↔", short: "!", none: "…" };

function Badge({ tone, label }: { tone: RiskRow["tone"]; label: string }) {
  return (
    <span className={`${s.badge} ${s[tone]}`}>
      <span aria-hidden="true">{TONE_ICON[tone]} </span>
      {label}
    </span>
  );
}
