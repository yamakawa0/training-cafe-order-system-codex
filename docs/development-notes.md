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

## 2026-06-18 Phase 10.5 CI 実行確認・full smoke 回帰確認

- GitHub Actions 実リモート確認: `master` の最新 CI run `27697746137`、head SHA `18e226813abddea693804c1efdca221a5a2f52f1`、commit title `Harden CI and smoke scripts` が `completed / success` であることを確認した。run URL は `https://github.com/yamakawa0/training-cafe-order-system-codex/actions/runs/27697746137`。
- GitHub Actions job 確認: `static-checks` は `Shell syntax check` と `Repository consistency check` を含めて成功した。`frontend` は `Install frontend dependencies`, `Audit frontend dependencies`, `Build frontend`, `Production readiness static check` を含めて成功した。
- workflow 更新: `.github/workflows/ci.yml` に `workflow_dispatch`、`permissions: contents: read`、`concurrency` を追加した。Node.js 20 actions deprecated 警告への対応として `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24=true` は維持し、`actions/checkout@v4` と `actions/setup-node@v4` は現行のままとした。
- local CI 確認: Codex bundled Node.js `v24.14.0` と npm `10.9.8` で `cd frontend && npm ci`, `npm audit --audit-level=high`, `npm run build` は成功した。`npm audit` は sandbox DNS 制限で一度失敗したため、承認付きネットワーク実行で `found 0 vulnerabilities` を確認した。
- local static check 確認: `./scripts/ci-shellcheck.sh`, `./scripts/ci-repo-consistency.sh`, `./scripts/ci-prod-readiness-static.sh`, `./scripts/smoke-prod-readiness.sh`, `git diff --check` は成功した。`ci-shellcheck.sh` は `bash -n` と shellcheck の両方を通した。
- full smoke 回帰確認: `./scripts/dev-reset-db.sh`, `./scripts/smoke-auth.sh`, `./scripts/smoke-audit-logs.sh`, `./scripts/smoke-admin-orders.sh`, `./scripts/smoke-admin-menu.sh`, `./scripts/smoke-admin-tables.sh`, `./scripts/smoke-menu.sh`, `./scripts/smoke-e2e.sh`, `./scripts/smoke-order-multiple-items.sh`, `./scripts/smoke-multiple-tables.sh`, `./scripts/smoke-cancel-flow.sh`, `./scripts/smoke-staff-call.sh`, `./scripts/smoke-checkout-csv.sh`, `./scripts/smoke-invalid-operations.sh` は順次実行で成功した。
- docs 更新: README、`docs/06_acceptance_criteria.md`, `docs/07_development_plan.md`, `docs/08_operations.md`, `docs/assumptions.md`, `docs/development-notes.md` に Phase 10.5 の確認結果と CI / full smoke の役割分離を反映した。
- 開発計画の現在地: Phase 10 は完了済みへ移動し、Phase 11 を現在フェーズにした。Phase 11 の実装は今回行っていない。
- 未対応事項: GitHub Actions 自動デプロイ、実 DB を使う CI、実 NyanQL / Nyan8 runtime を GitHub Actions 上で起動する CI、Playwright / E2E ブラウザテスト、Docker / Kubernetes / Terraform、systemd / PM2 化、本番 migration 管理。

## 2026-06-18 Phase 11 商品・在庫・オプション強化 第1段階

- 実装範囲: カテゴリ管理 UI 強化、商品オプション編集 UI、顧客注文画面のオプション選択、オプション追加料金の注文・会計・分析・CSV 反映、関連 API / SQL / docs 更新。
- DB: `menu_item_options` に `min_select`, `max_select`, `active`, `created_at`, `updated_at` を追加し、`menu_option_choices` に `created_at`, `updated_at` を追加した。reset 用 `schema.sql` の CREATE TABLE 定義へ反映した。
- 顧客メニュー: `active=false` のカテゴリ・商品・オプション・選択肢を返さない。選択数は Nyan8 の注文 API でも検証する。
- 管理 API: カテゴリ、オプショングループ、選択肢の作成・更新・表示切替・並び順変更を追加した。manager のみ操作可能。
- 監査ログ: `admin_menu_category_*`, `admin_menu_item_option_*`, `admin_menu_option_choice_*` の成功・失敗を記録する。password / session token 系は含めない既存方針を維持する。
- 検証結果: Codex bundled Node.js `v24.14.0` と npm `10.9.8` で `cd frontend && npm ci`, `npm audit --audit-level=high`, `npm run build` は成功した。`npm audit` は sandbox DNS 制限で一度失敗し、承認付きネットワーク実行で `found 0 vulnerabilities` を確認した。
- smoke 結果: `./scripts/smoke-admin-menu.sh`, `./scripts/smoke-auth.sh`, `./scripts/smoke-audit-logs.sh`, `./scripts/smoke-admin-orders.sh`, `./scripts/smoke-admin-tables.sh`, `./scripts/smoke-order-multiple-items.sh`, `./scripts/smoke-multiple-tables.sh`, `./scripts/smoke-cancel-flow.sh`, `./scripts/smoke-staff-call.sh`, `./scripts/smoke-checkout-csv.sh`, `./scripts/smoke-invalid-operations.sh`, `./scripts/smoke-prod-readiness.sh` は成功した。`smoke-admin-menu.sh` 内で `smoke-menu.sh` と `smoke-e2e.sh` も成功した。
- CI / static check 結果: `./scripts/ci-shellcheck.sh`, `./scripts/ci-repo-consistency.sh`, `./scripts/ci-prod-readiness-static.sh`, `git diff --check`, Nyan8 / NyanQL API 参照先整合チェックは成功した。`smoke-prod-readiness.sh` は `NPM_BIN` で npm 10 を指定できるようにした。
- 後続対象: 商品画像アップロード、在庫数、売切自動化、原価 / 粗利、仕入管理、複数店舗別メニュー、商品一括 import / export、高度な価格履歴管理、クーポン / 割引、返金処理、実決済連携。

## 2026-06-24 Phase 11 商品・在庫・オプション強化 第2段階

