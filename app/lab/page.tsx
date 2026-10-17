import Link from "next/link";
import { calculateLab } from "../../src/calc/lab.js";
import { outOfScope } from "../../src/calc/index.js";
import { loadParams } from "../../src/params/index.js";
import { jstDate } from "../../src/time/jstYear.js";
import { toCompleteSelections } from "../../src/wizard/complete.js";
import { decodeSelections } from "../../src/wizard/url.js";
import { decodeLivingLevel } from "../../src/wizard/dial.js";
import { resultInputs } from "../../src/wizard/resultInputs.js";
import { Lab } from "./Lab.js";
import s from "./page.module.css";

export default async function LabPage({
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
      <main className={s.page}>
        <h1>もしもラボ</h1>
        <p>入力がまだ足りていないようです。</p>
        <Link href={`/wizard?${q.toString()}`}>入力に戻る</Link>
      </main>
    );
  const p = loadParams();
  const asOf = new Date();
  // /result と同じ入口（resultInputs）で、代表値・回答の幅の候補・暮らし方の目盛りをそろえる。
  const { input, bands, estimations } = resultInputs(p, complete, decodeLivingLevel(q), asOf);
  if (outOfScope(p, input))
    return (
      <main className={s.page}>
        <h1>この世帯は、まだ診断できません</h1>
        <p>
          配偶者がいなくて、独立前のお子さんがいる世帯の計算は準備中です。金額と過不足の判定は出していません。
        </p>
        <Link href={back}>結果画面へ戻る</Link>
      </main>
    );
  return (
    <Lab
      data={calculateLab(p, input, bands, asOf)}
      back={back}
      date={jstDate(asOf)}
      version={p.version}
      estimations={estimations.map((e) => `${e.label}：${e.note}`)}
      query={q.toString()}
      aiEnabled={Boolean(process.env.GEMINI_API_KEY)}
    />
  );
}
