/**
 * 入力の不確かさをエンジンに通す（T-H・2026-09-23）。
 *
 * **未回答を1つの数字で決めつけない。** 回答帯（区分の上下端）を
 * 「必要額を減らす端（**緩め端**）」と「増やす端（**厳しめ端**）」に振り分け、
 * それぞれの前提一式で `normalize` を回して**2つの入力**を作る。
 * エンジンは点計算のままで、幅は入力側から来る。
 *
 * **方向表は2回で済ませるための最適化であって、正しさの根拠ではない**（2026-09-23 オーナー裁定）。
 * 方向が単調と言い切れない入力（下の「連動」）は、その入力だけ**両方向に動かして包絡**を取る。
 * 2026-10-17（QA）からは、**入力ごとに端を独立に選んだ組み合わせ（帯の角）をすべて**包絡に入れる。
 * 本人と配偶者の年収を1つの向きに束ねると、「本人は上端・配偶者は下端」のような最悪の組を取りこぼすため
 * （詳しくは `normalizeEnds`）。
 *
 * ## 方向表
 *
 * | 入力 | 緩め端（必要額を減らす） | 厳しめ端（増やす） | 連動 | 出どころ |
 * |---|---|---|---|---|
 * | 本人の年収 | 帯の上端 | 帯の下端（いちばん下の区分は**床**＝`ownStandard.incomeBandFloor`） | **生活費が「年収から推定」のとき連動** | `inputRanges.incomeBand` |
 * | 配偶者の年収 | 帯の上端 | 帯の下端 | 同上 | 同上 |
 * | 生活費（区分で回答） | 帯の下端 | 帯の上端 | ─ | `inputRanges.monthlyLivingBand`（D-01） |
 * | 生活費（年収から推定） | 年収の端から算出 | 年収の端から算出 | **連動する** | §4.2.1 の式 |
 * | 金融資産 | 帯の上端 | 帯の下端 | ─ | `inputRanges.assetsBand` |
 * | 住宅ローン残高 | 帯の下端 | 帯の上端 | 団信ありなら効かない | `inputRanges.loanBand` |
 * | 進路「まだ決めていない」 | **点のまま** | **点のまま** | ─ | **未決**（下記） |
 * | 現在の保障「分からない」 | ─ | ─ | ─ | 必要額に効かない（過不足が `pending` になるだけ） |
 *
 * **未回答（「答えたくない」「分からない」）には区分が無いので、ここでは幅を作らない。**
 * 幅を置くと**新しい当社基準が1つ増える**（T-H の未決）。決まるまで点のまま扱い、
 * 「幅で計算した」と言わない。約束を実装より先に広げないため。
 */
import type { DiagnoseInput } from "../calc/index.js";
import type { AnswerBand, ParamSet } from "../params/index.js";
import { calcDeath, diagnose, outOfScope, toHousehold } from "../calc/index.js";
import {
  ASSETS_LABEL,
  INCOME_LABEL,
  labelOf,
  LIVING_LABEL,
  LOAN_LABEL,
  SPOUSE_INCOME_LABEL,
} from "./labels.js";
import { normalize } from "./normalize.js";
import type { NormalizedInput, WizardSelections } from "./types.js";

/** 必要額を減らす側が `loose`、増やす側が `strict` */
export type End = "loose" | "strict";

export interface UncertainField {
  field: string;
  label: string;
  /** その端で使った値（円） */
  loose: number;
  strict: number;
}

