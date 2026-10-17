/**
 * 結果画面の最初の2画面（結論・次の一歩・決定的な前提1点）の文と行（2026-10-17・最初の2画面の作り直し）。
 *
 * 移植元の資料：`design-inbox/2026-10-17_UX_REVIEW_result.md` の §5（並べ直し案）と §6（文章の直し）。
 *
 * **金額は `ResultFigures`（src/calc/figures.ts）からだけ取る。** ここは幅を文字にするだけで、
 * 引き算も合計もしない。**2人分を足した不足額は出さない**（オーナーへの判断カードの推奨どおり、人ごとに出す）。
 *
 * 軸名（CLAUDE.md）：ここで扱う判定は**過不足の判定（過不足軸・`Verdict3`）**。
 * ラベルはバッジと同じ表（`DEATH_LABEL`）を引く。
 *
 * **次の一歩は保険会社・代理店・窓口へ誘導しない**（`nextStep.test.ts` と同じ規則・UX レビュー1回目 #2）。
 * §6-9 の「保険の窓口や共済で相談できます」は採らない。
 */
import type { DeathFigures, ResultFigures } from "../../src/calc/figures.js";
import type { Employment } from "../../src/calc/types.js";
import type { Verdict3 } from "../../src/calc/verdict3.js";
import type { SurvivorIncomeSensitivity } from "../../src/calc/sensitivity.js";
import { formatRange } from "../../src/design/tokens.js";
import { sensitivityMove } from "./sensitivityText.js";
import { DEATH_LABEL } from "./verdictLabels.js";

const WHO: Record<DeathFigures["who"], string> = { self: "あなた", spouse: "配偶者" };

function people(f: ResultFigures): DeathFigures[] {
  return [f.self, ...(f.spouse ? [f.spouse] : [])];
}

/** 判定の見た目（色チャンネル）。バッジと人ごとの行で共有する */
export const VERDICT_TONE: Record<Verdict3, "ok" | "check" | "short" | "none"> = {
  reducible: "ok",
  uncertain: "check",
  shortage: "short",
  pending: "none",
};

/**
 * 判定のアイコン（判定は「アイコン＋ラベル＋色」の3点で出す・CLAUDE.md）。
 * 記号は読み上げない（ラベルが同じ意味を持つ）。
 */
export const VERDICT_ICON: Record<Verdict3, string> = {
  reducible: "↓",
  uncertain: "≒",
  shortage: "!",
  pending: "?",
};

/** 結論の見出し（1文）。**金額を入れない** ── 金額は人ごとの行の独立した大きな数字が持つ（DoD (b)） */
export function conclusionHeadline(f: ResultFigures): string {
  const ps = people(f);
  if (ps.length === 1) {
    switch (ps[0].verdict) {
      case "reducible":
        return "いまの保障は、必要額より多めです";
      case "shortage":
        return "いまの保障では、足りない可能性があります";
      case "uncertain":
        return "いまの保障は、必要額の幅の中にあります";
      default:
        return "いまの保障が分からないため、過不足はまだ出していません";
    }
  }
  const [a, b] = ps;
  if (a.verdict === b.verdict) {
    switch (a.verdict) {
      case "reducible":
        return "あなたも配偶者も、保障は多めです";
      case "shortage":
        return "あなたにも配偶者にも、足りない可能性があります";
      case "uncertain":
        return "あなたも配偶者も、保障は必要額の幅の中です";
      default:
        return "保険内容が分からないため、過不足はまだ出していません";
    }
  }
  const word: Record<Verdict3, string> = {
    reducible: "多め",
    shortage: "少なめ",
    uncertain: "必要額の幅の中",
    pending: "未入力",
  };
  return `あなたの保障は${word[a.verdict]}、配偶者の保障は${word[b.verdict]}です`;
}

/**
 * 見出しの下に添える1文（§6-2）。**全員の必要額が葬儀などの費用だけのとき**に、その理由を言う。
 * 呼び名は最終の必要額の必要額の判定（ニーズ軸・`needVerdict`）で選ぶ。代表値の判定では言わない。
 */
