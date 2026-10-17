/**
 * 結果画面と AI のよみとき（`/api/narrate`）が**同じ入力の組**を作るための入口（2026-10-17）。
 *
 * 結果画面は代表値の入力に加えて回答の幅の候補（帯の角と区分の内側の極値・`bandInputs`）を作り、最終の必要額をそこから出す。
 * API が代表値だけで回すと、よみときの金額と判定だけが画面と食い違う。
 * 手で2か所に組まず、ここを通す（`toHousehold` と同じ「構造で塞ぐ」）。
 */
import type { DiagnoseInput } from "../calc/index.js";
import { dialFor } from "../calc/simulate.js";
import type { ParamSet } from "../params/index.js";
import type { LivingLevel } from "./dial.js";
import { normalize } from "./normalize.js";
import type { Estimation, WizardSelections } from "./types.js";
import { bandInputs } from "./uncertainty.js";

export interface ResultInputs {
  /** 暮らし方の目盛りの乗数（params から引いた値） */
  dial: number;
  /** 目盛りを付ける前の代表値の入力 */
  rawInput: DiagnoseInput;
  /** 目盛りを付けた代表値の入力 */
  input: DiagnoseInput;
  /** 回答の幅の候補（帯の角・代表値・区分の内側の極値。同じ目盛りを付けたもの） */
  bands: DiagnoseInput[];
  /** ウィザードで推定して補った項目 */
  estimations: Estimation[];
}

export function resultInputs(
  p: ParamSet,
  complete: WizardSelections,
  level: LivingLevel,
  asOf: Date,
): ResultInputs {
  const dial = dialFor(p, level);
  const { input: rawInput, estimations } = normalize(p, complete, asOf);
  return {
    dial,
    rawInput,
    input: { ...rawInput, lifestyleDial: dial },
    bands: bandInputs(p, complete, asOf, dial),
    estimations,
  };
}
