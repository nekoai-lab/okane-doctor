import { outOfScope } from "../../src/calc/index.js";
import { calculateLab } from "../../src/calc/lab.js";
import { Button } from "../../src/design/fintech/index.js";
import { loadParams } from "../../src/params/index.js";
import { jstDate } from "../../src/time/jstYear.js";
import { toCompleteSelections } from "../../src/wizard/complete.js";
import { decodeLivingLevel } from "../../src/wizard/dial.js";
import { resultInputs } from "../../src/wizard/resultInputs.js";
import { decodeSelections } from "../../src/wizard/url.js";
import { Lab } from "./Lab.js";
import "../../src/design/theme-fintech.css";
import s from "./page.module.css";

/**
 * もしもラボは Modern Fintech A の見た目で出す（2026-10-17 デザイン承認）。
 * テーマはこのページの中だけに効く（`data-theme="fintech"`）。ほかの画面はまだ従来の見た目。
 */
export default async function LabPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <div data-theme="fintech" className={s.theme}>
      {await LabContent(props)}
    </div>
  );
}

async function LabContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams))
    if (typeof value === "string") q.set(key, value);
  const complete = toCompleteSelections(decodeSelections(q));
  const back = `/result?${q.toString()}`;
  if (!complete)
    return (
      <main className={`${s.page} ${s.fallback}`}>
        <h1>もしもラボ</h1>
        <p>入力がまだ足りていないようです。</p>
        <Button href={`/wizard?${q.toString()}`} variant="secondary">
          入力に戻る
        </Button>
      </main>
    );
  const p = loadParams();
  const asOf = new Date();
  // /result と同じ入口（resultInputs）で、代表値・回答の幅の候補・暮らし方の目盛りをそろえる。
  const { input, bands, estimations } = resultInputs(p, complete, decodeLivingLevel(q), asOf);
  if (outOfScope(p, input))
    return (
      <main className={`${s.page} ${s.fallback}`}>
        <h1>この世帯は、まだ診断できません</h1>
        <p>
          配偶者がいなくて、独立前のお子さんがいる世帯の計算は準備中です。金額と過不足の判定は出していません。
        </p>
        <Button href={back} variant="secondary">
          結果画面へ戻る
        </Button>
      </main>
    );
  return (
    <Lab
      data={calculateLab(p, input, bands, asOf)}
      back={back}
      date={jstDate(asOf)}
      version={p.version}
      estimations={estimations.map((e) => `${e.label}：${e.note}`)}
    />
  );
}
