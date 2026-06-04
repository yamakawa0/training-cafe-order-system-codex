# Codex 実装指示書: 架空カフェ注文・会計システム

## 0. Codex への最重要指示

あなたは、TypeScript フロントエンドと NyanQL / Nyan8 / PostgreSQL を用いた業務アプリケーションの開発担当者です。
このリポジトリに、架空のカフェ店舗で利用する「注文・調理状態管理・ホール指示・セルフ会計・分析」システムを実装してください。

実装前に必ず以下を行ってください。

1. 既存リポジトリの構成、README、package.json、設定ファイル、既存実装を確認する。
2. NyanQL / Nyan8 / NyanPUI の使い方は、各リポジトリの README と実際の `api.json` / `config.json` / サンプルを確認してから実装する。
3. 不明点や仕様上の穴は、実装を止めずに合理的な仮定を置く。ただし、仮定した内容は `docs/assumptions.md` に明記する。
4. 大きな設計変更を行う場合は、理由を `docs/development-notes.md` に残す。
5. コードだけでなく、起動手順、DB 初期化手順、動作確認手順も更新する。

## 1. プロジェクト概要

架空のカフェ店舗向けに、店内端末を前提とした注文・会計システムを構築する。

対象画面は次の 5 種類。

1. 顧客注文画面（セルフ）
2. キッチン注文一覧〜調理状態管理画面
3. ホール指示画面
4. レジ精算（セルフ）画面
5. 分析画面

端末配置は次の通り。

- 顧客注文画面: 各席に備え付けの端末で使用する。
- キッチン注文一覧〜調理状態管理画面: キッチンに備え付けの端末で表示・操作する。
- ホール指示画面: ホール係待機所に備え付けの端末で表示・操作する。
- レジ精算画面: 店舗に備え付けのレジ端末で使用する。
- 分析画面: 店長等が使用する PC で使用する。

## 2. 採用技術

### 2.1 フロントエンド

- TypeScript
- React + Vite を推奨
- CSS Modules または通常 CSS。既存プロジェクトに CSS 方針がある場合はそれに従う。
- 外部 UI ライブラリは必須ではない。導入する場合は、理由を `docs/development-notes.md` に記載する。

### 2.2 バックエンド

NyanQL / Nyan8 / NyanPUI のうち、次の組み合わせを採用する。

- 採用: NyanQL
  - PostgreSQL への DB アクセス API を担当する。
  - SQL ファーストで、一覧取得・登録・更新・集計用 API を構成する。
  - `api.json` と `sql/*.sql` を中心に実装する。

- 採用: Nyan8
  - フロントエンドから直接呼ばれるコントローラー層を担当する。
  - 注文登録、調理状態変更、ホールタスク生成、会計確定など、複数 API 呼び出しや入力検証を含む処理を JavaScript で実装する。
  - NyanQL は原則として Nyan8 から内部呼び出しする。

- 原則不採用: NyanPUI
  - 今回のフロントエンドは TypeScript SPA とするため、サーバーサイド HTML レンダリング用途の NyanPUI は原則使用しない。
  - ただし、既存リポジトリが NyanPUI 前提で構成されている場合のみ、最小限の静的配信や管理画面の補助として利用してよい。その場合は理由を明記する。

### 2.3 DB

- PostgreSQL
- ID は `VARCHAR(50)` を基本とし、アプリケーション側で `crypto.randomUUID()` 相当の文字列を生成する。
- PostgreSQL 拡張機能への依存は避ける。
- 金額は `INTEGER` の円単位で保持する。
- 日時は `TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP` を基本とする。

## 3. システムの基本方針

### 3.1 店舗運用上の前提

- 店舗は 1 店舗を想定する。
- 席ごとに `table_code` を持つ。
- 顧客は着席後、席端末から注文する。
- 注文が確定すると、キッチン画面へ即時反映される。
- 調理完了した商品はホール指示画面に配膳タスクとして表示される。
- 顧客は退店前にレジ端末でセルフ精算する。
- 分析画面は当日・期間別の売上、商品別売上、調理時間、回転率を確認する。

### 3.2 リアルタイム反映

以下の更新は、ポーリングではなく WebSocket Push を優先する。

