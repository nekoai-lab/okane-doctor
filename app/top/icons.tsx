/**
 * LP のアイコン（SVG）。絵文字や画像に頼らず、色はセマンティックトークンから取る。
 * どれも飾りなので aria-hidden。意味は隣の文字が持つ。
 */
import type { ReactNode } from "react";

function Svg({ children, size = 28 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

const SOFT = "var(--color-surface-strong)";

export const Icon = {
  arrow: (size = 20) => (
    <Svg size={size}>
      <path d="M6 16h20m-7-7 7 7-7 7" />
    </Svg>
  ),
  chevron: (size = 18) => (
    <Svg size={size}>
      <path d="m12 8 8 8-8 8" />
    </Svg>
  ),
  check: (size = 18) => (
    <Svg size={size}>
      <circle cx="16" cy="16" r="12" fill="currentColor" stroke="none" />
      <path d="m10.5 16.5 4 4 7-8" stroke="var(--color-surface)" strokeWidth="2.6" />
    </Svg>
  ),
  house: (size?: number) => (
    <Svg size={size}>
      <path d="M5 15 16 6l11 9" />
      <path d="M8 13v13h16V13" fill={SOFT} />
      <path d="M13.5 26v-7h5v7" />
    </Svg>
  ),
  cap: (size?: number) => (
    <Svg size={size}>
      <path d="m3 12 13-6 13 6-13 6Z" fill={SOFT} />
      <path d="M8 15v6c3 3 13 3 16 0v-6M27 13v7" />
    </Svg>
  ),
  roofHome: (size?: number) => (
    <Svg size={size}>
      <path d="M4 16 16 6l12 10" />
      <path d="M8 14v12h16V14" fill={SOFT} />
      <path d="M12 20h8M12 23h8" />
    </Svg>
  ),
  heart: (size?: number) => (
    <Svg size={size}>
      <path
        d="M16 26S5 19.5 5 12.5A5.5 5.5 0 0 1 16 10a5.5 5.5 0 0 1 11 2.5C27 19.5 16 26 16 26Z"
        fill={SOFT}
      />
    </Svg>
  ),
  suitcase: (size?: number) => (
    <Svg size={size}>
      <rect x="8" y="9" width="16" height="18" rx="3" fill={SOFT} />
      <path d="M13 9V5h6v4M13 14v8M19 14v8M11 27v2M21 27v2" />
    </Svg>
  ),
  bank: (size?: number) => (
    <Svg size={size}>
      <path d="m4 12 12-7 12 7Z" fill={SOFT} />
      <path d="M7 15v9M12.5 15v9M19.5 15v9M25 15v9M4 27h24" />
    </Svg>
  ),
  piggy: (size?: number) => (
    <Svg size={size}>
      <path
        d="M6 17c0-5 4.5-8 10-8 3 0 5.5.8 7.3 2.2L27 10v5l2 1v4l-2.5.5c-.8 1.6-2 2.8-3.5 3.6V27h-4v-2c-1 .2-2 .2-3 0v2h-4v-3.2C8 22 6 19.8 6 17Z"
        fill={SOFT}
      />
      <circle cx="16" cy="5" r="2.5" />
      <path d="M21 15h.01" />
    </Svg>
  ),
  briefcase: (size?: number) => (
    <Svg size={size}>
      <rect x="4" y="10" width="24" height="16" rx="3" fill={SOFT} />
      <path d="M12 10V7h8v3M4 17h24M16 16v3" />
    </Svg>
  ),
  shieldYen: (size?: number) => (
    <Svg size={size}>
      <path d="M16 3 27 7v8c0 7-4.6 12-11 14C9.6 27 5 22 5 15V7Z" fill="currentColor" />
      <path
        d="m11.5 9.5 4.5 6 4.5-6M16 15.5V23M12 17h8M12 20.5h8"
        stroke="var(--color-surface)"
        strokeWidth="2.2"
      />
    </Svg>
  ),
  shield: (size?: number) => (
    <Svg size={size}>
      <path d="M16 3 27 7v8c0 7-4.6 12-11 14C9.6 27 5 22 5 15V7Z" fill={SOFT} />
      <path d="m11 16 3.5 3.5L21.5 12" />
    </Svg>
  ),
  chart: (size?: number) => (
    <Svg size={size}>
      <rect x="5" y="16" width="5" height="10" rx="1" fill="currentColor" stroke="none" />
      <rect x="13.5" y="10" width="5" height="16" rx="1" fill="currentColor" stroke="none" />
      <rect x="22" y="5" width="5" height="21" rx="1" fill="currentColor" stroke="none" />
    </Svg>
  ),
  bulb: (size?: number) => (
    <Svg size={size}>
      <path d="M11 19a8 8 0 1 1 10 0v3H11Z" fill={SOFT} />
      <path d="M12.5 26h7M14 29h4" />
    </Svg>
  ),
  brain: (size?: number) => (
    <Svg size={size}>
      <path
        d="M16 6.5c-1.5-2-6-2-7 1.5-3 .5-4.5 4-3 6.5-2 2-1.5 6 1.5 7 0 3 3.5 5 6.5 3.5 1 1 1.5 1 2 1V6.5Zm0 0c1.5-2 6-2 7 1.5 3 .5 4.5 4 3 6.5 2 2 1.5 6-1.5 7 0 3-3.5 5-6.5 3.5-1 1-1.5 1-2 1"
        fill={SOFT}
      />
      <path d="M16 6.5V26M11 13h5M16 18h5M11 21h5" />
    </Svg>
  ),
  lock: (size?: number) => (
    <Svg size={size}>
      <rect x="6" y="14" width="20" height="14" rx="3" fill="currentColor" />
      <path d="M10.5 14V10a5.5 5.5 0 0 1 11 0v4" />
      <path d="M16 19v4" stroke="var(--color-surface)" strokeWidth="2.6" />
    </Svg>
  ),
  bed: (size?: number) => (
    <Svg size={size}>
      <path d="M4 9v18M4 21h24v6M28 21v-4a3 3 0 0 0-3-3H14v7" />
      <rect x="14" y="14" width="14" height="7" rx="2" fill={SOFT} />
      <circle cx="9" cy="16.5" r="2.8" fill={SOFT} />
    </Svg>
  ),
  hourglass: (size?: number) => (
    <Svg size={size}>
      <path d="M8 4h16M8 28h16" />
      <path d="M10 4c0 7 12 7 12 12S10 21 10 28h12c0-7-12-7-12-12s12-5 12-12Z" fill={SOFT} />
    </Svg>
  ),
  people: (size?: number) => (
    <Svg size={size}>
      <circle cx="11" cy="10" r="4" fill={SOFT} />
      <circle cx="22" cy="11" r="3.5" fill={SOFT} />
      <path d="M3.5 26c0-5 3.4-8 7.5-8s7.5 3 7.5 8M17 19.5c1.3-1 3-1.5 5-1.5 3.6 0 6.5 2.6 6.5 7" />
    </Svg>
  ),
  form: (size?: number) => (
    <Svg size={size}>
      <rect x="6" y="4" width="20" height="24" rx="3" fill={SOFT} />
      <path d="M11 11h10M11 16h10M11 21h6" />
    </Svg>
  ),
  calculator: (size?: number) => (
    <Svg size={size}>
      <rect x="7" y="3" width="18" height="26" rx="3" fill={SOFT} />
      <rect x="10.5" y="7" width="11" height="5" rx="1" />
      <path d="M11 17h.01M16 17h.01M21 17h.01M11 21.5h.01M16 21.5h.01M21 21.5h.01M11 26h.01M16 26h.01M21 26h.01" />
    </Svg>
  ),
  document: (size?: number) => (
    <Svg size={size}>
      <path d="M8 3h11l6 6v20H8Z" fill={SOFT} />
      <path d="M19 3v6h6M12 15h9M12 19h9M12 23h5" />
    </Svg>
  ),
};
