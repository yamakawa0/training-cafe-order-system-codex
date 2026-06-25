# Assumptions

## 現行前提

- NyanQL / Nyan8 を正式実行環境とする。
- フロントエンドは Nyan8 の `/api/*` のみを呼び出し、顧客端末から NyanQL を直接呼ばない。
- NyanPUI は不採用とし、TypeScript / React / Vite SPA を採用する。
- DB は PostgreSQL を使用する。
- 架空カフェは現時点では 1 店舗のみ。
- 顧客 API はログイン不要。
- キッチン API は `kitchen` / `manager`。
- ホール API は `hall` / `manager`。
- レジ API は `cashier` / `manager`。
- 分析 API は `manager` / `viewer`。
- 管理 API は `manager` のみ。
- `terminal_code` は端末種別、端末 active 判定、席端末判定、監査ログ補助情報に使う。
- 顧客端末は席に固定され、端末コードにより席を判定する。
- 商品価格・税額・会計金額は DB の商品価格、選択肢差額、税率から計算し、フロントエンドから送信された金額を正としない。
- 消費税は明細ごとに `tax_rate` を使って計算し、精算時にも DB 取得明細から再計算する。
- 在庫管理は現行スコープ外とし、売切フラグのみ扱う。
- 実決済連携は行わず、支払い方法 `cash` / `card` / `qr` のダミー決済記録だけを行う。

## 認証・session

- password は平文保存しない。
- 現行 hash は MVP 方式で、`salted_sha256_v1` と Node crypto 利用時の `pbkdf2_sha256_v1` を扱う。
- 本番では bcrypt / argon2 等を検討する。
- `password_hash_version` は hash 方式の識別に使う。
- session 有効期限は 8 時間。
- `expires_at` 超過、`revoked_at` 設定、inactive user の session は拒否する。
- 5 回連続ログイン失敗で 5 分ロックする。
- 設計上の主方式は `cafe_session` cookie である。
- Nyan8 の現行制約により、開発環境では response body の疑似 `Set-Cookie` と Bearer / `token` 互換方式を併用する。
- 本番では httpOnly cookie / CSRF 対策を強化予定。
- 現行 CSRF 方針は `SameSite=Lax` と JSON API 前提で、state changing API は POST を使う。

## 業務ルール

- 注文明細は原則 `ordered -> accepted -> cooking -> ready -> served` の順に進める。
- キッチン操作では `served` にできない。`served` はホール画面の配膳完了で更新する。
- 会計依頼後または精算済みセッションでは追加注文を拒否する。
- キャンセルは `ordered`, `accepted`, `cooking` の注文明細だけ許可する。
- `ready` 以降のキャンセルは、配膳タスクとの整合性を優先して拒否する。
- 全明細が `cancelled` の場合、注文ヘッダは `cancelled` とする。
- キャンセル明細は会計金額、売上分析、商品ランキング、売上 CSV に含めない。
- 未精算注文または未提供明細があるセッションは強制クローズ不可とする。
- 商品削除は物理削除せず、当面は `active=false` で代替する。

## 監査ログ

- `audit_logs` は物理削除しない。
- MVP では監査ログ全件を同一 `audit_logs` テーブルに保持する。
- 本番では保持期間を 1 年以上などに設定し、古いログは archive table または外部 storage へ移す方針を検討する。
- 認証済み操作では `actor_user_id`, `actor_user_display_name`, `actor_user_role` を記録する。
- 顧客操作など未ログイン操作では terminal actor を主に記録する。
- 認証ログの `request_data` に password を含めない。
- 監査ログ CSV エクスポートは manager のみ許可する。
- 監査ログ CSV には password、session_token、生 token を含めない。
- ログ書き込み失敗時は本体処理を原則継続する。
- 改ざん防止署名は未対応。将来は hash chain、append-only storage、外部保管、外部監査システム / SIEM 連携を検討する。

## フロントエンド / 開発環境