- 顧客注文確定 → キッチン画面
- 調理完了 → ホール指示画面
- 配膳完了 → 顧客注文画面 / 会計画面
- 会計依頼 → レジ精算画面
- 会計完了 → 席状態 / 分析画面

WebSocket の実装が難しい場合は、暫定的に 5 秒間隔のポーリングを実装してよい。ただし、`docs/development-notes.md` に暫定対応であることを明記する。

## 4. 画面仕様

### 4.1 顧客注文画面（セルフ）

#### URL 例

- `/customer/:tableCode`

#### 目的

席端末で顧客がメニューを閲覧し、商品をカートに入れ、注文を確定できるようにする。

#### 主な表示項目

- 席番号 / テーブルコード
- カテゴリ一覧
- メニュー一覧
- 商品詳細
- オプション選択
- カート
- 注文履歴
- 注文状態
- 会計へ進むボタン
- スタッフ呼び出しボタン

#### 主な操作

- カテゴリ選択
- 商品選択
- 数量変更
- オプション選択
- カート追加
- カート内数量変更 / 削除
- 注文確定
- 注文履歴確認
- 会計依頼
- スタッフ呼び出し

#### バリデーション

- 売り切れ商品は注文不可。
- 非表示商品は表示しない。
- 数量は 1〜99。
- オプション必須の商品は、必須オプション未選択ではカート追加不可。
- 会計依頼後は新規注文不可。ただし、店舗運用変更を想定し、将来解除できる設計にする。

### 4.2 キッチン注文一覧〜調理状態管理画面

#### URL 例

- `/kitchen`

#### 目的

キッチン端末で未調理・調理中・調理完了の注文を管理する。

#### 主な表示項目

- 未着手の注文商品
- 調理中の商品
- 完了済みの商品
- 席番号
- 注文時刻
- 経過時間
- 商品名
- 数量
- オプション / 備考
- アレルギー注意表示
- 優先度

#### 主な操作

- 受付にする
- 調理開始にする
- 調理完了にする
- 品切れによるキャンセル
- 備考確認
- 絞り込み（全て / 未着手 / 調理中 / 完了）

#### 状態遷移

`ordered -> accepted -> cooking -> ready`

キャンセル時のみ `cancelled` に遷移する。

### 4.3 ホール指示画面

#### URL 例

- `/hall`

#### 目的

ホール係に対して、配膳・片付け・スタッフ呼び出し・会計対応などのタスクを表示する。

#### 主な表示項目

- タスク種別
  - 配膳
  - 片付け
  - スタッフ呼び出し
  - 会計サポート
- 席番号
- 対象商品
- 発生時刻
- 経過時間
- 優先度
- 状態

#### 主な操作

- 対応開始
- 完了
- キャンセル
- 担当者メモ入力

#### 自動生成されるタスク

- キッチンで商品が `ready` になったら `serve_item` タスクを生成する。
- 顧客がスタッフ呼び出しを押したら `staff_call` タスクを生成する。
- 会計完了後、席片付け用の `clean_table` タスクを生成する。

### 4.4 レジ精算（セルフ）画面

#### URL 例

- `/checkout`

#### 目的

レジ端末で顧客が自身の席を選択し、未精算注文を確認して支払いを完了する。

#### 主な表示項目

- 席番号入力 / 選択
- 未精算注文一覧
- 小計
- 消費税
- 合計
- 支払い方法
- 支払い完了画面
- 領収書番号

#### 主な操作

- 席番号選択
- 明細確認
- 支払い方法選択
- 精算確定
- 領収書表示

#### 支払い方法

初期実装では外部決済連携は行わず、以下のダミー決済として記録する。

- cash
- card
- qr

### 4.5 分析画面

#### URL 例

- `/analytics`

#### 目的

店長等が PC で売上・注文・調理時間・席回転率を確認する。

#### 主な表示項目

- 本日売上
- 期間別売上
- 商品別売上ランキング
- カテゴリ別売上
- 時間帯別売上
- 平均客単価
- 注文件数
- 平均調理時間
- 席回転数
- 支払い方法別件数 / 金額

#### 主な操作

- 期間指定
- 日別 / 週別 / 月別切り替え
- 商品別ランキング確認
- CSV エクスポート

