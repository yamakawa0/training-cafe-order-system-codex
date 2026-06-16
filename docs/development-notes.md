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

## 2026-06-10 Phase 2.5 MVP 境界条件・複数データ検証

- 追加した smoke script: `scripts/lib/smoke-lib.sh`, `scripts/smoke-order-multiple-items.sh`, `scripts/smoke-multiple-tables.sh`, `scripts/smoke-cancel-flow.sh`, `scripts/smoke-staff-call.sh`, `scripts/smoke-checkout-csv.sh`, `scripts/smoke-invalid-operations.sh`。
- `./scripts/smoke-menu.sh`: 成功。
- `./scripts/smoke-e2e.sh`: 既存 happy path は引き続き成功。
- `./scripts/smoke-order-multiple-items.sh`: 成功。同一注文で `orders=1`, `order_items=2`、片方 ready では `orders.status <> served`、全 served 後 `orders.status=served`、会計 `subtotal=950`, `tax=95`, `total=1045`、商品ランキング 2 商品を確認した。
- `./scripts/smoke-multiple-tables.sh`: 成功。T01 / T02 の同時セッションと注文、T01 のみ配膳・精算・片付け、T01 だけ `available`、T02 は `occupied` のままを確認した。
- `./scripts/smoke-cancel-flow.sh`: 成功。`ordered/accepted/cooking -> cancelled` を許可、`ready -> cancelled` を拒否、全キャンセル時 `orders.status=cancelled`、一部 served / 一部 cancelled 時 `orders.status=served`、キャンセル明細の会計・分析除外を確認した。
- `./scripts/smoke-staff-call.sh`: 成功。注文なしでも席セッションがあれば staff_call 作成可能、ホール API 取得、`todo -> doing -> done`、完了済み再完了拒否、存在しない table_code と顧客端末以外の拒否を確認した。
- `./scripts/smoke-checkout-csv.sh`: 成功。精算後に CSV データとして `paid_date,payment_no,method,table_code,menu_item_id,item_name,quantity,sales_total` ヘッダーと売上行を確認した。
- `./scripts/smoke-invalid-operations.sh`: 成功。端末種別違反、`ordered -> ready`, `ready -> accepted`, `served -> cooking`, `cancelled -> cooking`、完了済み hall task 再完了、精算済み再精算、会計依頼後追加注文、存在しない ID / table_code / terminal_code の拒否を確認した。
- 失敗したステップ: 初回 CSV direct response 実装で `/api/analytics/export-sales-csv` が HTTP 500 `Failed to parse JavaScript response` になった。
- 原因: Nyan8 ランタイムが JavaScript 戻り値を JSON として parse するため、CSV 本文を直接返すと parse エラーになる。
- 修正内容: CSV API を `success/status/result` の JSON ラップ仕様へ統一し、`result.contentType`, `result.filename`, `result.csv` を返すようにした。フロントエンド `/analytics` は API から取得した CSV 文字列を Blob 化してダウンロードする。
- Nyan8 の HTTP ステータス反映: `success:false` の JSON 内 `status` が HTTP ステータスにも反映されることを、403/404/409 の実レスポンスで確認した。
- `cd frontend && npm install`: 成功。既存同様、`pyenv: cannot rehash` と npm ログ作成権限、Node 16 に対する `node-releases` の engine warning が出た。
- `cd frontend && npm run build`: 成功。
- 未確認として残す項目: `checkout_support` タスクの業務副作用、実ブラウザでの CSV ファイル保存ダイアログ、複数オプション価格を含む CSV 行、長時間運用時のポーリング競合、同一席での二重セッション開始競合。
- 次に対応すべき課題: Phase 3 では在庫・売切更新の管理 API、CSV direct download が必要な場合の Nyan8 ランタイム拡張可否、`checkout_support` の仕様化、複数端末同時操作時の競合制御を検討する。

## 2026-06-10 Phase 3 フロントエンド品質改善・UI デザイン反映

- UI 改善した画面: `frontend/src/pages/CustomerOrderPage.tsx`, `KitchenPage.tsx`, `HallPage.tsx`, `CheckoutPage.tsx`, `AnalyticsPage.tsx`。
- 追加した共通コンポーネント: `frontend/src/components/ui.tsx` に `AppHeader`, `Badge`, `StatusPill`, `EmptyState`, `Banner`, `SectionTitle`, `SummaryCard`, `TerminalIndicator` を追加した。
- CSS / スタイル構成: `frontend/src/styles/global.css` を共通 UI、顧客注文、キッチンカンバン、ホールフロアマップ、レシート、分析ダッシュボード向けに再構成した。色は cream / warm beige / dark brown / muted green / accent orange / error red / status blue-green-yellow を使用した。
- 顧客注文画面: 店舗名、テーブル番号、セッション状態、カテゴリピル、商品カード、売切・アレルギー・オプションバッジ、商品詳細モーダル、必須/任意オプション選択、顧客メモ、カート数量 `+` / `-`、削除、小計/税/合計、注文確定、会計依頼、注文履歴明細を表示するようにした。会計依頼後または精算済みは注文操作を視覚的にロックする。
- キッチン画面: `ordered`, `accepted`, `cooking`, `ready` の 4 列カンバンに変更し、テーブル番号、商品名、数量、オプション、顧客メモ、アレルギー、経過時間、状態、受付/調理開始/調理完了/取消ボタンをカードにまとめた。長時間経過は warning / danger 表示にする。更新中カードだけ disabled 表示にする。
- ホール画面: 配膳、片付け、スタッフ呼び出し、会計サポートを種別ごとに分け、タスクカードにテーブル、種別、メモ、経過時間、優先度、状態、対応開始/完了/取消を表示した。簡易フロアマップで `available`, `occupied`, `cleaning`, `payment_requested`, `staff_call` 相当の状態を推定表示する。
- レジ精算画面: T01-T04 のテーブル選択をカード型にし、会計依頼済み席を優先選択する。精算対象明細をレシート風に表示し、支払い方法 `cash/card/qr` をカード型ボタンにした。精算完了後は receipt number を表示する。
- 分析画面: 本日売上、会計件数、注文件数、平均客単価の KPI カード、商品ランキングのバー表示、支払い方法別集計、最終更新時刻、CSV ダウンロード成功/失敗メッセージを追加した。
- 共通エラー表示: `frontend/src/api/client.ts` で通信エラー、JSON parse エラー、Nyan8 業務エラーを画面向け文言へ整形し、`Failed to run JavaScript` のような低レベルエラーをそのまま出しにくくした。
- 手動確認結果: Vite dev server `http://localhost:5173` で `/customer/T01`, `/customer/T02`, `/kitchen`, `/hall`, `/checkout`, `/analytics` をブラウザ確認した。T01 は会計後ロック表示と注文履歴、T02 は商品カードとオプションモーダル、キッチンは 4 列カンバン、ホールはフロアマップと片付けタスク、レジは 4 席カードとレシート領域、分析は KPI / ランキング / 支払い方法別集計を確認した。1280px 前後の横幅で不要な水平スクロールは発生しなかった。
- CSV 手動確認: `/analytics` の `CSV ダウンロード` ボタン押下後、`CSV をダウンロードしました: sales-2026-06-10-2026-06-10.csv` の成功バナーを確認した。
- smoke script 再実行結果: `./scripts/dev-reset-db.sh`, `./scripts/smoke-menu.sh`, `./scripts/smoke-e2e.sh`, `./scripts/smoke-order-multiple-items.sh`, `./scripts/smoke-multiple-tables.sh`, `./scripts/smoke-cancel-flow.sh`, `./scripts/smoke-staff-call.sh`, `./scripts/smoke-checkout-csv.sh`, `./scripts/smoke-invalid-operations.sh` はすべて成功した。初回 `smoke-menu.sh` は NyanQL 未起動で失敗したため、`./scripts/start-nyanql.sh` と `./scripts/start-nyan8.sh` を起動して再実行し成功した。
- `npm install`: 成功。依存追加なし。既存同様、`pyenv: cannot rehash`、npm ログ作成権限警告、Node 16 に対する `node-releases` engine warning が出た。
- `npm run build`: 成功。TypeScript build と Vite build が成功した。
- 未対応の UI 課題: 完了済みホールタスクは現在の `GET /api/hall/tasks` が未完了タスクのみ返すため、フィルタでの表示切替は未実装。レジの席一覧は T01-T04 固定で、テーブル一覧 API からの動的取得は未実装。分析の注文件数は専用 API 項目がないため、商品ランキング数量を fallback として表示している。画像の外部 CDN 読み込み失敗時の専用プレースホルダーは未実装。
- 次に対応すべき課題: テーブル一覧 API の追加または bootstrap からの動的席取得、完了済みホールタスク履歴 API、分析サマリの `order_count` 追加、画像 fallback、複数端末同時操作時の楽観更新/競合表示。

