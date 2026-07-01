# 開発ドキュメント

作成日: 2026-07-01

この文書は、現在のリポジトリ内容、既存ドキュメント、Git 履歴、主要ソースコード、設定ファイル、smoke script を調査して作成した開発履歴です。事実確認に使った主な情報源は `README.md`、`docs/01_product_requirements.md` から `docs/08_operations.md`、`docs/assumptions.md`、`docs/development-notes.md`、`backend/nyanql/sql/schema.sql`、`backend/nyan8/api.json`、`backend/nyanql/api.json`、`frontend/src/App.tsx`、`frontend/src/api/cafeApi.ts`、`frontend/package.json`、`scripts/smoke-*.sh`、`git log --oneline --decorate --all`、`git log --stat` です。

既存ドキュメントに矛盾がある場合は、より新しい Phase 記述、実装ファイル、smoke script の存在を優先しました。特に `docs/01_product_requirements.md` の「現行スコープ外 / 今後対応」には、返金、在庫管理、監査ログ CSV、CI/CD、本番デプロイ手順など、後続 Phase で実装済みまたは一部対応済みになった項目が残っています。この文書では README、`docs/03_data_model.md`、`docs/04_api_design.md`、`docs/06_acceptance_criteria.md`、`docs/07_development_plan.md`、実装ファイルを優先し、古い記述は「当時のスコープ外」として扱います。

## 1. アプリ概要

Cafe Order System は、架空のカフェ店舗向けに、席端末でのセルフ注文、キッチンの調理状態管理、ホール指示、レジ精算、売上分析、管理機能を扱う MVP 実装です。

想定ユーザー:

- 顧客: 席端末から注文、スタッフ呼び出し、会計依頼を行う。
- キッチンスタッフ: 注文明細を `ordered -> accepted -> cooking -> ready` へ進める。
- ホールスタッフ: 配膳、スタッフ呼び出し、会計サポート、片付けタスクを処理する。
- レジ担当: 会計、支払い失敗、決済取消、レシート再発行、返金を扱う。
- 店長 / 管理者: メニュー、席・端末、注文、監査ログ、ユーザー、日次締めを管理する。
- 閲覧専用ユーザー: 分析と日次締めの閲覧を行う。

主要機能:

- 顧客注文、カート、オプション選択、注文履歴、会計依頼、スタッフ呼び出し。
- キッチン ticket と状態遷移。
- ホールタスク管理。
- レジ精算、支払い失敗 flow、決済試行取消、レシート再発行、全額 / 部分返金。
- mock provider による外部決済連携の土台、idempotency、webhook event 履歴。
- 売上分析、商品ランキング、売上 CSV、日次締め / 会計締め。
- メニューカテゴリ、商品、商品画像 URL、標準原価、在庫、オプション、選択肢管理。
- 席・端末管理、注文管理、監査ログ、監査ログ CSV、ログイン、ロール認可、ユーザー管理。
- GitHub Actions の lightweight CI とローカル full smoke。
- 本番相当の静的配信、reverse proxy、起動停止 script、運用ドキュメント。

現在の完成度:

- Phase 12.6 まで完了済みです。Phase 12 第1〜第5段階の返金、レシート、支払い失敗、mock provider、日次締めは docs / smoke / README 上で完了扱いです。
- Phase 13 は着手準備段階です。第1段階候補は顧客会員の土台で、実装はまだ開始されていません。
- 実店舗本番運用に必要な実決済連携、webhook 署名検証、httpOnly cookie 完全運用、本番 password hash、CSRF token、本番 migration、自動デプロイ、監査ログ改ざん検知などは未対応です。

## 2. 技術スタック

フロントエンド:

- TypeScript
- React 19
- Vite 8
- `frontend/package.json` の engine は Node.js `>=20.19`、npm `>=10`
- ルーティングは React Router ではなく `window.location.pathname` を `frontend/src/App.tsx` で分岐する単純な SPA 構成

バックエンド:

- Nyan8: 公開 controller API。`/api/*` を提供する。
- Nyan8 JavaScript: `backend/nyan8/javascript/apis/` と `backend/nyan8/javascript/lib/` に配置。
- Nyan8 側は Node.js の `require`, `module.exports`, `process.env`, `Buffer` に依存しない方針で、`nyanAllParams`, `nyanGetAPI`, `nyanJsonAPI`, `javascript_include` を使う。

SQL API / DB:

