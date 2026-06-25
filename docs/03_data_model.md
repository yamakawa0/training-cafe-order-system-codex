# 03 Data Model

## 方針

DB は PostgreSQL を正式対象とする。NyanQL の SQL API が DB アクセスを担当し、Nyan8 controller が業務ルール、端末検証、認証・認可、監査ログ記録を組み合わせる。

## 主要テーブル

### cafe_tables

- 目的: 店舗内の席を管理する。
- 主なカラム: `id`, `table_code`, `display_name`, `seat_count`, `status`, `created_at`, `updated_at`
- 主な状態値: `available`, `occupied`, `disabled` を運用上使用する。
- 関連テーブル: `terminals`, `table_sessions`, `hall_tasks`
- 注意点: 席状態は注文・会計・片付けフローで更新され、管理画面では `available` / `disabled` へ変更できる。

### terminals

- 目的: 顧客端末、キッチン、ホール、レジ、分析 / 管理端末を識別する。
- 主なカラム: `id`, `terminal_code`, `terminal_type`, `table_id`, `display_name`, `active`
- 主な状態値: `terminal_type` は `customer`, `kitchen`, `hall`, `checkout`, `analytics`
- 関連テーブル: `cafe_tables`
- 注意点: `terminal_code` は端末種別・active 判定、席端末判定、監査ログ補助情報に使う。

### users

- 目的: スタッフ・管理者・閲覧専用ユーザーを管理する。
- 主なカラム: `id`, `login_id`, `display_name`, `password_hash`, `password_hash_version`, `password_updated_at`, `failed_login_count`, `locked_until`, `role`, `active`
- 主な状態値: `role` は `manager`, `cashier`, `kitchen`, `hall`, `viewer`
- 関連テーブル: `user_sessions`, `audit_logs`
- 注意点: password は平文保存しない。現行 hash は `salted_sha256_v1` または Node crypto 利用時の `pbkdf2_sha256_v1` を扱う。本番では bcrypt / argon2 等への移行を検討する。最後の active manager の無効化・降格は拒否する。

### user_sessions

- 目的: ログイン session を管理する。
- 主なカラム: `id`, `user_id`, `session_token`, `terminal_code`, `expires_at`, `revoked_at`, `user_agent`, `created_at`, `last_seen_at`
- 主な状態値: `expires_at` 超過、`revoked_at` 設定、inactive user は認証不可。
- 関連テーブル: `users`
- 注意点: 現行は `cafe_session` cookie 主方式を設計上の主方式とし、Nyan8 制約への開発互換として Bearer token / `token` パラメータも受け付ける。session 有効期限は 8 時間。

### menu_categories

- 目的: 商品カテゴリを管理する。
- 主なカラム: `id`, `name`, `display_order`, `active`
- 主な状態値: `active`
- 関連テーブル: `menu_items`
- 注意点: 顧客メニューでは active なカテゴリ・商品を表示対象にする。

### menu_items

- 目的: 販売商品を管理する。
- 主なカラム: `id`, `category_id`, `name`, `description`, `price`, `cost_price`, `tax_rate`, `image_url`, `kitchen_station`, `allergy_note`, `sold_out`, `track_stock`, `stock_quantity`, `low_stock_threshold`, `active`, `display_order`
- 主な状態値: `active`, `sold_out`
- 関連テーブル: `menu_categories`, `menu_item_options`, `order_items`, `inventory_movements`
- 注意点: 金額はフロントエンド送信値を正とせず、DB の商品価格・税率から計算する。`active=false` は顧客メニュー非表示、`sold_out=true` は注文不可。`track_stock=false` の商品は在庫数を見ない。`track_stock=true` の商品は注文確定時に `stock_quantity` を引き当て、不足時は注文全体を拒否する。`menu_items.stock_quantity` は現在在庫、`inventory_movements` は在庫変動履歴、`audit_logs` は操作監査を表す。注文成功または在庫調整で `stock_quantity=0` になった場合は `sold_out=true` にする。キャンセル時は在庫を戻すが、`sold_out=false` への自動解除は行わない。
- `image_url`: 商品画像 URL。空値可。顧客注文画面の商品カードに表示し、管理画面から編集できる。MVP では画像ファイル本体を DB に保存しない。本格 upload / resize / CDN は将来課題。
- `cost_price`: 商品 1 個あたりの現在の標準原価。販売価格 `price` と同じ税区分基準で扱う。顧客 API / 顧客画面には表示しない。`cost_price > price` も登録可能で、赤字商品として管理画面に警告する。