## 2026-06-10 Phase 4 メニュー管理機能

- 追加した管理画面: `frontend/src/pages/AdminMenuPage.tsx` と `/admin/menu` ルートを追加した。`/analytics` から「メニュー管理」へ遷移できる導線も追加した。
- DB スキーマ確認: `menu_categories` と `menu_items` は `id`, `category_id`, `name`, `description`, `price`, `tax_rate`, `display_order`, `active`, `sold_out`, `allergy_note`, `created_at`, `updated_at` を既に満たしていたため、スキーマ変更は行わなかった。
- 追加した NyanQL API: `admin/menu/categories`, `admin/menu/items`, `admin/menu/items/create`, `admin/menu/items/update`, `admin/menu/items/toggle-active`, `admin/menu/items/toggle-sold-out`, `admin/menu/items/move`。
- 追加した SQL: `admin_list_menu_categories.sql`, `admin_list_menu_items.sql`, `admin_create_menu_item.sql`, `admin_update_menu_item.sql`, `admin_toggle_menu_item_active.sql`, `admin_toggle_menu_item_sold_out.sql`, `admin_move_menu_item.sql`。
- 追加した Nyan8 API: `GET /api/admin/menu/categories`, `GET /api/admin/menu/items`, `POST /api/admin/menu/items`, `POST /api/admin/menu/items/update`, `POST /api/admin/menu/items/toggle-active`, `POST /api/admin/menu/items/toggle-sold-out`, `POST /api/admin/menu/items/move`。
- 管理者判定: Phase 4 実装時点では `terminal_code=analytics-manager` かつ analytics 端末の場合だけ `/api/admin/*` を許可していた。Phase 6 以降は Bearer token と manager ロールを主条件とし、terminal_code は端末種別・active 判定に使う。
- 顧客注文画面との反映: 顧客メニュー API は既に `active=TRUE` のみを返し、`sold_out=TRUE` は表示しつつ注文確定時に拒否するため、管理画面の編集結果が `/customer/T01` に反映される構成とした。商品名、価格、表示順、アレルギーメモも既存レスポンスに含まれる。
- 追加した smoke script: `scripts/smoke-admin-menu.sh`。DB 初期化、管理者端末でのカテゴリ・商品一覧、商品追加、商品編集、顧客メニュー反映、売切反映、非表示反映、非管理端末拒否、既存 `smoke-menu.sh` / `smoke-e2e.sh` を確認する。
- 確認結果: `./scripts/dev-reset-db.sh`, `./scripts/smoke-admin-menu.sh`, `./scripts/smoke-menu.sh`, `./scripts/smoke-e2e.sh`, `./scripts/smoke-order-multiple-items.sh`, `./scripts/smoke-multiple-tables.sh`, `./scripts/smoke-cancel-flow.sh`, `./scripts/smoke-staff-call.sh`, `./scripts/smoke-checkout-csv.sh`, `./scripts/smoke-invalid-operations.sh` は成功した。
- フロントエンド確認結果: `cd frontend && npm install` は up to date で成功し、既存同様 `pyenv: cannot rehash`、npm ログ権限警告、Node 16 に対する `node-releases` engine warning が出た。`cd frontend && npm run build` は TypeScript build と Vite build に成功した。
- ブラウザ確認結果: Vite dev server `http://localhost:5173` で `/admin/menu` を開き、カテゴリ一覧 4 件、商品一覧 6 件、検索ボックス、カテゴリフィルタ、新規商品フォーム、編集/表示/売切/上下ボタン、コンソールエラーなしを確認した。
- 未対応の管理機能: 本格ログイン認証、権限管理、画像アップロード、在庫数管理、原価管理、複数店舗対応、商品オプション詳細編集、メニューカテゴリのドラッグ&ドロップ並び替え、監査ログ、削除済み商品の復元、席管理、注文管理、スタッフ管理、会員管理、予約、実決済連携。
- 暫定対応: 商品削除は実装せず、非表示化は `active=false` で扱う。商品並び順変更は MVP として `display_order` の増減で画面上の順序を変える。

## 2026-06-11 Phase 4 席・端末管理機能

