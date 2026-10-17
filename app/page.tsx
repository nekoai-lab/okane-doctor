/**
 * トップページ（LP・2026-10-17 最終承認版）
 *
 * 視覚の正本はデザイン承認画像2枚（PC・スマホ。handoff の references/APPROVED_*.png）。
 * 画像は生成画像なので、**描かれた金額・文言はそのまま使わない**：
 *
 * 1. 金額と判定は `src/calc/topExample.ts`（例の世帯を結果画面と同じ入口に通した結果）から出す。
 *    「この例の結果画面」へのリンクを置くので、押した先と同じ数字でなければならない。
 * 2. 画像の「今すぐ」「無料」「10分」「わかりやすく」「安心して」は使わない。
 *    急かす語と品質の自称は `src/narrate/guard.ts` の語彙で禁じている。所要は実装どおり「約10問」。
 * 3. もしもラボの3枚は、画像の「教育費」「住宅ローン」ではなく実装済みのシナリオ
 *    （病気・けがで休む／亡くなる時期／配偶者の働き方）にする。
 * 4. 制度の見守りは「毎週」と書かない（定期実行はまだつないでいない）。
 *    変化は運営画面の承認待ちに積まれ、人が確かめてから計算に入る、という事実だけを書く。
 *
 * 書いてよいこと・いけないことは CLAUDE.md の「事業の芯」に従う。商品名も申込み導線も置かない。
 */
import { Klee_One, Noto_Sans_JP } from "next/font/google";
import Link from "next/link";
import { TOP_EXAMPLE_QUERY, topExample } from "../src/calc/topExample.js";
import { VERDICT_BADGE } from "../src/design/fintech/verdict.js";
import { formatMan } from "../src/design/tokens.js";
import { loadParams } from "../src/params/index.js";
import { jstDate } from "../src/time/jstYear.js";
import "../src/design/theme-fintech.css";
import { DEATH_LABEL, VERDICT_AXIS } from "./result/verdictLabels.js";
import { CalcArt, FormArt, Leaf, ResultArt, Skyline, Spot, Sprig } from "./top/art.js";
import { Icon } from "./top/icons.js";
import { Logo } from "./top/Logo.js";
import s from "./top/top.module.css";

export const metadata = {
  title: "お金の町医者｜もしものとき、いまの暮らしは大丈夫？",
  description:
    "お金の町医者。約10問の回答から、もしものときに必要なお金と、いまの保障の過不足を根拠つきで確かめる診断です。保険は売りません。",
};

// 「◯年◯月◯日時点」を出すので、ビルドした日ではなく開いた日で計算する
export const dynamic = "force-dynamic";

/** 本文の書体。next/font がビルド時に取得して自前配信する（実行時に Google へ取りに行かない） */
const notoSans = Noto_Sans_JP({
  weight: ["400", "500", "700", "900"],
  display: "swap",
  preload: false,
  variable: "--top-font-sans",
});
/** 手書き風の添え書き（承認画像の斜めの一言）だけに使う */
const klee = Klee_One({
  weight: ["600"],
  display: "swap",
  preload: false,
  variable: "--top-font-hand",
});

/** 円 → 万円の数字だけ（「約」と「万円」は小さく別に組むため） */
const manNum = (yen: number) => Math.round(yen / 10_000).toLocaleString("ja-JP");

/** 大きく出す金額。1億未満は「約 ◯〜◯ 万円」と単位を小さく、1億以上は formatMan の書き方に任せる */
function BigRange({ low, high }: { low: number; high: number }) {
  if (high >= 100_000_000) {
    return (
      <span className={s.bigAmount}>
        <small>約</small>
        {formatMan(low).replace(/円$/, "")}〜{formatMan(high)}
      </span>
    );
  }
  return (
    <span className={s.bigAmount} data-amount="">
      <small>約</small>
      <span className={s.nowrap}>{manNum(low)}〜</span>
      <span className={s.nowrap}>
        {manNum(high)}
        <small>万円</small>
      </span>
    </span>
  );
}

function BigOne({ yen }: { yen: number }) {
  return (
    <span className={`${s.bigAmount} ${s.nowrap}`} data-amount="">
      <small>約</small>
      {manNum(yen)}
      <small>万円</small>
    </span>
  );
}