- NyanQL: SQL-first DB API。Nyan8 から内部 API として呼ばれる。
- PostgreSQL: 正式対象 DB。
- `backend/nyanql/api.json` に 100 API、`backend/nyanql/sql/` に SQL ファイルを配置。
- `backend/nyanql/sql/schema.sql` は開発 reset 用で `DROP TABLE IF EXISTS ... CASCADE` を含む。本番 DB へ安易に実行しない。

使用ライブラリ:

- runtime dependencies: `react`, `react-dom`
- dev dependencies: `@vitejs/plugin-react`, `typescript`, `vite`, React type packages
- UI ライブラリや状態管理ライブラリは使っていない。共通 UI は `frontend/src/components/ui.tsx` と CSS で実装。

ビルド・実行環境:

- frontend dev server: `npm run dev`、通常 `http://localhost:5173`
- Nyan8: `./scripts/start-nyan8.sh`、ポート例 `8889`
- NyanQL: `./scripts/start-nyanql.sh`、ポート例 `8890`
- PostgreSQL: ポート例 `5432`
- DB 接続は `DATABASE_URL` または NyanQL config で扱う。

デプロイ構成:

- 本番では Vite dev server を公開しない。
- `frontend/dist` を Nginx などで静的配信する。
- `/api/*` は HTTPS reverse proxy から Nyan8 へ転送する。
- NyanQL は外部公開せず、Nyan8 から内部呼び出しする。
- 設定例は `deploy/nginx/cafe-order-system.conf.example`、運用手順は `docs/08_operations.md` にある。

## 3. ディレクトリ構成

```txt
frontend/                 TypeScript / React / Vite SPA
frontend/src/pages/       画面単位の React component
frontend/src/api/         Nyan8 API client
frontend/src/auth/        ログイン状態と role gate
frontend/src/domain/      主要型と money helper
frontend/src/styles/      global CSS
backend/nyan8/            Nyan8 config, API 定義, controller JavaScript
backend/nyan8/javascript/apis/
                           公開 API ごとの薄い entry file
backend/nyan8/javascript/lib/
                           runtime, auth, audit など共通処理
backend/nyanql/           NyanQL config, API 定義, SQL
backend/nyanql/sql/       schema, seed, 業務 SQL
docs/                     要件、設計、データモデル、API、画面、受け入れ条件、計画、運用
docs/assets/ui-design/    画面仕様に紐づく UI デザイン画像
scripts/                  起動、DB reset、CI static check、smoke test
deploy/nginx/             Nginx reverse proxy 設定例
.github/workflows/        GitHub Actions CI
```

重要ファイル:

- `README.md`: 現在の起動手順、Phase 12 の概要、CI / smoke / 運用メモ。
- `docs/07_development_plan.md`: Phase 1〜13 の現在地と残課題。
- `docs/development-notes.md`: 実装時の判断、検証結果、未対応事項の時系列記録。
- `docs/assumptions.md`: 仕様上の前提と未対応事項。
- `backend/nyanql/sql/schema.sql`: 現在の DB 構造。
- `backend/nyan8/api.json`: Nyan8 公開 API 定義。調査時点で 68 API。
- `backend/nyanql/api.json`: NyanQL 内部 API 定義。調査時点で 100 API。
- `frontend/src/App.tsx`: 画面 URL と role gate。
- `frontend/src/api/cafeApi.ts`: frontend から Nyan8 への API client。

## 4. 現在の仕様

アーキテクチャ:

```txt
[Browser: TypeScript / React / Vite SPA]
        |
        | HTTP / JSON / Cookie or Bearer compatible auth
        v
[Nyan8: public controller API]
        |
        | internal HTTP / JSON
        v
[NyanQL: SQL-first DB API]
        |
        v
[PostgreSQL]
```

基本方針:

- フロントエンドは Nyan8 の `/api/*` のみ呼び出す。
- 顧客端末から NyanQL を直接呼ばない。
- 会計金額は DB の商品価格、オプション追加料金、税率から計算し、フロントエンド送信金額を正としない。
- 商品、カテゴリ、オプション、選択肢は物理削除より `active=false` を優先する。
- 注文時点の価格、オプション、原価は履歴テーブル側に保存し、後から商品マスタが変わっても過去注文の会計・分析を変えない。

認証・認可:

- 顧客 API はログイン不要。ただし `terminal_code`、端末 active、席端末判定は行う。
- protected API は session 認証と role 認可を行う。
- role は `manager`, `cashier`, `kitchen`, `hall`, `viewer`。
- `cafe_session` cookie を主方式とし、Nyan8 制約対応として Bearer token / `token` パラメータ互換も残す。
- session 有効期限は 8 時間。expired、revoked、inactive user は拒否する。
- 5 回連続ログイン失敗で 5 分ロックする。

主な状態遷移:

- 注文明細: `ordered -> accepted -> cooking -> ready -> served`。`ordered`, `accepted`, `cooking` は取消可能。`ready` 以降と精算済み注文は取消不可。
- 席 session: `seated`, `ordering`, `payment_requested`, `paid`, `closed`。
- ホールタスク: `todo`, `doing`, `done`, `cancelled`。
- payment: `pending`, `paid`, `failed`, `partial_refunded`, `refunded`, `cancelled`。
- payment attempt: `pending`, `paid`, `failed`, `cancelled`。
- 日次締め: `closed`, `reopened`。

CSV 仕様:

- Nyan8 ランタイム制約により、CSV 本文を直接返さず JSON の `result.csv` として返す。
- frontend が CSV 文字列を Blob 化してダウンロードする。

## 5. 開発履歴

### 2026-06-05 初期 MVP と Nyan8 / NyanQL 対応

- `3938733` `Implement cafe order system frontend and backend APIs`: React / Vite frontend、Nyan8 API、NyanQL SQL、PostgreSQL schema、初期 docs を追加。顧客注文、キッチン、ホール、レジ、分析の基礎を実装。
- `6c50dc3` `Link screen design images in screen spec`: 主要画面の UI デザイン画像を `docs/assets/ui-design/` に追加。
- `0530710` `Stabilize cafe order MVP docs and workflow`: 席 session、片付け、注文状態集約、精算対象制御、画面の loading / error / empty state を安定化。
- `e51d0d5` `Refactor cafe order flow and docs`: NyanQL / Nyan8 実ランタイム形式へ再構成。SQL parameter 形式、API config、runtime 共通処理、起動 script、DB reset、smoke を追加。
- `3709814` `Fix customer menu fetch and empty states`: GET の CORS preflight 問題を回避し、顧客メニュー取得と空状態表示を修正。

### 2026-06-10 MVP smoke 強化と UI 整備

- `92420cc` `Complete MVP flow smoke coverage and error handling`: Nyan8 業務エラーを `success/status/result/message` へ正規化し、E2E smoke を強化。
- `8336520` `Add boundary smoke checks for MVP flow`: 複数明細、複数席、キャンセル、スタッフ呼び出し、CSV、異常操作の smoke を追加。CSV は JSON ラップ形式に変更。
- `072abbb` `Improve frontend UI and terminal dashboards`: 顧客、キッチン、ホール、レジ、分析画面の UI を大幅に改善し、共通 UI component を追加。

### 2026-06-11〜2026-06-12 管理機能の導入

- `a265813` `Add admin menu management UI and APIs`: メニュー管理 UI / API、商品追加・編集・表示切替・売切・並び順変更を追加。
- `53305b8` `Add seat and terminal admin management`: 席・端末管理、席詳細、端末 active 切替、セッション強制クローズを追加。
- `c2f7eba` `Refine admin management docs and typings`: 管理画面の型と docs を調整。
- `382a380` `Restore repo integrity and stabilize frontend build`: frontend 型定義や build 安定化。

### 2026-06-15〜2026-06-16 注文管理、監査ログ、認証

- `dcb9cd0` `Add admin order management`: 注文一覧、注文詳細、明細取消、注文全体取消を追加。
- `c49f004` `Add audit log APIs and logging support`: 監査ログテーブル、記録処理、一覧・詳細 API / UI を追加。
- `10c7d0f` `Add auth and role-based access control`: ログイン、role 認可、AuthGate、ユーザー role ごとの画面制御を追加。
- `2710e60` `Harden auth and role handling`: 認証・role 処理を強化。
- `45551c7` `Refactor cafe order flow to centralize state handling`: 状態管理と業務処理を共通化。
- `e221b53` `Adopt session-based auth and audit login events`: session based auth、auth audit log、login event を導入。
- `2dfef77` `Refactor cafe order flow for Nyan8/NyanQL integration`: Nyan8 / NyanQL 連携の整理。

### 2026-06-17〜2026-06-18 本番準備と CI