- 追加した管理画面: `frontend/src/pages/AdminTablesPage.tsx` と `/admin/tables` ルートを追加した。`/analytics` と `/admin/menu` から「席・端末管理」へ遷移でき、`/admin/tables` から「メニュー管理」へ戻れる導線を追加した。
- 追加した Nyan8 API: `GET /api/admin/tables`, `GET /api/admin/tables/detail`, `POST /api/admin/tables/update-status`, `POST /api/admin/tables/force-close-session`, `GET /api/admin/terminals`, `POST /api/admin/terminals/update-active`。
- 追加した NyanQL API: `admin/tables`, `admin/tables/detail`, `admin/tables/status`, `admin/tables/force-close-session`, `admin/terminals`, `admin/terminals/active`。
- 追加した SQL: `admin_list_tables.sql`, `admin_get_table_detail.sql`, `admin_update_table_status.sql`, `admin_force_close_session.sql`, `admin_list_terminals.sql`, `admin_update_terminal_active.sql`。
- 追加した smoke script: `scripts/smoke-admin-tables.sh`。席・端末一覧、非管理端末拒否、注文なしセッション強制クローズ、未精算注文ありセッションの拒否、精算済みセッション強制クローズ、端末無効化と無効端末からの操作拒否、既存 smoke 連携を確認する。
- 既存 API に加えた端末 active チェック: `bootstrap.sql` は無効端末も取得できるようにし、Nyan8 の `assertTerminal` で `active=false` を `この端末は無効です` として拒否する。これにより `POST /api/customer/session/open`, `POST /api/customer/order/submit`, `POST /api/customer/payment/request`, `POST /api/customer/staff-call`, `POST /api/kitchen/item/status`, `POST /api/hall/task/status`, `POST /api/checkout/settle` を含む既存の端末種別チェック付き API に反映される。
- 席状態: DB の `cafe_tables.status` は既存値を優先し、画面/API 上では現在セッション、会計依頼、精算済み、未完了片付けタスクから `occupied`, `payment_requested`, `paid`, `cleaning` を推定表示する。手動更新対象は `available` と `disabled` に限定した。
- 強制クローズ: 注文なしセッション、精算済みセッション、または未精算注文が残っていない異常セッションだけ許可する。未完了 `clean_table` タスクは完了扱い、その他の未完了ホールタスクはキャンセル扱いにする。
- 確認結果: `./scripts/dev-reset-db.sh`, `./scripts/smoke-admin-tables.sh`, `./scripts/smoke-admin-menu.sh`, `./scripts/smoke-menu.sh`, `./scripts/smoke-e2e.sh`, `./scripts/smoke-order-multiple-items.sh`, `./scripts/smoke-multiple-tables.sh`, `./scripts/smoke-cancel-flow.sh`, `./scripts/smoke-staff-call.sh`, `./scripts/smoke-checkout-csv.sh`, `./scripts/smoke-invalid-operations.sh` は成功した。初回に `smoke-staff-call.sh` を他 smoke と並列実行して DB reset が競合し失敗したが、単独再実行では成功した。
- フロントエンド確認結果: `cd frontend && npm install` は up to date で成功した。既存同様、`pyenv: cannot rehash`、npm ログ権限警告、Node 16 に対する `node-releases` engine warning が出た。`cd frontend && npm run build` は TypeScript build と Vite build に成功した。
- ブラウザ確認結果: Vite dev server `http://localhost:5173` で `/admin/tables` を開き、席一覧 4 件、席詳細、現在の注文、未提供明細、支払い情報、関連ホールタスク、端末一覧 6 件、`analytics-manager` の無効化ボタン disabled、コンソールエラーなしを確認した。1280px と 390px 幅で主要操作部品の横はみ出しがないことを確認した。
- 未対応の管理機能: 本格ログイン認証、権限ロール管理、QRコード発行、端末ペアリング処理、席レイアウトのドラッグ&ドロップ編集、複数店舗対応、監査ログ、スタッフシフト管理、予約管理、席の追加・削除、本格端末登録 UI。

## 2026-06-11 Phase 4.5 管理機能の統合修正・ビルド安定化

- 現状確認: `frontend/src/App.tsx` の `/admin/menu` と `/admin/tables` import 先、`frontend/src/pages/AdminMenuPage.tsx`, `AdminTablesPage.tsx`、`frontend/src/api/cafeApi.ts` の管理 API、`frontend/src/domain/types.ts` の管理型、Nyan8 / NyanQL の `/api/admin/*` と SQL、`scripts/smoke-admin-menu.sh`, `scripts/smoke-admin-tables.sh` を確認した。画面コンポーネントと API script は存在し、初回 `npm run build` は成功した。
- 修正した不整合: `AdminMenuItem.updatedAt` を `string | null` に合わせ、管理テーブル更新/強制クローズの frontend API client 戻り値を `unknown` から具体型へ変更した。`/admin/menu` には顧客メニューへ反映されることが分かる説明表示を追加し、更新日時表示を null 安全にした。README の管理機能込み推奨 smoke 実行順に `smoke-admin-menu.sh` と `smoke-admin-tables.sh` を追加した。
- build エラー: TypeScript / import / JSX / API client / 型定義の build エラーは発生しなかった。`npm install` と `npm run build` では既存同様、`pyenv: cannot rehash`、npm ログ権限警告、Node 16 に対する `node-releases` engine warning が出たが、ビルドは成功した。
- frontend API client 確認: `adminMenuCategories`, `adminMenuItems`, `adminCreateMenuItem`, `adminUpdateMenuItem`, `adminToggleMenuItemActive`, `adminToggleMenuItemSoldOut`, `adminMoveMenuItem`, `adminTables`, `adminTableDetail`, `adminUpdateTableStatus`, `adminForceCloseSession`, `adminTerminals`, `adminUpdateTerminalActive` が `terminals.analytics = 'analytics-manager'` を使って Nyan8 の `/api/admin/*` と一致していることを確認した。
- 型定義確認: `AdminMenuCategory`, `AdminMenuItem`, `AdminMenuItemInput`, `AdminTableSummary`, `AdminTableDetail`, `AdminTerminalSummary`, `AdminTableStatusResult`, `AdminForceCloseSessionResult` を管理画面/APIの実レスポンスに合わせた。管理APIレスポンスは Nyan8 側で frontend 向け camelCase に変換している。
- smoke script 実行結果: `./scripts/dev-reset-db.sh`, `./scripts/smoke-admin-menu.sh`, `./scripts/smoke-admin-tables.sh`, `./scripts/smoke-menu.sh`, `./scripts/smoke-e2e.sh`, `./scripts/smoke-order-multiple-items.sh`, `./scripts/smoke-multiple-tables.sh`, `./scripts/smoke-cancel-flow.sh`, `./scripts/smoke-staff-call.sh`, `./scripts/smoke-checkout-csv.sh`, `./scripts/smoke-invalid-operations.sh` は成功した。`smoke-admin-tables.sh` の内部 smoke 後に残った検証セッションのため、単独 `smoke-e2e.sh` 初回は `status=ordering` で失敗したが、`./scripts/dev-reset-db.sh` 後の再実行では成功した。DB reset を含む smoke は並列実行せず、独立実行前に初期化する。
- ブラウザ確認結果: `/admin/menu` でカテゴリ一覧、商品一覧、編集保存、顧客メニュー反映説明、`/admin/tables` 導線、コンソールエラーなしを確認した。`/customer/T01` で管理メニュー保存後も商品表示が継続することを確認した。`/admin/tables` で席一覧、席詳細、端末一覧、`analytics-manager` 無効化 disabled、`customer-T01` の無効化/再有効化、無効化中の `/customer/T01` 操作拒否表示を確認した。`/analytics` から `/admin/menu` と `/admin/tables` への導線を確認した。
- 未対応項目: 本格ログイン認証、権限ロール管理、管理画面からの非管理者端末コード切替テスト UI、商品画像アップロード、商品オプション編集、席追加/削除、端末登録/ペアリング、監査ログ、注文管理画面は未実装のまま。

