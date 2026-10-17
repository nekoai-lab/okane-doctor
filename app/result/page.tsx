/**
 * 結果画面 v1（AIなし・T-05a）
 *
 * サーバコンポーネント。URL の区分コードを decode →（params を読んで）normalize → diagnose。
 * 数値は src/calc でしか作らない（責務境界）。ここは算定結果を「因数分解して見せる」だけ。
 * 芯：概算・要精査／前提／出典を必ず添える。減らせる箇所は無ければ「見つかりませんでした」と明示する。
 */
import Link from "next/link";
import type { DiagnoseInput } from "../../src/calc/index.js";
import { diagnose, outOfScope, toHousehold } from "../../src/calc/index.js";
import type { DeathResult, EducationPlan } from "../../src/calc/types.js";
import type { Projection } from "../../src/calc/projection.js";
import { coverageCurve, projectDeath } from "../../src/calc/projection.js";
import { narrate, placeholderValues } from "../../src/narrate/narrate.js";
import { jstDate, jstYear } from "../../src/time/jstYear.js";
import { dialFor, simulateAll } from "../../src/calc/simulate.js";
import { crossingNote } from "../../src/calc/envelope.js";
import { resultFigures } from "../../src/calc/figures.js";
import { survivorIncomeSensitivity } from "../../src/calc/sensitivity.js";
import { decisionPoints } from "../../src/calc/decisionPoints.js";
import { reform2028 } from "../../src/calc/reform2028.js";
import { verdict3 } from "../../src/calc/verdict3.js";
import { RangeText, WithAmounts } from "./AmountText.js";
import { Fold } from "./Fold.js";
import { ownStandardEstimates, workDeductionSource } from "./estimates.js";
import { sensitivityText } from "./sensitivityText.js";
import { DEATH_LABEL } from "./verdictLabels.js";
import { hasActionableGap } from "./nextStep.js";
import { Conclusion } from "./Conclusion.js";
import {
  conclusionHeadline,
  conclusionReason,
  keyPremise,
  nextStepSentence,
  noReducibleSentence,
  personRows,
} from "./conclusion.js";
import { bandWidenedNote, gapSentence, partialNote } from "./figureText.js";
import { HERO_BADGE, HERO_TONE } from "./Hero.js";
import { LivingDial } from "./LivingDial.js";
import { RiskTable, type RiskRow } from "./RiskTable.js";
import { Step1, type AnswerChip } from "./Step1.js";
import { UsedSources, type UsedSource } from "./UsedSources.js";
import { Step2 } from "./Step2.js";
import { CoverageCurve } from "./CoverageCurve.js";
import { NumberLine } from "./NumberLine.js";
import { Waterfall } from "./Waterfall.js";
import { Narration } from "./Narration.js";
import { ownStandardValueText } from "../../src/params/display.js";
import { loadParams, v } from "../../src/params/index.js";
import { formatMan, formatManApprox, formatRange } from "../../src/design/tokens.js";
import { toCompleteSelections } from "../../src/wizard/complete.js";
import type { Estimation } from "../../src/wizard/types.js";
import { crossingDrivers } from "../../src/wizard/uncertainty.js";
import { resultInputs } from "../../src/wizard/resultInputs.js";
import {
  LIVING_LEVEL_LABEL,
  LIVING_LEVELS,
  decodeLivingLevel,
  withLivingLevel,
} from "../../src/wizard/dial.js";
import { decodeSelections } from "../../src/wizard/url.js";
import { SAVE_ENABLED } from "../../src/watch/availability.js";
import s from "./page.module.css";

/**
 * 金額の呼び名は verdict で変える。**同じ数字ではないから。**
 * shortage＝足りない額／sufficient＝万一直後の当座資金／ample・not_needed＝葬儀・予備費。
 * ここを「必要な保障額」で統一すると、収入が支出を上回っているのに額が出る理由が
 * 読者に分からず、グラフと結論が矛盾して見える（2026-08-30 の実物レビューで発覚）。
 */
const AMOUNT_LABEL: Record<string, string> = {
  // 答えた区分のどこにあたるかで、上乗せが要る場合と要らない場合がある（`rangeVerdict`・2026-10-17）
  mixed: "答えた区分の幅で見た必要額の目安",
  shortage: "足りない保障額の目安",
  sufficient: "万一の直後に要る当座資金の目安",
  ample: "葬儀・予備費の目安",
  not_needed: "葬儀・予備費の目安",
};

/**
 * 滝グラフの最終行に添える1文。
 *
 * **`ample` の「葬儀・予備費だけは残す」に、時期の根拠は仕様に無い。**
 * `機能仕様書_MVP.md` §4.2.7 の `ample` 分岐は `提示レンジ = [round100(E4), round100(E4)]` の
 * 床ルールで、ADR にも `当座` `直後` `流動性` の記載が1件も無い（2026-09-21 に全文確認）。
 * だから「受け取りは長い年月をかけて入るから」とは書かない ──
 * **もっともらしい理由を後付けしない。当社基準だと正直に書く。**
 */
/** 最終行の括弧。額の性質が verdict で入れ替わるので、名前だけでは足りない */
const RESULT_QUALIFIER: Record<string, string> = {
  mixed: "",
  shortage: "",
  sufficient: "（葬儀・予備費と当座の生活費）",
  ample: "（葬儀・予備費のみ）",
  not_needed: "（葬儀・予備費のみ）",
};

const RESULT_NOTE: Record<string, string> = {
  mixed:
    "答えた区分のどこにあたるかで、上乗せの保障が要る場合と要らない場合があります。この額は、その両方を含めた幅です。",
  shortage: "見込みの支出から、受け取れる収入・資産を差し引いた残りです。",
  sufficient:
    "収入・資産で支出はまかなえる見込みです。これは不足額ではなく、手続きや当面の暮らしのために手元に置いておく目安（葬儀・予備費と生活費1〜2年分）です。",
  ample:
    "公的な年金と資産が総額を上回るため、生活費のための上乗せは0円です。それでも葬儀・予備費を残しているのは、余剰があってもこの分だけは別に備えるという当社基準で、時期の根拠は置いていません。",
  not_needed:
    "扶養するご家族がいないため、上乗せの保障は要りません。残るのは葬儀・予備費だけです。",
};

const AMOUNT_NOTE: Record<string, string> = {
  mixed:
    "※ 答えた区分のどこにあたるかで、上乗せの保障が要る場合と要らない場合があります。この額は、その両方を含めた幅です。",
  shortage: "※ 見込みの支出から、受け取れる収入・資産を差し引いた不足分です。",
  sufficient:
    "※ 収入・資産で支出はまかなえる見込みです。これは不足額ではなく、手続きや当面の暮らしのために手元に置いておく目安（葬儀・予備費と生活費1〜2年分）です。",
  ample: "※ 収入・資産が支出を大きく上回る見込みです。上乗せの保障は要りません。",
  not_needed: "※ 扶養するご家族がいないため、大きな死亡保障は要りません。",
};

const SHORTFALL_TONE: Record<string, "ok" | "check" | "short" | "none"> = {
  reducible: "ok",
  uncertain: "check",
  shortage: "short",
  pending: "none",
};

/**
 * 過不足軸の判定カードの本文。
 *
 * **幅ゼロの世帯で「幅の右端」と言わない。**
 * `ample` / `not_needed` では `low = high` なので、文が指す幅が画面に存在しない。
 * 数直線は正しく「帯ではなく目盛り」で描いているのに、文だけが幅の存在を前提にしていた
 * （2026-09-21 の要素照合で発見）。T-B でレンジが復活すれば常に幅の文で真になるが、
 * **それまでの間も嘘をつかない**。
 */
