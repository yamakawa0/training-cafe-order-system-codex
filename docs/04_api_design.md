# 04 API Design

## 公開 API 方針

フロントエンドは Nyan8 の API のみを呼び出す。NyanQL は Nyan8 から内部呼び出しする。

## API 一覧

| API | 用途 |
|---|---|
| `/api/bootstrap` | 端末情報取得 |
| `/api/customer/menu` | メニュー一覧取得 |
| `/api/customer/session/open` | 席セッション開始 |
| `/api/customer/session/current` | 席セッション取得 |
| `/api/customer/order/submit` | 注文確定 |
| `/api/customer/order/history` | 注文履歴 |
| `/api/customer/payment/request` | 会計依頼 |
| `/api/customer/staff-call` | スタッフ呼び出し |
| `/api/kitchen/tickets` | キッチン注文一覧 |
| `/api/kitchen/item/status` | 調理状態更新 |
| `/api/hall/tasks` | ホールタスク一覧 |
| `/api/hall/task/status` | ホールタスク状態更新 |
| `/api/checkout/summary` | 精算明細取得 |
| `/api/checkout/settle` | 精算確定 |
| `/api/analytics/summary` | 分析サマリ |
| `/api/analytics/item-ranking` | 商品別ランキング |
| `/api/analytics/export-sales-csv` | CSV 出力 |

## WebSocket チャネル

- `customer-session-{tableCode}`
- `kitchen-tickets`
- `hall-tasks`
- `checkout-queue`
- `analytics-summary`
