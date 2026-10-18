// 金額の幅は「〜」の後ろでだけ折り返す（単位や桁の途中で折れない・PR #34 の UX 44回目で説明文にも広げた）
import { formatMan, formatRange } from "../../src/design/tokens.js";
import s from "./page.module.css";

export function AmountRange({ low, high }: { low: number; high: number }) {
  const [start, end] = formatRange(low, high).split("〜");
  return (
    <span className={s.amountRange}>
      <span className={s.amountEnd}>
        {start}
        {end !== undefined && "〜"}
      </span>
      {end !== undefined && (
        <>
          <wbr />
          <span className={s.amountEnd}>{end}</span>
        </>
      )}
    </span>
  );
}

/** 1つの金額。0円に「約」を付けない */
export function Amount({ value }: { value: number }) {
  return <span className={s.amountEnd}>{value === 0 ? "0円" : `約${formatMan(value)}`}</span>;
}
