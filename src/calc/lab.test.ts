import { describe, expect, it } from "vitest";
import { GOLDEN } from "../__tests__/households.js";
import { loadParams } from "../params/index.js";
import { toCompleteSelections } from "../wizard/complete.js";
import { decodeSelections } from "../wizard/url.js";
import { bandInputsFor, normalizeEnds } from "../wizard/uncertainty.js";
import { envelope } from "./envelope.js";
import { diagnose } from "./index.js";
import { calculateLab, labDeath, labInput } from "./lab.js";
import { labCoverageDifference, labRisingIntervals } from "./labView.js";
import { needForSickness } from "./scenarios.js";
import { verdict3 } from "./verdict3.js";

const p = loadParams();
const date = new Date("2026-10-17T00:00:00+09:00");
const input = GOLDEN[0].input;

describe("ラボ：既存算定と同じ必要額を表示する", () => {
  it.each([0.8, 1, 1.2])("回答帯と生活目盛り %s を結果画面と共有する", (dial) => {
    const sel = toCompleteSelections(
      decodeSelections(
        "v=1&sb=1986&emp=employee&sp=1&spb=1988&spe=employee&ch=2018-2021&edu=public&inc=lt600&sinc=lt400&as=lt500&liv=lt30&ho=rent&cvs=m2000&cvsp=none",
      ),
    );
    expect(sel).not.toBeNull();
    const ends = normalizeEnds(p, sel!, date);
    const bands = bandInputsFor(ends, dial);
    const answers = { ...ends.point.input, lifestyleDial: dial };
    const expected = envelope(p, bands, date);
    const data = calculateLab(p, answers, bands, date);
    expect(data.work[0].now.low).toBe(expected.low);
    expect(data.work[0].now.high).toBe(expected.high);
    expect(data.work[0].points[0]).toEqual(data.work[0].now);
    expect(data.work[0].now.verdict).toBe(
      verdict3(answers.coverageSelf, expected.low, expected.high),
    );
  });
  it("回答どおりは元の診断と同じ。半分と0は配偶者だけを変える", () => {
    const copy = structuredClone(input);
    expect(labInput(input, input.self.age, "answer")).toEqual(input);
    const half = labInput(input, input.self.age, "half");
    expect(half.spouse?.income).toBe(1_250_000);
    expect(half.self).toEqual(input.self);
    expect(half.monthlyLiving).toBe(input.monthlyLiving);
    expect(labInput(input, input.self.age, "zero").spouse?.income).toBe(0);
    for (const work of ["answer", "half", "zero"] as const) {
      const expected = diagnose(p, labInput(input, input.self.age, work), date).self;
      const actual = labDeath(p, input, [input, input], input.self.age, work, date);
      expect([actual.low, actual.high]).toEqual([expected.range.low, expected.range.high]);
    }
    expect(input).toEqual(copy);
  });
  it("将来は家族の年齢が同じだけ進む。資産・ローンは固定", () => {
    const later = labInput(input, 47, "answer");
    expect(later.spouse?.age).toBe(45);
    expect(later.children).toEqual([12]);
    expect(later.housing).toEqual(input.housing);
    expect(later.assets).toBe(input.assets);
    expect(labDeath(p, input, [input, input], 47, "answer", date).year).toBe(2036);
    expect(() => labInput(input, 36, "answer")).toThrow();
  });
  it.each([
    [37, 40, 25],
    [50, 50, 15],
    [64, 64, 1],
    [65, 65, 0],
  ])("年齢%sのスライダーは%s歳から、%s点", (age, start, count) => {
    const answers = { ...input, self: { ...input.self, age } };
    const data = calculateLab(p, answers, [answers, answers], date);
    expect(data.minAge).toBe(start);
    expect(data.work[0].points).toHaveLength(count);
    expect(data.work[0].points.every((x) => x.age >= age && x.age <= 64)).toBe(true);
  });
  it("現保障不明は保留、差額も推測しない", () => {
    const answers = { ...input, coverageSelf: null };
    const actual = labDeath(p, answers, [answers, answers], 40, "answer", date);
    expect(actual.verdict).toBe("pending");
    expect(actual.reducible).toBe(0);
    expect(actual.shortage).toBe(0);
  });
  it("配偶者なし・子なしは3段とも同じ。ひとり親は算定しない", () => {
    const solo = { ...input, spouse: null, children: [] };
    const data = calculateLab(p, solo, [solo, solo], date);
    expect(data.hasSpouse).toBe(false);
    expect(data.work[0].now).toEqual(data.work[2].now);
    const singleParent = { ...input, spouse: null };
    expect(() => calculateLab(p, singleParent, [singleParent, singleParent], date)).toThrow();
  });
  it("病気5種は明示した期間の既存式へ委譲。障害の金額は作らない", () => {
    const data = calculateLab(p, input, [input, input], date);
    expect(data.sickness.map((x) => x.months)).toEqual([1, 3, 6, 12, p.shobyoTeate.maxMonths]);
    for (const item of data.sickness) {
      expect(item.need).toEqual(
        needForSickness(
          p,
          {
            annualIncome: input.self.income,
            employment: input.self.employment,
            monthlyLiving: input.monthlyLiving,
            age: input.self.age,
            insuredYears: 0,
          },
          item.months,
          item.lowEnd,
        ),
      );
      expect(Number.isInteger(item.need.low)).toBe(true);
      expect(item.need.high).toBeGreaterThanOrEqual(item.need.low);
    }
    expect(data.sickness.some((x) => x.id === "disability")).toBe(false);
  });
  it("貯蓄の判定は回答帯の両端を使い、重なり・不足・余裕を区別する", () => {
    const baseline = calculateLab(p, input, [input, input], date);
    const high = Math.max(...baseline.sickness.map((item) => item.need.high));
    const poor = { ...input, assets: 0 };
    const rich = { ...input, assets: high + 1 };
    const overlapping = calculateLab(p, poor, [poor, rich], date);
    expect(overlapping.savings).toEqual({ low: 0, high: high + 1 });
    expect(overlapping.sickness.every((item) => item.savingsVerdict === "uncertain")).toBe(true);
    const ample = calculateLab(p, rich, [rich, rich], date);
    expect(ample.sickness.every((item) => item.savingsVerdict === "reducible")).toBe(true);
    const shortage = calculateLab(p, poor, [poor, poor], date);
    for (const item of shortage.sickness) {
      expect(item.savingsVerdict).toBe(item.need.low > 0 ? "shortage" : "uncertain");
    }
  });
  it("配偶者収入ゼロは切替のどの段でも同じ結果", () => {
    const answers = { ...input, spouse: { ...input.spouse!, income: 0 } };
    const data = calculateLab(p, answers, [answers, answers], date);
    expect(data.hasSpouse).toBe(true);
    expect(data.work[0].now.annualIncome).toBe(0);
    expect(data.work[0].points).toEqual(data.work[1].points);
    expect(data.work[0].points).toEqual(data.work[2].points);
  });
  it("期限切れの制度では試算を止める", () => {
    expect(() => calculateLab(p, input, [input, input], new Date("2100-01-01"))).toThrow();
  });
});

describe("ラボの表示用導出", () => {
  it.each([
    [500, 100, 300, "reducible", 200, 400],
    [50, 100, 300, "shortage", 50, 250],
    [0, 100, 300, "shortage", 100, 300],
    [100, 100, 300, "uncertain", 0, 200],
    [300, 100, 300, "uncertain", 200, 0],
    [200, 100, 300, "uncertain", 100, 100],
    [null, 100, 300, "pending", null, null],
  ] as const)("現保障%sと必要額%s〜%sの差", (coverage, low, high, verdict, diffLow, diffHigh) => {
    expect(labCoverageDifference(coverage, low, high)).toEqual({
      verdict,
      low: diffLow,
      high: diffHigh,
    });
  });
  it("上昇区間だけをまとめ、下降・横ばいは含めない", () => {
    const points = [100, 200, 300, 200, 200, 250].map((middle, i) => ({ age: 40 + i, middle }));
    expect(labRisingIntervals(points)).toEqual([
      { from: 40, to: 42 },
      { from: 44, to: 45 },
    ]);
    expect(labRisingIntervals([])).toEqual([]);
    expect(labRisingIntervals([{ age: 64, middle: 100 }])).toEqual([]);
  });
});
