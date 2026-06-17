# 08 Operations: 本番相当運用手順

## 前提

- 本番では Vite dev server を公開しない。
- `frontend/dist` を Nginx などで静的配信する。
- `/api/*` は HTTPS reverse proxy から Nyan8 へ転送する。
- Nyan8 は NyanQL を内部 API として呼び、NyanQL は外部公開しない。
- PostgreSQL 接続先は `DATABASE_URL` で管理する。
- `.env.production` と実 secret は commit しない。

## 配置案

```txt
/opt/cafe-order-system/
  frontend/
    dist/
  backend/
    nyan8/
    nyanql/
  scripts/
  deploy/
    nginx/
  logs/
  .env.production
```

このリポジトリ構成をそのまま配置する場合も、公開する静的 root は `frontend/dist` に限定する。

## Build

```bash
./scripts/prod-build.sh
```

この script は `frontend` で `npm install`, `npm audit --audit-level=high`, `npm run build` を実行し、`frontend/dist/index.html` と assets の存在を確認する。

## Reverse Proxy

設定例は `deploy/nginx/cafe-order-system.conf.example` に置く。

- HTTP は HTTPS へ redirect する。
- HTTPS で `frontend/dist` を静的配信する。
- SPA fallback は `try_files $uri /index.html` とする。
- `/api/` は Nyan8 の `http://127.0.0.1:8889/api/` へ転送する。
- `X-Forwarded-Proto`, `X-Forwarded-Host`, `X-Real-IP`, `X-Forwarded-For` を渡す。

## Cookie / Header

開発環境では Nyan8 の制約により、実 HTTP `Set-Cookie` と受信 `Cookie` header が JavaScript params に渡らない場合がある。そのため Bearer / `token` 互換を残している。

本番想定:

- HTTPS reverse proxy を前段に置く。
- `cafe_session` cookie 主方式を維持する。
- Secure cookie は HTTPS 前提で有効にする。
- SameSite は `Lax`、HttpOnly を前提にする。
- 実 `Set-Cookie` と `Cookie` header の扱いは、Nyan8 の本番実行方式または reverse proxy で検証する。
- 必要な場合だけ、検証済みの reverse proxy / runtime bridge で cookie を Authorization header へ変換する。
- 未検証の header 変換は確定実装として扱わない。

## 起動

`.env.production.example` を `.env.production` にコピーし、本番 DB と secret を設定する。

```bash
cp .env.production.example .env.production
vi .env.production
```

NyanQL、Nyan8 の順に起動する。

```bash
./scripts/prod-start-nyanql.sh
./scripts/prod-start-nyan8.sh
./scripts/prod-status.sh
```

停止:

```bash
./scripts/prod-stop.sh
```

MVP の production script は pid file と log file を使う。systemd / PM2 などの常駐管理は次フェーズ以降の課題とする。

## DB Backup

定期バックアップは必須とする。

```bash
pg_dump "$DATABASE_URL" > "backup_$(date +%Y%m%d_%H%M%S).sql"
```

バックアップファイルは DB サーバーとは別の保管先へ暗号化して保存し、保持期間、復旧責任者、復旧演習頻度を運用で定める。

## DB Restore

復旧先と対象ファイルを確認してから実行する。

```bash
psql "$DATABASE_URL" < backup.sql
```

注意:

- `backend/nyanql/sql/schema.sql` は開発 reset 用で、先頭に `DROP TABLE IF EXISTS ... CASCADE` を含む。
- 本番 DB に `schema.sql` を安易に実行しない。
- `seed.sql` は初期データ投入用であり、本番既存データへの再実行可否は内容確認が必要。
- 本番 migration 方針は今後の課題とする。

## Logs

保存先:

- NyanQL stdout / stderr: `${LOG_DIR}/nyanql.stdout.log`, `${LOG_DIR}/nyanql.stderr.log`
- Nyan8 stdout / stderr: `${LOG_DIR}/nyan8.stdout.log`, `${LOG_DIR}/nyan8.stderr.log`
- NyanQL runtime log: runtime 配下の `logs/nyanql.log`
- Nyan8 runtime log: runtime 配下の `logs/nyan8.log`
- Nginx access log: `/var/log/nginx/cafe-order-system.access.log`
- Nginx error log: `/var/log/nginx/cafe-order-system.error.log`
- frontend は静的配信のため app log は基本なし。
- audit log は PostgreSQL の `audit_logs` に保存する。

ローテーション:

- NyanQL / Nyan8 runtime log は config の `MaxSize`, `MaxBackups`, `MaxAge`, `Compress` に従う。
- stdout / stderr と Nginx log は OS の logrotate 等で日次またはサイズベースのローテーションを設定する。
- audit log は DB 保持期間、archive table、外部 storage を今後設計する。

障害時の確認順:

1. Nginx error log
2. Nginx access log
3. Nyan8 stdout / stderr と runtime log
4. NyanQL stdout / stderr と runtime log
5. PostgreSQL log
6. `audit_logs` の失敗イベント

## Readiness Smoke

```bash
./scripts/smoke-prod-readiness.sh
```

この script は本番 DB を初期化しない。`dev-reset-db.sh` は呼ばない。

確認内容:

- Node.js / npm 推奨 version
- `frontend/dist` の存在
- `npm audit --audit-level=high`
- `.env.production` または `.env.production.example` の必要項目
- NyanQL / Nyan8 実行ファイル
- Nginx 設定例
- README / docs の Phase 9 反映

## CI / 自動テスト

GitHub Actions CI は本番 DB、開発 DB、NyanQL / Nyan8 runtime を操作しない。CI lightweight checks として、frontend の `npm ci`, `npm audit --audit-level=high`, `npm run build`、shell script 構文チェック、Nyan8 / NyanQL 定義と実ファイルの整合チェック、production readiness static check を実行する。

CI 失敗時は、原因を修正して CI が成功してから `master` へ反映する。GitHub Actions の警告や runtime 更新がある場合は、workflow の `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24`、`actions/checkout`、`actions/setup-node` の更新可否を確認する。

local full smoke は開発者環境または専用検証環境で PostgreSQL、NyanQL、Nyan8 を起動して実行する。`dev-reset-db.sh` は開発 DB を初期化するため、GitHub Actions CI では実行しない。Phase 11 以降の大きな機能追加前や、DB / API / 状態遷移へ影響する変更前後では、local full smoke を順次実行して回帰を確認する。

本番デプロイ前は、frontend build 後に `./scripts/smoke-prod-readiness.sh` を実行する。この script も本番 DB を初期化せず、`.env.production.example` または `.env.production`、Nginx 設定例、runtime 実行ファイル、docs 反映状況を確認する。

## 今後の課題

- systemd / PM2 などによる常駐管理
- GitHub Actions による自動デプロイ
- Docker 化
- Kubernetes / Terraform
- 実ドメイン証明書発行
- CSRF token 本実装
- bcrypt / argon2 / pgcrypto への移行
- OAuth / SSO
- 多要素認証
- 本番 migration 管理