- DB / SQL: `menu_items` に `track_stock`, `stock_quantity`, `low_stock_threshold` と `idx_menu_items_stock` を追加した。顧客メニュー、管理メニュー一覧・作成・更新・表示切替・売切切替・並び順変更 SQL は在庫項目を返す。`admin_update_menu_item_stock.sql`, `reserve_menu_item_stock.sql`, `restore_menu_item_stock.sql` を追加した。
- NyanQL API: `admin/menu/items/update-stock`, `menu/items/reserve-stock`, `menu/items/restore-stock` を追加した。
- Nyan8 API: `POST /api/admin/menu/items/update-stock` を追加した。`adjust-stock` は在庫履歴設計と合わせて後続対応とする。
- frontend: `AdminMenuItem`, `MenuItem`, `AdminMenuItemInput` に在庫項目を追加し、`cafeApi.adminUpdateMenuItemStock()` を追加した。`/admin/menu` に在庫管理対象、在庫数、低在庫閾値、低在庫 / 在庫 0 badge、在庫のみ更新ボタンを追加した。`/customer/:tableCode` は売切と残りわずかを表示する。
- 在庫引当仕様: 注文確定前に同一注文内の同一商品数量を合算して在庫を検証し、不足があれば注文全体を 409 で拒否する。成功時だけ在庫を減らし、在庫 0 で `sold_out=true` にする。売上、分析、CSV、キッチン ticket には拒否注文を出さない。
- 在庫戻し仕様: 管理者の明細取消 / 注文全体取消で、取消可能だった在庫管理対象明細だけ `stock_quantity` を戻す。精算済み注文と ready / served 明細は既存仕様どおり取消不可のため在庫戻ししない。在庫が戻っても `sold_out=false` へは自動解除しない。
- 監査ログ: `admin_menu_item_stock_updated`, `customer_order_stock_reserved`, `admin_order_item_stock_restored`, `admin_order_stock_restored`, `admin_menu_item_auto_sold_out` を追加した。商品 ID、商品名、在庫数、閾値、売切状態、delta、注文 ID / 注文番号、明細 ID を before / after に含める。
- smoke: `scripts/smoke-admin-menu.sh` に在庫設定、顧客メニューへの在庫反映、在庫不足拒否、在庫引当、自動売切、売切注文拒否、取消時在庫戻し、売切自動解除なし、在庫 audit log、非 manager 拒否を追加した。
- docs: README、データモデル、API 設計、画面仕様、受け入れ条件、開発計画、assumptions を更新した。
- 未対応事項: 商品画像アップロード、原価 / 粗利、仕入 / 入荷 / 棚卸、在庫履歴画面、`adjust-stock` API、複数店舗別在庫、オプション選択肢別在庫、商品一括 import / export。
- 検証結果: `node --check backend/nyan8/javascript/lib/runtime.js`、Nyan8 / NyanQL API 定義整合チェック、`bash -n scripts/smoke-admin-menu.sh`、frontend `npm ci`, `npm audit --audit-level=high`, `npm run build` は成功した。`npm audit` と `smoke-prod-readiness.sh` は sandbox DNS 制限で一度失敗し、承認付きネットワーク実行で `found 0 vulnerabilities` と production readiness 成功を確認した。
- full smoke 結果: `./scripts/smoke-admin-menu.sh`, `./scripts/smoke-auth.sh`, `./scripts/smoke-audit-logs.sh`, `./scripts/smoke-admin-orders.sh`, `./scripts/smoke-admin-tables.sh`, `./scripts/smoke-menu.sh`, `./scripts/smoke-e2e.sh`, `./scripts/smoke-order-multiple-items.sh`, `./scripts/smoke-multiple-tables.sh`, `./scripts/smoke-cancel-flow.sh`, `./scripts/smoke-staff-call.sh`, `./scripts/smoke-checkout-csv.sh`, `./scripts/smoke-invalid-operations.sh`, `./scripts/smoke-prod-readiness.sh` は成功した。`smoke-admin-menu.sh` 内で在庫数・自動売切・在庫戻し・在庫 audit log を検証した。
- CI / static check 結果: `./scripts/ci-shellcheck.sh`, `./scripts/ci-repo-consistency.sh`, `./scripts/ci-prod-readiness-static.sh`, `git diff --check` は成功した。ローカルの `pyenv: cannot rehash` と npm log 権限 warning は環境由来で、検証結果には影響しない。

## 2026-06-24 Phase 11.5 Phase 11 整合確認

- Git / GitHub 反映確認: `git status -sb` は `## master...origin/master`、`git log --oneline --decorate -5` は `80e97ef (HEAD -> master, origin/master) Add stock tracking and reservation for menu items` を先頭としており、`git diff --stat` と `git diff` は空だった。`git fetch origin` は sandbox で `.git/FETCH_HEAD` 書き込みが拒否されたため承認付きで再実行し、fetch 後も `master` と `origin/master` は一致していた。
- 作業ディレクトリ確認: 現在の remote は `git@github.com:yamakawa0/training-cafe-order-system-codex.git` で、Codex が作業したリポジトリと GitHub remote は一致している。別ディレクトリ作業や未 push commit は確認されなかった。
- 実装照合: grep で `track_stock`, `stock_quantity`, `low_stock_threshold`, `update-stock`, 在庫 audit action、`menu_item_options`, `menu_option_choices`, `order_item_options`, カテゴリ / オプション作成 audit action が backend、frontend、scripts、docs に存在することを確認した。`frontend/src/api/cafeApi.ts` にはカテゴリ、オプション、選択肢、在庫更新の API client が揃っている。
- Phase 11 第1段階確認: カテゴリ追加 / 編集 / active 切替 / 並び順変更、商品オプショングループ追加 / 編集 / active 切替 / 並び順変更、選択肢追加 / 編集 / active 切替 / 並び順変更、顧客注文画面の必須 / 最小 / 最大選択数 validation、オプション追加料金の注文・会計・分析・CSV 反映が実装済みであることを確認した。
- Phase 11 第2段階確認: `menu_items` の在庫カラム、`POST /api/admin/menu/items/update-stock`、注文確定時の在庫不足 409、注文成功時の在庫引当、在庫 0 時の `sold_out=true`、明細取消 / 注文取消時の在庫戻し、売切自動解除なし、管理画面在庫 UI、顧客画面の低在庫 / 売切表示、在庫 audit log、`smoke-admin-menu.sh` の在庫検証が実装済みであることを確認した。
- smoke 結果: `./scripts/dev-reset-db.sh`, `./scripts/smoke-admin-menu.sh`, `./scripts/smoke-auth.sh`, `./scripts/smoke-audit-logs.sh`, `./scripts/smoke-admin-orders.sh`, `./scripts/smoke-admin-tables.sh`, `./scripts/smoke-menu.sh`, `./scripts/smoke-e2e.sh`, `./scripts/smoke-order-multiple-items.sh`, `./scripts/smoke-multiple-tables.sh`, `./scripts/smoke-cancel-flow.sh`, `./scripts/smoke-staff-call.sh`, `./scripts/smoke-checkout-csv.sh`, `./scripts/smoke-invalid-operations.sh`, `./scripts/smoke-prod-readiness.sh` は成功した。
- CI / static check 結果: Codex bundled Node.js `v24.14.0` と npm `10.9.8` で `cd frontend && npm ci`, `npm audit --audit-level=high`, `npm run build` は成功し、`npm audit` は `found 0 vulnerabilities` だった。`./scripts/ci-shellcheck.sh`, `./scripts/ci-repo-consistency.sh`, `./scripts/ci-prod-readiness-static.sh`, `git diff --check` は成功した。ローカルに shellcheck がないため shellcheck 実行は skip した。
- 修正方針: 新機能追加は行わず、Phase 11.5 の確認結果を `docs/07_development_plan.md` と `docs/development-notes.md` に記録した。Phase 11 第3段階、商品画像アップロード、原価 / 粗利には進めていない。

