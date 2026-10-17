/**
 * 言語化 API が、結果画面と同じ暮らし方の目盛りで算定し直すことを確かめる（2026-10-16・QA で blocking）。
 * 目盛りを落とすと、退避文に差し込まれる金額だけが目盛り1のまま残る。
 * 鍵が無い環境では退避文が返るので、その本文で確かめる（通常生成も同じ diagnosis を使う）。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resultFigures } from "../../../src/calc/figures.js";
import { fallbackEvent } from "../../../src/narrate/narrateStream.js";
import { formatRange } from "../../../src/design/tokens.js";
import { loadParams } from "../../../src/params/index.js";
import { toCompleteSelections } from "../../../src/wizard/complete.js";
import { resultInputs } from "../../../src/wizard/resultInputs.js";
import { decodeSelections } from "../../../src/wizard/url.js";
import { GET } from "./route.js";

// 代表世帯「不足」（CLAUDE.md の視覚 DoD の表）
const BASE =
  "v=1&sb=1986&emp=self&sp=1&spb=1988&spe=none&ch=2018-2021&edu=private&inc=lt400&sinc=none&as=lt100&liv=lt35&ho=rent&cvs=none&cvsp=none";

async function fallbackText(query: string): Promise<string> {
  const res = await GET(new Request(`http://localhost/api/narrate?${query}`));
  const body = await res.text();
  const event = JSON.parse(body.trim().split("\n")[0]) as { type: string; text: string };
  expect(event.type).toBe("fallback");
  return event.text;
}

function expectedText(query: string, level: "tight" | "asis" | "roomy"): string {
  const p = loadParams();
  const q = new URLSearchParams(query);
  const sel = toCompleteSelections(decodeSelections(q));
  if (!sel) throw new Error("代表世帯の URL が完全な回答になっていない");
  // 結果画面と同じ入口（回答の幅・目盛り込みの最終の金額と判定）で作る（2026-10-17・設計レビュー #1）
  const asOf = new Date();
  const ri = resultInputs(p, sel, level, asOf);
  const d = resultFigures(p, ri.input, ri.bands, asOf).diagnosis;
  const e = fallbackEvent(d, "ai_unavailable");
  if (e.type !== "fallback") throw new Error("退避文のイベントではない");
  return e.text;
}

describe("GET /api/narrate と暮らし方の目盛り", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("dial=roomy の退避文は、目盛り1.1で算定した金額になる", async () => {
    const text = await fallbackText(`${BASE}&dial=roomy`);
    expect(text).toBe(expectedText(BASE, "roomy"));
    expect(text).not.toBe(expectedText(BASE, "asis"));
  });

  it("退避文の必要額は、結果画面のカードと同じ回答の幅のレンジ（代表値ではない）", async () => {
    const text = await fallbackText(BASE);
    const p = loadParams();
    const sel = toCompleteSelections(decodeSelections(BASE));
    if (!sel) throw new Error("代表世帯の URL が完全な回答になっていない");
    const asOf = new Date();
    const ri = resultInputs(p, sel, "asis", asOf);
    const f = resultFigures(p, ri.input, ri.bands, asOf);
    expect(f.self.need).not.toEqual(f.self.point.range);
    expect(text).toContain(formatRange(f.self.need.low, f.self.need.high));
  });

  it("dial なしは目盛り1.0（いま通り）", async () => {
    expect(await fallbackText(BASE)).toBe(expectedText(BASE, "asis"));
  });
});
