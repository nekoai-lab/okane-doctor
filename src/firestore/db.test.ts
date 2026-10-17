import { describe, expect, it } from "vitest";
import { firestoreDatabaseId } from "./db.js";

// 本番（okane-kenko）と同じ GCP プロジェクトで動くので、既定のデータベースに黙って書き込まないことを固定する
describe("firestoreDatabaseId", () => {
  it("設定された名前を返す", () => {
    expect(firestoreDatabaseId({ FIRESTORE_DATABASE_ID: "okane-doctor" })).toBe("okane-doctor");
  });

  it("未設定・空なら止める（既定のデータベースに落ちない）", () => {
    expect(() => firestoreDatabaseId({})).toThrow(/FIRESTORE_DATABASE_ID/);
    expect(() => firestoreDatabaseId({ FIRESTORE_DATABASE_ID: "  " })).toThrow(/FIRESTORE_DATABASE_ID/);
  });

  it("既定のデータベースを名前で指定しても止める", () => {
    expect(() => firestoreDatabaseId({ FIRESTORE_DATABASE_ID: "(default)" })).toThrow();
  });
});