export function conclusionReason(f: ResultFigures): string | null {
  const ps = people(f);
  if (ps.every((x) => x.needVerdict === "ample"))
    return "遺族年金と貯蓄で、生活費はまかなえる見込みです。保険で備えたいのは葬儀などの費用です。";
  if (ps.every((x) => x.needVerdict === "not_needed"))
    return "扶養しているご家族がいないため、見込むのは葬儀などの費用だけです。";
  return null;
}

/** 人ごとの行（あなた／配偶者）。すべてレンジ。単身は1行 */
export interface PersonRow {
  who: DeathFigures["who"];
  /** 「あなたに万一のとき」 */
  title: string;
  verdict: Verdict3;
  /** バッジの文言（`DEATH_LABEL`。手打ちしない） */
  verdictLabel: string;
  /** 主金額（大きな独立した数字）の呼び名 */
  mainLabel: string;
  /** 主金額。減らせる・不足は差の幅、圏内・保留は必要額の幅 */
  mainText: string;
  /** 小さく並べる2つ（必要額・いまの保障）。主金額と同じものは出さない */
  subs: { label: string; text: string }[];
  /** 数直線の値（円） */
  needLow: number;
  needHigh: number;
  coverage: number | null;
}

export function personRows(f: ResultFigures): PersonRow[] {
  return people(f).map((x) => {
    const need = formatRange(x.need.low, x.need.high);
    const cov = x.coverage === null ? "未入力" : formatRange(x.coverage, x.coverage);
    const base = {
      who: x.who,
      title: x.who === "self" ? "あなたに万一のとき" : "配偶者に万一のとき",
      verdict: x.verdict,
      verdictLabel: DEATH_LABEL[x.verdict],
      needLow: x.need.low,
      needHigh: x.need.high,
      coverage: x.coverage,
    };
    if (x.gap.kind === "reducible" || x.gap.kind === "shortage") {
      return {
        ...base,
        mainLabel: x.gap.kind === "reducible" ? "必要額を上回っている分" : "必要額に足りない分",
        mainText: formatRange(x.gap.low, x.gap.high),
        // いまの保障が0円なら差は必要額そのもの。同じ幅を2回並べない
        subs:
          x.gap.low === x.need.low && x.gap.high === x.need.high
            ? [{ label: "いまの保障", text: cov }]
            : [
                { label: "必要額", text: need },
                { label: "いまの保障", text: cov },
              ],
      };
    }
    return {
      ...base,
      mainLabel: "必要額",
      mainText: need,
      subs: [{ label: "いまの保障", text: cov }],
    };
  });
}

/**
 * 減らせる箇所が1つも無いときの1文（CLAUDE.md「出力に必ず含めること」）。
 * 減らせる人がいれば、その差の幅は人ごとの行の主金額として出ているので null（同じ事実を2回出さない）。
 */
export function noReducibleSentence(f: ResultFigures): string | null {
  return people(f).some((x) => x.verdict === "reducible")
    ? null
    : "減らせる箇所は、いまの前提では見つかりませんでした。";
}

/**
 * 次の一歩（1つ）。**判定の組み合わせから組み立てる1文**（§5-2）。
 *
 * - 相談先（保険会社・代理店・窓口）を名指さない。確認の行動にとどめる
 * - 団体保険（勤め先）を出すのは、不足している人が会社員のときだけ
 * - 「推定で補った項目を答え直す」は、推定が1件以上あるときだけ（§指摘「推定0件で定型文」）
 * - 金額は書かない。行動に要る数字は、すぐ上の人ごとの行にある
 */
export function nextStepSentence(
  f: ResultFigures,
  employment: { self: Employment; spouse: Employment | null },
  estimatedCount: number,
): string {
  const ps = people(f);
  const short = ps.filter((x) => x.verdict === "shortage");
  const reducible = ps.filter((x) => x.verdict === "reducible");
  const names = (xs: DeathFigures[]) => xs.map((x) => WHO[x.who]).join("と");
  const empOf = (x: DeathFigures) =>
    x.who === "self" ? employment.self : (employment.spouse ?? "none");

  if (short.length > 0 && reducible.length > 0) {
    return `いま入っている保険と共済の保障額を書き出し、${names(reducible)}の多めの分と${names(short)}の足りない分を、一度に確かめてください。`;
  }
  if (short.length > 0) {
    const group = short.some((x) => empOf(x) === "employee")
      ? "（お勤め先の団体保険も含めて）"
      : "";
    return `いま入っている保険と共済${group}を書き出し、${names(short)}の死亡保障が必要額に届いているかを確かめてください。`;
  }
  if (reducible.length > 0) {
    return estimatedCount > 0
      ? "見直す前に、契約内容（保障額・期間・更新の時期）を確かめ、推定で補った項目を実際の値で答え直してください。"
      : "見直す前に、契約内容（保障額・期間・更新の時期）を確かめてください。";
  }
  if (ps.some((x) => x.verdict === "uncertain")) {
    return "答えた区分を具体的な値で答え直すと、過不足の判定がはっきりします。";
  }
  return "保険証券で死亡保障の額を確かめて入力し直すと、過不足を比べられます。";
}

