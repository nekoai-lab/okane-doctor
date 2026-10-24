/**
 * AI言語化スタブのテスト（T-07）。核＝「AIは数値を書かない・G-1で生数字を弾く・落ちたら退避」。
 */
import { describe, expect, it } from "vitest";
import { GOLDEN } from "../__tests__/households.js";
import { resultFigures } from "../calc/figures.js";
import { diagnose } from "../calc/index.js";
import { formatRange } from "../design/tokens.js";
import { loadParams } from "../params/index.js";
import { toCompleteSelections } from "../wizard/complete.js";
import { resultInputs } from "../wizard/resultInputs.js";
import { decodeSelections } from "../wizard/url.js";
import {
  fallbackNarration,
  fillPlaceholders,
  hasNoRawNumbers,
  narrate,
  narrateStub,
  placeholderValues,
} from "./narrate.js";

const P = loadParams("2026-08");
const AS_OF = new Date("2026-08-17T12:00:00+09:00");

describe("narrate（T-07 スタブ）", () => {
  it("全世帯でスタブのテンプレは生の数字を含まない（プレースホルダのみ）＝G-1を通る", () => {
    for (const c of GOLDEN) {
      const d = diagnose(P, c.input, AS_OF);
      expect(hasNoRawNumbers(narrateStub(d))).toBe(true);
    }
  });

  it("生の数字が混ざったテンプレは G-1 で弾く", () => {
    expect(hasNoRawNumbers("必要額は約500万円です")).toBe(false);
    expect(hasNoRawNumbers("必要額は約３００万円です")).toBe(false);
    expect(hasNoRawNumbers("必要額は {{selfRange}} です")).toBe(true);
  });

  it("漢数字の金額・年数も生の数字として止める（2026-10-17・QA）", () => {
    for (const t of [
      "必要な保障の目安は三千万円です。",
      "目安は三千万です。",
      "数百万ほど足りません。",
      "百万円ほど減らせます。",
      "二十年ほど続きます。",
      "保険料は二割ほど浮きます。",
    ]) {
      expect(hasNoRawNumbers(t), t).toBe(false);
    }
  });

  it("「万一」「一方」「十分」のような数量でない漢字では止めない", () => {
    for (const t of [
      "あなたに万一のとき、{{selfRange}} が目安です。",
      "一方で、配偶者の保障は少なめです。",
      "いまの備えで十分そうです。",
      "一度、前提を確かめてみてください。",
    ]) {
      expect(hasNoRawNumbers(t), t).toBe(true);
    }
  });

  it.each([
    "目安は参千萬円です",
    "参千萬圓",
    "壹阡萬圓",
    "弐百万円",
    "さんぜんまんえん",
    "サンゼンマン円",
    "ｻﾝｾﾞﾝﾏﾝｴﾝ",
    "さん ぜん まん えん",
    "にひゃくえん",
    "ろっぴゃく円",
    "さんねん",
    "about thirty million yen",
    "THIRTY MILLION YEN",
    "twenty-five years",
    "three",
    "三 千 万 円",
    "参\t千\n萬　圓",
    "③⓪⓪⓪",
    "ⅢⅩ百",
    "𝟑𝟎𝟎𝟎",
    "٣٠٠٠",
    "Ⅲ",
    "½",
    "半年分",
    "三カ月",
    "三ヶ月",
    "三ヵ月",
    "目安は{{selfRange}}ですが参千萬圓も必要です",
  ])("G-1：表記が異なる生の数量を拒否する：%s", (template) => {
    expect(hasNoRawNumbers(template)).toBe(false);
  });

  it.each([
    "万一のときに",
    "老後に年金を受け取る",
    "働く人の収入",
    "少し年上の配偶者",
    "ご家族の暮らし",
    "お子さんが成人するまで",
    "遺族年金が支給されます",
    "収入が上回るので",
    "今の保障で足りる見込みです",
    "一方で",
    "十分な備え",
    "一度見直す",
    "目安は{{selfRange}}です",
    "お子さんに必要な備えです",
    "いっしょに見直しましょう",
    "someone can save money",
  ])("G-1：数量でない表現とプレースホルダを許可する：%s", (template) => {
    expect(hasNoRawNumbers(template)).toBe(true);
  });

  // 画面の短いラベルだけでは拾えなかった、AI の説明文での止めすぎを固定する。
  it.each([
    "働くことができます",
    "見直しておくことが大切です",
    "毎月にコストがかかります",
    "少しこの先を考える",
    "ご家族の暮らしを守る",
    "いまの保障で足りる見込みです",
    "保険の内容を確認しておくことで、備えを整理できます。",
    "必要な保障は、ご家族の暮らし方によって変わります。",
    "いまの保険でまかなえる範囲を確かめてみてください。",
    "保険料の負担が気になるときは、家計とあわせて見直せます。",
    "公的な支えを確認してから、保険で補う部分を考えます。",
    "保障が重なっている場合は、整理できる可能性があります。",
    "ご家族の希望を聞くことも、備えを考える手がかりになります。",
    "保険証券を手元に置くことで、確認が進めやすくなります。",
    "加入中の保障が分からない場合は、過不足を保留しています。",
    "保障を減らせるかどうかは、前提を確かめてから考えましょう。",
    "暮らしの変化にあわせて、保険の役割も変わります。",
    "いまの備えで支出をまかなえる見込みがあります。",
    "必要な保障の目安は、回答した条件から計算しています。",
    "保険を続けるか考える際は、契約の内容も確認してください。",
    "家計を見直しておくことは、将来の選択肢につながります。",
    "毎月の支出には、住まいにかかる費用も含まれます。",
    "収入が変わると、家計に残るお金も変わります。",
    "貯蓄を取り崩すことができるかも、備えを考える前提です。",
    "生活費を無理なく抑える方法を、ご家族で考えてみてください。",
    "教育費の見通しは、お子さんの進路によって変わります。",
    "住宅ローンの契約内容によって、遺された家族の負担が変わります。",
    "手元の資産をどこまで使えるか、確認しておくと考えやすくなります。",
    "支出が収入を上回る場合は、貯蓄や保障で補う必要があります。",
    "家計に余裕がある場合も、前提の変化には目を向けておきましょう。",
    "急な支出に備えて、使えるお金の置き場所を確認できます。",
    "住まいの費用を把握することが、家計の整理につながります。",
    "少しこの先の暮らしを思い描くと、必要な備えが見えてきます。",
    "日々の支出と将来の支出を分けて考えることができます。",
    "老後に年金を受け取ることで、生活費を支える見込みです。",
    "遺族年金は、家族構成や加入状況によって扱いが変わります。",
    "公的年金の見込みは、加入記録で確かめられます。",
    "年金だけで生活費をまかなえるかは、支出との関係で変わります。",
    "配偶者の年金も、世帯の暮らしを支える収入として考えます。",
    "受け取れる年金については、窓口で確認することができます。",
    "制度の条件に当てはまるかを、先に確認しておきましょう。",
    "年金の見込みが分かると、保険で補う範囲を考えやすくなります。",
    "遺族への公的な支えも含めて、必要な保障を見ています。",
    "老後の生活費は、住まいや働き方によっても変わります。",
    "年金を受け取るまでの暮らしも、確認しておくことが大切です。",
    "将来の収入を見込む際は、年金の条件も確かめてください。",
    "働く人の収入は、家計を支える大切な要素です。",
    "配偶者が働くことができる場合は、必要な保障が変わります。",
    "働き方を変えると、収入と公的な支えの見通しも変わります。",
    "無理なく働き続けられるか、ご家族の状況に沿って考えます。",
    "仕事を休むことになった場合の支えも、確認できます。",
    "復職を考えるときは、体調や家族の協力も大切です。",
    "自営業の方は、会社員とは使える制度が異なります。",
    "勤務先の福利厚生を調べておくことで、備えを整理できます。",
    "育児と仕事を両立できるかによって、収入の見込みは変わります。",
    "今後も働くことを前提にするか、条件を切り替えて確かめられます。",
    "収入が途切れる場合を考えておくと、備えを検討しやすくなります。",
    "ご自身に合う働き方を選べるかも、暮らしの前提に含まれます。",
    "毎月にコストがかかりますので、家計とあわせて確認してください。",
    "目安は{{selfRange}}です。ご家族の状況とあわせて確かめてください。",
  ])("G-1：数量を含まない保険・家計・年金・働き方の説明を通す：%s", (template) => {
    expect(hasNoRawNumbers(template)).toBe(true);
  });

  it.each([
    "ひゃく",
    "まんえん",
    "さんぜん",
    "にじゅう",
    "ごせん",
    "きゅうねん",
    "さんにん",
    "ハンネン",
    "ひゃく円",
  ])("G-1：かなの数詞として成り立つ数量は引き続き拒否する：%s", (template) => {
    expect(hasNoRawNumbers(template)).toBe(false);
  });

  it("差し込みは算定結果の値を入れ、プレースホルダを残さない", () => {
    const d = diagnose(P, GOLDEN[1].input, AS_OF); // GT-02
    const text = fillPlaceholders("目安は {{selfRange}} です", d);
    expect(text).toContain("万円");
    expect(text).not.toContain("{{");
  });

  it("narrate は G-1 を通ったスタブ文を返し、レンジが差し込まれる", () => {
    const d = diagnose(P, GOLDEN[1].input, AS_OF);
    const n = narrate(d);
    expect(n.source).toBe("ai-stub");
    expect(n.text).toContain("万円");
    expect(n.text).not.toMatch(/\{\{/);
  });

  it("結論と差額の粒度がそろっている（『0万円ほど減らせる』を出さない）", () => {
    // 世帯としては減らせる／整えられるのに、差額を本人だけから取っていたため
    // 「0万円ほど減らせる」という壊れた文が出ていた（2026-08-30 実物レビュー）
    for (const c of GOLDEN) {
      const d = diagnose(P, c.input, AS_OF);
      const kind = d.householdHeadline.kind;
      if (kind === "all_covered" || d.self.gap.kind === "pending") continue;
      const n = narrate(d);
      if (n.text.includes("{{")) continue;
      expect(n.text, `${c.id}（${kind}）の文に 0万円 が出ている`).not.toMatch(/(^|[^\d])0万円/);
    }
  });

  it("保険が分からない世帯は pending の文面になる（過不足を断定しない）", () => {
    const d = diagnose(P, { ...GOLDEN[1].input, coverageSelf: null }, AS_OF);
    const n = narrate(d);
    expect(n.text).toContain("過不足はまだ");
  });
});

describe("保険内容が分からない人がいるときは、過不足を断定しない（2026-10-17・QA）", () => {
  const base = GOLDEN.find((c) => c.id === "GT-02");
  if (!base) throw new Error("GT-02 が無い");
  const cases: [string, Partial<typeof base.input>][] = [
    ["両方わからない", { coverageSelf: null, coverageSpouse: null }],
    ["配偶者だけわからない", { coverageSpouse: null }],
  ];
  for (const [label, patch] of cases) {
    it(`${label}：退避文も本文も「不足はなさそう」「減らせる」と言わない`, () => {
      const d = diagnose(P, { ...base.input, ...patch }, AS_OF);
      for (const text of [fallbackNarration(d).text, narrate(d).text]) {
        expect(text).toContain("まだ出していません");
        expect(text).not.toContain("不足はなさそう");
        expect(text).not.toContain("減らせる");
      }
    });
  }
});

describe("よみときは結果画面と同じ「最終の金額と判定」を読む（2026-10-17・設計レビュー #1）", () => {
  const AS_OF_1017 = new Date("2026-10-17T12:00:00+09:00");
  const figuresOf = (query: string) => {
    const complete = toCompleteSelections(decodeSelections(query));
    if (!complete) throw new Error("入力が足りない");
    const ri = resultInputs(P, complete, "asis", AS_OF_1017);
    return resultFigures(P, ri.input, ri.bands, AS_OF_1017);
  };

  it("回答の幅で圏内の世帯：本文も退避文も「減らせる」「不足はなさそう」と言わない", () => {
    const f = figuresOf(
      "v=1&sb=1988&emp=employee&sp=1&spb=1990&spe=employee&ch=2021-2024&edu=public&inc=lt600&sinc=lt400&as=lt300&liv=lt30&ho=rent&cvs=m1000&cvsp=m300",
    );
    expect(f.diagnosis.householdHeadline.kind).toBe("uncertain");
    for (const n of [narrate(f.diagnosis), fallbackNarration(f.diagnosis)]) {
      expect(n.text).toContain("言い切れません");
      expect(n.text).not.toContain("減らせる");
      expect(n.text).not.toContain("不足はなさそう");
    }
    // 必要額は画面のカードと同じ幅
    expect(placeholderValues(f.diagnosis).selfRange).toBe(
      formatRange(f.self.need.low, f.self.need.high),
    );
  });

  it("不足世帯：差額は1点ではなく、画面のヒーローと同じ幅", () => {
    const f = figuresOf(
      "v=1&sb=1986&emp=self&sp=1&spb=1988&spe=none&ch=2018-2021&edu=private&inc=lt400&sinc=none&as=lt100&liv=lt35&ho=rent&cvs=none&cvsp=none",
    );
    expect(placeholderValues(f.diagnosis).gapAmount).toBe(
      formatRange(f.household.shortageRange.low, f.household.shortageRange.high),
    );
  });
});
