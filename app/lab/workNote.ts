// 就労の前提の文。年齢と額はエンジンの就労計画（`calculateLab` の `spouseWork`）から取り、
// 画面で共通の定数から組まない（UX 41回目：60歳以上で働いている配偶者・子のいない世帯で食い違った）
import type { LabData } from "../../src/calc/lab.js";
import { formatMan } from "../../src/design/tokens.js";

type Facts = NonNullable<LabData["spouseWork"]>;

/** 切り替え（回答どおり・半分・ゼロ）がある世帯の、見込む期間と下限の文 */
export function workPlanNote(f: Facts): string {
  if (f.continuing)
    return `配偶者はいま${f.usualEndAge}歳以上で働いているので、選んだ年収のまま${f.endAge}歳になるまで見込みます（当社基準）。「ゼロ」では見込みません。`;
  const floor = `年約${formatMan(f.floor)}`;
  return f.hasChildren
    ? `就労収入は、配偶者が${f.endAge}歳になるまで見込みます。末子独立後は最低でも${floor}の手取りを推定します（当社基準）。「ゼロ」ではどちらも外します。`
    : `就労収入は、万一のときから配偶者が${f.endAge}歳になるまで見込みます。手取りが${floor}に届かないときも${floor}を推定します（当社基準）。「ゼロ」ではどちらも外します。`;
}

/** 回答の年収が0円で、切り替えが無い世帯の文 */
export function zeroIncomeNote(f: Facts): string {
  if (!f.counted) return "就労収入は見込んでいません。";
  const floor = `年約${formatMan(f.floor)}`;
  return f.hasChildren
    ? `末子独立後は${floor}の手取り就労収入を、配偶者が${f.endAge}歳になるまで見込みます（当社基準）。`
    : `万一のときから配偶者が${f.endAge}歳になるまで、${floor}の手取り就労収入を見込みます（当社基準）。`;
}
