# Cafe Order System

架空のカフェ店舗向けに、席端末でのセルフ注文、キッチンの調理状態管理、ホール指示、セルフ精算、売上分析を扱う MVP 実装です。

## Phase 12: 決済・返金・レシート

- Phase 12 第1〜第5段階は完了済みです。返金、レシート再発行、支払い失敗、決済取消、部分返金、mock provider 連携、webhook event 履歴、日次締め / 会計締めを扱います。
- `/checkout` で精算済み payment を検索し、レシート表示・再発行・部分返金・残額全額返金ができます。
- `amount` 指定ありは部分返金、`amount` 未指定または `refund_type='full'` は返金可能残額の全額返金として扱います。返金可能残額を超える返金は拒否します。
- 返金累計が支払額未満なら `payments.status='partial_refunded'`、支払額と等しければ `refunded` に更新し、`payment_refunds` に複数返金履歴を保存します。返金しても注文・明細は削除しません。
- 分析と CSV は `net_sales = total_amount - refund_total` を使います。売上 CSV には `payment_status`, `refund_amount`, `refunded_at`, `refund_reason`, `gross_amount`, `refund_total`, `refund_remaining`, `net_amount`, `refund_count`, `last_refunded_at` が出力されます。
- MVP では payment 単位の返金のみ対応します。明細別返金、部分返金の原価按分、実決済サービスへの実返金、クレジットカード実返金、外部レシートプリンタ連携は未対応です。
- `scripts/smoke-refund-receipt.sh` は receipt 取得・再発行、部分返金、返金可能残額、残額全額返金、複数返金履歴、分析 net sales、CSV 返金列、返金 audit、権限拒否を確認します。

Phase 12.6 では、Phase 12 の実装 / docs / smoke / CI の整合確認と本番 readiness 再確認を実施しました。Phase 13 の第1段階候補は、予約や複数店舗の前提になる顧客会員の土台です。

## Phase 12 第4段階: 実決済連携の土台

- `provider='internal'` は既存の内部ダミー決済、`provider='mock'` は外部決済サービスを模した開発用 provider です。
- `/api/checkout/settle` と `/api/checkout/refund` は `external_payment_id`, `external_refund_id`, `idempotency_key`, `provider_status` を保存できます。
- 同じ `idempotency_key` の settle / refund 再送は既存結果を返し、二重決済・二重返金を防ぎます。内容不一致は 409 で拒否します。
- `payment_webhook_events` に mock webhook event を保存し、`provider + external_event_id` で重複受信を冪等処理します。
- `/checkout` には開発用の外部決済連携テストセクションがあり、mock webhook 送信と webhook event 履歴確認ができます。
- 実 Stripe / Square / PayPay 連携、外部決済 API key の本番運用、本番 webhook endpoint 公開、webhook 署名検証、実カード / QR 決済、実返金は未対応です。
- `scripts/smoke-payment-provider.sh` は mock provider 決済、external id 保存、settle / refund idempotency、mock webhook processed / duplicate / ignored、receipt provider 情報、webhook event 一覧権限、audit を確認します。

## Phase 12 第5段階: 日次締め / 会計締め

- `/analytics` で営業日ごとの日次締め preview、close、reopen、日次締め CSV 出力ができます。
- `gross_sales_total` は `paid` / `partial_refunded` / `refunded` の元支払額合計、`refund_total` は返金履歴合計、`net_sales_total` は差引純売上です。
- 決済手段別 `cash` / `card` / `qr` と provider 別 `internal` / `mock` を net sales ベースで集計します。
- `failed` / `cancelled` attempt は売上対象外です。`partial_refunded` は `total_amount - refund_total`、`refunded` は net sales 0 として扱います。
- manager は close / reopen できます。viewer は preview / detail / list / CSV の閲覧のみ可能です。cashier / kitchen / hall は日次締め API を使えません。
- reopen 後の再 close は同じ `daily_cash_closures` row を上書き更新します。MVP では締め後の差分調整履歴、月次締め、外部 provider との実残高照合は未対応です。
- `scripts/smoke-daily-close.sh` は paid / partial_refunded / failed / cancelled を含む日次集計、二重 close 拒否、viewer 権限、reopen / 再 close、CSV、audit を確認します。

## Phase 12 第2段階: 支払い失敗 flow / 決済取消

