# Development Notes

実装中の設計判断、暫定対応、未解決事項をここに追記する。

## 2026-06-05 MVP 実装

- フロントエンドは React + Vite の TypeScript SPA として `frontend/` に新規作成した。
- NyanPUI は TypeScript SPA 方針と重複するため使用していない。
- WebSocket Push は Nyan8 の Push 実装方式が未確認のため、MVP では 5 秒間隔のポーリングで代替した。キッチン、ホール、顧客履歴で再取得する。
- Nyan8 から NyanQL を内部 HTTP 呼び出しする構成とし、顧客端末から NyanQL は直接呼ばない。
- 会計処理ではフロントエンドから金額を送らず、Nyan8 が NyanQL の精算明細から合計を再計算する。
- `customer_submit_order.js` ではメニュー価格とオプション価格を NyanQL から再取得して注文金額を算出する。

## 2026-06-05 MVP 安定化

- `schema.sql` に開発用の `DROP TABLE IF EXISTS ... CASCADE` を追加し、同じ DB へ再投入できるようにした。
- セッション開始時に席を `occupied` にし、片付け完了時にセッションを `closed`、席を `available` に戻す `cleanup_complete` API を追加した。
- 注文明細がすべて `served` または `cancelled` になった時点で、注文ヘッダの状態を `served` / `cancelled` に集約するようにした。精算時は注文ヘッダを `closed` にする。
- レジ精算は `payment_requested` のセッションだけを対象にし、精算済みセッションの再精算を拒否する。
- フロントエンドに loading、error、success、空データ表示、二重送信防止を追加した。
- Vite が 5173 から 5174 にフォールバックする開発環境を考慮し、Nyan8 CORS に `http://localhost:5174` を追加した。

## 2026-06-05 NyanQL / Nyan8 実ランタイム対応

- NyanQL / Nyan8 の `config.json` と `api.json` を公式 README 寄りの大文字キー、API名キー指定形式へ変更した。
- NyanQL SQL のパラメータ記法を `:name` から `/*name*/default` 形式へ変更した。
- Nyan8 JavaScript は CommonJS / Node.js 依存をやめ、`javascript_include("./lib/runtime.js")` と Nyan8 組み込み関数を使う形へ再構成した。
- NyanQL の `success/status/result` 形式を扱えるように Nyan8 側の `rows()` / `first()` 相当処理を更新した。
- 片付け完了APIは `cleanup_complete.sql` / `sessions/cleanup-complete` に統一した。
- 実行補助として `scripts/check-runtime.sh`, `scripts/start-nyanql.sh`, `scripts/start-nyan8.sh`, `scripts/dev-reset-db.sh`, `scripts/smoke-nyanql.sh`, `scripts/smoke-e2e.sh` を追加した。

## 2026-06-05 顧客メニュー表示経路の確認

- DB 直接確認では `menu_categories` が 4 件、`menu_items` が 6 件あり、全カテゴリ・全商品が `active = TRUE` だった。`menu_items.category_id` はすべて `menu_categories.id` と一致していた。
- `backend/nyanql/sql/list_menu.sql` は `menu_categories` と `menu_items` の JOIN 後、オプション選択肢の展開を含めて 9 行を返すことを確認した。DB 側にカテゴリ不足、非 active、category_id 不一致はなかった。
- NyanQL `/menu` の実レスポンスは HTTP 200 の `{"success":true,"status":200,"result":[...]}` 形式で、SQL 結果行は `result` 配列に入る。
- Nyan8 `/api/customer/menu?terminal_code=customer-T01` の実レスポンスは HTTP 200 の `{"success":true,"status":200,"result":{"categories":[...]}}` 形式で、`client.ts` の `result` unwrap 後に `data.categories` が存在する。
- ブラウザから Nyan8 を別 origin で呼ぶ場合、GET に `Content-Type: application/json` を付けると CORS preflight の OPTIONS が発生し、Nyan8 が通常 API として扱って `terminal_code is required` 相当の 400 を返す。GET では `Content-Type` を送らず、body があるリクエストだけ JSON ヘッダーを付けるようにした。
- `CustomerOrderPage` は API 失敗、カテゴリ 0 件、選択カテゴリの商品 0 件を画面上で判別できる文言へ調整した。
- メニュー経路専用の確認用に `scripts/smoke-menu.sh` を追加した。

