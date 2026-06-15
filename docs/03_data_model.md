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
- `audit_logs`

## audit_logs

Phase 5 では、管理操作と重要な業務操作を `audit_logs` に記録する。

- `id`
- `occurred_at`
- `actor_terminal_code`
- `actor_terminal_type`
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
