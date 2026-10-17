import type { ReactNode } from "react";
import s from "./fintech.module.css";

/** 白いカード。見出しを渡すと h2 で出す（見出しの階層を画面ごとに崩さない）。 */
export function Card({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className={s.card}>
      {title && <h2 className={s.cardTitle}>{title}</h2>}
      {children}
    </section>
  );
}