## 2026-06-24 Phase 11 商品・在庫・オプション強化 第3段階

- 実装範囲: 商品画像管理は MVP として `menu_items.image_url` の URL 管理に限定した。画像ファイル本体の DB 保存、multipart upload、resize / 圧縮、CDN / 外部 storage、複数画像は未対応。
- 変更した SQL: `admin_list_menu_items.sql`, `admin_create_menu_item.sql`, `admin_update_menu_item.sql` で `image_url` を取得・登録・更新・返却するようにした。既存 `menu_items.image_url` カラムを利用し、新規カラム追加は行っていない。
- 変更した NyanQL API: 既存の `admin/menu/items`, `admin/menu/items/create`, `admin/menu/items/update` の入出力に `image_url` を含めた。新規 API は追加していない。
- 変更した Nyan8 API: `GET /api/admin/menu/items`, `POST /api/admin/menu/items`, `POST /api/admin/menu/items/update`, `GET /api/customer/menu` が `imageUrl` を返す。商品作成・更新時に `image_url` validation を行い、`admin_menu_item_created` / `admin_menu_item_updated` の `after_data` / `before_data` に `image_url` が残る。
- frontend API client / 型: `AdminMenuItem` と `AdminMenuItemInput` に画像 URL 項目を追加した。既存 `cafeApi.adminCreateMenuItem()` / `adminUpdateMenuItem()` の input に `image_url` を含める。
- 更新した画面: `/admin/menu` に商品画像 URL 入力、クリアボタン、商品編集プレビュー、商品一覧サムネイル / 「画像なし」を追加した。`/customer/:tableCode` は商品画像を常に固定領域で表示し、未設定または読み込み失敗時は「画像なし」fallback を表示する。
- validation 方針: 空値は許可。`http://` / `https://` URL と `/` から始まるサイト内パスを許可。`data:` / `javascript:` / `file:` は拒否。最大長は 2048 文字。エラー文は `画像 URL は http(s) URL または / から始まるパスを指定してください` を基本にした。
- 更新した smoke script: `scripts/smoke-admin-menu.sh` に画像 URL 付き商品作成、admin / customer API 反映、画像 URL 更新、空戻し、不正 URL 拒否、`admin_menu_item_updated` の `before_data.image_url` / `after_data.image_url`、viewer の商品更新拒否を追加した。
- 更新した docs: README、`docs/03_data_model.md`, `docs/04_api_design.md`, `docs/05_screen_spec.md`, `docs/06_acceptance_criteria.md`, `docs/07_development_plan.md`, `docs/assumptions.md`, `docs/development-notes.md` を更新した。
- 検証結果: `node --check backend/nyan8/javascript/lib/runtime.js`, `./scripts/check-nyan8-api-files.mjs`, `./scripts/check-nyanql-sql-files.mjs`, `bash -n scripts/smoke-admin-menu.sh`, frontend `npm ci`, `npm audit --audit-level=high`, `npm run build` は成功した。`npm audit` は sandbox DNS 制限で一度失敗し、承認付き再実行で `found 0 vulnerabilities` を確認した。
- full smoke 結果: `./scripts/dev-reset-db.sh`, `./scripts/smoke-admin-menu.sh`, `./scripts/smoke-auth.sh`, `./scripts/smoke-audit-logs.sh`, `./scripts/smoke-admin-orders.sh`, `./scripts/smoke-admin-tables.sh`, `./scripts/smoke-menu.sh`, `./scripts/smoke-e2e.sh`, `./scripts/smoke-order-multiple-items.sh`, `./scripts/smoke-multiple-tables.sh`, `./scripts/smoke-cancel-flow.sh`, `./scripts/smoke-staff-call.sh`, `./scripts/smoke-checkout-csv.sh`, `./scripts/smoke-invalid-operations.sh`, `./scripts/smoke-prod-readiness.sh` は成功した。`smoke-prod-readiness.sh` はシステム既定 Node.js / npm では要件未満かつ sandbox DNS 制限で失敗し、Codex bundled Node.js `v24.14.0` と npm `10.9.8`、承認付きネットワーク実行で成功した。
- CI / static check 結果: `./scripts/ci-shellcheck.sh`, `./scripts/ci-repo-consistency.sh`, `./scripts/ci-prod-readiness-static.sh`, `git diff --check` は成功した。ローカルに shellcheck がないため shellcheck 実行は skip した。ローカルの `pyenv: cannot rehash` は環境由来の warning として継続している。

## 2026-06-24 Phase 11 商品・在庫・オプション強化 第4段階

- 実装範囲: 商品ごとの標準原価、注文時点の原価履歴、管理画面の原価入力・粗利・粗利率・赤字警告、分析サマリ / 商品ランキング / 売上 CSV / 注文管理詳細への原価・粗利反映を実装した。
- DB / SQL: `menu_items.cost_price` と `order_items.unit_cost_price` を追加した。注文確定時は `list_menu.sql` で取得した DB 原価を Nyan8 が `insert_order_item.sql` に渡し、フロントエンド送信値は使わない。分析・CSV・注文詳細は `order_items.unit_cost_price` を使う。
- 顧客 API 非公開: `list_menu.sql` は内部計算用に `cost_price` を返すが、`GET /api/customer/menu` の Nyan8 response には `cost_price`, `costPrice`, `grossProfit` を含めない。`smoke-admin-menu.sh` で JSON 文字列に原価・粗利キーが含まれないことを確認する。
- 原価仕様: `cost_price` は 0 以上の整数。販売価格を超えても登録可能で、管理画面では赤字警告を出す。オプション追加料金は売上に含めるが、MVP の追加原価は 0 とする。
- 更新した smoke script: `scripts/smoke-admin-menu.sh`, `scripts/smoke-e2e.sh`, `scripts/smoke-admin-orders.sh`, `scripts/smoke-checkout-csv.sh` に原価・粗利・顧客 API 非漏洩・CSV 列・取消明細除外の検証を追加した。
- 未対応事項: 仕入、入荷、棚卸、廃棄、原材料別原価、レシピ原価、複数店舗別原価、日別原価履歴、仕入先管理、自動原価計算、原価改定予約、高度な価格履歴管理。

