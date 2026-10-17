/**
 * POST /api/lab/words ─ もしもラボ「言葉で確かめる」の翻訳（ADR-028）
 *
 * 受け取るのは結果画面と同じ URL の区分コードと、利用者の言葉だけ。
 * AI には**金額を渡さず**、返ってくるのは列挙値の JSON だけ。中身は `interpretLabWords` が検査し、
 * 画面に出す文はすべてコードの表から作る。計算はクライアントのラボが、サーバで算定済みの
 * データ（`calculateLab`）から引くだけなので、ここでは金額を1つも扱わない。
 *
 * 利用者の言葉は保存しない・ログに出さない（家計と家族の機微な情報なので）。
 */
import { outOfScope } from "../../../../src/calc/index.js";
import {
  createRateLimiter,
  interpretLabWords,
  LAB_WORDS_SCHEMA,
  type LabWordsContext,
  labWordsSystemPrompt,
  labWordsUserContent,
  normalizeLabWords,
} from "../../../../src/lab/words.js";
import { checkApiKey, generateGeminiJson, narrationModel } from "../../../../src/narrate/gemini.js";
import { loadParams } from "../../../../src/params/index.js";
import { toCompleteSelections } from "../../../../src/wizard/complete.js";
import { decodeLivingLevel } from "../../../../src/wizard/dial.js";
import { resultInputs } from "../../../../src/wizard/resultInputs.js";
import { decodeSelections } from "../../../../src/wizard/url.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIMEOUT_MS = 15_000;
/** 1インスタンスあたり1分に20回。公開の入口なので、呼び出しの費用が青天井にならないようにする */
const allow = createRateLimiter(20, 60_000);

export async function POST(req: Request): Promise<Response> {
  let body: { query?: unknown; text?: unknown };
  try {
    body = (await req.json()) as { query?: unknown; text?: unknown };
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const text = normalizeLabWords(body.text);
  if (text === null || typeof body.query !== "string")
    return Response.json({ error: "bad_request" }, { status: 400 });

  const q = new URLSearchParams(body.query);
  const complete = toCompleteSelections(decodeSelections(q));
  if (!complete) return Response.json({ error: "incomplete_input" }, { status: 400 });

  let ctx: LabWordsContext;
  try {
    const p = loadParams();
    const { input, rawInput } = resultInputs(p, complete, decodeLivingLevel(q), new Date());
    if (outOfScope(p, rawInput)) return Response.json({ error: "out_of_scope" }, { status: 422 });
    ctx = {
      age: input.self.age,
      // ラボのスライダーと同じ範囲（`calculateLab` の minAge・64歳まで）
      minAge: input.self.age,
      maxAge: 64,
      hasSpouse: input.spouse !== null,
      canChangeSpouseWork: input.spouse !== null && input.spouse.income > 0,
      childrenCount: input.children.length,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "診断を実行できませんでした。";
    return Response.json({ error: "diagnosis_unavailable", message }, { status: 503 });
  }

  const rawKey = process.env.GEMINI_API_KEY;
  const checked = rawKey ? checkApiKey(rawKey) : null;
  if (!checked || checked.problem) {
    console.warn(`[lab-words] GEMINI_API_KEY: ${checked?.problem ?? "未設定"}`);
    return Response.json({ error: "ai_unavailable" }, { status: 503 });
  }
  if (!allow(Date.now())) return Response.json({ error: "rate_limited" }, { status: 429 });

  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), TIMEOUT_MS);
  try {
    const raw = await generateGeminiJson({
      apiKey: checked.key,
      model: narrationModel(),
      system: labWordsSystemPrompt(),
      user: labWordsUserContent(text, ctx),
      schema: LAB_WORDS_SCHEMA,
      signal: abort.signal,
    });
    return Response.json(interpretLabWords(raw, ctx), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    // 言葉はログに出さない。例外の message は外部の応答本文や返答の断片を含み、そこに利用者の言葉が
    // 引用されうるので書かない（2026-10-17 QA）。残すのは固定の理由コードと HTTP ステータスだけ
    const reason = abort.signal.aborted
      ? "timeout"
      : e instanceof SyntaxError
        ? "bad_json"
        : "api_error";
    const status =
      e instanceof Error ? /^Gemini API エラー: HTTP (\d{3}) /.exec(e.message)?.[1] : undefined;
    console.warn(`[lab-words] ${reason}${status ? ` HTTP ${status}` : ""}`);
    return Response.json({ error: "ai_unavailable" }, { status: 503 });
  } finally {
    clearTimeout(timer);
  }
}
