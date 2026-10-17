/**
 * 折りたたみの見出し（2026-09-21 オーナー確定・全画面共通）
 *
 * **型を1つに統一する。** 場所ごとに書くと、また記法が分かれる（`KeyCaption` と同じ理由）。
 *
 * 組版の約束：
 * - 見出し語は**墨・下線なし**。開閉の合図は**シェブロン**で出す
 * - 件数（`（3通り）`）は `white-space: nowrap` で**分割不可**
 * - **件数を必ず出す。** 数の無い「すべて見る」は、何件隠れているか分からず開示ではなく隠蔽に近い
 *
 * きっかけ：下線つきの見出しが 390px で2行に割れ、
 * 「進路で教育費はこう変わる（**3**通り・お子さん合計）」の括弧内の数字だけが
 * 行末に落ちて崩れていた。**下線は「開ける」の合図として弱く、リンクと誤読される**。
 */
import type { ReactNode } from "react";
import s from "./fold.module.css";

export function Fold({
  label,
  count,
  countClassName,
  children,
  open,
  id,
}: {
  /** 見出し語。折り返してよい */
  label: string;
  /** 件数。`（3通り）` のように括弧ごと渡す。**折り返さない**。
   *  ラボは件数の代わりに金額レンジを渡す（「〜」の後でだけ折り返す部品を入れるため ReactNode も受ける） */
  count?: ReactNode;
  countClassName?: string;
  children: ReactNode;
  /** 既定で開いておくか（参照材は閉じるのが既定） */
  open?: boolean;
  /** ページ内リンクの行き先（ラボの「言葉で確かめる」がシナリオへ移るときに使う） */
  id?: string;
}) {
  return (
    <details className={s.fold} open={open} id={id}>
      <summary className={s.summary}>
        <span aria-hidden="true" className={s.chevron} />
        <span className={s.label}>
          {label}
          {count && <span className={`${s.count} ${countClassName ?? ""}`}>{count}</span>}
        </span>
      </summary>
      <div className={s.body}>{children}</div>
    </details>
  );
}
