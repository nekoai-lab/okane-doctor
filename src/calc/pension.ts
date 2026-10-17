/**
 * 公的年金の算定（遺族基礎年金・遺族厚生年金・中高齢寡婦加算）
 * 機能仕様書 §4.2.5 に一致させること。
 */
import type { ParamSet } from "../params/index.js";
import { v } from "../params/index.js";
import type { Person } from "./types.js";

/** その年に受け取れる遺族基礎年金（18歳到達年度末まで在籍する子で計算） */
export function izokuKisoAnnual(p: ParamSet, childrenAges: number[]): number {
  const eligible = childrenAges.filter((a) => a < 18).length;
  if (eligible === 0) return 0;
  let add = 0;
  for (let i = 0; i < eligible; i++) {
    add += i < 2 ? v(p, "childAdd1_2") : v(p, "childAdd3plus");
  }
  return v(p, "izokuKisoBase") + add;
}

/**
 * 遺族厚生年金（年額）＝ 報酬比例部分 × 3/4
 * 報酬比例部分 ＝ 平均標準報酬額 × 5.481/1000 × 被保険者月数（300月みなし）
 * 自営・フリーランス（第1号）は 0。過去の会社員期間はMVPでは考慮しない。
 */
export function izokuKoseiAnnual(p: ParamSet, deceased: Person): number {
  if (deceased.employment === "self" || deceased.income <= 0) return 0;
  const avgMonthly = deceased.income / 12;
  const hoshuHirei = avgMonthly * v(p, "hoshuHireiCoef") * v(p, "minimumInsuredMonths");
  return hoshuHirei * v(p, "izokuKoseiRatio");
}

/**
 * 遺族厚生年金の受給想定年数（**現行制度**。2028年改正は `reform2028.ts` が「まだ反映していない」と開示している）。
 * 子あり → 算定期間いっぱい。
 * 子なし → 死亡時に配偶者が30歳未満なら5年、それ以外は算定期間いっぱい。
 *
 * ⚠ 当初は子なしを年齢に関係なく5年で打ち切っており、2028年改正を先取りしていた
 *    （画面の「改正前の制度で計算」と食い違い、30歳以上の子なし世帯で収入を過少にしていた。2026-10-17・QA）。
 */
export function koseiYears(
  p: ParamSet,
  hasChild: boolean,
  survivorAgeAtDeath: number,
  yearsTotal: number,
): number {
  if (hasChild) return yearsTotal;
  if (survivorAgeAtDeath >= v(p, "koseiShortTermAge")) return yearsTotal;
  return Math.min(v(p, "koseiShortTermYears"), yearsTotal);
}

/**
 * 中高齢寡婦加算の累計。
 *  ・子あり：遺族基礎年金の受給終了後〜65歳のうち、遺族が年齢要件を満たす各年
 *  ・子なし：死亡時に年齢要件を満たす場合のみ、算定期間にわたり加算
 *
 * ⚠ 当初実装は子なし世帯でも一律に加算しており、30代の配偶者に受給資格のない
 *    加算が乗っていた（10世帯テストで検出）。性別・年齢要件の細目は一次情報で要確認。
 */
export function chukoreiKafuTotal(
  p: ParamSet,
  survivor: Person,
  deceased: Person,
  children: number[],
  yearsTotal: number,
): number {
  const deceasedHasKosei = izokuKoseiAnnual(p, deceased) > 0;
  let total = 0;
  for (let t = 0; t < yearsTotal; t++) {
    total += chukoreiKafuAnnual(p, {
      deceasedHasKosei,
      survivorAgeAtDeath: survivor.age,
      survivorAgeNow: survivor.age + t,
      childrenAgesNow: children.map((a) => a + t),
      hasChildAtDeath: children.length > 0,
    });
  }
  return total;
}

/**
 * その年に受け取れる中高齢寡婦加算。
 *
 * 累計（`chukoreiKafuTotal`）はこれを年ごとに足したもの。**年次表と総額で式を分けない**ため、
 * 判定はここ1か所に置く（分けると、片方だけ直して静かにズレる）。
 */
export function chukoreiKafuAnnual(
  p: ParamSet,
  ctx: {
    /**
     * 亡くなった人に遺族厚生年金があるか。中高齢寡婦加算は**遺族厚生年金への上乗せ**なので、
     * 無ければ加算も無い（自営で 0 にしていたのに加算だけ乗っていた。2026-10-17・QA）
     */
    deceasedHasKosei: boolean;
    /** 死亡時点の遺族の年齢（子なし世帯の受給資格はここで決まる） */
    survivorAgeAtDeath: number;
    survivorAgeNow: number;
    childrenAgesNow: number[];
    hasChildAtDeath: boolean;
  },
): number {
  const minAge = v(p, "chukoreiKafuMinAge");
  const add = v(p, "chukoreiKafuAdd");
  if (!ctx.deceasedHasKosei) return 0;

  // 子なし：死亡時に年齢要件を満たすかどうかで、算定期間を通じて決まる
  if (!ctx.hasChildAtDeath) return ctx.survivorAgeAtDeath >= minAge ? add : 0;

  // 子あり：遺族基礎年金が出ている間は対象外。末子が18歳を超えてから、年齢要件を満たす年
  if (ctx.childrenAgesNow.some((a) => a < 18)) return 0;
  return ctx.survivorAgeNow >= minAge ? add : 0;
}

/** 遺族基礎年金の累計（年ごとに子の年齢を進めて積算） */
export function izokuKisoTotal(p: ParamSet, children: number[], yearsTotal: number): number {
  let total = 0;
  for (let t = 0; t < yearsTotal; t++) {
    total += izokuKisoAnnual(
      p,
      children.map((a) => a + t),
    );
  }
  return total;
}
