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

## 3. 次フェーズ

### Phase 8: 監査ログ運用強化

目的:

- 監査ログを運用で使いやすくする。

主な作業:

- 監査ログ CSV エクスポート
- 保持期間設計
- アーカイブ方針
- ログ検索性改善
- 重要操作の before / after 強化
- ログ改ざん検知の検討

### Phase 9: 本番デプロイ準備

目的:

- 本番相当環境で安全に動かす。

主な作業:

- 静的 build 配信
- Nginx / reverse proxy 想定設定
- HTTPS 前提整理
- 実 `Set-Cookie` header / cookie 受信 header の運用方針
- 環境変数 / secret 管理
- DB バックアップ方針
- 起動・停止手順
- ログ出力方針

### Phase 10: CI / 自動テスト

目的:

- Codex 開発の回帰リスクを下げる。

主な作業:

- npm install / build
- npm audit
- smoke script 実行
- SQL schema 検証
- API 定義と script / SQL の存在チェック
- GitHub Actions などの導入検討

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