## 2026-06-11 Phase 4.6 リポジトリ整合性復旧・ビルド安定化

- 破損確認: 作業開始時点の `git status` と `git diff` は空で、明らかな未コミット破損ファイルはなかった。`frontend/src/App.tsx` は `/`, `/customer/:tableCode`, `/kitchen`, `/hall`, `/checkout`, `/analytics`, `/admin/menu`, `/admin/tables` を正常に分岐していた。`frontend/src/pages/` には各 route の page component が存在した。
- API / script 参照確認: `backend/nyan8/api.json` の `script` 参照、`backend/nyanql/api.json` の `sql` 参照はすべて実在した。README に記載された `./scripts/*.sh` 参照もすべて実在した。
- 修正内容: `frontend/src/domain/types.ts` に `ApiResponse`, `TableSession`, `Order`, `OrderItem`, `Payment`, `AnalyticsSummary`, `ItemRanking` を補い、画面・API client が参照しうる主要型を整理した。`frontend/src/api/cafeApi.ts` には既存メソッドを残したまま、復旧指示で求められた命名に近い互換 alias として `orderHistory`, `tickets`, `updateItemStatus`, `tasks`, `updateTaskStatus`, `summary` を追加した。
- build 結果: `cd frontend && npm install` は up to date で成功した。既存同様、`pyenv: cannot rehash`、npm ログ権限警告、Node 16 に対する `node-releases` engine warning が出た。`cd frontend && npm run build` は TypeScript build と Vite build に成功した。
- smoke script 結果: `./scripts/dev-reset-db.sh`, `./scripts/smoke-menu.sh`, `./scripts/smoke-e2e.sh`, `./scripts/smoke-admin-menu.sh`, `./scripts/smoke-admin-tables.sh` は成功した。管理 smoke 内部でも既存 `smoke-menu.sh` / `smoke-e2e.sh` が継続成功することを確認した。
- README / assumptions: README は主要 URL、管理画面 URL、起動手順、smoke script 一覧、既知の制約と実在ファイルが一致していたため変更しなかった。仕様上の仮定は変えていないため `docs/assumptions.md` は更新しなかった。
- 未対応項目: 注文管理画面などの新機能、本格ログイン認証、権限ロール管理、商品画像アップロード、商品オプション編集、席追加/削除、端末登録/ペアリング、監査ログは今回の対象外とした。

## 2026-06-12 Phase 4 注文管理画面

- 追加した管理画面: `frontend/src/pages/AdminOrdersPage.tsx` と `/admin/orders` ルートを追加した。`/analytics`, `/admin/menu`, `/admin/tables` から「注文管理」へ遷移でき、注文管理画面から CSV 出力導線として `/analytics` へ遷移できるようにした。
- 追加した Nyan8 API: `GET /api/admin/orders`, `GET /api/admin/orders/detail`, `POST /api/admin/orders/cancel-item`, `POST /api/admin/orders/cancel-order`。
- 追加した NyanQL API: `admin/orders`, `admin/orders/detail`, `admin/orders/cancel-item`, `admin/orders/cancel-order`。
- 追加した SQL: `admin_list_orders.sql`, `admin_get_order_detail.sql`, `admin_cancel_order_item.sql`, `admin_cancel_order.sql`。
- 画面機能: 日付範囲、席コード、注文番号、注文状態、精算状態のフィルタ、注文一覧、注文詳細、注文明細、支払い情報、関連ホールタスク、明細取消、注文全体取消を実装した。
- 取消ルール: Phase 4 実装時点の管理者判定は既存管理機能と同じ端末コード方式だった。Phase 6 以降は manager ロールを要求する。明細取消は `ordered`, `accepted`, `cooking` のみ許可し、`ready` / `served` / `cancelled` は拒否する。注文全体取消は未精算かつ ready / served 明細を含まない注文だけ許可する。精算済み注文は明細取消・注文全体取消とも拒否する。
- 状態集約: 明細取消後、全明細が `cancelled` なら注文ヘッダを `cancelled`、未取消明細が残る場合は既存状態集約ルールに従って `in_progress` / `ready` / `served` を再計算する。
- 会計・分析連携: 既存の会計サマリ、売上 CSV、分析ランキングは `order_items.status <> 'cancelled'` を条件にしているため、注文管理からキャンセルした明細も会計・分析対象外になる。
- 追加した smoke script: `scripts/smoke-admin-orders.sh`。注文一覧・詳細、非管理端末拒否、単品注文の明細取消、一部明細取消後の会計サマリ・分析除外、ready 明細の取消拒否、精算済み注文の取消拒否、既存 `smoke-e2e.sh` の成功を確認する。
- 確認結果: `./scripts/smoke-nyanql.sh`, `./scripts/smoke-menu.sh`, `./scripts/smoke-e2e.sh`, `./scripts/smoke-order-multiple-items.sh`, `./scripts/smoke-multiple-tables.sh`, `./scripts/smoke-cancel-flow.sh`, `./scripts/smoke-staff-call.sh`, `./scripts/smoke-checkout-csv.sh`, `./scripts/smoke-invalid-operations.sh`, `./scripts/smoke-admin-menu.sh`, `./scripts/smoke-admin-tables.sh`, `./scripts/smoke-admin-orders.sh` は成功した。単独 `smoke-e2e.sh` は DB 初期化前に残存セッションで一度失敗したが、`./scripts/dev-reset-db.sh` 後の再実行では成功した。
- フロントエンド確認結果: `cd frontend && npm run build` は TypeScript build と Vite build に成功した。既存同様、`pyenv: cannot rehash` と npm ログ作成権限警告は出たが、ビルド結果には影響しなかった。
- 暫定対応: 取消メモは API 入力として受け取るが、監査ログ・取消履歴テーブルが未実装のため永続化しない。返金、レシート再発行、スタッフ別履歴、ロール別権限制御は今回の対象外とした。

## 2026-06-15 Phase 5 操作ログ・監査ログ機能

