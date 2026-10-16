# ARCHITECTURE — okane-doctor

詳しい図は `docs/アーキテクチャ図.html`・`docs/データモデル図.md`。ここは入口の要約。

## 構成

- Next.js（App Router）1つのアプリ。Cloud Run の1サービス（`okane-doctor`）で動く
- `src/calc/`：算定エンジン。**金額を作る唯一の場所**（純粋関数）
- `params/*.yaml`：制度パラメータ（値・単位・出典・有効期間・verified）。実行時に読む
- `src/narrate/`：AI 言語化とガードレール（AI は数値を書かない）
- `src/paramwatch/`：制度監視（一次情報 → 変更提案 → 人の承認）
- `src/watch/`：気づき通知（okane-doctor では Slack・定期実行をつながない）
- `src/firestore/db.ts`：Firestore の入口。データベース名は `FIRESTORE_DATABASE_ID`（未設定なら止まる）
- `app/`：画面（LP・ウィザード・診断結果・もしもラボ・運営画面）と API

## データの流れ

回答（URL クエリ。金額は載せない）→ `src/calc` が試算 → 画面が描く。
AI 言語化は算定結果をプレースホルダつきの文章にするだけで、金額はクライアントが差し込む。
制度監視の提案と見守り世帯は Firestore（名前つきデータベース `okane-doctor`）に置く。

## 外部サービス

| サービス | 用途 | 本番／開発 |
|---|---|---|
| Cloud Run | アプリの実行（`okane-doctor`） | 本番 |
| Cloud Build | main への push でビルド・デプロイ（トリガー `deploy-doctor`） | 本番 |
| Firestore | 制度監視の提案・記録、見守り世帯（データベース `okane-doctor`） | 本番 |
| Secret Manager | 鍵の保管 | 本番 |
| Gemini API | AI 言語化 | 本番・開発 |

同じ GCP プロジェクトに、審査中の提出版（サービス `okane-kenko`・既定の Firestore）がある。**そちらには触らない。**

## 鍵の変数名

<!-- 変数名だけ。値は書かない -->

| 変数名 | 用途 | 置き場所（.env.local / GitHub シークレット など） |
|---|---|---|
| `GEMINI_API_KEY` | AI 言語化 | .env.local／Secret Manager `gemini-api-key` |
| `GEMINI_MODEL` | 言語化のモデル名（任意・秘密ではない） | .env.local |
| `ADMIN_PASSWORD` | 運営画面の合言葉 | .env.local／Secret Manager `admin-password-doctor` |
| `FIRESTORE_DATABASE_ID` | Firestore のデータベース名（秘密ではない） | .env.local／`cloudbuild.yaml` の環境変数 |
| `SLACK_WEBHOOK_URL`・`WATCH_CRON_SECRET`・`WATCH_BASE_URL` | 気づき通知・定期実行（okane-doctor では未設定） | — |
| `NTFY_TOPIC` | CI 失敗の通知 | GitHub シークレット |
