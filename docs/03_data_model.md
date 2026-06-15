# 03 Data Model

## 主要テーブル

- `cafe_tables`
- `terminals`
- `menu_categories`
- `menu_items`
- `menu_item_options`
- `menu_option_choices`
- `table_sessions`
- `orders`
- `order_items`
- `order_item_options`
- `hall_tasks`
- `payments`
- `users`
- `user_sessions`
- `audit_logs`

## audit_logs

Phase 5 では、管理操作と重要な業務操作を `audit_logs` に記録する。

- `id`
- `occurred_at`
- `actor_terminal_code`
- `actor_terminal_type`
- `actor_user_id`
- `actor_user_display_name`
- `actor_user_role`
- `action`
- `target_type`
- `target_id`
- `target_label`
- `status`
- `before_data`
- `after_data`
- `request_data`
- `error_message`
- `created_at`

`status` は `success` / `failure` を想定する。ログは物理削除しない。

## users / user_sessions

Phase 6 では簡易ログイン用に `users` と `user_sessions` を追加する。`users` は `id`, `login_id`, `display_name`, `password_hash`, `role`, `active`, `created_at`, `updated_at` を持ち、role は `manager`, `cashier`, `kitchen`, `hall`, `viewer` のいずれかとする。

`user_sessions` は `id`, `user_id`, `session_token`, `terminal_code`, `expires_at`, `created_at`, `last_seen_at` を保持する。`session_token` は API 呼び出し時に `Authorization: Bearer <token>` として送信する。MVP ではフロントエンドが localStorage に保存する。`expires_at` を過ぎた session、logout 済み session、inactive user の session は認証不可とする。

ログイン済み操作では監査ログに user actor を記録し、顧客端末操作など token のない操作では従来どおり terminal actor を記録する。

## 主要状態

### table_sessions.status

- `seated`
- `ordering`
- `payment_requested`
- `paid`
- `closed`

### order_items.status

- `ordered`
- `accepted`
- `cooking`
- `ready`
- `served`
- `cancelled`

### hall_tasks.status

- `todo`
- `doing`
- `done`
- `cancelled`

## 状態遷移ルール

- 注文明細は原則 `ordered -> accepted -> cooking -> ready -> served` の順に進める。
- キッチン操作では `served` にできない。`served` はホール画面の配膳完了で更新する。
- `ready` になった注文明細には `serve_item` ホールタスクを作成する。
- 精算完了後は `clean_table` ホールタスクを作成する。
