import { defineConfig } from "vitest/config";
export default defineConfig({
  // 部品（.tsx）を node で描いて確かめるテストのため。Next と同じ自動ランタイムにする
  esbuild: { jsx: "automatic" },
  test: { include: ["src/**/*.test.ts", "app/**/*.test.ts"], reporters: ["verbose"] },
});