- `c89bade` `Add audit log CSV export`: 監査ログ CSV、検索条件、CSV 秘匿情報除外、CSV 出力 audit を追加。
- `b478ed1` `Document production deployment prep`: 本番相当運用、Nginx、production script、backup / restore 方針を整理。
- `d8c0c9f` `Add GitHub Actions CI and test docs`: GitHub Actions CI、frontend build / audit、static check を追加。
- `18e2268` `Harden CI and smoke scripts`: CI と smoke script を強化。
- `a5e4547` `Harden CI docs and smoke guidance`: CI / smoke の役割分担と実行手順を docs に反映。

### 2026-06-24 Phase 11 商品・在庫・画像

- `d7ef358` `Implement cafe order system documentation updates`: 新機能前の docs 整合更新。
- `80e97ef` `Add stock tracking and reservation for menu items`: 商品在庫、在庫不足拒否、注文時在庫引当、取消時在庫戻し、自動売切を追加。
- `9e536c9` `Document Phase 11 consistency verification`: Phase 11 整合確認を記録。
- `5691683` `Add menu item image URL support`: 商品画像 URL 管理、画像 validation、管理画面 preview、顧客画面画像表示を追加。

### 2026-06-25 Phase 11 後半と Phase 12 決済・返金・締め

- `e3c0b95` `Add cost and margin metrics to analytics`: 標準原価、注文時点原価、粗利、粗利率、分析 / CSV / 注文管理への反映を追加。
- `99b1ce8` `Add inventory movement tracking and stock adjustment APIs`: 在庫変動履歴 `inventory_movements`、差分調整 API、在庫履歴 UI / smoke を追加。
- `e2044ac` `Add refund and receipt reissue support`: レシート再発行、全額返金、返金履歴、返金後分析 / CSV / audit を追加。
- `ef3e0a8` `Add checkout payment failure and cancel flows`: 支払い失敗、再試行、payment attempt、pending / failed attempt 取消を追加。
- `05327d8` `Support partial refunds in checkout and analytics`: 部分返金、返金可能残額、複数返金、純売上集計を追加。
- `f1a0405` `Add mock payment provider support`: mock provider、external id、idempotency、webhook event、provider status を追加。
- `2e32c85` `Add daily cash closure analytics`: 日次締め preview / close / detail / list / reopen / CSV を追加。
- `819a160` `Fix smoke script shellcheck path`: daily close smoke の shellcheck path を修正。

### 2026-06-26 Phase 12 完了確認と Phase 13 準備

- `ae75fc4` `Document Phase 12 completion and Phase 13 kickoff`: Phase 12 第1〜第5段階の完了、Phase 12.6 の整合確認、Phase 13 顧客会員候補を docs に記録。

## 6. 仕様変更履歴

主な仕様変更:

- 初期は TypeScript SPA + Nyan8 + NyanQL + PostgreSQL の基本構成。NyanPUI は不採用。
- Nyan8 / NyanQL の実ランタイム制約に合わせ、Nyan8 JavaScript を CommonJS / Node.js 依存から `javascript_include` と組み込み関数利用へ変更。
- CSV API は direct CSV response ではなく JSON ラップ形式へ変更。理由は Nyan8 が JavaScript 戻り値を JSON として parse するため。
- WebSocket Push は未実装とし、画面側の再取得 / ポーリングで扱う。理由は Nyan8 の Push 実装方式が未確認だったため。
- 管理者判定は初期の `terminal_code=analytics-manager` 中心から、session auth + manager role + 端末種別 / active 判定へ移行。
- frontend localStorage token 保存は廃止し、`cafe_session` cookie 主方式と Bearer / `token` 互換に整理。
- paid 後の決済取消は不可とし、返金 API を使う仕様へ整理。
- 在庫が戻っても `sold_out=false` へ自動解除しない。管理者の明示操作を必要とする。
- 商品画像は upload ではなく URL 管理に限定。理由は MVP 範囲を画像ファイル保存、resize、CDN へ広げないため。
- 部分返金は payment 単位の金額指定に限定。明細別返金や原価按分は未対応。
- mock provider は外部決済連携の土台であり、実 Stripe / Square / PayPay 連携ではない。
- 日次締めは単一店舗・営業日単位。月次締め、複数店舗別締め、実 provider 残高照合は未対応。

削除・廃止された仕様 / 方針:

- Node.js API server や fallback server は正式構成として使わない。
- 顧客端末から NyanQL を直接呼ぶ構成は採用しない。
- 本番公開に Vite dev server は使わない。
- CSV 本文の direct response は採用しない。
- paid payment の取消は採用せず、返金に一本化する。

