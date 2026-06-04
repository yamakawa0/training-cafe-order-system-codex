# Cafe Order System

架空のカフェ店舗向けに、席端末でのセルフ注文、キッチンの調理状態管理、ホール指示、セルフ精算、売上分析を扱う MVP 実装です。

## 技術構成

- Frontend: TypeScript / React / Vite
- Controller API: Nyan8
- SQL API: NyanQL
- Database: PostgreSQL

フロントエンドは Nyan8 の `/api/*` のみを呼び出します。NyanQL は Nyan8 から内部 API として呼び出す想定です。

## ディレクトリ構成

```txt
frontend/                 TypeScript SPA
backend/nyan8/            Nyan8 controller API 設定と JavaScript
backend/nyanql/           NyanQL API 設定と SQL
docs/                     仕様、仮定、開発メモ
```

## PostgreSQL 初期化

```bash
createdb cafe_order_system
psql cafe_order_system -f backend/nyanql/sql/schema.sql
psql cafe_order_system -f backend/nyanql/sql/seed.sql
```

接続情報は `.env.example` を参考に設定します。

## NyanQL 起動

NyanQL ランタイムに `backend/nyanql/config.json` と `backend/nyanql/api.json` を指定して起動します。ポート例は `8890` です。

```bash
export DATABASE_URL=postgres://cafe:cafe@localhost:5432/cafe_order_system
export NYANQL_USER=nyanql
export NYANQL_PASSWORD=change-me
nyanql --config backend/nyanql/config.json
```

## Nyan8 起動

Nyan8 ランタイムに `backend/nyan8/config.json` と `backend/nyan8/api.json` を指定して起動します。ポート例は `8889` です。

```bash
export NYANQL_BASE_URL=http://localhost:8890
export NYANQL_USER=nyanql
export NYANQL_PASSWORD=change-me
nyan8 --config backend/nyan8/config.json
```

## フロントエンド起動

```bash
cd frontend
npm install
npm run dev
```

Vite dev server は `http://localhost:5173` で起動します。`/api` は `http://localhost:8889` に proxy します。

## 主要 URL

- 顧客注文: `http://localhost:5173/customer/T01`
- キッチン: `http://localhost:5173/kitchen`
- ホール: `http://localhost:5173/hall`
- レジ精算: `http://localhost:5173/checkout`
- 分析: `http://localhost:5173/analytics`

## サンプル端末コード

- `customer-T01`
- `customer-T02`
- `kitchen-main`
- `hall-main`
- `checkout-main`
- `analytics-manager`

## 動作確認シナリオ

1. `/customer/T01` で商品をカートに追加して注文確定する。
2. `/kitchen` で該当明細を `ordered -> accepted -> cooking -> ready` に進める。
3. `/hall` で自動生成された配膳タスクを開始、完了する。
4. `/customer/T01` で会計依頼する。
5. `/checkout` で `T01` を選び、支払い方法を選択して精算完了する。
6. `/hall` に片付けタスクが表示されることを確認する。
7. `/analytics` で売上、会計件数、商品ランキング、支払い方法別集計を確認する。

## 既知の制約

- WebSocket Push は未実装で、MVP では 5 秒ポーリングで代替しています。
- NyanQL / Nyan8 の具体的な CLI オプションは同梱ランタイムに合わせて調整してください。
- 実決済、在庫管理、会員、予約、複数店舗は対象外です。
- 顧客注文画面のオプション選択 UI は最小実装で、必須オプションは先頭候補を自動選択します。
