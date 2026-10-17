"use client";
/**
 * もしもラボ「言葉で確かめる」（ADR-028）
 *
 * AI がするのは、言葉をラボの操作（万一の年齢・配偶者の就労・シナリオ）に翻訳することだけ。
 * 「こう受け取りました」も断りの文も、サーバがコードの表から作った文を出す。
 * 金額と判定は、ふだんのボタン操作と同じく、算定済みのデータから引き直す（AI は触れない）。
 *
 * **由来は折りたたみの外で開示する**（UIラベル規約「由来は本文で開示する」）。
 */
import { useId, useState } from "react";
import type { LabChanges, LabWordsResult } from "../../src/lab/words.js";
import { LAB_WORDS_MAX_CHARS } from "../../src/lab/words.js";
import s from "./page.module.css";

type State =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "done"; result: LabWordsResult }
  | { kind: "error"; message: string };

const ERROR_TEXT: Record<string, string> = {
  rate_limited: "いま混み合っています。少し時間をおいてから試してください。",
  ai_unavailable: "いまは言葉で受け取れません。上のボタンやスライダーで確かめてください。",
};

export function Words({
  query,
  onApply,
}: {
  query: string;
  onApply: (changes: LabChanges) => void;
}) {
  const [text, setText] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const inputId = useId();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim() === "" || state.kind === "sending") return;
    setState({ kind: "sending" });
    try {
      const res = await fetch("/api/lab/words", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, text }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setState({
          kind: "error",
          message: ERROR_TEXT[body.error ?? ""] ?? ERROR_TEXT.ai_unavailable,
        });
        return;
      }
      const result = (await res.json()) as LabWordsResult;
      setState({ kind: "done", result });
      if (result.kind === "apply") onApply(result.changes);
    } catch {
      setState({ kind: "error", message: ERROR_TEXT.ai_unavailable });
    }
  }

  return (
    <section className={`${s.card} ${s.wordsCard}`} aria-labelledby={`${inputId}-title`}>
      <h2 id={`${inputId}-title`}>言葉で確かめる</h2>
      <p className={s.note}>
        {
          "言葉を操作に置きかえるのは AI です。金額と判定は計算エンジンが出し、AI は変えられません。"
        }
      </p>
      <form className={s.wordsForm} onSubmit={submit}>
        <textarea
          id={inputId}
          aria-label="確かめたい「もしも」"
          className={s.wordsInput}
          rows={1}
          maxLength={LAB_WORDS_MAX_CHARS}
          placeholder="例：50歳で亡くなったら"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className={s.wordsButton} type="submit" disabled={state.kind === "sending"}>
          {state.kind === "sending" ? "受け取っています…" : "この条件で確かめる"}
        </button>
      </form>
      <div aria-live="polite">
        {state.kind === "done" && state.result.kind === "apply" && (
          <div className={s.wordsReadout}>
            <ul className={s.chips} aria-label="こう受け取りました">
              {state.result.chips.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
            {state.result.notes.map((n) => (
              <p className={s.note} key={n}>
                {n}
              </p>
            ))}
            <p className={s.note}>違っていたら、ボタンやスライダーで直せます。</p>
          </div>
        )}
        {state.kind === "done" && state.result.kind === "unsupported" && (
          <p className={s.wordsReadout}>{state.result.message}</p>
        )}
        {state.kind === "error" && <p className={s.wordsReadout}>{state.message}</p>}
      </div>
    </section>
  );
}