- 追加したテーブル: `audit_logs`。`occurred_at`, `actor_terminal_code`, `actor_terminal_type`, `action`, `target_type`, `target_id`, `target_label`, `status`, `before_data`, `after_data`, `request_data`, `error_message` を持つ Phase 5 用スキーマへ更新し、日時、操作、対象、端末、結果の index を追加した。
- 追加した NyanQL API: `admin/audit-logs`, `admin/audit-logs/detail`, `audit-logs`。追加 SQL は `admin_list_audit_logs.sql`, `admin_get_audit_log_detail.sql`, `insert_audit_log.sql`。
- 追加した Nyan8 API: `GET /api/admin/audit-logs`, `GET /api/admin/audit-logs/detail`。Phase 6 以降はどちらも Bearer token と manager ロールを要求し、terminal_code は端末種別・active 判定に使う。
- 追加した Nyan8 共通関数: `backend/nyan8/javascript/lib/audit.js` に `writeAuditLog` と失敗ログ補助を追加した。ログ書き込み失敗時は本体処理を原則継続し、開発ログへ出力する。
- 追加した frontend API client: `adminAuditLogs(filters)`, `adminAuditLogDetail(auditLogId)`。型は `AuditLogSummary`, `AuditLogDetail` を追加し、フロントエンドでは camelCase に統一した。
- 追加した画面: `frontend/src/pages/AdminAuditLogsPage.tsx` と `/admin/audit-logs`。`/analytics`, `/admin/menu`, `/admin/tables`, `/admin/orders` から遷移できる。
- 追加した smoke script: `scripts/smoke-audit-logs.sh`。注文確定、会計依頼、精算、商品売切、明細取消、非管理者拒否、一覧・詳細取得を確認する。
- ログ対象操作: `admin_order_item_cancelled`, `admin_order_cancelled`, `admin_menu_item_created`, `admin_menu_item_updated`, `admin_menu_item_active_changed`, `admin_menu_item_sold_out_changed`, `admin_menu_item_moved`, `admin_table_status_changed`, `admin_session_force_closed`, `admin_terminal_active_changed`, `checkout_settled`, `checkout_settle_rejected`, `customer_order_submitted`, `customer_payment_requested`, `customer_staff_called`。
- 当時未対応だった監査要件: ログ改ざん防止署名、ログアーカイブ、ログ削除、監査ログ CSV エクスポート、複数店舗対応、外部監査システム連携。監査ログ CSV エクスポートと運用方針整理は Phase 8 で対応した。

## 2026-06-15 Phase 6 簡易ログイン・権限ロール管理

- 追加した DB テーブル: `users`, `user_sessions`。`audit_logs` には `actor_user_id`, `actor_user_display_name`, `actor_user_role` を追加した。
- 追加した NyanQL API: `auth/users/by-login-id`, `auth/sessions`, `auth/sessions/current`, `auth/sessions/delete`, `admin/users`, `admin/users/create`, `admin/users/update`, `admin/users/toggle-active`。
- 追加した Nyan8 API: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `GET/POST /api/admin/users`, `POST /api/admin/users/update`, `POST /api/admin/users/toggle-active`。
- 認可方針: `/api/customer/*` は token 不要。`/api/kitchen/*` は kitchen/manager、`/api/hall/*` は hall/manager、`/api/checkout/*` は cashier/manager、`/api/analytics/*` は manager/viewer、`/api/admin/*` は manager のみ許可する。端末種別・active チェックは継続する。
- 追加した画面: `/login`, `/admin/users`。既存管理画面、分析、キッチン、ホール、レジには frontend guard を追加した。
- 追加した frontend API client: `login`, `logout`, `me`, `adminUsers`, `adminCreateUser`, `adminUpdateUser`, `adminToggleUserActive`。`frontend/src/api/client.ts` は token がある場合 `Authorization: Bearer <token>` を付与する。
- 追加した smoke script: `scripts/smoke-auth.sh`。manager login、誤パスワード拒否、me、viewer/cashier/kitchen/hall の許可、admin 拒否、logout 後拒否、監査ログ actor user 記録を確認する。
- 暫定対応: password hash は SHA-256。Nyan8 で専用 hash 関数や Node crypto が使えない環境に備えて純 JavaScript fallback を持つ。本番では bcrypt/argon2 と httpOnly cookie へ移行する。

## 2026-06-15 Phase 6.5 認証・ロール整合性修正

- README と docs の古い `terminal_code=analytics-manager` 管理者判定説明を、Bearer token + manager role + 端末種別/active チェックの現行仕様へ更新した。
- `scripts/smoke-auth.sh` を強化し、token なし、存在しない token、期限切れ session、logout 済み token、inactive user、role 違い、顧客 API token なし、監査ログ actor user/terminal の境界を確認するようにした。
- `/admin/users` と Nyan8 管理 API で、最後の active manager の無効化・降格と、自分自身の manager 権限変更を拒否するようにした。
- `AuthGate` は `/api/auth/me` で token を検証し、壊れた localStorage token では再ログインへ誘導する。protected 画面にはログイン中ユーザー名、role、ログアウト導線を表示する。
- `/admin/audit-logs` では user actor がない顧客操作を `未ログイン端末操作` と表示し、terminal_code と併せて確認できるようにした。

## 2026-06-16 Phase 6.7 依存関係・Node 実行環境・npm audit 整理

