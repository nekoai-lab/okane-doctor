/**
 * 診断 API の境界で、対象外の世帯が止まることを確かめる（2026-10-16・QA で blocking）。
 * 画面だけで止めていたため、API からはひとり親世帯の誤った金額が正常応答で返っていた。
 */
import { describe, expect, it } from "vitest";
import { POST } from "./route.js";

const MAN = 10_000;
const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/diagnose", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

describe("POST /api/diagnose の対象外", () => {
  it("配偶者なし・独立前の子ありは 422 で止め、金額を返さない", async () => {
    const res = await post({
      self: { age: 36, income: 500 * MAN, employment: "employee" },
      spouse: null,
      children: [6],
      housing: { type: "rent" },
      assets: 0,
      monthlyLiving: 25 * MAN,
      educationPlan: "public",
      coverageSelf: 1000 * MAN,
    });
    expect(res.status).toBe(422);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.error).toBe("out_of_scope");
    expect(body.self).toBeUndefined();
  });

  it("単身（子なし）はこれまでどおり診断する", async () => {
    const res = await post({
      self: { age: 30, income: 500 * MAN, employment: "employee" },
      spouse: null,
      children: [],
      housing: { type: "rent" },
      assets: 300 * MAN,
      monthlyLiving: 20 * MAN,
      educationPlan: "public",
      coverageSelf: 1000 * MAN,
    });
    expect(res.status).toBe(200);
  });
});
