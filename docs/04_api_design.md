# 04 API Design

## 公開 API 方針

フロントエンドは Nyan8 の `/api/*` のみを呼び出す。NyanQL は Nyan8 から内部 API として呼び出す。API レスポンスは原則として `success`, `status`, `result`, `message` を持つ JSON とする。

本番運用では `/api/*` を HTTPS reverse proxy 経由で Nyan8 へ転送する。NyanQL は直接公開しない。管理系 API は session 認証済みの `manager` role を必須とし、認証済み API は `cafe_session` cookie 主方式を設計上の主方式にする。Nyan8 の header / cookie 制約に対応するため Bearer token と `token` パラメータ互換は残すが、本番では実 `Set-Cookie` / `Cookie` header の扱いを reverse proxy / Nyan8 実行環境で検証する。HTTPS は必須とする。

## 認可ルール

- 顧客 API: token 不要
- キッチン API: `kitchen` / `manager`
- ホール API: `hall` / `manager`
- レジ API: `cashier` / `manager`
- 分析 API: `manager` / `viewer`
- 管理 API: `manager`

`terminal_code` は各 API で端末種別、active 判定、席端末判定、監査ログ補助情報として使う。認証済み API では cookie 主方式、Bearer token、`token` パラメータ互換を受け付ける。

## 認証 API

| Method | Path | 用途 |
|---|---|---|
| POST | `/api/auth/login` | ログイン、session 作成、疑似 `Set-Cookie` 返却 |
| POST | `/api/auth/logout` | session 失効、cookie 削除 |
| GET | `/api/auth/me` | 現在ユーザー取得 |

## 顧客 API

| Method | Path | 用途 |
|---|---|---|
| GET | `/api/customer/menu` | 顧客向けメニュー取得 |
| POST | `/api/customer/session/open` | 席セッション開始 |
| GET | `/api/customer/session/current` | 現在の席セッション取得 |
| POST | `/api/customer/order/submit` | 注文確定 |
| GET | `/api/customer/order/history` | 注文履歴取得 |
| POST | `/api/customer/payment/request` | 会計依頼 |
| POST | `/api/customer/staff-call` | スタッフ呼び出し |

顧客 API はログイン不要。ただし customer terminal の `terminal_code`、端末 active、席との紐付けを検証する。

## キッチン API

| Method | Path | 用途 |
|---|---|---|
| GET | `/api/kitchen/tickets` | キッチン向け注文明細一覧 |
| POST | `/api/kitchen/item/status` | 注文明細の調理状態更新 |

`ordered -> accepted -> cooking -> ready` の範囲を扱う。`served` はホールタスク完了で更新する。

## ホール API

| Method | Path | 用途 |
|---|---|---|
| GET | `/api/hall/tasks` | ホールタスク一覧 |
| POST | `/api/hall/task/status` | ホールタスク状態更新 |

配膳タスク完了時は対応する注文明細を `served` にする。片付けタスク完了時は席を空席へ戻す。

## レジ API

| Method | Path | 用途 |
|---|---|---|
| GET | `/api/checkout/summary` | 精算明細取得 |
| POST | `/api/checkout/settle` | 精算確定 |
| GET | `/api/checkout/receipt` | レシート取得・再発行 |
| POST | `/api/checkout/refund` | 全額 / 部分返金 |
| POST | `/api/checkout/cancel-payment` | 決済試行 / pending・failed payment 取消 |
| GET | `/api/checkout/payment-attempts` | 決済試行履歴取得 |
| POST | `/api/checkout/mock-provider/webhook` | mock provider webhook 受信 |
| GET | `/api/checkout/webhook-events` | webhook event 履歴取得 |

会計依頼済みセッションだけ精算対象とする。金額は DB の未取消明細から計算する。`POST /api/checkout/settle` は `provider`, `external_payment_id`, `idempotency_key` を受け取れる。未指定時は `provider='internal'` とし、`provider='mock'` は外部決済成功を模した開発用 provider として `payments.provider`, `payments.external_payment_id`, `payments.idempotency_key`, `payments.provider_status` に保存する。同じ `idempotency_key` で同一 table / method / provider の再送は既存 payment または attempt を返して二重作成しない。内容が異なる場合は 409 で拒否する。`simulate_result='failed'` の場合は `payment_attempts.status='failed'` を記録し、`payments` は作成せず、席セッションは `payment_requested` のまま維持する。失敗後は同じ席セッションで再度 settle でき、成功時は `payments.status='paid'` と `payment_attempts.status='paid'` を作成して既存どおりセッションを閉じる。paid 後の追加 settle は拒否する。

`/api/checkout/cancel-payment` は `attempt_id` または `payment_id` を受け取る。MVP では `pending` / `failed` attempt の取消を主対象とし、取消後も席セッションは `payment_requested` のまま再試行可能にする。paid / partial_refunded / refunded payment の取消は拒否し、paid 後は refund API を使う。

