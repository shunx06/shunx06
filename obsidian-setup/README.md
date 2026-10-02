# Obsidian × Claude 運用セット（iPhone で記録 → Mac で整理）

Vault: `iCloud Drive/Obsidian/shun_mac01`

## ファイル

| ファイル | 使い方 |
|---|---|
| `CLAUDE-inbox-section.md` | Vault の既存 `CLAUDE.md` の**末尾に追記**する（置き換えない） |
| `claude-inbox-template.md` | `Templates/Claude Inbox.md` として置く |

## 初期設定（Mac で1回だけ）

1. Vault 直下に `Inbox/` フォルダを作る。
2. `CLAUDE-inbox-section.md` の中身を Vault の `CLAUDE.md` 末尾に貼る。
   （または Mac の Claude Code に「このファイルの内容を CLAUDE.md の末尾に追記して」と渡す）
3. `claude-inbox-template.md` を `Templates/Claude Inbox.md` として置く。
4. Obsidian 設定 → ファイルとリンク → 新規ノートの作成場所 → `Inbox` に。
5. （任意）`無題のフォルダ` が空なら削除しておく。

## iPhone 側（Claude アプリ）

Claude アプリの 設定 → プロフィール（個人設定）に以下を追記：

```text
「Obsidian用」と言ったら、回答を1つのMarkdownコードブロックで出力する。
先頭に以下のfrontmatterを付ける（createdは今日の日付）:
---
created: YYYY-MM-DD
source: claude-iphone
status: inbox
tags: [inbox]
---
続けて「# タイトル」を1つだけ置き、前置き・締めの文は入れない。
論文メモの場合は、筆頭著者・雑誌名・発刊年・PMID/DOIを必ず本文に含める。
```

使い方：
1. 「〇〇をまとめて。Obsidian用」と頼む
2. コードブロックのコピーボタン → Obsidian で新規ノート（自動で `Inbox` に作られる）→ 貼り付け

## Mac 側（Claude Code）

1. iCloud の同期完了を確認（Finder で雲アイコンが消えている）
2. Vault フォルダで Claude Code を開く
   `cd ~/Library/Mobile\ Documents/iCloud~md~obsidian/Documents/shun_mac01 && claude`
3. 「**Inbox を整理して**」と言う → 整形・振り分け・リンク付けして報告が返る
