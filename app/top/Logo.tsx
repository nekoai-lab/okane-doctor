/**
 * 05B「やわらかカーブ」ロゴ。
 *
 * マークは `public/brand/okane-doctor-mark.svg`（2026-10-17 受領の 05B マスター。家と顔の色だけ原画の紺にそろえた）。
 * ブランドの色をそのまま持つ画像なので、UI のトークンには通さず <img> で出す。
 * 文字（お金の町医者・添え書き）は本文と同じ書体で組み、読み上げは文字側が持つ。
 */
import s from "./top.module.css";

export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    // biome-ignore lint/performance/noImgElement: 48×48 の SVG。next/image の最適化は効かない
    <img
      className={s.logoMark}
      src="/brand/okane-doctor-mark.svg"
      alt=""
      width={size}
      height={size}
    />
  );
}

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className={s.logo}>
      <LogoMark size={compact ? 34 : 40} />
      <span className={s.logoText}>
        <span className={s.logoName}>
          お金の<span className={s.logoAccent}>町医者</span>
        </span>
        <span className={s.logoTag}>暮らしのお金、いつもそばで支える</span>
      </span>
    </span>
  );
}
