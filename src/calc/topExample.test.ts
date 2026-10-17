/**
 * トップページの試算例。**LP の数字がエンジンの出力そのものである**ことを固定する。
 */
import { describe, expect, it } from "vitest";
import { loadParams } from "../params/index.js";
import { toCompleteSelections } from "../wizard/complete.js";
import { decodeLivingLevel } from "../wizard/dial.js";
import { resultInputs } from "../wizard/resultInputs.js";
import { decodeSelections } from "../wizard/url.js";
import { resultFigures } from "./figures.js";
import { TOP_EXAMPLE_QUERY, topExample } from "./topExample.js";
import { verdict3 } from "./verdict3.js";

const P = loadParams("2026-08");
const AS_OF = new Date("2026-10-15T12:00:00+09:00");

describe("topExample（トップの試算例）", () => {
  const ex = topExample(P, AS_OF);
  const q = new URLSearchParams(TOP_EXAMPLE_QUERY);
  const complete = toCompleteSelections(decodeSelections(q));
  if (!complete) throw new Error("入力が揃っていない");
  const { input, bands } = resultInputs(P, complete, decodeLivingLevel(q), AS_OF);
  const f = resultFigures(P, input, bands, AS_OF).self;
  const r = f.point;

  it("金額は結果画面と同じ resultFigures の出力そのもの（押した先の結果画面と食い違わない）", () => {
    expect(ex.total).toBe(r.expense.total);
    expect(ex.pension).toBe(r.income.pensionBasic + r.income.pensionKosei + r.income.chukoreiKafu);
    expect(ex.survivorWork).toBe(r.income.survivorWork);
    expect(ex.assets).toBe(r.income.assets);
    expect(ex.need).toEqual(f.need);
    expect(ex.verdict).toBe(f.verdict);
    expect(ex.coverage).toBe(input.coverageSelf);
  });

  it("内訳は diagnose の支出そのもので、足すと総額になる", () => {
    expect(ex.expense.living).toBe(r.expense.livingChild + r.expense.livingAlone);
    expect(ex.expense.education).toBe(r.expense.education);
    expect(ex.expense.housing).toBe(r.expense.housing);
    expect(ex.expense.other).toBe(r.expense.funeral);
    const { living, education, housing, other } = ex.expense;
    expect(living + education + housing + other).toBe(ex.total);
  });

  it("世帯は LP の説明どおり（37歳・配偶者35歳・子2歳・団信あり）", () => {
    expect(ex.selfAge).toBe(37);
    expect(ex.spouseAge).toBe(35);
    expect(ex.childAges).toEqual([2]);
    expect(ex.danshinCovered).toBe(true);
  });

  it("過不足は verdict3 と同じ判定で、差は幅で返す", () => {
    expect(ex.verdict).toBe(verdict3(ex.coverage, ex.need.low, ex.need.high));
    if (ex.verdict === "shortage") {
      expect(ex.gap).toEqual({ low: ex.need.low - ex.coverage, high: ex.need.high - ex.coverage });
    }
    expect(ex.gap === null || ex.gap.low <= ex.gap.high).toBe(true);
  });
});
