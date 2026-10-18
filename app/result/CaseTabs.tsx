"use client";
/**
 * 「あなたに万一のとき／配偶者に万一のとき」の切り替え（金額の根拠の節）。
 *
 * 中身はサーバで両方とも描いてあり、ここは見せる方を選ぶだけ（金額を作らない）。
 * 1人分しかない世帯では切り替えを出さない。
 */
import { type KeyboardEvent, type ReactNode, useRef, useState } from "react";
import r from "./report.module.css";

export interface CaseTab {
  id: string;
  label: string;
  panel: ReactNode;
}

export function CaseTabs({ tabs, label }: { tabs: CaseTab[]; label: string }) {
  const [current, setCurrent] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  if (tabs.length === 1) return <>{tabs[0].panel}</>;

  const move = (e: KeyboardEvent, i: number) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    e.preventDefault();
    const next = (i + step + tabs.length) % tabs.length;
    setCurrent(next);
    refs.current[next]?.focus();
  };

  return (
    <>
      <div aria-label={label} className={r.tabs} role="tablist">
        {tabs.map((t, i) => (
          <button
            aria-controls={`panel-${t.id}`}
            aria-selected={i === current}
            className={r.tab}
            id={`tab-${t.id}`}
            key={t.id}
            onClick={() => setCurrent(i)}
            onKeyDown={(e) => move(e, i)}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            tabIndex={i === current ? 0 : -1}
            type="button"
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t, i) => (
        <div
          aria-labelledby={`tab-${t.id}`}
          hidden={i !== current}
          id={`panel-${t.id}`}
          key={t.id}
          role="tabpanel"
        >
          {t.panel}
        </div>
      ))}
    </>
  );
}
