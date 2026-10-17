/**
 * LP の挿絵（SVG）。承認画像の「葉・街並み・大きな図版」を、画像を足さずに組み直したもの。
 * どれも飾りなので aria-hidden。意味は隣の文字が持つ。
 *
 * 色はセマンティックトークンだけから混ぜる。葉の緑は --color-success を淡くして使うが、
 * 判定（減らせる）の色と読まれないよう、文字・アイコン・枠の近くには置かず、彩度も落とす。
 */
import type { CSSProperties, ReactNode } from "react";

const P = "var(--color-primary)";
const P_DEEP = "var(--color-primary-active)";
const P_MID = "color-mix(in srgb, var(--color-primary) 55%, var(--color-surface))";
const P_SOFT = "color-mix(in srgb, var(--color-primary) 18%, var(--color-surface))";
const P_PALE = "color-mix(in srgb, var(--color-primary) 9%, var(--color-surface))";
const INK = "var(--color-text)";
const WHITE = "var(--color-surface)";
const LINE = "var(--color-border)";
const LEAF = "color-mix(in srgb, var(--color-success) 45%, var(--color-surface))";
const LEAF_DEEP = "color-mix(in srgb, var(--color-success) 70%, var(--color-surface))";

function Art({
  children,
  viewBox,
  className,
  style,
  preserveAspectRatio,
}: {
  children: ReactNode;
  viewBox: string;
  className?: string;
  style?: CSSProperties;
  preserveAspectRatio?: string;
}) {
  return (
    <svg
      viewBox={viewBox}
      preserveAspectRatio={preserveAspectRatio}
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

/** 葉1枚。rotate で向きを変えて散らす */
export function Leaf({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <Art viewBox="0 0 40 64" className={className} style={style}>
      <path d="M20 62C6 46 4 24 20 2c16 22 14 44 0 60Z" fill={LEAF} />
      <path d="M20 60V10M20 26l-7-6M20 36l8-7M20 46l-8-6" stroke={LEAF_DEEP} strokeWidth="1.6" />
    </Art>
  );
}

/** 枝（葉3枚）。節の角に置く */
export function Sprig({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <Art viewBox="0 0 90 90" className={className} style={style}>
      <path d="M8 86C30 60 50 40 84 8" stroke={LEAF_DEEP} strokeWidth="2" />
      <path d="M30 60c-14-2-24-12-26-26 14 2 24 12 26 26Z" fill={LEAF} />
      <path d="M48 42c-4-14 0-28 12-36 4 14 0 28-12 36Z" fill={LEAF} />
      <path d="M58 32c14-4 26 0 30 10-14 4-26 0-30-10Z" fill={LEAF} />
      <path d="M24 70c12 4 20 14 20 24-12-4-20-14-20-24Z" fill={LEAF} />
    </Art>
  );
}

const SKYLINE_FAR =
  "M0 80V52h18V30h16v22h10V18h20v34h12V40h14v40Zm96 0V36h22V12h18v24h10v44Zm60 0V44h16V24h24v20h12V8h20v72Zm86 0V30h18V48h14V20h22v60Zm68 0V40h20V16h16v24h14V34h18v46Zm82 0V26h22v18h12V6h20v74Zm68 0V38h18V22h20v58Zm52 0V44h16V18h22v62Z";
const SKYLINE_NEAR =
  "M0 80V62h30V50h22v30Zm70 0V58h24V46h20v34Zm60 0V64h30V54h26v26Zm80 0V60h20V48h28v32Zm76 0V62h26V52h24v28Zm84 0V58h22V46h30v34Zm88 0V64h26V54h24v26Zm72 0V60h30v20Z";

/** 街並みのシルエット（最後の入口の帯の下端・計算の仕組みの背景） */
export function Skyline({
  className,
  tone = "pale",
}: {
  className?: string;
  tone?: "pale" | "onBlue";
}) {
  const fill =
    tone === "onBlue"
      ? "color-mix(in srgb, var(--color-surface) 22%, transparent)"
      : "color-mix(in srgb, var(--color-primary) 12%, var(--color-surface))";
  const near =
    tone === "onBlue"
      ? "color-mix(in srgb, var(--color-surface) 34%, transparent)"
      : "color-mix(in srgb, var(--color-primary) 20%, var(--color-surface))";
  // 1枚ぶん（幅600）を3回並べ、高さを固定して下端そろえで切る。
  // 幅いっぱいに引き伸ばすと、PC で建物が横に太って街に見えなくなるため
  return (
    <Art viewBox="0 0 1800 80" className={className} preserveAspectRatio="xMidYMax slice">
      {[0, 600, 1200].map((x) => (
        <g key={x} transform={`translate(${x} 0)`}>
          <path fill={fill} d={SKYLINE_FAR} />
          <path fill={near} d={SKYLINE_NEAR} />
        </g>
      ))}
    </Art>
  );
}

/* ---------- 計算の仕組みの図版（大きめのスポットイラスト） ---------- */

export const Spot = {
  house: () => (
    <Art viewBox="0 0 64 64">
      <path d="M8 30 32 10l24 20" stroke={P_DEEP} strokeWidth="3.5" />
      <path d="M14 28v26h36V28L32 13Z" fill={WHITE} stroke={INK} strokeWidth="2" />
      <path d="M10 30 32 12l22 18-3 3-19-16-19 16Z" fill={P} />
      <rect x="27" y="38" width="10" height="16" rx="1.5" fill={P_MID} />
      <rect
        x="18"
        y="34"
        width="7"
        height="7"
        rx="1"
        fill={P_SOFT}
        stroke={INK}
        strokeWidth="1.5"
      />
      <rect
        x="40"
        y="34"
        width="7"
        height="7"
        rx="1"
        fill={P_SOFT}
        stroke={INK}
        strokeWidth="1.5"
      />
      <path d="M50 54c6-2 8-8 6-14-5 2-8 8-6 14Z" fill={LEAF} />
      <path d="M8 54h48" stroke={INK} strokeWidth="2" />
    </Art>
  ),
  cap: () => (
    <Art viewBox="0 0 64 64">
      <rect x="12" y="44" width="40" height="7" rx="2" fill={P} />
      <rect
        x="15"
        y="51"
        width="36"
        height="6"
        rx="2"
        fill={P_SOFT}
        stroke={INK}
        strokeWidth="1.5"
      />
      <path d="M18 30v8c6 5 22 5 28 0v-8" fill={INK} />
      <path d="M4 24 32 12l28 12-28 12Z" fill={INK} />
      <path d="M32 24l16 6v10" stroke={P_MID} strokeWidth="2.5" />
      <circle cx="48" cy="42" r="2.5" fill={P_MID} />
    </Art>
  ),
  suitcase: () => (
    <Art viewBox="0 0 64 64">
      <path d="M25 16v-6h14v6" stroke={INK} strokeWidth="3" />
      <rect x="16" y="16" width="32" height="38" rx="6" fill={P} />
      <path d="M26 22v26M38 22v26" stroke={P_SOFT} strokeWidth="3" />
      <circle cx="22" cy="57" r="3" fill={INK} />
      <circle cx="42" cy="57" r="3" fill={INK} />
      <path d="M50 56c6-2 9-9 6-15-6 3-8 9-6 15Z" fill={LEAF} />
    </Art>
  ),
  bank: () => (
    <Art viewBox="0 0 64 64">
      <path d="M6 24 32 9l26 15Z" fill={P} />
      <rect x="9" y="24" width="46" height="5" rx="1" fill={P_DEEP} />
      <path d="M15 31v16M25 31v16M39 31v16M49 31v16" stroke={P_MID} strokeWidth="5" />
      <rect x="9" y="47" width="46" height="5" rx="1" fill={INK} />
      <rect
        x="5"
        y="52"
        width="54"
        height="5"
        rx="1"
        fill={P_SOFT}
        stroke={INK}
        strokeWidth="1.5"
      />
    </Art>
  ),
  piggy: () => (
    <Art viewBox="0 0 64 64">
      <circle cx="34" cy="10" r="6" fill={P_SOFT} stroke={P_DEEP} strokeWidth="2" />
      <path d="M32 7v6" stroke={P_DEEP} strokeWidth="2" />
      <path
        d="M10 36c0-10 9-17 21-17 6 0 11 1.6 15 4.6l6-2v9l4 2v8l-5 1c-1.6 3.2-4 5.6-7 7.2V56h-8v-4c-2 .4-4 .4-6 0v4h-8v-6.4C14 46.6 10 42 10 36Z"
        fill={P_SOFT}
        stroke={P}
        strokeWidth="2"
      />
      <path d="M26 24h10" stroke={P_DEEP} strokeWidth="2.5" />
      <circle cx="44" cy="32" r="1.8" fill={INK} />
    </Art>
  ),
  briefcase: () => (
    <Art viewBox="0 0 64 64">
      <path d="M24 18v-6h16v6" stroke={INK} strokeWidth="3" />
      <rect x="8" y="18" width="48" height="34" rx="5" fill={P} />
      <path d="M8 32h48" stroke={P_DEEP} strokeWidth="2.5" />
      <rect x="28" y="28" width="8" height="8" rx="1.5" fill={P_SOFT} />
      <path d="M52 54c6-2 9-8 7-14-6 2-9 8-7 14Z" fill={LEAF} />
    </Art>
  ),
  shieldYen: () => (
    <Art viewBox="0 0 120 120">
      <path d="M22 98c-8-6-12-16-10-26 10 4 14 14 10 26Z" fill={LEAF} />
      <path d="M98 98c8-6 12-16 10-26-10 4-14 14-10 26Z" fill={LEAF} />
      <path d="M60 10 98 24v28c0 26-16 44-38 52-22-8-38-26-38-52V24Z" fill={P} />
      <path d="M60 18 90 29v23c0 21-12 36-30 43V18Z" fill={P_DEEP} opacity="0.55" />
      <path d="m45 36 15 20 15-20M60 56v26M47 62h26M47 72h26" stroke={WHITE} strokeWidth="6" />
      <path d="M60 2v6M84 8l-3 5M36 8l3 5" stroke={P_MID} strokeWidth="3" />
    </Art>
  ),
};

/* ---------- 診断の流れの図版（各カードの主役） ---------- */

/** STEP1：入力画面（選択肢に印が付いていく） */
export function FormArt() {
  return (
    <Art viewBox="0 0 220 120">
      <path d="M26 112c-14-10-18-26-12-42 14 8 18 26 12 42Z" fill={LEAF} />
      <path d="M194 112c14-10 18-26 12-42-14 8-18 26-12 42Z" fill={LEAF} />
      <rect
        x="50"
        y="8"
        width="120"
        height="96"
        rx="8"
        fill={WHITE}
        stroke={INK}
        strokeWidth="2.5"
      />
      <rect x="50" y="8" width="120" height="16" rx="8" fill={P} />
      <rect x="50" y="18" width="120" height="6" fill={P} />
      <circle cx="60" cy="16" r="2" fill={WHITE} />
      <circle cx="67" cy="16" r="2" fill={WHITE} />
      {[36, 56, 76].map((y, i) => (
        <g key={y}>
          <rect
            x="62"
            y={y}
            width="96"
            height="14"
            rx="4"
            fill={i === 2 ? WHITE : P_PALE}
            stroke={i === 2 ? LINE : P_MID}
            strokeWidth="1.5"
          />
          <rect
            x="67"
            y={y + 3}
            width="8"
            height="8"
            rx="2"
            fill={i === 2 ? WHITE : P}
            stroke={P}
            strokeWidth="1.5"
          />
          {i < 2 && <path d={`m69 ${y + 7} 2 2 3-4`} stroke={WHITE} strokeWidth="1.6" />}
          <rect x="81" y={y + 5} width={i === 1 ? 52 : 64} height="4" rx="2" fill={P_SOFT} />
        </g>
      ))}
      <rect x="92" y="104" width="36" height="8" rx="2" fill={INK} />
    </Art>
  );
}

/** STEP2：計算機と、積み上がる棒 */
export function CalcArt() {
  return (
    <Art viewBox="0 0 220 120">
      <path d="M22 112c-14-10-18-26-12-42 14 8 18 26 12 42Z" fill={LEAF} />
      <path d="M200 112c14-10 18-26 12-42-14 8-18 26-12 42Z" fill={LEAF} />
      <rect x="42" y="10" width="64" height="100" rx="10" fill={P} />
      <rect x="51" y="20" width="46" height="18" rx="3" fill={P_PALE} />
      <rect x="72" y="26" width="18" height="6" rx="2" fill={P_MID} />
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => (
          <rect
            key={`${r}-${c}`}
            x={51 + c * 16}
            y={46 + r * 18}
            width="12"
            height="12"
            rx="3"
            fill={r === 2 && c === 2 ? P_SOFT : WHITE}
          />
        )),
      )}
      <path d="M118 110h82" stroke={INK} strokeWidth="2.5" />
      <rect x="124" y="78" width="18" height="32" rx="3" fill={P_SOFT} />
      <rect x="150" y="56" width="18" height="54" rx="3" fill={P_MID} />
      <rect x="176" y="30" width="18" height="80" rx="3" fill={P} />
    </Art>
  );
}

