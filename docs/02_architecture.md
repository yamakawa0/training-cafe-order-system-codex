# 02 Architecture

## 採用構成

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

## 採用技術

- Frontend: TypeScript / React 19 / Vite 8
- Controller API: Nyan8
- SQL API: NyanQL
- Database: PostgreSQL
- NyanPUI: 不採用。TypeScript SPA と Nyan8 controller API を正式構成とする。

フロントエンドは Nyan8 の `/api/*` のみを呼び出す。NyanQL は Nyan8 から内部 API として呼び出し、顧客端末や管理画面から直接呼び出さない。

## 認証・認可

- 顧客 API はログイン不要。
- キッチン API は `kitchen` / `manager`。
- ホール API は `hall` / `manager`。
- レジ API は `cashier` / `manager`。
- 分析 API は `manager` / `viewer`。
- 管理 API は `manager`。
- `terminal_code` は端末種別、端末 active 判定、席端末判定、監査ログ補助情報に使う。

現行実装は `cafe_session` cookie 主方式を設計上の主方式とし、Nyan8 の header / cookie 制約に対応するため Bearer token と `token` パラメータの互換方式も受け付ける。session は `expires_at`, `revoked_at`, inactive user を検証し、認証済み操作は監査ログに user actor を記録する。

## 監査ログ

重要な顧客操作、会計操作、管理操作、認証操作を `audit_logs` に記録する。ログには terminal actor と user actor の両方を保持できる。ログ書き込み失敗時は本体処理を原則継続し、操作自体の成否は `status` と `error_message` に記録する。

## フロントエンド環境

- Node.js `>=20.19`
- npm `>=10`
- 通常開発は `npm run dev`
- LAN 検証時のみ `npm run dev:host`
- 本番公開に Vite dev server は使わない

本番配信では `npm run build` で生成される `frontend/dist` を Nginx などで静的配信する。Vite dev server は本番公開しない。`/api/*` は HTTPS reverse proxy が Nyan8 へ転送し、Nyan8 は NyanQL を内部 API として呼ぶ。NyanQL は外部公開せず、PostgreSQL 接続先は `DATABASE_URL` で指定する。

本番は HTTPS 前提とし、`cafe_session` cookie の実 `Set-Cookie` と受信 `Cookie` header の扱いは reverse proxy / Nyan8 実行環境で検証する。必要な場合だけ、検証済みの方式で cookie を Authorization header へ変換する。未検証の header 変換は確定実装として扱わない。

## ポート例

- Frontend dev server: `5173`
- Nyan8: `8889`
- NyanQL: `8890`
- PostgreSQL: `5432`

## 回帰確認

業務フローと境界条件は `scripts/smoke-*.sh` で確認する。代表的な対象は認証、監査ログ、メニュー管理、席・端末管理、注文管理、顧客注文 happy path、複数テーブル、キャンセル、スタッフ呼び出し、CSV 出力、異常操作拒否である。

## リアルタイム更新

WebSocket Push は現行未実装。顧客履歴、キッチン、ホール、レジ、分析の更新は画面側の再取得 / ポーリングで扱う。