`/api/checkout/receipt` と `/api/checkout/refund` は `cashier` / `manager` のみ利用でき、checkout 端末の `terminal_code` を要求する。返金は `paid` / `partial_refunded` payment のみ可能で、`amount` 指定ありの場合は部分返金、`amount` 未指定または `refund_type='full'` の場合は返金可能残額の全額返金として扱う。`refund` は `provider`, `external_refund_id`, `idempotency_key` を受け取れる。provider 未指定時は元 payment の provider を引き継ぐ。同じ refund `idempotency_key` の再送は既存 refund と receipt を返して二重返金しない。返金可能残額を超える返金、`refunded`, `failed`, `pending`, `cancelled` payment への返金は 409 で拒否する。receipt は `payment_id` または `payment_no` で取得し、`paid` / `partial_refunded` / `refunded` のみ成功する。商品明細、オプション、小計、税額、合計、provider 情報、`refund_total`, `refund_remaining`, `refund_status`, 返金履歴を返すが、原価・粗利は含めない。

`POST /api/checkout/mock-provider/webhook` は開発用の mock provider webhook 受信 API で、`manager` / `cashier` が利用できる。`payment.succeeded`, `payment.failed`, `payment.cancelled`, `refund.succeeded`, `refund.failed` を受け取り、対応する payment / attempt / refund の `provider_status` を更新する。対応データがない場合は `payment_webhook_events.status='ignored'` として保存する。同じ `provider + external_event_id` の再送は既存 event を返し、二重処理しない。`GET /api/checkout/webhook-events` は `manager` のみ利用できる。本番 webhook は通常ログイン認証ではなく署名検証が必要で、API key / webhook secret は `.env.production` 等で管理し、audit log や frontend に出さない。

## 分析 API

| Method | Path | 用途 |
|---|---|---|
| GET | `/api/analytics/summary` | 売上分析サマリ |
| GET | `/api/analytics/item-ranking` | 商品別ランキング |
| GET | `/api/analytics/export-sales-csv` | 売上 CSV 出力 |

CSV は Nyan8 ランタイム制約に合わせ、JSON の `result.csv` として返し、フロントエンドが Blob 化して保存する。売上分析は `paid` / `partial_refunded` / `refunded` payment を支払記録として扱い、`gross_sales_total`, `refund_total`, `net_sales_total` を返す。`paid` は net sales が支払額、`partial_refunded` は支払額から返金累計を控除、`refunded` は net sales 0、failed / cancelled attempt は売上 0 とする。MVP では明細別返金を持たないため、商品別ランキングの返金反映は支払単位の net 比率による概算で、完全な明細別原価按分は未対応。売上 CSV は返金・失敗・取消確認用に末尾列 `payment_status`, `refund_amount`, `refunded_at`, `refund_reason`, `gross_amount`, `refund_total`, `refund_remaining`, `net_amount`, `refund_count`, `last_refunded_at`, `attempt_status`, `failure_reason`, `cancelled_reason` を持つ。

## メニュー管理 API

| Method | Path | 用途 |
|---|---|---|
| GET | `/api/admin/menu/categories` | カテゴリ一覧 |
| POST | `/api/admin/menu/categories` | カテゴリ追加 |
| POST | `/api/admin/menu/categories/update` | カテゴリ編集 |
| POST | `/api/admin/menu/categories/toggle-active` | カテゴリ表示 / 非表示切替 |
| POST | `/api/admin/menu/categories/move` | カテゴリ並び順変更 |
| GET | `/api/admin/menu/items` | 商品一覧 |
| POST | `/api/admin/menu/items` | 商品追加 |
| POST | `/api/admin/menu/items/update` | 商品編集 |
| POST | `/api/admin/menu/items/toggle-active` | 表示 / 非表示切替 |
| POST | `/api/admin/menu/items/toggle-sold-out` | 売切 / 売切解除 |
| POST | `/api/admin/menu/items/update-stock` | 在庫管理対象、在庫数、低在庫閾値を更新 |
| POST | `/api/admin/menu/items/adjust-stock` | 在庫数を差分調整 |
| GET | `/api/admin/menu/items/inventory-movements` | 商品別在庫変動履歴取得 |
| POST | `/api/admin/menu/items/move` | 並び順変更 |
| GET | `/api/admin/menu/items/options` | 商品別オプション一覧 |
| POST | `/api/admin/menu/items/options` | オプショングループ追加 |
| POST | `/api/admin/menu/items/options/update` | オプショングループ編集 |
| POST | `/api/admin/menu/items/options/toggle-active` | オプショングループ表示 / 非表示切替 |
| POST | `/api/admin/menu/items/options/move` | オプショングループ並び順変更 |
| POST | `/api/admin/menu/items/options/choices` | 選択肢追加 |
| POST | `/api/admin/menu/items/options/choices/update` | 選択肢編集 |
| POST | `/api/admin/menu/items/options/choices/toggle-active` | 選択肢表示 / 非表示切替 |
| POST | `/api/admin/menu/items/options/choices/move` | 選択肢並び順変更 |