## 2026-06-25 Phase 11 商品・在庫・オプション強化 第5段階

- 実装範囲: 在庫変動履歴 `inventory_movements`、在庫差分調整 `adjust-stock` API、商品別在庫履歴 API、`/admin/menu` の在庫調整フォームと履歴表示、注文確定 / 取消時の在庫履歴記録を実装した。
- DB / SQL: `inventory_movements` テーブルと `menu_item_id, occurred_at`, `movement_type, occurred_at`, `order_item_id` index を追加した。`insert_inventory_movement.sql`, `admin_adjust_menu_item_stock.sql`, `admin_list_menu_item_inventory_movements.sql` を追加し、`admin_update_menu_item_stock.sql` は在庫 0 の直接設定で `sold_out=true` にする。
- NyanQL API: `admin/menu/items/adjust-stock`, `admin/menu/items/inventory-movements`, `inventory-movements` を追加した。
- Nyan8 API: `POST /api/admin/menu/items/adjust-stock`, `GET /api/admin/menu/items/inventory-movements` を追加した。manager のみ利用可能。
- frontend API client: `InventoryMovement` 型、`cafeApi.adminAdjustMenuItemStock()`, `cafeApi.adminMenuItemInventoryMovements()` を追加した。
- 更新した画面: `/admin/menu` の在庫セクションに差分調整の `delta` / `reason` 入力、履歴種別 filter、直近履歴、在庫増減前後表示を追加した。
- 在庫履歴仕様: `manual_set`, `manual_adjust`, `order_reserved`, `order_cancel_restored` を記録する。注文確定時は同一注文内の同一商品数量を合算した商品単位の `order_reserved` を記録し、取消時は明細 ID を持つ `order_cancel_restored` を記録する。
- adjust-stock 仕様: `delta` は 0 以外の整数。`track_stock=true` 商品だけ対象。調整後在庫が 0 未満になる場合は 409。調整後在庫が 0 の場合は `sold_out=true` にするが、在庫が戻っても `sold_out=false` へは自動解除しない。
- audit log: `admin_menu_item_stock_adjusted`, `admin_menu_item_inventory_movements_viewed` を追加し、既存の `customer_order_stock_reserved`, `admin_order_item_stock_restored`, `admin_order_stock_restored`, `admin_menu_item_auto_sold_out` を維持した。`inventory_movements` は在庫変動履歴、`audit_logs` は操作監査として分ける。
- 更新した smoke script: `scripts/smoke-inventory.sh` を追加し、`scripts/ci-repo-consistency.sh` の必須 script に含めた。
- 更新した docs: README、`docs/03_data_model.md`, `docs/04_api_design.md`, `docs/05_screen_spec.md`, `docs/06_acceptance_criteria.md`, `docs/07_development_plan.md`, `docs/08_operations.md`, `docs/assumptions.md`, `docs/development-notes.md` を更新した。
- 検証結果: `node --check backend/nyan8/javascript/lib/runtime.js`, Nyan8 / NyanQL API 定義整合チェック, `bash -n scripts/smoke-inventory.sh`, `bash -n scripts/smoke-admin-menu.sh`, `./scripts/ci-shellcheck.sh`, `./scripts/ci-repo-consistency.sh`, `./scripts/ci-prod-readiness-static.sh`, `git diff --check`, frontend `npm ci`, `npm audit --audit-level=high`, `npm run build` は成功した。システム既定 Node.js / npm では要件未満のため、frontend build と production readiness smoke は Codex bundled Node.js `v24.14.0` と npm `10.9.8` 相当で確認した。
- smoke 結果: `./scripts/smoke-inventory.sh`, `./scripts/smoke-admin-menu.sh`, `./scripts/smoke-auth.sh`, `./scripts/smoke-audit-logs.sh`, `./scripts/smoke-admin-orders.sh`, `./scripts/smoke-admin-tables.sh`, `./scripts/smoke-menu.sh`, `./scripts/smoke-e2e.sh`, `./scripts/smoke-order-multiple-items.sh`, `./scripts/smoke-multiple-tables.sh`, `./scripts/smoke-cancel-flow.sh`, `./scripts/smoke-staff-call.sh`, `./scripts/smoke-checkout-csv.sh`, `./scripts/smoke-invalid-operations.sh`, `./scripts/smoke-prod-readiness.sh` は成功した。`smoke-inventory.sh` は `manual_set`, `manual_adjust`, `order_reserved`, `order_cancel_restored`, 在庫 0 自動売切、売切自動解除なし、非 manager 拒否を確認した。
- 未対応事項: 仕入 / 入荷 / 棚卸、廃棄専用フロー、原材料別在庫、複数店舗別在庫、バーコード、発注、在庫 CSV import / export、本格的な商品画像アップロード、画像 resize / CDN、レシピ原価。

## 2026-06-25 Phase 12 決済・返金・レシート 第1段階

