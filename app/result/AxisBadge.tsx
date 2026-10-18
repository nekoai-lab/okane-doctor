/**
 * 過不足の判定のバッジに、**軸名を添えて**出す（2026-10-17・ChatGPT の UX レビュー1回目「直さないと誤る」#1）。
 *
 * このプロダクトの判定は2種類あり（必要額の判定／過不足の判定）、同じ `shortage` が両方にある。
 * バッジだけを置くと、何を判定したのかが読み手に分からない（CLAUDE.md「判定には必ず軸名を添える」）。
 * 軸名は `VERDICT_AXIS` の1か所から引く ── 画面ごとに手打ちすると呼び名が割れる。
 *
 * バッジの文言と色はこれまでどおり呼び出し側の enum（`HERO_BADGE` / `DEATH_LABEL` など）から来る。
 */
import type { ReactNode } from "react";
import s from "./axisBadge.module.css";
import { VERDICT_AXIS } from "./verdictLabels.js";

export function AxisBadge({
  badgeClassName,
  children,
}: {
  /** バッジ本体のクラス（形と色は共通の判定バッジ `fintech.module.css` を composes したもの） */
  badgeClassName: string;
  children: ReactNode;
}) {
  return (
    <span className={s.row}>
      <span className={s.axis}>{VERDICT_AXIS}</span>
      <span className={badgeClassName}>{children}</span>
    </span>
  );
}
