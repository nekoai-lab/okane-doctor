import { defineConfig } from "vitest/config";
export default defineConfig({
  // 部品（.tsx）を node で描いて確かめるテストのため。Next と同じ自動ランタイムにする
  // （Vite 8 で esbuild の設定は非推奨になり oxc に置き換わった。oxc の既定も automatic だが、意図として明示する）
  oxc: { jsx: { runtime: "automatic" } },
  test: { include: ["src/**/*.test.ts", "app/**/*.test.ts"], reporters: ["verbose"] },
});