- 実装範囲: 全額返金、返金履歴 `payment_refunds`、レシート再発行、返金後の分析・CSV 反映、返金 audit log、`/checkout` と `/admin/orders` の表示更新を実装した。
- DB / SQL: `payment_refunds` テーブルと `idx_payment_refunds_payment_id`, `idx_payment_refunds_refunded_at` を追加した。`get_payment_receipt.sql`, `insert_payment_refund.sql`, `update_payment_refunded.sql` を追加し、`analytics_sales_csv.sql` は返金状態列を末尾に追加した。
- NyanQL API: `payments/receipt`, `payments/refunds`, `payments/refunded` を追加した。
- Nyan8 API: `GET /api/checkout/receipt`, `POST /api/checkout/refund` を追加した。`cashier` / `manager` のみ利用可能で、checkout 端末を要求する。
- frontend API client / 型: `PaymentStatus`, `PaymentRefund`, `PaymentReceipt`, `cafeApi.receipt()`, `cafeApi.refundPayment()` を追加した。
- 更新した画面: `/checkout` に payment 検索、レシート表示、レシート再発行、返金理由入力、全額返金を追加した。`/admin/orders` は payment 状態と返金履歴を表示する。
- 返金仕様: `paid` payment のみ全額返金可能。返金成功時は `payments.status='refunded'` に更新し、`payment_refunds` に履歴を保存する。`refunded`, `failed`, `pending` と二重返金は拒否する。返金しても注文・明細・セッション履歴は削除しない。
- レシート再発行仕様: `payment_id` または `payment_no` で取得し、店舗名、payment_no、テーブル、支払日時、支払方法、明細、オプション、小計、税額、合計、返金履歴を表示する。原価・粗利は含めない。
- 分析・CSV: 分析サマリと商品ランキングは `payments.status='paid'` のみ売上対象とし、返金済み payment は除外する。売上 CSV は `payment_status`, `refund_amount`, `refunded_at`, `refund_reason` を末尾に追加した。
- audit log: `checkout_payment_refunded`, `checkout_refund_rejected`, `checkout_receipt_viewed`, `checkout_receipt_reissued` を追加した。
- smoke: `scripts/smoke-refund-receipt.sh` を追加し、receipt、全額返金、二重返金拒否、返金履歴、分析売上除外、CSV 返金列、audit、権限拒否を検証する。
- 未対応事項: 部分返金、支払い失敗 flow、決済取消、実決済連携、外部レシートプリンタ、電子レシート、日次締め。

## 2026-06-25 Phase 12 決済・返金・レシート 第2段階

- 実装範囲: 支払い失敗 flow、支払い再試行 flow、決済取消 flow、決済試行履歴 `payment_attempts`、支払い失敗 / 再試行成功 / 取消 audit log、`/checkout` と `/admin/orders` の表示更新を実装した。
- DB / SQL: `payment_attempts` テーブルと session / payment / status index を追加した。`payments.status` に `cancelled` を追加した。`insert_payment_attempt.sql`, `list_payment_attempts.sql`, `cancel_payment_attempt.sql`, `cancel_payment.sql` を追加し、`checkout_summary.sql`, `admin_list_orders.sql`, `admin_get_order_detail.sql`, `get_payment_receipt.sql`, `analytics_sales_csv.sql` を更新した。
- NyanQL API: `payment-attempts`, `payment-attempts/create`, `payment-attempts/cancel`, `payments/cancel` を追加した。
- Nyan8 API: `GET /api/checkout/payment-attempts`, `POST /api/checkout/cancel-payment` を追加し、`POST /api/checkout/settle` に `simulate_result='failed'` を追加した。
- frontend API client / 型: `PaymentAttempt`, `PaymentAttemptStatus`, `cafeApi.paymentAttempts()`, `cafeApi.cancelPayment()` を追加し、`cafeApi.settle()` は失敗シミュレーション入力を受け取れるようにした。
- 更新した画面: `/checkout` に失敗として処理、失敗理由、再試行、決済試行履歴、attempt 取消を追加した。`/admin/orders` は payment attempts と failed / cancelled 状態、失敗理由を表示する。
- 支払い失敗仕様: MVP では実決済連携ではなく `simulate_result='failed'` により `payment_attempts.status='failed'` を保存し、`payments` は作成しない。席セッションは `payment_requested` のまま維持する。
- 再試行仕様: failed / cancelled attempt があっても、同じ `payment_requested` セッションで再度 settle できる。成功時は `payments.status='paid'` と paid attempt を作成し、既存どおりセッションを閉じる。paid 後の追加 settle は拒否する。
- 決済取消仕様: pending / failed attempt は cancel 可能。paid / refunded payment の取消は拒否し、paid 後は refund を使う。
- 分析・CSV: 分析サマリと商品ランキングは `payments.status='paid'` のみ売上対象とする。failed / cancelled attempt は売上対象外。売上 CSV は `attempt_status`, `failure_reason`, `cancelled_reason` を末尾に追加し、failed / cancelled attempt は売上 0 の状態確認行として出す。
- audit log: `checkout_payment_failed`, `checkout_payment_retry_succeeded`, `checkout_payment_cancelled`, `checkout_payment_cancel_rejected`, `checkout_payment_attempts_viewed` を追加した。
- smoke: `scripts/smoke-payment-failure-cancel.sh` を追加し、支払い失敗、再試行成功、attempt 取消、failed / cancelled 売上除外、CSV attempt 列、receipt 拒否、audit、権限拒否を検証する。
- 未対応事項: 実決済サービス連携、クレジットカード実オーソリ、実売上確定、QR 決済実連携、外部決済 API webhook、部分返金、分割決済、日次締め、会計締め、外部レシートプリンタ、電子レシート送信。
- 検証結果: `node --check backend/nyan8/javascript/lib/runtime.js`, Nyan8 / NyanQL API 定義整合チェック, `bash -n scripts/smoke-payment-failure-cancel.sh`, `./scripts/ci-shellcheck.sh`, `./scripts/ci-repo-consistency.sh`, `./scripts/ci-prod-readiness-static.sh`, `git diff --check`, frontend `npm ci`, `npm audit --audit-level=high`, `npm run build`, `./scripts/smoke-prod-readiness.sh` は成功した。`npm audit` と production readiness smoke は sandbox DNS 制限のため承認付きネットワーク実行で確認した。
- smoke 結果: `./scripts/smoke-payment-failure-cancel.sh`, `./scripts/smoke-refund-receipt.sh`, `./scripts/smoke-checkout-csv.sh`, `./scripts/smoke-inventory.sh`, `./scripts/smoke-admin-menu.sh`, `./scripts/smoke-auth.sh`, `./scripts/smoke-audit-logs.sh`, `./scripts/smoke-admin-orders.sh`, `./scripts/smoke-admin-tables.sh`, `./scripts/smoke-order-multiple-items.sh`, `./scripts/smoke-multiple-tables.sh`, `./scripts/smoke-cancel-flow.sh`, `./scripts/smoke-staff-call.sh`, `./scripts/smoke-invalid-operations.sh`, `./scripts/smoke-menu.sh`, `./scripts/smoke-e2e.sh` は成功した。

## 2026-06-25 Phase 12 決済・返金・レシート 第3段階