現在有効な仕様は、`README.md`、`docs/02_architecture.md`、`docs/03_data_model.md`、`docs/04_api_design.md`、`docs/05_screen_spec.md`、`docs/06_acceptance_criteria.md`、`docs/07_development_plan.md`、`docs/08_operations.md` に分散している。この文書は索引用の履歴であり、詳細仕様は各専門ドキュメントを優先する。

## 7. 実装済み機能

実装済み:

- 顧客注文画面 `/customer/:tableCode`
- ログイン `/login`
- キッチン `/kitchen`
- ホール `/hall`
- レジ精算 `/checkout`
- 分析・日次締め `/analytics`
- メニュー管理 `/admin/menu`
- 席・端末管理 `/admin/tables`
- 注文管理 `/admin/orders`
- 監査ログ `/admin/audit-logs`
- ユーザー管理 `/admin/users`
- Nyan8 公開 API 68 本
- NyanQL 内部 API 100 本
- PostgreSQL schema と seed
- CI lightweight checks
- ローカル full smoke script 群
- 本番相当運用 docs と Nginx 設定例

一部実装済み:

- 認証: session、role、失効、inactive user、login failure lock は実装済み。本番向け httpOnly cookie 完全運用、CSRF、本格 password hash は未対応。
- 外部決済: mock provider、idempotency、webhook event 履歴は実装済み。実 provider 接続、署名検証、実返金は未対応。
- 在庫: 商品単位の現在在庫、差分調整、履歴は実装済み。仕入 / 入荷 / 棚卸 / 廃棄、複数店舗別在庫は未対応。
- 商品画像: URL 管理は実装済み。upload、resize、CDN は未対応。
- 分析: 売上、返金、原価、粗利、日次締めは実装済み。明細別返金の精密な原価按分、月次締めは未対応。

未実装:

- 顧客会員、予約、複数店舗。
- 実 Stripe / Square / PayPay 連携。
- 外部 webhook 署名検証。
- 実レシートプリンタ、電子レシート送信。
- 分割決済、返金取消、返金手数料。
- 月次締め、複数店舗別締め、実 provider 残高照合。
- OAuth / SSO、多要素認証。
- Docker、Kubernetes、Terraform、自動デプロイ。
- 本番 migration 管理。
- 監査ログ署名、hash chain、archive、外部監査連携。

## 8. 未実装・今後の課題

優先度が高い候補:

- Phase 13 第1段階: 顧客会員の土台。`customers` / `customer_profiles`、顧客番号、氏名または表示名、電話番号 / メール、検索、来店履歴、注文履歴、席 session または注文への任意紐付け、`/admin/customers`、顧客情報 audit log。
- 本番認証強化: httpOnly cookie の実 header 運用検証、CSRF token、本番向け password hash。
- 本番 DB 運用: migration 方針、backup / restore 演習、seed 再実行の扱い。
- Playwright などのブラウザ E2E 自動化。現状は shell smoke が中心。
- systemd / PM2 などの常駐管理。

技術的負債 / 注意点:

- `backend/nyan8/javascript/lib/runtime.js` が多機能化しており、今後の大規模機能では分割検討余地がある。
- React 側は `window.location.pathname` 分岐で routing しているため、画面数が増える Phase 13 以降は routing の整理余地がある。
- WebSocket Push 未実装のため、複数端末同時操作はポーリング / 再取得頼み。
- CSV は JSON ラップのため、通常の CSV endpoint としては扱えない。
- `schema.sql` は destructive reset 用。migration ではない。
- `frontend/dist` や `frontend/node_modules` は作業環境に存在する場合があるが、調査対象からは除外した。

## 9. 開発環境のセットアップ

前提:

- PostgreSQL
- Node.js `>=20.19`
- npm `>=10`
- NyanQL / Nyan8 runtime。`.local/bin/nyanql`, `.local/bin/nyan8` または PATH 上に配置。

runtime 確認:

```bash
./scripts/check-runtime.sh
```

DB 初期化:

```bash
export DATABASE_URL=postgres://codex:codex@localhost:5432/cafe_order_system
./scripts/dev-reset-db.sh
```

NyanQL 起動:

```bash
./scripts/start-nyanql.sh
```

Nyan8 起動:

```bash
./scripts/start-nyan8.sh
```

frontend:

```bash
cd frontend
npm install
npm run dev
```

通常の dev server は `http://localhost:5173`。`/api` は Vite proxy で Nyan8 `http://localhost:8889` へ転送される。

