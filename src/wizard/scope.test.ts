import { describe, expect, it } from "vitest";
import { loadParams } from "../params/index.js";
import { outOfScope } from "./scope.js";
import type { WizardSelections } from "./types.js";

const p = loadParams();

const single: WizardSelections = {
  selfBirthYear: 1990,
  selfEmployment: "employee",
  hasSpouse: false,
  childrenBirthYears: [],
  selfIncome: "lt600",
  assets: "lt500",
  livingCost: "lt25",
  housing: "rent",
  coverageSelf: "m1000",
};

describe("outOfScope", () => {
  it("配偶者なし・独立前の子ありは対象外（子の生活費が0年で抜けるため）", () => {
    const sel = { ...single, childrenBirthYears: [2020], educationPlan: "public" as const };
    expect(outOfScope(p, sel, 2026)).toBe("single_parent");
  });

  it("単身（子なし）は対象内", () => {
    expect(outOfScope(p, single, 2026)).toBeNull();
  });

  it("配偶者なしでも、子が全員独立していれば対象内", () => {
    const sel = {
      ...single,
      selfBirthYear: 1960,
      childrenBirthYears: [1990],
      educationPlan: "public" as const,
    };
    expect(outOfScope(p, sel, 2026)).toBeNull();
  });

  it("配偶者ありなら子がいても対象内", () => {
    const sel = {
      ...single,
      hasSpouse: true,
      spouseBirthYear: 1991,
      spouseEmployment: "employee" as const,
      spouseIncome: "lt400" as const,
      coverageSpouse: "none" as const,
      childrenBirthYears: [2020],
      educationPlan: "public" as const,
    };
    expect(outOfScope(p, sel, 2026)).toBeNull();
  });
});