function SectionHead({
  id,
  title,
  lead,
  center,
}: {
  id: string;
  title: React.ReactNode;
  lead?: React.ReactNode;
  center?: boolean;
}) {
  return (
    <div className={`${s.sectionHead} ${center ? s.sectionHeadCenter : ""}`}>
      <h2 id={id}>{title}</h2>
      <span className={s.rule} aria-hidden="true" />
      {lead && <p className={s.lead}>{lead}</p>}
    </div>
  );
}

export default function Home() {
  const p = loadParams();
  const asOf = new Date();
  const ex = topExample(p, asOf);
  const [y, m, d] = jstDate(asOf).split("-").map(Number);
  const dateText = `${y}年${m}月${d}日時点`;
  const exampleHref = `/result?${TOP_EXAMPLE_QUERY}`;
  const labHref = `/lab?${TOP_EXAMPLE_QUERY}`;
  const badge = VERDICT_BADGE[ex.verdict];
  const verdictLabel = DEATH_LABEL[ex.verdict];
  const household = [
    `${ex.selfAge}歳・会社員`,
    ex.spouseAge !== null ? `配偶者${ex.spouseAge}歳・専業` : null,
    ex.childAges.length > 0 ? `子ども${ex.childAges.map((a) => `${a}歳`).join("・")}` : null,
    `持ち家・${ex.danshinCovered ? "団信あり" : "団信なし"}`,
  ].filter((t): t is string => t !== null);
  const verdictNote =
    ex.verdict === "shortage" && ex.gap
      ? `いまの保障では、必要額の下端まで約${manNum(ex.gap.low)}〜${manNum(ex.gap.high)}万円届きません。`
      : ex.verdict === "reducible" && ex.gap
        ? `いまの保障が、必要額の上端を約${manNum(ex.gap.low)}〜${manNum(ex.gap.high)}万円上回っています。`
        : ex.verdict === "uncertain"
          ? "いまの保障が、必要額の幅の中にあります。"
          : "いまの保障が分からないため、過不足は判定していません。";

  const breakdown = [
    { icon: Icon.house, label: "ご家族の生活費", yen: ex.expense.living },
    { icon: Icon.cap, label: "お子さまの教育費", yen: ex.expense.education },
    {
      icon: Icon.roofHome,
      label: "住居費（住宅ローンなど）",
      yen: ex.expense.housing,
      note: ex.danshinCovered && ex.expense.housing === 0 ? "団信で完済の前提" : undefined,
    },
    { icon: Icon.heart, label: "その他の費用（葬儀など）", yen: ex.expense.other },
  ];

  return (
    <div className={`${s.page} ${notoSans.variable} ${klee.variable}`} data-theme="fintech">
      <a className={s.skip} href="#main">
        本文へ移動
      </a>

      <header className={s.header}>
        <div className={s.headerInner}>
          <a className={s.brandLink} href="#main" aria-label="お金の町医者 トップ">
            <Logo />
          </a>
          <nav className={s.nav} aria-label="ページ内">
            <a href="#features">サービスの特徴</a>
            <a href="#flow">診断の流れ</a>
            <a href="#lab">もしもラボ</a>
            <a href="#faq">よくある質問</a>
          </nav>
          <div className={s.headerMobile}>
            <Link className={s.headerCta} href="/wizard">
              診断をはじめる
            </Link>
            <details className={s.menu}>
              <summary aria-label="メニュー">
                <span className={s.menuBars} aria-hidden="true" />
              </summary>
              <nav className={s.menuPanel} aria-label="ページ内（メニュー）">
                <a href="#features">サービスの特徴</a>
                <a href="#flow">診断の流れ</a>
                <a href="#lab">もしもラボ</a>
                <a href="#faq">よくある質問</a>
              </nav>
            </details>
          </div>
        </div>
      </header>

      <main id="main" className={s.main}>
        {/* ① ファーストビュー */}
        <section className={s.hero} aria-labelledby="hero-title">
          <picture className={s.heroPicture}>
            <source
              media="(min-width: 900px)"
              srcSet="/illustrations/family/hero-riverside-wide.webp"
            />
            <img
              className={s.heroImg}
              src="/illustrations/family/hero-riverside-wide-800.webp"
              alt="川沿いの遊歩道を、手をつないで歩く両親と子ども2人"
              width={1280}
              height={720}
              fetchPriority="high"
            />
          </picture>
          <Sprig className={s.heroSprig} />
          <p className={s.heroHand} aria-hidden="true">
            家族の今と、
            <br />
            これからを
            <br />
            一緒に考えよう。
          </p>
          <div className={s.heroInner}>
            <div className={s.heroCopy}>
              <h1 id="hero-title" className={s.heroTitle}>
                <span className={s.blue}>もしも</span>のとき、
                <br />
                <span className={s.blue}>いまの暮らし</span>は
                <br />
                大丈夫？
              </h1>
              <p className={s.heroLead}>
                ご家族の状況から、もしものときに必要なお金と、いまの保障のバランスを根拠つきで確かめます。
                <span className={s.mobileOnly}>
                  気になる条件は「もしもラボ」でさらに確かめられます。
                </span>
              </p>
            </div>
            <div className={s.heroActions}>
              <Link className={`${s.btn} ${s.btnPrimary}`} href="/wizard">
                約10問で診断する
                {Icon.arrow()}
              </Link>
              <Link className={`${s.btn} ${s.btnSecondary}`} href={exampleHref}>
                診断結果の例を見る
              </Link>
            </div>
          </div>
        </section>

        {/* ② 診断結果でわかること（試算例の金額は topExample から） */}
        <section
          className={`${s.features} ${s.curve}`}
          id="features"
          aria-labelledby="features-title"
        >
          <Leaf className={`${s.leaf} ${s.leafFeaturesA}`} />
          <Leaf className={`${s.leaf} ${s.leafFeaturesB}`} />
          <div className={s.featuresGrid}>
            <div className={s.featuresIntro}>
              <SectionHead
                id="features-title"
                title={
                  <>
                    診断結果でわかる<span className={s.blue}>こと</span>
                  </>
                }
                lead="あなたの状況から、もしものときに必要なお金と、いまの保障のバランスを診断します。"
              />
              <article className={`${s.card} ${s.breakdown}`} aria-labelledby="breakdown-title">
                <div className={s.cardHead}>
                  <span className={s.iconCircle}>{Icon.chart(26)}</span>
                  <div>
                    <h3 id="breakdown-title">必要額の内訳</h3>
                    <p>
                      遺されたご家族に必要なお金の合計 <strong>約{manNum(ex.total)}万円</strong>{" "}
                      の内訳です。
                    </p>
                  </div>
                </div>
                <ul className={s.breakdownList}>
                  {breakdown.map((row) => (
                    <li key={row.label}>
                      <span className={s.rowIcon}>{row.icon(22)}</span>
                      <span className={s.rowLabel}>
                        {row.label}
                        {row.note && <small>{row.note}</small>}
                      </span>
                      <span className={s.rowAmount}>
                        約<strong>{manNum(row.yen)}</strong>万円
                      </span>
                    </li>
                  ))}
                </ul>
              </article>
            </div>

            {/* スマホの画面の見本。中身は試算例の実際の計算結果 */}
            <figure className={s.phoneWrap} aria-labelledby="phone-caption">
              <div className={s.phone}>
                <div className={s.phoneNotch} aria-hidden="true" />
                <div className={s.phoneTop}>
                  <Logo compact />
                </div>
                <div className={s.phoneBody}>
                  <div className={s.phoneTitleRow}>
                    <p className={s.phoneTitle}>診断結果</p>
                    <p className={s.phoneDate}>{dateText}</p>
                  </div>
                  <p className={s.phoneLeadText}>
                    万が一のとき、遺されたご家族のために備えておきたい金額を計算しました。
                  </p>
                  <div className={s.phoneCard}>
                    <p className={s.phoneLabel}>保険で備えたい額</p>
                    <p className={s.phoneAmountMain}>
                      <BigRange low={ex.need.low} high={ex.need.high} />
                    </p>
                    <p className={s.phoneHint}>
                      <span aria-hidden="true">{Icon.bulb(18)}</span>
                      生活費・教育費・住居費から、公的年金・配偶者の収入・貯蓄を差し引いた幅です。
                    </p>
                  </div>
                  <div className={s.phoneCard}>
                    <p className={s.phoneLabel}>現在の死亡保障</p>
                    <p className={s.phoneAmountSub}>
                      <BigOne yen={ex.coverage} />
                    </p>
                  </div>
                  <div className={`${s.phoneVerdict} ${s[`tone_${badge.tone}`]}`}>
                    <p className={s.phoneLabel}>{VERDICT_AXIS}</p>
                    <p className={s.verdictMain}>
                      <span className={s.verdictIcon} aria-hidden="true">
                        {badge.icon}
                      </span>
                      <span className={s.verdictLabel}>{verdictLabel}</span>
                    </p>
                    <p className={s.verdictNote}>{verdictNote}</p>
                  </div>
                </div>
              </div>
              <figcaption id="phone-caption" className={s.exampleCaption}>
                <span className={s.exampleTag}>試算例</span>
                <span className={s.captionLine}>{household.slice(0, 2).join("／")}</span>
                <span className={s.captionLine}>{household.slice(2).join("／")}</span>
                <span className={s.captionLine}>いまの死亡保障 {formatMan(ex.coverage)}</span>
                <span className={s.captionLine}>
                  {dateText}・制度パラメータ {p.version}。結果画面と同じ値です。
                </span>
                <Link className={s.inlineLink} href={exampleHref}>
                  この例の結果画面を見る
                </Link>
              </figcaption>
            </figure>

            <div className={s.featuresSide}>
              <article className={s.card}>
                <div className={s.cardHead}>
                  <span className={s.iconCircle}>{Icon.shield(26)}</span>
                  <div>
                    <h3>いまの保障内容</h3>
                    <p>回答いただいた、いまの死亡保障の額です。</p>
                  </div>
                </div>
                <div className={s.sideAmount}>
                  <span>いまの死亡保障</span>
                  <BigOne yen={ex.coverage} />
                </div>
              </article>
              <article className={s.card}>
                <div className={s.cardHead}>
                  <span className={s.iconCircle}>{Icon.bulb(26)}</span>
                  <div>
                    <h3>結果画面で確かめられること</h3>
                    <p>金額だけでなく、その根拠まで確かめられます。</p>
                  </div>
                </div>
                <ul className={s.checkList}>
                  <li>
                    <span className={s.checkIcon}>{Icon.check()}</span>
                    計算の内訳と、公的制度の出典
                  </li>
                  <li>
                    <span className={s.checkIcon}>{Icon.check()}</span>
                    病気・けが・失業のときの備え
                  </li>
                  <li>
                    <span className={s.checkIcon}>{Icon.check()}</span>
                    前提が変わると、判定がどう動くか
                  </li>
                </ul>
              </article>
            </div>
          </div>
        </section>

        {/* スマホだけの息つぎの絵（承認画像の「これからのために」の帯） */}
        <div className={s.breather} aria-hidden="true">
          {/* biome-ignore lint/performance/noImgElement: 飾りの風景。最適化より単体の描画を優先 */}
          <img src="/illustrations/shared/hero-neutral-800.webp" alt="" width={800} height={450} />
          <p className={s.breatherHand}>
            これからのために、
            <br />
            いま、できること。
          </p>
        </div>

        {/* ③ 計算の仕組み（金額を模さない図式） */}
        <section className={s.mechanism} id="mechanism" aria-labelledby="mechanism-title">
          <div className={s.mechanismInner}>
            <Skyline className={s.mechanismSkyline} />
            <Sprig className={s.mechanismSprig} />
            <div className={s.mechanismText}>
              <SectionHead id="mechanism-title" title="計算の仕組み" />
              <p className={s.mechanismClaim}>
                必要な保障額は、
                <br />
                <span className={`${s.blue} ${s.nowrap}`}>「必要なお金」</span>と
                <span className={`${s.blue} ${s.nowrap}`}>「今ある支え」</span>
                <br />
                から考えます。
              </p>
              <p className={s.lead}>
                ご家族の状況に合わせて、必要なお金と、公的年金や貯蓄などの今ある支えを計算し、その差を保険で備えたい額の目安にします。
              </p>
            </div>
            <figure className={s.equation} aria-label="必要なお金 − 今ある支え ＝ 保険で備えたい額">
              <div className={s.eqCol}>
                <p className={s.eqHead}>必要なお金</p>
                <ul>
                  <li>
                    <span className={s.eqIcon}>{Spot.house()}</span>毎月の生活費
                  </li>
                  <li>
                    <span className={s.eqIcon}>{Spot.cap()}</span>教育費
                  </li>
                  <li>
                    <span className={s.eqIcon}>{Spot.suitcase()}</span>その他の
                    <br />
                    まとまった費用
                  </li>
                </ul>
              </div>
              <span className={s.eqOp} aria-hidden="true">
                −
              </span>
              <div className={s.eqCol}>
                <p className={s.eqHead}>今ある支え</p>
                <ul>
                  <li>
                    <span className={s.eqIcon}>{Spot.bank()}</span>遺族年金
                  </li>
                  <li>
                    <span className={s.eqIcon}>{Spot.piggy()}</span>貯蓄
                  </li>
                  <li>
                    <span className={s.eqIcon}>{Spot.briefcase()}</span>家族の収入
                  </li>
                </ul>
              </div>
              <span className={s.eqOp} aria-hidden="true">
                ＝
              </span>
              <div className={`${s.eqCol} ${s.eqResult}`}>
                <p className={s.eqHead}>保険で備えたい額</p>
                <div className={s.eqShield}>{Spot.shieldYen()}</div>
                <p className={s.eqResultText}>必要なお金から、今ある支えを差し引いた金額の目安</p>
              </div>
              <figcaption className={s.eqNote}>
                ※ 金額は計算エンジンが算定します。遺族年金は日本年金機構などの公表値で計算します。
              </figcaption>
            </figure>
          </div>
        </section>

        {/* ④ もしもラボ（実装済みのシナリオだけを紹介する） */}
        <section className={`${s.lab} ${s.curve}`} id="lab" aria-labelledby="lab-title">
          <Sprig className={s.labSprig} />
          <div className={s.labInner}>
            <div className={s.labIntro}>
              <h2 id="lab-title" className={s.labTitle}>
                <span className={s.nowrap}>
                  <span className={s.blue}>もしもラボ</span>で、
                </span>
                <span className={s.nowrap}>もっと詳しく</span>
              </h2>
              <p className={s.lead}>
                診断結果をもとに、気になる条件を動かして、必要なお金がどう変わるかを確かめられます。
              </p>
              <Link className={`${s.btn} ${s.btnPrimary} ${s.labBtn}`} href={labHref}>
                試算例でもしもラボを見る
                {Icon.arrow()}
              </Link>
            </div>
            <div className={s.labScenarios}>
              <h3 className={s.labScenariosTitle}>ラボで確かめられる条件</h3>
              <ul className={s.labCards}>
                <li className={s.labCard}>
                  <span className={s.labIcon}>{Icon.bed(40)}</span>
                  <h4>病気やけがで働けなくなったら？</h4>
                  <p>短期の入院から1年半の休職まで5つの場面で、必要なお金と貯蓄を比べます。</p>
                </li>
                <li className={s.labCard}>
                  <span className={s.labIcon}>{Icon.hourglass(40)}</span>
                  <h4>亡くなる時期が変わったら？</h4>
                  <p>65歳までの時期によって、必要なお金がどう変わるかを見ます。</p>
                </li>
                <li className={s.labCard}>
                  <span className={s.labIcon}>{Icon.people(40)}</span>
                  <h4>配偶者の働き方が変わったら？</h4>
                  <p>遺された配偶者の働き方を変えると、必要なお金がどう動くかを見ます。</p>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* ⑤ ライフステージごとの考え方（3つ均等。説明だけで、金額は出さない） */}
        <section className={`${s.stages} ${s.curve}`} id="stages" aria-labelledby="stages-title">
          <div className={s.stagesInner}>
            <SectionHead
              id="stages-title"
              title={
                <>
                  ライフステージごとの
                  <br />
                  診断の考え方
                </>
              }
              lead="暮らしの段階によって、もしものときに必要なお金の中身が変わります。"
            />
            <ul className={s.stageCards}>
              <li>
                <Link className={s.stageCard} href="/wizard">
                  <span className={s.stageTab}>子育て世帯</span>
                  {/* biome-ignore lint/performance/noImgElement: 承認済みのイラストをそのまま出す */}
                  <img src="/top/stage-family.webp" alt="" width={640} height={456} />
                  <span className={s.stageText}>
                    子どもの教育費や、万一のときの生活費など、家族のこれからに必要な備えを診断します。
                  </span>
                  <span className={s.stageGo}>
                    診断をはじめる<span className={s.stageChevron}>{Icon.chevron()}</span>
                  </span>
                </Link>
              </li>
              <li>
                <Link className={s.stageCard} href="/wizard">
                  <span className={s.stageTab}>単身</span>
                  {/* biome-ignore lint/performance/noImgElement: 承認済みのイラストをそのまま出す */}
                  <img src="/top/stage-single.webp" alt="" width={640} height={456} />
                  <span className={s.stageText}>
                    ご自身の生活費や、病気・けがで働けないときの備えを、扶養する人がいない前提で診断します。
                  </span>
                  <span className={s.stageGo}>
                    診断をはじめる<span className={s.stageChevron}>{Icon.chevron()}</span>
                  </span>
                </Link>
              </li>
              <li>
                <Link className={s.stageCard} href="/wizard">
                  <span className={s.stageTab}>中高年・シニア</span>
                  {/* biome-ignore lint/performance/noImgElement: 承認済みのイラストをそのまま出す */}
                  <img src="/top/stage-senior.webp" alt="" width={640} height={456} />
                  <span className={s.stageText}>
                    お子さんの独立後の配偶者の暮らしや、病気で休むときの備えを、年齢に合わせて診断します。
                  </span>
                  <span className={s.stageGo}>
                    診断をはじめる<span className={s.stageChevron}>{Icon.chevron()}</span>
                  </span>
                </Link>
              </li>
            </ul>
          </div>
        </section>

        {/* ⑥ 診断の流れ */}
        <section className={`${s.flow} ${s.curve}`} id="flow" aria-labelledby="flow-title">
          <div className={s.flowInner}>
            <SectionHead
              id="flow-title"
              title="診断の流れ"
              lead="3ステップで、今の暮らしから、もしものときに必要なお金の目安を確かめます。"
            />
            <ol className={s.steps}>
              <li className={s.step}>
                <span className={s.stepNum} aria-hidden="true">
                  <small>STEP</small>01
                </span>
                <div className={s.stepBody}>
                  <h3>暮らしの条件を入力</h3>
                  <p>
                    家族構成・働き方・貯蓄など約10問。範囲で選べて、「分からない」でも進めます。
                  </p>
                </div>
                <span className={s.stepArt}>
                  <FormArt />
                </span>
              </li>
              <li className={s.step}>
                <span className={s.stepNum} aria-hidden="true">
                  <small>STEP</small>02
                </span>
                <div className={s.stepBody}>
                  <h3>必要なお金を計算</h3>
                  <p>回答と公的制度の数値から、計算エンジンが必要なお金を計算します。</p>
                </div>
                <span className={s.stepArt}>
                  <CalcArt />
                </span>
              </li>
              <li className={s.step}>
                <span className={s.stepNum} aria-hidden="true">
                  <small>STEP</small>03
                </span>
                <div className={s.stepBody}>
                  <h3>結果と考え方を確認</h3>
                  <p>いまの保障との過不足を、内訳と出典つきで確かめます。</p>
                </div>
                <span className={s.stepArt}>
                  <ResultArt />
                </span>
              </li>
            </ol>
          </div>
        </section>

        {/* ⑦ この診断が守っていること（画像の「安心して…」は品質の自称なので、役割を名乗る見出しにする） */}
        <section className={s.trust} id="trust" aria-labelledby="trust-title">
          <div className={s.trustInner}>
            <SectionHead
              id="trust-title"
              title={
                <>
                  <span className={s.nowrap}>この診断が</span>
                  <span className={s.nowrap}>守っていること</span>
                </>
              }
              lead="保険を売らない立場で、計算に基づく診断を返します。"
            />
            <ul className={s.trustCards}>
              <li className={s.trustCard}>
                <span className={s.trustIcon}>{Icon.shield(34)}</span>
                <div>
                  <h3>中立な立場</h3>
                  <p>保険の商品や会社をすすめません。申込みへの案内も置いていません。</p>
                </div>
              </li>
              <li className={s.trustCard}>
                <span className={s.trustIcon}>{Icon.brain(34)}</span>
                <div>
                  <h3>AIが金額を作らない</h3>
                  <p>
                    金額と判定は計算エンジンが出します。AIは説明の言葉だけを書き、数字は変えられません。
                  </p>
                </div>
              </li>
              <li className={s.trustCard}>
                <span className={s.trustIcon}>{Icon.lock(34)}</span>
                <div>
                  <h3>回答を保存しない</h3>
                  <p>回答は保存しません。結果は、URLに入った回答からその場で計算します。</p>
                </div>
              </li>
            </ul>
          </div>
        </section>

        {/* ⑧ よくある質問 */}
        <section className={s.faq} id="faq" aria-labelledby="faq-title">
          <div className={s.faqInner}>
            <SectionHead id="faq-title" title="よくある質問" center />
            <div className={s.faqList}>
              <details>
                <summary>保険をすすめられますか？</summary>
                <p>
                  すすめません。特定の商品名や会社名は出さず、申込みへの案内もありません。必要がなければ「上乗せは要らない」とお伝えします。
                </p>
              </details>
              <details>
                <summary>金額はどのくらい正確ですか？</summary>
                <p>
                  概算です。回答の幅を反映して「約◯〜◯万円」の幅でお出しし、計算の前提・基準日・使った制度の数値の版を結果画面に示します。
                </p>
              </details>
              <details>
                <summary>どんな「もしも」を見ますか？</summary>
                <p>
                  死亡（本人・配偶者）、病気・けが（短期と長期の休職）、失業を計算します。1年半を超えて働けない場合は、まだ計算していないことを結果画面で示します。
                </p>
              </details>
              <details>
                <summary>制度が変わったら、計算は古くなりませんか？</summary>
                <p>
                  公的機関のページとの違いを見つけると、運営画面の承認待ちに入ります。人が根拠を確かめて承認してから、計算に取り入れます。有効期限を過ぎた制度の数値では、診断を止めます。
                </p>
              </details>
              <details>
                <summary>回答は保存されますか？</summary>
                <p>
                  保存しません。結果画面の URL に回答が入っていて、開くたびにその場で計算します。
                </p>
              </details>
            </div>
          </div>
        </section>

        {/* ⑨ 最後の入口 */}
        <section className={s.closing} aria-labelledby="closing-title">
          <div className={s.closingBand}>
            <Skyline className={s.closingSkyline} tone="onBlue" />
            <Leaf className={`${s.leaf} ${s.leafClosingA}`} />
            <Leaf className={`${s.leaf} ${s.leafClosingB}`} />
            <p className={s.closingHand} aria-hidden="true">
              今の暮らしから、
              <br />
              これからの備えへ。
            </p>
            <h2 id="closing-title" className={s.closingTitle}>
              <span className={s.nowrap}>
                まずは、<span className={s.closingAccent}>約10問</span>で
              </span>
              <span className={s.nowrap}>診断してみませんか？</span>
            </h2>
            <Link className={`${s.btn} ${s.btnWhite}`} href="/wizard">
              約10問で診断する
              {Icon.arrow()}
            </Link>
            <p className={s.closingNote}>登録はいりません。答え終わるとすぐ結果を表示します。</p>
          </div>
        </section>
      </main>

      <footer className={s.footer}>
        <Logo />
        <p>
          現在は検証版です。診断の金額は概算で、確定した値ではありません。保険の商品名・会社名は扱いません。
        </p>
      </footer>
    </div>
  );
}