function shortfallBody(v: string, hasRange: boolean, hasEstimates: boolean): string {
  // 推定が0件の世帯に「推定で補った項目を答え直す」と書かない（§指摘・2026-10-17）
  switch (v) {
    case "reducible":
      return `${hasRange ? "厳しめの前提（幅の右端）で計算しても" : "この必要額で計算しても"}、いまの保障が上回っています。減らせる可能性があります。ただし概算です。契約を見直す前に、契約内容（保障額・期間・更新の時期）を確かめ${hasEstimates ? "、推定で補った項目を実際の値で答え直し" : ""}てください。`;
    case "uncertain":
      return `必要額の幅が、いまの保障を跨いでいます。この位置関係のとき、診断は「減らせる」とも「足りない」とも言い切りません。${hasEstimates ? "推定で補った項目を実際の値で答えると" : "答えた区分を具体的な値で答え直すと"}幅が狭まり、過不足の判定が確定に近づきます。`;
    case "shortage":
      return `${hasRange ? "緩めに見た幅の左端にも" : "この必要額にも"}、いまの保障が届いていません。前提を見直すか、不足分の備え方を検討する段階です。`;
    default:
      return "いまの保障が分からないため、過不足は出していません。証券が見つかったら再診断できます。";
  }
}

function money(yen: number): string {
  return formatMan(yen);
}

/** 就業形態の呼び名。**回答をそのまま読み返す**ので、算定側の語ではなく設問の語に揃える */
const EMPLOYMENT = {
  employee: "会社員",
  self: "自営・フリーランス",
  none: "無職",
} as const;

const EDU_PLAN_LABEL: Record<EducationPlan, string> = {
  public: "公立中心",
  mixed: "私立混在",
  private: "私立中心",
};

/**
 * STEP1 の回答チップ（照合表 #5）。**10問の回答を、そのまま並べ直すだけ。**
 *
 * ここに出る金額は**入力値**であって算定結果ではない（万円に丸めるだけで、式を通さない）。
 * エンジンの導出値を1つでも混ぜると「答えたこと」と「計算されたこと」の境目が消え、
 * 読み手は自分の回答を検算できなくなる。
 *
 * 旧「この診断が前提にした、いまの家計」（`household` の4項目）の役割をここが引き取る。
 * あちらは4項目に畳んでいたが、**畳むと畳んだ側の判断が入る**（世帯年収は本人＋配偶者の合算だった）。
 * チップは合算せず、答えた単位のまま出す。
 */
function answerChips(input: DiagnoseInput, coverage: number | null): AnswerChip[] {
  const man = (yen: number) => `約${Math.round(yen / 10000).toLocaleString("ja-JP")}万円`;
  /**
   * `field` はウィザードの項目名。**推定の記録（`normalize`）と同じ綴り**にする。
   *
   * キーからは**繰り返し語を削る**（「ご本人の年収」→「本人・年収」）。
   * 札が短くなるぶん1行に2枚以上流れ、10枚が縦一列に伸びない。
   */
  return [
    // ── ご家族と仕事 ──
    {
      field: null,
      group: "family",
      key: "本人",
      value: `${input.self.age}歳・${EMPLOYMENT[input.self.employment]}`,
    },
    {
      field: null,
      group: "family",
      key: "配偶者",
      value: input.spouse
        ? `${input.spouse.age}歳・${EMPLOYMENT[input.spouse.employment]}`
        : "なし",
    },
    {
      field: null,
      group: "family",
      key: "お子さん",
      value:
        input.children.length > 0
          ? `${input.children.length}人（${input.children.map((a) => `${a}歳`).join("・")}）`
          : "なし",
    },
    {
      field: "educationPlan",
      group: "family",
      key: "進路",
      value: EDU_PLAN_LABEL[input.educationPlan],
    },

    // ── 家計と資産 ──
    { field: "selfIncome", group: "money", key: "本人・年収", value: man(input.self.income) },
    ...(input.spouse
      ? [
          {
            field: "spouseIncome",
            group: "money" as const,
            key: "配偶者・年収",
            value: man(input.spouse.income),
          },
        ]
      : []),
    {
      field: "monthlyLiving",
      group: "money",
      key: "毎月の生活費",
      value: man(input.monthlyLiving),
    },
    { field: "assets", group: "money", key: "金融資産", value: man(input.assets) },

    // ── 住まいと保障 ──
    {
      field: "loan",
      group: "home",
      key: "住まい",
      // **1枚だけ長い。** 1行を専有させる（組版は他の札と同じ）
      wide: true,
      value:
        input.housing.type === "rent"
          ? "賃貸（住居費は生活費に含む）"
          : (input.housing.loan ?? 0) > 0
            ? `持ち家・ローン残り${man(input.housing.loan ?? 0)}`
            : "持ち家（ローンなし）",
    },
    // 団信は住まいと別の札にする（住まいの札に押し込むと、そこだけ2行になる）
    ...(input.housing.type === "own" && (input.housing.loan ?? 0) > 0
      ? [
          {
            field: null,
            group: "home" as const,
            key: "団信",
            value:
              input.housing.danshin === false
                ? "なし"
                : input.housing.danshin === undefined
                  ? "分からない"
                  : "あり",
          },
        ]
      : []),
    {
      field: null,
      group: "home",
      key: "いまの保障",
      value: coverage === null ? "未入力" : man(coverage),
    },
  ];
}

