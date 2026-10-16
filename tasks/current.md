レーン: full

# 今の作業 — okane-doctor

- 更新日: 2026-10-16
- 担当エージェント: Claude Code
- レビュー: PR #1 を Codex（request-qa）で再レビュー待ち

<!-- 上限で交代するときは、次のエージェントがこのファイルだけ読めば続きができるように書く -->

## 現状

- new-project で作成（2026-10-16）
- 提出版 `nekoai-lab/okane-kenko@e35a072` の中身を取り込む PR（ハーネスとの統合・本番に触る箇所の直し）
- 1回目の QA で blocking 2件 → 応急処置を入れた：ひとり親世帯は金額を出さず「まだ診断できません」、保存（お知らせ）は止めた（`src/watch/availability.ts`）
- 2回目の QA で blocking 3件 → 直した：対象外の判定を `diagnose` の入口へ移して API も 422 で止める（`src/calc/scope.ts`）、暮らし方の目盛りを幅の両端にも渡す（`bandInputsFor`）、組み替えの余地は減らせる額 ≧ 不足額のときだけ（`verdict3.ts`・`index.ts`・仕様書 §1）
- 判定の規則の変更は ADR-023 に記録した（オーナー確認済み）
- 3回目の QA で blocking 2件 → 直した：言語化 API でも暮らし方の目盛りを復元、自営・公務員の失業の行は「計算未対応」で空欄（雇用保険の基本手当が無いため。オーナー選択）

## やり残し

- PRODUCT.md を人が書く
- ひとり親世帯（配偶者なし・独立前の子あり）の算定を作る：子の生活費・遺族基礎年金・検算表・ゴールデン。できたら `src/calc/scope.ts` の判定を外す
- 保存の直後にトークンつきの管理・削除 URL を本人に渡す。できたら `SAVE_ENABLED` を true に戻す
- 自営・公務員の失業の行を計算する（基本手当ゼロで生活資金を出す）。できたら `simulate.ts` の not_supported を外す
- `src/paramwatch/judge.ts` が未計算の金額を `?? 0` で0扱いしている。空欄の行を「動いた／動かない」の判定から外す
- GCP の初回セットアップ（`docs/本番前チェックリスト.md`「G-0」。人の操作）
- 初回デプロイの URL で `params/watch-sources.yaml` の罠ページ（`demoTrap`）を差し替える
- 最終課題の4日間の計画：プロジェクトの共有フォルダ `okane-kenko/2026-10-16_final-assignment-plan.md`

## 次の1手

- 取り込み PR をマージ → G-0 のセットアップ → 初回デプロイ