## 5. データモデル

### 5.1 主要エンティティ

- `cafe_tables`: 店内テーブル
- `terminals`: 店内端末
- `menu_categories`: メニューカテゴリ
- `menu_items`: メニュー商品
- `menu_item_options`: 商品オプション定義
- `menu_option_choices`: オプション選択肢
- `table_sessions`: 着席単位の利用セッション
- `orders`: 注文ヘッダ
- `order_items`: 注文商品明細
- `order_item_options`: 注文時に選択されたオプション
- `hall_tasks`: ホール向けタスク
- `payments`: 支払い記録
- `audit_logs`: 操作ログ

### 5.2 推奨 DDL

`backend/nyanql/sql/schema.sql` として作成する。

```sql
CREATE TABLE cafe_tables (
    id VARCHAR(50) PRIMARY KEY,
    table_code VARCHAR(30) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    seat_count INTEGER NOT NULL DEFAULT 2,
    status VARCHAR(30) NOT NULL DEFAULT 'available',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE terminals (
    id VARCHAR(50) PRIMARY KEY,
    terminal_code VARCHAR(50) NOT NULL UNIQUE,
    terminal_type VARCHAR(30) NOT NULL,
    table_id VARCHAR(50) REFERENCES cafe_tables(id),
    display_name VARCHAR(100) NOT NULL,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (terminal_type IN ('customer', 'kitchen', 'hall', 'checkout', 'analytics'))
);

CREATE TABLE menu_categories (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    display_order INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE menu_items (
    id VARCHAR(50) PRIMARY KEY,
    category_id VARCHAR(50) NOT NULL REFERENCES menu_categories(id),
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    price INTEGER NOT NULL,
    tax_rate INTEGER NOT NULL DEFAULT 10,
    image_url TEXT,
    kitchen_station VARCHAR(50) NOT NULL DEFAULT 'main',
    allergy_note TEXT NOT NULL DEFAULT '',
    sold_out BOOLEAN NOT NULL DEFAULT FALSE,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (price >= 0)
);

CREATE TABLE menu_item_options (
    id VARCHAR(50) PRIMARY KEY,
    item_id VARCHAR(50) NOT NULL REFERENCES menu_items(id),
    name VARCHAR(100) NOT NULL,
    required BOOLEAN NOT NULL DEFAULT FALSE,
    multi_select BOOLEAN NOT NULL DEFAULT FALSE,
    display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE menu_option_choices (
    id VARCHAR(50) PRIMARY KEY,
    option_id VARCHAR(50) NOT NULL REFERENCES menu_item_options(id),
    name VARCHAR(100) NOT NULL,
    price_delta INTEGER NOT NULL DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT TRUE,
    display_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE table_sessions (
    id VARCHAR(50) PRIMARY KEY,
    table_id VARCHAR(50) NOT NULL REFERENCES cafe_tables(id),
    status VARCHAR(30) NOT NULL DEFAULT 'seated',
    guest_count INTEGER NOT NULL DEFAULT 1,
    opened_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    payment_requested_at TIMESTAMP,
    closed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (status IN ('seated', 'ordering', 'payment_requested', 'paid', 'closed'))
);

CREATE TABLE orders (
    id VARCHAR(50) PRIMARY KEY,
    session_id VARCHAR(50) NOT NULL REFERENCES table_sessions(id),
    order_no VARCHAR(50) NOT NULL UNIQUE,
    status VARCHAR(30) NOT NULL DEFAULT 'submitted',
    subtotal INTEGER NOT NULL DEFAULT 0,
    tax_amount INTEGER NOT NULL DEFAULT 0,
    total_amount INTEGER NOT NULL DEFAULT 0,
    submitted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (status IN ('submitted', 'in_progress', 'ready', 'served', 'cancelled', 'closed'))
);

CREATE TABLE order_items (
    id VARCHAR(50) PRIMARY KEY,
    order_id VARCHAR(50) NOT NULL REFERENCES orders(id),
    menu_item_id VARCHAR(50) NOT NULL REFERENCES menu_items(id),
    item_name VARCHAR(100) NOT NULL,
    unit_price INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'ordered',
    kitchen_station VARCHAR(50) NOT NULL DEFAULT 'main',
    allergy_note TEXT NOT NULL DEFAULT '',
    customer_note TEXT NOT NULL DEFAULT '',
    accepted_at TIMESTAMP,
    cooking_started_at TIMESTAMP,
    ready_at TIMESTAMP,
    served_at TIMESTAMP,
    cancelled_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (quantity BETWEEN 1 AND 99),
    CHECK (status IN ('ordered', 'accepted', 'cooking', 'ready', 'served', 'cancelled'))
);

CREATE TABLE order_item_options (
    id VARCHAR(50) PRIMARY KEY,
    order_item_id VARCHAR(50) NOT NULL REFERENCES order_items(id),
    option_name VARCHAR(100) NOT NULL,
    choice_name VARCHAR(100) NOT NULL,
    price_delta INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE hall_tasks (
    id VARCHAR(50) PRIMARY KEY,
    task_type VARCHAR(30) NOT NULL,
    session_id VARCHAR(50) NOT NULL REFERENCES table_sessions(id),
    table_id VARCHAR(50) NOT NULL REFERENCES cafe_tables(id),
    order_item_id VARCHAR(50) REFERENCES order_items(id),
    status VARCHAR(30) NOT NULL DEFAULT 'todo',
    priority INTEGER NOT NULL DEFAULT 50,
    title VARCHAR(200) NOT NULL,
    note TEXT NOT NULL DEFAULT '',
    assigned_to VARCHAR(100),
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (task_type IN ('serve_item', 'staff_call', 'checkout_support', 'clean_table')),
    CHECK (status IN ('todo', 'doing', 'done', 'cancelled'))
);

CREATE TABLE payments (
    id VARCHAR(50) PRIMARY KEY,
    session_id VARCHAR(50) NOT NULL REFERENCES table_sessions(id),
    payment_no VARCHAR(50) NOT NULL UNIQUE,
    method VARCHAR(30) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'paid',
    subtotal INTEGER NOT NULL,
    tax_amount INTEGER NOT NULL,
    total_amount INTEGER NOT NULL,
    paid_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CHECK (method IN ('cash', 'card', 'qr')),
    CHECK (status IN ('pending', 'paid', 'failed', 'refunded'))
);

CREATE TABLE audit_logs (
    id VARCHAR(50) PRIMARY KEY,
    actor_type VARCHAR(30) NOT NULL,
    actor_id VARCHAR(50),
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_table_sessions_table_status ON table_sessions(table_id, status);
CREATE INDEX idx_orders_session_status ON orders(session_id, status);
CREATE INDEX idx_order_items_status_created ON order_items(status, created_at);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_hall_tasks_status_created ON hall_tasks(status, created_at);
CREATE INDEX idx_payments_paid_at ON payments(paid_at);
```

