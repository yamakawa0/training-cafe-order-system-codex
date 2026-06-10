# カフェ注文・会計システム 今後の開発計画書

## 1. 現在の開発状況

本プロジェクトは、架空カフェ「カフェ・ルポ / Cafe Repos」向けの注文・会計システムである。

現在の基本構成は以下とする。

* フロントエンド: TypeScript / React / Vite
* Controller API: Nyan8
* SQL API: NyanQL
* Database: PostgreSQL
* フロントエンドは Nyan8 の `/api/*` のみを呼び出す
* NyanQL は Nyan8 から内部 API として呼び出す
* NyanPUI は採用しない

現在までに、以下の主要機能の土台は実装済みである。

* 顧客注文画面
* キッチン注文管理画面
* ホール指示画面
* レジ精算画面
* 分析画面
* PostgreSQL スキーマ
* seed データ
* NyanQL API 定義
* Nyan8 API 定義
* Nyan8 JavaScript Controller
* NyanQL/Nyan8 起動補助スクリプト
* smoke test 用スクリプト

直近では、顧客注文画面に商品が表示されない問題について、DB、NyanQL、Nyan8、フロントエンドの経路確認が行われ、`menu_items` から顧客注文画面までデータが届く経路の整備が進んでいる。

今後は、機能を大きく増やす前に、まず MVP として一連の業務フローが安定して動作する状態を作る。

---

## 2. 開発方針

今後の開発では、以下の順序を守る。

1. NyanQL/Nyan8 実ランタイムでの疎通を確実にする
2. 注文から分析までの E2E フローを安定させる
3. 画面上のエラー表示・空表示・二重送信防止を整える
4. 顧客・キッチン・ホール・レジ・分析の UI を実用レベルに近づける
5. テストと smoke script を増やす
6. 運用に必要な管理機能を追加する
7. 将来的な拡張機能を段階的に追加する

この段階では、在庫管理、会員管理、予約、実決済、複数店舗対応はまだ実装しない。

---

## 3. Phase 1: NyanQL/Nyan8 実ランタイム安定化

### 目的

NyanQL/Nyan8 を正式な実行環境として、DB から各画面までデータが正しく流れる状態を保証する。

### 作業内容

#### 3.1 起動手順の再確認

以下の手順が README 通りに実行できるか確認する。

```bash
./scripts/check-runtime.sh
./scripts/dev-reset-db.sh
./scripts/start-nyanql.sh
./scripts/smoke-nyanql.sh
./scripts/start-nyan8.sh
./scripts/smoke-e2e.sh
cd frontend
npm install
npm run build
npm run dev
```

複数ターミナルが必要な場合は、README の説明を現状に合わせて修正する。

#### 3.2 NyanQL API の全件確認

以下の NyanQL API が単体で動作することを確認する。

* menu
* session open/current
* order submit/history
* kitchen tickets
* item status update
* hall tasks
* hall task status update
* checkout summary
* checkout settle
* analytics summary
* analytics item ranking
* sales csv export

確認結果は `docs/development-notes.md` に記録する。

#### 3.3 Nyan8 API の全件確認

以下の Nyan8 API がフロントエンド期待形式で返ることを確認する。

* `GET /api/customer/menu`
* `POST /api/customer/session/open`
* `GET /api/customer/session/current`
* `POST /api/customer/order/submit`
* `GET /api/customer/order/history`
* `POST /api/customer/payment/request`
* `POST /api/customer/staff-call`
* `GET /api/kitchen/tickets`
* `POST /api/kitchen/item/status`
* `GET /api/hall/tasks`
* `POST /api/hall/task/status`
* `GET /api/checkout/summary`
* `POST /api/checkout/settle`
* `GET /api/analytics/summary`
* `GET /api/analytics/item-ranking`
* `GET /api/analytics/export-sales-csv`

#### 3.4 API レスポンス形式の統一

フロントエンド側で扱うレスポンス形式を以下に統一する。

```json
{
  "success": true,
  "status": 200,
  "result": {}
}
```

フロントエンドでは `result` を unwrap して利用する。

エラー時は以下の形式に統一する。

```json
{
  "success": false,
  "status": 400,
  "message": "エラー内容"
}
```

#### 3.5 GET リクエストの CORS 対応確認

GET リクエストでは不要な `Content-Type: application/json` を送らない。

特に以下を確認する。

* 顧客注文画面のメニュー取得
* キッチンチケット取得
* ホールタスク取得
* 分析サマリ取得

---

## 4. Phase 2: MVP 業務フロー完成

### 目的

注文、調理、配膳、会計、片付け、分析までを 1 回の操作シナリオとして通せる状態にする。

### 対象フロー

```txt
顧客注文
  -> 注文明細 ordered 作成
  -> キッチンで accepted
  -> キッチンで cooking
  -> キッチンで ready
  -> ホール配膳タスク作成
  -> ホールで doing
  -> ホールで done
  -> 注文明細 served
  -> 顧客が会計依頼
  -> レジで精算
  -> 片付けタスク作成
  -> ホールで片付け完了
  -> 席が available に戻る
  -> 分析に売上反映
```