- 作業前のローカル既定環境は Node.js `v16.17.1`, npm `8.15.0` だった。この環境では `npm install` 時に `node-releases@2.0.47` の `node >=18` engine warning、npm ログ作成権限警告、`pyenv: cannot rehash` 警告が出ていた。
- 推奨環境を Node.js 20 LTS 以上、npm 10 以上に整理し、`.nvmrc` は `20` とした。`frontend/package.json` には `engines.node >=20.19`, `engines.npm >=10` を追加した。
- 検証には Codex bundled Node.js `v24.14.0` と npm `10.9.8` を使った。この組み合わせでは `npm install`, `npm audit`, `npm run build` の engine warning は発生しなかった。
- 依存更新: `vite` は `4.5.14` から `8.0.16`、`@vitejs/plugin-react` は `4.7.0` から `6.0.2`、`@types/react` は `19.2.16` から `19.2.17`、`react` / `react-dom` は package range を `^19.0.0` から `^19.2.7`、`typescript` は package range を `^5.7.2` から `^5.9.3` に更新した。TypeScript `6.0.3` は major update のため今回の audit 対応からは外した。
- npm audit 作業前: high 2 件、critical 0 件、total 2 件。内訳は `vite` 経由の `esbuild <=0.28.0` と `vite <=6.4.1` で、通常の `npm audit fix` では解消せず、`npm audit fix --force` は Vite 8 への major update を伴う状態だった。
- npm audit 作業後: `npm audit` は `found 0 vulnerabilities`、`npm audit --json` でも `high=0`, `critical=0`, `total=0` を確認した。
- Vite dev server policy: `npm run dev` は `vite` のみに戻して localhost 開発用とし、LAN 端末検証用に `npm run dev:host` (`vite --host 0.0.0.0`) を追加した。Vite dev server は本番公開に使わず、`npm run build` の成果物を別途配信する。
- build 結果: Node.js `v24.14.0` を PATH 先頭に置き、npm `10.9.8` で `npm run build` を実行し成功した。Vite `v8.0.16` で frontend bundle が生成された。
- dev server 結果: Node.js `v24.14.0` + npm `10.9.8` で `npm run dev` を実行し、`http://localhost:5173/` のみを表示、`Network: use --host to expose` となることを確認した。
- ブラウザ確認: Vite dev server 上で `/login`, `/customer/T01`, `/kitchen`, `/hall`, `/checkout`, `/analytics`, `/admin/menu`, `/admin/tables`, `/admin/orders`, `/admin/audit-logs`, `/admin/users` を確認した。各画面で root content が描画され、ブラウザ console error は 0 件だった。管理画面は manager ログイン後に確認した。
- smoke script 結果: `./scripts/dev-reset-db.sh`, `./scripts/smoke-auth.sh`, `./scripts/smoke-audit-logs.sh`, `./scripts/smoke-admin-orders.sh`, `./scripts/smoke-admin-menu.sh`, `./scripts/smoke-admin-tables.sh`, `./scripts/smoke-menu.sh`, `./scripts/smoke-e2e.sh`, `./scripts/smoke-order-multiple-items.sh`, `./scripts/smoke-multiple-tables.sh`, `./scripts/smoke-cancel-flow.sh`, `./scripts/smoke-staff-call.sh`, `./scripts/smoke-checkout-csv.sh`, `./scripts/smoke-invalid-operations.sh` は順次実行で成功した。
- 残る環境注意: システム既定の Node 16 / npm 8 では engine warning が出る。`pyenv: cannot rehash` と npm ログ権限警告はこのリポジトリの依存関係ではなくローカル環境権限の問題として扱う。

## 2026-06-16 Phase 7 本番向け認証強化

- 認証方式: `cafe_session` cookie 主方式へ整理した。`auth.js` は `getSessionToken()`, `getCurrentUser()`, `requireLogin()`, `requireRole()`, `requireManager()`, `setSessionCookie()`, `clearSessionCookie()` を明確化し、優先順位は cookie、Bearer / `token` 互換の順にした。
- Nyan8 制約: 現行 Nyan8 は `headers.Set-Cookie` を実 HTTP header として返せず、受信 `Cookie` header も JavaScript params に渡さない。開発環境では response body の疑似 `Set-Cookie` を frontend / smoke script が同期し、Bearer / `token` 互換で protected API を呼ぶ。本番では reverse proxy で cookie を実 header 化し、必要なら upstream Authorization へ変換する方針とした。
- token 保存: frontend の localStorage token 保存を廃止し、localStorage は表示復元用 user 情報だけにした。Nyan8 制約下の開発互換として JS cookie から token を読み、Authorization / `token` へ付与する。
- DB 強化: `users` に `password_hash_version`, `password_updated_at`, `failed_login_count`, `locked_until`、`user_sessions` に `revoked_at`, `user_agent` を追加した。logout は削除ではなく `revoked_at` 設定に変更した。
- password hash: Nyan8 互換性を優先して seed は `salted_sha256_v1` に移行した。Node crypto が使える環境では `hashPassword()` が PBKDF2-SHA256 を生成できるが、現行 Nyan8 では利用できない。
- session 管理: session 有効期限は 8 時間。expired / revoked / inactive user session は拒否し、`auth/sessions/current` で `last_seen_at` を更新する。
- account lock: 5 回連続失敗で 5 分ロックし、成功時に失敗回数と lock をリセットする。存在しない login_id / 誤 password / inactive / locked は同じログイン失敗メッセージにした。
- audit log: `auth_login_succeeded`, `auth_login_failed`, `auth_logout`, `auth_session_expired`, `auth_session_revoked`, `auth_user_locked` を追加した。認証ログの `request_data` には password を入れない。
- CSRF 方針: MVP は `SameSite=Lax` + JSON API 前提。state changing API は POST を前提とし、本番では許可 origin 限定と CSRF token 追加を検討する。
- smoke script: `scripts/lib/smoke-lib.sh`, `scripts/smoke-auth.sh`, `scripts/smoke-admin-menu.sh`, `scripts/smoke-e2e.sh` を cookie jar / 疑似 cookie / Bearer 互換に対応させた。`smoke-auth.sh` は failed login count、lock、inactive、expired、revoked、logout 後拒否、認証 audit log、password 非露出を確認する。
- 検証結果: `./scripts/dev-reset-db.sh`, `./scripts/smoke-auth.sh`, `./scripts/smoke-audit-logs.sh`, `./scripts/smoke-admin-orders.sh`, `./scripts/smoke-admin-menu.sh`, `./scripts/smoke-admin-tables.sh`, `./scripts/smoke-menu.sh`, `./scripts/smoke-e2e.sh`, `./scripts/smoke-order-multiple-items.sh`, `./scripts/smoke-multiple-tables.sh`, `./scripts/smoke-cancel-flow.sh`, `./scripts/smoke-staff-call.sh`, `./scripts/smoke-checkout-csv.sh`, `./scripts/smoke-invalid-operations.sh` は成功した。`npm audit` は 0 vulnerabilities、Codex bundled Node.js `v24.14.0` で `npm run build` は成功した。システム既定 Node.js `v16.17.1` では Vite の Node 要件未満で build が失敗する。

## 2026-06-16 Phase docs refresh

