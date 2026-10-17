/**
 * POST /api/lab/words の入口の検査（ADR-028）。実 AI は呼ばず、fetch を差し替えて返答を与える。
 *
 * 固定したいのは2点。AI に金額を渡していないこと、AI の返答は `interpretLabWords` を通ってから出ること。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route.js";

// 形の検査（30文字以上）だけを通す偽の鍵。外へは出ない（fetch は差し替える）
const FAKE_KEY = "fake-key-for-tests-0000000000000000";

// 代表世帯「不足」（CLAUDE.md の視覚 DoD の表）
const BASE =
  "v=1&sb=1986&emp=self&sp=1&spb=1988&spe=none&ch=2018-2021&edu=private&inc=lt400&sinc=none&as=lt100&liv=lt35&ho=rent&cvs=none&cvsp=none";

function post(body: unknown): Promise<Response> {
  return POST(
    new Request("http://localhost/api/lab/words", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

function geminiReply(json: unknown) {
  return vi.fn(async (_url: string, _init: RequestInit) =>
    Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(json) }] } }] }),
  );
}

describe("POST /api/lab/words", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("空の言葉・壊れた本文・足りない回答は AI を呼ぶ前に 400", async () => {
    const fetchMock = geminiReply({});
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("GEMINI_API_KEY", FAKE_KEY);
    expect((await post({ query: BASE, text: "  " })).status).toBe(400);
    expect((await post("{")).status).toBe(400);
    expect((await post({ query: "v=1", text: "50歳なら" })).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("鍵が無ければ 503 で、ボタン操作へ案内する", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    const res = await post({ query: BASE, text: "50歳で亡くなったら" });
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "ai_unavailable" });
  });

  it("AI の返答は検査を通り、チップはコードの表から作られる。AI には金額を渡さない", async () => {
    const fetchMock = geminiReply({ kind: "changes", deathAge: 50, necessaryAmount: 1 });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubEnv("GEMINI_API_KEY", FAKE_KEY);
    const res = await post({ query: BASE, text: "50歳で亡くなったら" });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      kind: "apply",
      changes: { deathAge: 50 },
      chips: ["50歳で万一"],
      notes: [],
    });
    // 世帯の情報（利用者の言葉と一緒に渡す部分）に金額が無いこと。システム指示の例文は除く
    const sent = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      contents: { parts: { text: string }[] }[];
    };
    const user = sent.contents[0]?.parts[0]?.text ?? "";
    expect(user).toContain("50歳で亡くなったら");
    expect(user).not.toMatch(/円/);
  });

  it("AI が失敗したら 503（言葉はログに出さない）", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("boom", { status: 500 })),
    );
    vi.stubEnv("GEMINI_API_KEY", FAKE_KEY);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const res = await post({ query: BASE, text: "秘密の言葉" });
    expect(res.status).toBe(503);
    expect(warn.mock.calls.flat().join(" ")).not.toContain("秘密の言葉");
  });
});