function CaseCard({
  title,
  r,
  pj,
  coverage,
  survivorLabel,
  childCount,
  danshinCovered,
  koseiFrom,
  workFrom,
  reform2028Reason,
  loan,
  livingBand,
  chips,
  estimations,
  terms,
  editHref,
  gapText,
  bandNote,
  roundUnit,
}: {
  title: string;
  r: DeathResult;
  pj: Projection;
  /** いまの死亡保障額。分からない（未入力）なら null */
  coverage: number | null;
  /** 遺される側の呼び名（本人死亡なら「配偶者」、配偶者死亡なら「あなた」） */
  survivorLabel: string;
  /** 子の人数。家計台帳の出どころキャプションに使う（`children` は React の予約名なので避ける） */
  childCount: number;
  danshinCovered: boolean;
  koseiFrom: string | null;
  workFrom: string | null;
  reform2028Reason: string;
  /** 住宅ローン残高（判断ポイントの文面に使う） */
  loan: number | null;
  /** 生活費の幅（円/月・率と目盛りを掛けたあと）。帯が無い区分では null */
  livingBand: { low: number; high: number } | null;
  /** STEP1 の回答チップ（`answerChips` が作る）。**このケースの保障額を含む** */
  chips: AnswerChip[];
  /** STEP1 の推定ボックス（ウィザードの未回答の記録）。ケースによらず同じ */
  estimations: Estimation[];
  /** チップに出た専門用語の1行注釈 */
  terms: string[];
  /** 入力に戻るリンク */
  editHref: string;
  /** いまの保障との差の1文（`gapSentence`）。最終の必要額から作る */
  gapText: string;
  /** 滝の最終行が代表値より広い幅のとき、その旨の1文（`bandWidenedNote`）。無ければ null */
  bandNote: string | null;
  /** 内訳の中間値を丸める単位（円）。params の `roundUnit` */
  roundUnit: number;
}) {
  /**
   * STEP4 の判定カード。**過不足軸**（`Verdict3`）を使う ── バッジと同じ軸。
   * ニーズ軸（`r.verdict`）は滝の最終行のラベルが使っており、別物（CLAUDE.md「判定には軸名を添える」）。
   */
  const v3 = verdict3(coverage, r.range.low, r.range.high);
  /** `r.range`（包絡したレンジ）の呼び名に使う必要額の判定（ニーズ軸）。代表値の `r.verdict` ではない */
  const rangeKey = r.rangeVerdict ?? r.verdict;
  const shortfallVerdict = {
    label: DEATH_LABEL[v3],
    tone: SHORTFALL_TONE[v3],
    body: shortfallBody(
      v3,
      r.range.low !== r.range.high,
      estimations.length + ownStandardEstimates(r, survivorLabel).length > 0,
    ),
  };
  const expenseItems = [
    { label: "ご家族の生活費（子育て期）", amount: r.expense.livingChild, basis: "当社基準" },
    { label: "ご家族の生活費（末子独立後）", amount: r.expense.livingAlone, basis: "当社基準" },
    {
      label: "教育費",
      amount: r.expense.education,
      basis: "文科省 子供の学習費調査（塾・部活・行事・制服も含む実支出）",
    },
    { label: "住居費（団信なしのローン残高）", amount: r.expense.housing, basis: "" },
    { label: "葬儀・予備費", amount: r.expense.funeral, basis: "当社基準" },
  ].filter((x) => x.amount > 0);
  const incomeItems = [
    {
      label: "遺族基礎年金",
      amount: r.income.pensionBasic,
      basis: "日本年金機構 ※令和8年度は報道値",
    },
    { label: "遺族厚生年金", amount: r.income.pensionKosei, basis: "厚生年金保険法" },
    { label: "中高齢寡婦加算", amount: r.income.chukoreiKafu, basis: "厚生年金保険法" },
    { label: "ご家族の就労収入", amount: r.income.survivorWork, basis: "当社基準" },
    { label: "金融資産", amount: r.income.assets, basis: "" },
  ].filter((x) => x.amount > 0);

  return (
    <div className={s.caseCard}>
      <h2 className={s.h2}>{title}</h2>

      {/*
        STEP1（照合表 #5）。**移植元は result.html の STEP 1。**
        ここで旧 h2「この診断が前提にした、いまの家計」（`Vitals` の4項目）と
        旧 h3「推定で補った前提」を**まとめて置き換えた**（CLAUDE.md「置換であって共存ではない」）。

        **ケースの中に置く。** 推定で補った項目はケースごとに違う
        （本人死亡と配偶者死亡では、遺される側が入れ替わるので前提も入れ替わる）ため、
        ページ直下に1つ置くと、どちらのケースの前提なのか言えなくなる。
      */}
      <Step1
        chips={chips}
        editHref={editHref}
        // 当社基準で補った前提（答えた年収0円の就労収入）も「推定で補った項目」に入れる（UX #4）
        estimations={[...estimations, ...ownStandardEstimates(r, survivorLabel)]}
        terms={terms}
      />

      {/* **数字の意味は verdict で入れ替わる。** 不足のときは「足りない額」だが、
          収入が支出を上回るときは「万一直後の当座資金（葬儀費＋生活費1〜2年分）」を出している
          （death.ts の sufficient 分岐）。同じ名前で呼ぶと、グラフと結論が矛盾して見える。
          **呼び名はレンジ全体の必要額の判定（`rangeVerdict`）で選ぶ。** `r.range` は回答の幅で包絡した額なので、
          代表値の判定（`r.verdict`）で呼ぶと、不足分を含む幅を「葬儀・予備費」と呼んでしまう（2026-10-17・QA） */}
      {/* 呼び名と金額を分ける。金額は文に埋めず、独立した大きな数字にする（DoD (b)・2026-10-17） */}
      <p className={s.amountLabel}>{AMOUNT_LABEL[rangeKey] ?? AMOUNT_LABEL.sufficient}</p>
      <p className={s.amount}>
        <RangeText text={formatRange(r.range.low, r.range.high)} />
      </p>
      <p className={s.basis}>{AMOUNT_NOTE[rangeKey] ?? AMOUNT_NOTE.sufficient}</p>

      {/* 現在の保障との比較 */}
      {/* 現在の保障との比較。**最終の必要額との差**を幅で言う（`figures.ts`・2026-10-17） */}
      <p className={s.meta}>
        <WithAmounts text={gapText} />
      </p>

      {/* 子の年齢での時間軸（見落としの可視化） */}
      {r.years.total > 0 && (
        <div className={s.timeline}>
          {r.years.dependent > 0 ? (
            <>
              お子さんが独立する約{r.years.dependent}年後まで（子育て期）と、その後
              配偶者が65歳になるまでの約
              {r.years.alone}年を見込んでいます。<strong>独立後は必要額が下がります。</strong>
            </>
          ) : (
            <>配偶者が65歳になるまでの約{r.years.total}年を見込んでいます。</>
          )}
          <div className={s.timelineBar} aria-hidden="true">
            <div
              className={s.segDep}
              style={{ width: `${(r.years.dependent / r.years.total) * 100}%` }}
            />
            <div
              className={s.segAlone}
              style={{ width: `${(r.years.alone / r.years.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/*
        STEP2（照合表 #6a〜#6e）。**移植元は result.html の左カラム＋段差チャート。**
        ここで旧 `Cashflow` の2図（1年ごとの収入と支出／万一のあとの残高）を撤去した。
        見た目は違うが「いつ・いくら」という**同じ情報**を出しており、2つ残すと
        どちらが正かを読み手に判断させることになる（CLAUDE.md「置換であって共存ではない」）。
      */}
      <Step2
        danshinCovered={danshinCovered}
        from={{
          pension: childCount > 0 ? `子${childCount}人` : null,
          kosei: koseiFrom,
          work: workFrom,
          housing: danshinCovered ? "団信あり" : null,
          living: "毎月の生活費",
          education: "お子さんの進路",
        }}
        livingBand={livingBand}
        pj={pj}
        reform2028Reason={reform2028Reason}
        survivorLabel={survivorLabel}
      />

      {/* 必要保障額の推移。点（今日いくら）ではなく線（いつまでいくら）で見せる */}
      <CoverageCurve
        coverage={coverage}
        fmt={(yen) => formatManApprox(yen, roundUnit)}
        needRangeText={formatRange(r.range.low, r.range.high)}
        points={coverageCurve(pj, r.income.assets)}
      />

      {/*
        STEP3 滝グラフ（照合表 #7）。**移植元は result.html の #wfRows。**
        ここで旧 `GapWaterfall` を撤去した ── 同じ引き算を別の形で出していた。

        **モックの滝は不足世帯のサンプルで描かれている。** 余剰が出る世帯では
        棒がマイナスに突き抜けるので、控除は0で止め、超過分は「余る分」の行に回す。
      */}
      <Waterfall
        deductions={[
          {
            label: "遺族年金でカバー",
            from: `${r.income.pensionKosei > 0 ? "会社員（厚生年金）" : "自営・フリーランス"}${childCount > 0 ? `・子${childCount}人` : ""}`,
            // **性別を聞いていないことを黙らせない。** エンジンは遺される側を妻として扱っている
            // （中高齢寡婦加算・遺族厚生年金の年齢要件）。直すのはエンジン側の宿題（2026-10-15）
            note: "遺される側が妻の場合の制度で計算しています（夫の場合は中高齢寡婦加算などが出ないことがあります）",
            source: "日本年金機構",
            amount: r.income.pensionBasic + r.income.pensionKosei + r.income.chukoreiKafu,
          },
          {
            label: `${survivorLabel}の就労収入`,
            // 回答から来たのか当社基準の見立てなのかを名乗る（UX #4）。主語は遺される側
            ...workDeductionSource(r, survivorLabel),
            note: "手取りに換算し、算定期間ぶん積んだもの",
            source: null,
            amount: r.income.survivorWork,
          },
          {
            label: "貯蓄・資産",
            from: "世帯の金融資産",
            source: null,
            amount: r.income.assets,
          },
        ].filter((d) => d.amount > 0)}
        // 棒は代表値の内訳。必要額（丸め単位のレンジ）より精密に見せない（UX #5）
        fmt={(yen) => formatManApprox(yen, roundUnit)}
        footnote={
          danshinCovered
            ? "住居費 0円 ─「団信あり」の回答から、万一のとき住宅ローンは保険で完済されるため、住居費を総額に含めていません。"
            : null
        }
        result={{
          low: r.range.low,
          high: r.range.high,
          // モックの言い方（「＝ 民間保険で備える額」）に揃え、中身の性質を括弧で添える
          label: `民間保険で備える額${RESULT_QUALIFIER[rangeKey] ?? ""}`,
          note: `${RESULT_NOTE[rangeKey] ?? RESULT_NOTE.sufficient}${bandNote ?? ""}`,
        }}
        /* **手元のお金に読ませない。** 上回る分の大半は、これから算定期間をかけて入る就労収入（2026-10-15） */
        surplusNote={`この上回る分は、${survivorLabel}の就労収入（${formatManApprox(r.income.survivorWork, roundUnit)}）の前提の上にあります。いま手元にあるお金ではなく、${r.years.total}年かけて入る将来の収入を含みます。`}
        total={r.expense.total}
        totalFrom="STEP 2 の毎月の収支を通算し、大学の山と一度きりの支出まで足したもの"
        totalLabel="遺されたご家族に必要な総額"
      />

      {/*
        STEP4（照合表 #8a〜#8c）。数直線＋判定カード＋判断ポイント。
        旧 `verdictLine`（1行の判定）を撤去し、**位置関係で判定を示す形**に置換した。
        判断ポイントは `decisionPoints`（src/calc）が世帯ごとに導出する ── 手書きの固定文ではない。
      */}
      <NumberLine
        coverage={coverage}
        fmt={(yen) => `約${money(yen)}`}
        need={{ low: r.range.low, high: r.range.high }}
        points={decisionPoints(r, pj, { loan, danshinCovered })}
        verdict={shortfallVerdict}
      />

      {/* 因数分解の2表は**畳む**（第3層）。結論と根拠の図までで足りる人が大半で、
          常時展開しておくと画面が「縦の羅列」に戻る。開けば同じ情報がすべてある */}
      <details className={s.criteria}>
        <summary>金額の内訳を見る（支出・収入）</summary>

        <h3 className={s.h3}>どうしてこの金額？ ─ 見込みの支出</h3>
        <div className={s.rows}>
          {expenseItems.map((x, i) => (
            <div className={s.row} key={x.label}>
              <span className={s.rowLabel}>
                <span>
                  <span
                    aria-hidden="true"
                    className={s.swatch}
                    style={{ background: `var(--chart-expense-${Math.min(i + 1, 5)})` }}
                  />
                  {x.label}
                </span>
                {x.basis ? <span className={s.basis}>根拠：{x.basis}</span> : null}
              </span>
              <span className={s.rowAmount}>{money(x.amount)}</span>
            </div>
          ))}
          <div className={`${s.row} ${s.total}`}>
            <span>支出の合計</span>
            <span className={s.rowAmount}>{money(r.expense.total)}</span>
          </div>
        </div>

        <h3 className={s.h3}>受け取れる見込みの収入・資産</h3>
        <div className={s.rows}>
          {incomeItems.map((x, i) => (
            <div className={s.row} key={x.label}>
              <span className={s.rowLabel}>
                <span>
                  <span
                    aria-hidden="true"
                    className={s.swatch}
                    style={{ background: `var(--chart-income-${Math.min(i + 1, 5)})` }}
                  />
                  {x.label}
                </span>
                {x.basis ? <span className={s.basis}>根拠：{x.basis}</span> : null}
              </span>
              <span className={s.rowAmount}>{money(x.amount)}</span>
            </div>
          ))}
          <div className={`${s.row} ${s.total}`}>
            <span>収入・資産の合計</span>
            <span className={s.rowAmount}>{money(r.income.total)}</span>
          </div>
        </div>
      </details>
    </div>
  );
}

export default async function ResultPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const q = new URLSearchParams();
  for (const [k, val] of Object.entries(sp)) {
    if (typeof val === "string") q.set(k, val);
  }

  const sel = decodeSelections(q);
  const complete = toCompleteSelections(sel);
  if (!complete) {
    return (
      <main className={s.page}>
        <p>入力がまだ足りていないようです。</p>
        <Link className={s.link} href={`/wizard?${q.toString()}`}>
          入力に戻る
        </Link>
      </main>
    );
  }

  const params = loadParams();
  /**
   * 暮らし方の目盛り（#4・D-02・ADR-022）。**URL が状態そのもの**なので、
   * 押すたびにサーバで全部計算し直す ── 部分更新の取り残しが原理的に起きない。
   * 既定（いま通り）は URL に書かない。
   */
  const livingLevel = decodeLivingLevel(q);
  /**
   * **基準日を1つにする。** 算定・幅・感度・診断表で別々に `new Date()` を読むと、
   * 日付をまたいだ瞬間に年齢が1歳違う結果を並べてしまう
   */
  const asOfDate = new Date();
  const ri = resultInputs(params, complete, livingLevel, asOfDate);
  const { dial, rawInput, estimations, input } = ri;
  // 算定できない世帯では、金額も判定も出さずに止める（src/calc/scope.ts。diagnose も同じ所で止まる）
  if (outOfScope(params, rawInput) === "single_parent") {
    return (
      <main className={s.page}>
        <h1 className={s.h3}>この世帯は、まだ診断できません</h1>
        <p>
          配偶者がいなくて、独立前のお子さんがいる世帯の計算は、いま準備中です。
          お子さんの生活費を正しく計算できないため、金額と判定は出していません。
        </p>
        <Link className={s.link} href={`/wizard?${q.toString()}`}>
          入力に戻る
        </Link>
      </main>
    );
  }

  /**
   * **金額と判定はここで1組だけ作る**（`src/calc/figures.ts`・2026-10-17）。
   *
   * 回答は区分で受けているので、最終の必要額は**答えの幅を包絡したレンジ**（T-H）。
   * ヒーロー・診断表・STEP3/4・よみとき・次の一歩は、すべてこの `figures` を読む。
   * `result` は代表値の算定結果に最終の必要額と過不足を書き戻したもので、
   * 支出・収入・年数（内訳）だけが代表値のまま残る。
   */
  const figures = resultFigures(params, input, ri.bands, asOfDate);
  const result = figures.diagnosis;
  const envFor = (who: "self" | "spouse") => {
    const f = who === "self" ? figures.self : figures.spouse;
    if (!f?.band) return null;
    return {
      ...f.band,
      note: crossingNote(f.band, crossingDrivers(params, complete, asOfDate, who, dial)[0]),
    };
  };
  const bandSelf = envFor("self");
  const bandSpouse = envFor("spouse");

  /**
   * **目盛りを動かしても必要額が変わらない世帯がある。**
   * `ample` / `not_needed` は必要額が葬儀・予備費の床に張り付くので、
   * 生活費が動いても必要額は動かない。**無反応ではなく「吸収されている」**ので、そう言う
   * （感度文と同じ分岐の作り・2026-09-21 オーナー指示）。
   */
  /**
   * 生活費の幅（D-01）。**出どころは回答帯**で、目盛り（D-02）ではない。
   * 帯 × 率（子育て期の 0.70） × 目盛り。
   * 上端の無い区分（`35万円以上`）と「年収から推定」では幅を作らない ── 無い幅を発明しない。
   */
  const band =
    complete.livingCost !== "estimate"
      ? params.inputRanges.monthlyLivingBand[complete.livingCost]
      : undefined;
  const livingBand =
    band?.high !== undefined && band.low !== undefined
      ? {
          low: band.low * v(params, "survivorLivingRatioChild") * dial,
          high: band.high * v(params, "survivorLivingRatioChild") * dial,
        }
      : null;

  const needsAcrossDials = LIVING_LEVELS.map((lv) => {
    const r = diagnose(params, { ...rawInput, lifestyleDial: dialFor(params, lv) });
    return `${r.self.range.low}-${r.self.range.high}`;
  });
  // 「葬儀・予備費のぶんのまま」と言えるのは、包絡したレンジ全体がそうであるとき（代表値だけで言わない・2026-10-17）
  const selfNeedKey = result.self.rangeVerdict ?? result.self.verdict;
  const absorbedNote =
    new Set(needsAcrossDials).size === 1 &&
    (selfNeedKey === "ample" || selfNeedKey === "not_needed")
      ? "前提を変えても、公的な年金と資産の範囲に収まっています。必要額は葬儀・予備費のぶんのままです。"
      : null;

  // 年次キャッシュフロー（US-04b）。総額と同じ係数・同じ前提で、合計する前の姿を出す。
  // 変動率は既定の0（実値への切り替えはパラメータ版の更新でやる。SPEC 参照）。
  const asOfYear = jstYear(asOfDate);
  /**
   * **`Household` を手で組まない。** `toHousehold` を通す（src/calc）。
   * 2026-09-21、ここで `lifestyleDial` を1つ落としており、必要額だけ動いて
   * 年次（台帳・段差チャート）が古いまま残った。入力に項目が増えても落ちない形にする。
   */
  const selfProjection = projectDeath(params, toHousehold(input, "self"), { asOfYear });
  const spouseProjection = input.spouse
    ? projectDeath(params, toHousehold(input, "spouse"), { asOfYear })
    : null;

  /**
   * 冒頭ヒーローに流す世帯4値（仕様 §5.3）。
   *
   * **`householdHeadline` ではなく `householdSummary` を使う。** 前者の差額は `gap` 由来で、
   * 過剰の閾値が `coverage > high * 1.5` と判定3値の不等号から外れている。
   * 判定と差額の出どころを揃えないと、見出しが自分の根拠と食い違う。
   */
  // 団信ありなら住宅ローンは死亡時に消える。家計台帳の「住宅ローン 0円」の行に使う
  const danshinCovered =
    input.housing.type === "own" &&
    (input.housing.loan ?? 0) > 0 &&
    input.housing.danshin !== false;

  const hh = figures.household;

  /**
   * リスク別健康診断表の6行（仕様 §5.3）。
   *
   * **死亡は本人・配偶者を2行に分ける。** 個人の判定が正で、世帯の集約（組み替えの余地など）は
   * 軸が違うのでここには混ぜない（世帯の結論は下の死亡詳細セクションに出る）。
   * **所見の文言はモック `docs/design-mock/check.html` が正で、金額だけ実計算値に差し替える。**
   */
  const sims = simulateAll(params, {
    answers: input,
    asOf: asOfDate,
    assumptions: { livingLevel },
  });
  const bySc = Object.fromEntries(sims.map((x) => [x.scenario, x]));
  const TONE = { reducible: "ok", uncertain: "check", shortage: "short" } as const;
  const SAVINGS_LABEL = {
    reducible: "大丈夫のめやす",
    uncertain: "圏内・要精査",
    shortage: "備え不足の可能性",
    pending: "判定できません",
  } as const;

  /**
   * 感度文（仕様 §5.3 T-E・2026-09-21 オーナー承認の文型）。
   *
   * **露出部は帯の直下にこの1文だけ。** 分岐と数値は `survivorIncomeSensitivity`（src/calc）が出す。
   * ここがやるのは、返ってきた値を文に差し込むことだけ。
   *
   * 文型ルール：
   * - 判定ラベルは**バッジと同じ `DEATH_LABEL`** をバインドする。手打ちで再入力しない
   * - **括弧の中は手取りで書く。** 額面と手取りを混ぜると掛け算が合わなくなる
   *   （`年700万円×25年＝約1億4,000万円` は合わない。手取り560万×25年なら合う）
   * - 否定で終わらせない。**判定が動かない場合でも、必要額がどれだけ動くかを書く**
   */
  const sensitivityFor = (who: "self" | "spouse"): { text: string } | null => {
    const sv = survivorIncomeSensitivity(params, input, who, asOfDate, ri.bands);
    return sv ? { text: sensitivityText(sv, who) } : null;
  };

  /** 死亡の1行を作る。本人と配偶者で同じ形にする */
  const deathRow = (
    who: "本人" | "配偶者",
    dr: typeof result.self,
    cov: number | null | undefined,
    band: ReturnType<typeof envFor>,
  ): RiskRow => {
    /**
     * **画面に出すのは包絡したレンジ**（T-H）。点のレンジは端の一部でしかない。
     * 過不足の判定（`Verdict3`）も同じレンジで出す ── 表示と判定が別の数字を見ていたら、
     * 「幅を跨いでいる」と書いてあるのにバッジが動かない、という食い違いが起きる。
     */
    const low = band?.low ?? dr.range.low;
    const high = band?.high ?? dr.range.high;
    const v = verdict3(cov, low, high);
    const range = formatRange(low, high);
    const hold = cov ?? null;
    const covText = hold === null ? "未入力" : `約${money(hold)}`;
    /**
     * **必要額が葬儀費用だけになる世帯は、その理由を先に言う。**
     * `ample`（公的年金と資産で生活費がまかなえる）と `not_needed`（扶養家族がいない）は
     * `death.ts` で low = high = 葬儀費用になる。理由抜きで「必要額 約200万円」とだけ出すと、
     * 読み手には桁を間違えた数字に見える。良い知らせは良い知らせとして届ける（CLAUDE.md）。
     */
    // 呼び名は包絡したレンジ全体の必要額の判定（ニーズ軸）から。代表値だけ葬儀費用でも、
    // 厳しめ端で足りないなら「葬儀費用だけ」とは言わない（`mixed` の説明は crossingNote が持つ・2026-10-17）
    const needKey = dr.rangeVerdict ?? dr.verdict;
    const funeralOnly = needKey === "ample" || needKey === "not_needed";
    const reason =
      needKey === "ample"
        ? "公的な年金と資産で、遺されたご家族の生活費はまかなえる見込みです。"
        : needKey === "not_needed"
          ? "扶養しているご家族がいないため、上乗せの保障は要りません。"
          : "";
    /**
     * **所見は2文以内で、金額を書かない。**
     * 金額は figures の明朝20px、過不足は数直線の位置関係が伝える（視覚の DoD (b)）。
     * ここに数字を戻すと、また「読まないと分からない画面」に戻る。
     */
    const body =
      v === "pending"
        ? "いまの保障が分からないため、過不足は出していません。"
        : v === "reducible"
          ? funeralOnly
            ? "見込むのは葬儀費用だけで、いまの保障はそれを上回っています。"
            : "厳しめに見た必要額の上端よりも、いまの保障が上回っています。"
          : v === "uncertain"
            ? "必要額の幅がいまの保障を跨いでいるため、減らせるとも足りないとも言い切りません。"
            : "ゆるめに見た必要額の下端にも、いまの保障が届いていません。";
    return {
      key: `death-${who}`,
      title: `死亡（${who}）`,
      // 配偶者も子もいない世帯に「遺されたご家族」と書かない（UX レビュー §指摘・2026-10-17）
      subtitle: input.spouse || input.children.length > 0 ? "遺されたご家族の生活" : "葬儀・身の回りの整理",
      tone: v === "pending" ? "none" : TONE[v],
      verdictLabel: DEATH_LABEL[v],
      precisionLabel: "計算済み",
      precisionTone: "calculated",
      figures: {
        needLabel: "必要額",
        needText: range,
        holdLabel: "いまの保障",
        holdText: covText,
      },
      scale: {
        needLow: low,
        needHigh: high,
        hold,
        axisMaxText: `約${money(Math.max(high, hold ?? 0))}`,
      },
      note: `${reason}${body}`,
      // 判定を支えている前提（仕様 §5.3 の開示6点）。`ample` 系のときだけ engine が返す
      assumptions: dr.assumptions.map((a) => ({ label: a.label ?? "前提", note: a.note })),
      /**
       * 前提の重みを図にする。金額は算定結果（income）から取り、UI では作らない。
       * **本人の行は冒頭「この結論を決めている前提」が同じ図と感度文を持つ**ので、ここでは出さない
       * （置換であって共存ではない・2026-10-17 最初の2画面の作り直し）。前提の全項目は折りたたみに残す。
       */
      premiseWeight:
        who === "配偶者" &&
        dr.assumptions.length > 0 &&
        dr.income.total > 0 &&
        dr.income.survivorWork > 0
          ? {
              share: dr.income.survivorWork / dr.income.total,
              totalText: `約${money(dr.income.total)}`,
              onPremiseText: `約${money(dr.income.survivorWork)}`,
              survivorLabel: "あなた",
            }
          : null,
      premiseSensitivity:
        who === "配偶者" && dr.assumptions.length > 0 ? sensitivityFor("spouse") : null,
      /**
       * **答えの幅で判定が変わるなら、露出部に出す**（2026-09-23 オーナー裁定）。
       * 判定が動きうるという事実を折りたたみの中に入れない。
       */
      crossingNote: band?.note ?? null,
      // 単身世帯は死亡の詳細（STEP1〜4）を持たないので、冒頭の前提（内訳の図）へ
      link:
        dr.years.total === 0
          ? { href: "#key-premise", label: "内訳 →" }
          : { href: "#death-detail", label: "詳しく →" },
    };
  };

  /** 制度式で概算する行（病気・けが・失業）。受け皿は保険ではなく貯蓄 */
  const unsupportedRow = (
    key: string,
    title: string,
    subtitle: string,
    sim: (typeof sims)[number],
  ): RiskRow => ({
    key,
    title,
    subtitle,
    tone: "none",
    verdictLabel: "未診断",
    precisionLabel: "計算未対応",
    precisionTone: "unsupported",
    figures: null,
    scale: null,
    note: sim.notSupported?.detail ?? "",
    assumptions: [],
    premiseWeight: null,
    premiseSensitivity: null,
    link: { pending: "もしもラボで見る（準備中）" },
  });

  const savingsRow = (
    key: string,
    title: string,
    subtitle: string,
    sim: (typeof sims)[number],
    lead: string,
  ): RiskRow => {
    // 計算未対応（例：自営の失業）は、空欄の行として出す。0円や「大丈夫」と読ませない
    if (sim.status === "not_supported") return unsupportedRow(key, title, subtitle, sim);
    const v = sim.verdict ?? "pending";
    const range = sim.amounts ? formatRange(sim.amounts.needLow, sim.amounts.needHigh) : "—";
    // 受け皿は貯蓄。`simulate` に幅を渡していないので、いまは1点（`assumptions[]` にそう書いてある）
    const hold = input.assets;
    const tail =
      v === "reducible"
        ? "いまの貯蓄で受けられる水準です。"
        : v === "shortage"
          ? "いまの貯蓄では届かない可能性があります。"
          : "いまの貯蓄と幅が重なるので、言い切れません。";
    return {
      key,
      title,
      subtitle,
      tone: v === "pending" ? "none" : TONE[v],
      verdictLabel: SAVINGS_LABEL[v],
      precisionLabel: "制度式で概算",
      precisionTone: "statutory",
      figures: {
        needLabel: "必要額",
        needText: range,
        holdLabel: "いまの貯蓄",
        holdText: `約${money(hold)}`,
      },
      scale: sim.amounts
        ? {
            needLow: sim.amounts.needLow,
            needHigh: sim.amounts.needHigh,
            hold,
            axisMaxText: `約${money(Math.max(sim.amounts.needHigh, hold))}`,
          }
        : null,
      // 所見は2文以内。金額は figures と数直線が持つ（視覚の DoD (b)）
      note: `${lead}${tail}`,
      // 完全な記録として全項目を折りたたみに出す（判定を左右する項目には見出し語が付いている）
      assumptions: sim.premises,
      // 帯と感度文は死亡カード専用。ここは受け皿が貯蓄で、動かす前提が1本に決まらない
      premiseWeight: null,
      premiseSensitivity: null,
      // ラボは未実装。**押せないことを黙らせない**
      link: { pending: "もしもラボで見る（準備中）" },
    };
  };

  const riskRows: RiskRow[] = [
    deathRow("本人", result.self, input.coverageSelf, bandSelf),
    ...(result.spouse
      ? [deathRow("配偶者", result.spouse, input.coverageSpouse, bandSpouse)]
      : []),
    savingsRow(
      "sick_short",
      "病気・けが（短期）",
      "入院・〜3か月の休み",
      bySc.sick_short,
      "高額療養費と傷病手当金が効く範囲です。",
    ),
    savingsRow(
      "sick_long",
      "病気・けが（長期休職）",
      "がん・脳卒中・こころ／〜1年半",
      bySc.sick_long,
      "傷病手当金は通算1年6か月で切れます。",
    ),
    unsupportedRow("disability", "就業不能・障害", "1年半を超えて働けない", bySc.disability),
    savingsRow(
      "unemployment",
      "失業",
      "仕事を失ったとき",
      bySc.unemployment,
      "雇用保険の基本手当と生活防衛資金で受ける領域で、保険で備える場所ではありません。",
    ),
  ];

  /** 計算未対応で空欄の行の数（「◯つのリスクを並べました（うち◯つは未算定）」） */
  const unsupportedCount = riskRows.filter((r) => r.precisionTone === "unsupported").length;

  // 進路 what-if（子がいる世帯だけ）：公立/私立で必要額（あなた）がどう変わるか
  const eduWhatIf =
    input.children.length > 0
      ? (
          [
            ["public", "公立中心"],
            ["mixed", "私立混在"],
            ["private", "私立中心"],
          ] as [EducationPlan, string][]
        ).map(([plan, label]) => {
          // 進路で直接変わるのは教育費。必要額のレンジは verdict で意味が変わり
          // 単純比較できない（sufficient=上乗せ目安 / shortage=不足額）ので、
          // ここでは比較可能な「教育費」を並べる。
          const r = diagnose(params, { ...input, educationPlan: plan });
          return { label, education: r.self.expense.education };
        })
      : [];

  /**
   * チップに出た専門用語の1行注釈（CLAUDE.md「専門用語は初出で1行注釈」）。
   * **旧「いまの家計」の住まいの欄が負っていた責務**をここへ移した。
   * これを落とすと、以降の「回答: 団信あり」や滝の脚注が無注釈の初出になる。
   */
  const terms =
    input.housing.type === "own" && (input.housing.loan ?? 0) > 0
      ? ["団信＝亡くなると住宅ローンが消える保険です。"]
      : [];
  const editHref = `/wizard?${q.toString()}`;

  const caption = `${input.self.age}歳・${input.self.employment === "employee" ? "会社員" : input.self.employment === "self" ? "自営・フリーランス" : "無職"}${input.spouse ? `・配偶者${input.spouse.age}歳` : "・配偶者なし"}${input.children.length > 0 ? `・子${input.children.length}人` : "・子なし"}`;

  /**
   * 次の見直しのめやす（次の一歩に添える）。
   * **段差チャートの段差①と同じ材料**（`projectDeath` の年次）から取る。
   * 画面で年を作らない ── 図と導線で別の年を出すと、どちらが正か分からなくなる。
   */
  const watchYear = (() => {
    const rows = selfProjection.rows;
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1];
      const now = rows[i];
      const pen = (r: typeof now) =>
        r.income.pensionBasic + r.income.pensionKosei + r.income.chukoreiKafu;
      if (Math.abs(pen(now) - pen(prev)) >= 1000 * 12) return now.year;
    }
    return null;
  })();


  /**
   * 使った前提と出典（照合表 #9）。**ラベルとURLは `params` から取る。**
   * 画面で出典名を手打ちすると、制度側が変わったときに値だけ更新されて表示が古く残る。
   *
   * **モックの4チップを書き写さない。** モックは「生活費水準: 総務省 家計調査」を挙げるが、
   * この実装の生活費は**利用者の回答**（幅）に当社基準の率を掛けたもので、家計調査は使っていない。
   */
  const usedSources: UsedSource[] = [
    {
      what: "遺族年金の額",
      label: params.public.izokuKisoBase.source ?? "日本年金機構",
      url: "https://www.nenkin.go.jp/service/jukyu/seido/izokunenkin/jukyu-yoken/index.html",
      verified: params.public.izokuKisoBase.verified !== false,
    },
    {
      what: "高額療養費",
      label: params.kogaku.sources.brackets.label,
      url: params.kogaku.sources.brackets.url,
      verified: params.kogaku.sources.brackets.verified,
    },
    {
      what: "傷病手当金",
      label: params.shobyoTeate.sources.rate.label,
      url: params.shobyoTeate.sources.rate.url,
      verified: params.shobyoTeate.sources.rate.verified,
    },
    {
      what: "雇用保険 基本手当",
      label: params.kihonTeate.sources.daysGeneral.label,
      url: params.kihonTeate.sources.daysGeneral.url,
      verified: params.kihonTeate.sources.daysGeneral.verified,
    },
    {
      what: "教育費",
      label: "文部科学省「子供の学習費調査」",
      url: "https://www.mext.go.jp/b_menu/toukei/chousa03/gakushuuhi/1268091.htm",
      verified: false,
    },
    {
      what: "高校生等への就学支援",
      label: "文部科学省「高校生等への修学支援」",
      url: "https://www.mext.go.jp/a_menu/shotou/mushouka/index.htm",
      verified: params.education.shien.verified !== false,
    },
  ];
  const sourcesNote = `制度パラメータ版 ${result.paramVersion} に、各値の出典URLと施行日を記録しています。下の当社基準には公的出典がありません。`;

  /**
   * 最初の2画面（結論・次の一歩・前提1点）の材料。すべて `figures` と感度（src/calc）から来る。
   * **不足額を2人分の合計で出さない。** 人ごとの行に、その人の差の幅を出す（2026-10-17・オーナー判断カードの推奨）。
   */
  const selfEstimated = ownStandardEstimates(result.self, "配偶者").length > 0;
  const premise = keyPremise(
    figures,
    survivorIncomeSensitivity(params, input, "self", asOfDate, ri.bands),
    selfEstimated,
  );
  const roundUnit = v(params, "roundUnit");
  const rows = personRows(figures);
  const spouseRow = rows.find((x) => x.who === "spouse") ?? null;
  const estimatedCount = estimations.length + (selfEstimated ? 1 : 0);

  /**
   * 診断表の行のうち、貯蓄で受ける行（病気・失業）の過不足の判定（過不足軸）。単身世帯の案内文に使う（§6-10）
   */
  const savingsVerdicts = ["sick_short", "sick_long", "unemployment"]
    .map((k) => bySc[k])
    .filter((x) => x && x.status !== "not_supported")
    .map((x) => x.verdict ?? "pending");
  const soloLead =
    result.self.years.total === 0
      ? [
          "この世帯では、死亡より病気や失業の影響のほうが大きくなります。",
          savingsVerdicts.length > 0 && savingsVerdicts.every((x) => x === "reducible")
            ? "病気と失業は、いまの貯蓄で受けられる水準です。"
            : "病気と失業の過不足は、下の各行で見てください。",
          bySc.disability?.status === "not_supported"
            ? "1年半を超えて働けない場合は、まだ計算していません。"
            : "",
        ].join("")
      : null;

  return (
    <main className={s.page}>
      {/*
        最初の2画面（2026-10-17・最初の2画面の作り直し。§5 の並べ直し案）。
        1. 結論（判定バッジ＋1文＋人ごとの行＋数直線1本） 2. 次の一歩（1つ） 3. この結論を決めている前提（1点）。
        旧ヒーロー・よみときのサマリー・ページ下の「次の一歩」の数字ブロックはここに置き換えた
        （同じ結論を3回くり返さない・置換であって共存ではない）。
      */}
      <Conclusion
        caption={caption}
        fmt={(yen) => formatRange(yen, yen)}
        headline={conclusionHeadline(figures)}
        householdBadge={HERO_BADGE[hh.verdict]}
        householdTone={HERO_TONE[hh.verdict]}
        modeText={LIVING_LEVEL_LABEL[livingLevel].name}
        nextStep={nextStepSentence(
          figures,
          { self: input.self.employment, spouse: input.spouse?.employment ?? null },
          estimatedCount,
        )}
        noReducible={noReducibleSentence(figures)}
        partialNote={partialNote(figures)}
        premise={premise}
        premiseFmt={(yen) => formatManApprox(yen, roundUnit)}
        reason={conclusionReason(figures)}
        reviewYear={watchYear}
        rows={rows}
      />

      {/* 根拠 1：リスク別健康診断表（仕様 §5.3） */}
      <RiskTable
        caption={caption}
        countUnit={
          unsupportedCount > 0
            ? `つのリスクを並べました（うち${unsupportedCount}つは未算定）`
            : "つのリスクを診ました"
        }
        lead={soloLead}
        rows={riskRows}
        // 貯蓄で受ける行（制度式で概算）があるときだけ、その共通の受け皿の額を注記に立てる
        sharedSavingsText={
          riskRows.some((r) => r.precisionTone === "statutory") ? `約${money(input.assets)}` : null
        }
      />

      {/*
        暮らし方の前提（照合表 #4）。**結論の上から根拠の側へ移した**（§5-5：STEP2 の直前）。
        結論を読む前に1画面ぶんの選択 UI が来ていた。結論には選んでいる前提の名前だけを出す。
      */}
      <LivingDial
        absorbedNote={absorbedNote}
        current={livingLevel}
        hrefFor={(lv) => `/result?${withLivingLevel(q, lv)}`}
      />

      {/*
        根拠 2・3：本人 → 配偶者の死亡の詳細（STEP1〜4）。
        **単身世帯では出さない**（§5 の世帯ごとの差）。遺す相手がいない世帯では算定期間が0年で、
        STEP2〜4 は描く材料を持たない。必要額（葬儀などの費用）と保障の内訳は冒頭の前提1点の図が持つ。
      */}
      {result.self.years.total > 0 && (
        <div className={`${s.section} ${s.sectionMajor}`} id="death-detail">
          <CaseCard
            childCount={input.children.length}
            chips={answerChips(input, input.coverageSelf)}
            coverage={input.coverageSelf}
            danshinCovered={danshinCovered}
            editHref={editHref}
            estimations={estimations}
            terms={terms}
            koseiFrom={input.self.employment === "employee" ? "会社員" : null}
            pj={selfProjection}
            r={result.self}
            livingBand={livingBand}
            loan={input.housing.loan ?? null}
            reform2028Reason={result.reform2028.reason}
            survivorLabel="配偶者"
            title="あなたが亡くなった場合"
            gapText={gapSentence(figures.self)}
            bandNote={bandWidenedNote(figures.self)}
            roundUnit={roundUnit}
            workFrom={input.spouse && input.spouse.income > 0 ? "配偶者の年収" : null}
          />
          {/* 配偶者側は**要約1行＋開閉**にする。閉じていても過不足は要約に出す */}
          {result.spouse && spouseProjection && (
            <details className={s.spouseCase}>
              <summary className={s.spouseSummary}>
                <span className={s.spouseSummaryTitle}>配偶者が亡くなった場合</span>
                {/*
                  閉じていても過不足は出す。差の幅は**独立した大きな数字**にする（冒頭の人ごとの行と同じ値・
                  `personRows`）。文に埋めると、閉じた箱が文字だけの区間になる（DoD (a)(b)）
                */}
                {spouseRow && (
                  <span className={s.spouseSummaryVerdict}>
                    <span className={s.spouseSummaryLabel}>{spouseRow.mainLabel}</span>
                    <span className={s.spouseSummaryValue}>
                      <RangeText text={spouseRow.mainText} />
                    </span>
                  </span>
                )}
              </summary>
              <CaseCard
                childCount={input.children.length}
                chips={answerChips(input, input.coverageSpouse ?? null)}
                coverage={input.coverageSpouse ?? null}
                danshinCovered={danshinCovered}
                editHref={editHref}
                estimations={estimations}
                terms={terms}
                koseiFrom={input.spouse?.employment === "employee" ? "配偶者は会社員" : null}
                pj={spouseProjection}
                r={result.spouse}
                /* **配偶者が亡くなるケースでは遺族は本人。** `result.reform2028` は
                   遺族＝配偶者のケースで作られているので、別人の年齢で判定した注記を出さない */
                reform2028Reason={
                  reform2028({
                    survivorAge: input.self.age,
                    asOfYear,
                    hasChildren: input.children.length > 0,
                  }).reason
                }
                livingBand={livingBand}
                loan={input.housing.loan ?? null}
                survivorLabel="あなた"
                title="配偶者が亡くなった場合"
                gapText={figures.spouse ? gapSentence(figures.spouse) : ""}
                bandNote={figures.spouse ? bandWidenedNote(figures.spouse) : null}
                roundUnit={roundUnit}
                workFrom={input.self.income > 0 ? "あなたの年収" : null}
              />
            </details>
          )}
        </div>
      )}

      {/*
        根拠 4：この結果のよみとき（T-07）。数値は AI に書かせず算定結果を差し込む。
        **数字のサマリーは出さない**（§5-7）。結論の数字は冒頭に1回だけ出ている。
        鍵が無ければ AI を呼ばず、テンプレのまま出す（AI を止めても成立する）
      */}
      <Narration
        // 入力（クエリ）が変わったら状態ごと作り直す（2026-10-17・QA）
        key={q.toString()}
        aiEnabled={Boolean(process.env.GEMINI_API_KEY)}
        initialText={narrate(result).text}
        query={q.toString()}
        values={placeholderValues(result)}
      />

      {/*
        末尾の折りたたみ（すべて件数つき・§5-8〜12）。参照材をここにまとめる。
        露出は見出しの1行だけで、中身は開けばすべてある（開示の規約）。
      */}
      <div className={`${s.section} ${s.tail}`}>
        <h2 className={s.tailHead}>参考と前提</h2>
        {/*
          **使った根拠の数を、あるべき声量で出す**（視覚の DoD (a)）。よみときから末尾まで図も大きな数字も無く、
          1画面を超える文字だけの区間になっていた。数は下の折りたたみの件数と同じ（params から数える）。
        */}
        <div className={s.tailStats}>
          <p className={s.tailStat}>
            <span className={s.tailStatLabel}>公的な出典</span>
            <span className={s.tailStatValue}>{usedSources.length}件</span>
          </p>
          <p className={s.tailStat}>
            <span className={s.tailStatLabel}>当社基準</span>
            <span className={s.tailStatValue}>{Object.keys(params.ownStandard).length}件</span>
          </p>
        </div>

        <Fold count="（2項目）" label="この診断で分かること・まだ分からないこと">
          <p className={s.basis}>
            分かること：死亡・病気・失業のときの、いまの保障や貯蓄との過不足の目安です。
          </p>
          <p className={s.basis}>
            まだ扱っていないこと：就業不能（計算はまだです）・介護・老後・保険商品の良し悪しです。
          </p>
        </Fold>

        {/*
          2028年の年金改正。**対象外の世帯では1行**（UX_REVIEW 1回目・§5-9）。
          対象の世帯は、試算がまだ改正前の制度であることを同じ行で言う（影響の向きと反映の有無）。
        */}
        <Fold
          count="（理由1件）"
          label={
            result.reform2028.applicable
              ? "2028年の年金改正：配偶者の遺族年金の受け取り方が変わる対象です。この試算は改正前の制度で計算しています"
              : "2028年の年金改正：この世帯は対象外です"
          }
        >
          <p className={s.reformBody}>{result.reform2028.reason}</p>
        </Fold>

        {eduWhatIf.length > 0 && (
          <Fold
            count={`（${eduWhatIf.length}通り・お子さん合計）`}
            label="進路で教育費はこう変わる"
          >
            <div className={s.rows}>
              {eduWhatIf.map((w) => (
                <div className={s.row} key={w.label}>
                  <span className={s.rowLabel}>{w.label}</span>
                  <span className={s.rowAmount}>{money(w.education)}</span>
                </div>
              ))}
            </div>
            <p className={s.basis}>
              ※ 進路が未定なら公立中心で計算しています。私立にするほど教育費が増え、その分
              必要な保障額も上がります。
            </p>
          </Fold>
        )}

        {/* 平均の中立併記（社会的証明＝煽りにしない。平均は目標ではない） */}
        <Fold count="（1件）" label="ご参考：世帯の死亡保険金額の平均">
          <p className={s.basis}>
            世帯の死亡保険金額の平均は約{formatMan(v(params, "householdDeathCoverageAvg"))}
            です（生命保険文化センター）。平均は目標ではありません。必要な額は、あなたの前提での必要額（上の目安）で見てください。
          </p>
        </Fold>

        {/* 選ぶ基準。動かす理由がある人がいるときだけ */}
        {hasActionableGap(figures) && (
          <Fold count="（4点）" label="保険を選ぶときの基準">
            <ul className={s.list}>
              <li>いくらの保障が必要か（この診断の目安）</li>
              <li>いつまで必要か（末子の独立・配偶者の年齢）</li>
              <li>毎月の保険料に無理がないか</li>
              <li>誰が被保険者か（本人／配偶者）</li>
            </ul>
            <p className={s.basis}>
              ※
              具体的な商品名・会社名・ランキングは出しません。どうするかを決めるのは、ご本人です。
            </p>
          </Fold>
        )}

        {/* 照合表 #9「使った前提と出典」。件数は出典と当社基準を分けて出す（§指摘） */}
        <Fold
          count={`（出典${usedSources.length}件・当社基準${Object.keys(params.ownStandard).length}件）`}
          label="使った前提と出典"
        >
          <UsedSources items={usedSources} note={sourcesNote} />
          <h3 className={s.h3}>当社基準（公的出典のない当社の見立て）</h3>
          <ul className={s.list}>
            {/* **値も並べる**（2026-09-22）。名前だけ見せて値を隠すと開示の意味が半減する */}
            {Object.entries(params.ownStandard).map(([key, e]) => {
              const valueText = ownStandardValueText(e);
              return (
                <li key={key}>
                  {e.label ?? key}
                  {valueText ? `：${valueText}` : ""}
                  {e.userAdjustable ? "（画面で動かせます）" : ""}
                </li>
              );
            })}
          </ul>
        </Fold>
      </div>

      {/* 続きを受け取る導線（T-13）。**準備中のあいだは出さない**（§指摘：押せない導線を見せない） */}
      {SAVE_ENABLED && (
        <div className={`${s.section} ${s.watchCard}`}>
          <h2 className={s.h3}>このあと、状況が変わったら</h2>
          <p className={s.watchLead}>
            お子さんの進学など、必要な保障が変わる時期にだけ一言お知らせします。
            保存するのは今日の入力（範囲）と結果の要点だけで、
            <strong>お知らせに金額は書きません</strong>。いつでも削除できます。
          </p>
          <Link className={s.watchButton} href={`/save?${q.toString()}`}>
            この結果を保存してお知らせを受け取る
          </Link>
          <p className={s.basis}>※ 保存しなくても、この結果はURLをブックマークすれば見返せます。</p>
        </div>
      )}

      {/*
        フッター（1回だけ）：概算・要精査／算定基準日／パラメータ版＋文面の確定前の注記＋入力をやり直す。
        算定基準日とパラメータ版は「いつの・どの制度で」出たかの情報なので、値は強調する。
      */}
      <div className={s.draftNote}>
        <p className={s.footHead}>
          これは<strong>概算・要精査</strong>です
        </p>
        <div className={s.tailStats}>
          <p className={s.tailStat}>
            <span className={s.tailStatLabel}>算定基準日</span>
            {/* 日本時間の日付（UTC で切ると Cloud Run では JST 0〜9時に前日になる・2026-09-22） */}
            <span className={s.tailStatValue}>{jstDate(asOfDate)}</span>
          </p>
          <p className={s.tailStat}>
            <span className={s.tailStatLabel}>使用パラメータ版</span>
            <span className={s.tailStatValue}>{result.paramVersion}</span>
          </p>
        </div>
        <p className={s.footNote}>
          次の一歩・選ぶ基準の文面は、保険業法の正式な弁護士レビュー（OI-01）後に確定します（現在はサンプル）。
        </p>
        <Link className={s.link} href={`/wizard?${q.toString()}`}>
          入力をやり直す
        </Link>
      </div>
    </main>
  );
}
