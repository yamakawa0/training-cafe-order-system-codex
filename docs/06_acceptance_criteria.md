# 06 Acceptance Criteria

## 共通

- `frontend` で `npm install` が成功する。
- `npm audit` が high / critical 0 件、現行目標では total 0 件である。
- `npm run build` が成功する。
- 主要画面で console error が出ない。
- README の手順で起動できる。
- NyanQL / Nyan8 を正式実行環境として使う。
- Node.js `>=20.19` / npm `>=10` を推奨する。
- フロントエンドは Nyan8 の `/api/*` のみを呼び、NyanQL を直接呼ばない。

## Phase 9 本番デプロイ準備

- frontend production build が成功する。
- `frontend/dist` が存在する。
- Nginx / reverse proxy 設定例が存在する。
- `.env.example` / `.env.production.example` が存在する。
- 本番起動・停止・状態確認 script が存在する。
- 本番 readiness smoke が成功する。
- DB backup / restore 手順が docs にある。
- `schema.sql` の `DROP TABLE` 注意が docs にある。
- Vite dev server を本番公開しない方針が明記されている。
- `npm audit` が high / critical 0 件である。
- 既存 smoke script が成功する。

## Phase 10 CI / 自動テスト

- `.github/workflows/ci.yml` が存在する。
- pull_request で CI が実行される。
- master push で CI が実行される。
- frontend `npm ci` が成功する。
- frontend `npm audit --audit-level=high` が成功する。
- frontend `npm run build` が成功する。
- shell script 構文チェックが成功する。
- Nyan8 `api.json` 参照先 JavaScript file の存在チェックが成功する。
- NyanQL `api.json` 参照先 SQL file の存在チェックが成功する。
- production readiness static check が成功する。
- CI で本番 DB を破壊しない。
- CI では `dev-reset-db.sh` を実行しない。
- CI では実 PostgreSQL / NyanQL / Nyan8 runtime を起動しない。
- GitHub Actions の最新 `master` 実行結果が成功していることを確認する。GitHub Actions にアクセスできない場合は、同等の local CI check 結果を記録する。
- local full smoke は CI ではなく、開発者環境または専用検証環境で順次実行し成功する。
- Phase 11 以降の大きな機能追加前に、local full smoke が成功している。

## 業務フロー

- 顧客注文 happy path が通る。
- 複数明細注文で金額、履歴、キッチン、分析が整合する。
- 複数テーブル同時進行で席・タスク・精算が取り違えられない。
- キャンセル可能状態の明細取消、注文全体取消ができる。
- ready 以降、精算済み、存在しない ID などの異常操作を拒否する。
- スタッフ呼び出しタスクを作成し、ホールで完了できる。
- 会計依頼後は追加注文できない。
- 会計依頼済みセッションを精算し、片付けタスクを作成できる。
- 売上 CSV 出力ができる。
- 取消明細は会計・分析・CSV から除外される。

## 管理機能

- メニュー管理で商品追加、編集、表示 / 非表示、売切 / 売切解除、並び順変更ができる。
- メニュー管理でカテゴリを追加・編集・非表示・再表示できる。
- カテゴリ並び順が顧客注文画面に反映される。
- 商品が属するカテゴリを非表示にすると、その商品は顧客注文画面に表示されない。
- メニュー管理で商品ごとのオプショングループを追加・編集・非表示・再表示・並び順変更できる。
- メニュー管理でオプション選択肢を追加・編集・非表示・再表示・並び順変更できる。
- 顧客注文画面で必須オプションを選択してからカート投入できる。
- 必須オプション未選択や最大選択数超過は注文 API で拒否される。
- オプション追加料金は注文履歴、キッチン ticket、レジ精算、売上分析、商品ランキング、売上 CSV、注文管理に反映される。
- カテゴリ・オプション・選択肢変更は audit log に記録される。
- 商品に在庫管理対象フラグを設定できる。
- 商品在庫数と低在庫閾値を設定できる。
- 在庫不足の注文は 409 で拒否され、売上・分析・CSV・キッチン ticket に出ない。
- 注文成功時に在庫が減り、同一注文内の同一商品は合算数量で在庫判定される。
- 在庫 0 で `sold_out=true` になる。
- キャンセル時に在庫が戻る。
- 在庫が戻っても `sold_out` は自動解除されない。
- manager 以外は在庫管理 API を使えない。
- 在庫更新、在庫引当、在庫戻し、自動売切が audit log に記録される。
- 席・端末管理で席一覧、席詳細、端末一覧、端末有効 / 無効、条件付きセッション強制クローズができる。
- 注文管理で注文一覧、注文詳細、明細取消、注文全体取消ができる。
- 監査ログで重要操作と認証イベントの一覧・詳細を確認できる。
- manager は監査ログ CSV を出力できる。
- manager 以外は監査ログ CSV を出力できない。
- 監査ログ CSV は現在の検索条件を反映する。
- 監査ログ CSV に password / session_token / 生 token が含まれない。
- 監査ログ CSV 出力操作が audit log に記録される。
- 監査ログ詳細で before_data / after_data を確認できる。
- ユーザー管理でユーザー作成、更新、有効 / 無効切替ができる。

