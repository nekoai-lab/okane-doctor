// gcloud ガード（.claude/hooks/guard-gcloud.sh）の回帰テスト。
// フックに PreToolUse の JSON を標準入力で渡し、終了コードだけを見る。gcloud は動かさない。
import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "vitest";

const hook = fileURLToPath(new URL("../../.claude/hooks/guard-gcloud.sh", import.meta.url));

function runHook(command: string) {
  const input = JSON.stringify({ tool_name: "Bash", tool_input: { command } });
  return spawnSync("bash", [hook], { input, encoding: "utf8", timeout: 30_000 });
}

// シェルはバックスラッシュ＋改行を空白なしで取り除く（gcl\<改行>oud は gcloud）
const blocked = [
  "gcl\\\noud run deploy svc --region asia-northeast1",
  "gcloud config set pro\\\nject p1",
  "gcloud run deploy svc --region asia-northeast1",
];

const allowed = [
  "ls -la && echo hello",
  "gcl\\\noud run deploy svc --project p1 --region asia-northeast1",
  "gcloud run deploy svc \\\n  --project p1 --region asia-northeast1",
];

for (const command of blocked) {
  test(`行継続で分けても --project の無い gcloud は止める: ${JSON.stringify(command)}`, () => {
    const result = runHook(command);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /ブロック/);
  });
}

for (const command of allowed) {
  test(`無害なコマンドと --project のある gcloud は通す: ${JSON.stringify(command)}`, () => {
    const result = runHook(command);
    assert.equal(result.status, 0);
    assert.equal(result.stderr, "");
  });
}
