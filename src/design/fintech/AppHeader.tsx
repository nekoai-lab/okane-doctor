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
        {/* 05B の承認済みシンボル（design/handoff/logo-05B/approved/02_symbol_color_white.png の写し）。
            ブランドの色を持つ画像なのでトークンには通さない。名前は隣の文字が読み上げる */}
        {/* biome-ignore lint/performance/noImgElement: 28px の固定画像。next/image の最適化は要らない */}
        <img
          className={s.brandMark}
          src="/brand/okane-doctor-symbol.png"
          alt=""
          width={28}
          height={28}
        />
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
