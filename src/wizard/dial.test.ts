/**
 * 暮らし方の目盛りの URL 状態（#4）
 *
 * **既定は URL に書かない。** 書くと同じ状態を指す URL が2通りでき、
 * 「同じ診療記録か」の判定が要らぬ仕事になる。
 */
import { describe, expect, it } from "vitest";
import { LIVING_LEVEL_LABEL, decodeLivingLevel, wizardQuery, withLivingLevel } from "./dial.js";
import { decodeSelections } from "./url.js";

const BASE = "v=1&sb=1986&liv=lt30";

describe("目盛りの URL 状態", () => {
  it("パラメータが無ければ既定（いま通り）", () => {
    expect(decodeLivingLevel(BASE)).toBe("asis");
  });

  it("**`asis` 明示の URL と、パラメータ無しの URL が同じ結果になる**", () => {
    expect(decodeLivingLevel(`${BASE}&dial=asis`)).toBe(decodeLivingLevel(BASE));
    // 書き出したときも同じ URL になる（既定は消える）
    expect(withLivingLevel(`${BASE}&dial=asis`, "asis")).toBe(withLivingLevel(BASE, "asis"));
    expect(withLivingLevel(BASE, "asis")).not.toContain("dial=");
  });

  it("既定以外はクエリに載る", () => {
    expect(withLivingLevel(BASE, "tight")).toContain("dial=tight");
    expect(withLivingLevel(BASE, "roomy")).toContain("dial=roomy");
    expect(decodeLivingLevel(withLivingLevel(BASE, "roomy"))).toBe("roomy");
  });

  it("目盛りを切り替えても、回答のクエリは壊れない", () => {
    const q = withLivingLevel(withLivingLevel(BASE, "tight"), "roomy");
    expect(new URLSearchParams(q).get("liv")).toBe("lt30");
    expect(new URLSearchParams(q).get("dial")).toBe("roomy");
  });

  it("未知の値は既定に倒す（URL を書き換えられても壊さない）", () => {
    expect(decodeLivingLevel(`${BASE}&dial=zzz`)).toBe("asis");
  });
});

describe("目盛りの呼び名は1つの表から（設計レビュー #4）", () => {
  it("URL の目盛りから引くと、ヒーローとトグルが同じ名前になる", () => {
    expect(LIVING_LEVEL_LABEL[decodeLivingLevel(`${BASE}&dial=tight`)].name).toBe("切り詰める");
    expect(LIVING_LEVEL_LABEL[decodeLivingLevel(`${BASE}&dial=roomy`)].name).toBe("ゆとりを持つ");
    expect(LIVING_LEVEL_LABEL[decodeLivingLevel(BASE)].name).toBe("いま通り");
  });
});

describe("回答を直す経路で目盛りを落とさない（設計レビュー #18）", () => {
  const RESULT =
    "v=1&sb=1986&emp=self&sp=1&spb=1988&spe=none&ch=2018-2021&edu=private&inc=lt400&sinc=none&as=lt100&liv=lt35&ho=rent&cvs=none&cvsp=none&dial=roomy";
  it("結果→ウィザード→結果で、回答も目盛りも戻る", () => {
    const sel = decodeSelections(RESULT);
    const level = decodeLivingLevel(RESULT);
    const back = wizardQuery(sel, level);
    expect(decodeLivingLevel(back)).toBe("roomy");
    expect(decodeSelections(back)).toEqual(sel);
  });
  it("回答を1つ直しても目盛りは残る", () => {
    const sel = { ...decodeSelections(RESULT), livingCost: "lt30" as const };
    const back = wizardQuery(sel, decodeLivingLevel(RESULT));
    expect(new URLSearchParams(back).get("liv")).toBe("lt30");
    expect(decodeLivingLevel(back)).toBe("roomy");
  });
  it("既定（いま通り）は書かない", () => {
    expect(new URLSearchParams(wizardQuery(decodeSelections(RESULT), "asis")).has("dial")).toBe(
      false,
    );
  });
});
