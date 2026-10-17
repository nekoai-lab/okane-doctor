/**
 * Modern Fintech A の画面の外枠（2026-10-18・診断・保存・お知らせに広げた）。
 *
 * テーマは `data-theme="fintech"` を付けた要素の中だけに効く（src/design/theme-fintech.css）。
 * ラボと同じヘッダーを上に置き、各画面の layout からこれで包む。
 */
import type { ReactNode } from "react";
import { AppHeader } from "../src/design/fintech/index.js";
import "../src/design/theme-fintech.css";
import s from "./fintechShell.module.css";

export function FintechShell({ children }: { children: ReactNode }) {
  return (
    <div data-theme="fintech" className={s.shell}>
      <AppHeader title="お金の町医者" />
      {children}
    </div>
  );
}
