# okane-doctor

<!-- このリポジトリのルールの正本。AGENTS.md（Codex 用）はここを指すだけ -->

## 概要

（1〜2行で：誰の・何を楽にするものか。詳しくは PRODUCT.md）

## よく使うコマンド

| 用途 | コマンド |
|---|---|
| install | `（未定）` |
| dev | `（未定）` |
| lint | `（未定）` |
| test | `（未定）` |
| build | `（未定）` |

## レーン

`full`（正本は `tasks/current.md` の1行目。基準は `~/Projects/ai-dev-harness/policies/lanes.md`）

## 共通ルール

作業の前に `~/Projects/ai-dev-harness/bin/preflight` を実行し、`~/Projects/ai-dev-harness/policies/` を読むこと。
検証の量（実 AI は事前に回数と金額を出して OK をもらう、止める条件、スクショの枚数、リスクの段階）は [VERIFICATION.md](VERIFICATION.md) に従う。

- git-flow.md：ブランチ → PR → CI・レビュー → テストが通れば AI がマージ
- agents.md：役割、1 Issue = 1 Agent = 1 Branch = 1 Worktree（`~/Projects/okane-doctor.wt/<branch>/`）、交代の順番
- lanes.md：full / solo
- secrets.md：鍵の値は表示しない。`.env*` は .gitignore

## 完了の定義

- [ ] build・lint・test が通る
- [ ] `tasks/current.md` を更新した（現状／やり残し／次の1手）
- [ ] PR を作り、CI が通った
- [ ] full は、実装者と別の AI のレビューでラベル `qa-pass`（UI の変更ありは `ux-pass` も）が付いた。付かないうちはマージしない。QA のあとに足したコミットが `design/`・`tasks/` の docs だけなら `qa-pass` はそのまま使える。1ファイルでも docs 以外があれば request-qa をやり直す

## このリポジトリ固有のルール

（あれば書く）