- 目的: 新機能実装は行わず、docs 配下の開発計画書・仕様書を現在の実装状況と今後の開発計画に合わせて更新した。
- 更新対象ファイル: `docs/01_product_requirements.md`, `docs/02_architecture.md`, `docs/03_data_model.md`, `docs/04_api_design.md`, `docs/05_screen_spec.md`, `docs/06_acceptance_criteria.md`, `docs/07_development_plan.md`, `docs/assumptions.md`, `docs/development-notes.md`。
- 実装済みとして反映した機能: 顧客注文、キッチン、ホール、レジ精算、分析、売上 CSV、メニュー管理、席・端末管理、注文管理、明細取消、注文全体取消、取消明細の会計・分析除外、監査ログ、簡易ログイン、ロール認可、ユーザー管理、session 有効期限・失効・inactive user 拒否、連続ログイン失敗ロック、監査ログ actor user 対応、Node / npm 推奨環境、Vite dev server 公開範囲、npm audit 0 件化。
- 現行仕様として整理した内容: フロントエンドは Nyan8 の `/api/*` のみを呼び出す。NyanQL は Nyan8 から内部 API として呼ぶ。顧客 API は token 不要、protected API は role 制御を行う。`terminal_code` は端末種別・active 判定・監査ログ補助情報に使う。現行認証は `cafe_session` cookie 主方式を設計上の主方式とし、Nyan8 制約により Bearer / `token` 互換を併用する。
- まだ未対応として残した機能: 実決済連携、返金、在庫管理、複数店舗、予約、顧客会員、複雑な割引 / クーポン、商品画像アップロード、商品オプション編集 UI 高度化、監査ログアーカイブ実装、監査ログ署名 / 改ざん検知、外部監査連携、Nyan8 制約を前提にしない実 HTTP header の httpOnly cookie 完全運用、bcrypt / argon2 等の本番向け password hash、CSRF token、多要素認証、OAuth / SSO、CI/CD、本番デプロイ手順。
- 次フェーズ: Phase 8 は監査ログ運用強化として実装済み。Phase 9 は本番デプロイ準備、Phase 10 は CI / 自動テスト、Phase 11 以降は商品・在庫・オプション、決済・返金・レシート、顧客・予約・複数店舗の拡張とする。
- 検証結果: README、`backend/nyan8/api.json`, `backend/nyanql/api.json`, `backend/nyanql/sql/schema.sql`, `frontend/src/App.tsx`, `frontend/src/api/cafeApi.ts`, `frontend/src/domain/types.ts`, `frontend/package.json`, `scripts/` を確認し、docs の画面一覧、API 一覧、role、状態値、smoke script 対応表を現行実装へ合わせた。コマンド実行結果は本セクションの後続作業結果を参照する。
- コマンド検証結果: システム既定は Node.js `v16.17.1` / npm `8.15.0` で推奨未満だったため、Codex bundled Node.js `v24.14.0` を PATH 先頭に置いて確認した。`npm install` は成功したが、npm はローカル shim の `8.15.0` が使われたため engine warning が出た。`npm run build` は成功した。初回 `npm audit` は sandbox のネットワーク制限で失敗し、承認付き再実行では `found 0 vulnerabilities` だった。

## 2026-06-16 Phase 8 監査ログ運用強化

- 追加した API: `GET /api/admin/audit-logs/export-csv`。manager role と session 認証を要求し、CSV 出力操作自体を `admin_audit_logs_exported` として監査ログに記録する。
- 追加した SQL: `backend/nyanql/sql/admin_export_audit_logs.sql`。一覧と同じ検索条件で CSV 用の詳細項目を返す。`admin_list_audit_logs.sql` は `target_label`, `actor_user_id`, `actor_user_role` の個別条件を追加した。
- DB index: `idx_audit_logs_actor_user_role` を追加した。既存の `occurred_at`, `action`, `target_type,target_id`, `actor_terminal_code`, `actor_user_id`, `status` は維持した。
- 追加した frontend API: `adminAuditLogsExportCsv(filters)`。`AuditLogSearchFilters` を追加し、一覧と CSV で同じ検索条件を使う。
- 更新した画面: `/admin/audit-logs` に actor user id / role filter、CSV 出力ボタン、CSV 成功 / 失敗メッセージ、before_data / after_data の比較表示、JSON 表示時の秘匿情報 mask を追加した。
- CSV 出力仕様: JSON ラップ形式で `contentType`, `filename`, `csv` を返す。列は `occurred_at`, `status`, `action`, `actor_user_id`, `actor_user_display_name`, `actor_user_role`, `actor_terminal_code`, `actor_terminal_type`, `target_type`, `target_id`, `target_label`, `error_message`, `request_data`, `before_data`, `after_data`。JSONB は 1 行 JSON 文字列にして CSV escape する。
- 検索条件: `from_date`, `to_date`, `action`, `target_type`, `target_label`, `actor_terminal_code`, `actor_user_id`, `actor_user_role`, `status`, `keyword`。keyword は `action`, `target_type`, `target_id`, `target_label`, `actor_terminal_code`, `actor_user_display_name`, `actor_user_role`, `error_message` を対象にする。
- 秘匿情報除外方針: audit 書き込み時と CSV JSONB 出力時に `password`, `session_token`, `token`, `authorization`, `cookie` 系 key を mask する。認証ログの request_data には引き続き password を含めない。
- 更新した docs: README、`docs/03_data_model.md`, `docs/04_api_design.md`, `docs/05_screen_spec.md`, `docs/06_acceptance_criteria.md`, `docs/07_development_plan.md`, `docs/assumptions.md`。
- 更新した smoke script: `scripts/smoke-audit-logs.sh`。action / actor_user_role / keyword filter、詳細 before/after、manager CSV 出力、非 manager CSV 拒否、CSV header、password / session_token 非出力、CSV 出力操作ログを確認する。
- 運用方針: MVP では `audit_logs` を物理削除せず同一テーブルに保持する。本番では 1 年以上などの保持期間、archive table または外部 storage への移行を検討する。
- 未対応事項: ログ物理削除、アーカイブ実装、ログ署名 / hash chain、append-only storage、WORM storage、外部監査システム / SIEM 連携、複数店舗別ログ分離。
- 検証結果: `./scripts/dev-reset-db.sh`, `./scripts/smoke-audit-logs.sh`, `./scripts/smoke-auth.sh`, `./scripts/smoke-admin-orders.sh`, `./scripts/smoke-admin-menu.sh`, `./scripts/smoke-admin-tables.sh`, `./scripts/smoke-menu.sh`, `./scripts/smoke-e2e.sh`, `./scripts/smoke-order-multiple-items.sh`, `./scripts/smoke-multiple-tables.sh`, `./scripts/smoke-cancel-flow.sh`, `./scripts/smoke-staff-call.sh`, `./scripts/smoke-checkout-csv.sh`, `./scripts/smoke-invalid-operations.sh` は成功した。`npm install` は成功した。`npm audit` は sandbox の DNS 制限で一度失敗し、承認付き再実行で `found 0 vulnerabilities` を確認した。Codex bundled Node.js `v24.14.0` を PATH 先頭に置いた `npm run build` は成功した。ローカル環境由来の `pyenv: cannot rehash` と npm log 権限 warning は継続して出る。

## 2026-06-17 Phase 9 本番デプロイ準備

