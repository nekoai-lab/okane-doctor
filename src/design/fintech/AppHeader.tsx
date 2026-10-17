import s from "./fintech.module.css";

/**
 * 画面上部のヘッダー。右の操作は**記号だけにせず `label` を必ず付ける**（読み上げ用の文字として出す）
 * （試作では ☰ がメニューではなくガイドへの直行で、読み上げも無かった）。
 */
export function AppHeader({
  title,
  action,
}: {
  title: string;
  action?: { href: string; label: string; icon: string };
}) {
  return (
    <header className={s.header}>
      <a className={s.brand} href="/">
        <span aria-hidden="true" className={s.brandDot}>
          ●
        </span>
        {title}
      </a>
      {action && (
        <a className={s.headerAction} href={action.href}>
          <span aria-hidden="true">{action.icon}</span>
          <span className={s.srOnly}>{action.label}</span>
        </a>
      )}
    </header>
  );
}
