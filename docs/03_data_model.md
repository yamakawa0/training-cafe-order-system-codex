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
- 主なカラム: `id`, `category_id`, `name`, `description`, `price`, `tax_rate`, `image_url`, `kitchen_station`, `allergy_note`, `sold_out`, `active`, `display_order`
- 主な状態値: `active`, `sold_out`
- 関連テーブル: `menu_categories`, `menu_item_options`, `order_items`
- 注意点: 金額はフロントエンド送信値を正とせず、DB の商品価格・税率から計算する。`active=false` は顧客メニュー非表示、`sold_out=true` は注文不可。

### menu_item_options

- 目的: 商品ごとのオプション項目を管理する。
- 主なカラム: `id`, `item_id`, `name`, `required`, `multi_select`, `display_order`
- 主な状態値: `required`, `multi_select`
- 関連テーブル: `menu_items`, `menu_option_choices`
- 注意点: 顧客画面ではオプション選択モーダルで利用する。高度な編集 UI は今後対応。

### menu_option_choices

- 目的: オプションの選択肢を管理する。
- 主なカラム: `id`, `option_id`, `name`, `price_delta`, `active`, `display_order`
- 主な状態値: `active`
- 関連テーブル: `menu_item_options`, `order_item_options`
- 注意点: 選択肢の追加料金は会計計算に含める。

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
- 主なカラム: `id`, `order_id`, `menu_item_id`, `item_name`, `unit_price`, `quantity`, `status`, `kitchen_station`, `allergy_note`, `customer_note`, `accepted_at`, `cooking_started_at`, `ready_at`, `served_at`, `cancelled_at`
- 主な状態値: `ordered`, `accepted`, `cooking`, `ready`, `served`, `cancelled`
- 関連テーブル: `orders`, `menu_items`, `order_item_options`, `hall_tasks`
- 注意点: 基本遷移は `ordered -> accepted -> cooking -> ready -> served`。`ordered`, `accepted`, `cooking` の明細だけキャンセル可能。取消明細は会計・分析から除外する。

### order_item_options

- 目的: 注文時点のオプション選択を履歴として保持する。
- 主なカラム: `id`, `order_item_id`, `option_name`, `choice_name`, `price_delta`
- 関連テーブル: `order_items`
- 注意点: 商品・オプション定義が後から変更されても注文時点の名称と金額差分を保持する。

### hall_tasks

- 目的: ホールスタッフの作業を管理する。
- 主なカラム: `id`, `task_type`, `session_id`, `table_id`, `order_item_id`, `status`, `priority`, `title`, `note`, `assigned_to`, `started_at`, `completed_at`
- 主な状態値: `task_type` は `serve_item`, `staff_call`, `checkout_support`, `clean_table`。`status` は `todo`, `doing`, `done`, `cancelled`
- 関連テーブル: `table_sessions`, `cafe_tables`, `order_items`
- 注意点: 注文明細が `ready` になると配膳タスク、会計依頼で会計サポート、精算完了で片付けタスクを作成する。

### payments

- 目的: 精算記録を管理する。
- 主なカラム: `id`, `session_id`, `payment_no`, `method`, `status`, `subtotal`, `tax_amount`, `total_amount`, `paid_at`
- 主な状態値: `method` は `cash`, `card`, `qr`。`status` は `pending`, `paid`, `failed`, `refunded`
- 関連テーブル: `table_sessions`
- 注意点: 現行はダミー決済。返金や実決済連携は今後対応。

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
