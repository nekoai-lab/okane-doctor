import { defineConfig } from "vitest/config";

/**
 * もしもラボ「言葉で確かめる」の実 AI 検証（ADR-028）専用の設定。`npm test` からは切り離してある。
 *
 * 理由はベイクオフと同じ：実 API を叩いて課金が発生するので、pre-commit の `npm test` に混ぜない。
 * 回数と金額は事前に OK をもらってから回す（VERIFICATION.md）。30文 × 2回 ＝ 60回。
 */

// .env.local の実値をここで読み込む（鍵が無ければハーネス側が skip する）
try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local が無い＝鍵未設定。検証は skip される。
}

export default defineConfig({
  test: {
    include: ["scripts/lab-words-eval.test.ts"],
    reporters: ["verbose"],
    testTimeout: 600_000,
  },
});
