/**
 * Firestore の入口（watch と paramwatch で共有する）。
 *
 * **データベース名は環境変数 `FIRESTORE_DATABASE_ID` から読み、未設定なら止める。**
 * okane-doctor は提出版 okane-kenko と同じ GCP プロジェクトで動く。
 * 既定のデータベース（`(default)`）には審査中の本番の承認記録・見守り世帯が入っているので、
 * 名前を省いて黙って既定に書き込む経路を残さない（壊れたら止まる、の Firestore 版）。
 *
 * 認証は Cloud Run の Application Default Credentials に委ねる（鍵をコードや env に置かない）。
 */
import { getApps, initializeApp } from "firebase-admin/app";
import { type Firestore, getFirestore } from "firebase-admin/firestore";

export function firestoreDatabaseId(env: Record<string, string | undefined> = process.env): string {
  const id = env.FIRESTORE_DATABASE_ID?.trim();
  if (!id) {
    throw new Error(
      "FIRESTORE_DATABASE_ID が未設定です。既定のデータベースには書き込みません（本番と同じ GCP プロジェクトのため）。",
    );
  }
  if (id === "(default)") {
    throw new Error("FIRESTORE_DATABASE_ID に既定のデータベースは指定できません。");
  }
  return id;
}

export function db(): Firestore {
  if (getApps().length === 0) initializeApp();
  return getFirestore(firestoreDatabaseId());
}
