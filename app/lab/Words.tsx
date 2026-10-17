"use client";
/**
 * もしもラボ「言葉で確かめる」（ADR-028）
 *
 * AI がするのは、言葉をラボの操作（万一の年齢・配偶者の就労・シナリオ）に翻訳することだけ。
 * 「こう受け取りました」も断りの文も、サーバがコードの表から作った文を出す。
 * 金額と判定は、ふだんのボタン操作と同じく、算定済みのデータから引き直す（AI は触れない）。
 *
 * 既定は畳んだ1行（見出し＋変えられるもの）。開かないと使えないので、由来は開いた先の先頭で、入力より前に必ず読める。
 * 畳むのは、390px の最初の画面に時期のカードの必要額を入れるため（2026-10-18 UX レビュー2回目）。
 */
import { useId, useRef, useState } from "react";
import type { LabChanges, LabWordsResult } from "../../src/lab/words.js";
import { LAB_WORDS_MAX_CHARS } from "../../src/lab/words.js";
import { Fold } from "../result/Fold.js";
import s from "./page.module.css";

type State =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "done"; result: LabWordsResult }
  | { kind: "error"; message: string };

const ERROR_TEXT: Record<string, string> = {
  rate_limited: "いま混み合っています。少し時間をおいてから試してください。",
  // 「読み取れなかった」（unclear の断りの文）と区別できるように、つながらなかったことと一時的なことを言う
  ai_unavailable:
    "AI につながりませんでした（一時的なものです）。時間をおいて試すか、下のボタンやスライダーで確かめてください。",
};

export function Words({
  query,
  hasSpouse,
  onApply,
}: {
  query: string;
  /** 配偶者がいない世帯には、就労の操作を「変えられるもの」に挙げない */
  hasSpouse: boolean;
  onApply: (changes: LabChanges) => void;
}) {
  const [text, setText] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const inputId = useId();
  const cardRef = useRef<HTMLElement>(null);

  /** 失敗したら入力を畳み、文だけをカードの外側に残す。390px で開いたままだと必要額とスライダーが画面から押し出される（2026-10-18 UX レビュー3回目） */
  function fail(message: string) {
    setState({ kind: "error", message });
    const details = cardRef.current?.querySelector("details");
    if (details) details.open = false;
  }

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
        fail(ERROR_TEXT[body.error ?? ""] ?? ERROR_TEXT.ai_unavailable);
        return;
      }
      const result = (await res.json()) as LabWordsResult;
      setState({ kind: "done", result });
      if (result.kind === "apply") onApply(result.changes);
    } catch {
      fail(ERROR_TEXT.ai_unavailable);
    }
  }

  return (
    <section ref={cardRef} className={`${s.card} ${s.wordsCard}`} aria-label="言葉で確かめる">
      <Fold
        label="言葉で確かめる"
        count={hasSpouse ? "（年齢・働き方・病気やけが）" : "（年齢・病気やけが）"}
      >
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
        </div>
      </Fold>
      <div aria-live="polite">
        {state.kind === "error" && <p className={s.wordsError}>{state.message}</p>}
      </div>
    </section>
  );
}
