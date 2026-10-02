# Obsidian × Claude 運用セット（iPhone で記録 → Mac で整理）

## ファイル

| ファイル | 置き場所（Vault 内） |
|---|---|
| `vault-CLAUDE.md` | Vault ルートに **`CLAUDE.md` にリネーム**して置く |
| `claude-inbox-template.md` | `_templates/claude-inbox.md` |

## 初期設定（Mac で1回だけ）

1. Vault に `00_Inbox/` と `_templates/` を作る（他のフォルダは `CLAUDE.md` の構成を実態に合わせて修正）。
2. 上の2ファイルを配置。
3. Obsidian 設定 → コアプラグイン「テンプレート」を ON → テンプレートフォルダを `_templates` に。
4. 設定 → ファイルとリンク → 新規ノートの作成場所を `00_Inbox` に（iPhone 側にも反映される）。

## iPhone 側（Claude アプリ）

Claude アプリの 設定 → プロフィール（個人設定）に以下を追記しておくと、毎回の指示が不要になる：

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
```

使い方：
1. 「〇〇についてまとめて。Obsidian用」と頼む
2. コードブロックのコピーボタン → Obsidian で `00_Inbox` に新規ノート → 貼り付け
   （frontmatter ごと貼るので、テンプレート挿入は不要。手書きメモのときだけテンプレートを使う）

## Mac 側（Claude Code）

1. iCloud の同期完了を確認（Finder で雲アイコンが消えている）
2. Vault フォルダで Claude Code を開く（Desktop アプリでフォルダ指定、または `cd <Vault> && claude`）
3. 「**Inbox を整理して**」とだけ言う → `CLAUDE.md` のルールで整形・分類・リンク付けして報告が返る

Vault パス（iCloud）の例：
`~/Library/Mobile Documents/iCloud~md~obsidian/Documents/<Vault名>`
