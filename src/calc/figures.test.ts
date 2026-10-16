/**
 * 結果画面の「最終の金額と判定」が1組であること（2026-10-17・UX／設計レビュー #1）。
 *
 * 軸名（CLAUDE.md）：ここで扱う判定はすべて**過不足の判定（過不足軸・`Verdict3`）**。
 */
import { describe, expect, it } from "vitest";
import { GOLDEN } from "../__tests__/households.js";
import { loadParams } from "../params/index.js";
import { toCompleteSelections } from "../wizard/complete.js";
import { resultInputs } from "../wizard/resultInputs.js";
import { decodeSelections } from "../wizard/url.js";
import { type LivingLevel, LIVING_LEVELS } from "../wizard/dial.js";
import { type End, inputAtEnds } from "../wizard/uncertainty.js";
import { fallbackNarration, narrate, narrateStub } from "../narrate/narrate.js";
import { buildUserContent } from "../narrate/prompt.js";
import { envelope } from "./envelope.js";
import { resultFigures } from "./figures.js";
import { diagnose } from "./index.js";
import { verdict3 } from "./verdict3.js";

const P = loadParams("2026-08");
const AS_OF = new Date("2026-10-17T12:00:00+09:00");
const MAN = 10_000;

function fromQuery(query: string, level: LivingLevel = "asis") {
  const complete = toCompleteSelections(decodeSelections(query));
  if (!complete) throw new Error("入力が足りない");
  const ri = resultInputs(P, complete, level, AS_OF);
  return { complete, ri, f: resultFigures(P, ri.input, ri.bands, AS_OF) };
}

/** コーディネーター指摘の世帯：代表値 400〜700万・回答の幅 200〜2,000万・本人の保障 1,000万 */
const WIDE =
  "v=1&sb=1988&emp=employee&sp=1&spb=1990&spe=employee&ch=2021-2024&edu=public&inc=lt600&sinc=lt400&as=lt300&liv=lt30&ho=rent&cvs=m1000&cvsp=m300";
/** 視覚の DoD の「不足」世帯 */
const SHORT =
  "v=1&sb=1986&emp=self&sp=1&spb=1988&spe=none&ch=2018-2021&edu=private&inc=lt400&sinc=none&as=lt100&liv=lt35&ho=rent&cvs=none&cvsp=none";

describe("最終の必要額は回答の幅を包絡したレンジで、判定もそこから出す", () => {
  it("回帰：代表値では減らせるが、回答の幅では圏内の世帯で、冒頭も「圏内・要精査」になる", () => {
    const { f } = fromQuery(WIDE);
    // 前提の確認（この世帯がまだ被験体であること）：代表値と幅でレンジが違う
    expect(f.self.point.range).toEqual({ low: 400 * MAN, high: 700 * MAN });
    expect(f.self.need).toEqual({ low: 200 * MAN, high: 2000 * MAN });
    // 診断表と同じ判定（保障1,000万は幅の中）
    expect(f.self.verdict).toBe("uncertain");
    // 冒頭の世帯判定も同じ幅から：減らせるとは言わない
    expect(f.household.verdict).toBe("uncertain");
    expect(f.household.totalNeed.low).toBe(f.self.need.low + (f.spouse?.need.low ?? 0));
    expect(f.household.totalNeed.high).toBe(f.self.need.high + (f.spouse?.need.high ?? 0));
    // よみときに渡す形も同じ結論
    expect(f.diagnosis.householdHeadline.kind).toBe("uncertain");
    expect(f.diagnosis.self.range).toEqual(f.self.need);
    expect(f.diagnosis.self.gap.kind).toBe("adequate");
    // 減らせる額は、減らせる判定の人（配偶者）の分だけ
    expect(f.spouse?.verdict).toBe("reducible");
    expect(f.household.totalReducible).toBe(f.spouse?.gap.low);
  });

  it("不足世帯：ヒーロー・カード・STEP3/4 が同じ本人のレンジを読む", () => {
    const { ri, f } = fromQuery(SHORT);
    const env = envelope(P, ri.bands, AS_OF, "self");
    expect(f.self.need).toEqual({ low: env.low, high: env.high });
    expect(f.self.verdict).toBe("shortage");
    // 保障0なので不足額＝必要額
    expect(f.self.gap).toEqual({ kind: "shortage", low: env.low, high: env.high });
    // 世帯の不足は2人分の和で、下端は既存の totalShortage と同じ
    const sp = f.spouse;
    if (!sp) throw new Error("配偶者のケースが無い");
    expect(f.household.shortageRange).toEqual({
      low: f.self.gap.low + sp.gap.low,
      high: f.self.gap.high + sp.gap.high,
    });
    expect(f.household.totalShortage).toBe(f.household.shortageRange.low);
    expect(f.diagnosis.self.range).toEqual(f.self.need);
  });

  it("内訳（支出・収入・年数）は代表値のまま書き戻す", () => {
    const { ri, f } = fromQuery(SHORT);
    const d = diagnose(P, ri.input, AS_OF);
    expect(f.diagnosis.self.expense).toEqual(d.self.expense);
    expect(f.diagnosis.self.income).toEqual(d.self.income);
    expect(f.diagnosis.self.verdict).toBe(d.self.verdict);
  });
});

