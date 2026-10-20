/**
 * AI言語化（T-07）─ スタブ実装
 *
 * 設計の核（CLAUDE.md / SPEC §5）：
 * - **AIには数値を書かせない**。`{{selfRange}}` のようなプレースホルダだけを出させ、
 *   算定結果を差し込むのはこちら側。これで数値は構造的に間違えようがなく、検査もしやすい。
 * - 生成テンプレに「プレースホルダ以外の生の数字」があれば **G-1 で不合格 → テンプレにフォールバック**。
 * - ここは AI の代わりの**スタブ**（APIキー無しで動く）。本番は narrateStub を実 LLM 呼び出しに差し替える。
 *   その際もこの「プレースホルダのみ／G-1 検査／フォールバック」の枠は変えない。
 */
import type { HouseholdDiagnosis } from "../calc/types.js";
import { formatMan, formatRange } from "../design/tokens.js";
import { checkGuardrails } from "./guard.js";
import type { PlaceholderValues } from "./stream.js";

const CONCLUSION: Record<string, string> = {
  all_covered: "足りています",
  reducible: "減らせる余地がありそうです",
  rebalanceable: "世帯全体で見直せそうです",
  shortage: "足りない可能性があります",
  // 以下2つは結果画面が最終の必要額から結論を書き戻したときだけ来る（src/calc/figures.ts）
  uncertain: "いまの保障は必要額の幅の中にあり、多い・少ないは言い切れません",
  pending: "過不足はまだ出していません",
};

/**
 * テンプレに差し込む値（数値はここでだけ作る＝算定結果由来）。
 * ストリーミング表示ではクライアント側が1文字ずつ差し込むので、この map だけを渡す。
 */
/**
 * 差額は**世帯単位**で取る。
 *
 * 結論（{{conclusion}}）は世帯全体で出しているのに、差額を本人だけから取っていたため、
 * 「配偶者側に余剰があって世帯としては減らせる」世帯で **「0万円ほど減らせる」** という
 * 壊れた文が出ていた（2026-08-30 の実物レビューで発覚）。結論と同じ粒度で揃える。
 */
function householdGapAmount(d: HouseholdDiagnosis): string {
  const h = d.householdHeadline;
  /**
   * **幅があれば幅で出す**（2026-10-17・UX）。結果画面は差額を幅で出しているので、
   * よみときだけ下端の1点を言うと、同じ差額が2つの形で出る
   */
  const r =
    h.kind === "shortage"
      ? h.totalShortageRange
      : h.kind === "reducible" || h.kind === "rebalanceable"
        ? h.totalExcessRange
        : undefined;
  if (r) return formatRange(r.low, r.high);
  if (h.kind === "shortage") return formatMan(h.totalShortage);
  if (h.kind === "reducible" || h.kind === "rebalanceable") return formatMan(h.totalExcess);
  return formatMan(0);
}

export function placeholderValues(d: HouseholdDiagnosis): PlaceholderValues {
  return {
    conclusion: CONCLUSION[d.householdHeadline.kind] ?? "",
    selfRange: formatRange(d.self.range.low, d.self.range.high),
    gapAmount: householdGapAmount(d),
    // 年数も「数値」なので AI には書かせない。いつまで必要かが抜けると金額だけが独り歩きする
    yearsDependent: `約${d.self.years.dependent}年`,
    yearsAlone: `約${d.self.years.alone}年`,
  };
}

/** テンプレに差し込む（一括生成のとき用） */
export function fillPlaceholders(template: string, d: HouseholdDiagnosis): string {
  const map = placeholderValues(d);
  return template.replace(/\{\{([a-zA-Z]+)\}\}/g, (_, k: string) => map[k] ?? "");
}

/**
 * G-1（数値照合の核）：テンプレにプレースホルダ以外の「生の数字」が無いか。
 * AI が数字を書いたら true を返せないので、フォールバックへ回す。
 */
export function hasNoRawNumbers(template: string): boolean {
  const withoutPlaceholders = template.replace(/\{\{[a-zA-Z]+\}\}/g, "");
  // ローマ数字は NFKC で英字になるため、Unicode の数値文字は正規化前に止める。
  if (/\p{N}/u.test(withoutPlaceholders)) return false;
  const normalized = withoutPlaceholders.normalize("NFKC");
  if (ENGLISH_NUMBER.test(normalized)) return false;
  // 半角カナ・濁点・空白による表記の違いで数量が検査をすり抜けないようにする。
  const japanese = normalized
    .replace(/[ァ-ヴ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60))
    .replace(/\s+/gu, "");
  return !KANJI_NUMBER.some((re) => re.test(japanese)) && !KANA_NUMBER.test(japanese);
}