export interface Ends {
  /** 回答どおりの点（いまの画面が使っている入力） */
  point: NormalizedInput;
  /** 必要額を減らす端の入力 */
  loose: DiagnoseInput;
  /** 必要額を増やす端の入力 */
  strict: DiagnoseInput;
  /**
   * **方向が単調と言い切れない組み合わせ**の入力（2026-09-23 裁定）。
   * 年収は「上げると遺族年金が増えて必要額が減る」が、
   * **生活費を年収から推定している世帯では支出も同時に上がる**。
   * どちらが勝つかは世帯による（GT-02 では年金が勝つ）。区分で答えた世帯でも、
   * 必要額の枝が変わると端の向きに単調でなくなる。だから**入力ごとに端を独立に選んだ組み合わせ（帯の角）**を
   * すべて候補に混ぜて包絡を取る（2026-10-17）。緩め端・厳しめ端と重なる組は入れない
   */
  extra: DiagnoseInput[];
  /** 幅を持てた入力（画面の開示に使う）。**未回答はここに入らない** */
  fields: UncertainField[];
  /** 幅を作れなかった不確かさ（未回答）。**「幅で計算した」と言わないために残す** */
  pointOnly: string[];
}

/**
 * 帯の端。
 *
 * **上が開いている区分（`gte*`）には上端が無い**ので、その側は点に落とす（無い数字を作らない）。
 * **下が開いている区分（いちばん下の区分）には床を置く**（2026-09-23 オーナー裁定）。
 * 端を消すと厳しめ側の不確かさが見えなくなり、**分からない人ほど幅が狭く安心に見える**ため。
 * 床の値は当社基準の在庫 `ownStandard.incomeBandFloor`（数字を2か所に持たない）。
 */
function bandEnd(
  band: AnswerBand | undefined,
  end: End,
  fallback: number,
  floor?: number,
): number {
  if (!band) return fallback;
  if (end === "loose") return band.high ?? fallback;
  return band.low ?? floor ?? fallback;
}

/** 生活費の端（区分で答えた場合）。緩め＝下端・厳しめ＝上端 */
function livingEnd(band: AnswerBand | undefined, end: End, fallback: number): number {
  if (!band) return fallback;
  if (end === "loose") return band.low ?? fallback;
  return band.high ?? fallback;
}

/** 生活費を「年収から推定」したときの月額（§4.2.1 の式。`normalize` と同じ式を端の年収に当てる） */
function estimatedLiving(p: ParamSet, householdIncome: number): number {
  const net = householdIncome * p.ownStandard.netIncomeRatio.value;
  return Math.round((net * p.ownStandard.livingCostEstimateRatio.value) / 12);
}

/**
 * 片方の端の入力を作る。
 *
 * **`normalize` を書き換えない。** 区分コードから点を作る道は1つのままにして、
 * ここは「その点を帯の端に差し替える」層として重ねる（写しを2本にしない）。
 */
/**
 * 入力ごとの端の指定。指定しない入力は `atEnd` の `end` にそろえる。
 * **方向表の「連動」は入力ごとに独立**なので、組み合わせは入力単位で選べるようにしておく
 * （検査で全組み合わせを総当たりし、包絡が取りこぼしていないことを確かめるためにも使う）
 */
export type FieldEnds = Partial<
  Record<"selfIncome" | "spouseIncome" | "living" | "assets" | "loan", End>
>;

/** 幅を持ちうる入力（軸）。`FieldEnds` のキーと同じ */
type AxisKey = keyof FieldEnds;
const AXES: AxisKey[] = ["selfIncome", "spouseIncome", "living", "assets", "loan"];
type AxisValues = Record<AxisKey, number>;

/** 代表値の入力から、各軸の値を読む */
function pointValues(base: DiagnoseInput): AxisValues {
  return {
    selfIncome: base.self.income,
    spouseIncome: base.spouse?.income ?? 0,
    living: base.monthlyLiving,
    assets: base.assets,
    loan: base.housing.type === "own" ? (base.housing.loan ?? 0) : 0,
  };
}