describe("幅を渡さない経路では代表値と同じ（既存の算定を動かさない）", () => {
  for (const g of GOLDEN) {
    it(`${g.id}：bands=null なら必要額は diagnose のレンジ、判定は verdict3`, () => {
      const f = resultFigures(P, g.input, null, AS_OF);
      const d = diagnose(P, g.input, AS_OF);
      expect(f.self.need).toEqual(d.self.range);
      expect(f.self.verdict).toBe(
        verdict3(g.input.coverageSelf, d.self.range.low, d.self.range.high),
      );
    });
  }
});

/**
 * QA 9回目（2026-10-17）の blocking 2件。
 *
 * 軸名（CLAUDE.md）：`needVerdict` / `point.verdict` / `rangeVerdict` は**必要額の判定（ニーズ軸）**、
 * `verdict` / `household.verdict` は**過不足の判定（過不足軸）**。
 */
/** QA #1：生活費を年収から推定する世帯。本人の保障 1,500万円 */
const QA1 =
  "v=1&sb=1986&emp=employee&sp=1&spb=1988&spe=employee&ch=2018-2021&edu=public&inc=lt600&sinc=lt400&as=lt100&liv=estimate&ho=rent&cvs=m1500&cvsp=m300";
/** QA #2：代表値は ample（葬儀・予備費だけ）、厳しめ端は shortage。本人の保障 1,000万円 */
const QA2 =
  "v=1&sb=1988&emp=employee&sp=1&spb=1990&spe=employee&ch=2021-2024&edu=public&inc=lt600&sinc=lt400&as=lt1000&liv=lt30&ho=rent&cvs=m1000&cvsp=m300";
/** CLAUDE.md の代表3世帯 */
const REPRESENTATIVE = [
  "v=1&sb=1989&emp=employee&sp=1&spb=1991&spe=employee&ch=2024&edu=public&inc=lt600&sinc=lt400&as=lt500&liv=lt30&ho=own_loan&loan=lt3000&dan=yes&cvs=m2000&cvsp=none",
  SHORT,
  "v=1&sb=1996&emp=employee&sp=0&ch=&inc=lt600&as=lt500&liv=lt25&ho=rent&cvs=m1000",
];

describe("QA #1：年収の端は本人・配偶者で独立に組む（同じ区分内の最悪の組を取りこぼさない）", () => {
  it("回帰：本人は上端・配偶者は下端の組で不足するのに「減らせる」と出ていた", () => {
    const { ri, f } = fromQuery(QA1);
    /**
     * QA が示した入力（同じ回答区分の中の1点）を、同じ式（§4.2.1 の生活費推定）で組んで回す。
     * **実装の候補の作り方に頼らずに**、この点が最終の必要額の内側にあることを確かめる
     */
    const self = 5_999_999;
    const spouse = 1_056_000;
    const monthlyLiving = Math.round(
      ((self + spouse) *
        P.ownStandard.netIncomeRatio.value *
        P.ownStandard.livingCostEstimateRatio.value) /
        12,
    );
    const sp = ri.input.spouse;
    if (!sp) throw new Error("配偶者が無い");
    const qa = diagnose(
      P,
      {
        ...ri.input,
        self: { ...ri.input.self, income: self },
        spouse: { ...sp, income: spouse },
        assets: 500_000,
        monthlyLiving,
      },
      AS_OF,
    ).self;
    // 前提の確認（被験体であること）：この1点だけで保障 1,500万円を超える
    expect(qa.verdict).toBe("shortage");
    expect(qa.range.high).toBeGreaterThan(15_000_000);
    // 最終の必要額は、この1点を内側に含む
    expect(f.self.need.low).toBeLessThanOrEqual(qa.range.low);
    expect(f.self.need.high).toBeGreaterThanOrEqual(qa.range.high);
    // 過不足の判定（過不足軸）：減らせるとは言わない
    expect(f.self.verdict).not.toBe("reducible");
    expect(f.self.verdict).toBe("uncertain");
    expect(f.household.verdict).not.toBe("reducible");
  });

  /**
   * **包絡は、帯の角（入力ごとに端を独立に選んだ全組み合わせ）の最小・最大と一致する。**
   * 角は検査側で `inputAtEnds` から独立に作る。暮らし方の目盛りも全部の角に付ける
   */
  const both: End[] = ["loose", "strict"];
  const corners = (q: string, level: LivingLevel) => {
    const { complete, ri, f } = fromQuery(q, level);
    const out: Array<{ who: "self" | "spouse"; low: number; high: number; f: typeof f }> = [];
    for (const who of ["self", "spouse"] as const) {
      if (who === "spouse" && !f.spouse) continue;
      let low = Number.POSITIVE_INFINITY;
      let high = Number.NEGATIVE_INFINITY;
      for (const selfIncome of both)
        for (const spouseIncome of both)
          for (const living of both)
            for (const assets of both)
              for (const loan of both) {
                const input = {
                  ...inputAtEnds(P, complete, AS_OF, {
                    selfIncome,
                    spouseIncome,
                    living,
                    assets,
                    loan,
                  }),
                  lifestyleDial: ri.dial,
                };
                const d = diagnose(P, input, AS_OF);
                const r = who === "self" ? d.self : d.spouse;
                if (!r) throw new Error("配偶者のケースが無い");
                low = Math.min(low, r.range.low);
                high = Math.max(high, r.range.high);
              }
      out.push({ who, low, high, f });
    }
    return out;
  };
  for (const [name, q] of [
    ["QA #1", QA1],
    ["QA #2", QA2],
    ["組み替えの余地", REPRESENTATIVE[0]],
    ["不足", REPRESENTATIVE[1]],
    ["単身", REPRESENTATIVE[2]],
    ["幅の広い世帯", WIDE],
  ] as const) {
    for (const level of LIVING_LEVELS) {
      it(`${name}（目盛り ${level}）：最終の必要額＝帯の角の最小〜最大`, () => {
        for (const c of corners(q, level)) {
          const fx = c.who === "self" ? c.f.self : c.f.spouse;
          expect(fx?.need).toEqual({ low: c.low, high: c.high });
        }
      });
    }
  }
});

