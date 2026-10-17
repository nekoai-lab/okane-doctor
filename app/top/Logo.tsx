/**
 * 05B「やわらかカーブ」ロゴの**仮の SVG**（2026-10-17）。
 *
 * 承認済みの外観（handoff の APPROVED_LOGO_05B_GUIDE.png）を見ながら手で起こしたもので、正式マスターではない。
 * 正式なベクター版は人の承認を通してから差し替える（README「正式な05BロゴのSVGは承認工程を通す」）。
 * 色はセマンティックトークンから取る（グラデーションの緑は Success、青は Primary）。
 */
import s from "./top.module.css";

export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <svg
      className={s.logoMark}
      width={size}
      height={size}
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id="od-logo-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--color-primary)" />
          <stop offset="1" stopColor="var(--color-success)" />
        </linearGradient>
      </defs>
      {/* 輪：左下を開けたやわらかい円弧 */}
      <path
        d="M10.5 36.5A18 18 0 1 1 37.5 36.5"
        fill="none"
        stroke="url(#od-logo-ring)"
        strokeWidth="4.2"
        strokeLinecap="round"
      />
      {/* 家（ネイビーの線）と笑顔 */}
      <path
        d="M13.5 24.5 24 15.5l10.5 9M16.5 22.5v11M31.5 22.5v11"
        fill="none"
        stroke="var(--color-text)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M29.5 16.5v4" stroke="var(--color-text)" strokeWidth="3" strokeLinecap="round" />
      <circle cx="21" cy="25.5" r="1.6" fill="var(--color-text)" />
      <circle cx="27" cy="25.5" r="1.6" fill="var(--color-text)" />
      <path
        d="M20.5 29c2 2.2 5 2.2 7 0"
        fill="none"
        stroke="var(--color-primary)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {/* 葉 */}
      <path
        d="M35 4.5c5.5 0 8.5 2.5 8.5 2.5s-1.5 7-9.5 7.5c-1-4 0-7 1-10Z"
        fill="var(--color-success)"
      />
    </svg>
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