- `/checkout` で MVP 用の支払い失敗を扱えます。`simulate_result='failed'` の内部 flow により `payment_attempts` に failed attempt を記録し、`payments` は作成しません。
- 支払い失敗後も席セッションは `payment_requested` のまま維持され、同じ席で再試行できます。再試行成功時は `payments.status='paid'` と paid attempt を記録します。
- pending / failed attempt は取消できます。取消後も再試行可能です。
- paid 後の取消は不可です。精算成立後は `/api/checkout/refund` による返金を使います。
- failed / cancelled attempt は分析売上対象外です。売上 CSV には `attempt_status`, `failure_reason`, `cancelled_reason` が出力されます。
- 実 Stripe / Square / PayPay 連携、実オーソリ、外部 webhook 署名検証、QR 決済実連携、分割決済、返金取消、外部レシートプリンタ、電子レシート送信は未対応です。
- `scripts/smoke-payment-failure-cancel.sh` は支払い失敗、再試行成功、attempt 取消、failed / cancelled 売上除外、CSV attempt 列、receipt 拒否、audit、権限拒否を確認します。

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

推奨実行環境は Node.js 20 LTS 以上、npm 10 以上です。`.nvmrc` に `20` を置いているため、nvm を使う場合はリポジトリ直下で `nvm use` を実行してください。Node 16 / npm 8 では Vite 8 系や周辺 package の `engines` と合わず、`npm install` 時に engine warning が出ます。

```bash
cd frontend
npm install
npm run build
npm run dev
```

Vite dev server は通常 `http://localhost:5173` で起動します。5173 が使用中の場合は Vite が 5174 などに切り替えます。`/api` は `http://localhost:8889` に proxy します。

通常開発では `npm run dev` を使います。LAN 内の端末やタブレットから検証する場合だけ `npm run dev:host` を使って `0.0.0.0` で待ち受けます。`dev:host` は信頼できるローカルネットワーク内に限定し、本番公開には Vite dev server を使わず、`npm run build` の静的成果物を配信してください。

依存関係の脆弱性確認は次で行います。

```bash
cd frontend
npm audit
```

通常は `npm audit fix` までを許可し、`npm audit fix --force` は major upgrade や破壊的変更を含む可能性があるため、更新対象と影響を確認してから判断してください。

ローカル開発では依存更新を伴うため `npm install` を使います。CI では lockfile 再現性を優先して `npm ci` を使います。`package-lock.json` を更新した場合は必ず commit してください。

## GitHub Actions CI

`.github/workflows/ci.yml` で pull request、`master` push、手動実行に対する lightweight CI を実行します。実行結果は GitHub repository の Actions tab で確認します。CI が失敗した場合は、失敗 job と step を確認し、修正して CI が成功してから `master` へ反映してください。

GitHub Actions では Node 20.19 以上を使い、frontend job で次を確認します。

```bash
cd frontend
npm ci
npm audit --audit-level=high
npm run build
cd ..
./scripts/ci-prod-readiness-static.sh
```

static-checks job では次を確認します。

```bash
./scripts/ci-shellcheck.sh
./scripts/ci-repo-consistency.sh
```

CI では実 DB、NyanQL runtime、Nyan8 runtime を起動しません。`dev-reset-db.sh` も実行しません。CI lightweight checks は構文、build、audit、設定ファイルと実ファイルの整合性を確認し、local full smoke は開発者環境で PostgreSQL / NyanQL / Nyan8 を起動して業務フローを確認する位置づけです。

PR 作成前、または Phase 11 以降の大きな機能追加前後の推奨ローカル確認:

```bash
cd frontend
npm ci
npm audit --audit-level=high
npm run build
cd ..
./scripts/ci-shellcheck.sh
./scripts/ci-repo-consistency.sh
./scripts/ci-prod-readiness-static.sh
./scripts/smoke-prod-readiness.sh
git diff --check
```

実ランタイム込みの full smoke は、開発用 DB 初期化と NyanQL / Nyan8 起動後に順番に実行します。各 script は DB を初期化するものがあるため並列実行しないでください。

```bash
./scripts/dev-reset-db.sh
./scripts/smoke-auth.sh
./scripts/smoke-audit-logs.sh
./scripts/smoke-admin-orders.sh
./scripts/smoke-admin-menu.sh
./scripts/smoke-inventory.sh
./scripts/smoke-admin-tables.sh
./scripts/smoke-menu.sh
./scripts/smoke-e2e.sh
./scripts/smoke-order-multiple-items.sh
./scripts/smoke-multiple-tables.sh
./scripts/smoke-cancel-flow.sh
./scripts/smoke-staff-call.sh
./scripts/smoke-refund-receipt.sh
./scripts/smoke-payment-failure-cancel.sh
./scripts/smoke-payment-provider.sh
./scripts/smoke-daily-close.sh
./scripts/smoke-checkout-csv.sh
./scripts/smoke-invalid-operations.sh
```

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

