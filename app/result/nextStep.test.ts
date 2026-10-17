/**
 * 「次の一歩」と「減らせそうな箇所」（UX レビュー #2・設計レビュー #2）。
 * 軸名：ここの判定は過不足の判定（過不足軸）。
 */
import { describe, expect, it } from "vitest";
import { GOLDEN } from "../../src/__tests__/households.js";
import { resultFigures } from "../../src/calc/figures.js";
import { formatRange } from "../../src/design/tokens.js";
import { loadParams } from "../../src/params/index.js";
import { toCompleteSelections } from "../../src/wizard/complete.js";
import { resultInputs } from "../../src/wizard/resultInputs.js";
import { decodeSelections } from "../../src/wizard/url.js";
import { heroDiffText } from "./figureText.js";
import { hasActionableGap, nextStepLines, reducibleSentence } from "./nextStep.js";

const P = loadParams("2026-08");
const AS_OF = new Date("2026-10-17T12:00:00+09:00");

function fromQuery(query: string) {
  const complete = toCompleteSelections(decodeSelections(query));
  if (!complete) throw new Error("入力が足りない");
  const ri = resultInputs(P, complete, "asis", AS_OF);
  return { input: ri.input, f: resultFigures(P, ri.input, ri.bands, AS_OF) };
}

const SHORT_SELF_EMPLOYED =
  "v=1&sb=1986&emp=self&sp=1&spb=1988&spe=none&ch=2018-2021&edu=private&inc=lt400&sinc=none&as=lt100&liv=lt35&ho=rent&cvs=none&cvsp=none";
const REBALANCE =
  "v=1&sb=1989&emp=employee&sp=1&spb=1991&spe=employee&ch=2024&edu=public&inc=lt600&sinc=lt400&as=lt500&liv=lt30&ho=own_loan&loan=lt3000&dan=yes&cvs=m2000&cvsp=none";
const WIDE =
  "v=1&sb=1988&emp=employee&sp=1&spb=1990&spe=employee&ch=2021-2024&edu=public&inc=lt600&sinc=lt400&as=lt300&liv=lt30&ho=rent&cvs=m1000&cvsp=m300";

const empOf = (input: ReturnType<typeof fromQuery>["input"]) => ({
  self: input.self.employment,
  spouse: input.spouse?.employment ?? null,
});

describe("次の一歩は人ごとの過不足の判定から組み立てる", () => {
  it("自営・フリーランスの不足には「勤め先」「団体保険」を案内しない", () => {
    const { input, f } = fromQuery(SHORT_SELF_EMPLOYED);
    const text = nextStepLines(f, empOf(input)).join("");
    expect(text).not.toContain("勤め先");
    expect(text).not.toContain("団体保険");
    expect(text).toContain(
      `あなたの死亡保障は、${formatRange(f.self.gap.low, f.self.gap.high)}足りない可能性`,
    );
  });

  it("会社員の不足なら団体保険の確認を案内する", () => {
    const { input, f } = fromQuery(REBALANCE);
    // 配偶者（会社員）が不足
    const text = nextStepLines(f, empOf(input)).join("");
    expect(text).toContain("配偶者の死亡保障は");
    expect(text).toContain("団体保険");
  });

  it("組み替えの世帯は、減らせる側だけでなく不足側にも触れ、一度に確かめられると言う", () => {
    const { input, f } = fromQuery(REBALANCE);
    const lines = nextStepLines(f, empOf(input));
    expect(lines.some((l) => l.startsWith("あなたの死亡保障は") && l.includes("減らせる"))).toBe(
      true,
    );
    expect(lines.some((l) => l.startsWith("配偶者の死亡保障は") && l.includes("足りない"))).toBe(
      true,
    );
    expect(lines.at(-1)).toContain("一度に");
  });

  it("回答の幅で圏内の人に、減額を案内しない（ヒーローと同じ判定）", () => {
    const { input, f } = fromQuery(WIDE);
    const self = nextStepLines(f, empOf(input))[0];
    expect(self).toContain("言い切れません");
    expect(self).not.toContain("減額");
  });

  it("保険内容が分からない人は保留と書く", () => {
    const { input } = fromQuery(WIDE);
    const f = resultFigures(P, { ...input, coverageSpouse: null }, null, AS_OF);
    expect(nextStepLines(f, empOf(input))[1]).toContain("過不足は出していません");
  });

  it("基準（もっと知りたい）は、動かす理由がある人がいるときだけ", () => {
    expect(hasActionableGap(fromQuery(REBALANCE).f)).toBe(true);
    const { input } = fromQuery(WIDE);
    const allPending = resultFigures(
      P,
      { ...input, coverageSelf: null, coverageSpouse: null },
      null,
      AS_OF,
    );
    expect(hasActionableGap(allPending)).toBe(false);
  });
});

