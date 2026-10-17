import s from "./fintech.module.css";

export type NavItem = { key: string; href: string; label: string; icon: string };

/**
 * 下部ナビ。**いまいる場所を `current` で必ず示す**（詳細画面のような下位の画面では、
 * その親のタブを渡す。試作では詳細画面でどのタブも選ばれていなかった）。
 * 文字は 12px 以上・`--color-text-secondary`（白地 5.6:1）。
 */
export function BottomNav({ items, current }: { items: NavItem[]; current?: string }) {
  return (
    <nav className={s.bottomNav} aria-label="メインナビゲーション">
      {items.map((it) => (
        <a
          key={it.key}
          href={it.href}
          className={`${s.navItem} ${it.key === current ? s.navItemCurrent : ""}`.trim()}
          aria-current={it.key === current ? "page" : undefined}
        >
          <span aria-hidden="true" className={s.navIcon}>
            {it.icon}
          </span>
          {it.label}
        </a>
      ))}
    </nav>
  );
}