/** STEP3：結果の画面（幅で出る金額と、根拠の行） */
export function ResultArt() {
  return (
    <Art viewBox="0 0 220 120">
      <path d="M22 112c-14-10-18-26-12-42 14 8 18 26 12 42Z" fill={LEAF} />
      <path d="M200 112c14-10 18-26 12-42-14 8-18 26-12 42Z" fill={LEAF} />
      <rect x="70" y="4" width="80" height="112" rx="12" fill={INK} />
      <rect x="75" y="12" width="70" height="98" rx="7" fill={WHITE} />
      <rect x="82" y="20" width="34" height="5" rx="2.5" fill={INK} />
      <rect x="82" y="32" width="56" height="26" rx="4" fill={P_PALE} />
      <rect x="86" y="42" width="48" height="6" rx="3" fill={P_SOFT} />
      <rect x="96" y="42" width="26" height="6" rx="3" fill={P} />
      {[66, 78, 90].map((y) => (
        <g key={y}>
          <circle cx="86" cy={y + 3} r="3" fill={P} />
          <rect x="93" y={y + 1} width="42" height="4" rx="2" fill={P_SOFT} />
        </g>
      ))}
      <circle cx="160" cy="36" r="16" fill={P} />
      <path d="m152 36 6 6 10-12" stroke={WHITE} strokeWidth="4" />
    </Art>
  );
}