### 作業内容

#### 4.1 smoke-e2e.sh の強化

`scripts/smoke-e2e.sh` を以下の観点で強化する。

* 各 API の HTTP ステータスを確認する
* レスポンス JSON の必須項目を確認する
* 注文番号、セッション ID、明細 ID、タスク ID をログ出力する
* 途中で失敗した場合、どのステップで失敗したか分かるようにする
* 片付け完了後に席状態が `available` に戻ったことを確認する
* 精算後に分析 API の売上が増えていることを確認する

#### 4.2 状態遷移の不正操作防止

以下の不正操作を API 側で拒否する。

* 会計依頼後の追加注文
* 精算済みセッションの再精算
* 存在しない明細の状態変更
* `ordered` から直接 `ready` などの不正遷移
* 完了済みホールタスクの再完了
* 片付け完了前に席を空席へ戻す操作
* 売切商品の注文

#### 4.3 トランザクション保証

以下の処理は DB トランザクションで実行する。

* 注文確定
* 注文明細ステータス更新
* 配膳タスク生成
* 配膳完了
* 会計依頼
* 精算確定
* 片付けタスク生成
* 片付け完了

#### 4.4 開発メモ更新

各フローの確認結果を `docs/development-notes.md` に記録する。

記録内容:

* 実施日
* 確認したフロー
* 使用した端末コード
* 成功した API
* 修正した不具合
* 未解決事項

---

## 5. Phase 3: フロントエンド品質改善

### 目的

各画面を実際の店舗端末で使える最低限の操作品質に引き上げる。

### 共通改善

全画面で以下を実装・確認する。

* loading 表示
* API エラー表示
* 空データ表示
* 成功メッセージ
* 二重送信防止
* disabled 状態
* 操作後の自動再取得
* 5 秒ポーリングの安定動作
* 画面サイズごとの崩れ確認
* 操作ボタンの押しやすさ改善
* ステータスバッジの統一
* 金額表示の統一
* 日時表示の統一

### 顧客注文画面

優先改善:

* カテゴリタブを見やすくする
* 商品カードを UI デザイン案に近づける
* カート内数量変更を `+` / `-` ボタンにする
* 必須オプションの自動選択だけでなく、選択 UI を表示する
* 任意オプションを選べるようにする
* 商品詳細モーダルを追加する
* 売切商品の表示を明確にする
* 会計依頼後は注文操作を明確にロックする
* 注文履歴に商品名、数量、状態を表示する

### キッチン注文管理画面

優先改善:

* `ordered`, `accepted`, `cooking`, `ready` の列表示
* 経過時間の表示
* 急ぎ・アレルギー・メモの強調
* 状態変更ボタンの明確化
* 調理完了時にホールへ渡ることが分かる表示
* キッチン端末で使いやすい大きめ UI

### ホール指示画面

優先改善:

* 配膳タスク、片付けタスク、スタッフ呼び出しタスクの分類
* 優先度表示
* テーブル番号の強調
* `todo`, `doing`, `done` の状態変更
* 完了済みタスクの表示制御
* フロアマップの簡易表示

### レジ精算画面

優先改善:

* テーブル選択 UI
* 精算対象セッションの明細表示
* 小計、税、合計の明確化
* 支払い方法選択
* 精算完了後のレシート番号表示
* 精算済み・未会計・会計依頼前の状態表示

### 分析画面

優先改善:

* 本日売上
* 注文件数
* 客数
* 平均客単価
* 商品ランキング
* 支払い方法別集計
* 時間帯別売上
* CSV エクスポート
* 日付範囲選択

---

## 6. Phase 4: データモデルと SQL の整理

### 目的

今後の機能追加に耐えられるよう、DB スキーマと SQL を整理する。

### 作業内容

#### 6.1 ID・コード体系の整理

以下の命名と用途を明確にする。

* `id`
* `code`
* `table_code`
* `terminal_code`
* `order_no`
* `receipt_no`

#### 6.2 状態値の整理

以下の状態値をドキュメント化する。

* `cafe_tables.status`
* `table_sessions.status`
* `orders.status`
* `order_items.status`
* `hall_tasks.status`
* `payments.status`

#### 6.3 SQL ファイルの整理

SQL を機能別に整理する。

```txt
backend/nyanql/sql/customer/
backend/nyanql/sql/kitchen/
backend/nyanql/sql/hall/
backend/nyanql/sql/checkout/
backend/nyanql/sql/analytics/
backend/nyanql/sql/admin/
```

ただし、NyanQL の `api.json` とのパス整合性を壊さないように段階的に行う。

#### 6.4 インデックス確認

以下の検索に必要なインデックスを確認する。

* セッションの現在状態取得
* テーブルコード検索
* 端末コード検索
* 注文明細の状態検索
* ホールタスクの状態検索
* 精算対象セッション検索
* 分析期間検索

---

## 7. Phase 5: テスト・検証体制の整備

### 目的

Codex による継続開発で壊れた箇所を早期に検出できるようにする。

### 作業内容

#### 7.1 smoke scripts の拡充

