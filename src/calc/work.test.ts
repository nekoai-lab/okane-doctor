/**
 * 遺族の就労収入を見込む年齢の上限（ADR-030・2026-10-18）。
 *
 * 整数年齢のモデル：遺族が `endAge` 歳になる年から就労収入を入れない（60歳の年は 0）。
 * 生活費・遺族年金の算定期間（65歳まで）は動かさない。
 */
import { describe, expect, it } from "vitest";
import { loadParams } from "../params/index.js";
import { calcDeath } from "./death.js";
import { projectDeath } from "./projection.js";
import type { Household, Person } from "./types.js";
import { labInput } from "./lab.js";
import { survivorWorkAt, survivorWorkPlan, survivorWorkTotal, survivorWorkYears } from "./work.js";

const P = loadParams("2026-08");
const MAN = 10_000;

function household(survivor: Person, children: number[] = []): Household {
  return {
    deceased: { age: survivor.age + 2, income: 500 * MAN, employment: "employee" },
    survivor,
    children,
    housing: { type: "rent" },
    assets: 300 * MAN,
    monthlyLiving: 30 * MAN,
    educationPlan: "public",
    currentCoverage: null,
  };
}

const emp = (age: number, income: number): Person => ({
  age,
  income: income * MAN,
  employment: "employee",
});

describe("終わりの年齢の境界", () => {
  it("59歳は入れる・60歳の年から入れない", () => {
    const plan = survivorWorkPlan(P, emp(50, 300));
    expect(plan.endAge).toBe(60);
    expect(survivorWorkAt(plan, 59, false)).toBe(240 * MAN);
    expect(survivorWorkAt(plan, 60, false)).toBe(0);
    expect(survivorWorkAt(plan, 64, false)).toBe(0);
  });

  it("遺族40歳・子なし：25年の算定期間のうち就労は20年", () => {
    const d = calcDeath(P, household(emp(40, 300)));
    expect(d.years.total).toBe(25);
    expect(d.income.survivorWork).toBe(240 * MAN * 20);
  });

  it("算定期間（生活費・遺族年金の年数）は65歳までのまま", () => {
    const at60 = calcDeath(P, household(emp(40, 300)));
    const at65 = calcDeath(P, household({ ...emp(40, 300), workEndAge: 65 }));
    expect(at60.years).toEqual(at65.years);
    expect(at60.expense).toEqual(at65.expense);
    expect(at60.income.pensionBasic).toBe(at65.income.pensionBasic);
    expect(at60.income.pensionKosei).toBe(at65.income.pensionKosei);
    expect(at60.income.chukoreiKafu).toBe(at65.income.chukoreiKafu);
    // 違うのは就労収入だけで、5年分
    expect(at65.income.survivorWork - at60.income.survivorWork).toBe(240 * MAN * 5);
  });

  it("65歳まで働く比較（workEndAge=65）は変更前の式と同じ", () => {
    const d = calcDeath(P, household({ ...emp(35, 250), workEndAge: 65 }, [2]));
    expect(d.income.survivorWork).toBe(200 * MAN * 20 + 200 * MAN * 10);
  });
});

describe("遅い出産：60歳の時点で末子が独立前", () => {
  it("子育て期でも60歳からの就労収入は入れない（生活費は子育て期の率のまま）", () => {
    // 遺族45歳・子3歳 → 末子独立（22歳）は遺族64歳。子育て期19年のうち就労は15年
    const d = calcDeath(P, household(emp(45, 300), [3]));
    expect(d.years.dependent).toBe(19);
    expect(d.years.alone).toBe(1);
    expect(d.income.survivorWork).toBe(240 * MAN * 15);
  });
});

describe("専業・年収0円の遺族", () => {
  it("独立後の当社基準の見込み（年100万円）も60歳で止まる", () => {
    // 遺族35歳・子5歳 → 子育て期17年・独立後13年。見込みは52〜59歳の8年だけ
    const d = calcDeath(P, household({ age: 35, income: 0, employment: "none" }, [5]));
    expect(d.income.survivorWork).toBe(100 * MAN * 8);
    expect(d.assumptions.find((a) => a.field === "survivor.income")?.note).toContain("60歳まで");
  });

  it("独立が60歳以降なら見込みは0円で、当社基準で補ったとは言わない", () => {
    const d = calcDeath(P, household({ age: 45, income: 0, employment: "none" }, [3]));
    expect(d.income.survivorWork).toBe(0);
    expect(d.assumptions.some((a) => a.field === "survivor.income")).toBe(false);
  });

  it("「就労なし」の明示（noWork）は見込みより優先する", () => {
    const d = calcDeath(
      P,
      household({ age: 35, income: 0, employment: "none", noWork: true }, [5]),
    );
    expect(d.income.survivorWork).toBe(0);
    expect(d.assumptions.some((a) => a.field === "survivor.income")).toBe(false);
  });
});

