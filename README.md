# お金の町医者（okane-doctor）

風邪をひいたら近所の医者に行って、聞かれて、診てもらって、合う薬をもらい、あとで気になることを気軽に聞ける。
その距離感で、家計の「もしも」に根拠つきで答える診断アプリです。

- 10問に答えると、万一のときに必要な保障を**幅（レンジ）**で出し、いまの保障と比べます
- 金額は決定的な算定エンジンだけが作り、AI は言葉にするだけで金額を書きません
- 保険を売りません。必要ないなら「入らなくていい」と言えることを芯にしています

第5回 Agentic AI Hackathon with Google Cloud の提出版 [nekoai-lab/okane-kenko](https://github.com/nekoai-lab/okane-kenko)（`e35a072`）の後継です。提出版は審査が終わるまでそのまま残しています。

ルールは [CLAUDE.md](CLAUDE.md)、今の作業は [tasks/current.md](tasks/current.md)。

## 動かす

```bash
npm ci
npm run dev        # http://localhost:3000
npm test           # ゴールデンテスト10世帯ほか
```

## ライセンス

[LICENSE](LICENSE) と [NOTICE.md](NOTICE.md) を参照。
