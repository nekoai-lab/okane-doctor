/**
 * 結果画面 v1（AIなし・T-05a）
 *
 * サーバコンポーネント。URL の区分コードを decode →（params を読んで）normalize → diagnose。
 * 数値は src/calc でしか作らない（責務境界）。ここは算定結果を「因数分解して見せる」だけ。
 * 芯：概算・要精査／前提／出典を必ず添える。減らせる箇所は無ければ「見つかりませんでした」と明示する。
 */
import Link from "next/link";
import { decisionPoints } from "../../src/calc/decisionPoints.js";
import { crossingNote } from "../../src/calc/envelope.js";
import { resultFigures } from "../../src/calc/figures.js";
import type { DiagnoseInput } from "../../src/calc/index.js";
import { diagnose, outOfScope, toHousehold } from "../../src/calc/index.js";
import { labDeath } from "../../src/calc/lab.js";
import type { Projection } from "../../src/calc/projection.js";
import { projectDeath } from "../../src/calc/projection.js";
import { reform2028 } from "../../src/calc/reform2028.js";
import { survivorIncomeSensitivity } from "../../src/calc/sensitivity.js";
import { dialFor, simulateAll } from "../../src/calc/simulate.js";
import type { DeathResult, EducationPlan } from "../../src/calc/types.js";
import { verdict3 } from "../../src/calc/verdict3.js";
import { workingUntil } from "../../src/calc/work.js";
import { formatMan, formatManApprox, formatRange } from "../../src/design/tokens.js";
import { narrate, placeholderValues } from "../../src/narrate/narrate.js";
import { ownStandardValueText } from "../../src/params/display.js";
import { loadParams, v } from "../../src/params/index.js";
import { jstDate, jstYear } from "../../src/time/jstYear.js";
import { SAVE_ENABLED } from "../../src/watch/availability.js";
import { toCompleteSelections } from "../../src/wizard/complete.js";
import {
  decodeLivingLevel,
  LIVING_LEVEL_LABEL,
  LIVING_LEVELS,
  withLivingLevel,
} from "../../src/wizard/dial.js";
import { resultInputs } from "../../src/wizard/resultInputs.js";
import { crossingDrivers } from "../../src/wizard/uncertainty.js";
import { decodeSelections } from "../../src/wizard/url.js";
import { BalanceColumns } from "./BalanceColumns.js";
import { CaseTabs } from "./CaseTabs.js";
import { Conclusion } from "./Conclusion.js";
import {
  conclusionHeadline,
  conclusionReason,
  keyPremise,
  nextStepSentence,
  noReducibleSentence,
  personRows,
  reviewReasonSentence,
  workEndCompare,
} from "./conclusionModel.js";
import { ownStandardEstimates, workDeductionSource } from "./estimates.js";
import { Fold } from "./Fold.js";
import { bandWidenedNote, partialNote } from "./figureText.js";
import { HERO_BADGE, HERO_ICON, HERO_TONE } from "./Hero.js";
import { LivingDial } from "./LivingDial.js";
import { Narration } from "./Narration.js";
import { NeedBand } from "./NeedBand.js";
import { hasActionableGap } from "./nextStep.js";
import s from "./page.module.css";
import { ReportSection, type ReportSectionMeta, ReportToc } from "./Report.js";
import { type RiskRow, RiskTable } from "./RiskTable.js";
import r from "./report.module.css";
import { type AnswerChip, Step1 } from "./Step1.js";
import { Step2 } from "./Step2.js";
import { sensitivityText } from "./sensitivityText.js";
import { type UsedSource, UsedSources } from "./UsedSources.js";
import { DEATH_LABEL, SAVINGS_LABEL } from "./verdictLabels.js";

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

function money(yen: number): string {
  return formatMan(yen);
}

