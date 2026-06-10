# Assumptions

初期作成時点の仮定:

- 架空カフェは 1 店舗のみ。
- 実決済連携は行わず、支払い方法の記録だけを行う。
- 商品価格は税込表示ではなく、税率から DB / バックエンド側で計算する。
- 顧客端末は席に固定され、端末コードにより席を判定する。
- 在庫管理は MVP 外とし、売り切れフラグのみ扱う。
- NyanQL / Nyan8 の実行バイナリとサンプルが同梱されていないため、`api.json` と JavaScript コントローラーは一般的な HTTP API ランタイムを前提に配置する。
- 顧客注文画面の必須オプションは、初期選択として先頭の選択肢を自動選択する。詳細なオプション UI は今後拡張する。
- 消費税は明細ごとに `tax_rate` を使って四捨五入し、精算時にも DB 取得明細から再計算する。
- 開発用の席状態は `available` / `occupied` を使用し、精算後の片付け完了で `available` に戻す。
- レジ精算は顧客が会計依頼した `payment_requested` セッションだけを対象にする。
- Nyan8 のAPIキー `api/customer/menu` は実行時URL `/api/customer/menu` として公開される前提で構成する。
- Nyan8 から NyanQL への Basic 認証付き呼び出しは、開発用に `http://user:password@host:port` 形式の URL を使う。
- キャンセルは MVP では `ordered`, `accepted`, `cooking` の注文明細だけ許可する。`ready` 以降のキャンセルは、配膳タスクとの整合性を優先して拒否する。
- 一部キャンセルの場合、会計対象は `cancelled` 以外の明細だけとする。提供済み明細とキャンセル明細が混在する注文は、提供済み明細がすべて `served` であれば注文ヘッダを `served` とする。
- 全明細が `cancelled` の場合、注文ヘッダは `cancelled` とする。
- キャンセル明細は会計金額、売上分析、商品ランキングに含めない。
- CSV エクスポート API は Nyan8 ランタイムの戻り値 parse 制約により CSV 本文を直接返さず、`success/status/result` の JSON 内に `contentType`, `filename`, `csv` を返す。フロントエンドが `csv` を Blob 化してダウンロードする。
- Nyan8 の業務エラーは `success:false`, `status`, `message`, `result:null` を返す。実ランタイムでは JSON 内の `status` が HTTP ステータスにも反映されることを確認済み。