## 2026-06-10 Phase 2 MVP 業務フロー完成

- `./scripts/check-runtime.sh` は `.local/bin/nyanql` と `.local/bin/nyan8` を検出して成功した。
- `./scripts/dev-reset-db.sh` はローカル PostgreSQL に対して `schema.sql` / `seed.sql` を再投入し、成功した。
- `./scripts/smoke-nyanql.sh` は `bootstrap`, `menu`, `sessions/current`, `checkout/summary`, `analytics/summary` の NyanQL 疎通に成功した。
- `./scripts/smoke-menu.sh` は `psql` の `list_menu.sql`、NyanQL `/menu`、Nyan8 `/api/customer/menu` のメニュー経路に成功した。
- `./scripts/smoke-e2e.sh` は注文、キッチン受付、調理開始、調理完了、配膳、会計依頼、レジ精算、片付け、席の空席復帰、分析反映まで成功した。最終確認では `sales_total=495`, `payment_count=1`, 商品ランキング 1 件を確認した。
- 失敗したステップ: 初回の不正遷移確認で、`assertTransition` が投げた業務エラーオブジェクトを Nyan8 が JavaScript 実行エラーとして扱い、HTTP 500 の `{"error":"Failed to run JavaScript"}` を返した。
- 原因: 各 Nyan8 API エントリが `JSON.stringify(handler())` を直接実行しており、`throw error(...)` を API レスポンスへ正規化する共通 catch がなかった。
- 修正内容: `backend/nyan8/javascript/lib/runtime.js` に `run(handler)` を追加し、全 API エントリを `run(...)` 経由へ変更した。業務エラーは `success:false`, `status`, `message`, `result:null` として返る。会計依頼、注文明細更新、配膳完了、片付け完了では DB 更新結果が空の場合に明示エラーを返すようにした。
- `scripts/smoke-e2e.sh` を強化し、各ステップ名、HTTP ステータス、`success`、`result` unwrap、必須 ID、`order_item_id` / `serve_task_id` / `clean_task_id` / `payment_id`、直前レスポンス表示、分析値検証、不正操作拒否検証を追加した。`jq` には依存せず、Node.js で JSON を検証する。
- ブラウザ手動確認結果: `/customer/T01` で商品表示、カート追加、注文確定、注文履歴 1 件、会計依頼、会計依頼後の追加注文 disabled を確認した。`/kitchen` で `ordered -> accepted -> cooking -> ready` を確認した。`/hall` で配膳タスクと片付けタスクの開始・完了を確認した。`/checkout` で T01 の明細、小計 450 円、税 45 円、合計 495 円、card 精算、精算後の再精算不可を確認した。`/analytics` で売上 495 円、会計件数 1 件、ブレンドコーヒーランキング、card 1 件 / 495 円を確認した。
- `cd frontend && npm install` は成功したが、ローカル環境の `pyenv: cannot rehash` と npm ログ作成権限の警告が出た。依存関係は up to date だった。
- `cd frontend && npm run build` は TypeScript build と Vite build に成功した。
- 未確認項目: 複数明細・複数席の同時進行、キャンセルを含む注文集約、`staff_call` / `checkout_support` タスクの副作用、実ブラウザでの CSV ダウンロード内容、Nyan8 が JSON 内の `status` を HTTP ステータスへ反映するかは未確認。
- 次に対応すべき課題: Nyan8 業務エラーの HTTP ステータス反映可否をランタイム仕様で確認する。E2E 後にテスト用の追加セッションが残らないよう、売切商品拒否検証を独立テーブルまたは DB トランザクション相当に分離する。複数明細時の `orders.status` 集約と片付け完了の境界条件を追加 smoke で確認する。
