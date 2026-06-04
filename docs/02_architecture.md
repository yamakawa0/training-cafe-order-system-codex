# 02 Architecture

## 採用構成

```txt
[TypeScript SPA]
   |
   | HTTP / WebSocket
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

## 採用理由

- TypeScript SPA により、店内端末ごとの操作 UI を柔軟に作る。
- Nyan8 は公開 API 層として、端末種別検証・入力検証・状態遷移制御を担当する。
- NyanQL は PostgreSQL への SQL API を担当する。
- NyanPUI はサーバーサイド HTML レンダリング寄りのため、今回の TypeScript SPA 方針では原則不採用とする。

## ポート例

- Frontend dev server: `5173`
- Nyan8: `8889`
- NyanQL: `8890` または内部専用ポート
- PostgreSQL: `5432`

## 配置方針

開発環境では各プロセスを個別起動する。本番相当では Nginx 等を前段に置き、顧客端末から見えるのはフロントエンドと Nyan8 のみとする。
