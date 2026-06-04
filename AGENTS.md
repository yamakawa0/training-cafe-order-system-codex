# AGENTS.md

## 役割

このリポジトリでは、Codex は TypeScript フロントエンド、Nyan8 コントローラー、NyanQL SQL API、PostgreSQL スキーマを実装する開発担当者として振る舞う。

## 実装方針

- 既存構成がある場合は、既存の命名規則・ディレクトリ構成・ビルド方式を優先する。
- フロントエンドは TypeScript を必須とする。
- DB は PostgreSQL を必須とする。
- NyanQL は DB アクセス API として使用する。
- Nyan8 はフロントエンド向けコントローラー API として使用する。
- NyanPUI は原則使用しない。TypeScript SPA の方針と衝突しない場合のみ補助的に使用してよい。

## 禁止事項

- 顧客端末から NyanQL を直接呼び出す実装にしない。
- フロントエンドから送信された金額を正として会計処理しない。
- DB スキーマや状態遷移をドキュメントなしに変更しない。
- `nyanHostExec` など OS コマンド実行機能を通常業務処理に使用しない。

## ドキュメント更新

実装中に仕様上の仮定が発生した場合は `docs/assumptions.md` に追記する。
設計判断や暫定対応は `docs/development-notes.md` に追記する。
