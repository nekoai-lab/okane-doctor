/**
 * 結果画面に出す「最終の金額と判定」を1か所で作る（2026-10-17・UX／設計レビュー）。
 *
 * **なぜここに置くか。** 結果画面は同じ死亡ケースの必要額を、
 * ヒーロー（代表値レンジの世帯合計）・診断表（回答の幅を包絡したレンジ）・
 * STEP3/4（代表値レンジ）・逓減カーブ（丸め前の差額）の4通りで出していた。
 * 不足世帯では「約1億700万円」「約6,200万〜1億600万円」「約6,700万〜1億円」「約8,355万円」が並び、
 * 過不足の判定（過不足軸）も、診断表は「圏内・要精査」なのにヒーローは「減らせる可能性」になる世帯があった。
 * どれも各所では正しく計算していて、**どの数を最終とみなすかが画面ごとに違った**だけ。
 *
 * ここで決める約束：
 * - **最終の必要額＝回答の幅を包絡したレンジ**（T-H。幅を渡せない経路だけ代表値レンジ）
 * - **過不足の判定（過不足軸・`Verdict3`）は最終の必要額から出す**。ヒーロー・診断表・STEP4・よみとき・次の一歩は全部これを読む
 * - **内訳（滝の棒・家計台帳・逓減カーブ）は代表値1点のまま**。最終の必要額とは別の量なので、画面ではそう名乗らせる
 *
 * この層は金額を新しく作らない。`diagnose` と `envelope` の出力を選び、`verdict3` / `householdSummary` に通すだけ。
 */
import type { ParamSet } from "../params/index.js";
import { type EnvelopeResult, envelope } from "./envelope.js";
import { type DiagnoseInput, diagnose } from "./index.js";
import type { DeathResult, HouseholdDiagnosis, HouseholdHeadline } from "./types.js";
import { type HouseholdSummary, type Verdict3, householdSummary, verdict3 } from "./verdict3.js";

export type DeathCaseWho = "self" | "spouse";

export interface DeathFigures {
  who: DeathCaseWho;
  /** 代表値1点で回した算定結果。**内訳（支出・収入・年数）を見せるためだけに使う** */
  point: DeathResult;
  /** 最終の必要額（円）。回答の幅を包絡したレンジ。幅を渡せないときは代表値のレンジ */
  need: { low: number; high: number };
  /** いまの死亡保障（円）。分からなければ null */
  coverage: number | null;
  /** 過不足の判定（過不足軸）。`need` と `coverage` から出す */
  verdict: Verdict3;
  /**
   * いまの保障と最終の必要額の差（円・幅）。
   * `reducible` は `[coverage − need.high, coverage − need.low]`、`shortage` は `[need.low − coverage, need.high − coverage]`。
   * それ以外は `none`（圏内・保留では差額を言わない）
   */
  gap: { kind: "reducible" | "shortage" | "none"; low: number; high: number };
  /** 回答の幅の包絡（判定の跨ぎの文に使う）。幅を渡していなければ null */
  band: EnvelopeResult | null;
}

export interface ResultFigures {
  self: DeathFigures;
  spouse: DeathFigures | null;
  /** 世帯の判定（過不足軸）と差額。`self` / `spouse` の最終の必要額だけから作る */
  household: HouseholdSummary;
  /**
   * 代表値の算定結果に、**最終の必要額・過不足・世帯の結論を書き戻したもの**。
   * よみとき（AI・退避文）はこの形しか読めないので、ここで揃えてから渡す。
   * 支出・収入・年数（内訳）は代表値のまま。
   */
  diagnosis: HouseholdDiagnosis;
}

function gapOf(
  v: Verdict3,
  coverage: number | null,
  need: { low: number; high: number },
): DeathFigures["gap"] {
  if (coverage === null) return { kind: "none", low: 0, high: 0 };
  if (v === "reducible")
    return { kind: "reducible", low: coverage - need.high, high: coverage - need.low };
  if (v === "shortage")
    return { kind: "shortage", low: need.low - coverage, high: need.high - coverage };
  return { kind: "none", low: 0, high: 0 };
}

/** 個人の判定を、既存の `DeathResult.gap` の形に写す（よみときが読む形）。閾値は `verdict3` と同じ */
function toLegacyGap(f: DeathFigures): DeathResult["gap"] {
  switch (f.verdict) {
    case "pending":
      return { kind: "pending", amount: 0 };
    case "reducible":
      return { kind: "excess", amount: f.gap.low };
    case "shortage":
      return { kind: "shortage", amount: f.gap.low };
    default:
      return { kind: "adequate", amount: 0 };
  }
}

/** 世帯4値を、よみときが読む `HouseholdHeadline` に写す */
function toHeadline(h: HouseholdSummary): HouseholdHeadline {
  return {
    kind: h.verdict,
    totalExcess: h.totalReducible,
    totalShortage: h.totalShortage,
    totalExcessRange: { ...h.reducibleRange },
    totalShortageRange: { ...h.shortageRange },
  };
}

function figuresFor(
  p: ParamSet,
  who: DeathCaseWho,
  point: DeathResult,
  coverage: number | null,
  bands: DiagnoseInput[] | null,
  asOf: Date,
): DeathFigures {
  const band = bands && bands.length >= 2 ? envelope(p, bands, asOf, who) : null;
  const need = band ? { low: band.low, high: band.high } : { ...point.range };
  const verdict = verdict3(coverage, need.low, need.high);
  return { who, point, need, coverage, verdict, gap: gapOf(verdict, coverage, need), band };
}

/**
 * 結果画面の金額と判定を1組だけ作る。
 *
 * @param input 代表値の入力（暮らし方の目盛りを付けたもの）
 * @param bands 回答の幅の両端の入力（`bandInputsFor` の出力・同じ目盛り）。幅を作れない経路では null
 */
export function resultFigures(
  p: ParamSet,
  input: DiagnoseInput,
  bands: DiagnoseInput[] | null,
  asOf: Date,
): ResultFigures {
  const d = diagnose(p, input, asOf);
  const self = figuresFor(p, "self", d.self, input.coverageSelf, bands, asOf);
  const spouse = d.spouse
    ? figuresFor(p, "spouse", d.spouse, input.coverageSpouse ?? null, bands, asOf)
    : null;
  const people = [self, ...(spouse ? [spouse] : [])];
  const household = householdSummary(
    people.map((f) => ({ coverage: f.coverage, needLow: f.need.low, needHigh: f.need.high })),
  );

  const writeBack = (f: DeathFigures): DeathResult => ({
    ...f.point,
    range: { ...f.need },
    gap: toLegacyGap(f),
  });

  return {
    self,
    spouse,
    household,
    diagnosis: {
      ...d,
      self: writeBack(self),
      spouse: spouse ? writeBack(spouse) : null,
      householdHeadline: toHeadline(household),
    },
  };
}