describe("QA #2：包絡したレンジは、代表値の必要額の判定（ニーズ軸）で呼ばない", () => {
  it("前提の確認：代表値は ample・厳しめ端は shortage", () => {
    const { f } = fromQuery(QA2);
    expect(f.self.point.verdict).toBe("ample");
    expect(f.self.band?.verdictStrict).toBe("shortage");
    expect(f.self.need.high).toBeGreaterThan(f.self.point.range.high);
  });

  it("レンジの呼び名に使う必要額の判定は mixed、内訳（代表値）の判定は ample のまま", () => {
    const { f } = fromQuery(QA2);
    expect(f.self.needVerdict).toBe("mixed");
    expect(f.diagnosis.self.rangeVerdict).toBe("mixed");
    expect(f.diagnosis.self.verdict).toBe("ample");
  });

  for (const [name, q] of [
    ["QA #2", QA2],
    ["QA #1", QA1],
    ["組み替えの余地", REPRESENTATIVE[0]],
  ] as const) {
    it(`${name}：退避文・スタブ・AI への指示が、幅全体を葬儀・予備費と呼ばず、上乗せ不要と断定しない`, () => {
      const { f } = fromQuery(q);
      expect(f.self.needVerdict).toBe("mixed");
      for (const text of [
        fallbackNarration(f.diagnosis).text,
        narrateStub(f.diagnosis),
        narrate(f.diagnosis).text,
      ]) {
        expect(text).not.toContain("葬儀・予備費");
        expect(text).not.toContain("当座資金");
        expect(text).not.toContain("上乗せの保障は要りません");
        expect(text).toContain("上乗せの保障が要る場合と要らない場合があります");
      }
      // 幅の金額はエンジンから（AI には書かせない）
      expect(narrateStub(f.diagnosis)).toContain("{{selfRange}}");
      const prompt = buildUserContent(f.diagnosis);
      expect(prompt).toContain("「上乗せの保障は要りません」と言い切らないでください");
      expect(prompt).toContain("self.verdict を根拠に {{selfRange}} を呼ばないでください");
      expect(prompt).not.toContain("そう言い切ってください");
    });
  }

  it("端がそろって上乗せ不要なら、これまでどおり葬儀・予備費と呼ぶ（単身世帯）", () => {
    const { f } = fromQuery(REPRESENTATIVE[2]);
    expect(f.self.needVerdict).toBe("not_needed");
    expect(fallbackNarration(f.diagnosis).text).toContain("葬儀・予備費");
  });

  it("幅を渡さない経路では、代表値の必要額の判定のまま", () => {
    const g = GOLDEN[0];
    const f = resultFigures(P, g.input, null, AS_OF);
    expect(f.self.needVerdict).toBe(diagnose(P, g.input, AS_OF).self.verdict);
  });
});