### inventory_movements

- 目的: 商品単位の在庫変動履歴を保持する。
- 主なカラム: `id`, `menu_item_id`, `movement_type`, `quantity_delta`, `quantity_before`, `quantity_after`, `reason`, `source_type`, `source_id`, `order_id`, `order_item_id`, `actor_user_id`, `actor_user_display_name`, `actor_user_role`, `actor_terminal_code`, `occurred_at`
- 主な状態値: `movement_type` は `manual_set`, `manual_adjust`, `order_reserved`, `order_cancel_restored`, `auto_sold_out`
- 関連テーブル: `menu_items`, `orders`, `order_items`
- 注意点: MVP では在庫増減を伴う履歴だけを記録する。`manual_set` は `update-stock` による現在在庫の直接設定、`manual_adjust` は `adjust-stock` による差分調整、`order_reserved` は注文確定時の引当、`order_cancel_restored` は取消時の在庫戻しを表す。自動売切は audit log に `admin_menu_item_auto_sold_out` として残し、在庫が戻っても売切は自動解除しない。

### menu_item_options

- 目的: 商品ごとのオプション項目を管理する。
- 主なカラム: `id`, `item_id`, `name`, `required`, `multi_select`, `min_select`, `max_select`, `active`, `display_order`, `created_at`, `updated_at`
- 主な状態値: `required`, `multi_select`, `active`
- 関連テーブル: `menu_items`, `menu_option_choices`
- 注意点: 顧客画面では `active=true` のオプションだけ表示する。`required=true` は最低 1 つ必須、`multi_select=false` は最大 1 つ、`multi_select=true` は `max_select` がある場合その数まで選択できる。物理削除ではなく `active=false` を優先する。

### menu_option_choices

- 目的: オプションの選択肢を管理する。
- 主なカラム: `id`, `option_id`, `name`, `price_delta`, `active`, `display_order`, `created_at`, `updated_at`
- 主な状態値: `active`
- 関連テーブル: `menu_item_options`, `order_item_options`
- 注意点: `price_delta` は 1 個あたりの追加料金。注文確定時に `order_item_options.price_delta` へ履歴保存し、会計、分析、商品ランキング、売上 CSV に含める。顧客画面には `active=true` の選択肢だけ表示する。

### table_sessions

- 目的: 着席から会計・片付けまでの席利用単位を管理する。
- 主なカラム: `id`, `table_id`, `status`, `guest_count`, `opened_at`, `payment_requested_at`, `closed_at`
- 主な状態値: `seated`, `ordering`, `payment_requested`, `paid`, `closed`
- 関連テーブル: `cafe_tables`, `orders`, `hall_tasks`, `payments`
- 注意点: 会計依頼後または精算済みのセッションでは追加注文を拒否する。

### orders

- 目的: 注文ヘッダを管理する。
- 主なカラム: `id`, `session_id`, `order_no`, `status`, `subtotal`, `tax_amount`, `total_amount`, `submitted_at`
- 主な状態値: `submitted`, `in_progress`, `ready`, `served`, `cancelled`, `closed`
- 関連テーブル: `table_sessions`, `order_items`
- 注意点: 注文明細状態に応じて集約状態を更新する。全明細取消時は `cancelled`。

### order_items

- 目的: 注文明細を管理する。
- 主なカラム: `id`, `order_id`, `menu_item_id`, `item_name`, `unit_price`, `unit_cost_price`, `quantity`, `status`, `kitchen_station`, `allergy_note`, `customer_note`, `accepted_at`, `cooking_started_at`, `ready_at`, `served_at`, `cancelled_at`
- 主な状態値: `ordered`, `accepted`, `cooking`, `ready`, `served`, `cancelled`
- 関連テーブル: `orders`, `menu_items`, `order_item_options`, `hall_tasks`
- 注意点: 基本遷移は `ordered -> accepted -> cooking -> ready -> served`。`ordered`, `accepted`, `cooking` の明細だけキャンセル可能。取消明細は会計・分析から除外する。`unit_cost_price` は注文確定時点の `menu_items.cost_price` を履歴保存し、後から商品マスタの原価が変わっても過去注文の原価・粗利は変えない。

