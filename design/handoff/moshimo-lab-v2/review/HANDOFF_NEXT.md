# HANDOFF_NEXT — デザイン承認後の実装（2026-10-17）

**このファイルの手順は、Naomi さんのデザイン承認のあとで始める。** 承認前は本番コードに入れない。

## 前提

- アプリ本体は PR #1（`chore/import-okane-kenko`）で main に入る予定。もしもラボは PR #2（`feat/moshimo-lab`）
- 正本：Fintech A の値は `design/handoff/moshimo-lab-v2/tokens/`、画面は `design/handoff/moshimo-lab-v2/index.html`（このレビュー修正版）
- 役割：実装は Claude Code、独立 QA は Codex（`bin/request-qa` → `qa-pass`）、UX 承認は ChatGPT＋Naomi さん（`ux-pass`）

## 実装の順番（案）

1. **トークン**：Fintech A の値を `src/design/tokens.css` のセマンティックトークンとして入れる（ブランド・文字・面・判定・グラフ）。プリミティブ（`--ml-*`）は UI から直接参照しない。フォーカスリングと判定の「アイコン＋ラベル＋色」は現行のまま残す。CLAUDE.md・`docs/デザイン方針.md` の「デザイン」節を同じ PR で書き換える（DESIGN_DECISIONS の表）
2. **共通部品**：ヘッダー、下部ナビ、カード、ボタン3種、判定バッジ（`SAVINGS_LABEL`・`DEATH_LABEL` を引く。手打ちしない）、注記、開閉。金額は既存の `AmountRange`／`formatRange` を使う
3. **もしもラボ（`/lab`）**：PR #2 の `Lab.tsx` の見た目を差し替える。グラフは `calculateLab` の `points` から描く（試作の `makeChart` と同じ考え方。汎用チャートライブラリは使わない）。前提・出典はエンジンの `assumptions`・`sources` を表示
4. **診断結果（`/result`）**：冒頭にサマリー（死亡保障＋医療・休職の判定の数）を置く（2026-10-17 決定）。報告書としての4ステップの構成は崩さない
5. **ガイド**：今回の範囲（もしもラボと診断結果）の外なので保留。作るときは、判定の説明を `verdict3`・`verdictBySavings` の定義どおりにする（試作の文言を使ってよい）
6. 履歴・比較は保存と個人情報の設計が終わるまで出さない

**ホーム（トップ LP）はこの順番に入れない（2026-10-17）。** LP は別に作り直している（ChatGPT がモックを作り、最終課題のスレッドが Next.js に移す）。二重作業を避けるため、v2 デザインを入れるのはもしもラボと診断結果だけ。トークン・共通部品・イラスト（`public/illustrations/`）は LP も使うので、そのまま共通で用意する。

各ステップを1 PR にする（1 Issue = 1 Branch = 1 Worktree）。UI の変更があるので、どの PR も 390px のスクショと主要操作の通し（Playwright）を PR に書く。

## Codex 向け独立 QA 項目

### 数値と判定
- [ ] 画面のすべての金額・判定が `calculateLab`／`diagnose` の出力と一致する（手入力の値がない）
- [ ] スライダーの25点（40〜64歳）が `points` と一致し、年・子の年齢・判定も切り替わる
- [ ] 未算定が 0円 と表示されない。障害の行は未算定のまま
- [ ] 死亡保障と医療・休職を合計・順位づけしていない
- [ ] グラフの縦軸が金額に比例し、帯が low〜high、線が middle（代表値）
- [ ] 判定ラベルが `SAVINGS_LABEL`／`DEATH_LABEL` から引かれている

### 入力
- [ ] 現行ウィザードの質問が減っていない。URL の復元（`/lab?v=1&...`）が壊れていない
- [ ] 試作の「本人の年齢」セレクトを持ち込んでいない（生年で聞く）

### 表現
- [ ] 商品名・申込誘導・恐怖を煽る文言がない
- [ ] 「不足」を赤や CTA 色で塗っていない
- [ ] 判定が「アイコン＋ラベル＋色」の3点

### 画面と操作
- [ ] 320 / 375 / 390 / 430 / 1280px で横スクロールなし
- [ ] 本文 14px 以上、ラベル・脚注 12px 以上
- [ ] 操作要素 44px 以上、Tab で全操作に到達でき、Yellow-300＋Black のリングが見える
- [ ] 文字コントラスト 4.5:1 以上（axe-core で違反 0）
- [ ] 開閉・スライダー・選択に適切な `aria-*`（`aria-pressed`・`aria-valuetext`・`aria-current`）

### イラスト
- [ ] 承認済み C の画像だけを使い、人物・画風を変えていない
- [ ] 文字を顔に重ねていない。装飾画像は `alt=""`、意味のある画像は短い代替テキスト
- [ ] 属性未確定のときに家族の画像を一律に出していない（素材がそろってから）

## 試作の作り直し方

```bash
# 試作を作り直す（sample-data.json から数値を埋め込む）
python3 -I design/handoff/moshimo-lab-v2/tools/build.py \
  design/handoff/moshimo-lab-v2/tools/prototype.template.html \
  design/handoff/moshimo-lab-v2/sample-data.json \
  design/handoff/moshimo-lab-v2
# スクショと計測（Playwright の Chromium が要る。capture.cjs の require と executablePath を環境に合わせる）
node design/handoff/moshimo-lab-v2/tools/capture.cjs design/handoff/moshimo-lab-v2 /tmp/shots
```
