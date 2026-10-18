/**
 * 結果画面のレポートの枠（2026-10-18・オーナー承認の見本 design/report-proposal/）。
 *
 * 「どこからどう読めばいいか分からない」という指摘への答えとして、読む順を目次で先に示し、
 * 各節に番号・見出し・「ここで分かること」を置く。節の番号は世帯によって変わる
 * （単身世帯は金額の根拠と見直しの節を持たない）ので、呼び出し側が並べた順に振る。
 */
import type { ReactNode } from "react";
import r from "./report.module.css";

export interface ReportSectionMeta {
  id: string;
  title: string;
  /** 目次の2行目（1000px 以上で出す） */
  tocSub: string;
}

export function ReportToc({ items, lead }: { items: ReportSectionMeta[]; lead: string }) {
  return (
    <nav aria-labelledby="report-toc-head" className={r.toc}>
      <h2 className={r.tocHead} id="report-toc-head">
        この順にお読みください
      </h2>
      <p className={r.tocLead}>{lead}</p>
      <ol className={r.tocList}>
        {items.map((it, i) => (
          <li key={it.id}>
            <a className={r.tocLink} href={`#${it.id}`}>
              <span aria-hidden="true" className={r.num}>
                {i + 1}
              </span>
              <span>
                <span className={r.tocTitle}>{it.title}</span>
                <span className={r.tocSub}>{it.tocSub}</span>
              </span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}

export function ReportSection({
  meta,
  num,
  sub,
  knows,
  children,
}: {
  meta: ReportSectionMeta;
  num: number;
  /** 見出しの下の1行。無ければ出さない */
  sub?: string | null;
  /** 「ここで分かること」。無ければ出さない */
  knows?: string | null;
  children: ReactNode;
}) {
  return (
    <section aria-labelledby={`${meta.id}-title`} className={r.sec} id={meta.id}>
      <div className={r.secHead}>
        <span aria-hidden="true" className={r.num}>
          {num}
        </span>
        <div>
          <h2 className={r.secTitle} id={`${meta.id}-title`}>
            <span className={r.srOnly}>{num}. </span>
            {meta.title}
          </h2>
          {sub && <p className={r.secSub}>{sub}</p>}
        </div>
      </div>
      {knows && (
        <p className={r.knows}>
          <strong>ここで分かること：</strong>
          {knows}
        </p>
      )}
      {children}
    </section>
  );
}