/**
 * 結論を決めている前提（1点）。**図1つ＋感度文1つ**（CLAUDE.md「開示の見せ方」・§5-3）。
 *
 * - 配偶者がいる世帯：本人に万一のときの**配偶者の就労収入**（組み替え＝回答の年収、不足＝当社基準の見立て）
 * - 単身：**扶養しているご家族がいないこと**。図は「いまの保障」と「必要額」の内訳。
 *   必要額の中身は配偶者の有無ではなくエンジンの支出内訳で呼ぶ（団信なしの住宅ローンは必要額に入る・PR #5 の QA）
 *
 * 金額はすべて `ResultFigures` と感度（`survivorIncomeSensitivity`）から来る。ここで作らない。
 */
export type KeyPremise =
  | {
      kind: "work";
      title: string;
      /** 見込んだ収入・資産の合計と、そのうち就労収入（円） */
      incomeTotal: number;
      work: number;
      /** 当社基準の見立てか（答えた年収が0円） */
      estimated: boolean;
      text: string;
    }
  | {
      kind: "single";
      title: string;
      coverage: number | null;
      need: { low: number; high: number };
      /** 必要額の呼び名。団信なしの住宅ローンを含むかで変わる */
      needLabel: string;
      text: string;
    };

export function keyPremise(
  f: ResultFigures,
  sv: SurvivorIncomeSensitivity | null,
  /** 当社基準で補った就労収入の前提（`estimates.ts`）があるか */
  estimated: boolean,
): KeyPremise | null {
  const x = f.self;
  if (!f.spouse) {
    // 団信なしのローンが必要額に残るのは、資産で消し切れず必要額の判定（ニーズ軸）が `not_needed` を外れたとき。
    // `not_needed` なら必要額は葬儀・予備費の床なので、そのときは葬儀費用だけと言ってよい（`calcDeath`）。
    // ローン残高は回答の幅の軸なので、代表値の額はここに書かない（幅の両端と食い違う）。呼び名だけを分ける
    const withLoan = x.point.expense.housing > 0 && x.needVerdict !== "not_needed";
    return {
      kind: "single",
      title: "扶養しているご家族がいないこと",
      coverage: x.coverage,
      need: x.need,
      needLabel: withLoan ? "必要額（葬儀などの費用と住宅ローンの残り）" : "必要額（葬儀などの費用）",
      text: withLoan
        ? "見込んでいるのは、葬儀などの費用と、団信で返されない住宅ローンの残りです。扶養するご家族ができたら、遺族の生活費が加わるので答え直してください。"
        : "見込んでいるのは葬儀などの費用だけです。扶養するご家族ができたら、遺族の生活費が加わるので答え直してください。",
    };
  }
  const work = x.point.income.survivorWork;
  if (work <= 0) return null;
  const lead = estimated
    ? "配偶者がいずれ働く前提で、この就労収入を見込んでいます（当社の見立て）。"
    : "配偶者が働き続ける前提で、この就労収入を見込んでいます。";
  const move = sv
    ? sensitivityMove(sv)
    : x.needVerdict === "shortage"
      ? "働かない場合は、その分だけ不足が増えます。"
      : "働かない場合は、必要額が増えることがあります。";
  return {
    kind: "work",
    title: estimated ? "配偶者の就労収入（当社の見立て）" : "配偶者の就労収入",
    incomeTotal: x.point.income.total,
    work,
    estimated,
    text: `${lead}${move}`,
  };
}
