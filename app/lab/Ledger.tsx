// 死亡保障の「この金額の内訳」（サンプル v2・2026-10-18 オーナー指摘と Codex の死亡内訳レビュー）。
// 金額はすべて labDeath の ledger（diagnose の内訳）から。画面で足し引きしない。
// 内訳と上の幅を「＝」で結ばない：幅は答えた区分の候補ぜんぶの包絡で、内訳は代表条件の1例だから
import type { LabData, LabPoint } from "../../src/calc/lab.js";
import type { RangeVerdict, Verdict } from "../../src/calc/types.js";
import { formatMan, formatRange } from "../../src/design/tokens.js";
import { Fold } from "../result/Fold.js";
import s from "./page.module.css";

/** 上の金額の呼び名（必要額の判定・ニーズ軸）。長い説明は内訳の折りたたみが持つ */
export const NEED_LABEL: Record<RangeVerdict, string> = {
  shortage: "資産を差し引いた後の必要保障額",
  sufficient: "葬儀・予備費と当座の生活費の目安",
  ample: "葬儀・予備費の目安",
  not_needed: "葬儀・予備費の目安",
  mixed: "必要保障額の幅",
};
/** 代表条件で出す額の作り方（当社基準）。必要額の判定（ニーズ軸）ごと */
const REP_REASON: Record<Verdict, string> = {
  shortage: "計算上の不足分に、当社基準の幅をつけた額",
  sufficient: "葬儀・予備費に、当座の生活費の目安を足した額（当社基準）",
  ample: "支えが大きく上回るため、葬儀・予備費の目安だけを置いた額（当社基準）",
  not_needed: "支える家族がいないため、葬儀・予備費の目安だけを置いた額（当社基準）",
};

const yen = (v: number) => (v === 0 ? "0円" : `約${formatMan(v)}`);

function Row({ label, value, why }: { label: string; value: number; why?: string }) {
  return (
    <div className={s.lrow}>
      <span>{label}</span>
      <span className={s.lvalue}>{yen(value)}</span>
      {why && <span className={s.lwhy}>{why}</span>}
    </div>
  );
}

export function Ledger({
  data,
  point,
  work,
}: {
  data: LabData;
  point: LabPoint;
  /** 0 回答どおり／1 半分／2 ゼロ */
  work: number;
}) {
  const b = point.ledger;
  const e = b.expense;
  const i = b.income;
  const solo = !data.hasSpouse && point.children.length === 0;
  const sameAsAbove = point.low === point.high && e.total === point.low;
  const hasMinor = point.children.some((a) => a < 18);
  // 0円の行は理由を同じ行で言う（「見込んでいません」で閉じない。外れたらどうなるかは上の幅と前提が持つ）
  const zero = (kind: "basic" | "pension") =>
    kind === "basic" && !hasMinor
      ? "18歳までの子がいない条件では見込んでいません。"
      : data.selfEmployed && kind === "pension"
        ? "いまの自営の回答から見込んでいません。過去の厚生年金の加入は反映していません。"
        : "この条件では見込んでいません。";
  const sw = data.spouseWork;
  const workWhy =
    work === 2
      ? "「ゼロ」の条件なので見込んでいません。"
      : !sw?.counted
        ? "この条件では見込んでいません。"
        : sw.continuing
          ? `選んだ年収のまま、配偶者が${sw.endAge}歳になるまで見込んでいます（当社基準）。`
          : `配偶者が${sw.endAge}歳になるまで見込んでいます（当社基準）。`;
  const range = formatRange(point.low, point.high);
  const steps = [
    `回答の代表条件での差し引き：${b.rawNeed > 0 ? `不足分 ${yen(b.rawNeed)}` : "不足分なし"}`,
    `その条件で出す額：${formatRange(b.repRange.low, b.repRange.high)}。${REP_REASON[b.repVerdict]}です。`,
    `答えた区分の中の候補をぜんぶ計算し、いちばん低い額から高い額までを幅にしたもの：${range}（上の金額）`,
  ];
  const detail: [string, number][] = [
    [`子が独立するまでの生活費（${b.years.dependent}年）`, e.livingChild],
    [`その後の配偶者の生活費（${b.years.alone}年）`, e.livingAlone],
    ["教育費", e.education],
    ["住まいの費用（団信で消えないローンなど）", e.housing],
    ["葬儀・予備費（当社基準）", e.funeral],
  ];
  return (
    <section className={s.card} id="ledger">
      <h2>この金額の内訳</h2>
      <p className={s.ledgerHead}>
        回答の代表条件で見た収支
        {solo ? "" : `（${point.age}歳で万一のときから${b.years.total}年間の累計）`}
      </p>
      <div className={s.lsum}>
        <span>かかるお金</span>
        {/* 上の金額と同じ額（葬儀・予備費だけの世帯）は繰り返さず、そうだと言う */}
        {sameAsAbove ? (
          <span className={s.lwhy}>葬儀・予備費（当社基準）だけで、上の金額と同じです。</span>
        ) : (
          <>
            <span className={s.lbig}>{yen(e.total)}</span>
            <span className={s.lwhy}>
              {solo ? "葬儀・予備費などの合計" : "生活費・教育費・住まい・葬儀などの合計"}
            </span>
          </>
        )}
      </div>
      <p className={s.ledgerHead}>支えに数えたお金</p>
      <div className={s.lrows}>
        {!solo && (
          <>
            <Row
              label="遺族基礎年金"
              value={i.pensionBasic}
              why={i.pensionBasic ? undefined : zero("basic")}
            />
            <Row
              label="遺族厚生年金"
              value={i.pensionKosei}
              why={i.pensionKosei ? undefined : zero("pension")}
            />
            <Row
              label="中高齢寡婦加算"
              value={i.chukoreiKafu}
              why={i.chukoreiKafu ? undefined : zero("pension")}
            />
            <Row label="家族の就労収入（手取り）" value={i.survivorWork} why={workWhy} />
          </>
        )}
        <Row label="いまの金融資産" value={i.assets} why="いま持っているお金です。" />
      </div>
      <div className={s.lsum}>
        <span>計算上の不足分</span>
        <span className={s.lbig}>{b.rawNeed > 0 ? yen(b.rawNeed) : "不足分なし"}</span>
        <span className={s.lwhy}>
          {b.rawNeed > 0
            ? "かかるお金から、支えに数えたお金を引いた額です。"
            : solo
              ? "いまの金融資産で、かかるお金をまかなえる計算です。"
              : `支えが${yen(b.margin)}上回ります（将来の収入を含みます）。`}
        </span>
      </div>
      <Fold label="上の金額になるまで" count={`（${steps.length}項目）`}>
        <ul>
          {steps.map((t) => (
            <li key={t}>{t}</li>
          ))}
          {point.ledger.rangeVerdict === "mixed" && (
            <li>答えた区分によって、不足分の場合と、葬儀・予備費などの目安の場合があります。</li>
          )}
        </ul>
      </Fold>
      <Fold label="かかるお金のくわしい内訳" count={`（${detail.length + 1}項目）`}>
        <div className={s.lrows}>
          {detail.map(([label, v]) => (
            <Row key={label} label={label} value={v} />
          ))}
          <Row label="かかるお金の合計" value={e.total} />
        </div>
        <p className={s.note}>
          各行を万円に丸めているため、足した額と合計が少し合わないことがあります。
          {!solo &&
            "遺族年金は、亡くなった方に支えられていた家族への公的な年金です。配偶者は妻として計算しています。"}
          出典：{data.deathSource}
        </p>
      </Fold>
    </section>
  );
}
