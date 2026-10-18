/**
 * 算定エンジンの型定義
 *
 * 設計原則（ADR-003）：金額はここでしか作らない。AIは翻訳者であり、数値を生成しない。
 * この層は外部サービスに一切依存しない純粋関数として保つ（NFR-13 / 可搬性）。
 */

export type Employment = "employee" | "self" | "none";
export type EducationPlan = "public" | "mixed" | "private";

/** 世帯の入力。すべてレンジ中央値に正規化された後の値（DR-02） */
export interface Household {
  /** 亡くなるケースを算定する側 */
  deceased: Person;
  /** 遺される側。独身なら null */
  survivor: Person | null;
  /**
   * 前提の文面で遺族をどう呼ぶか。**本人が亡くなるケースなら「遺されたご家族」、
   * 配偶者が亡くなるケースなら「あなた」。**
   * `calcDeath` はどちらのケースで呼ばれたかを知らないので、呼び出し側が渡す
   * （ここを固定文にすると、配偶者死亡のカードで「配偶者が働き続ける」と事実が逆になる）。
   */
  survivorLabel?: string;
  /** 子の現在年齢 */
  children: number[];
  housing: Housing;
  /** 世帯の金融資産（円） */
  assets: number;
  /** 月間生活費（円）。賃貸の家賃はここに含む */
  monthlyLiving: number;
  educationPlan: EducationPlan;
  /** 現在の保障額（円）。不明なら null → 過不足判定を pending にする（FR-14） */
  currentCoverage: number | null;
  /**
   * 暮らし方の目盛り（D-02・ADR-022）。`0.9` / `1.0`（既定） / `1.1`。
   * **率（0.70 / 0.50）とは別の変数**。率は人数、これは暮らし方の選好。
   * 省略時は 1.0 で、出力は一切変わらない（ゴールデンの期待値は不変）。
   */
  lifestyleDial?: number;
}

export interface Person {
  age: number;
  /** 年収（円） */
  income: number;
  employment: Employment;
  /**
   * 雇用保険（基本手当）の対象か。省略時は `employment === "employee"` で決める。
   * **公務員は年金では `employee` だが、雇用保険の対象外**なので、ここで分けて持つ（2026-10-16）。
   */
  unemploymentInsured?: boolean;
  /**
   * 遺族になったときに就労収入を見込む年齢の上限（この年齢になった年から入れない）。
   * 省略時は params の `survivorWorkEndAge`（当社基準・既定60歳・ADR-030）。
   * 結果画面の「65歳まで働く場合」の比較だけが `pensionAge` を入れる
   */
  workEndAge?: number;
  /**
   * 診断した時点の年齢。もしもラボが年齢を先へ進めたときだけ入る（`labInput`）。
   * 「すでに60歳以上で働いている」の例外は、進めた年齢ではなくこの年齢で決める
   * （進めた年齢で決めると、60歳で止まるはずの就労収入が65歳まで戻る・PR #32 の QA）
   */
  diagnosedAge?: number;
  /**
   * 遺族になったあと働かないことを**明示**したか（もしもラボの「ゼロ」・感度の「働けない場合」）。
   * true なら当社基準の下限（独立後 年100万円）も置かない。年収0円の回答とは意味が違う
   */
  noWork?: boolean;
}

export interface Housing {
  type: "own" | "rent";
  /** 住宅ローン残高（円） */
  loan?: number;
  /** 団体信用生命保険の有無。「分からない」は true 扱いにし、結果に併記する（§9-6） */
  danshin?: boolean;
}

/**
 * 包絡したレンジの呼び名に使う必要額の判定（ニーズ軸）。
 * `mixed` は、答えた区分のどこにあたるかで上乗せの保障が要る場合と要らない場合があること（`envelope.ts` の `rangeVerdict`）
 */
export type RangeVerdict = Verdict | "mixed";

export type Verdict =
  /** 不足している */
  | "shortage"
  /** 計算上は充足。安心の上乗せ目安を提示 */
  | "sufficient"
  /** 余剰が大きい。上乗せも不要と言い切る（煽らない） */
  | "ample"
  /** 扶養家族がいない。保障そのものが不要 */
  | "not_needed";