/** 各軸を端（入力ごとに `per`、指定が無ければ `end`）に置いた値 */
function endValues(
  p: ParamSet,
  sel: WizardSelections,
  base: DiagnoseInput,
  end: End,
  per: FieldEnds,
): AxisValues {
  const floor = p.ownStandard.incomeBandFloor.value;
  const pv = pointValues(base);
  const spouseCode = sel.spouseIncome;
  return {
    selfIncome: bandEnd(
      p.inputRanges.incomeBand[sel.selfIncome],
      per.selfIncome ?? end,
      pv.selfIncome,
      floor,
    ),
    spouseIncome:
      base.spouse && spouseCode
        ? bandEnd(
            p.inputRanges.incomeBand[spouseCode],
            per.spouseIncome ?? end,
            pv.spouseIncome,
            floor,
          )
        : pv.spouseIncome,
    // 年収から推定する世帯では生活費は軸にならない（`build` が年収から組み直す）
    living:
      sel.livingCost === "estimate"
        ? pv.living
        : livingEnd(p.inputRanges.monthlyLivingBand[sel.livingCost], per.living ?? end, pv.living),
    assets: bandEnd(p.inputRanges.assetsBand[sel.assets], per.assets ?? end, pv.assets),
    loan:
      base.housing.type === "own" && sel.loan && base.housing.loan
        ? livingEnd(p.inputRanges.loanBand[sel.loan], per.loan ?? end, pv.loan)
        : pv.loan,
  };
}

/**
 * 軸の値から入力を組む。**端の入力も、区分の内側の入力も、ここ1か所で組む**（写しを2本にしない）。
 * 生活費を「年収から推定」した世帯では、**年収の値に連動させて**生活費を組み直す。
 */
function build(
  p: ParamSet,
  sel: WizardSelections,
  base: DiagnoseInput,
  vals: AxisValues,
): DiagnoseInput {
  const spouseIncome = base.spouse ? vals.spouseIncome : 0;
  const monthlyLiving =
    sel.livingCost === "estimate" ? estimatedLiving(p, vals.selfIncome + spouseIncome) : vals.living;
  let housing = base.housing;
  if (housing.type === "own" && sel.loan && housing.loan) housing = { ...housing, loan: vals.loan };
  return {
    ...base,
    self: { ...base.self, income: vals.selfIncome },
    spouse: base.spouse ? { ...base.spouse, income: vals.spouseIncome } : null,
    monthlyLiving,
    assets: vals.assets,
    housing,
  };
}

function atEnd(
  p: ParamSet,
  sel: WizardSelections,
  asOf: Date,
  end: End,
  per: FieldEnds = {},
): { input: DiagnoseInput; fields: UncertainField[] } {
  const base = normalize(p, sel, asOf);
  const fields: UncertainField[] = [];
  const floor = p.ownStandard.incomeBandFloor.value;
  const input = build(p, sel, base.input, endValues(p, sel, base.input, end, per));

  if (p.inputRanges.incomeBand[sel.selfIncome]) {
    fields.push({
      field: "selfIncome",
      label: "ご本人の年収",
      loose: bandEnd(p.inputRanges.incomeBand[sel.selfIncome], "loose", base.input.self.income),
      strict: bandEnd(
        p.inputRanges.incomeBand[sel.selfIncome],
        "strict",
        base.input.self.income,
        floor,
      ),
    });
  }
  if (p.inputRanges.monthlyLivingBand[sel.livingCost]) {
    fields.push({
      field: "monthlyLiving",
      label: "毎月の生活費",
      loose: livingEnd(
        p.inputRanges.monthlyLivingBand[sel.livingCost],
        "loose",
        base.input.monthlyLiving,
      ),
      strict: livingEnd(
        p.inputRanges.monthlyLivingBand[sel.livingCost],
        "strict",
        base.input.monthlyLiving,
      ),
    });
  }
  if (p.inputRanges.assetsBand[sel.assets]) {
    fields.push({
      field: "assets",
      label: "金融資産",
      loose: bandEnd(p.inputRanges.assetsBand[sel.assets], "loose", base.input.assets),
      strict: bandEnd(p.inputRanges.assetsBand[sel.assets], "strict", base.input.assets),
    });
  }

  return { input, fields };
}

