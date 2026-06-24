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

会計依頼済みセッションだけ精算対象とする。金額は DB の未取消明細から計算する。

## 分析 API

| Method | Path | 用途 |
|---|---|---|
| GET | `/api/analytics/summary` | 売上分析サマリ |
| GET | `/api/analytics/item-ranking` | 商品別ランキング |
| GET | `/api/analytics/export-sales-csv` | 売上 CSV 出力 |

CSV は Nyan8 ランタイム制約に合わせ、JSON の `result.csv` として返し、フロントエンドが Blob 化して保存する。

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

管理 API は manager のみ利用できる。カテゴリ、商品、オプション、選択肢は物理削除せず `active=false` で非表示にする。`POST /api/admin/menu/items` は `image_url` を受け取れ、`POST /api/admin/menu/items/update` は `image_url` を更新でき、`GET /api/admin/menu/items` は `image_url` を返す。`GET /api/customer/menu` も商品画像用の `image_url` / `imageUrl` を返す。`image_url` は空値、`http://` / `https://` URL、または `/` から始まるサイト内パスのみ許可し、`data:` / `javascript:` / `file:` は拒否する。顧客メニュー API はログイン不要だが顧客端末の `terminal_code` を要求し、`active=false` のカテゴリ・商品・オプション・選択肢を返さない。顧客注文 API は `choice_ids` を受け取り、DB 側の現在価格、選択ルール、在庫状態で再計算・検証する。`track_stock=true` の商品は注文確定時に `stock_quantity` を合算数量で検証し、不足時は 409 を返して注文全体を拒否する。注文成功時だけ在庫を減らし、`stock_quantity=0` になった商品は `sold_out=true` にする。キャンセル時は在庫を戻すが、売切の自動解除は行わない。オプション追加料金は注文、キッチン ticket、注文履歴、レジ精算、売上分析、商品ランキング、売上 CSV、注文管理に反映する。`POST /api/admin/menu/items/adjust-stock` と在庫履歴 API は未実装。

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

監査ログ API は manager のみ利用できる。検索条件は `from_date`, `to_date`, `action`, `target_type`, `target_label`, `actor_terminal_code`, `actor_user_id`, `actor_user_role`, `status`, `keyword` を受け付ける。`keyword` は `action`, `target_type`, `target_id`, `target_label`, `actor_terminal_code`, `actor_user_display_name`, `actor_user_role`, `error_message` を横断検索する。

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

NyanQL は `backend/nyanql/api.json` に定義された SQL-first API を提供する。代表例は `menu`, `orders`, `order-items/status`, `hall/tasks/status`, `payments`, `analytics/summary`, `admin/*`, `auth/*`, `audit-logs` である。外部公開せず Nyan8 からの内部呼び出しに限定する。