/** 「約◯万円」。**0円には「約」を付けない**（「約0万円」は桁の誤りに見える・AUDIT 1-8） */
function approx(yen: number): string {
  return yen === 0 ? "0円" : `約${money(yen)}`;
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
function answerChips(
  input: DiagnoseInput,
  coverage: number | null,
  coverageSpouse: number | null | undefined,
): AnswerChip[] {
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
      key: input.spouse ? "あなたの保障" : "いまの保障",
      value: coverage === null ? "未入力" : man(coverage),
    },
    // 前提の確認は1か所にまとめたので、配偶者の保障も同じ札の並びに出す（2026-10-18・レポート形式）
    ...(input.spouse
      ? [
          {
            field: null,
            group: "home" as const,
            key: "配偶者の保障",
            value: coverageSpouse == null ? "未入力" : man(coverageSpouse),
          },
        ]
      : []),
  ];
}

/**
 * 判断ポイントのうち、見直しの節の年表（公的年金・大学の時期）と同じことを言う行。
 * 金額の根拠の節には、住まいと前提の行だけを出す（同じ年を2か所で言わない）
 */
const TIMELINE_POINT = /^(正念場|公的年金が下がる|大学の学費)/;

/**
 * 金額の根拠の節の中身（1ケース分）。出ていくお金と入ってくるお金の縦2本＋明細。
 * 旧 STEP3 の滝・内訳の折りたたみ・数直線の判定カードをここへまとめた（置換であって共存ではない）。
 * 過不足の判定は冒頭の結論が持つので、ここでは必要額がどう組み上がるかだけを見せる。
 */
