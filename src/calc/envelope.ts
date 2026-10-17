/**
 * 両端の結果を1つのレンジに畳む（T-H・2026-09-23 オーナー裁定②）。
 *
 * **`[min(両端の low), max(両端の high)]` の包絡を取る。**
 * `max` だけだと下端の情報が落ちるし、端で**判定の枝が変わる**ことがあるので、
 * 単純に「緩め端の low と厳しめ端の high」を取ると**幅が潰れる**ことがある。
 *
 * 実例（GT-08 相当の世帯・生活費 ±2.5万/月）：
 * 緩め端 `sufficient` 400〜600万 ／ 厳しめ端 `shortage` 300〜400万。
 * 素直につなぐと 400〜400万になり、**厳しめに見たのに上端が下がる**。包絡なら 300〜600万。
 *
 * **数値をつなぐだけでは、一番大事な情報が消える。**
 * 「緩めに見れば足りている、厳しめに見れば足りない」という**判定の遷移**は、
 * 就労収入の感度文（`sensitivity.ts`）と同じ型で**文として出す**。
 */
import type { ParamSet } from "../params/index.js";
import type { RangeVerdict, Verdict } from "./types.js";
import { type DiagnoseInput, diagnose } from "./index.js";

export interface EnvelopeResult {
  /** 包絡した提示レンジ（円） */
  low: number;
  high: number;
  /**
   * 候補のうち**いちばん軽い／いちばん重い**必要額の判定（ニーズ軸）。
   *
   * 2026-10-17 まで `inputs[0]` / `inputs[1]` の判定をそのまま入れていたが、
   * 連動の候補（`extra`）のほうが重い判定を返す世帯がある（本人の年収は上端・配偶者は下端など）。
   * 端の2つだけで決めると、レンジは候補ぜんぶの包絡なのに、判定は一部の候補しか見ないことになる
   */
  verdictLoose: Verdict;
  verdictStrict: Verdict;
  /** **候補のあいだで判定が違うか。** 違うなら、数値だけでは伝わらないので文を添える */
  crossed: boolean;
  /** 端ごとの素の結果（画面と検査のため） */
  ends: Array<{ low: number; high: number; verdict: Verdict }>;
}

/**
 * 候補の入力すべてで回し、包絡を取る。
 *
 * 少なくとも2つ（緩め端・厳しめ端）が要る。**順序には意味を持たせない**（2026-10-17）。
 * 判定の遷移文は、候補ぜんぶの中のいちばん軽い判定と重い判定から作る。
 */
export function envelope(
  p: ParamSet,
  inputs: DiagnoseInput[],
  asOf: Date,
  who: "self" | "spouse" = "self",
): EnvelopeResult {
  if (inputs.length < 2) throw new Error("両端の入力が要る（緩め端・厳しめ端）");
  const ends = inputs.map((input) => {
    const d = diagnose(p, input, asOf);
    const r = who === "self" ? d.self : d.spouse;
    if (!r) throw new Error("配偶者のケースが無い");
    return { low: r.range.low, high: r.range.high, verdict: r.verdict };
  });

  const byWeight = [...ends].sort((a, b) => ORDER.indexOf(a.verdict) - ORDER.indexOf(b.verdict));
  const verdictLoose = byWeight[0].verdict;
  const verdictStrict = byWeight[byWeight.length - 1].verdict;
  return {
    low: Math.min(...ends.map((e) => e.low)),
    high: Math.max(...ends.map((e) => e.high)),
    verdictLoose,
    verdictStrict,
    crossed: verdictLoose !== verdictStrict,
    ends,
  };
}

/**
 * 最終の必要額（包絡したレンジ）を**どう呼ぶか**を決める必要額の判定（ニーズ軸）。
 * `mixed` は「答えた区分のどこにあたるかで、上乗せが要る場合と要らない場合がある」。
 *
 * **代表値の判定でレンジ全体を呼ばない**（2026-10-17・QA で blocking）。
 * 代表値が `ample`（葬儀・予備費だけ）でも、厳しめ端が `shortage` なら、
 * 包絡したレンジの上側は**足りない額**であって葬儀・予備費ではない。
 * 代表値の判定で「上乗せの保障は要りません。葬儀・予備費の目安は 約200〜1,500万円」と言うと、
 * レンジの中に不足分があるのに、それを要らないお金と呼んでしまう。
 *
 * - 幅が無い（`band` が null）→ 代表値の判定のまま
 * - 候補の中に `shortage` とそれ以外が混ざる → `mixed`
 * - それ以外（どれも上乗せは要らない）→ いちばん重い判定。
 *   `ample`（葬儀・予備費）と `sufficient`（当座資金）が混ざるなら、広いほうの呼び名で全体を呼ぶ
 */