/**
 * 漢数字の数量（2026-10-17・QA）。算用数字だけ見ていたので「三千万円」が素通りしていた。
 *
 * **「万一」「一方」「十分」は数量ではない**ので、漢数字が1文字あるだけでは止めない。
 * 数量と言えるのは次のどれか（取りこぼすより、止めて定型文に退避するほうが安全）：
 *  - 数字＋位（三千・五百・一万・二十。大字も含む）
 *  - 「数」＋位（数百万・数千）
 *  - 漢数字の並び＋単位（百万円・三年・十歳・二割・五倍・三か月）
 * 検査はストリームの累積に掛かるので、チャンクをまたいで割れた金額も合流した時点で止まる。
 */
const KANJI_NUMBER: RegExp[] = [
  /[〇零一壱壹二弐貳三参參四肆五伍六陸七漆柒八捌九玖][十拾百佰陌千仟阡万萬億兆]/,
  /数[十拾百佰陌千仟阡万萬億兆]/,
  /[〇零一壱壹二弐貳三参參四肆五伍六陸七漆柒八捌九玖十拾百佰陌千仟阡万萬億兆]+(?:円|圓|えん|億|年|歳|割|倍|%|か月|ヶ月|ヵ月|人|個)/,
  // 「半年分」もエンジン由来でない具体的な期間なので、退避文に回す。
  /半(?:年|月|日|歳|割|分|か月|ヶ月|ヵ月)/,
];

// 漢字の単位まで続けると「老後に年金」「働く人」に当たるため、かなの位・単位に限る。
// 「サンゼンマン円」「ろっぴゃく円」は数詞の並びで止まる。
const KANA_NUMBER =
  /(?:ぜろ|れい|まる|いち|いっ|に|さん|し|よん|ご|ろく|ろっ|しち|なな|はち|はっ|く|きゅう|じゅう|じゅっ|じっ|ひゃく|びゃく|ぴゃく|せん|ぜん|まん|おく|ちょう|すう|はん)(?:じゅう|じゅっ|じっ|ひゃく|びゃく|ぴゃく|せん|ぜん|まん|おく|ちょう|えん|ねん|さい|わり|ばい|かげつ|こ|にん|ぱーせんと)/;

// 英語は単語単位で止める（someone / money などの語の一部には一致させない）。
// 数詞だけでも数量なので単位を要求せず、大文字・ハイフン区切りも検査する。
const ENGLISH_NUMBER =
  /\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|million|billion|trillion|half)\b/i;

/**
 * {{selfRange}} の呼び名は verdict で変える。**同じ数字ではないから。**
 * 収入が支出を上回る世帯でも「必要な保障額」と呼んでいたため、グラフ（支出＜収入）と
 * 文が矛盾して見えていた（2026-08-30 の実物レビューで発覚）。画面のラベルと同じ言い方にそろえる。
 */
function rangeSentence(d: HouseholdDiagnosis): string {
  /**
   * **レンジの呼び名は、レンジ全体の必要額の判定（ニーズ軸）で決める**（2026-10-17・QA で blocking）。
   * `d.self.verdict` は代表値1点の判定で、結果画面は `range` を回答の幅で包絡して書き戻している。
   * 代表値が `ample` でも厳しめ端が `shortage` なら、「上乗せの保障は要りません。葬儀・予備費の目安は
   * 約200〜1,500万円」のように、不足分を含むレンジを要らないお金と呼んでしまう
   */
  switch (d.self.rangeVerdict ?? d.self.verdict) {
    case "mixed":
      return "答えた区分のどこにあたるかで、上乗せの保障が要る場合と要らない場合があります。答えた区分の幅をすべて含めた必要額の目安は {{selfRange}} です";
    case "shortage":
      return "遺されたご家族に必要な保障の目安は {{selfRange}} です";
    case "ample":
      return "収入と資産で支出はまかなえる見込みで、上乗せの保障は要りません。葬儀・予備費の目安は {{selfRange}} です";
    case "not_needed":
      return "扶養するご家族がいないため、大きな保障は要りません。葬儀・予備費の目安は {{selfRange}} です";
    default:
      return "収入と資産で支出はまかなえる見込みです。万一の直後に手元に置いておく当座資金の目安は {{selfRange}} です";
  }
}

