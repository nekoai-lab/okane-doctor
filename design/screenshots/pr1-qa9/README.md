# PR #1 結果画面のスクショ（9回目の QA の直しのあと）

- コミット：`76acb2d`（chore/import-okane-kenko）
- 撮り方：本番ビルド（`next build` → `next start`）、幅 390px・全ページ、2026-10-17
- 5枚ともステータス 200・横はみ出しなし・コンソールエラーなし

| ファイル | 世帯 | クエリ（`/result?` に続く） |
|---|---|---|
| result-rebalance-sp.png | 組み替えの余地（代表） | `v=1&sb=1989&emp=employee&sp=1&spb=1991&spe=employee&ch=2024&edu=public&inc=lt600&sinc=lt400&as=lt500&liv=lt30&ho=own_loan&loan=lt3000&dan=yes&cvs=m2000&cvsp=none` |
| result-shortage-sp.png | 不足（代表） | `v=1&sb=1986&emp=self&sp=1&spb=1988&spe=none&ch=2018-2021&edu=private&inc=lt400&sinc=none&as=lt100&liv=lt35&ho=rent&cvs=none&cvsp=none` |
| result-single-sp.png | 単身（代表） | `v=1&sb=1996&emp=employee&sp=0&ch=&inc=lt600&as=lt500&liv=lt25&ho=rent&cvs=m1000` |
| result-qa1-sp.png | QA #1（9回目の指摘1） | `v=1&sb=1986&emp=employee&sp=1&spb=1988&spe=employee&ch=2018-2021&edu=public&inc=lt600&sinc=lt400&as=lt100&liv=estimate&ho=rent&cvs=m1500&cvsp=m300` |
| result-qa2-sp.png | QA #2（9回目の指摘2） | `v=1&sb=1988&emp=employee&sp=1&spb=1990&spe=employee&ch=2021-2024&edu=public&inc=lt600&sinc=lt400&as=lt1000&liv=lt30&ho=rent&cvs=m1000&cvsp=m300` |