- Node.js `>=20.19` / npm `>=10` を推奨する。
- 通常開発は `npm run dev` を使う。
- LAN 端末検証時のみ `npm run dev:host` を使う。
- Vite dev server は本番公開しない。
- 本番相当では `npm run build` の静的成果物を reverse proxy 等で配信する。
- 本番では HTTPS を前提とする。
- 本番では `frontend/dist` を静的配信する。
- `/api/*` は reverse proxy で Nyan8 へ転送する。
- `DATABASE_URL` は環境変数で管理する。
- 実 secret は commit しない。
- `backend/nyanql/sql/schema.sql` は開発 reset 用で、本番 DB に安易に実行しない。
- 本番 migration は今後の課題とする。
- DB backup は運用必須とする。
- cookie の実 header 運用は reverse proxy / Nyan8 実行環境で検証が必要である。
- WebSocket Push は現行未実装で、画面更新は再取得 / ポーリングで扱う。
- CSV エクスポート API は Nyan8 ランタイム制約により CSV 本文を直接返さず、`success/status/result` の JSON 内に `contentType`, `filename`, `csv` を返す。フロントエンドが `csv` を Blob 化してダウンロードする。
- Phase 11 第1段階ではカテゴリ、オプション、選択肢は物理削除せず `active=false` で非表示にする。
- `required=true` のオプションは最低 1 つ選択必須とし、`multi_select=false` は最大 1 つ、`multi_select=true` は `max_select` が設定されている場合その数まで選択できる。
- オプション追加料金は注文時点の `order_item_options.price_delta` を正とし、後からメニュー定義の価格が変更されても既存注文の会計・分析は注文時点の値を使う。
- Phase 11 第2段階の在庫管理は商品単位の `stock_quantity` だけを対象とし、オプション選択肢ごとの在庫管理は未対応とする。
- 複数店舗別在庫、倉庫在庫、入荷 / 棚卸 / 廃棄、在庫履歴画面は未対応とする。
- 在庫戻しはキャンセル時に行う。served 後キャンセルと精算済み注文キャンセルは既存仕様どおり不可のため在庫戻し対象外とする。
- 在庫が 1 以上に戻っても `sold_out=false` への自動解除は行わず、管理者が明示的に売切解除する。

## CI / 自動テスト

- CI は GitHub Actions を想定する。
- CI は lightweight checks に限定し、build、audit、構文、定義整合、static readiness を確認する。
- CI では本番 DB / 開発 DB を操作しない。
- CI では `dev-reset-db.sh` を実行しない。
- CI では NyanQL / Nyan8 runtime を必須にしない。
- full smoke はローカルまたは専用検証環境で実行する。
- Phase 11 以降の大きな機能追加前後では、local full smoke を順次実行して回帰を確認する。
- Phase 11 第3段階の MVP 商品画像は URL 管理とし、画像ファイル本体は DB に保存しない。
- 商品画像 URL は空値、`http://` / `https://`、または `/` から始まるパスのみ許可し、`data:` / `javascript:` / `file:` URL は禁止する。
- 本格的な画像 upload / resize / CDN は Phase 11 後続の将来課題とする。
- Phase 11 第4段階の `menu_items.cost_price` は `price` と同じ税区分基準の 1 個あたり標準原価として扱う。注文確定時に `order_items.unit_cost_price` へ保存し、過去注文の粗利計算はこの履歴値を使う。
- オプション追加料金は売上には含めるが、MVP ではオプション追加原価を 0 とする。顧客 API / 顧客画面には `cost_price`, `costPrice`, `grossProfit` を返さない。
- 仕入、入荷、棚卸、廃棄、原材料別原価、レシピ原価、複数店舗別原価、日別原価履歴、原価改定予約、自動原価計算は Phase 11 後続の将来課題とする。
- `package-lock.json` は CI の再現性のため commit する。

## 今後の未対応事項

- 実決済サービス連携
- 返金処理
- 在庫管理
- 複数店舗管理
- 予約管理
- 顧客会員機能
- 複雑な割引 / クーポン
- 商品画像アップロード
- 仕入 / 入荷 / 棚卸
- 原材料別原価 / レシピ原価
- 日別原価履歴 / 原価改定予約
- 商品オプション編集 UI の高度化
- 監査ログアーカイブ実装
- 監査ログ署名 / 改ざん検知
- 外部監査システム / SIEM 連携
- httpOnly cookie の完全本番運用
- bcrypt / argon2 等の本番向け password hash
- CSRF token
- 多要素認証
- OAuth / SSO
- CI/CD のうち自動デプロイ
