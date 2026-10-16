/**
 * 「次の一歩」と「減らせそうな箇所」の文（2026-10-17・UX レビュー #2・設計レビュー #2）。
 *
 * **判定は `ResultFigures` だけから読む。** 以前は旧 `householdHeadline`（過剰の閾値が上端の1.5倍）で
 * 出し分けており、ヒーローが「減らせる可能性」でも下段は「減らせる箇所は見つかりませんでした」、
 * 組み替えの世帯では減額の案内だけで配偶者の不足に触れない、ということが起きた。
 * さらに不足の案内が「お勤め先の団体保険」固定で、自営・フリーランスの人には実行できなかった。
 *
 * ここは人ごとの過不足の判定（過不足軸）から、人ごとの行動を1文ずつ組み立てる。
 * 金額は `figures.ts` の差額の幅を文字にするだけ。商品名・会社名は出さない（CLAUDE.md）。
 */
import type { DeathFigures, ResultFigures } from "../../src/calc/figures.js";
import type { Employment } from "../../src/calc/types.js";
import { formatRange } from "../../src/design/tokens.js";

const WHO: Record<DeathFigures["who"], string> = { self: "あなた", spouse: "配偶者" };

function people(f: ResultFigures): DeathFigures[] {
  return [f.self, ...(f.spouse ? [f.spouse] : [])];
}

/**
 * 不足の備え方の入口。**その人（被保険者）の働き方で変える。**
 * 団体保険は勤め先がある人にしか無いので、会社員以外には出さない。
 */
function shortageHow(employment: Employment): string {
  return employment === "employee"
    ? "まず、お勤め先に団体保険（会社を通じて入れる保険）があるかを、総務・人事の窓口で確かめられます。"
    : "まず、いま入っている保険と共済を書き出してください。そのうえで、保険会社や共済の窓口で、この幅の死亡保障で足りるかを相談できます。";
}

export function nextStepLines(
  f: ResultFigures,
  employment: { self: Employment; spouse: Employment | null },
): string[] {
  const out: string[] = [];
  for (const x of people(f)) {
    const who = WHO[x.who];
    const range = formatRange(x.gap.low, x.gap.high);
    switch (x.verdict) {
      case "reducible":
        out.push(
          `${who}の死亡保障は、${range}減らせる余地がありそうです。契約している保険会社・代理店の窓口で「減額（保障を下げる）」の相談ができます。`,
        );
        break;
      case "shortage": {
        const emp = x.who === "self" ? employment.self : (employment.spouse ?? "none");
        out.push(`${who}の死亡保障は、${range}足りない可能性があります。${shortageHow(emp)}`);
        break;
      }
      case "uncertain":
        out.push(
          `${who}の死亡保障は必要額の幅の中にあり、増やす・減らすのどちらとも言い切れません。答えた区分を具体的な値で答え直すと、判定がはっきりします。`,
        );
        break;
      default:
        out.push(
          `${who}の保険内容が分からないため、過不足は出していません。保険証券が見つかったら、入力し直すと比べられます。`,
        );
    }
  }
  // 組み替え：減らす相談と足す相談を別々の話にしない（ADR-007c の言い方の範囲で）
  if (f.household.verdict === "rebalanceable") {
    out.push(
      "減らす相談と足りない分の相談は、合計の保険料を増やさずに整える話として一度にできます。",
    );
  }
  return out;
}

/** 「もっと知りたい：保険を選ぶときの基準」を出すか。動かす理由がある人がいるときだけ */
export function hasActionableGap(f: ResultFigures): boolean {
  return people(f).some((x) => x.verdict === "reducible" || x.verdict === "shortage");
}

/**
 * 「減らせそうな箇所」の1文（CLAUDE.md「出力に必ず含めること」）。
 * 減らせる人がいなければ null（画面は「見つかりませんでした」と明示する）。
 */
export function reducibleSentence(f: ResultFigures): string | null {
  const parts = people(f).filter((x) => x.verdict === "reducible");
  if (parts.length === 0) return null;
  return `${parts.map((x) => `${WHO[x.who]}の保障を${formatRange(x.gap.low, x.gap.high)}`).join("、")}減らせる余地があります。`;
}