- 実装範囲: 部分返金、複数返金履歴、返金可能残額、`partial_refunded` status、部分返金後の receipt / 分析 / CSV / audit log / `/checkout` / `/admin/orders` / `/analytics` 表示更新を実装した。
- DB / SQL: `payments.status` に `partial_refunded` を追加し、`payment_refunds(payment_id, refunded_at DESC)` index を追加した。`get_payment_receipt.sql` は `refund_total`, `refund_remaining`, `refund_status`, `refund_count` を返す。`update_payment_refunded.sql` は `partial_refunded` / `refunded` の更新に対応した。分析サマリは `gross_sales_total`, `refund_total`, `net_sales_total` を返し、CSV は `gross_amount`, `refund_total`, `refund_remaining`, `net_amount`, `refund_count`, `last_refunded_at` を追加した。
- NyanQL API: 既存 `payments/receipt`, `payments/refunds`, `payments/refunded`, `analytics/summary`, `analytics/item-ranking`, `analytics/sales-csv`, `admin/orders/detail` を拡張した。新規 endpoint は追加していない。
- Nyan8 API: `POST /api/checkout/refund` を `amount` 指定ありの部分返金、`amount` 未指定または `refund_type='full'` の残額全額返金に対応させた。`GET /api/checkout/receipt` は返金合計・残額・返金状態を返す。
- frontend API client / 型: `PaymentStatus` に `partial_refunded` を追加し、`PaymentReceipt` に返金合計・残額・返金状態を追加した。`cafeApi.refundPayment()` は `amount` と `refundType` を送信できる。
- 更新した画面: `/checkout` に返金額入力、部分返金、残額全額返金、返金済み合計、返金可能残額、一部返金済み badge を追加した。`/admin/orders` は `partial_refunded` filter、返金済み合計、返金可能残額を表示する。`/analytics` は総支払額、返金額、純売上を表示する。
- 部分返金仕様: `paid` / `partial_refunded` payment のみ返金可能。返金可能残額を超える返金、0 円以下、整数でない返金額、`refunded` / `failed` / `cancelled` payment への返金は拒否する。
- 分析・CSV 仕様: `net_sales = total_amount - refund_total` とし、`refunded` は net sales 0 とする。MVP では明細別返金を持たないため、商品別ランキングの返金反映は payment 単位の net 比率による概算とした。
- audit log: `checkout_payment_partially_refunded`, `checkout_payment_fully_refunded`, 互換用 `checkout_payment_refunded`, `checkout_refund_rejected` を記録する。成功ログには refund id / no、返金額、返金累計、返金可能残額、旧 status、新 status、理由を残す。
- 更新した smoke script: `scripts/smoke-refund-receipt.sh` を部分返金、超過返金拒否、残額全額返金、複数返金履歴、net sales、CSV 新列、partial / full audit log 検証に更新した。
- 更新した docs: README、`docs/03_data_model.md`, `docs/04_api_design.md`, `docs/05_screen_spec.md`, `docs/06_acceptance_criteria.md`, `docs/07_development_plan.md`, `docs/08_operations.md`, `docs/assumptions.md`, `docs/development-notes.md` を更新した。
- 未対応事項: 実決済サービス連携、外部決済 API webhook、明細別返金、返金取消、返金手数料、分割決済、日次締め、外部レシートプリンタ、電子レシート。
- 検証結果: `node --check backend/nyan8/javascript/lib/runtime.js`, `./scripts/check-nyan8-api-files.mjs`, `./scripts/check-nyanql-sql-files.mjs`, `bash -n scripts/smoke-refund-receipt.sh`, `./scripts/dev-reset-db.sh`, `./scripts/smoke-refund-receipt.sh`, `./scripts/smoke-checkout-csv.sh`, `./scripts/smoke-payment-failure-cancel.sh`, `./scripts/smoke-admin-orders.sh`, `./scripts/smoke-inventory.sh`, `./scripts/smoke-admin-menu.sh`, `./scripts/smoke-auth.sh`, `./scripts/smoke-audit-logs.sh`, `./scripts/smoke-admin-tables.sh`, `./scripts/smoke-menu.sh`, `./scripts/smoke-e2e.sh`, `./scripts/smoke-order-multiple-items.sh`, `./scripts/smoke-multiple-tables.sh`, `./scripts/smoke-cancel-flow.sh`, `./scripts/smoke-staff-call.sh`, `./scripts/smoke-invalid-operations.sh`, `./scripts/ci-shellcheck.sh`, `./scripts/ci-repo-consistency.sh`, `./scripts/ci-prod-readiness-static.sh`, `./scripts/smoke-prod-readiness.sh`, frontend `npm ci`, `npm audit --audit-level=high`, `npm run build`, `git diff --check` は成功した。`npm audit` と `smoke-prod-readiness.sh` は sandbox DNS 制限で一度失敗し、承認付きネットワーク実行で成功を確認した。ローカルの `pyenv: cannot rehash` と npm log 権限 warning は環境由来で、検証結果には影響しない。

## 2026-06-25 Phase 12 決済・返金・レシート 第4段階

