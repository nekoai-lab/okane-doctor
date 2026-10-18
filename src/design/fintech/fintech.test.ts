/**
 * Modern Fintech A の共通部品の約束。
 * 判定は「アイコン＋ラベル＋色」の3点、下部ナビは現在地を aria-current で示す。
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DEATH_LABEL } from "../../../app/result/verdictLabels.js";
import type { Verdict3 } from "../../calc/verdict3.js";
import { AppHeader } from "./AppHeader.js";
import { BottomNav } from "./BottomNav.js";
import { Disclosure } from "./Disclosure.js";
import { VerdictBadge } from "./VerdictBadge.js";
import { VERDICT_BADGE } from "./verdict.js";

const ALL: Verdict3[] = ["reducible", "uncertain", "shortage", "pending"];

describe("VERDICT_BADGE", () => {
  it("すべての判定にアイコンと色の系統がある", () => {
    for (const v of ALL) {
      expect(VERDICT_BADGE[v].icon.length).toBeGreaterThan(0);
      expect(["positive", "shortage", "check", "neutral"]).toContain(VERDICT_BADGE[v].tone);
    }
  });

  it("減らせる＝positive、不足＝shortage（専用のピンク）、圏内＝check（色を足さない）、保留＝neutral", () => {
    expect(VERDICT_BADGE.reducible.tone).toBe("positive");
    expect(VERDICT_BADGE.shortage.tone).toBe("shortage");
    expect(VERDICT_BADGE.uncertain.tone).toBe("check");
    expect(VERDICT_BADGE.pending.tone).toBe("neutral");
  });
});

describe("VerdictBadge", () => {
  it("アイコン（読み上げない）・軸名・ラベルを出す", () => {
    const html = renderToStaticMarkup(
      createElement(VerdictBadge, {
        ...VERDICT_BADGE.shortage,
        label: DEATH_LABEL.shortage,
        axis: "過不足の判定",
      }),
    );
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("!");
    expect(html).toContain("過不足の判定：");
    expect(html).toContain(DEATH_LABEL.shortage);
  });
});

describe("BottomNav", () => {
  const items = [
    { key: "home", href: "/", label: "ホーム", icon: "⌂" },
    { key: "lab", href: "/lab", label: "もしもラボ", icon: "▤" },
  ];

  it('現在地のタブだけに aria-current="page" が付く', () => {
    const html = renderToStaticMarkup(createElement(BottomNav, { items, current: "lab" }));
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-current="page"[^>]*>.*もしもラボ/);
  });
});

describe("AppHeader", () => {
  it("右の操作は記号だけにせず、読み上げ用の文字を付ける", () => {
    const html = renderToStaticMarkup(
      createElement(AppHeader, {
        title: "お金の町医者",
        action: { href: "/guide", label: "ガイドへ", icon: "?" },
      }),
    );
    expect(html).toMatch(/aria-hidden="true">\?<\/span><span[^>]*>ガイドへ</);
  });
});

describe("Disclosure", () => {
  it("件数を必ず出す（何件隠れているか分かるように）", () => {
    const html = renderToStaticMarkup(
      createElement(
        Disclosure,
        { label: "計算の前提", count: "（6項目）" } as Parameters<typeof Disclosure>[0],
        "x",
      ),
    );
    expect(html).toContain("（6項目）");
    expect(html).toContain("<summary");
  });
});