## 6. API 設計

### 6.1 API レイヤー方針

フロントエンドは原則 Nyan8 の API を呼ぶ。
Nyan8 は入力検証、端末種別検証、ワークフロー制御を行い、必要に応じて NyanQL の SQL API を内部呼び出しする。

NyanQL は直接外部公開しない。ローカルホストまたは内部ネットワークからのみ呼び出せる配置を前提とする。

### 6.2 Nyan8 公開 API

| API | Method | 用途 | 主な利用画面 |
|---|---:|---|---|
| `/api/bootstrap` | GET | 端末種別・基本設定取得 | 全画面 |
| `/api/customer/menu` | GET | 顧客向けメニュー取得 | 顧客注文 |
| `/api/customer/session/open` | POST | 席セッション開始 | 顧客注文 |
| `/api/customer/session/current` | GET | 現在の席セッション取得 | 顧客注文 |
| `/api/customer/order/submit` | POST | カート内容から注文確定 | 顧客注文 |
| `/api/customer/order/history` | GET | 注文履歴取得 | 顧客注文 |
| `/api/customer/payment/request` | POST | 会計依頼 | 顧客注文 |
| `/api/customer/staff-call` | POST | スタッフ呼び出し | 顧客注文 |
| `/api/kitchen/tickets` | GET | キッチン注文一覧取得 | キッチン |
| `/api/kitchen/item/status` | POST | 注文明細の調理状態更新 | キッチン |
| `/api/hall/tasks` | GET | ホールタスク一覧取得 | ホール |
| `/api/hall/task/status` | POST | ホールタスク状態更新 | ホール |
| `/api/checkout/summary` | GET | 席ごとの精算対象取得 | レジ |
| `/api/checkout/settle` | POST | 支払い確定 | レジ |
| `/api/analytics/summary` | GET | 分析サマリ取得 | 分析 |
| `/api/analytics/item-ranking` | GET | 商品別ランキング取得 | 分析 |
| `/api/analytics/export-sales-csv` | GET | 売上 CSV 出力 | 分析 |

