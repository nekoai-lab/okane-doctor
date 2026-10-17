/**
 * 保存（お知らせを受け取る）を受け付けるか（2026-10-16・QA で blocking）。
 *
 * **okane-doctor では止めている。** 保存した人が自分の記録へ戻る道は、お知らせに載せる
 * `/notice/<token>` だけで、okane-doctor はお知らせ（Slack）をつながない構成にしている
 * （前身の okane-kenko との二重通知を避けるため。cloudbuild.yaml 参照）。
 * このまま保存を受け付けると、「いつでも削除できます」と言いながら**消す手段のない記録**が残る。
 *
 * 保存の直後にトークンつきの管理・削除 URL を本人に渡す作りにしたら、true に戻す。
 */
export const SAVE_ENABLED = false;