### order_item_options

- 目的: 注文時点のオプション選択を履歴として保持する。
- 主なカラム: `id`, `order_item_id`, `option_name`, `choice_name`, `price_delta`
- 関連テーブル: `order_items`
- 注意点: 商品・オプション定義が後から変更されても注文時点の名称と金額差分を保持する。`price_delta` は注文明細単価に加算し、取消明細は会計・分析・CSV から除外する。

### hall_tasks

- 目的: ホールスタッフの作業を管理する。
- 主なカラム: `id`, `task_type`, `session_id`, `table_id`, `order_item_id`, `status`, `priority`, `title`, `note`, `assigned_to`, `started_at`, `completed_at`
- 主な状態値: `task_type` は `serve_item`, `staff_call`, `checkout_support`, `clean_table`。`status` は `todo`, `doing`, `done`, `cancelled`
- 関連テーブル: `table_sessions`, `cafe_tables`, `order_items`
- 注意点: 注文明細が `ready` になると配膳タスク、会計依頼で会計サポート、精算完了で片付けタスクを作成する。

### payments

- 目的: 精算記録を管理する。
- 主なカラム: `id`, `session_id`, `payment_no`, `method`, `status`, `subtotal`, `tax_amount`, `total_amount`, `provider`, `external_payment_id`, `idempotency_key`, `provider_status`, `provider_payload`, `paid_at`
- 主な状態値: `method` は `cash`, `card`, `qr`。`status` は `pending`, `paid`, `failed`, `partial_refunded`, `refunded`, `cancelled`
- 関連テーブル: `table_sessions`, `payment_refunds`, `payment_attempts`, `payment_webhook_events`
- 注意点: 現行は内部決済または `mock` provider のシミュレーション。`provider='internal'` は既存の内部ダミー決済、`mock` は外部決済サービスを模した開発用 provider とする。`external_payment_id` は provider 側の決済 ID、`idempotency_key` は二重決済防止用、`provider_status` は webhook / mock 応答後の外部状態を保持する。`provider_payload` は provider 応答の保存領域だが、本番では秘匿情報を保存しない。`payments` は成立した決済または返金対象の支払い記録として扱い、MVP の支払い失敗は原則 `payments` ではなく `payment_attempts` に記録する。返金累計が 0 円なら `paid`、支払額未満なら `partial_refunded`、支払額と等しければ `refunded` にする。分析は `net_sales = total_amount - refund_total` を使い、`refunded` は net sales 0、`failed` / `cancelled` は売上対象外とする。paid 後の取消は行わず返金 API を使う。

### payment_attempts

- 目的: 決済試行履歴を管理する。成功、失敗、取消を含め、支払い失敗後の再試行を追跡する。
- 主なカラム: `id`, `session_id`, `payment_id`, `attempt_no`, `method`, `status`, `amount`, `failure_reason`, `cancel_reason`, `provider`, `external_attempt_id`, `idempotency_key`, `provider_status`, `provider_payload`, `terminal_code`, `actor_user_id`, `actor_user_role`, `attempted_at`, `cancelled_at`
- 主な状態値: `method` は `cash`, `card`, `qr`。`status` は `pending`, `paid`, `failed`, `cancelled`
- 関連テーブル: `table_sessions`, `payments`
- 注意点: `simulate_result='failed'` による MVP 支払い失敗は `payment_attempts.status='failed'` として保存し、`table_sessions.status='payment_requested'` を維持する。`provider`, `external_attempt_id`, `idempotency_key`, `provider_status`, `provider_payload` は外部決済試行の識別と webhook 後の照合に使う。`pending` / `failed` attempt は取消でき、取消後も再試行可能。`failed` / `cancelled` attempt は売上対象外だが、売上 CSV には状態確認用の行として出す。

### payment_refunds

- 目的: 支払い単位の返金履歴を管理する。
- 主なカラム: `id`, `payment_id`, `refund_no`, `amount`, `reason`, `status`, `provider`, `external_refund_id`, `idempotency_key`, `provider_status`, `provider_payload`, `refunded_at`, `actor_user_id`, `actor_user_role`, `actor_terminal_code`
- 主な状態値: `status` は `refunded`, `failed`, `cancelled`
- 関連テーブル: `payments`, `payment_webhook_events`
- 注意点: 同一 `payment_id` に複数の返金履歴を保存できる。`external_refund_id` は provider 側の返金 ID、`idempotency_key` は二重返金防止用とする。MVP の部分返金は payment 単位の金額指定で、明細別返金、返金取消、返金手数料、原価按分は未対応。返金履歴は audit log とは別に業務履歴として保持する。売上 CSV には支払状態、返金累計、返金可能残額、純売上、返金回数、最終返金日時、理由を出す。