/**
 * 入力ごとに端を選んだ1組の入力（検査用）。**画面の経路は `normalizeEnds` だけを通る。**
 * 包絡が全組み合わせの最悪・最良を取りこぼしていないかを、総当たりで確かめるために外へ出す。
 */
export function inputAtEnds(
  p: ParamSet,
  sel: WizardSelections,
  asOf: Date,
  ends: Required<FieldEnds>,
): DiagnoseInput {
  return atEnd(p, sel, asOf, "loose", ends).input;
}

/** 未回答（区分が無いので幅を作れないもの）を拾う。**黙って点にしない** */
function pointOnlyFields(sel: WizardSelections): string[] {
  const out: string[] = [];
  if (sel.selfIncome === "prefer_not") out.push("ご本人の年収（答えたくない）");
  if (sel.spouseIncome === "prefer_not") out.push("配偶者の年収（答えたくない）");
  if (sel.assets === "unknown") out.push("金融資産（分からない）");
  if (sel.loan === "unknown") out.push("住宅ローン残高（分からない）");
  if (sel.educationPlan === "undecided" || sel.educationPlan === undefined) {
    out.push("お子さんの進路（まだ決めていない）");
  }
  return out;
}

/**
 * 緩め端・厳しめ端の入力を作る（＋単調でない組み合わせの追加候補）。
 *
 * 返す `point` は**いまの画面が使っている入力そのもの**なので、
 * 幅を使わない画面はこれまでどおり動く（既存の経路を壊さない）。
 */
export function normalizeEnds(p: ParamSet, sel: WizardSelections, asOf: Date): Ends {
  const point = normalize(p, sel, asOf);
  const loose = atEnd(p, sel, asOf, "loose");
  const strict = atEnd(p, sel, asOf, "strict");

  /**
   * **入力ごとに端を独立に選んだ組み合わせ（帯の角）を、すべて候補に混ぜる**（2026-10-17・QA で blocking）。
   *
   * それまでは「緩め端・厳しめ端」の2組に、年収と生活費が連動する世帯だけ「2人の年収をそろって逆向きにした」
   * 2組を足していた。どちらも**入力を1つの向きに束ねて**動かしており、次を取りこぼしていた。
   * - **本人の年収は上端・配偶者の年収は下端**（生活費を年収から推定する世帯）。本人の年収が高いと推定生活費が上がり、
   *   配偶者の年収が低いと遺された側の就労収入が下がる ── 両方が必要額を押し上げる。実例
   *   （liv=estimate・inc=lt600・sinc=lt400・as=lt100）では包絡 500〜1,000万円のまま「減らせる」と出ていたが、
   *   この組み合わせだけで 1,700〜2,500万円になる
   * - **区分で答えた世帯でも、必要額は端の向きに単調ではない**。収入・資産が支出を上回る側
   *   （`sufficient`：葬儀・予備費＋生活費1〜2年分）に入ると、生活費が高いほど額が上がるので、
   *   「年収は上端（緩め）・生活費は上端（厳しめ）」の角がいちばん高くなる世帯がある（3,024世帯の総当たりで最大400万円の取りこぼし）
   *
   * 方向表は**入力ごとの向き**であって、組み合わせの最悪を保証しない（2026-09-23 裁定「方向表は最適化であって正しさの根拠ではない」）。
   * 入力は最大5つ（本人の年収・配偶者の年収・生活費・資産・ローン）なので角は32組まで。帯の無い入力では
   * 角が重なるので、同じ入力は1回だけ回す。
   */
  const both: End[] = ["loose", "strict"];
  const seen = new Set([JSON.stringify(loose.input), JSON.stringify(strict.input)]);
  const extra: DiagnoseInput[] = [];
  for (const selfIncome of both)
    for (const spouseIncome of both)
      for (const living of both)
        for (const assets of both)
          for (const loan of both) {
            const input = atEnd(p, sel, asOf, "loose", {
              selfIncome,
              spouseIncome,
              living,
              assets,
              loan,
            }).input;
            const key = JSON.stringify(input);
            if (seen.has(key)) continue;
            seen.add(key);
            extra.push(input);
          }

  return {
    point,
    loose: loose.input,
    strict: strict.input,
    extra,
    fields: loose.fields,
    pointOnly: pointOnlyFields(sel),
  };
}

