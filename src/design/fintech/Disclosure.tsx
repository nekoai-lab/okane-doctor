import type { ReactNode } from "react";
import s from "./fintech.module.css";

/**
 * 折りたたみ（Modern Fintech A）。組版の約束は `app/result/Fold.tsx` と同じ：
 * 開閉の合図はシェブロン、件数は折り返さない、件数を必ず出す（何件隠れているか分かるように）。
 * 見出しの行は高さ 44px 以上。
 */
export function Disclosure({
  label,
  count,
  open,
  children,
}: {
  label: string;
  /** `（6項目）` のように括弧ごと渡す */
  count: string;
  open?: boolean;
  children: ReactNode;
}) {
  return (
    <details className={s.disclosure} open={open}>
      <summary className={s.disclosureSummary}>
        <span aria-hidden="true" className={s.chevron} />
        <span>
          {label}
          <span className={s.count}>{count}</span>
        </span>
      </summary>
      <div className={s.disclosureBody}>{children}</div>
    </details>
  );
}