以下のスクリプトを整備する。

```txt
scripts/smoke-runtime.sh
scripts/smoke-menu.sh
scripts/smoke-order.sh
scripts/smoke-kitchen.sh
scripts/smoke-hall.sh
scripts/smoke-checkout.sh
scripts/smoke-analytics.sh
scripts/smoke-e2e.sh
```

#### 7.2 フロントエンドビルド確認

以下を必須確認にする。

```bash
cd frontend
npm run build
```

#### 7.3 型定義の整理

API レスポンス型を以下に整理する。

```txt
frontend/src/domain/types.ts
frontend/src/api/cafeApi.ts
```

必要に応じて、API ごとのレスポンス型を追加する。

#### 7.4 手動テスト項目の作成

`docs/manual-test-checklist.md` を作成する。

内容:

* 顧客注文画面
* キッチン画面
* ホール画面
* レジ画面
* 分析画面
* 異常系
* 画面更新
* 端末別操作

---

## 8. Phase 6: 管理機能の追加

### 目的

MVP の業務フローが安定した後、店舗運用に必要な管理機能を追加する。

### 優先度 高

#### 8.1 メニュー管理

* 商品一覧
* 商品追加
* 商品編集
* 商品非表示
* 売切切り替え
* カテゴリ並び替え
* オプション設定

#### 8.2 席・端末管理

* 席一覧
* 席状態確認
* 端末コード確認
* 端末と席の紐付け
* 強制セッション終了

#### 8.3 注文管理

* 注文一覧
* 注文明細確認
* 注文キャンセル
* 明細キャンセル
* 返金対象フラグ

### 優先度 中

#### 8.4 売上 CSV 強化

* 日別売上
* 商品別売上
* 支払い方法別売上
* 注文履歴 CSV
* 精算履歴 CSV

#### 8.5 簡易権限

* 顧客端末
* キッチン端末
* ホール端末
* レジ端末
* 店長 PC

MVP ではログイン機能までは作らず、端末コードによる簡易権限でよい。

---

## 9. Phase 7: UI デザイン反映

### 目的

前回作成した UI デザイン案に近づけ、実店舗端末として自然に見える状態にする。

### 共通デザイン方針

* 店舗名: カフェ・ルポ / Cafe Repos
* 色: クリーム、ベージュ、ダークブラウン、muted green、アクセントオレンジ
* 角丸カード
* 大きめボタン
* タブレット操作を前提にした余白
* 状態ごとのバッジ色を統一
* 画面上部に端末・席・時刻・ステータスを表示

### 実装方針

CSS を以下に整理する。

```txt
frontend/src/styles/global.css
frontend/src/styles/layout.css
frontend/src/styles/components.css
frontend/src/styles/pages.css
```

または、既存構成に合わせて画面別 CSS を整理する。

優先順位:

1. 顧客注文画面
2. キッチン注文管理画面
3. ホール指示画面
4. レジ精算画面
5. 分析画面

---

## 10. Phase 8: 将来拡張

MVP 完成後に検討する。

### 候補

* WebSocket または Server-Sent Events によるリアルタイム更新
* 在庫管理
* 商品別原価管理
* 会員・ポイント
* クーポン
* 予約
* 複数店舗
* 実決済連携
* レシート印刷
* キッチンプリンタ連携
* スタッフログイン
* 操作ログ
* 監査ログ
* データバックアップ
* 本番デプロイ手順

---

## 11. Codex への次回指示方針

直近で Codex に指示するべき作業は、以下の順番とする。

### 次回指示 1: E2E フローの完全確認

目的:

* `smoke-e2e.sh` を実ランタイムで最後まで通す
* 失敗箇所を修正する
* 結果を `docs/development-notes.md` に記録する

### 次回指示 2: フロントエンド画面の操作性改善

目的:

* 顧客注文画面のカート、オプション選択、注文履歴を改善する
* キッチン・ホール・レジの状態表示を分かりやすくする
* エラー・空表示・成功表示を統一する

### 次回指示 3: テストスクリプト分割

目的:

* menu/order/kitchen/hall/checkout/analytics 単位で smoke script を分ける
* E2E 失敗時の原因切り分けを容易にする

### 次回指示 4: 管理機能の設計

目的:

* メニュー管理、席管理、注文管理の仕様書を追加する
* 実装は MVP 安定後に行う

---

## 12. 直近の完了条件

次の状態になったら MVP 第1段階完了とする。

* NyanQL が起動できる
* Nyan8 が起動できる
* PostgreSQL 初期化ができる
* 顧客注文画面に商品が表示される
* 商品をカートに追加できる
* 注文確定できる
* キッチン画面で注文を進行できる
* ホール画面で配膳タスクを完了できる
* 顧客画面で会計依頼できる
* レジ画面で精算できる
* ホール画面で片付けタスクを完了できる
* 席状態が空席に戻る
* 分析画面に売上が反映される
* `scripts/smoke-menu.sh` が成功する
* `scripts/smoke-e2e.sh` が成功する
* `cd frontend && npm run build` が成功する
* README と development-notes が現状と一致している