/**
 * 包絡に渡す入力をそろえる（帯の角・代表値・**区分の内側の極値**）。暮らし方の目盛りも全候補に同じものを付ける。
 *
 * 2026-10-16（QA で blocking）、結果画面が目盛りを付け忘れており、目盛りを動かすと
 * 内訳と年次表は動くのに、**死亡保障カードの必要額と判定だけ目盛り1のまま**だった。
 * 画面で組まずにここで組んで、テストで固定する。
 *
 * 2026-10-17（11回目の QA で blocking）からは、**帯の角だけでは足りない**ので区分の内側も探す（`bandSearch`）。
 */
export function bandInputs(
  p: ParamSet,
  sel: WizardSelections,
  asOf: Date,
  lifestyleDial: number,
): DiagnoseInput[] {
  return bandSearch(p, sel, asOf, lifestyleDial).inputs;
}

export interface BandSearch {
  /** 包絡に渡す入力（目盛りを付けたもの）。帯の角＋代表値＋内側で見つけた極値・枝ごとの代表 */
  inputs: DiagnoseInput[];
  /** 探索で `calcDeath` を回した回数（死亡ケースごとに1回と数える） */
  evaluated: number;
  /** 区切り点（端・折れ点）の格子の点数 */
  gridPoints: number;
}

/** 折れ点を探すときに、まっすぐとみなす誤差（円）。生活費の推定の1円丸めが年数分積もっても届かない幅 */
const LINEAR_TOLERANCE = 1_000;

/**
 * **区分の内側で必要額がいちばん高く・低くなる点を探す**（2026-10-17・11回目の QA で blocking）。
 *
 * 必要額は区分の中で単調ではない。`calcDeath` は差額（収入・資産 − 支出）で3つの枝に分かれ、
 * 枝ごとに必要額の式が違う。
 * - 上乗せが要る（`shortage`）：不足額に比例する
 * - 当座資金（`sufficient`）：**生活費だけ**で決まる（葬儀・予備費＋生活費の数か月分）
 * - 余裕（`ample`）：葬儀・予備費だけ
 *
 * 不足から外れた直後の当座資金は、不足の側の下限より高いことがある。だから**いちばん高い当座資金は
 * 区分の角ではなく、枝の境目の手前**に出る。9回目の直しは帯の角（32組まで）だけを候補にしていたため、
 * 実例（50代共働き・子なし・生活費は年収から推定・inc=lt800・sinc=lt400）では代表値の 600〜1,000万円が
 * 最終の必要額 200〜800万円の**外**にはみ出し、保障1,000万円を「減らせる」と判定していた。
 *
 * **どう探すか（総当たりの格子ではなく、極値が出うる場所だけを回す）。**
 * 各枝の中では、差額も生活費も入力の1次式（折れ点を除く）なので、枝の中での極値は
 * 「区切り点の格子の点」か「格子の辺と枝の境目が交わる点」に出る（線形計画の頂点と同じ理屈）。
 * 不足の境目（差額＝−しきい値）と余裕の境目（差額＝支出×率 > 0）は交わらないので、2つの境目が重なる点は考えなくてよい。
 * 1. **区切り点**：各軸の端に加え、差額の**折れ点**（遺族の就労収入が「末子独立後の最低額」に切り替わる年収など）を
 *    数値で探して入れる。式を写さないのは、エンジンの式が変わったときに黙って古くならないため
 * 2. **格子**：区切り点の全組み合わせを回す
 * 3. **境目**：格子の辺の両端で必要額の判定（ニーズ軸）が違えば、1円単位まで二分して境目の両側を回す
 *
 * 包絡（`envelope`）には全部を渡さず、死亡ケースごとの**最小・最大の点と、枝ごとの代表1点**だけを渡す
 * （包絡は `diagnose` を回し直すので、候補の数がそのまま画面の重さになる）。帯の角はこれまでどおり全部渡す。
 */
