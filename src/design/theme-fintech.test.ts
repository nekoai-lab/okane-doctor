/**
 * Modern Fintech A のテーマ（theme-fintech.css）の約束を固定する。
 *
 * - opt-in であること（`[data-theme="fintech"]` の中だけ。:root を書き換えない）
 * - フォーカスリングを上書きしないこと（デジタル庁DSで変更禁止）
 * - 文字と地のコントラストが WCAG AA を満たすこと（値を変えた日に気づけるように）
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./theme-fintech.css", import.meta.url), "utf8");
const body = css.replace(/\/\*[\s\S]*?\*\//g, "");

/** `--name: value;` を読み、var() を同じファイルの中で解決する */
const decls = new Map<string, string>();
for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) decls.set(m[1], m[2].trim());
function resolve(name: string, depth = 0): string {
  const v = decls.get(name);
  if (v === undefined) throw new Error(`${name} がテーマに無い`);
  const ref = v.match(/^var\((--[\w-]+)\)$/);
  return ref && depth < 10 ? resolve(ref[1], depth + 1) : v;
}
function luminance(hex: string): number {
  const n = hex.replace("#", "");
  const [r, g, b] = [0, 2, 4].map((i) => Number.parseInt(n.slice(i, i + 2), 16) / 255);
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(a: string, b: string): number {
  const [x, y] = [luminance(resolve(a)), luminance(resolve(b))].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

describe("theme-fintech.css", () => {
  it('**opt-in**：セレクタは [data-theme="fintech"] だけで、:root を書き換えない', () => {
    const selectors = [...body.matchAll(/([^{}]+)\{/g)].map((m) => m[1].trim());
    expect(selectors).toEqual(['[data-theme="fintech"]']);
  });

  it("**フォーカスリングを上書きしない**（Yellow-300＋Black はテーマが変わっても残す）", () => {
    expect(decls.has("--color-focus-inner")).toBe(false);
    expect(decls.has("--color-focus-outer")).toBe(false);
  });

  it.each([
    ["--color-text", "--color-surface"],
    ["--color-text-secondary", "--color-surface"],
    ["--color-text-muted", "--color-surface"],
    ["--color-text", "--color-surface-subtle"],
    ["--color-text-secondary", "--color-surface-subtle"],
    ["--color-text-on-inverse", "--color-primary"],
    ["--color-primary", "--color-surface"],
    ["--color-link", "--color-surface"],
    ["--color-verdict-reducible-text", "--color-verdict-reducible-bg"],
    ["--color-verdict-shortage-text", "--color-verdict-shortage-bg"],
    ["--color-verdict-neutral", "--color-verdict-neutral-bg"],
    ["--color-note-text", "--color-note-bg"],
    ["--color-note-warning-text", "--color-note-warning-bg"],
    ["--chart-axis-text", "--chart-surface"],
    ["--mk-ink", "--mk-surface"],
    ["--mk-muted-2", "--mk-surface-alt"],
    ["--mk-amber-text", "--mk-amber-bg"],
    ["--mk-green", "--mk-green-bg"],
    ["--mk-amber-body", "--mk-amber-bg"],
  ])("%s は %s の上で 4.5:1 以上", (fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("**不足を CTA と同じ色にしない**（押させたい場所と不安を示す場所を分ける）", () => {
    expect(resolve("--color-verdict-shortage")).not.toBe(resolve("--color-primary"));
  });
});