### 6.3 WebSocket チャネル

| チャネル | 用途 | 購読画面 |
|---|---|---|
| `customer-session-{tableCode}` | 自席注文・配膳・会計状態更新 | 顧客注文 |
| `kitchen-tickets` | キッチン注文一覧更新 | キッチン |
| `hall-tasks` | ホールタスク更新 | ホール |
| `checkout-queue` | 会計依頼更新 | レジ |
| `analytics-summary` | 分析サマリ更新 | 分析 |

## 7. NyanQL 実装方針

### 7.1 ディレクトリ例

```txt
backend/nyanql/
  config.json
  api.json
  sql/
    schema.sql
    seed.sql
    list_menu.sql
    get_current_session.sql
    insert_table_session.sql
    insert_order.sql
    insert_order_item.sql
    list_kitchen_tickets.sql
    update_order_item_status.sql
    list_hall_tasks.sql
    insert_hall_task.sql
    update_hall_task_status.sql
    checkout_summary.sql
    insert_payment.sql
    close_session.sql
    analytics_summary.sql
    analytics_item_ranking.sql
```

### 7.2 `api.json` 方針

- SELECT 系は SQL 単体 API とする。
- 複数更新が必要な処理は、NyanQL の複数 SQL トランザクションまたは Nyan8 側のワークフローから呼び出す。
- 更新 API 実行後は、必要な一覧 API を push 対象にする。
- `description` は必ず日本語で書く。
- SQL ファイル名と API 名は対応が分かるようにする。

### 7.3 例: `list_kitchen_tickets.sql`

```sql
SELECT
    oi.id AS order_item_id,
    o.id AS order_id,
    o.order_no AS order_no,
    ct.table_code AS table_code,
    ct.display_name AS table_name,
    oi.item_name AS item_name,
    oi.quantity AS quantity,
    oi.status AS status,
    oi.kitchen_station AS kitchen_station,
    oi.allergy_note AS allergy_note,
    oi.customer_note AS customer_note,
    o.submitted_at AS submitted_at,
    oi.created_at AS created_at,
    EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - oi.created_at))::INTEGER AS elapsed_seconds
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
JOIN table_sessions ts ON ts.id = o.session_id
JOIN cafe_tables ct ON ct.id = ts.table_id
WHERE oi.status IN ('ordered', 'accepted', 'cooking', 'ready')
ORDER BY oi.created_at ASC;
```

## 8. Nyan8 実装方針

### 8.1 ディレクトリ例

```txt
backend/nyan8/
  config.json
  api.json
  javascript/
    apis/
      customer_submit_order.js
      kitchen_update_item_status.js
      hall_update_task_status.js
      checkout_settle.js
      analytics_export_sales_csv.js
    lib/
      ids.js
      validation.js
      nyanql_client.js
      money.js
      audit.js
```

### 8.2 共通ルール

- Nyan8 の公開 API は、端末種別を必ず検証する。
- `terminal_code` または端末トークンをリクエストに含める。
- 顧客端末は自席の `table_code` 以外を操作できない。
- キッチン端末はキッチン状態更新のみ可能。
- ホール端末はホールタスク更新のみ可能。
- レジ端末は会計処理のみ可能。
- 分析画面は manager 権限相当の端末のみアクセス可能。

### 8.3 注文確定処理

`customer_submit_order.js` で実装する。

処理手順:

