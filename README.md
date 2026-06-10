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

開発用の `schema.sql` は先頭で既存テーブルを `DROP TABLE IF EXISTS ... CASCADE` するため、同じ DB に対して再実行できます。

```bash
createdb cafe_order_system
psql cafe_order_system -f backend/nyanql/sql/schema.sql
psql cafe_order_system -f backend/nyanql/sql/seed.sql
```

既に DB がある場合は `createdb` を省略して、`schema.sql` から再投入します。接続情報はローカル PostgreSQL の設定に合わせて `DATABASE_URL` に指定します。

スクリプトでも初期化できます。

```bash
export DATABASE_URL=postgres://codex:codex@localhost:5432/cafe_order_system
./scripts/dev-reset-db.sh
```

## NyanQL / Nyan8 導入

本プロジェクトでは NyanQL / Nyan8 を正式な実行環境として使用します。代替の Node.js API サーバーや fallback server は使用しません。

### 方法 A: スターターキットを使う

1. [NyanQL 公式サイト](https://nyanql.org/) のダウンロードページから OS に合うスターターキット zip を取得する。
2. zip を展開し、NyanQL / Nyan8 の実行ファイルを取り出す。
3. macOS / Linux では次の場所へ配置する。

```txt
.local/bin/nyanql
.local/bin/nyan8
```

4. Windows では次の場所へ配置する。

```txt
.local/bin/nyanql.exe
.local/bin/nyan8.exe
```

5. macOS / Linux で実行権限がない場合は付与する。

```bash
chmod +x .local/bin/nyanql .local/bin/nyan8
```

`.local/` は Git 管理対象外です。

### 方法 B: GitHub Releases から取得する

NyanQL と Nyan8 それぞれの GitHub Releases から OS 向け zip を取得し、展開した実行ファイルを `.local/bin/` に配置します。PATH 上に置く場合も `scripts/check-runtime.sh` が検出できます。

### 方法 C: Go でビルドする

ソースからビルドする場合は、各リポジトリを clone して Go でビルドします。

```bash
git clone <NyanQL repository>
cd NyanQL
go build -o nyanql
```

Nyan8 も同様にソースが公開されている場合は、リポジトリで次を実行します。

```bash
git clone <Nyan8 repository>
cd Nyan8
go build -o nyan8
```

生成したバイナリはこのリポジトリの `.local/bin/` に配置してください。

### バイナリ確認

```bash
./scripts/check-runtime.sh
```

このスクリプトは `.local/bin` を優先し、見つからない場合は PATH 上の `nyanql` / `nyan8` を探します。

## NyanQL 起動

NyanQL ランタイムに `backend/nyanql/config.json` と `backend/nyanql/api.json` を指定して起動します。ポート例は `8890` です。

```bash
./scripts/start-nyanql.sh
```

`backend/nyanql/config.json` は NyanQL 公式 README の形式に合わせて `Port`, `DBType`, `DBHost`, `DBPort`, `DBUser`, `DBPassword`, `DBName`, `BasicAuth` を使用します。開発環境の接続情報を変える場合は `backend/nyanql/config.local.example.json` をコピーして調整してください。本物のパスワードはコミットしないでください。

## Nyan8 起動

Nyan8 ランタイムに `backend/nyan8/config.json` と `backend/nyan8/api.json` を指定して起動します。ポート例は `8889` です。

```bash
./scripts/start-nyan8.sh
```

Nyan8 は公開 API として `/api/*` を提供します。フロントエンドから NyanQL を直接呼び出さないでください。

Nyan8 JavaScript は Node.js の `require`, `module.exports`, `process.env`, `Buffer` に依存せず、`nyanAllParams`, `nyanGetAPI`, `nyanJsonAPI`, `javascript_include` を使う方針です。

## フロントエンド起動

```bash
cd frontend
npm install
npm run build
npm run dev
```

Vite dev server は通常 `http://localhost:5173` で起動します。5173 が使用中の場合は Vite が 5174 などに切り替えます。`/api` は `http://localhost:8889` に proxy します。

## 開発起動順

複数ターミナルで次の順に起動します。

```bash
# 事前確認
./scripts/check-runtime.sh
./scripts/dev-reset-db.sh
```

```bash
# Terminal 1
./scripts/start-nyanql.sh
```

```bash
# Terminal 2
./scripts/smoke-nyanql.sh
./scripts/start-nyan8.sh
```

```bash
# Terminal 3
./scripts/smoke-menu.sh
./scripts/smoke-e2e.sh
cd frontend
npm install
npm run build
npm run dev
```

`scripts/smoke-e2e.sh` は Node.js と `psql` / `curl` を使用します。`jq` は不要です。各 API の HTTP ステータス、JSON の `success`、主要 ID、状態遷移、不正操作拒否、分析反映を検証します。

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

1. PostgreSQL、NyanQL、Nyan8、フロントエンドを順に起動する。
2. `/customer/T01` を開き、商品をカートに追加して注文確定する。
3. `/kitchen` を開き、該当明細を `ordered -> accepted -> cooking -> ready` に進める。
4. `/hall` を開き、自動生成された配膳タスクを開始、完了する。
5. `/customer/T01` に戻り、会計依頼する。会計依頼後は追加注文できないことを確認する。
6. `/checkout` を開き、`T01` を選び、支払い方法 `cash` / `card` / `qr` のいずれかを選択して精算完了する。
7. `/hall` に片付けタスクが表示されることを確認し、開始、完了する。
8. `/analytics` で売上、会計件数、商品ランキング、支払い方法別集計を確認する。

## 主要 API 確認

フロントエンドはすべて Nyan8 の API を呼び出します。代表的な確認対象は次の通りです。

- 顧客: `GET /api/customer/menu`, `POST /api/customer/session/open`, `GET /api/customer/session/current`, `POST /api/customer/order/submit`, `GET /api/customer/order/history`, `POST /api/customer/payment/request`, `POST /api/customer/staff-call`
- キッチン: `GET /api/kitchen/tickets`, `POST /api/kitchen/item/status`
- ホール: `GET /api/hall/tasks`, `POST /api/hall/task/status`
- レジ: `GET /api/checkout/summary`, `POST /api/checkout/settle`
- 分析: `GET /api/analytics/summary`, `GET /api/analytics/item-ranking`, `GET /api/analytics/export-sales-csv`

NyanQL 単体の疎通は次で確認します。

```bash
./scripts/smoke-nyanql.sh
```

Nyan8 経由の業務フローは次で確認します。

```bash
./scripts/smoke-e2e.sh
```

`smoke-e2e.sh` は次の流れを実行します。

1. 顧客端末 `customer-T01` でセッション開始
2. メニュー取得、注文確定
3. キッチンで `ordered -> accepted -> cooking -> ready`
4. ホールで配膳タスク `todo -> doing -> done`
5. 会計依頼、会計依頼後の追加注文拒否
6. レジ精算、再精算拒否
7. ホールで片付けタスク `todo -> doing -> done`
8. 席を空席へ戻せることの確認
9. 端末種別違い、存在しない ID、不正遷移、売切商品の拒否確認
10. 分析サマリと商品ランキングへの反映確認

## 既知の制約

- WebSocket Push は未実装で、MVP では 5 秒ポーリングで代替しています。
- NyanQL / Nyan8 の具体的な CLI オプションは同梱ランタイムに合わせて調整してください。
- 実決済、在庫管理、会員、予約、複数店舗は対象外です。
- 顧客注文画面のオプション選択 UI は最小実装で、必須オプションは先頭候補を自動選択します。
- 精算はダミー決済です。金額はフロントエンド送信値ではなく、DB の注文明細から Nyan8 側で再計算します。
- API ランタイムが起動していない場合、フロントエンドには API エラーメッセージが表示されます。
- Nyan8 から NyanQL への呼び出し先は `backend/nyan8/javascript/lib/runtime.js` の `NYANQL_BASE_URL` で定義しています。開発既定値は `http://nyanql:change-me@localhost:8890` です。

## トラブルシューティング

- `createdb` / `psql` がパスワードを要求する場合: ローカル PostgreSQL のユーザー、パスワード、権限を確認し、必要に応じて `DATABASE_URL` または `PGUSER` / `PGPASSWORD` を設定してください。
- `npm run dev` で 5173 が使用中の場合: Vite が表示する代替ポートを使用してください。Nyan8 の CORS は `localhost:5173` と `localhost:5174` を許可しています。
- フロントエンドで API エラーが出る場合: Nyan8 が `8889`、NyanQL が `8890` で起動しているか、`NYANQL_BASE_URL` と Basic 認証情報が一致しているか確認してください。
- 精算ボタンが押せない場合: 顧客画面で会計依頼済みか確認してください。会計依頼前または精算済みのセッションは再精算できません。
- `./scripts/check-runtime.sh` で NG になる場合: `.local/bin` への配置、PATH、実行権限を確認してください。