- 追加した deploy file: `deploy/nginx/cafe-order-system.conf.example`。`frontend/dist` の静的配信、SPA fallback、`/api/` の Nyan8 proxy、HTTPS redirect、`X-Forwarded-*` header、cookie / auth header 検証コメントを記載した。
- 追加した env example: `.env.example`, `.env.production.example`。`DATABASE_URL`, NyanQL / Nyan8 port, `APP_BASE_URL`, cookie 方針、`LOG_DIR`, NyanQL BasicAuth を整理した。`.env.production` は `.gitignore` 対象にした。
- 追加した script: `scripts/prod-build.sh`, `scripts/prod-start-nyanql.sh`, `scripts/prod-start-nyan8.sh`, `scripts/prod-stop.sh`, `scripts/prod-status.sh`, `scripts/smoke-prod-readiness.sh`。
- 本番配信方針: Vite dev server は公開せず、`frontend/dist` を Nginx 等で静的配信する。`/api/*` は reverse proxy から Nyan8 へ転送し、Nyan8 が NyanQL を内部 API として呼ぶ。
- NyanQL / Nyan8 起動方針: production script は `.env.production` を読み、runtime 配下へ config / api / sql / javascript を配置する。NyanQL config は `DATABASE_URL` から生成し、Nyan8 runtime の NyanQL 接続先と BasicAuth も env から反映する。
- cookie / header 方針: `cafe_session` cookie 主方式を維持し、本番では HTTPS, Secure, HttpOnly, SameSite=Lax を前提とする。現行 Nyan8 の実 header 伝播は本番実行方式で検証が必要なため、未検証の proxy 変換は確定実装にしない。
- DB backup 方針: `pg_dump "$DATABASE_URL"` と `psql "$DATABASE_URL" < backup.sql` の手順を `docs/08_operations.md` に追加した。`schema.sql` は開発 reset 用で `DROP TABLE` を含むため本番 DB に安易に実行しない。
- ログ方針: `${LOG_DIR}` の stdout / stderr、runtime log、Nginx access / error log、DB の `audit_logs` を確認対象にした。stdout / stderr と Nginx log は OS logrotate 等でローテーションする。
- 追加した docs: `docs/08_operations.md`。更新した docs: README、`docs/02_architecture.md`, `docs/04_api_design.md`, `docs/06_acceptance_criteria.md`, `docs/07_development_plan.md`, `docs/assumptions.md`。
- 検証結果: `bash -n` で追加 production script の構文を確認した。`./scripts/smoke-prod-readiness.sh` は system npm `8.15.0` では推奨未満として失敗することを確認し、検証用に `/private/tmp` へ npm `10.9.8` を一時導入して Codex bundled Node.js `v24.14.0` と組み合わせた実行では成功した。`cd frontend && npm install`, `npm audit`, `npm run build` は同じ推奨環境で成功し、`npm audit` は `found 0 vulnerabilities` だった。
- 既存 smoke 検証: 開発用 NyanQL / Nyan8 を起動し、`./scripts/dev-reset-db.sh`, `./scripts/smoke-auth.sh`, `./scripts/smoke-audit-logs.sh`, `./scripts/smoke-admin-orders.sh`, `./scripts/smoke-admin-menu.sh`, `./scripts/smoke-admin-tables.sh`, `./scripts/smoke-menu.sh`, `./scripts/smoke-e2e.sh` は成功した。初回 `smoke-auth.sh` は Nyan8 の API 登録完了前に実行して接続不可で失敗し、登録完了後の再実行では成功した。
- 未対応事項: 実サーバーへのデプロイ、GitHub Actions 自動デプロイ、Docker 化、Kubernetes、Terraform、実ドメイン証明書発行、外部決済連携、OAuth / SSO、多要素認証、CSRF token 本実装、bcrypt / argon2 / pgcrypto 移行、systemd / PM2 化、本番 migration 管理。

## 2026-06-17 Phase 10 CI / 自動テスト

- 追加した workflow: `.github/workflows/ci.yml`。pull_request と `master` push で起動し、frontend job と static-checks job に分けた。
- frontend job: Node.js `20.19` を `actions/setup-node` で使い、`npm ci`, `npm audit --audit-level=high`, `npm run build`, `./scripts/ci-prod-readiness-static.sh` を実行する。
- static-checks job: Node.js `20.19` を使い、`./scripts/ci-shellcheck.sh`, `./scripts/ci-repo-consistency.sh` を実行する。
- 追加した CI script: `scripts/ci-shellcheck.sh`, `scripts/ci-repo-consistency.sh`, `scripts/ci-prod-readiness-static.sh`。
- 追加した consistency check: `scripts/check-nyan8-api-files.mjs` で Nyan8 `api.json` の `script` 参照先を確認し、`scripts/check-nyanql-sql-files.mjs` で NyanQL `api.json` の `sql` 参照先を確認する。
- CI で実行する検証: frontend install / audit / build、shell script の `bash -n`、任意の shellcheck、重要ファイル存在確認、`.env.production` 非追跡確認、Nyan8 / NyanQL 定義整合、production readiness static check。
- CI で実行しない検証: 自動デプロイ、本番サーバー SSH、Docker / Kubernetes / Terraform、実 DB 利用、GitHub Actions 上での NyanQL / Nyan8 runtime 起動、Playwright / E2E ブラウザテスト、`dev-reset-db.sh`。
- local full smoke の位置づけ: PostgreSQL / NyanQL / Nyan8 を起動できる開発者環境または専用検証環境で実行する。CI lightweight checks とは分離する。
- docs 更新: README に GitHub Actions CI、`npm ci` と `npm install` の使い分け、PR 前の推奨ローカル確認を追記した。`docs/06_acceptance_criteria.md`, `docs/07_development_plan.md`, `docs/08_operations.md`, `docs/assumptions.md` に Phase 10 の前提と受け入れ条件を追記した。
- 検証結果: Codex bundled Node.js `v24.14.0` と npm `10.9.8` で `npm ci`, `npm audit --audit-level=high`, `npm run build` は成功した。`npm audit` は `found 0 vulnerabilities` だった。
- CI script 検証結果: `./scripts/ci-shellcheck.sh`, `./scripts/ci-repo-consistency.sh`, `./scripts/ci-prod-readiness-static.sh` は成功した。ローカルに shellcheck がないため shellcheck 実行は skip し、`bash -n` は全 shell script で成功した。
- Nyan8 / NyanQL 整合チェック結果: Nyan8 `api.json` の全 JavaScript 参照先、NyanQL `api.json` の全 SQL 参照先が存在することを確認した。
- production readiness 検証結果: `./scripts/smoke-prod-readiness.sh` は成功した。sandbox DNS 制限で `npm audit` が一度失敗したため、承認付きネットワーク実行で再確認した。
- 未対応事項: GitHub Actions の実リモート実行結果確認、自動デプロイ、実 DB を使う CI、実 NyanQL / Nyan8 runtime を GitHub Actions 上で起動する CI、Playwright / E2E ブラウザテスト。
