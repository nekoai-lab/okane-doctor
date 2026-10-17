/**
 * 結果画面の最初の2画面（結論・次の一歩・前提1点）の文と行（2026-10-17・最初の2画面の作り直し）。
 * 軸名：ここの判定は過不足の判定（過不足軸・`Verdict3`）。
 */
import { describe, expect, it } from "vitest";
import { GOLDEN } from "../../src/__tests__/households.js";
import { resultFigures } from "../../src/calc/figures.js";
import { survivorIncomeSensitivity } from "../../src/calc/sensitivity.js";
import { formatRange } from "../../src/design/tokens.js";
import { loadParams } from "../../src/params/index.js";
import { toCompleteSelections } from "../../src/wizard/complete.js";
import { resultInputs } from "../../src/wizard/resultInputs.js";
import { decodeSelections } from "../../src/wizard/url.js";
import {
  conclusionHeadline,
  keyPremise,
  nextStepSentence,
  noReducibleSentence,
  personRows,
} from "./conclusionModel.js";
import { ownStandardEstimates } from "./estimates.js";
import { DEATH_LABEL } from "./verdictLabels.js";

const P = loadParams("2026-08");
const AS_OF = new Date("2026-10-17T12:00:00+09:00");

const REBALANCE =
  "v=1&sb=1989&emp=employee&sp=1&spb=1991&spe=employee&ch=2024&edu=public&inc=lt600&sinc=lt400&as=lt500&liv=lt30&ho=own_loan&loan=lt3000&dan=yes&cvs=m2000&cvsp=none";
const SHORT =
  "v=1&sb=1986&emp=self&sp=1&spb=1988&spe=none&ch=2018-2021&edu=private&inc=lt400&sinc=none&as=lt100&liv=lt35&ho=rent&cvs=none&cvsp=none";
const SINGLE = "v=1&sb=1996&emp=employee&sp=0&ch=&inc=lt600&as=lt500&liv=lt25&ho=rent&cvs=m1000";
const WIDE =
  "v=1&sb=1988&emp=employee&sp=1&spb=1990&spe=employee&ch=2021-2024&edu=public&inc=lt600&sinc=lt400&as=lt300&liv=lt30&ho=rent&cvs=m1000&cvsp=m300";

function fromQuery(query: string) {
  const complete = toCompleteSelections(decodeSelections(query));
  if (!complete) throw new Error("入力が足りない");
  const ri = resultInputs(P, complete, "asis", AS_OF);
  return { ri, input: ri.input, f: resultFigures(P, ri.input, ri.bands, AS_OF) };
}

const empOf = (input: ReturnType<typeof fromQuery>["input"]) => ({
  self: input.self.employment,
  spouse: input.spouse?.employment ?? null,
});

describe("結論：人ごとの行（2人分の合計を出さない）", () => {
  it("組み替えの世帯は2行。あなたは減らせる幅、配偶者は足りない幅を主金額に出す", () => {
    const { f } = fromQuery(REBALANCE);
    const rows = personRows(f);
    expect(rows.map((r) => r.who)).toEqual(["self", "spouse"]);
    expect(rows[0].verdict).toBe("reducible");
    expect(rows[0].mainText).toBe(formatRange(f.self.gap.low, f.self.gap.high));
    expect(rows[1].verdict).toBe("shortage");
    expect(rows[1].mainText).toBe(formatRange(f.spouse?.gap.low ?? -1, f.spouse?.gap.high ?? -1));
    // バッジはバッジと同じ表を引く（手打ちしない）
    expect(rows.map((r) => r.verdictLabel)).toEqual([DEATH_LABEL.reducible, DEATH_LABEL.shortage]);
    expect(conclusionHeadline(f)).toBe("あなたの保障は多め、配偶者の保障は少なめです");
  });

  it("2人とも不足の世帯でも、2人分を足した不足額をどの行にも出さない", () => {
    const { f } = fromQuery(SHORT);
    const rows = personRows(f);
    expect(rows).toHaveLength(2);
    const total = formatRange(f.household.shortageRange.low, f.household.shortageRange.high);
    for (const r of rows) {
      expect(r.mainText).not.toBe(total);
      for (const x of r.subs) expect(x.text).not.toBe(total);
    }
    expect(rows[0].mainText).toBe(formatRange(f.self.gap.low, f.self.gap.high));
  });

  it("いまの保障が0円の人は、差と同じ幅の「必要額」を重ねて出さない", () => {
    const { f } = fromQuery(SHORT);
    const self = personRows(f)[0];
    expect(f.self.coverage).toBe(0);
    expect(self.subs.map((x) => x.label)).toEqual(["いまの保障"]);
  });

  it("単身は1行", () => {
    const { f } = fromQuery(SINGLE);
    expect(personRows(f)).toHaveLength(1);
    expect(conclusionHeadline(f)).toBe("いまの保障は、必要額より多めです");
  });

  it("ゴールデン10世帯：行は人数ぶん、見出しに金額を入れない、主金額は人ごとの差か必要額", () => {
    for (const g of GOLDEN) {
      const f = resultFigures(P, g.input, null, AS_OF);
      const rows = personRows(f);
      expect(rows, g.id).toHaveLength(g.input.spouse ? 2 : 1);
      expect(conclusionHeadline(f), g.id).not.toMatch(/[0-9]/);
      for (const r of rows) {
        const x = r.who === "self" ? f.self : f.spouse;
        if (!x) throw new Error("人が無い");
        const expected =
          x.gap.kind === "none"
            ? formatRange(x.need.low, x.need.high)
            : formatRange(x.gap.low, x.gap.high);
        expect(r.mainText, g.id).toBe(expected);
      }
    }
  });

  it("減らせる箇所は、人ごとの行か「見つかりませんでした」のどちらか1か所に必ず出る", () => {
    for (const g of GOLDEN) {
      const f = resultFigures(P, g.input, null, AS_OF);
      const inRows = personRows(f).some((r) => r.verdict === "reducible") ? 1 : 0;
      const none = noReducibleSentence(f) !== null ? 1 : 0;
      expect(inRows + none, g.id).toBe(1);
    }
  });
});

