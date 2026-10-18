import { describe, expect, it } from "vitest";
import { calculateLab } from "../../src/calc/lab.js";
import { loadParams } from "../../src/params/index.js";
import { toCompleteSelections } from "../../src/wizard/complete.js";
import { bandInputs, normalizeEnds } from "../../src/wizard/uncertainty.js";
import { decodeSelections } from "../../src/wizard/url.js";
import { workPlanNote, zeroIncomeNote } from "./workNote.js";

const p = loadParams();
const date = new Date("2026-10-18T00:00:00+09:00");
function lab(query: string) {
  const sel = toCompleteSelections(decodeSelections(query))!;
  const ends = normalizeEnds(p, sel, date);
  return calculateLab(p, ends.point.input, bandInputs(p, sel, date, 1), date);
}

/** 文はエンジンが実際に使っている見込み（終わりの年齢・下限・子の有無）から出す（UX 41回目） */
describe("ラボの就労の前提の文", () => {
  it("すでに62歳で働いている配偶者：下限も60歳も言わず、65歳まで選んだ年収で見込む", () => {
    const d = lab(
      "v=1&sb=1962&emp=employee&sp=1&spb=1964&spe=employee&ch=&inc=lt600&sinc=lt400&as=lt500&liv=lt30&ho=rent&cvs=m1000&cvsp=none",
    );
    const note = workPlanNote(d.spouseWork!);
    expect(d.spouseWork!.endAge).toBe(65);
    expect(note).toContain("65歳になるまで");
    expect(note).not.toContain("最低");
    expect(note).not.toContain("末子");
  });
  it("子のいない世帯：末子独立後と書かず、万一のときから見込む", () => {
    const d = lab(
      "v=1&sb=1989&emp=employee&sp=1&spb=1991&spe=employee&ch=&inc=lt600&sinc=lt400&as=lt500&liv=lt30&ho=rent&cvs=m1000&cvsp=none",
    );
    const note = workPlanNote(d.spouseWork!);
    expect(note).toContain("万一のときから配偶者が60歳になるまで");
    expect(note).not.toContain("末子");
  });
  it("子のいる世帯（組み替え）：60歳まで・末子独立後の下限", () => {
    const d = lab(
      "v=1&sb=1989&emp=employee&sp=1&spb=1991&spe=employee&ch=2024&edu=public&inc=lt600&sinc=lt400&as=lt500&liv=lt30&ho=own_loan&loan=lt3000&dan=yes&cvs=m2000&cvsp=none",
    );
    expect(workPlanNote(d.spouseWork!)).toBe(
      "就労収入は、配偶者が60歳になるまで見込みます。末子独立後は最低でも年約100万円の手取りを推定します（当社基準）。「ゼロ」ではどちらも外します。",
    );
  });
  it("回答の年収0円（不足）：末子独立後の下限を60歳まで", () => {
    const d = lab(
      "v=1&sb=1986&emp=self&sp=1&spb=1988&spe=none&ch=2018-2021&edu=private&inc=lt400&sinc=none&as=lt100&liv=lt35&ho=rent&cvs=none&cvsp=none",
    );
    expect(zeroIncomeNote(d.spouseWork!)).toBe(
      "末子独立後は年約100万円の手取り就労収入を、配偶者が60歳になるまで見込みます（当社基準）。",
    );
  });
});