境界条件の確認には、次の追加 smoke script を使用します。いずれも `jq` には依存せず、Node.js で JSON を検証します。

```bash
./scripts/smoke-order-multiple-items.sh
./scripts/smoke-multiple-tables.sh
./scripts/smoke-cancel-flow.sh
./scripts/smoke-staff-call.sh
./scripts/smoke-checkout-csv.sh
./scripts/smoke-invalid-operations.sh
./scripts/smoke-admin-orders.sh
```

- `smoke-order-multiple-items.sh`: 同一注文の複数明細、注文集約、全明細会計、商品ランキング反映を確認する。
- `smoke-multiple-tables.sh`: T01 / T02 の同時進行、タスク・精算・席状態の取り違えがないことを確認する。
- `smoke-cancel-flow.sh`: キャンセル可能状態、ready 以降のキャンセル拒否、キャンセル明細の会計・分析除外を確認する。
- `smoke-staff-call.sh`: 注文なしセッションでの staff_call 作成、ホール対応、完了済み再完了拒否を確認する。
- `smoke-checkout-csv.sh`: 精算後の売上 CSV データ、フロントエンドの CSV ダウンロード処理を確認する。
- `smoke-invalid-operations.sh`: 端末種別違反、状態遷移違反、存在しない ID / table_code / terminal_code の拒否を確認する。
- `smoke-admin-orders.sh`: 注文管理 API、明細取消、注文全体取消、取消明細の会計・分析除外、ready / 精算済み注文の取消拒否を確認する。

推奨実行順は、まず既存 happy path を確認し、その後に境界条件 smoke を順番に実行します。各 script は DB 初期化を含むため並列実行しないでください。

## 主要 URL

- 顧客注文: `http://localhost:5173/customer/T01`
- ログイン: `http://localhost:5173/login`
- キッチン: `http://localhost:5173/kitchen`
- ホール: `http://localhost:5173/hall`
- レジ精算: `http://localhost:5173/checkout`
- 分析: `http://localhost:5173/analytics`
- メニュー管理: `http://localhost:5173/admin/menu`
- 席・端末管理: `http://localhost:5173/admin/tables`
- 注文管理: `http://localhost:5173/admin/orders`
- 操作ログ: `http://localhost:5173/admin/audit-logs`
- ユーザー管理: `http://localhost:5173/admin/users`

## 本番相当デプロイ準備

詳細手順は `docs/08_operations.md` を参照してください。実サーバーへのデプロイ、Docker 化、systemd 化、自動デプロイは現時点の対象外です。

推奨配置例:

```txt
/opt/cafe-order-system/
  frontend/dist/
  backend/nyan8/
  backend/nyanql/
  scripts/
  deploy/nginx/
  logs/
  .env.production
```

本番では Vite dev server を公開せず、`frontend/dist` を Nginx などで静的配信します。`/api/*` は HTTPS reverse proxy から Nyan8 へ転送し、Nyan8 が NyanQL を内部 API として呼びます。

`.env.production.example` を `.env.production` にコピーし、`DATABASE_URL`, NyanQL BasicAuth, log path, URL を本番値に変更してください。`.env.production` と実 secret は commit しません。本番 DB に `backend/nyanql/sql/schema.sql` を安易に実行しないでください。このファイルは開発 reset 用で `DROP TABLE IF EXISTS ... CASCADE` を含みます。

```bash
cp .env.production.example .env.production
./scripts/prod-build.sh
./scripts/prod-start-nyanql.sh
./scripts/prod-start-nyan8.sh
./scripts/prod-status.sh
```

停止:

```bash
./scripts/prod-stop.sh
```

Nginx 設定例は `deploy/nginx/cafe-order-system.conf.example` にあります。HTTPS 前提、HTTP から HTTPS への redirect、`frontend/dist` の静的配信、SPA fallback、`/api/` の Nyan8 proxy、`X-Forwarded-*` header を含みます。