- 実装範囲: 実決済連携の設計整理、`provider`, `external_payment_id`, `external_refund_id`, `idempotency_key`, `provider_status`, `provider_payload`, webhook event 履歴、mock provider webhook、webhook 重複受信の冪等処理を実装した。
- DB / SQL: `payments`, `payment_attempts`, `payment_refunds` に provider / external id / idempotency / provider status / provider payload を追加した。`payment_webhook_events` テーブルと provider event unique index、各 provider external id / idempotency index を追加した。idempotency / external id 参照、webhook event 作成・取得・状態更新、payment / attempt / refund provider_status 更新 SQL を追加した。
- NyanQL API: `payments/by-idempotency-key`, `payments/by-external-id`, `payments/provider-status`, `payments/refunds/by-idempotency-key`, `payments/refunds/by-external-id`, `payments/refunds/provider-status`, `payment-attempts/by-idempotency-key`, `payment-attempts/by-external-id`, `payment-attempts/provider-status`, `payment-webhook-events`, `payment-webhook-events/by-external-id`, `payment-webhook-events/create`, `payment-webhook-events/status` を追加した。
- Nyan8 API: `POST /api/checkout/settle` と `POST /api/checkout/refund` を provider / external id / idempotency 対応に拡張した。`POST /api/checkout/mock-provider/webhook`, `GET /api/checkout/webhook-events` を追加した。
- frontend API client / 型: `PaymentProvider`, `PaymentWebhookEvent`, provider / external id / provider status 型を追加し、`cafeApi.settle()`, `refundPayment()`, `mockProviderWebhook()`, `webhookEvents()` を更新した。
- 更新した画面: `/checkout` に外部決済連携テストセクション、provider / external payment id / settle idempotency key 入力、mock webhook 送信、webhook event 履歴、receipt の provider 情報、refund external id / idempotency key 入力を追加した。`/admin/orders` は payment / refund / attempt の provider、external id、provider status を表示する。
- provider / external id 仕様: 現行 provider は `internal` と `mock` のみ。`internal` は既存内部決済、`mock` は外部決済 provider を模した開発用 provider。将来候補は `stripe`, `square`, `paypay`, `other` とするが未実装。
- idempotency_key 仕様: settle / refund の同一 `idempotency_key` 再送は既存 payment / attempt / refund を返し、二重決済・二重返金を防ぐ。table / method / provider / payment / amount が既存内容と矛盾する場合は 409 で拒否する。
- webhook event 仕様: `provider + external_event_id` を一意に扱い、重複受信は既存 event を返して二重処理しない。対応 payment / attempt / refund がある場合は provider_status を更新し `processed`、見つからない場合は `ignored` にする。
- mock provider 仕様: `payment.succeeded`, `payment.failed`, `payment.cancelled`, `refund.succeeded`, `refund.failed` を受け付ける。本番 webhook 署名検証、API key 運用、実カード / QR 決済、実返金は未対応。
- audit log: `checkout_provider_payment_recorded`, `checkout_provider_refund_recorded`, `checkout_provider_webhook_received`, `checkout_provider_webhook_processed`, `checkout_provider_webhook_ignored`, `checkout_provider_webhook_duplicate`, `checkout_provider_idempotency_rejected` を追加した。秘匿情報は audit log に出さない。
- 更新した smoke script: `scripts/smoke-payment-provider.sh` を追加し、mock provider 決済、external id 保存、settle / refund idempotency、mock webhook processed / duplicate / ignored、receipt provider 情報、webhook event 一覧権限、audit を検証する。
- 更新した docs: README、`docs/03_data_model.md`, `docs/04_api_design.md`, `docs/05_screen_spec.md`, `docs/06_acceptance_criteria.md`, `docs/07_development_plan.md`, `docs/08_operations.md`, `docs/assumptions.md`, `docs/development-notes.md` を更新した。
- 未対応事項: 実 Stripe / Square / PayPay 連携、外部決済 API key の本番運用、外部 webhook 署名検証、本番 webhook endpoint 公開、実カード決済、実 QR 決済、実返金、分割決済、返金取消、日次締め、外部レシートプリンタ、電子レシート。
- 検証結果: `node --check backend/nyan8/javascript/lib/runtime.js`, `./scripts/check-nyan8-api-files.mjs`, `./scripts/check-nyanql-sql-files.mjs`, `bash -n scripts/smoke-payment-provider.sh`, `./scripts/dev-reset-db.sh`, `./scripts/smoke-payment-provider.sh`, `./scripts/smoke-refund-receipt.sh`, `./scripts/smoke-payment-failure-cancel.sh`, `./scripts/smoke-checkout-csv.sh`, `./scripts/smoke-admin-orders.sh`, `./scripts/smoke-auth.sh`, `./scripts/smoke-inventory.sh`, `./scripts/smoke-admin-menu.sh`, `./scripts/smoke-audit-logs.sh`, `./scripts/smoke-admin-tables.sh`, `./scripts/smoke-menu.sh`, `./scripts/smoke-e2e.sh`, `./scripts/smoke-order-multiple-items.sh`, `./scripts/smoke-multiple-tables.sh`, `./scripts/smoke-cancel-flow.sh`, `./scripts/smoke-staff-call.sh`, `./scripts/smoke-invalid-operations.sh`, `./scripts/ci-shellcheck.sh`, `./scripts/ci-repo-consistency.sh`, `./scripts/ci-prod-readiness-static.sh`, `./scripts/smoke-prod-readiness.sh`, frontend `npm ci`, `npm audit --audit-level=high`, `npm run build`, `git diff --check` は成功した。`npm audit` と `smoke-prod-readiness.sh` は sandbox DNS 制限で一度失敗し、承認付きネットワーク実行で成功を確認した。DB 初期化を含む smoke を並列実行した際に一時的な状態衝突があったため、該当 smoke は単独で再実行して成功を確認した。ローカルの `pyenv: cannot rehash` と npm log 権限 warning は環境由来で、検証結果には影響しない。

## 2026-06-25 Phase 12 決済・返金・レシート 第5段階