1. 入力 JSON を検証する。
2. 端末が `customer` であることを確認する。
3. 席セッションが存在し、`seated` または `ordering` であることを確認する。
4. 商品 ID、数量、オプションを検証する。
5. メニュー価格を DB から再取得し、フロントエンドから送られた金額を信用しない。
6. 小計、税額、合計を計算する。
7. `orders` と `order_items` と `order_item_options` を登録する。
8. キッチン画面向けに Push する。
9. 監査ログを登録する。
10. 注文番号と合計金額を返す。

### 8.4 調理状態更新処理

`kitchen_update_item_status.js` で実装する。

許可する状態遷移:

- `ordered -> accepted`
- `accepted -> cooking`
- `cooking -> ready`
- `ordered|accepted|cooking -> cancelled`

`ready` に変更された場合は、`hall_tasks` に `serve_item` を自動作成する。

### 8.5 会計確定処理

`checkout_settle.js` で実装する。

処理手順:

1. 端末が `checkout` であることを確認する。
2. 対象席の未精算セッションを取得する。
3. 未キャンセル注文の合計を DB から再計算する。
4. `payments` に支払い記録を作成する。
5. `table_sessions.status` を `paid` にする。
6. `orders.status` を `closed` にする。
7. `hall_tasks` に `clean_table` を作成する。
8. レシート番号を返す。

## 9. フロントエンド設計

### 9.1 推奨ディレクトリ

```txt
frontend/
  package.json
  index.html
  src/
    main.tsx
    App.tsx
    routes.tsx
    api/
      client.ts
      customerApi.ts
      kitchenApi.ts
      hallApi.ts
      checkoutApi.ts
      analyticsApi.ts
      websocket.ts
    domain/
      types.ts
      money.ts
      orderStatus.ts
      terminal.ts
    components/
      layout/
      customer/
      kitchen/
      hall/
      checkout/
      analytics/
    pages/
      CustomerOrderPage.tsx
      KitchenPage.tsx
      HallPage.tsx
      CheckoutPage.tsx
      AnalyticsPage.tsx
    styles/
      global.css
```

### 9.2 TypeScript 型定義例

```ts
export type TerminalType = 'customer' | 'kitchen' | 'hall' | 'checkout' | 'analytics';

export type OrderItemStatus =
  | 'ordered'
  | 'accepted'
  | 'cooking'
  | 'ready'
  | 'served'
  | 'cancelled';

export type HallTaskStatus = 'todo' | 'doing' | 'done' | 'cancelled';

export type PaymentMethod = 'cash' | 'card' | 'qr';

export interface MenuItem {
  id: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  taxRate: number;
  imageUrl?: string;
  soldOut: boolean;
  allergyNote: string;
  options: MenuItemOption[];
}

export interface MenuItemOption {
  id: string;
  name: string;
  required: boolean;
  multiSelect: boolean;
  choices: MenuOptionChoice[];
}

export interface MenuOptionChoice {
  id: string;
  name: string;
  priceDelta: number;
}

export interface CartItem {
  localId: string;
  menuItemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
  selectedChoices: Array<{
    optionId: string;
    optionName: string;
    choiceId: string;
    choiceName: string;
    priceDelta: number;
  }>;
  customerNote: string;
}
```

### 9.3 UI 方針

- 店舗端末向けに、タッチ操作しやすい大きなボタンを使う。
- 顧客注文画面とレジ画面は、IT に不慣れな利用者でも操作できるようにする。
- キッチン画面は視認性を優先し、注文カードを大きく表示する。
- ホール画面は優先度と経過時間が一目で分かるようにする。
- 分析画面は PC 利用前提で、表とグラフを中心にする。

## 10. 初期データ

`backend/nyanql/sql/seed.sql` に次の初期データを用意する。

### 10.1 席

- T01: 1番テーブル
- T02: 2番テーブル
- T03: 3番テーブル
- T04: 4番テーブル

### 10.2 端末

- customer-T01: 顧客端末 1番テーブル
- customer-T02: 顧客端末 2番テーブル
- kitchen-main: キッチン端末
- hall-main: ホール端末
- checkout-main: レジ端末
- analytics-manager: 店長 PC

### 10.3 メニューカテゴリ

- Coffee
- Tea
- Food
- Dessert

### 10.4 メニュー商品例