export function rangeVerdict(point: Verdict, band: EnvelopeResult | null): RangeVerdict {
  if (!band) return point;
  const vs = new Set(band.ends.map((e) => e.verdict));
  if (vs.has("shortage") && vs.size > 1) return "mixed";
  return band.verdictStrict;
}

/**
 * 判定が端で違うときの一文（感度文の型の再利用・2026-09-23 オーナー裁定）。
 *
 * 型は既存の感度文（`sensitivity.ts` ＋ 画面の `sensitivityFor`）に合わせる。
 * ①**何がこの幅を作っているか** → ②**緩め／厳しめで結論がどう変わるか**（ラベルは enum をバインド）。
 *
 * **2段跨ぎ（あいだに別の判定が入る）だけ、落ちる情報が違う。**
 * 両端だけ書くと「あいだがある」ことが消えるので、**あいだの判定も1文に入れる**。
 * さらに「幅が何で狭まるか」を**事実として**添える（指示形にしない＝「確かめてください」とは書かない）。
 *
 * **数値は書かない。** 金額は画面が算定結果から描く（AIにもここにも金額を作らせない）。
 */
export function crossingNote(
  r: EnvelopeResult,
  /** この幅を作っている回答の名前（例「配偶者の年収『400万円未満』」）。分からなければ省く */
  driver?: string,
): string | null {
  if (!r.crossed) return null;
  const say = (v: Verdict): string => VERDICT_WORD[v];
  /**
   * **原因の回答を名指しできない世帯がある**（2026-09-23）。
   * どれか1つの答えを厳しめ端に振っても判定が変わらず、**いくつかの幅が重なって**跨ぐ場合で、
   * そこで無理に1つ名前を出すと推測になる。**名前の代わりに「重なっている」という事実を言う。**
   */
  const lead = driver
    ? `この幅は、答えの幅（${driver}）から来ています。`
    : "この幅は、いくつかの答えの幅が重なって生まれています。";
  const ends = `緩めに見ると「${say(r.verdictLoose)}」、厳しめに見ると「${say(r.verdictStrict)}」です。`;

  const middle = middleVerdict(r);
  if (!middle) return `${lead}${ends}`;

  // 2段跨ぎ：あいだの判定と、幅が狭まる条件を事実として添える
  const between = `あいだには「${say(middle)}」も入ります。`;
  const narrows = driver ? `この幅は、${driverSubject(driver)}がはっきりすると狭まります。` : "";
  return `${lead}${ends}${between}${narrows}`;
}

/** 判定の言い方。**バッジと同じ enum からバインドする**（手打ちで再入力しない） */
const VERDICT_WORD: Record<Verdict, string> = {
  shortage: "上乗せが要る",
  sufficient: "いまの蓄えで受けられる",
  ample: "上乗せは要らない",
  not_needed: "保障そのものが要らない",
};

/** 必要額の判定を、軽い順に並べたもの（あいだに何が入るかを出すため） */
const ORDER: Verdict[] = ["not_needed", "ample", "sufficient", "shortage"];

/**
 * 2段跨ぎのとき、あいだに入る判定を返す。1段なら `null`。
 * **順序はニーズ軸の重さ**（必要額が出ない側から、上乗せが要る側へ）。
 */
function middleVerdict(r: EnvelopeResult): Verdict | null {
  const a = ORDER.indexOf(r.verdictLoose);
  const b = ORDER.indexOf(r.verdictStrict);
  if (a < 0 || b < 0) return null;
  const [lo, hi] = a < b ? [a, b] : [b, a];
  if (hi - lo < 2) return null;
  return ORDER[lo + 1];
}

/** 「配偶者の年収『400万円未満』」→「配偶者の年収」。文の後半で言い直すため */
function driverSubject(driver: string): string {
  const i = driver.indexOf("「");
  return i > 0 ? driver.slice(0, i) : driver;
}
