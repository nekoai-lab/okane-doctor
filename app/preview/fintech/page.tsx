/**
 * Modern Fintech A の部品見本（2026-10-17・デザイン承認待ち）。
 *
 * **開発中だけ開ける。** 本番ビルド（NODE_ENV=production）では 404 にする。
 * 利用者に見せる画面ではなく、部品の見た目を 390px で確かめるための置き場。
 * 承認後に各画面へ部品が入ったら、このページは消す。
 */
import { notFound } from "next/navigation";
import {
  AppHeader,
  BottomNav,
  Button,
  Card,
  Disclosure,
  Note,
  VerdictBadge,
} from "../../../src/design/fintech/index.js";
import { VERDICT_BADGE } from "../../../src/design/fintech/verdict.js";
import "../../../src/design/theme-fintech.css";
import type { Verdict3 } from "../../../src/calc/verdict3.js";
import { formatRange } from "../../../src/design/tokens.js";
import { DEATH_LABEL } from "../../result/verdictLabels.js";
import s from "./page.module.css";

export const metadata = { title: "部品見本（Modern Fintech A）" };

/**
 * 見本の金額。design/lab-variants の design/variants/lab/sample-data.json
 * （calculateLab・基準日 2026-10-17・params 2026.08）の本人40歳の値をそのまま写した。
 * 部品の見た目を確かめるためだけに使い、計算には使わない。
 */
const SAMPLE_DEATH_40 = { low: 62_000_000, high: 106_000_000 };

const NAV = [
  { key: "home", href: "/", label: "ホーム", icon: "⌂" },
  { key: "input", href: "/wizard", label: "条件", icon: "✎" },
  { key: "lab", href: "/lab", label: "もしもラボ", icon: "▤" },
  { key: "history", href: "#", label: "履歴", icon: "◷" },
  { key: "guide", href: "#", label: "ガイド", icon: "ⓘ" },
];

const VERDICTS: Verdict3[] = ["reducible", "uncertain", "shortage", "pending"];

export default function FintechPreview() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <div data-theme="fintech" className={s.shell}>
      <AppHeader
        title="お金の町医者"
        action={{ href: "#guide", label: "結果の見方ガイドへ", icon: "?" }}
      />
      <div className={s.section}>
        <p className={s.eyebrow}>部品見本・Modern Fintech A</p>
        <h1 className={s.title}>共通部品の見た目</h1>
        <p className={s.muted}>
          トークンは <code>src/design/theme-fintech.css</code>。<code>data-theme="fintech"</code>{" "}
          の中だけが変わり、ほかの画面はいまの見た目のままです。
        </p>
      </div>

      <Card title="判定バッジ（アイコン＋ラベル＋色）">
        <p className={s.small}>
          ラベルは app/result/verdictLabels.ts の DEATH_LABEL から引いています。
        </p>
        <div className={s.stack}>
          {VERDICTS.map((v) => (
            <VerdictBadge
              key={v}
              {...VERDICT_BADGE[v]}
              label={DEATH_LABEL[v]}
              axis="過不足の判定"
            />
          ))}
        </div>
      </Card>

      <Card title="金額の見せ方">
        <p className={s.small}>本人が40歳で万一のことがあった場合（見本の値）</p>
        <p className={s.label}>必要な死亡保障のめやす</p>
        <p className={s.amount}>{formatRange(SAMPLE_DEATH_40.low, SAMPLE_DEATH_40.high)}</p>
        <VerdictBadge
          {...VERDICT_BADGE.shortage}
          label={DEATH_LABEL.shortage}
          axis="過不足の判定"
        />
        <Disclosure label="計算の前提を見る" count="（1項目）">
          <ul>
            <li>末子独立後は年100万円程度の就労収入があるものとして算定しています（当社基準）。</li>
          </ul>
        </Disclosure>
      </Card>

      <Card title="ボタン">
        <div className={s.stackFull}>
          <Button full>診断をはじめる</Button>
          <Button variant="secondary" full>
            もしもラボで詳しく見る
          </Button>
          <Button variant="quiet" full>
            判定の意味を確認する
          </Button>
        </div>
      </Card>

      <Card title="注記">
        <div className={s.stackFull}>
          <Note>保険商品を販売したり、申込みへ誘導したりしません。</Note>
          <Note tone="warning">見本のため、入力とは連動しません。</Note>
        </div>
      </Card>

      <p className={s.foot}>
        見本の画面です。金額は計算済みサンプルの写しで、操作では再計算されません。
      </p>
      <BottomNav items={NAV} current="lab" />
    </div>
  );
}
