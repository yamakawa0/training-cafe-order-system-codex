# Development Notes

実装中の設計判断、暫定対応、未解決事項をここに追記する。

## 2026-06-05 MVP 実装

- フロントエンドは React + Vite の TypeScript SPA として `frontend/` に新規作成した。
- NyanPUI は TypeScript SPA 方針と重複するため使用していない。
- WebSocket Push は Nyan8 の Push 実装方式が未確認のため、MVP では 5 秒間隔のポーリングで代替した。キッチン、ホール、顧客履歴で再取得する。
- Nyan8 から NyanQL を内部 HTTP 呼び出しする構成とし、顧客端末から NyanQL は直接呼ばない。
- 会計処理ではフロントエンドから金額を送らず、Nyan8 が NyanQL の精算明細から合計を再計算する。
- `customer_submit_order.js` ではメニュー価格とオプション価格を NyanQL から再取得して注文金額を算出する。
