import s from "./fintech.module.css";
import type { BadgeTone } from "./verdict.js";

/**
 * 判定バッジ。**アイコン・ラベル・色の3点を必ず出す**（どれか1つだけにしない）。
 *
 * `axis` は判定の軸名（「過不足の判定」「貯蓄の判定」）。同じ画面に軸の違う判定が並ぶとき、
 * 「不足の可能性」がどの比較の結果なのかを読み違えないために付ける。
 */
export function VerdictBadge({
  tone,
  icon,
  label,
  axis,
}: {
  tone: BadgeTone;
  icon: string;
  label: string;
  axis?: string;
}) {
  return (
    <span className={`${s.badge} ${s[`badge_${tone}`]}`}>
      {axis && <span className={s.badgeAxis}>{axis}：</span>}
      <span aria-hidden="true" className={s.badgeIcon}>
        {icon}
      </span>
      {label}
    </span>
  );
}