認証は `cafe_session` cookie 主方式を維持します。開発環境では Nyan8 制約により Bearer / `token` 互換も使います。本番では Secure, HttpOnly, SameSite=Lax の cookie を HTTPS reverse proxy 前提で扱い、実 `Set-Cookie` / `Cookie` header の挙動を検証します。必要な場合だけ、検証済みの cookie-to-Authorization 変換を導入します。

DB backup / restore:

```bash
pg_dump "$DATABASE_URL" > "backup_$(date +%Y%m%d_%H%M%S).sql"
psql "$DATABASE_URL" < backup.sql
```

ログは `${LOG_DIR}` と runtime 配下の `logs/`、Nginx access / error log、DB の `audit_logs` を確認します。stdout / stderr と Nginx log は OS の logrotate 等でローテーションしてください。

本番相当環境へ進む前に readiness smoke を実行します。この script は本番 DB を初期化せず、`dev-reset-db.sh` も呼びません。

```bash
./scripts/smoke-prod-readiness.sh
```

`smoke-prod-readiness.sh` は Node.js `>=20.19` と npm `>=10` を前提にします。Node.js は `PATH` 上の `node`、npm は通常 `npm` を使い、npm を明示する場合は `NPM_BIN=/path/to/npm` を指定します。DNS や sandbox 制限で npm registry に到達できない環境では `npm audit --audit-level=high` が失敗するため、ネットワーク到達可能な CI または承認済み検証環境で audit を実行してください。

## 画面概要

- 顧客注文画面: カテゴリ別メニュー、商品カード、オプション選択モーダル、カート、注文履歴、スタッフ呼び出し、会計依頼を表示します。会計依頼後または精算済みの席では注文操作がロックされます。
- キッチン画面: `ordered`, `accepted`, `cooking`, `ready` を列に分けたカンバンで注文明細を表示します。経過時間、オプション、メモ、アレルギー、状態更新ボタンをカード単位で確認できます。
- ホール画面: 配膳、片付け、スタッフ呼び出し、会計サポートをタスク種別ごとに表示します。簡易フロアマップで席ごとの状態を確認できます。
- レジ精算画面: T01 から T04 の席カード、レシート風明細、小計、税、合計、支払い方法、支払い失敗、決済試行履歴、レシート再発行、返金額入力、返金可能残額、部分返金、残額全額返金、mock provider 決済テスト、webhook event 履歴を表示します。会計依頼済みの席だけ精算できます。
- 分析画面: 総支払額、返金額、純売上、原価、粗利、粗利率、商品ランキング、支払い方法別集計、日次締め preview / close / reopen、決済手段別・provider 別日次集計、最終更新時刻を表示します。`CSV ダウンロード` で売上 CSV、`日次締め CSV` で締め CSV を保存できます。
- メニュー管理画面: 店長 PC からカテゴリ一覧、商品一覧、商品追加、商品編集、標準原価、粗利 / 粗利率、商品画像、在庫設定、在庫差分調整、在庫履歴、表示 / 非表示、売切 / 売切解除、商品並び順変更、カテゴリ絞り込み、商品名検索を行えます。`/analytics` から遷移できます。
- 席・端末管理画面: 店長 PC から席一覧、席状態、顧客端末紐付け、現在セッション、注文・会計状態、端末一覧を確認できます。注文なしまたは精算済みセッションの強制クローズ、席の `available` / `disabled` 変更、端末の有効 / 無効切り替えを行えます。
- 注文管理画面: 店長 PC から注文一覧、日付・席・注文番号・注文状態・精算状態フィルタ、注文詳細、注文明細の売上 / 原価 / 粗利、支払い情報、provider / external id / provider status、関連ホールタスクを確認できます。`ordered`, `accepted`, `cooking` の明細取消と、ready / served を含まない未精算注文の全体取消を行えます。CSV 出力は `/analytics` の売上 CSV へ誘導します。

## サンプル端末コード

- `customer-T01`
- `customer-T02`
- `kitchen-main`
- `hall-main`
- `checkout-main`
- `analytics-manager`

`terminal_code` は端末種別と有効 / 無効の判定に使います。管理者判定の主条件はログイン済みユーザーの `manager` ロールです。`analytics-manager` は管理・分析向け端末コードとして引き続き使用しますが、`/api/admin/*` の利用には session 認証と manager ロールが必要です。

## 動作確認シナリオ

