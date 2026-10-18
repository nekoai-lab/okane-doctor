/** ラボは既存式の別ビュー。制度の将来予測や病名別の費用モデルは追加しない。 */
import { type ParamSet, assertUsable, v } from "../params/index.js";
import { jstYear } from "../time/jstYear.js";
import { type DiagnoseInput, diagnose } from "./index.js";
import { envelope, crossingNote } from "./envelope.js";
import { needForSickness } from "./scenarios.js";
import { householdSummary, verdict3, verdictBySavings } from "./verdict3.js";

export const WORK_LEVELS = ["answer", "half", "zero"] as const;
export type WorkLevel = (typeof WORK_LEVELS)[number];

export function labInput(input: DiagnoseInput, age: number, work: WorkLevel): DiagnoseInput {
  if (!Number.isInteger(age) || age < input.self.age) throw new Error("過去の年齢は試算できません");
  const elapsed = age - input.self.age;
  // §9 の未決はユーザー指定で「回答どおり／半分／0」。帯の各端にも同じ比率を適用する。
  const factor = work === "answer" ? 1 : work === "half" ? 0.5 : 0;
  return {
    ...input,
    self: { ...input.self, age },
    spouse: input.spouse
      ? {
          ...input.spouse,
          age: input.spouse.age + elapsed,
          // 「すでに60歳以上で働いている」の例外は診断した時点の年齢で決める（work.ts）
          ...(elapsed > 0 ? { diagnosedAge: input.spouse.diagnosedAge ?? input.spouse.age } : {}),
          income: Math.round(input.spouse.income * factor),
          // 「ゼロ」は働かないことの明示。当社基準の下限（独立後 年100万円）も外す（work.ts）
          ...(work === "zero" ? { noWork: true } : {}),
        }
      : null,
    children: input.children.map((a) => a + elapsed),
  };
}

export function labDeath(
  p: ParamSet,
  input: DiagnoseInput,
  bands: DiagnoseInput[],
  age: number,
  work: WorkLevel,
  asOf: Date,
) {
  const at = labInput(input, age, work);
  // 制度の有効性は今日で確認。未来の日付を渡して現行パラメータを期限切れにしない。
  const range = envelope(
    p,
    bands.map((b) => labInput(b, age, work)),
    asOf,
  );
  const d = diagnose(p, at, asOf).self;
  const summary = householdSummary([
    { coverage: at.coverageSelf, needLow: range.low, needHigh: range.high },
  ]);
  return {
    age,
    year: jstYear(asOf) + age - input.self.age,
    children: at.children,
    low: range.low,
    high: range.high,
    middle: Math.round((range.low + range.high) / 2),
    verdict: verdict3(at.coverageSelf, range.low, range.high),
    reducible: summary.totalReducible,
    shortage: summary.totalShortage,
    crossing: crossingNote(range),
    assumptions: d.assumptions.map((a) => a.note),
    annualIncome: at.spouse?.income ?? null,
  };
}

export function calculateLab(
  p: ParamSet,
  input: DiagnoseInput,
  bands: DiagnoseInput[],
  asOf: Date,
) {
  assertUsable(p, asOf);
  // スライダーはいまの年齢から（2026-10-17 オーナー決定）。仕様 §5.4 の「40〜64」の下限は
  // 40歳未満の人だと左端が「いま」にならず、いまの必要額をラボで見られなかった
  const minAge = input.self.age;
  const work = WORK_LEVELS.map((level) => ({
    level,
    now: labDeath(p, input, bands, input.self.age, level, asOf),
    points: Array.from({ length: Math.max(0, 65 - minAge) }, (_, i) =>
      labDeath(p, input, bands, minAge + i, level, asOf),
    ),
  }));
  // 期間はシナリオの入力条件（制度定数ではない）。こころは手当の上限までを試算する。
  const sickness = [
    { id: "hospital", title: "短期入院・手術", months: 1, lowEnd: "one_month" as const },
    { id: "injury", title: "けがで3か月働けない", months: 3, lowEnd: "one_month" as const },
    {
      id: "stroke",
      title: "脳卒中・心筋梗塞で半年休む",
      months: 6,
      lowEnd: "full_period" as const,
    },
    { id: "cancer", title: "がんで1年休職", months: 12, lowEnd: "full_period" as const },
    {
      id: "mental",
      title: "こころの不調で休職",
      months: p.shobyoTeate.maxMonths,
      lowEnd: "full_period" as const,
    },
  ].map((s) => ({
    ...s,
    need: needForSickness(
      p,
      {
        annualIncome: input.self.income,
        employment: input.self.employment,
        monthlyLiving: input.monthlyLiving,
        age: input.self.age,
        insuredYears: 0,
      },
      s.months,
      s.lowEnd,
    ),
  }));
  const savings = {
    low: Math.min(input.assets, ...bands.map((b) => b.assets)),
    high: Math.max(input.assets, ...bands.map((b) => b.assets)),
  };
  return {
    work,
    sickness: sickness.map((item) => ({
      ...item,
      savingsVerdict: verdictBySavings(savings.low, savings.high, item.need.low, item.need.high),
    })),
    savings,
    coverage: input.coverageSelf,
    hasSpouse: input.spouse !== null,
    employee: input.self.employment === "employee",
    minAge,
    postIndepMinIncome: v(p, "postIndepMinIncome"),
    maxBenefitMonths: p.shobyoTeate.maxMonths,
    deathSource: p.public.izokuKisoBase.source ?? "日本年金機構",
  };
}
export type LabData = ReturnType<typeof calculateLab>;
export type LabPoint = ReturnType<typeof labDeath>;
