import { describe, expect, it } from "vitest";
import { loadParams } from "../params/index.js";
import { type DiagnoseInput, OutOfScopeError, diagnose, outOfScope } from "./index.js";

const p = loadParams();
const MAN = 10_000;
const AS_OF = new Date("2026-08-17T12:00:00+09:00");

const single: DiagnoseInput = {
  self: { age: 36, income: 500 * MAN, employment: "employee" },
  spouse: null,
  children: [],
  housing: { type: "rent" },
  assets: 0,
  monthlyLiving: 25 * MAN,
  educationPlan: "public",
  coverageSelf: 1000 * MAN,
};

describe("outOfScope", () => {
  it("配偶者なし・独立前の子ありは対象外（子の生活費が0年で抜けるため）", () => {
    expect(outOfScope(p, { ...single, children: [6] })).toBe("single_parent");
  });

  it("単身（子なし）は対象内", () => {
    expect(outOfScope(p, single)).toBeNull();
  });

  it("配偶者なしでも、子が全員独立していれば対象内", () => {
    expect(
      outOfScope(p, { ...single, self: { ...single.self, age: 60 }, children: [30] }),
    ).toBeNull();
  });

  it("配偶者ありなら子がいても対象内", () => {
    const spouse = { age: 34, income: 300 * MAN, employment: "employee" as const };
    expect(outOfScope(p, { ...single, spouse, children: [6], coverageSpouse: 0 })).toBeNull();
  });

  it("diagnose は対象外の世帯で金額を作らずに止まる（画面・API の共通の入口）", () => {
    expect(() => diagnose(p, { ...single, children: [6] }, AS_OF)).toThrow(OutOfScopeError);
  });
});