function CaseBasis({
  r,
  pj,
  survivorLabel,
  childCount,
  danshinCovered,
  loan,
  bandNote,
  roundUnit,
}: {
  r: DeathResult;
  pj: Projection;
  /** 遺される側の呼び名（本人死亡なら「配偶者」、配偶者死亡なら「あなた」） */
  survivorLabel: string;
  childCount: number;
  danshinCovered: boolean;
  /** 住宅ローン残高（判断ポイントの文面に使う） */
  loan: number | null;
  /** 最終の必要額が代表値より広い幅のとき、その旨の1文（`bandWidenedNote`）。無ければ null */
  bandNote: string | null;
  /** 内訳の中間値を丸める単位（円）。params の `roundUnit` */
  roundUnit: number;
}) {
  /** `r.range`（包絡したレンジ）の呼び名に使う必要額の判定（ニーズ軸）。代表値の `r.verdict` ではない */
  const rangeKey = r.rangeVerdict ?? r.verdict;
  const work = workDeductionSource(r, survivorLabel);
  const pension = r.income.pensionBasic + r.income.pensionKosei + r.income.chukoreiKafu;
  const fmt = (yen: number) => formatManApprox(yen, roundUnit);
  return (
    <BalanceColumns
      expense={[
        {
          label: "ご家族の生活費（子育て期）",
          short: "生活費（子育て期）",
          amount: r.expense.livingChild,
          basis: "当社基準",
        },
        {
          label: "ご家族の生活費（末子独立後）",
          short: "生活費（独立後）",
          amount: r.expense.livingAlone,
          basis: "当社基準",
        },
        {
          label: "教育費",
          amount: r.expense.education,
          basis: "文科省 子供の学習費調査（塾・部活・行事・制服も含む実支出）",
        },
        {
          label: "住居費（団信なしのローン残高）",
          short: "住居費",
          amount: r.expense.housing,
          basis: "回答",
        },
        { label: "葬儀・予備費", amount: r.expense.funeral, basis: "当社基準" },
      ].filter((x) => x.amount > 0)}
      expenseTotal={r.expense.total}
      fmt={fmt}
      footnotes={[
        ...(pension > 0
          ? [
              `遺族年金は${r.income.pensionKosei > 0 ? "会社員（厚生年金）" : "自営・フリーランス"}${childCount > 0 ? `・子${childCount}人` : ""}の制度で、遺される側が妻の場合として計算しています（夫の場合は中高齢寡婦加算などが出ないことがあります）。`,
            ]
          : []),
        ...(r.income.survivorWork > 0
          ? ["就労収入は手取りに換算し、算定期間ぶん積んだものです。"]
          : []),
        ...(danshinCovered
          ? [
              "住居費 0円：「団信あり」の回答から、万一のとき住宅ローンは保険で完済されるため、住居費を総額に含めていません。",
            ]
          : []),
        /* **手元のお金に読ませない。** 上回る分の大半は、これから算定期間をかけて入る就労収入（2026-10-15） */
        ...(r.margin > 0 && r.income.survivorWork > 0
          ? [
              `上回る分は、${survivorLabel}の就労収入（${fmt(r.income.survivorWork)}）の前提の上にあります。いま手元にあるお金ではなく、${r.years.total}年かけて入る将来の収入を含みます。`,
            ]
          : []),
      ]}
      income={[
        {
          label: "遺族基礎年金",
          amount: r.income.pensionBasic,
          basis: "日本年金機構（令和8年度は報道値）",
        },
        { label: "遺族厚生年金", amount: r.income.pensionKosei, basis: "厚生年金保険法" },
        { label: "中高齢寡婦加算", amount: r.income.chukoreiKafu, basis: "厚生年金保険法" },
        {
          label: `${survivorLabel}の就労収入`,
          short: "就労収入",
          amount: r.income.survivorWork,
          // 回答から来たのか当社基準の見立てなのかを名乗る（UX #4）
          basis: `${work.fromLabel}：${work.from}`,
        },
        { label: "金融資産", amount: r.income.assets, basis: "回答：世帯の金融資産" },
      ].filter((x) => x.amount > 0)}
      incomeTotal={r.income.total}
      margin={r.margin}
      needRangeText={formatRange(r.range.low, r.range.high)}
      points={decisionPoints(r, pj, { loan, danshinCovered }).filter(
        (p) => !TIMELINE_POINT.test(p.label),
      )}
      rawNeed={r.rawNeed}
      resultLabel={`民間保険で備える額${RESULT_QUALIFIER[rangeKey] ?? ""}`}
      resultNote={`${RESULT_NOTE[rangeKey] ?? RESULT_NOTE.sufficient}${bandNote ?? ""}`}
    />
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
  /**
   * 遺族が65歳まで働く場合の同じ1組（ADR-030）。既定の60歳は当社の前提なので、比較を最初の画面に並べる。
   * 回答の幅（bands）にも同じ年齢を入れる。代表値だけで回すと、比べる2つのレンジの作り方が違ってしまう
   */
  const until65 = v(params, "pensionAge");
  const figuresUntil65 = resultFigures(
    params,
    workingUntil(input, until65),
    ri.bands.map((b) => workingUntil(b, until65)),
    asOfDate,
  );
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
   * リスク別の診断表の6行（仕様 §5.3）。
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
    const covText = hold === null ? "未入力" : approx(hold);
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
      subtitle:
        input.spouse || input.children.length > 0 ? "遺されたご家族の生活" : "葬儀・身の回りの整理",
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
    link: { href: `/lab?${q.toString()}`, label: "もしもラボで見る" },
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
        holdText: approx(hold),
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
      link: { href: `/lab?${q.toString()}`, label: "もしもラボで見る" },
    };
  };

  const riskRows: RiskRow[] = [
    deathRow("本人", result.self, input.coverageSelf, bandSelf),
    ...(result.spouse ? [deathRow("配偶者", result.spouse, input.coverageSpouse, bandSpouse)] : []),
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

  /** 計算未対応で空欄の行の数（「◯つのリスク／うち未算定◯つ」） */
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
  const watch = (() => {
    const rows = selfProjection.rows;
    for (let i = 1; i < rows.length; i++) {
      const prev = rows[i - 1];
      const now = rows[i];
      const pen = (r: typeof now) =>
        r.income.pensionBasic + r.income.pensionKosei + r.income.chukoreiKafu;
      // 理由は同じ行の `events`（エンジンが金額の変化から書いた語）をそのまま使う。画面で理由を作らない
      if (Math.abs(pen(now) - pen(prev)) >= 1000 * 12)
        return { year: now.year, events: now.events };
    }
    return null;
  })();
  const watchYear = watch?.year ?? null;

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

  /**
   * いつ見直すかの帯。**もしもラボと同じ値**（`labDeath` の「回答どおり」）を、いまの年齢から64歳まで並べる。
   * 画面で年ごとの必要額を作らない。単身世帯（遺す相手がいない）は見直しの節を持たない
   */
  const hasDeathDetail = result.self.years.total > 0;
  const bandPoints = hasDeathDetail
    ? Array.from({ length: Math.max(0, 65 - input.self.age) }, (_, i) =>
        labDeath(params, input, ri.bands, input.self.age + i, "answer", asOfDate),
      ).map((p) => ({ year: p.year, low: p.low, high: p.high }))
    : [];

  /**
   * レポートの節（2026-10-18・オーナー承認の見本）。読む順に番号を振る。
   * 単身世帯は金額の根拠と見直しの節を持たないので、番号は詰める
   */
  const SECTIONS = {
    conclusion: { id: "conclusion", title: "今回の結論", tocSub: "足りているか、次に何をするか" },
    basis: { id: "basis", title: "金額の根拠", tocSub: "出ていくお金と入ってくるお金の差" },
    review: { id: "review", title: "いつ見直すか", tocSub: "必要額が変わる年" },
    risks: { id: "risks", title: "他のリスク", tocSub: "病気・けが・失業もまとめて" },
    check: { id: "check", title: "前提の確認と次へ", tocSub: "答えと前提が合っているか" },
  } satisfies Record<string, ReportSectionMeta>;
  const order: ReportSectionMeta[] = hasDeathDetail
    ? [SECTIONS.conclusion, SECTIONS.basis, SECTIONS.review, SECTIONS.risks, SECTIONS.check]
    : [SECTIONS.conclusion, SECTIONS.risks, SECTIONS.check];
  const numOf = (m: ReportSectionMeta) => order.indexOf(m) + 1;
  const labHref = `/lab?${q.toString()}`;

  return (
    <main className={s.page}>
      {/* 目次の列を足すので、読み物幅（720px）ではなく全幅（1,120px）を使う */}
      <div className={`${r.layout} ${s.wide}`}>
        <ReportToc items={order} lead={`${caption}／${jstDate(asOfDate)}時点`} />
        <div className={r.body}>
          {/*
            1. 今回の結論（2026-10-17 の最初の2画面をそのまま入れる）。
            結論（判定バッジ＋1文＋人ごとの行＋数直線1本）・次の一歩（1つ）・この結論を決めている前提（1点）
          */}
          <ReportSection
            meta={SECTIONS.conclusion}
            num={numOf(SECTIONS.conclusion)}
            // 見出しの下の1行は置かない。結論のカードの1行目が同じことを言い、最初の2画面を押し出すため
          >
            <Conclusion
              caption={caption}
              fmt={(yen) => formatRange(yen, yen)}
              headline={conclusionHeadline(figures)}
              householdBadge={HERO_BADGE[hh.verdict]}
              householdTone={HERO_TONE[hh.verdict]}
              householdIcon={HERO_ICON[hh.verdict]}
              modeText={LIVING_LEVEL_LABEL[livingLevel].name}
              nextStep={nextStepSentence(
                figures,
                { self: input.self.employment, spouse: input.spouse?.employment ?? null },
                estimatedCount,
              )}
              noReducible={noReducibleSentence(figures)}
              partialNote={partialNote(figures)}
              premise={premise}
              workEnd={workEndCompare(
                figures,
                figuresUntil65,
                v(params, "survivorWorkEndAge"),
                until65,
              )}
              premiseFmt={(yen) => formatManApprox(yen, roundUnit)}
              reason={conclusionReason(figures)}
              reviewYear={watchYear}
              reviewReason={watch ? reviewReasonSentence(watch.events) : null}
              bookmarkHint={!SAVE_ENABLED}
              rows={rows}
            />
          </ReportSection>

          {/* 2. 金額の根拠。本人 → 配偶者を切り替えで見せる（中身はどちらもサーバで描いてある） */}
          {hasDeathDetail && (
            <ReportSection
              knows="遺されたご家族に出ていくお金から、入ってくるお金を引いた残りが「保険で備える額」です。"
              meta={SECTIONS.basis}
              num={numOf(SECTIONS.basis)}
              sub="なぜこの金額になるのか。"
            >
              <CaseTabs
                label="だれに万一のときか"
                tabs={[
                  {
                    id: "self",
                    label: "あなたに万一のとき",
                    panel: (
                      <CaseBasis
                        bandNote={bandWidenedNote(figures.self)}
                        childCount={input.children.length}
                        danshinCovered={danshinCovered}
                        loan={input.housing.loan ?? null}
                        pj={selfProjection}
                        r={result.self}
                        roundUnit={roundUnit}
                        survivorLabel="配偶者"
                      />
                    ),
                  },
                  ...(result.spouse && spouseProjection
                    ? [
                        {
                          id: "spouse",
                          label: "配偶者に万一のとき",
                          panel: (
                            <CaseBasis
                              bandNote={figures.spouse ? bandWidenedNote(figures.spouse) : null}
                              childCount={input.children.length}
                              danshinCovered={danshinCovered}
                              loan={input.housing.loan ?? null}
                              pj={spouseProjection}
                              r={result.spouse}
                              roundUnit={roundUnit}
                              survivorLabel="あなた"
                            />
                          ),
                        },
                      ]
                    : []),
                ]}
              />
            </ReportSection>
          )}

          {/* 3. いつ見直すか。帯はもしもラボと同じ値、年表は次の一歩の見直しの年と同じ材料 */}
          {hasDeathDetail && (
            <ReportSection
              knows="いまと10年後で必要額がどれだけ違うか、どの年に見直すとよいか。"
              meta={SECTIONS.review}
              num={numOf(SECTIONS.review)}
              sub="必要額は、お子さんの成長や公的年金の変わり目とともに動きます。"
            >
              <NeedBand
                coverage={input.coverageSelf}
                pj={selfProjection}
                points={bandPoints}
                reviewYear={watchYear}
                survivorLabel="配偶者"
              />
              {/*
                毎月の家計表と収入の階段グラフは畳む（2026-10-18 オーナー決定・AUDIT 2-2）。
                帯と年表と同じことを月の単位で説明しており、開けば同じ情報がすべてある
              */}
              <Fold count="（表1つ・図1つ）" label="あなたに万一のとき：毎月の家計と公的年金">
                <Step2
                  danshinCovered={danshinCovered}
                  from={{
                    pension: input.children.length > 0 ? `子${input.children.length}人` : null,
                    kosei: input.self.employment === "employee" ? "会社員" : null,
                    work: input.spouse && input.spouse.income > 0 ? "配偶者の年収" : null,
                    housing: danshinCovered ? "団信あり" : null,
                    living: "毎月の生活費",
                    education: "お子さんの進路",
                  }}
                  livingBand={livingBand}
                  pj={selfProjection}
                  reform2028Reason={result.reform2028.reason}
                  survivorLabel="配偶者"
                />
              </Fold>
              {result.spouse && spouseProjection && (
                <Fold count="（表1つ・図1つ）" label="配偶者に万一のとき：毎月の家計と公的年金">
                  <Step2
                    danshinCovered={danshinCovered}
                    from={{
                      pension: input.children.length > 0 ? `子${input.children.length}人` : null,
                      kosei: input.spouse?.employment === "employee" ? "配偶者は会社員" : null,
                      work: input.self.income > 0 ? "あなたの年収" : null,
                      housing: danshinCovered ? "団信あり" : null,
                      living: "毎月の生活費",
                      education: "お子さんの進路",
                    }}
                    livingBand={livingBand}
                    pj={spouseProjection}
                    /* **配偶者が亡くなるケースでは遺族は本人。** 別人の年齢で判定した注記を出さない */
                    reform2028Reason={
                      reform2028({
                        survivorAge: input.self.age,
                        asOfYear,
                        hasChildren: input.children.length > 0,
                      }).reason
                    }
                    survivorLabel="あなた"
                  />
                </Fold>
              )}
            </ReportSection>
          )}

          {/* 4. 他のリスク：リスク別の診断表（仕様 §5.3）＋よみとき */}
          <ReportSection
            knows="どのリスクが手厚く、どこが手薄か。計算していないものも、していないと書いています。"
            meta={SECTIONS.risks}
            num={numOf(SECTIONS.risks)}
          >
            <RiskTable
              caption={caption}
              countUnit={unsupportedCount > 0 ? "つのリスク" : "つのリスクを診断"}
              unsupportedCount={unsupportedCount}
              lead={soloLead}
              rows={riskRows}
              showHeading={false}
              // 貯蓄で受ける行（制度式で概算）があるときだけ、その共通の受け皿の額を注記に立てる
              sharedSavingsText={
                riskRows.some((x) => x.precisionTone === "statutory") ? approx(input.assets) : null
              }
            />

            {/*
              この結果のよみとき（T-07）。数値は AI に書かせず算定結果を差し込む。
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
          </ReportSection>

          {/* 5. 前提の確認と次へ：答えたこと・暮らし方の前提・参考と出典・次の行動 */}
          <ReportSection
            knows="答えと前提が合っていれば、この結果をそのまま使えます。違っていれば、答え直すか、もしもラボで前提を変えて試せます。"
            meta={SECTIONS.check}
            num={numOf(SECTIONS.check)}
            sub="答えと前提が合っているか。"
          >
            <Step1
              chips={answerChips(input, input.coverageSelf, input.coverageSpouse)}
              editHref={editHref}
              // 当社基準で補った前提（答えた年収0円の就労収入）も「推定で補った項目」に入れる（UX #4）
              estimations={[...estimations, ...ownStandardEstimates(result.self, "配偶者")]}
              terms={terms}
            />

            {/* 暮らし方の前提（照合表 #4）。結論には選んでいる前提の名前だけを出す */}
            <LivingDial
              absorbedNote={absorbedNote}
              current={livingLevel}
              hrefFor={(lv) => `/result?${withLivingLevel(q, lv)}`}
            />

            {/*
              末尾の折りたたみ（すべて件数つき・§5-8〜12）。参照材をここにまとめる。
              露出は見出しの1行だけで、中身は開けばすべてある（開示の規約）。
            */}
            <div className={`${s.section} ${s.tail}`}>
              <h3 className={s.tailHead}>参考と前提</h3>
              {/* 使った根拠の数を、あるべき声量で出す（視覚の DoD (a)）。数は下の折りたたみの件数と同じ */}
              <div className={s.tailStats}>
                <p className={s.tailStat}>
                  <span className={s.tailStatLabel}>公的な出典</span>
                  <span className={s.tailStatValue}>{usedSources.length}件</span>
                </p>
                <p className={s.tailStat}>
                  <span className={s.tailStatLabel}>当社基準</span>
                  <span className={s.tailStatValue}>
                    {Object.keys(params.ownStandard).length}件
                  </span>
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

              {/* 2028年の年金改正。対象外の世帯では1行（UX_REVIEW 1回目・§5-9） */}
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
                <h3 className={s.h3}>このあと、状況が変わったら</h3>
                <p className={s.watchLead}>
                  お子さんの進学など、必要な保障が変わる時期にだけ一言お知らせします。
                  保存するのは今日の入力（範囲）と結果の要点だけで、
                  <strong>お知らせに金額は書きません</strong>。いつでも削除できます。
                </p>
                <Link className={s.watchButton} href={`/save?${q.toString()}`}>
                  この結果を保存してお知らせを受け取る
                </Link>
                <p className={s.basis}>
                  ※ 保存しなくても、この結果はURLをブックマークすれば見返せます。
                </p>
              </div>
            )}

            {/* 次へ：前提を変えて試す（体験の④）／答え直す */}
            <div className={r.cta}>
              <Link className={r.ctaPrimary} href={labHref}>
                もしもラボで前提を変えて試す
              </Link>
              <Link className={r.ctaSecondary} href={editHref}>
                入力をやり直す
              </Link>
            </div>

            {/*
              フッター（1回だけ）：概算・要精査／算定基準日／パラメータ版。
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
            </div>
          </ReportSection>
        </div>
      </div>
    </main>
  );
}