export type CoverageGapKind = "shortage" | "adequate" | "excess" | "pending";

export interface DeathResult {
  /** 支出見込 */
  expense: {
    livingChild: number;
    livingAlone: number;
    education: number;
    housing: number;
    funeral: number;
    total: number;
  };
  /** 収入・資産見込 */
  income: {
    pensionBasic: number;
    pensionKosei: number;
    chukoreiKafu: number;
    survivorWork: number;
    assets: number;
    total: number;
  };
  /** 期間 */
  years: { dependent: number; alone: number; total: number };
  /** 差引きの必要額（丸め前・円） */
  rawNeed: number;
  /** 余剰（収入 − 支出） */
  margin: number;
  /** 提示レンジ（円・100万円丸め） */
  range: { low: number; high: number };
  verdict: Verdict;
  /**
   * `range` をどう呼ぶかの必要額の判定（ニーズ軸）。結果画面が `range` を回答の幅で包絡して
   * 書き戻したときだけ付く（`src/calc/figures.ts`）。無ければ `verdict` と同じ意味。
   * **`verdict` は代表値1点の判定のまま**（内訳の呼び名に使う）なので、レンジの呼び名にはこちらを使う
   */
  rangeVerdict?: RangeVerdict;
  /** 現在の保障との比較 */
  gap: { kind: CoverageGapKind; amount: number };
  /** 欠損を既定値で補った記録（DR-03 / 結果画面に表示する） */
  assumptions: Assumption[];
}

export interface Assumption {
  field: string;
  /**
   * 拾い読みのための見出し語（数語）。**画面ではなくここで持つ**
   * ── 式を変えたときに文だけ古いまま残るのを防ぐ。
   * 見出し語が無いと、前提の一覧は全部読まないと何の話か分からない壁になる。
   */
  label?: string;
  value: string | number;
  reason: "estimated" | "default" | "unknown";
  note: string;
}

export type MedicalVerdict = "self_insurable" | "partial" | "needed";

export interface MedicalResult {
  category: string;
  /** 月額自己負担上限（円） */
  monthlyCap: number;
  /** 標準入院時の想定自己負担（円） */
  burdenStandard: number;
  /** 長期化時の想定自己負担（円） */
  burdenLong: number;
  assets: number;
  verdict: MedicalVerdict;
}

/** 世帯単位の診断結果（ADR-007） */
export interface HouseholdDiagnosis {
  paramVersion: string;
  /** 本人が亡くなるケース */
  self: DeathResult;
  /** 配偶者が亡くなるケース。独身・配偶者未入力なら null */
  spouse: DeathResult | null;
  medical: MedicalResult;
  /** 2028年改正の該当判定（FR-17） */
  reform2028: { applicable: boolean; reason: string };
  /** 世帯としての結論（FR-25）。self / spouse を1行に畳んだもの */
  householdHeadline: HouseholdHeadline;
}

export interface HouseholdHeadline {
  kind: /** どちらも足りている */
    | "all_covered"
    /** 世帯として不足がある */
    | "shortage"
    /** 減らせる箇所がある */
    | "reducible"
    /** 片方が過剰・片方が不足＝合計保険料を増やさずに解決できる（ADR-007c） */
    | "rebalanceable"
    /**
     * 必要額の幅がいまの保障を跨いでいる（過不足軸の「圏内・要精査」）。
     * **`headline()` は返さない。** 結果画面が最終の必要額から結論を書き戻すとき（`figures.ts`）だけ使う
     */
    | "uncertain"
    /** だれの保障も分からないので過不足を出していない。`figures.ts` だけが使う */
    | "pending";
  /** 世帯合計の減額余地（円） */
  totalExcess: number;
  /** 世帯合計の不足（円） */
  totalShortage: number;
  /**
   * 減らせる額・不足額の幅（円）。`figures.ts` が最終の必要額から書き戻すときだけ入る。
   * よみときは、あればこちらを幅で出す（1点で「約400万円」と言わない・2026-10-17・UX）
   */
  totalExcessRange?: { low: number; high: number };
  totalShortageRange?: { low: number; high: number };
}
