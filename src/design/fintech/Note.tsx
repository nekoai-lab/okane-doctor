import type { ReactNode } from "react";
import s from "./fintech.module.css";

/**
 * 注記。info は前提や中立性の説明、warning は「試作のため連動しない」のような限定。
 * **warning を不足や不安の表現に使わない**（判定は VerdictBadge が受け持つ）。
 */
export function Note({
  tone = "info",
  children,
}: {
  tone?: "info" | "warning";
  children: ReactNode;
}) {
  return (
    <div className={`${s.note} ${tone === "warning" ? s.noteWarning : ""}`.trim()} role="note">
      {children}
    </div>
  );
}