describe("次の一歩（1つ）", () => {
  const BANNED = ["保険会社", "代理店", "窓口"];

  it("1文で、保険会社・代理店・窓口を出さない（代表3世帯・圏内・保留・ゴールデン）", () => {
    const cases = [REBALANCE, SHORT, SINGLE, WIDE].map((q) => {
      const { input, f } = fromQuery(q);
      return nextStepSentence(f, empOf(input), 1);
    });
    const { input } = fromQuery(WIDE);
    const pending = resultFigures(
      P,
      { ...input, coverageSelf: null, coverageSpouse: null },
      null,
      AS_OF,
    );
    cases.push(nextStepSentence(pending, empOf(input), 0));
    for (const g of GOLDEN) {
      const f = resultFigures(P, g.input, null, AS_OF);
      cases.push(
        nextStepSentence(
          f,
          { self: g.input.self.employment, spouse: g.input.spouse?.employment ?? null },
          0,
        ),
      );
    }
    for (const t of cases) {
      for (const w of BANNED) expect(t).not.toContain(w);
      // 一文一情報：句点は文末の1つだけ
      expect(t.split("。").filter((x) => x !== "")).toHaveLength(1);
    }
  });

  it("組み替えの世帯は、多めの分と足りない分を一度に確かめる", () => {
    const { input, f } = fromQuery(REBALANCE);
    const t = nextStepSentence(f, empOf(input), 0);
    expect(t).toContain("あなたの多めの分");
    expect(t).toContain("配偶者の足りない分");
    expect(t).toContain("一度に");
  });

  it("自営・フリーランスの不足には勤め先・団体保険を出さない", () => {
    const { input, f } = fromQuery(SHORT);
    const t = nextStepSentence(f, empOf(input), 0);
    expect(t).not.toContain("勤め先");
    expect(t).not.toContain("団体保険");
  });

  it("推定が0件なら「推定で補った項目を答え直す」を言わない", () => {
    const { input, f } = fromQuery(SINGLE);
    expect(nextStepSentence(f, empOf(input), 0)).not.toContain("推定");
    expect(nextStepSentence(f, empOf(input), 1)).toContain("推定で補った項目");
  });
});

describe("この結論を決めている前提（1点）", () => {
  it("組み替え：配偶者の就労収入（回答）。感度文の判定はエンジンの感度から", () => {
    const { ri, input, f } = fromQuery(REBALANCE);
    const sv = survivorIncomeSensitivity(P, input, "self", AS_OF, ri.bands);
    const p = keyPremise(f, sv, false);
    expect(p?.kind).toBe("work");
    if (p?.kind !== "work" || !sv) throw new Error("前提が無い");
    expect(p.work).toBe(f.self.point.income.survivorWork);
    expect(p.text).toContain(`「${DEATH_LABEL[sv.verdictAtZero]}」`);
  });

  it("不足：配偶者の就労は当社基準の見立てと名乗る", () => {
    const { ri, input, f } = fromQuery(SHORT);
    const estimated = ownStandardEstimates(f.self.point, "配偶者").length > 0;
    expect(estimated).toBe(true);
    const p = keyPremise(
      f,
      survivorIncomeSensitivity(P, input, "self", AS_OF, ri.bands),
      estimated,
    );
    expect(p?.kind).toBe("work");
    expect(p?.title).toContain("当社の見立て");
    expect(p?.text).toContain("不足が増えます");
  });

  it("単身：扶養しているご家族がいないこと。図はいまの保障と必要額", () => {
    const { f } = fromQuery(SINGLE);
    const p = keyPremise(f, null, false);
    expect(p?.kind).toBe("single");
    if (p?.kind !== "single") throw new Error("前提が無い");
    expect(p.need).toEqual(f.self.need);
    expect(p.coverage).toBe(f.self.coverage);
    expect(p.text).not.toMatch(/(見ていません|含めていません)。?$/);
    expect(p.needLabel).toBe("必要額（葬儀などの費用）");
  });

  it("単身で団信なしの住宅ローンがある：必要額を葬儀費用だけと呼ばない（PR #5 の QA）", () => {
    const { f } = fromQuery(
      "v=1&sb=1996&emp=employee&sp=0&ch=&inc=lt600&as=lt100&liv=lt25&ho=own_loan&loan=lt3000&dan=no&cvs=m1000",
    );
    expect(f.self.point.expense.housing).toBeGreaterThan(0);
    const p = keyPremise(f, null, false);
    if (p?.kind !== "single") throw new Error("前提が無い");
    expect(p.needLabel).toContain("住宅ローン");
    expect(p.text).toContain("住宅ローン");
    expect(p.text).not.toContain("葬儀などの費用だけ");
  });
});