/** AI の代わりのスタブ。状況で文面を変えるが、数値は書かずプレースホルダだけ使う。 */
export function narrateStub(d: HouseholdDiagnosis): string {
  const range = rangeSentence(d);
  if (d.self.gap.kind === "pending") {
    return `いまの保険内容が分からないので、過不足はまだ出していません。あなたに万一のとき、${range}。証券が見つかったら、いまの保険と比べられます。`;
  }
  // 配偶者の保険だけ分からない：世帯の結論は判定済みの片方だけで出ているので、世帯として断定しない
  if (d.spouse?.gap.kind === "pending") {
    return `いまの前提では、${range}。${PENDING_TAIL}証券が見つかったら、いまの保険と比べられます。`;
  }
  switch (d.householdHeadline.kind) {
    case "shortage":
      return `いまの前提では、{{conclusion}}。${range}。いまの保険と比べると {{gapAmount}} ほど足りないかもしれません。お子さんの生活費と教育費が大きな部分です。あわてず、まずは前提を確かめてみてください。`;
    case "reducible":
      return `いまの前提では、{{conclusion}}。${range}。世帯全体で見ると、いまの保険は {{gapAmount}} ほど減らせる余地がありそうで、保険料が浮くのは良い知らせです。`;
    case "rebalanceable":
      return `いまの前提では、{{conclusion}}。${range}。ご夫婦のどちらかが多め・どちらかが少なめなので、世帯全体で、合計の保険料も確認しながら備え方を検討できます。`;
    case "uncertain":
      // 圏内：多い・少ないを言い切らない（G-4 に触れる「足りない」も使わない）
      return `いまの前提では、${range}。{{conclusion}}。答えた区分の幅や推定で補った項目がはっきりすると、判定も定まります。`;
    default:
      return `いまの前提では、{{conclusion}}。${range}。いまの備えで大きな不足はなさそうです。`;
  }
}

export interface Narration {
  text: string;
  /** ai=実LLM生成が検査を通った / ai-stub=スタブ生成が通った / fallback=生数字混入などでテンプレに退避 */
  source: "ai" | "ai-stub" | "fallback";
}

const PENDING_TAIL = "保険内容が分からない方がいるため、世帯全体の過不足はまだ出していません。";

function hasPending(d: HouseholdDiagnosis): boolean {
  return d.self.gap.kind === "pending" || d.spouse?.gap.kind === "pending";
}

const FALLBACK_TAIL: Record<string, string> = {
  all_covered: "いまの備えで大きな不足はなさそうです。",
  reducible: "世帯全体で見ると、いまの保険は減らせる余地がありそうです。",
  rebalanceable: "世帯全体で見直せそうです。",
  shortage: "いまの備えでは足りない可能性があります。",
  uncertain: "いまの保障は必要額の幅の中にあり、多い・少ないは言い切れません。",
};

/**
 * 検査に落ちたとき・AIを止めたときの退避文（実LLM側からも使う）。
 * **ここがいちばん正直でないと困る** ─ AI が落ちた場面で読者が見るのはこの文なので、
 * 金額の呼び名はスタブ・画面と同じ言い方にそろえる。
 */
export function fallbackNarration(d: HouseholdDiagnosis): Narration {
  // 保険内容が分からない人がいるなら、過不足は保留と書く。世帯の結論は判定済みの人だけで
  // 出ているので、そのまま使うと「不足はなさそう」と断定してしまう（2026-10-17・QA）
  const tail = hasPending(d)
    ? PENDING_TAIL
    : (FALLBACK_TAIL[d.householdHeadline.kind] ?? FALLBACK_TAIL.shortage);
  const fb = `いまの前提では、${rangeSentence(d)}。${tail}`;
  return { text: fillPlaceholders(fb, d), source: "fallback" };
}

export function narrate(d: HouseholdDiagnosis): Narration {
  const template = narrateStub(d);
  // G-1：生の数字が混ざったテンプレはフォールバック（差し込み前に検査）
  if (!hasNoRawNumbers(template)) return fallbackNarration(d);
  const text = fillPlaceholders(template, d);
  // G-2/G-4/G-6：差し込み済みテキストを検査。落ちたらフォールバック（本番は再生成→2回で退避）。
  if (!checkGuardrails(text, d).passed) return fallbackNarration(d);
  return { text, source: "ai-stub" };
}
