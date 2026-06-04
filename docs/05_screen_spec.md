# 05 Screen Spec

## 顧客注文画面

![顧客注文画面 UI デザイン](assets/ui-design/customer-order.png)

- タッチ端末前提。
- カテゴリ、商品、カート、注文履歴を表示する。
- 注文確定後、キッチン画面に反映される。
- 会計依頼後は新規注文不可とする。

## キッチン画面

![キッチン画面 UI デザイン](assets/ui-design/kitchen-order-management.png)

- 注文明細単位でカード表示する。
- 状態は `ordered`, `accepted`, `cooking`, `ready` を中心に表示する。
- 経過時間を強調表示する。
- `ready` にするとホールタスクを生成する。

## ホール指示画面

![ホール指示画面 UI デザイン](assets/ui-design/hall-task-board.png)

- 配膳、スタッフ呼び出し、片付け、会計サポートをタスクとして表示する。
- タスクは `todo`, `doing`, `done`, `cancelled` で管理する。

## レジ精算画面

![レジ精算画面 UI デザイン](assets/ui-design/checkout-payment.png)

- 席番号を選択して未精算明細を表示する。
- 支払い方法は `cash`, `card`, `qr` のダミー決済とする。
- 精算完了後、席セッションを `paid` にする。

## 分析画面

![分析画面 UI デザイン](assets/ui-design/analytics-dashboard.png)

- PC 利用前提。
- 売上、注文数、客単価、商品ランキング、支払い方法別集計を表示する。
- CSV 出力を実装する。