export function bandSearch(
  p: ParamSet,
  sel: WizardSelections,
  asOf: Date,
  lifestyleDial: number,
): BandSearch {
  const ends = normalizeEnds(p, sel, asOf);
  const withDial = (input: DiagnoseInput): DiagnoseInput => ({ ...input, lifestyleDial });
  const corners = [ends.loose, ends.strict, ...ends.extra].map(withDial);
  const base = ends.point.input;
  const point = withDial(base);
  // 算定できない世帯（`diagnose` が止める）では内側を探さない。止める場所は `diagnose` の1か所のまま
  if (outOfScope(p, base)) return { inputs: corners, evaluated: 0, gridPoints: 0 };

  const whos: Array<"self" | "spouse"> =
    base.spouse && base.coverageSpouse !== undefined ? ["self", "spouse"] : ["self"];
  let evaluated = 0;
  const pv = pointValues(base);
  const looseV = endValues(p, sel, base, "loose", {});
  const strictV = endValues(p, sel, base, "strict", {});
  const run = (vals: AxisValues) => {
    const input = withDial(build(p, sel, base, vals));
    evaluated += whos.length;
    return { input, r: whos.map((w) => calcDeath(p, toHousehold(input, w))) };
  };

  // ---- 探した点のうち、死亡ケースごとの最小・最大と、枝ごとの代表1点を残す ----
  type Pick = { low?: [number, DiagnoseInput]; high?: [number, DiagnoseInput] };
  const picks: Pick[] = whos.map(() => ({}));
  const byVerdict = whos.map(() => new Map<string, DiagnoseInput>());
  const consider = (x: ReturnType<typeof run>) => {
    x.r.forEach((r, i) => {
      const pk = picks[i];
      if (!pk.low || r.range.low < pk.low[0]) pk.low = [r.range.low, x.input];
      if (!pk.high || r.range.high > pk.high[0]) pk.high = [r.range.high, x.input];
      if (!byVerdict[i].has(r.verdict)) byVerdict[i].set(r.verdict, x.input);
    });
    return x;
  };

  // ---- 1. 区切り点：端・折れ点 ----
  const axes: Array<{ key: AxisKey; values: number[] }> = [];
  for (const key of AXES) {
    const lo = Math.min(looseV[key], strictV[key]);
    const hi = Math.max(looseV[key], strictV[key]);
    if (lo === hi) continue;
    // 動かしても差額が変わらない軸（団信ありのローン残高など）は格子に入れない
    if (isInert(key, lo, hi)) continue;
    // 代表値は格子の線に入れない（枝の中では1次式なので、極値は端と折れ点で区切った箱の辺にしか出ない）。
    // 代表値そのものは候補に入れる（`point`）。線に入れると格子が軸ごとに1.5倍になり、重さだけが増える
    const values = new Set([lo, hi]);
    for (const k of kinksAlong(key, lo, hi)) values.add(k);
    axes.push({ key, values: [...values].sort((a, b) => a - b) });
  }

  /**
   * 差額の折れ点を数値で探す（ほかの軸は代表値に置く）。中点が両端を結ぶ直線から外れていれば折れ点があるので、
   * 半分に割って続け、それ以上割っても外れが誤差の内に収まる区間の中点を折れ点として返す
   */
  function kinksAlong(key: AxisKey, lo: number, hi: number): number[] {
    const margins = (x: number) => consider(run({ ...pv, [key]: x })).r.map((r) => r.margin);
    const out: number[] = [];
    const split = (a: number, ma: number[], b: number, mb: number[]): boolean => {
      if (b - a < 2) return false;
      const m = Math.floor((a + b) / 2);
      const mm = margins(m);
      const off = Math.max(
        ...mm.map((v, i) => Math.abs(v - (ma[i] + ((mb[i] - ma[i]) * (m - a)) / (b - a)))),
      );
      if (off <= LINEAR_TOLERANCE) return false;
      const left = split(a, ma, m, mm);
      const right = split(m, mm, b, mb);
      if (!left && !right) out.push(m);
      return true;
    };
    split(lo, margins(lo), hi, margins(hi));
    return out;
  }

  /** 軸の両端で、どの死亡ケースの差額も変わらなければ、その軸は必要額に効かない */
  function isInert(key: AxisKey, lo: number, hi: number): boolean {
    const a = consider(run({ ...pv, [key]: lo })).r;
    const b = consider(run({ ...pv, [key]: hi })).r;
    return a.every((r, i) => r.margin === b[i].margin && r.verdict === b[i].verdict);
  }

  // ---- 2. 格子：区切り点の全組み合わせ ----
  const grid = new Map<string, ReturnType<typeof run>>();
  const keyOf = (idx: number[]) => idx.join(",");
  const valsOf = (idx: number[]): AxisValues => {
    const vals = { ...pv };
    axes.forEach((ax, i) => {
      vals[ax.key] = ax.values[idx[i]];
    });
    return vals;
  };
  const walk = (i: number, idx: number[]) => {
    if (i === axes.length) {
      grid.set(keyOf(idx), consider(run(valsOf(idx))));
      return;
    }
    for (let j = 0; j < axes[i].values.length; j++) walk(i + 1, [...idx, j]);
  };
  walk(0, []);

  // ---- 3. 境目：格子の辺の両端で必要額の判定（ニーズ軸）が違えば、二分して境目の両側を回す ----
  for (const [k, at] of grid) {
    const idx = k === "" ? [] : k.split(",").map(Number);
    axes.forEach((ax, i) => {
      if (idx[i] + 1 >= ax.values.length) return;
      const next = [...idx];
      next[i] += 1;
      const to = grid.get(keyOf(next));
      if (!to) return;
      whos.forEach((_, w) => {
        if (at.r[w].verdict === to.r[w].verdict) return;
        const vals = valsOf(idx);
        const along = (x: number) => consider(run({ ...vals, [ax.key]: x }));
        const bisect = (a: number, va: string, b: number, vb: string) => {
          if (va === vb || b - a < 2) return;
          const m = Math.floor((a + b) / 2);
          const vm = along(m).r[w].verdict;
          bisect(a, va, m, vm);
          bisect(m, vm, b, vb);
        };
        bisect(ax.values[idx[i]], at.r[w].verdict, ax.values[next[i]], to.r[w].verdict);
      });
    });
  }

  const chosen = [
    ...corners,
    point,
    ...picks.flatMap((pk) => [pk.low?.[1], pk.high?.[1]]),
    ...byVerdict.flatMap((m) => [...m.values()]),
  ].filter((x): x is DiagnoseInput => x !== undefined);
  const seen = new Set<string>();
  const inputs = chosen.filter((x) => {
    const key = JSON.stringify(x);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return { inputs, evaluated, gridPoints: grid.size };
}

/**
 * **どの回答の幅が、判定の跨ぎを起こしているか**を特定する（2026-09-23・T-H）。
 *
 * 画面の一文「この幅は、答えの幅（◯◯）から来ています」の ◯◯ にあたる。
 * **推測で名前を出さない。** その入力**だけ**を厳しめ端に動かして回し直し、
 * 判定が実際に変わったものだけを返す（複数あれば効き目の大きい順に並べる）。
 */
export function crossingDrivers(
  p: ParamSet,
  sel: WizardSelections,
  asOf: Date,
  who: "self" | "spouse" = "self",
  lifestyleDial = 1,
): string[] {
  // 目盛りは本人が動かす値なので、ここでは点のまま全候補にそろえて付ける（bandInputsFor と同じ）
  const point = { ...normalize(p, sel, asOf).input, lifestyleDial };
  const strict = atEnd(p, sel, asOf, "strict").input;
  const verdictOf = (input: DiagnoseInput) => {
    const d = diagnose(p, input, asOf);
    const r = who === "self" ? d.self : d.spouse;
    return r ? { v: r.verdict, need: r.rawNeed } : null;
  };
  const base = verdictOf(point);
  if (!base) return [];

  /**
   * 年収を動かしたら、**年収から推定した生活費も一緒に動かす**（2026-10-17・QA の兄弟）。
   * 生活費を代表値のまま年収だけ動かすと、回答の幅の中に存在しない入力で判定を確かめてしまう。
   * また連動する世帯では年収の向きと必要額の向きが一致しないので、**両端を試す**。
   */
  const estimate = sel.livingCost === "estimate";
  const withIncome = (selfIncome: number, spouseIncome: number): DiagnoseInput => ({
    ...point,
    self: { ...point.self, income: selfIncome },
    spouse: point.spouse ? { ...point.spouse, income: spouseIncome } : null,
    monthlyLiving: estimate
      ? estimatedLiving(p, selfIncome + (point.spouse ? spouseIncome : 0))
      : point.monthlyLiving,
  });
  const loose = estimate ? atEnd(p, sel, asOf, "loose").input : null;
  const spouseNow = point.spouse?.income ?? 0;

  /** 入力1つだけを端に差し替えた入力を作る（連動する年収は両端） */
  const only: Array<{ label: string; input: DiagnoseInput }> = [
    {
      label: `ご本人の年収「${labelOf(INCOME_LABEL, sel.selfIncome) ?? ""}」`,
      input: withIncome(strict.self.income, spouseNow),
    },
    ...(loose
      ? [
          {
            label: `ご本人の年収「${labelOf(INCOME_LABEL, sel.selfIncome) ?? ""}」`,
            input: withIncome(loose.self.income, spouseNow),
          },
        ]
      : []),
    {
      label: `毎月の生活費「${labelOf(LIVING_LABEL, sel.livingCost) ?? ""}」`,
      input: { ...point, monthlyLiving: strict.monthlyLiving },
    },
    {
      label: `金融資産「${labelOf(ASSETS_LABEL, sel.assets) ?? ""}」`,
      input: { ...point, assets: strict.assets },
    },
    ...(point.spouse && strict.spouse
      ? [
          {
            label: `配偶者の年収「${labelOf(SPOUSE_INCOME_LABEL, sel.spouseIncome) ?? ""}」`,
            input: withIncome(point.self.income, strict.spouse.income),
          },
          ...(loose?.spouse
            ? [
                {
                  label: `配偶者の年収「${labelOf(SPOUSE_INCOME_LABEL, sel.spouseIncome) ?? ""}」`,
                  input: withIncome(point.self.income, loose.spouse.income),
                },
              ]
            : []),
        ]
      : []),
    ...(sel.loan && sel.housing === "own_loan"
      ? [
          {
            label: `住宅ローン残高「${labelOf(LOAN_LABEL, sel.loan) ?? ""}」`,
            input: { ...point, housing: strict.housing },
          },
        ]
      : []),
  ];

  const hits = only
    .map((x) => ({ label: x.label, r: verdictOf(x.input) }))
    .filter((x) => x.r !== null && x.r.v !== base.v)
    .sort((a, b) => (b.r?.need ?? 0) - (a.r?.need ?? 0))
    .map((x) => x.label);
  // 年収は両端を試すので、同じ名前が2回出うる（1回にまとめる）
  return [...new Set(hits)];
}
