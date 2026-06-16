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
- 席・端末管理で席一覧、席詳細、端末一覧、端末有効 / 無効、条件付きセッション強制クローズができる。
- 注文管理で注文一覧、注文詳細、明細取消、注文全体取消ができる。
- 監査ログで重要操作と認証イベントの一覧・詳細を確認できる。
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

## smoke script 対応表

| Script | 主な受け入れ条件 |
|---|---|
| `scripts/smoke-auth.sh` | login / logout / me、role 制御、token なし、expired / revoked / inactive session、ログイン失敗ロック、最後の manager 保護、auth audit log |
| `scripts/smoke-audit-logs.sh` | 注文、会計依頼、精算、商品売切、明細取消、非管理者拒否、監査ログ一覧・詳細 |
| `scripts/smoke-admin-orders.sh` | 注文一覧・詳細、明細取消、注文全体取消、取消明細の会計・分析除外、ready / 精算済み取消拒否 |
| `scripts/smoke-admin-menu.sh` | 商品追加・編集、表示 / 非表示、売切 / 売切解除、並び順変更、顧客メニュー反映 |
| `scripts/smoke-admin-tables.sh` | 席一覧・詳細、席状態更新、端末有効 / 無効、強制クローズ条件 |
| `scripts/smoke-menu.sh` | 顧客メニュー取得、端末判定、active / sold out の扱い |
| `scripts/smoke-e2e.sh` | 顧客注文、キッチン、ホール、会計依頼、精算、片付け、分析反映 |
| `scripts/smoke-order-multiple-items.sh` | 同一注文の複数明細、全明細会計、ランキング反映 |
| `scripts/smoke-multiple-tables.sh` | T01 / T02 同時進行、席・タスク・精算の分離 |
| `scripts/smoke-cancel-flow.sh` | キャンセル可能状態、ready 以降拒否、取消明細除外 |
| `scripts/smoke-staff-call.sh` | 注文なしセッションでの staff_call、ホール対応、完了済み再完了拒否 |
| `scripts/smoke-checkout-csv.sh` | 精算後の売上 CSV、フロントエンド CSV ダウンロード形式 |
| `scripts/smoke-invalid-operations.sh` | 端末種別違反、状態遷移違反、存在しない ID / table_code / terminal_code の拒否 |