describe("次の一歩は相談先を名指さず、中立の確認にとどめる（UX レビュー1回目 #2）", () => {
  const BANNED = ["保険会社", "代理店", "窓口"];
  const SINGLE = "v=1&sb=1996&emp=employee&sp=0&ch=&inc=lt600&as=lt500&liv=lt25&ho=rent&cvs=m1000";

  it("代表3世帯と、過不足の判定（過不足軸）の4値すべてで、保険会社・代理店・窓口を出さない", () => {
    const seen = new Set<string>();
    for (const q of [REBALANCE, SHORT_SELF_EMPLOYED, SINGLE, WIDE]) {
      const { input, f } = fromQuery(q);
      for (const x of [f.self, ...(f.spouse ? [f.spouse] : [])]) seen.add(x.verdict);
      const text = nextStepLines(f, empOf(input)).join("");
      for (const w of BANNED) expect(text, q).not.toContain(w);
    }
    // 保留も通す（保険内容が分からない人）
    const { input } = fromQuery(WIDE);
    const pending = resultFigures(P, { ...input, coverageSelf: null }, null, AS_OF);
    seen.add(pending.self.verdict);
    for (const w of BANNED) expect(nextStepLines(pending, empOf(input)).join("")).not.toContain(w);
    // 4値を本当に通ったか（被験体が消えて空回りしないように）
    expect([...seen].sort()).toEqual(["pending", "reducible", "shortage", "uncertain"]);
  });

  it("ゴールデン10世帯でも、保険会社・代理店・窓口を出さない", () => {
    for (const g of GOLDEN) {
      const f = resultFigures(P, g.input, null, AS_OF);
      const emp = { self: g.input.self.employment, spouse: g.input.spouse?.employment ?? null };
      const text = nextStepLines(f, emp).join("");
      for (const w of BANNED) expect(text, g.id).not.toContain(w);
    }
  });

  it("減らせる人には、上回っている額（エンジンの差額）を言い切り、確認の行動を案内する", () => {
    const { input, f } = fromQuery(SINGLE);
    expect(f.self.verdict).toBe("reducible");
    const line = nextStepLines(f, empOf(input))[0];
    expect(line).toContain(
      `いまの前提では${formatRange(f.self.gap.low, f.self.gap.high)}減らせる余地`,
    );
    expect(line).toContain("契約内容（保障額・期間・更新の時期）を確かめ");
    expect(line).toContain("実際の値で答え直して");
    expect(line).not.toContain("減額");
  });
});

describe("減らせる額は、ヒーローか単独セクションのどちらか1か所に必ず出る（同じ figures から）", () => {
  for (const g of GOLDEN) {
    it(`${g.id}`, () => {
      const f = resultFigures(P, g.input, null, AS_OF);
      const heroShows =
        f.household.verdict === "reducible" || f.household.verdict === "rebalanceable";
      const hero = heroShows && heroDiffText(f) !== null ? 1 : 0;
      const sectionShowsAmount = reducibleSentence(f) !== null && !heroShows ? 1 : 0;
      const sectionShowsNone = reducibleSentence(f) === null ? 1 : 0;
      expect(hero + sectionShowsAmount + sectionShowsNone).toBe(1);
    });
  }
});
