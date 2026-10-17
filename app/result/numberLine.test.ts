/**
 * 数直線の目盛りの文字（2026-10-17・UX レビュー2回目）。
 * 390px で7本すべてに「2,000万〜12,000万」を付けて重なっていた。文字は4つまでに間引く。
 */
import { describe, expect, it } from "vitest";
import { labeledTicks, MAX_TICK_LABELS, tickText } from "./NumberLine.js";

const MAN = 10_000;
const range = (step: number, n: number) => Array.from({ length: n }, (_, i) => i * step * MAN);

describe("labeledTicks", () => {
  it("目盛りが4本以下なら全部に文字を付ける", () => {
    const t = range(1000, 4);
    expect([...labeledTicks(t)]).toEqual(t);
  });

  it("0〜1億2,000万（7本）は 0・4,000万・8,000万・1.2億 の4つ", () => {
    const t = range(2000, 7);
    expect([...labeledTicks(t)].map(tickText)).toEqual(["0", "4,000万", "8,000万", "1.2億"]);
  });

  it("何本あっても文字は4つ以下で、0 を必ず含む", () => {
    for (let n = 1; n <= 20; n++) {
      const t = range(1000, n);
      const l = labeledTicks(t);
      expect(l.size).toBeLessThanOrEqual(MAX_TICK_LABELS);
      expect(l.has(0)).toBe(true);
    }
  });
});

describe("tickText", () => {
  it("1億未満は万、1億以上は億で書く", () => {
    expect(tickText(0)).toBe("0");
    expect(tickText(2000 * MAN)).toBe("2,000万");
    expect(tickText(10_000 * MAN)).toBe("1億");
    expect(tickText(12_000 * MAN)).toBe("1.2億");
  });
});
