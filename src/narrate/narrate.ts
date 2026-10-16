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
function householdGapAmount(d: HouseholdDiagnosis): number {
  const h = d.householdHeadline;
  if (h.kind === "shortage") return h.totalShortage;
  if (h.kind === "reducible" || h.kind === "rebalanceable") return h.totalExcess;
  return 0;
}

export function placeholderValues(d: HouseholdDiagnosis): PlaceholderValues {
  return {
    conclusion: CONCLUSION[d.householdHeadline.kind] ?? "",
    selfRange: formatRange(d.self.range.low, d.self.range.high),
    gapAmount: formatMan(householdGapAmount(d)),
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
  if (/[0-9０-９]/.test(withoutPlaceholders)) return false;
  return !KANJI_NUMBER.some((re) => re.test(withoutPlaceholders));
}

/**
 * 漢数字の数量（2026-10-17・QA）。算用数字だけ見ていたので「三千万円」が素通りしていた。
 *
 * **「万一」「一方」「十分」は数量ではない**ので、漢数字が1文字あるだけでは止めない。
 * 数量と言えるのは次のどれか（取りこぼすより、止めて定型文に退避するほうが安全）：
 *  - 数字＋位（三千・五百・一万・二十）
 *  - 「数」＋位（数百万・数千）
 *  - 漢数字の並び＋単位（百万円・三年・十歳・二割・五倍・三か月）
 * 検査はストリームの累積に掛かるので、チャンクをまたいで割れた金額も合流した時点で止まる。
 */
const KANJI_NUMBER: RegExp[] = [
  /[〇一二三四五六七八九][十百千万億]/,
  /数[十百千万億]/,
  /[〇一二三四五六七八九十百千万億]+(?:円|億|年|歳|割|倍|％|%|か月|ヶ月|カ月|ヵ月)/,
];

/**
 * {{selfRange}} の呼び名は verdict で変える。**同じ数字ではないから。**
 * 収入が支出を上回る世帯でも「必要な保障額」と呼んでいたため、グラフ（支出＜収入）と
 * 文が矛盾して見えていた（2026-08-30 の実物レビューで発覚）。画面のラベルと同じ言い方にそろえる。
 */
function rangeSentence(d: HouseholdDiagnosis): string {
  switch (d.self.verdict) {
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
  const pending = d.self.gap.kind === "pending";
  if (pending) {
    return `いまの保険内容が分からないので、過不足はまだ出していません。あなたに万一のとき、${range}。証券が見つかったら、いまの保険と比べられます。`;
  }
  switch (d.householdHeadline.kind) {
    case "shortage":
      return `いまの前提では、{{conclusion}}。${range}。いまの保険と比べると {{gapAmount}} ほど足りないかもしれません。お子さんの生活費と教育費が大きな部分です。あわてず、まずは前提を確かめてみてください。`;
    case "reducible":
      return `いまの前提では、{{conclusion}}。${range}。世帯全体で見ると、いまの保険は {{gapAmount}} ほど減らせる余地がありそうで、保険料が浮くのは良い知らせです。`;
    case "rebalanceable":
      return `いまの前提では、{{conclusion}}。${range}。ご夫婦のどちらかが多め・どちらかが少なめなので、世帯全体で見ると合計の保険料を増やさずに整えられそうです。`;
    default:
      return `いまの前提では、{{conclusion}}。${range}。いまの備えで大きな不足はなさそうです。`;
  }
}

export interface Narration {
  text: string;
  /** ai=実LLM生成が検査を通った / ai-stub=スタブ生成が通った / fallback=生数字混入などでテンプレに退避 */
  source: "ai" | "ai-stub" | "fallback";
}

const FALLBACK_TAIL: Record<string, string> = {
  all_covered: "いまの備えで大きな不足はなさそうです。",
  reducible: "世帯全体で見ると、いまの保険は減らせる余地がありそうです。",
  rebalanceable: "世帯全体で見直せそうです。",
  shortage: "いまの備えでは足りない可能性があります。",
};

/**
 * 検査に落ちたとき・AIを止めたときの退避文（実LLM側からも使う）。
 * **ここがいちばん正直でないと困る** ─ AI が落ちた場面で読者が見るのはこの文なので、
 * 金額の呼び名はスタブ・画面と同じ言い方にそろえる。
 */
export function fallbackNarration(d: HouseholdDiagnosis): Narration {
  const tail = FALLBACK_TAIL[d.householdHeadline.kind] ?? FALLBACK_TAIL.shortage;
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