describe("職種で分けない", () => {
  it("会社員と自営業で、同じ年収なら同じ就労収入", () => {
    const e = survivorWorkPlan(P, emp(40, 400));
    const s = survivorWorkPlan(P, { age: 40, income: 400 * MAN, employment: "self" });
    expect(s).toEqual(e);
  });
});

describe("すでに60歳以上で働いている遺族", () => {
  it("いまの収入を65歳まで使い、0にしない・下限も置かない", () => {
    const plan = survivorWorkPlan(P, emp(62, 50));
    expect(plan.endAge).toBe(65);
    expect(plan.netAfter).toBe(plan.netNow);
    const d = calcDeath(P, household(emp(62, 50)));
    expect(d.income.survivorWork).toBe(40 * MAN * 3);
  });
});

describe("総額と年次（台帳）が同じ式を通る", () => {
  for (const [name, h] of [
    ["共働き・子1", household(emp(35, 250), [2])],
    ["遅い出産", household(emp(45, 300), [3])],
    ["専業・子1", household({ age: 35, income: 0, employment: "none" }, [5])],
    ["60歳以上で就労中", household(emp(62, 50))],
  ] as const) {
    it(`${name}：年ごとの就労収入の合計 ＝ income.survivorWork`, () => {
      const d = calcDeath(P, h);
      const rows = projectDeath(P, h, { asOfYear: 2026 }).rows;
      const sum = rows.reduce((s, r) => s + r.income.work, 0);
      expect(sum).toBeCloseTo(d.income.survivorWork, 0);
      const y = survivorWorkYears(
        survivorWorkPlan(P, h.survivor!),
        h.survivor!.age,
        d.years.dependent,
        d.years.total,
      );
      expect(
        survivorWorkTotal(
          survivorWorkPlan(P, h.survivor!),
          h.survivor!.age,
          d.years.dependent,
          d.years.total,
        ),
      ).toBe(d.income.survivorWork);
      expect(y.dependent + y.alone).toBeLessThanOrEqual(d.years.total);
    });
  }

  it("年次の表に「就労収入を見込むのは59歳まで」が出る", () => {
    const rows = projectDeath(P, household(emp(40, 300)), { asOfYear: 2026 }).rows;
    const at60 = rows.find((r) => r.ages.survivor === 60);
    expect(at60?.events.some((e) => e.startsWith("就労収入を見込むのは59歳まで"))).toBe(true);
  });
});

describe("もしもラボで年齢を先へ進めたとき（PR #32 の QA）", () => {
  // 本人・配偶者ともに50歳・配偶者年収300万円・子なし
  const input = {
    self: { age: 50, income: 500 * MAN, employment: "employee" as const },
    spouse: { age: 50, income: 300 * MAN, employment: "employee" as const },
    children: [],
    housing: { type: "rent" as const },
    assets: 300 * MAN,
    monthlyLiving: 30 * MAN,
    educationPlan: "public" as const,
    coverageSelf: null,
    coverageSpouse: null,
  };
  const remaining = (age: number) => {
    const sp = labInput(input as never, age, "answer").spouse!;
    const plan = survivorWorkPlan(P, sp);
    return survivorWorkTotal(plan, sp.age, 0, 65 - sp.age);
  };

  it("いま60歳未満の配偶者は、進めた年齢が60歳以上でも就労収入が戻らない", () => {
    expect(remaining(59)).toBe(240 * MAN);
    expect(remaining(60)).toBe(0);
    expect(remaining(63)).toBe(0);
  });

  it("いま60歳以上で働いている配偶者は、進めても65歳まで見込む", () => {
    const sp = labInput(
      { ...input, self: { ...input.self, age: 61 }, spouse: { ...input.spouse, age: 61 } } as never,
      63,
      "answer",
    ).spouse!;
    const plan = survivorWorkPlan(P, sp);
    expect(plan.endAge).toBe(65);
    expect(survivorWorkTotal(plan, sp.age, 0, 65 - sp.age)).toBe(240 * MAN * 2);
  });

  it("65歳まで働く比較で、いま60歳以上の年収0円の人に下限の年100万円を足さない", () => {
    const plan = survivorWorkPlan(P, { age: 62, income: 0, employment: "none", workEndAge: 65 });
    expect(plan.netAfter).toBe(0);
  });
});