### payment_webhook_events

- 目的: 外部決済 provider からの webhook 受信履歴を管理する。
- 主なカラム: `id`, `provider`, `external_event_id`, `event_type`, `external_payment_id`, `external_refund_id`, `payment_id`, `refund_id`, `status`, `payload`, `received_at`, `processed_at`, `error_message`
- 主な状態値: `status` は `received`, `processed`, `ignored`, `failed`
- 関連テーブル: `payments`, `payment_refunds`
- 注意点: `provider + external_event_id` を一意に扱い、同じ webhook event の再送を二重処理しない。該当する payment / refund / attempt が見つからない場合は `ignored` として保存する。本番では payload に API key、署名 secret、カード番号、個人情報などの秘匿情報を保存しない。

### daily_cash_closures

- 目的: 営業日単位の日次締め結果を確定履歴として管理する。
- 主なカラム: `id`, `business_date`, `status`, `period_started_at`, `period_ended_at`, `gross_sales_total`, `refund_total`, `net_sales_total`, `tax_total`, `cost_total`, `gross_profit`, `cash_total`, `card_total`, `qr_total`, `internal_provider_total`, `mock_provider_total`, `paid_count`, `partial_refunded_count`, `refunded_count`, `failed_count`, `cancelled_count`, `refund_count`, `closed_by_user_id`, `closed_at`, `reopened_by_user_id`, `reopened_at`, `reopen_reason`, `note`
- 主な状態値: `status` は `closed`, `reopened`
- 関連テーブル: `payments`, `payment_refunds`, `payment_attempts`, `orders`, `order_items`, `users`, `audit_logs`
- 注意点: `business_date` は 1 店舗前提の営業日で一意に扱う。preview は現在の支払い・返金・試行履歴から再計算し、close は同じ値を `daily_cash_closures` に保存する。`closed` の二重 close は拒否し、`reopened` 後の再 close は同じ row を上書きして `closed` に戻す。集計対象の成立支払いは `paid` / `partial_refunded` / `refunded` payment とし、`gross_sales_total` は元支払額、`refund_total` は返金履歴合計、`net_sales_total` は差引純売上とする。failed / cancelled attempt は売上 0 の件数として集計する。

### audit_logs

- 目的: 重要操作と認証イベントを追跡する。
- 主なカラム: `id`, `occurred_at`, `actor_terminal_code`, `actor_terminal_type`, `actor_user_id`, `actor_user_display_name`, `actor_user_role`, `action`, `target_type`, `target_id`, `target_label`, `status`, `before_data`, `after_data`, `request_data`, `error_message`, `created_at`
- 主な状態値: `status` は `success`, `failure`
- 関連テーブル: `users`
- 注意点: audit_logs は物理削除しない前提。MVP では全件を同一テーブルに保持する。password、session_token、生 token は `request_data` や CSV に含めない。本番では 1 年以上などの保持期間と archive table / 外部 storage への移行方針を検討する。改ざん防止署名、hash chain、append-only storage、外部監査連携は今後対応。

## 重要な前提

- password は平文保存しない。
- `password_hash_version` は現行方式を識別する。
- 本番では bcrypt / argon2 等への移行を検討する。
- `audit_logs` は物理削除しない前提。
- 取消明細は会計・分析から除外する。
- フロントエンドから送信された金額を正として会計処理しない。
- MVP の返金は payment 単位の部分返金と残額全額返金に対応する。
- MVP の外部決済連携は `mock` provider による内部シミュレーションまでとし、実 Stripe / Square / PayPay 連携、実カード決済、実 QR 決済、実返金は未対応。
- MVP の支払い失敗は `simulate_result` による内部 flow とし、本番外部決済 API callback / webhook は未対応。
- paid 後の取消は不可で、返金を使う。
- MVP の日次締めは単一店舗・営業日単位で、月次締め、複数店舗別締め、実 provider 残高照合、締め後差分調整履歴は未対応。