管理 API は manager のみ利用できる。カテゴリ、商品、オプション、選択肢は物理削除せず `active=false` で非表示にする。`POST /api/admin/menu/items` は `image_url` と `cost_price` を受け取れ、`POST /api/admin/menu/items/update` は `image_url` と `cost_price` を更新でき、`GET /api/admin/menu/items` は `image_url`, `costPrice`, `grossProfit`, `grossMarginRate` を返す。`GET /api/customer/menu` は商品画像用の `imageUrl` を返すが、`cost_price` / `costPrice` / `grossProfit` は返さない。`image_url` は空値、`http://` / `https://` URL、または `/` から始まるサイト内パスのみ許可し、`data:` / `javascript:` / `file:` は拒否する。顧客メニュー API はログイン不要だが顧客端末の `terminal_code` を要求し、`active=false` のカテゴリ・商品・オプション・選択肢を返さない。顧客注文 API は `choice_ids` を受け取り、DB 側の現在価格、標準原価、選択ルール、在庫状態で再計算・検証する。注文確定時に `order_items.unit_cost_price` へ注文時点の `menu_items.cost_price` を保存する。`track_stock=true` の商品は注文確定時に `stock_quantity` を合算数量で検証し、不足時は 409 を返して注文全体を拒否する。注文成功時だけ在庫を減らし、`stock_quantity=0` になった商品は `sold_out=true` にする。キャンセル時は在庫を戻すが、売切の自動解除は行わない。`update-stock` は在庫管理設定と現在在庫の直接設定、`adjust-stock` は補充・減算・棚卸調整などの差分調整として使い分ける。`adjust-stock` は `delta` が 0 以外の整数で、在庫が 0 未満になる場合は 409 を返す。`inventory-movements` は `item_id`, 任意の `movement_type`, `limit`, `offset` を受け、商品別の在庫増減前後を返す。オプション追加料金は注文、キッチン ticket、注文履歴、レジ精算、売上分析、商品ランキング、売上 CSV、注文管理に反映する。オプション追加原価は MVP では 0 とする。

## 席・端末管理 API

| Method | Path | 用途 |
|---|---|---|
| GET | `/api/admin/tables` | 席一覧 |
| GET | `/api/admin/tables/detail` | 席詳細 |
| POST | `/api/admin/tables/update-status` | 席状態更新 |
| POST | `/api/admin/tables/force-close-session` | セッション強制クローズ |
| GET | `/api/admin/terminals` | 端末一覧 |
| POST | `/api/admin/terminals/update-active` | 端末有効状態更新 |

## 注文管理 API

| Method | Path | 用途 |
|---|---|---|
| GET | `/api/admin/orders` | 注文一覧 |
| GET | `/api/admin/orders/detail` | 注文詳細 |
| POST | `/api/admin/orders/cancel-item` | 注文明細取消 |
| POST | `/api/admin/orders/cancel-order` | 注文全体取消 |

取消可能状態は `ordered`, `accepted`, `cooking`。ready / served 明細や精算済み注文の取消は拒否する。

## 監査ログ API

| Method | Path | 用途 |
|---|---|---|
| GET | `/api/admin/audit-logs` | 監査ログ一覧 |
| GET | `/api/admin/audit-logs/detail` | 監査ログ詳細 |
| GET | `/api/admin/audit-logs/export-csv` | 監査ログ CSV 出力 |

監査ログ API は manager のみ利用できる。検索条件は `from_date`, `to_date`, `action`, `target_type`, `target_label`, `actor_terminal_code`, `actor_user_id`, `actor_user_role`, `status`, `keyword` を受け付ける。`keyword` は `action`, `target_type`, `target_id`, `target_label`, `actor_terminal_code`, `actor_user_display_name`, `actor_user_role`, `error_message` を横断検索する。`inventory_movements` は在庫変動の業務履歴、`audit_logs` は API 操作と認証イベントの監査ログとして分けて扱う。

CSV 列は `occurred_at`, `status`, `action`, `actor_user_id`, `actor_user_display_name`, `actor_user_role`, `actor_terminal_code`, `actor_terminal_type`, `target_type`, `target_id`, `target_label`, `error_message`, `request_data`, `before_data`, `after_data`。JSONB は 1 行の JSON 文字列として CSV escape する。password、session_token、生 token は含めない。CSV 出力操作自体も `admin_audit_logs_exported` として監査ログに残す。

## ユーザー管理 API

| Method | Path | 用途 |
|---|---|---|
| GET | `/api/admin/users` | ユーザー一覧 |
| POST | `/api/admin/users` | ユーザー作成 |
| POST | `/api/admin/users/update` | ユーザー更新 |
| POST | `/api/admin/users/toggle-active` | ユーザー有効状態切替 |

最後の active manager の無効化・降格と、自分自身の manager 権限変更は拒否する。

## NyanQL 内部 API

NyanQL は `backend/nyanql/api.json` に定義された SQL-first API を提供する。代表例は `menu`, `orders`, `order-items/status`, `hall/tasks/status`, `payments`, `analytics/summary`, `admin/*`, `auth/*`, `audit-logs`, `inventory-movements` である。外部公開せず Nyan8 からの内部呼び出しに限定する。