## 認証・認可

- manager login が成功する。
- 誤 password を拒否する。
- 連続ログイン失敗で一時ロックする。
- viewer / cashier / kitchen / hall の role 制御が効く。
- token なし protected API を拒否する。
- expired session を拒否する。
- revoked session を拒否する。
- inactive user を拒否する。
- 最後の active manager 無効化・降格を拒否する。
- 顧客 API は token なしで成功する。
- 認証済み操作は監査ログに actor user を記録する。
- 認証ログの `request_data` に password を含めない。

## Phase 11 第3段階 商品画像管理

- manager は商品画像 URL を登録・更新できる。
- manager は商品画像 URL を空に戻せる。
- 不正な画像 URL は拒否される。
- 顧客メニュー API に画像 URL が反映される。
- 顧客注文画面で商品画像が表示される。
- 画像未設定時もレイアウトが崩れない。
- 画像 URL 変更が audit log に残る。
- manager 以外は画像 URL 更新を含む商品更新 API を使えない。
- `smoke-admin-menu.sh` が画像 URL 条件まで検証して成功する。
- 既存 smoke が成功する。
- CI checks が成功する。

## Phase 11 第4段階 原価 / 粗利管理

- manager は商品ごとの標準原価を登録・更新できる。
- `cost_price` は 0 以上の整数で、販売価格を超えても登録できる。
- 販売価格を超える原価は管理画面で赤字警告として表示される。
- 注文確定時に注文時点の原価が `order_items.unit_cost_price` に保存される。
- 商品マスタの原価変更後も過去注文の原価・粗利は変わらない。
- 顧客メニュー、顧客注文履歴、顧客画面に原価・粗利が出ない。
- 分析サマリ、商品ランキング、売上 CSV、注文管理詳細に原価・粗利・粗利率が出る。
- 取消明細は原価・粗利集計からも除外される。
- 原価変更が audit log の before / after に残る。
- `smoke-admin-menu.sh`, `smoke-e2e.sh`, `smoke-admin-orders.sh`, `smoke-checkout-csv.sh` が原価・粗利条件まで検証して成功する。

## smoke script 対応表

| Script | 主な受け入れ条件 |
|---|---|
| `scripts/smoke-auth.sh` | login / logout / me、role 制御、token なし、expired / revoked / inactive session、ログイン失敗ロック、最後の manager 保護、auth audit log |
| `scripts/smoke-audit-logs.sh` | 注文、会計依頼、精算、商品売切、明細取消、非管理者拒否、監査ログ一覧・詳細、action / role / keyword filter、manager CSV 出力、非 manager CSV 拒否、CSV 秘匿情報除外、CSV 操作ログ |
| `scripts/smoke-admin-orders.sh` | 注文一覧・詳細、明細取消、注文全体取消、注文詳細の原価・粗利、取消明細の会計・分析・粗利集計除外、ready / 精算済み取消拒否 |
| `scripts/smoke-admin-menu.sh` | 商品追加・編集、原価登録・更新・赤字商品許可・audit log・顧客 API 非漏洩、商品画像 URL 登録・更新・空戻し・不正 URL 拒否・audit log、表示 / 非表示、売切 / 売切解除、並び順変更、カテゴリ・オプション管理、在庫設定、在庫不足拒否、在庫引当、自動売切、取消時在庫戻し、顧客メニュー反映 |
| `scripts/smoke-admin-tables.sh` | 席一覧・詳細、席状態更新、端末有効 / 無効、強制クローズ条件 |
| `scripts/smoke-menu.sh` | 顧客メニュー取得、端末判定、active / sold out の扱い |
| `scripts/smoke-e2e.sh` | 顧客注文、キッチン、ホール、会計依頼、精算、片付け、売上・原価・粗利の分析反映 |
| `scripts/smoke-order-multiple-items.sh` | 同一注文の複数明細、全明細会計、ランキング反映 |
| `scripts/smoke-multiple-tables.sh` | T01 / T02 同時進行、席・タスク・精算の分離 |
| `scripts/smoke-cancel-flow.sh` | キャンセル可能状態、ready 以降拒否、取消明細除外 |
| `scripts/smoke-staff-call.sh` | 注文なしセッションでの staff_call、ホール対応、完了済み再完了拒否 |
| `scripts/smoke-checkout-csv.sh` | 精算後の売上 CSV、原価・粗利 CSV 列、フロントエンド CSV ダウンロード形式 |
| `scripts/smoke-invalid-operations.sh` | 端末種別違反、状態遷移違反、存在しない ID / table_code / terminal_code の拒否 |