1. PostgreSQL、NyanQL、Nyan8、フロントエンドを順に起動する。
2. `/customer/T01` を開き、商品をカートに追加して注文確定する。
3. `/kitchen` を開き、該当明細を `ordered -> accepted -> cooking -> ready` に進める。
4. `/hall` を開き、自動生成された配膳タスクを開始、完了する。
5. `/customer/T01` に戻り、会計依頼する。会計依頼後は追加注文できないことを確認する。
6. `/checkout` を開き、`T01` を選び、支払い方法 `cash` / `card` / `qr` のいずれかを選択して精算完了する。
7. `/hall` に片付けタスクが表示されることを確認し、開始、完了する。
8. `/analytics` で売上、原価、粗利、会計件数、商品ランキング、支払い方法別集計を確認する。

## 主要 API 確認

フロントエンドはすべて Nyan8 の API を呼び出します。代表的な確認対象は次の通りです。

- 顧客: `GET /api/customer/menu`, `POST /api/customer/session/open`, `GET /api/customer/session/current`, `POST /api/customer/order/submit`, `GET /api/customer/order/history`, `POST /api/customer/payment/request`, `POST /api/customer/staff-call`
- キッチン: `GET /api/kitchen/tickets`, `POST /api/kitchen/item/status`
- ホール: `GET /api/hall/tasks`, `POST /api/hall/task/status`
- レジ: `GET /api/checkout/summary`, `POST /api/checkout/settle`, `GET /api/checkout/payment-attempts`, `POST /api/checkout/cancel-payment`, `GET /api/checkout/receipt`, `POST /api/checkout/refund`
- 分析: `GET /api/analytics/summary`, `GET /api/analytics/item-ranking`, `GET /api/analytics/export-sales-csv`
- 認証: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`
- 管理: `GET /api/admin/menu/categories`, `GET /api/admin/menu/items`, `POST /api/admin/menu/items`, `POST /api/admin/menu/items/update`, `POST /api/admin/menu/items/toggle-active`, `POST /api/admin/menu/items/toggle-sold-out`, `POST /api/admin/menu/items/update-stock`, `POST /api/admin/menu/items/adjust-stock`, `GET /api/admin/menu/items/inventory-movements`, `POST /api/admin/menu/items/move`
- 席・端末管理: `GET /api/admin/tables`, `GET /api/admin/tables/detail`, `POST /api/admin/tables/update-status`, `POST /api/admin/tables/force-close-session`, `GET /api/admin/terminals`, `POST /api/admin/terminals/update-active`
- 注文管理: `GET /api/admin/orders`, `GET /api/admin/orders/detail`, `POST /api/admin/orders/cancel-item`, `POST /api/admin/orders/cancel-order`
- 操作ログ: `GET /api/admin/audit-logs`, `GET /api/admin/audit-logs/detail`, `GET /api/admin/audit-logs/export-csv`
- ユーザー管理: `GET /api/admin/users`, `POST /api/admin/users`, `POST /api/admin/users/update`, `POST /api/admin/users/toggle-active`

NyanQL 単体の疎通は次で確認します。

```bash
./scripts/smoke-nyanql.sh
```

Nyan8 経由の業務フローは次で確認します。

```bash
./scripts/smoke-e2e.sh
```

メニュー管理機能は次で確認します。

```bash
./scripts/smoke-admin-menu.sh
```

この script は DB 初期化、管理者端末でのカテゴリ・商品一覧取得、商品追加、商品編集、商品画像 URL の登録・更新・空戻し・不正 URL 拒否、画像 URL 変更 audit log、在庫設定、売切化、非表示化、顧客メニュー API への反映、非 manager 拒否、既存 `smoke-menu.sh` / `smoke-e2e.sh` の成功を確認します。

在庫履歴・在庫差分調整は次で確認します。

```bash
./scripts/smoke-inventory.sh
```

`update-stock` は在庫管理対象、現在在庫、低在庫閾値を直接設定する API です。`adjust-stock` は補充、減算、棚卸調整などの差分操作として使い、在庫が 0 未満になる調整は拒否します。`inventory_movements` は在庫増減の業務履歴、`audit_logs` は誰がどの API 操作をしたかの監査ログです。`smoke-inventory.sh` は `manual_set`, `manual_adjust`, `order_reserved`, `order_cancel_restored`、在庫 0 自動売切、売切自動解除なし、非 manager 拒否を確認します。

席・端末管理機能は次で確認します。

```bash
./scripts/smoke-admin-tables.sh
```

この script は DB 初期化、管理者端末での席・端末一覧取得、非管理端末拒否、注文なしセッションの強制クローズ、未精算注文ありセッションの強制クローズ拒否、精算済みセッションの強制クローズ、端末無効化と無効端末からの操作拒否、既存 smoke の成功を確認します。

強制クローズは、注文がないセッションまたは精算済みセッションのみ許可します。未精算または未提供の注文があるセッションは拒否します。端末無効化後は、無効端末からの主要操作を `この端末は無効です` で拒否します。`analytics-manager` は管理・分析向け端末のため無効化できません。

注文管理機能は次で確認します。

```bash
./scripts/smoke-admin-orders.sh
```

この script は DB 初期化、管理者端末での注文一覧・詳細取得、非管理端末拒否、単品注文の明細取消、一部明細取消後の会計サマリ・分析除外、ready 明細の取消拒否、精算済み注文の取消拒否、既存 smoke の成功を確認します。

操作ログ・監査ログ機能は `/admin/audit-logs` で確認します。manager ロールのユーザーが、操作日時、操作ユーザー、ロール、操作端末、対象種別、対象 ID / ラベル、変更前後の JSON、リクエスト、成功 / 失敗、エラーメッセージを検索・絞り込みできます。`CSV 出力` は現在の検索条件を反映して監査ログ CSV をダウンロードします。

監査ログ対象は、注文明細取消、注文全体取消、商品追加・編集・表示切替・売切切替・並び順変更、席ステータス変更、セッション強制クローズ、端末有効切替、ユーザー作成・更新・有効切替、精算完了、重要な精算拒否、顧客の注文確定・会計依頼・スタッフ呼び出し、認証成功・失敗・logout・session 失効・session revoked・一時ロック、監査ログ CSV 出力です。監査ログ API は session 認証と manager ロールを要求します。ログイン済み操作では `actor_user_id`, `actor_user_display_name`, `actor_user_role` を記録し、未ログインの顧客操作では `actor_terminal_code` / `actor_terminal_type` を記録します。認証ログの `request_data` と CSV には password、session_token、生 token を保存・出力しません。ログ物理削除、アーカイブ実装、改ざん防止署名、外部監査連携は未対応です。

監査ログ CSV は `GET /api/admin/audit-logs/export-csv` で取得します。検索条件は一覧 API と同じ `from_date`, `to_date`, `action`, `target_type`, `target_label`, `actor_terminal_code`, `actor_user_id`, `actor_user_role`, `status`, `keyword` です。CSV 列は `occurred_at`, `status`, `action`, `actor_user_id`, `actor_user_display_name`, `actor_user_role`, `actor_terminal_code`, `actor_terminal_type`, `target_type`, `target_id`, `target_label`, `error_message`, `request_data`, `before_data`, `after_data` です。JSONB は 1 行 JSON 文字列として escape します。

監査ログ保持方針は、MVP では `audit_logs` を物理削除せず同一テーブルに保持します。本番では 1 年以上などの保持期間を定め、古いログを archive table または外部 storage へ移す方針を検討します。改ざん防止署名は未対応で、将来は hash chain、append-only storage、外部保管を検討します。

操作ログ機能は次で確認します。

```bash
./scripts/smoke-audit-logs.sh
```

この script は DB 初期化、顧客注文、会計依頼、レジ精算、商品売切、注文明細取消、action / actor_user_role / keyword filter、監査ログ詳細取得、manager CSV 出力、viewer / cashier / kitchen / hall の CSV 拒否、CSV header、CSV 秘匿情報除外、CSV 出力操作ログを確認します。

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

境界条件まで含めた確認は次で実行します。

```bash
./scripts/dev-reset-db.sh
./scripts/smoke-auth.sh
./scripts/smoke-admin-menu.sh
./scripts/smoke-admin-tables.sh
./scripts/smoke-admin-orders.sh
./scripts/smoke-audit-logs.sh
./scripts/smoke-menu.sh
./scripts/smoke-e2e.sh
./scripts/smoke-order-multiple-items.sh
./scripts/smoke-multiple-tables.sh
./scripts/smoke-cancel-flow.sh
./scripts/smoke-staff-call.sh
./scripts/smoke-checkout-csv.sh
./scripts/smoke-invalid-operations.sh
cd frontend
npm install
npm audit
npm run build
```

`smoke-auth.sh` は最初に実行する認証・認可境界テストです。curl では cookie jar を使い、Nyan8 が返す疑似 `Set-Cookie` から `cafe_session` を同期します。現行 Nyan8 は実 HTTP `Set-Cookie` と受信 `Cookie` header を JavaScript API に渡せないため、smoke script と開発用 frontend は Bearer / `token` パラメータ互換も併用します。顧客 API 部分は token を付与せず、端末コードだけで動作することを確認します。各 smoke script は DB reset を内部で行うか、内部 helper の reset 後に再ログインするため独立実行できます。連続実行する場合も上記順でまとめて実行できます。

## 認証・ロール

Phase 7 ではスタッフ認証を本番運用を意識した MVP+ に強化しています。主方式は session cookie `cafe_session` です。login 成功時は `HttpOnly; SameSite=Lax; Path=/; Max-Age=28800` 相当の cookie を返す設計で、HTTPS 本番では reverse proxy で `Secure=true` を付けます。開発 HTTP では `Secure=false` とします。顧客 API (`/api/customer/*`) は顧客端末操作のため token 不要です。

Nyan8 単体では `Set-Cookie` を実 HTTP header にできず、受信 `Cookie` header も JavaScript params に渡せないことを確認しています。そのため開発環境では response body の `headers.Set-Cookie` を frontend / smoke script が同期し、Bearer / `token` パラメータ互換で protected API を呼びます。これは Nyan8 制約への開発互換であり、本番では reverse proxy などで cookie を実 header として扱い、必要に応じて cookie から upstream Authorization へ変換してください。Bearer 互換は開発・移行期間用です。

初期ユーザーは `manager / manager123`, `cashier / cashier123`, `kitchen / kitchen123`, `hall / hall123`, `viewer / viewer123` です。ロールは `manager`, `cashier`, `kitchen`, `hall`, `viewer` です。管理 API (`/api/admin/*`) は manager、分析 API は manager / viewer、レジ API は cashier / manager、キッチン API は kitchen / manager、ホール API は hall / manager を許可します。顧客 API は token 不要です。

session 有効期限は開発用 8 時間です。`/api/auth/logout` は session の `revoked_at` を設定し、cookie 削除相当の応答を返します。expired session、revoked session、inactive user の session は拒否します。`/api/auth/me` と protected API 呼び出し時に `last_seen_at` を更新します。

password は平文保存しません。Nyan8 の現行 JavaScript 実行環境では Node `crypto.pbkdf2Sync` / PostgreSQL `pgcrypto` を使えないため、Phase 7 では `salted_sha256_v1` (`salt:password` の SHA-256) を採用しました。Node crypto が使える環境では `hashPassword()` は PBKDF2-SHA256 形式も生成できますが、seed ユーザーは Nyan8 互換の salt 付き hash です。

ログイン失敗は login_id 単位で `failed_login_count` を増やし、5 回連続失敗で 5 分間 `locked_until` を設定します。ログイン成功時は失敗回数と lock をリセットします。存在しない login_id、誤 password、inactive user、locked user は同じログイン失敗メッセージを返します。

CSRF 方針は MVP として SameSite=Lax + JSON API 前提です。state changing API は POST と JSON body を前提にし、本番では許可 origin の限定と CSRF token 追加を検討します。

## CSV API 仕様

`GET /api/analytics/export-sales-csv`、`GET /api/analytics/daily-close/export-csv`、`GET /api/admin/audit-logs/export-csv` は Nyan8 ランタイムが JavaScript 戻り値を JSON として処理する制約に合わせ、CSV 本文を直接返さず JSON API として返します。

```json
{
  "success": true,
  "status": 200,
  "result": {
    "contentType": "text/csv",
    "filename": "sales-YYYY-MM-DD-YYYY-MM-DD.csv",
    "csv": "paid_date,payment_no,method,table_code,menu_item_id,item_name,quantity,sales_total,unit_cost_price,cost_total,gross_profit,gross_margin_rate\n..."
  }
}
```

フロントエンドの `/analytics` は `CSV ダウンロード` ボタン押下時に `result.csv` を Blob 化し、`contentType` と `filename` を使って CSV ファイルとしてダウンロードします。成功時は画面上にダウンロードしたファイル名を表示します。

## 既知の制約

- WebSocket Push は未実装で、MVP では 5 秒ポーリングで代替しています。
- NyanQL / Nyan8 の具体的な CLI オプションは同梱ランタイムに合わせて調整してください。
- 実決済、会員、予約、複数店舗は対象外です。
- 顧客注文画面のオプション選択 UI は商品詳細モーダルとして実装しています。必須オプションは初期値として先頭候補を選択し、画面上で変更できます。
- Phase 11 第1段階では `/admin/menu` でカテゴリ、商品オプショングループ、選択肢を編集できます。カテゴリ・オプション・選択肢は物理削除せず `active=false` で非表示にします。
- Phase 11 第2段階では `/admin/menu` で商品単位の在庫管理対象、在庫数、低在庫閾値を更新できます。在庫不足時は注文 API が 409 で拒否し、注文成功時に在庫を減らします。在庫 0 になった商品は自動で `sold_out=true` になります。キャンセル時は在庫を戻しますが、`sold_out=false` への自動解除は MVP では行わず、管理者が売切解除します。`scripts/smoke-admin-menu.sh` は在庫不足拒否、在庫引当、自動売切、取消時在庫戻し、在庫 audit log、非 manager 拒否を確認します。
- Phase 11 第3段階では `/admin/menu` で商品画像 URL を管理できます。商品一覧にはサムネイルまたは「画像なし」を表示し、商品編集フォームではプレビューを表示します。顧客注文画面の商品カードにも画像 URL が反映され、未設定または読み込み失敗時は固定サイズの fallback を表示します。MVP では画像ファイル本体を DB に保存せず、`http(s)` URL または `/` から始まるパスだけを扱います。
- Phase 11 第4段階では `/admin/menu` で商品ごとの標準原価を管理できます。注文確定時に注文時点の原価を `order_items.unit_cost_price` へ保存し、分析サマリ、商品ランキング、売上 CSV、注文管理詳細に原価・粗利・粗利率を表示します。顧客 API / 顧客画面には原価・粗利を返しません。
- Phase 11 第5段階では `/admin/menu` で在庫差分調整と商品別在庫履歴を確認できます。在庫履歴は `inventory_movements` に保存し、注文確定時の引当と取消時の在庫戻しも記録します。
- 本格的な商品画像アップロード、画像リサイズ / 圧縮、画像 CDN / 外部 storage、仕入 / 入荷 / 棚卸、廃棄、原材料別原価、レシピ原価、日別原価履歴、原価改定予約、複数店舗別在庫、商品一括 import / export、高度な価格履歴管理、クーポン / 割引、明細別返金、返金取消、実 Stripe / Square / PayPay 連携、外部 webhook 署名検証は後続以降の対象です。
- 精算はダミー決済です。金額はフロントエンド送信値ではなく、DB の注文明細から Nyan8 側で再計算します。
- API ランタイムが起動していない場合、フロントエンドには API エラーメッセージが表示されます。
- Nyan8 から NyanQL への呼び出し先は `backend/nyan8/javascript/lib/runtime.js` の `NYANQL_BASE_URL` で定義しています。開発既定値は `http://nyanql:change-me@localhost:8890` です。
- Nyan8 は業務エラー JSON の `status` を HTTP ステータスにも反映できることを実ランタイムで確認済みです。API エラーは `{"success":false,"status":400/403/404/409,"message":"..."}` 形式に統一しています。
- CSV エクスポートは Nyan8 の戻り値 parse 制約により、HTTP `Content-Type: text/csv` の直接レスポンスではなく JSON ラップ形式です。

## トラブルシューティング

- `createdb` / `psql` がパスワードを要求する場合: ローカル PostgreSQL のユーザー、パスワード、権限を確認し、必要に応じて `DATABASE_URL` または `PGUSER` / `PGPASSWORD` を設定してください。
- `npm run dev` で 5173 が使用中の場合: Vite が表示する代替ポートを使用してください。Nyan8 の CORS は `localhost:5173` と `localhost:5174` を許可しています。
- `npm install` で engine warning が出る場合: Node.js 20 LTS 以上、npm 10 以上へ切り替えてください。`dev:host` は LAN 検証用であり、本番公開には使わないでください。
- フロントエンドで API エラーが出る場合: Nyan8 が `8889`、NyanQL が `8890` で起動しているか、`NYANQL_BASE_URL` と Basic 認証情報が一致しているか確認してください。
- 精算ボタンが押せない場合: 顧客画面で会計依頼済みか確認してください。会計依頼前または精算済みのセッションは再精算できません。
- `./scripts/check-runtime.sh` で NG になる場合: `.local/bin` への配置、PATH、実行権限を確認してください。
