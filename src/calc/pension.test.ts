/**
 * 遺族年金の受給要件（2026-10-17・QA 指摘の回帰）
 *
 * どちらも**必要額を少なく見せる**向きの誤りだった：
 *  - 子のない配偶者の遺族厚生年金を、年齢に関係なく5年で打ち切っていた（2028年改正の先取り。画面は「改正前の制度で計算」）
 *  - 亡くなった人に遺族厚生年金が無い（自営）のに、その上乗せである中高齢寡婦加算だけ乗っていた
 * 総額（calcDeath）と年次表（projectDeath）の両方で確かめる。片方だけ直すと静かにずれる。
 */
import { describe, expect, it } from "vitest";
import { loadParams } from "../params/index.js";
import type { DiagnoseInput } from "./index.js";
import { diagnose } from "./index.js";
import { koseiYears } from "./pension.js";
import { projectDeath } from "./projection.js";

const P = loadParams("2026-08");
const AS_OF = new Date("2026-08-17T12:00:00+09:00");
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function household(input: DiagnoseInput) {
  return {
    deceased: input.self,
    survivor: input.spouse,
    children: input.children,
    housing: input.housing,
    assets: input.assets,
    monthlyLiving: input.monthlyLiving,
    educationPlan: input.educationPlan,
    currentCoverage: input.coverageSelf,
  };
}

describe("遺族厚生年金の受給期間（現行制度）", () => {
  it("子のない配偶者でも、死亡時30歳以上なら算定期間いっぱい受け取る", () => {
    expect(koseiYears(P, false, 30, 35)).toBe(35);
    expect(koseiYears(P, false, 40, 25)).toBe(25);
  });

  it("子のない配偶者が死亡時30歳未満なら5年", () => {
    expect(koseiYears(P, false, 29, 36)).toBe(5);
  });

  it("子があれば年齢に関係なく算定期間いっぱい", () => {
    expect(koseiYears(P, true, 25, 40)).toBe(40);
  });

  it("40歳の子なし配偶者：総額と年次表のどちらも25年分になる", () => {
    const input: DiagnoseInput = {
      self: { age: 45, income: 5_000_000, employment: "employee" },
      spouse: { age: 40, income: 0, employment: "none" },
      children: [],
      housing: { type: "rent" },
      assets: 0,
      monthlyLiving: 300_000,
      educationPlan: "public",
      coverageSelf: 10_000_000,
    };
    const d = diagnose(P, input, AS_OF);
    const pj = projectDeath(P, household(input), { asOfYear: 2026 });
    const years = pj.rows.filter((r) => r.income.pensionKosei > 0).length;
    expect(years).toBe(25);
    expect(Math.round(sum(pj.rows.map((r) => r.income.pensionKosei)))).toBe(
      Math.round(d.self.income.pensionKosei),
    );
  });
});

describe("中高齢寡婦加算は遺族厚生年金への上乗せ", () => {
  const selfEmployed: DiagnoseInput = {
    self: { age: 45, income: 5_000_000, employment: "self" },
    spouse: { age: 40, income: 0, employment: "none" },
    children: [],
    housing: { type: "rent" },
    assets: 0,
    monthlyLiving: 300_000,
    educationPlan: "public",
    coverageSelf: 10_000_000,
  };

  it("亡くなった人が自営なら、総額でも年次表でも加算は0円", () => {
    const d = diagnose(P, selfEmployed, AS_OF);
    expect(d.self.income.pensionKosei).toBe(0);
    expect(d.self.income.chukoreiKafu).toBe(0);
    const pj = projectDeath(P, household(selfEmployed), { asOfYear: 2026 });
    expect(sum(pj.rows.map((r) => r.income.chukoreiKafu))).toBe(0);
  });

  it("会社員なら同じ世帯で加算が乗る（要件を外したのではないことの確認）", () => {
    const employee = {
      ...selfEmployed,
      self: { ...selfEmployed.self, employment: "employee" as const },
    };
    expect(diagnose(P, employee, AS_OF).self.income.chukoreiKafu).toBeGreaterThan(0);
  });
});
