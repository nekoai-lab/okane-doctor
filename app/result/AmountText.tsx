/**
 * 文や見出しの中の金額を、**数字の途中で折らない**（2026-10-17・ChatGPT の UX レビュー1回目）。
 *
 * 390px で「約6,600／万〜1億9,200万円」「約200万／円」と数字の途中で折れ、別の金額に読めた。
 * 金額は「〜」の手前と後ろをそれぞれ分割不可にし、**「〜」の後ろでだけ**折り返せるようにする
 * （ヒーローの3列で先に入れた直しを、見出しの文の中にも広げて1か所にまとめた）。
 *
 * **金額はここで作らない。** 受け取った文字列を区切るだけ。
 */
import { Fragment, type ReactNode } from "react";
import s from "./amountText.module.css";

/** 整形済みの金額1つ（`formatRange` / `formatMan` の出力） */
export function RangeText({ text }: { text: string }) {
  const [start, end] = text.split("〜");
  if (end === undefined) {
    return (
      <span className={s.nowrap} data-amount="">
        {text}
      </span>
    );
  }
  return (
    <>
      <span className={s.nowrap} data-amount="">
        {start}〜
      </span>
      <wbr />
      <span className={s.nowrap} data-amount="">
        {end}
      </span>
    </>
  );
}

/**
 * `formatRange` / `formatMan` が作る金額の形（「約800万円」「約1億2,000万円」「約400〜1,700万円」
 * 「約6,600万〜1億9,200万円」）。下端は単位を省くことがあるので、単位は上端だけ必須にする。
 * 小数（「月13.4万円」）と、両端に「約」が付く形（「約6,200万円〜約1億600万円」）も同じ扱いにする
 * （2026-10-17・UX レビュー2回目：「4万円」だけを守って「13.」と割れていた）。
 */
const END = "約?-?[0-9][0-9,]*(?:\\.[0-9]+)?(?:億(?:[0-9][0-9,]*万)?|万)?";
const AMOUNT = new RegExp(`${END}(?:円?〜${END})?円`, "g");

/** 金額を含む文。金額の部分だけを `RangeText` にする */
export function WithAmounts({ text }: { text: string }) {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(AMOUNT)) {
    const at = m.index ?? 0;
    if (at > last) out.push(<Fragment key={`t${last}`}>{text.slice(last, at)}</Fragment>);
    out.push(<RangeText key={`a${at}`} text={m[0]} />);
    last = at + m[0].length;
  }
  if (last < text.length) out.push(<Fragment key={`t${last}`}>{text.slice(last)}</Fragment>);
  return <>{out}</>;
}