- ブレンドコーヒー: 450 円
- カフェラテ: 550 円
- アイスティー: 500 円
- クロックムッシュ: 900 円
- チーズケーキ: 650 円
- プリン: 500 円

## 11. 実装タスク

### Phase 1: プロジェクト骨格

- フロントエンドプロジェクトを作成する。
- NyanQL 設定ディレクトリを作成する。
- Nyan8 設定ディレクトリを作成する。
- PostgreSQL 接続設定のサンプルを作成する。
- `.env.example` を作成する。

### Phase 2: DB

- `schema.sql` を作成する。
- `seed.sql` を作成する。
- DB 初期化手順を README に書く。
- サンプルデータで全画面が動作する状態にする。

### Phase 3: NyanQL API

- メニュー取得 API
- セッション取得 / 作成 API
- 注文登録 API 補助 SQL
- キッチン一覧 API
- 注文明細状態更新 API
- ホールタスク API
- 精算サマリ API
- 支払い登録 API
- 分析 API

### Phase 4: Nyan8 コントローラー

- 注文確定 API
- 調理状態変更 API
- ホールタスク状態変更 API
- 会計確定 API
- CSV エクスポート API
- 端末種別検証
- 入力バリデーション
- 監査ログ登録

### Phase 5: フロントエンド

- ルーティング
- API クライアント
- WebSocket クライアント
- 顧客注文画面
- キッチン画面
- ホール画面
- レジ精算画面
- 分析画面
- 共通エラー表示
- ローディング表示

### Phase 6: 動作確認

- 注文から調理完了までの流れ
- 調理完了から配膳完了までの流れ
- 会計依頼から支払い完了までの流れ
- 分析画面への反映
- ブラウザ更新後の状態復元
- 複数端末での同時操作

## 12. 受け入れ条件

### 12.1 顧客注文

- 席端末からメニューを表示できる。
- 商品をカートに追加できる。
- 数量変更と削除ができる。
- 注文を確定できる。
- 確定した注文がキッチン画面に表示される。
- 会計依頼後は注文操作ができない。

### 12.2 キッチン

- 注文商品が時系列で表示される。
- `ordered -> accepted -> cooking -> ready` の状態変更ができる。
- `ready` になった商品がホール指示画面に表示される。
- 経過時間が表示される。

### 12.3 ホール

- 配膳タスクが表示される。
- スタッフ呼び出しタスクが表示される。
- タスクを対応開始 / 完了に変更できる。
- 配膳完了した商品は `served` として記録される。

### 12.4 レジ精算

- 席を選択して未精算明細を表示できる。
- 合計金額が DB 側計算と一致する。
- 支払い方法を選択して精算完了できる。
- 精算完了後、席セッションが `paid` になる。
- 片付けタスクが作成される。

### 12.5 分析

- 本日売上が表示される。
- 期間指定で売上を確認できる。
- 商品別ランキングが表示される。
- 支払い方法別の集計が表示される。
- CSV エクスポートができる。

## 13. セキュリティ・運用上の注意

- NyanQL の Basic 認証は公開環境では必ず変更する。
- NyanQL を顧客端末から直接呼ばせない。
- Nyan8 を公開 API 層とし、端末種別と操作対象を検証する。
- 顧客端末から送られた金額を信用しない。
- 注文、状態変更、会計確定はすべて `audit_logs` に記録する。
- `nyanHostExec` 相当の OS コマンド実行機能はこのシステムでは使用しない。
- 店舗内 LAN での利用を前提にするが、将来的な公開配置を見据えて CORS・認証・TLS の扱いを分離する。

## 14. README に必ず書くこと

- システム概要
- 技術構成
- ディレクトリ構成
- PostgreSQL の作成手順
- `schema.sql` / `seed.sql` の実行手順
- NyanQL の起動手順
- Nyan8 の起動手順
- フロントエンドの起動手順
- 主要 URL
- サンプル端末コード
- 動作確認シナリオ
- 既知の制約

## 15. 最終報告で出力すること

実装完了時に、次を報告してください。

1. 作成・更新したファイル一覧
2. 実装した機能一覧
3. 未実装・暫定対応の内容
4. 起動手順
5. 動作確認手順
6. 仕様上の仮定
7. 今後の改善候補