- 実装範囲: 営業日単位の日次締め preview / close / detail / list / reopen / CSV、日次締め履歴 `daily_cash_closures`、`/analytics` の締め UI、audit log、専用 smoke を実装した。
- DB / SQL: `daily_cash_closures` テーブルと business date / status index を追加した。`preview_daily_cash_closure.sql`, `close_daily_cash_closure.sql`, `get_daily_cash_closure.sql`, `list_daily_cash_closures.sql`, `reopen_daily_cash_closure.sql`, `export_daily_cash_closure_csv.sql` を追加した。
- NyanQL API: `analytics/daily-close/preview`, `analytics/daily-close/close`, `analytics/daily-close/detail`, `analytics/daily-close/list`, `analytics/daily-close/reopen`, `analytics/daily-close/export-csv` を追加した。
- Nyan8 API: `GET /api/analytics/daily-close/preview`, `POST /api/analytics/daily-close/close`, `GET /api/analytics/daily-close/detail`, `GET /api/analytics/daily-close/list`, `POST /api/analytics/daily-close/reopen`, `GET /api/analytics/daily-close/export-csv` を追加した。preview / detail / list / CSV は manager / viewer、close / reopen は manager のみ利用可能。
- frontend API client / 型: `DailyCashClosure` 型、`dailyClosePreview()`, `dailyCloseClose()`, `dailyCloseDetail()`, `dailyCloseList()`, `dailyCloseReopen()`, `exportDailyCloseCsv()` を追加した。
- 更新した画面: `/analytics` に営業日 selector、日次締め preview / close / reopen、締めメモ、reopen 理由、日次締め CSV、日次 gross / refund / net / tax / cost / gross profit、決済手段別、provider 別、状態別件数を追加した。
- 集計仕様: 成立支払いは `paid` / `partial_refunded` / `refunded` payment とし、`gross_sales_total` は元支払額、`refund_total` は返金履歴合計、`net_sales_total` は差引純売上とする。failed / cancelled attempt は売上金額に含めず、件数として日次締めに含める。
- close / reopen 仕様: `closed` の二重 close は 409 で拒否する。manager が理由付きで reopen でき、再 close は同じ `daily_cash_closures` row を更新して `closed` に戻す。
- CSV 仕様: 日次締め CSV は Nyan8 ランタイム制約に合わせ、JSON の `result.csv` として返し、フロントエンドが Blob 化して保存する。
- audit log: `analytics_daily_close_previewed`, `analytics_daily_close_closed`, `analytics_daily_close_reopened`, `analytics_daily_close_exported`, `analytics_daily_close_rejected` を追加した。
- smoke: `scripts/smoke-daily-close.sh` を追加し、paid / partial_refunded / failed / cancelled を含む日次集計、二重 close 拒否、viewer 権限、reopen / 再 close、CSV、audit を検証する。
- 更新した docs: README、`docs/03_data_model.md`, `docs/04_api_design.md`, `docs/05_screen_spec.md`, `docs/06_acceptance_criteria.md`, `docs/07_development_plan.md`, `docs/08_operations.md`, `docs/assumptions.md`, `docs/development-notes.md` を更新した。
- 未対応事項: 締め後差分の別履歴、承認ワークフロー、月次締め、実 provider 残高照合、複数店舗別締め、外部レシートプリンタ、電子レシート。
- 検証結果: `node --check backend/nyan8/javascript/lib/runtime.js`, `./scripts/check-nyan8-api-files.mjs`, `./scripts/check-nyanql-sql-files.mjs`, `bash -n scripts/smoke-daily-close.sh`, `./scripts/ci-shellcheck.sh`, `./scripts/ci-repo-consistency.sh`, `./scripts/ci-prod-readiness-static.sh`, `git diff --check`, frontend `npm ci`, `npm audit --audit-level=high`, `npm run build`, `./scripts/smoke-daily-close.sh`, `./scripts/smoke-payment-provider.sh`, `./scripts/smoke-refund-receipt.sh`, `./scripts/smoke-payment-failure-cancel.sh`, `./scripts/smoke-checkout-csv.sh` は成功した。`npm audit` は sandbox DNS 制限のため承認付きネットワーク実行で確認した。`./scripts/smoke-prod-readiness.sh` はシステム既定 Node.js `v16.17.1` と npm `8.15.0` が要件未満、かつ sandbox DNS 制限で失敗したため、個別の build / audit / static check で代替確認した。

## 2026-06-25 Phase 12.6 Phase 12 完了確認・本番 readiness 再確認・Phase 13 着手準備

- Git / GitHub 状態: `git fetch origin` 後、`master` と `origin/master` は一致していた。`git rev-list --left-right --count master...origin/master` は `0 0`、最新 commit は `819a160 Fix smoke script shellcheck path`。remote は `git@github.com:yamakawa0/training-cafe-order-system-codex.git`。
- 実装 / docs 照合: `daily_cash_closures`, `daily-close`, `payment_webhook_events`, `mock-provider`, `external_payment_id`, `external_refund_id`, `idempotency_key`, `partial_refunded`, `refund_remaining`, `net_sales_total`, `analytics_daily_close_closed`, `analytics_daily_close_reopened`, `analytics_daily_close_exported` の実装・UI・smoke・docs 参照を確認した。
- Node / npm 状態: システム既定は Node.js `v16.17.1`, npm `8.15.0`。`.nvmrc` は `20`、`frontend/package.json` engines は Node.js `>=20.19`, npm `>=10`。Codex bundled Node.js `v24.14.0` を PATH 先頭にして build 系を確認したが、ローカル npm は `8.15.0` のため `npm ci` では npm engine warning が出る。
- `./scripts/smoke-prod-readiness.sh`: システム既定 Node.js / npm では Node.js `>=20.19` と npm `>=10` を満たさず、sandbox DNS 制限で npm registry へ到達できないため失敗した。代替として、承認付きネットワーク実行の `npm audit --audit-level=high` は `found 0 vulnerabilities`、frontend build、`ci-prod-readiness-static` は成功した。
- full smoke: PostgreSQL / NyanQL / Nyan8 起動済み、ローカル DB 接続を許可した検証環境で `./scripts/dev-reset-db.sh`, `./scripts/smoke-daily-close.sh`, `./scripts/smoke-payment-provider.sh`, `./scripts/smoke-refund-receipt.sh`, `./scripts/smoke-payment-failure-cancel.sh`, `./scripts/smoke-inventory.sh`, `./scripts/smoke-admin-menu.sh`, `./scripts/smoke-auth.sh`, `./scripts/smoke-audit-logs.sh`, `./scripts/smoke-admin-orders.sh`, `./scripts/smoke-admin-tables.sh`, `./scripts/smoke-menu.sh`, `./scripts/smoke-e2e.sh`, `./scripts/smoke-order-multiple-items.sh`, `./scripts/smoke-multiple-tables.sh`, `./scripts/smoke-cancel-flow.sh`, `./scripts/smoke-staff-call.sh`, `./scripts/smoke-checkout-csv.sh`, `./scripts/smoke-invalid-operations.sh` が順次成功した。
- CI / static check: frontend `npm ci`, `npm audit --audit-level=high`, `npm run build`, `node --check backend/nyan8/javascript/lib/runtime.js`, `./scripts/check-nyan8-api-files.mjs`, `./scripts/check-nyanql-sql-files.mjs`, `./scripts/ci-shellcheck.sh`, `./scripts/ci-repo-consistency.sh`, `./scripts/ci-prod-readiness-static.sh`, `git diff --check` は成功した。ローカルに shellcheck がないため `ci-shellcheck.sh` の shellcheck 実行は skip し、`bash -n` は全対象で成功した。
- docs 更新: `docs/07_development_plan.md` で Phase 12 を完了済みへ整理し、Phase 12.6 の確認結果と Phase 13 第1候補を記録した。`docs/06_acceptance_criteria.md` に Phase 12.6 受け入れ条件を追加した。`docs/08_operations.md` と README に Node/npm / readiness smoke / DNS 制限時の運用注意を追記した。
- Phase 13 第1候補: 顧客会員の土台。予約は顧客情報を前提にし、複数店舗は DB / 認証 / メニュー / 在庫 / 会計 / 締めへの影響が大きいため、先に顧客マスタ、顧客検索、来店履歴、注文履歴、注文または席セッションへの顧客紐付けから始める方針にした。