## 10. 起動・ビルド・テスト方法

frontend build:

```bash
cd frontend
npm ci
npm audit --audit-level=high
npm run build
```

CI static check:

```bash
./scripts/ci-shellcheck.sh
./scripts/ci-repo-consistency.sh
./scripts/ci-prod-readiness-static.sh
git diff --check
```

代表的な full smoke:

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

注意:

- smoke script は DB を初期化するものがあるため、並列実行しない。
- GitHub Actions CI は PostgreSQL / NyanQL / Nyan8 runtime を起動しない lightweight checks。
- full smoke はローカルまたは専用検証環境で行う。
- `npm audit` は npm registry へのネットワーク到達が必要。

## 11. 既知の問題

- WebSocket Push は未実装。画面更新は再取得 / ポーリング。
- 本番 httpOnly cookie / `Set-Cookie` / `Cookie` header の完全運用は reverse proxy / Nyan8 実行環境で検証が必要。
- 本番向け password hash、CSRF token、OAuth / SSO、多要素認証は未対応。
- 本番 migration 管理は未対応。
- 監査ログの改ざん防止署名、archive、外部 storage / SIEM 連携は未対応。
- 実決済サービス、実 webhook 署名検証、実返金、実レシートプリンタは未対応。
- Phase 12 の部分返金は payment 単位。明細別返金と完全な明細別原価按分は未対応。
- 商品画像は URL 管理のみ。upload / resize / CDN は未対応。
- 単一店舗前提。複数店舗、予約、顧客会員は未実装。
- 古い docs の一部には当時の未対応事項が残る。現状判断では `docs/07_development_plan.md` と実装ファイルを優先する。

## 12. AIエージェント向け引き継ぎメモ

- AGENTS.md の禁止事項を守る。特に顧客端末から NyanQL を直接呼ばないこと、フロントエンド送信金額を会計の正としないこと、DB schema / 状態遷移変更時は docs 更新すること。
- 仕様上の仮定は `docs/assumptions.md`、設計判断や暫定対応は `docs/development-notes.md` に追記する。
- 実装変更時は、API 定義と実ファイルの整合を `scripts/ci-repo-consistency.sh` または `scripts/check-nyan8-api-files.mjs` / `scripts/check-nyanql-sql-files.mjs` で確認する。
- DB 変更時は `backend/nyanql/sql/schema.sql`、関連 SQL、データモデル docs、API docs、受け入れ条件、smoke を合わせて更新する。
- Nyan8 業務処理は frontend ではなく controller 側で検証する。価格、税、原価、在庫、返金可能額、role 認可はサーバー側を正とする。
- CSV は JSON ラップ形式を維持する。直接 CSV body を返す変更は Nyan8 ランタイム制約を再検証してから行う。
- Phase 13 に進む場合、顧客会員を先に作る理由は `docs/07_development_plan.md` に記録済み。予約は顧客情報を参照するため、顧客マスタが先行候補。
- 大きな変更前後では frontend build、CI static checks、関連 smoke、必要に応じて full smoke を順次実行する。

## 13. 調査時点の確認情報

調査した Git の先頭:

- branch: `master`
- remote tracking: `origin/master`
- HEAD: `ae75fc4` `2026-06-26 Document Phase 12 completion and Phase 13 kickoff`

確認した定量情報:

- Nyan8 API 定義: 68 件
- NyanQL API 定義: 100 件
- DB 主要テーブル: `cafe_tables`, `terminals`, `users`, `user_sessions`, `menu_categories`, `menu_items`, `inventory_movements`, `menu_item_options`, `menu_option_choices`, `table_sessions`, `orders`, `order_items`, `order_item_options`, `hall_tasks`, `payments`, `payment_attempts`, `payment_refunds`, `payment_webhook_events`, `daily_cash_closures`, `audit_logs`

未確認事項:

- GitHub Actions の現在日時点の最新リモート実行結果は、この調査ではネットワーク確認していない。既存 docs には 2026-06-18 時点の成功 run が記録されている。
- 実ブラウザでの全画面最新状態の再確認は、この調査では実施していない。既存 docs には過去の手動確認結果が記録されている。
- PostgreSQL / NyanQL / Nyan8 を起動した full smoke の再実行は、この文書作成時には実施していない。既存 docs には Phase 12.6 時点の成功記録がある。
- NyanQL / Nyan8 runtime 自体の上流仕様や最新 version は、この調査では確認していない。
