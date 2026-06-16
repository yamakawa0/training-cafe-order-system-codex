# 07 Development Plan: 今後の開発計画

## 1. 現在地

現在は、初期 MVP を超えて以下が完了している。

- 注文〜キッチン〜ホール〜精算〜分析の基本業務フロー
- 境界条件 smoke
- メニュー管理
- 席・端末管理
- 注文管理
- 監査ログ
- 簡易ログイン
- ロール認可
- ユーザー管理
- session 有効期限・失効・inactive user 拒否
- 連続ログイン失敗ロック
- cookie 主方式と Bearer / token 互換方式
- npm audit 0 件化
- Node / npm 推奨環境整理
- Vite dev server 公開範囲整理
- 監査ログ CSV エクスポート
- 監査ログ検索条件強化
- before / after 表示改善
- 監査ログ運用方針整理
- 本番デプロイ準備
- GitHub Actions CI / 自動テスト

## 2. 完了済みフェーズ

### Phase 1: NyanQL / Nyan8 実行基盤

完了。

### Phase 2: 基本業務フロー

完了。

### Phase 2.5: 境界条件 smoke

完了。

### Phase 3: フロントエンド UI 整備

完了。

### Phase 4: 管理機能

完了範囲:

- メニュー管理
- 席・端末管理
- 注文管理

### Phase 5: 監査ログ

完了。

### Phase 6: 認証・ロール管理

完了。

### Phase 6.7: 依存関係・Node 環境・npm audit 整理

完了。

### Phase 7: 本番向け認証強化の土台

完了範囲:

- `cafe_session` cookie 主方式の整理
- Bearer / `token` 互換方式
- session 失効管理
- inactive user 拒否
- failed login lock
- auth audit log
- frontend localStorage token 保存廃止

残課題:

- Nyan8 制約を前提にしない実 HTTP header の httpOnly cookie 完全運用
- 本番向け password hash
- CSRF token
- OAuth / SSO
- 多要素認証

### Phase 8: 監査ログ運用強化

完了範囲:

- 監査ログ CSV エクスポート
- 監査ログ検索条件強化
- actor_user_id / actor_user_role filter
- target_label / keyword filter
- before / after 表示改善
- CSV 出力時の秘匿情報 mask
- admin_audit_logs_exported の audit log 記録
- smoke-audit-logs.sh 強化

残課題:

- ログ署名
- アーカイブ実装
- 外部監査連携
- 複数店舗別ログ分離

### Phase 9: 本番デプロイ準備

完了範囲:

- frontend/dist の静的配信方針
- Nginx / reverse proxy 設定例
- HTTPS 前提整理
- cookie / Bearer 互換の本番運用方針
- .env.production.example
- production 起動・停止・status script
- smoke-prod-readiness.sh
- DB backup / restore 手順
- ログ出力 / ローテーション方針
- docs/08_operations.md

## 3. 現在フェーズ

### Phase 10: CI / 自動テスト

目的:

- Codex 開発の回帰リスクを下げる。

主な作業:

- GitHub Actions workflow
- npm install / npm audit / npm run build
- production readiness smoke
- shell script 構文チェック
- SQL / API 定義整合チェック
- Nyan8 api.json と JavaScript file の存在チェック
- NyanQL api.json と SQL file の存在チェック
- README / docs の重要記述チェック

完了条件:

- GitHub Actions CI workflow
- frontend npm ci / npm audit / build
- shell script syntax check
- Nyan8 / NyanQL 定義整合チェック
- production readiness static check
- CI と local full smoke の役割分離

## 4. 次フェーズ

### Phase 11: 商品・在庫・オプション強化

目的:

- 店舗運用に近づける。

候補:

- 商品画像アップロード
- 商品オプション編集 UI
- 原価 / 粗利
- 在庫数
- 売切自動化
- カテゴリ管理 UI 強化

### Phase 12: 決済・返金・レシート

目的:

- 会計機能を強化する。

候補:

- 返金処理
- レシート再発行
- 支払い失敗
- 決済取消
- 実決済連携の設計

### Phase 13: 顧客・予約・複数店舗

目的:

- より大きな店舗システムへ拡張する。

候補:

- 顧客会員
- 予約
- 複数店舗
- 店舗別メニュー
- 店舗別権限
