import type { ReactNode } from "react";
import s from "./fintech.module.css";

type Variant = "primary" | "secondary" | "quiet";

/**
 * ボタン（Modern Fintech A）。高さは 48px 以上（タップ領域 44px を下回らない）。
 *
 * - primary：その画面でいちばん進めてほしい操作に1つだけ
 * - secondary：戻る・詳しく見る
 * - quiet：説明を開くなどの補助
 *
 * `href` を渡すとリンク（<a>）、渡さなければ <button>。見た目は同じ。
 */
export function Button({
  variant = "primary",
  full,
  href,
  onClick,
  type = "button",
  children,
}: {
  variant?: Variant;
  full?: boolean;
  href?: string;
  onClick?: () => void;
  type?: "button" | "submit";
  children: ReactNode;
}) {
  const className = [s.button, s[`button_${variant}`], full ? s.buttonFull : ""].join(" ").trim();
  if (href) {
    return (
      <a className={className} href={href}>
        {children}
      </a>
    );
  }
  return (
    <button className={className} type={type} onClick={onClick}>
      {children}
    </button>
  );
}
