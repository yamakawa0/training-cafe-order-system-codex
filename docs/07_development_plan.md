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
- CI 実行確認と full smoke 回帰確認

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

### Phase 10: CI / 自動テスト

完了範囲:

- GitHub Actions CI workflow
- frontend npm ci / npm audit / build
- shell script syntax check
- Nyan8 api.json と JavaScript file の存在チェック
- NyanQL api.json と SQL file の存在チェック
- production readiness static check
- CI と local full smoke の役割分離
- CI 実リモート実行確認
- local full smoke 回帰確認
- README / docs の CI 記述

## 3. 現在フェーズ

### Phase 11: 商品・在庫・オプション強化

目的:

- 店舗運用に近づけるため、商品情報、オプション、在庫、売切管理を強化する。

完了済み:

- カテゴリ管理 UI 強化
- 商品オプション編集 UI
- 顧客注文画面のオプション選択
- オプション追加料金の会計・分析・CSV 反映
- 在庫数
- 在庫不足時の注文拒否
- 在庫 0 時の自動売切
- キャンセル時の在庫戻し
- 第3段階完了:
  - 商品画像 URL 管理
  - 管理画面の商品画像プレビュー
  - 顧客注文画面の商品画像表示改善
  - 画像 URL validation
- 第4段階完了:
  - 商品ごとの標準原価 `cost_price`
  - 注文時点の原価履歴 `unit_cost_price`
  - 管理画面の原価入力、粗利 / 粗利率、赤字警告
  - 分析サマリ、商品ランキング、売上 CSV、注文管理詳細への原価 / 粗利反映
  - 顧客 API への原価・粗利非公開
- 第5段階完了:
  - adjust-stock API
  - 在庫変動履歴 `inventory_movements`
  - 注文確定時の在庫引当履歴
  - キャンセル時の在庫戻し履歴
  - `/admin/menu` の在庫調整フォームと在庫履歴表示

残課題:

- 本格的な商品画像アップロード
- 画像リサイズ / 圧縮
- 画像 CDN / 外部 storage
- 仕入 / 入荷 / 棚卸
- 廃棄処理
- 原材料別原価 / レシピ原価 / 自動原価計算
- 日別原価履歴 / 原価改定予約
- 複数店舗別在庫
- カテゴリ管理の高度化

### Phase 11.5: Phase 11 整合確認

目的:

- Phase 11 第1〜第2段階の実装、docs、smoke、GitHub 反映状況を照合し、新機能追加前に状態を揃える。

確認済み:

- `master` と `origin/master` は一致しており、未 push commit はない。
- 作業ディレクトリと GitHub remote は `git@github.com:yamakawa0/training-cafe-order-system-codex.git` で一致している。
- Phase 11 第1段階のカテゴリ管理、商品オプション管理、顧客注文画面のオプション選択、オプション追加料金の注文・会計・分析・CSV 反映は実装と docs が一致している。
- Phase 11 第2段階の在庫数、在庫不足時の注文拒否、在庫 0 時の自動売切、キャンセル時の在庫戻し、低在庫 / 売切表示、在庫 audit log は実装と docs が一致している。
- `scripts/smoke-admin-menu.sh` はカテゴリ、オプション、在庫の Phase 11 第1〜第2段階を検証している。
- full smoke、frontend build、npm audit、CI static checks は成功している。

## 4. 次フェーズ

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
