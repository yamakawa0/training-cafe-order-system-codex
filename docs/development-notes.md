# Development Notes

実装中の設計判断、暫定対応、未解決事項をここに追記する。

## 2026-06-05 MVP 実装

- フロントエンドは React + Vite の TypeScript SPA として `frontend/` に新規作成した。
- NyanPUI は TypeScript SPA 方針と重複するため使用していない。
- WebSocket Push は Nyan8 の Push 実装方式が未確認のため、MVP では 5 秒間隔のポーリングで代替した。キッチン、ホール、顧客履歴で再取得する。
- Nyan8 から NyanQL を内部 HTTP 呼び出しする構成とし、顧客端末から NyanQL は直接呼ばない。
- 会計処理ではフロントエンドから金額を送らず、Nyan8 が NyanQL の精算明細から合計を再計算する。
- `customer_submit_order.js` ではメニュー価格とオプション価格を NyanQL から再取得して注文金額を算出する。

## 2026-06-05 MVP 安定化

- `schema.sql` に開発用の `DROP TABLE IF EXISTS ... CASCADE` を追加し、同じ DB へ再投入できるようにした。
- セッション開始時に席を `occupied` にし、片付け完了時にセッションを `closed`、席を `available` に戻す `complete_table_cleanup` API を追加した。
- 注文明細がすべて `served` または `cancelled` になった時点で、注文ヘッダの状態を `served` / `cancelled` に集約するようにした。精算時は注文ヘッダを `closed` にする。
- レジ精算は `payment_requested` のセッションだけを対象にし、精算済みセッションの再精算を拒否する。
- フロントエンドに loading、error、success、空データ表示、二重送信防止を追加した。
- Vite が 5173 から 5174 にフォールバックする開発環境を考慮し、Nyan8 CORS に `http://localhost:5174` を追加した。
