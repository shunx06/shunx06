# iPhoneで日次入力を自動化する（体重・カロリー・PFC・トレ）

「体重 + MyFitnessPal + トレ一言」の手入力をなくすための設定。
**Apple ヘルスケアをハブ**にして、iPhoneの「ショートカット」からGitHubへ送る。

```
Eufy Life ─┐
           ├─▶ Apple ヘルスケア ─▶ ショートカット ─▶ GitHub(inbox/) ─▶ data.csv(自動取込)
MyFitnessPal ┘
```

---

## ステップ1: 各アプリ → Apple ヘルスケア連携（設定のみ・1回だけ）

- **Eufy Life**: アプリ設定 → Apple ヘルスケア連携をON（体重・体脂肪率を書き込み許可）。
- **MyFitnessPal**: アプリ → その他 → アプリとデバイス → Apple ヘルスケアを接続（カロリー・炭水化物・脂質・タンパク質の書き込みを許可）。

これで体重・体脂肪・摂取カロリー・PFCは**毎日自動でヘルスケアに集約**される。

## ステップ2: GitHub の Personal Access Token（PAT）を作る（1回だけ）

1. GitHub → Settings → Developer settings → **Fine-grained personal access tokens** → Generate new token
2. Repository access: **`shunx06/shunx06` のみ**
3. Permissions → Repository permissions → **Contents: Read and write**（これだけ）
4. 生成されたトークン（`github_pat_...`）を控える。ショートカットに貼る。

> スコープは最小（このリポジトリのContentsのみ）。漏洩時の影響を限定するため他権限は付けない。

## ステップ3: ショートカットを作る

iPhoneの「ショートカット」アプリで新規作成。以下のアクションを順に追加。

**A. ヘルスケアから当日値を取得**（各項目を「ヘルスサンプルを検索」で本日分）
- 体重（`Weight`／体重）: 並べ替え=開始日/降順, 上限=1 → 変数 `W`
- 体脂肪率（`Body Fat Percentage`）: 同上 → 変数 `BF`
- 摂取エネルギー（`Dietary Energy`）: 本日分すべて → 「統計を計算」=合計 → `KCAL`
- タンパク質（`Protein`）: 本日合計 → `P`
- 脂質（`Total Fat`）: 本日合計 → `F`
- 炭水化物（`Carbohydrates`）: 本日合計 → `C`

**B. トレ内容を入力**（任意）
- 「入力を要求」テキスト: 質問「今日のトレは？」→ `TR`
  （背面タップや手動起動時に1行だけ入力。空でもOK）

**C. CSV行を組み立て**
- 「テキスト」アクションに次を入力（`日付`は「現在の日付」をyyyy-MM-dd書式に）:
  ```
  ⟨日付 yyyy-MM-dd⟩,⟨W⟩,⟨BF⟩,⟨KCAL⟩,⟨P⟩,⟨F⟩,⟨C⟩,⟨TR⟩,
  ```
  ※列順は data.csv と同じ: `date,weight_kg,bodyfat_pct,kcal,protein_g,fat_g,carb_g,training,note`

**D. GitHubへ送信**
- 「テキストをBase64エンコード」→ `B64`
- 「辞書」アクション:
  - `message` = `daily log`
  - `content` = `B64`
  - `branch` = `claude/weekly-fitness-report-auto-ewcf05`
- 「URLの内容を取得」:
  - URL: `https://api.github.com/repos/shunx06/shunx06/contents/inbox/⟨現在の日付 yyyy-MM-dd-HHmmss⟩.csv`
  - 方法: **PUT**
  - ヘッダ: `Authorization` = `Bearer github_pat_...`、`Accept` = `application/vnd.github+json`
  - 要求本文: **JSON** = 上の辞書

**E. 起動方法（どちらか）**
- **手動**: ホーム画面にアイコン追加 or 背面タップに割当 → 1日1回タップ（トレも入力できる）。
- **自動**: 「オートメーション」→ 毎日23:00 →「即時実行」ON（トレ入力は空になるので、トレは別途 Apple Fitness に記録 or 手動起動時のみ入力）。

## ステップ4: 取り込み（リポジトリ側・設定済み）

`scripts/ingest_inbox.py` が `inbox/*.csv` を `daily-log/data.csv` に upsert（日付キー・フィールド単位マージ）し、取り込んだファイルを削除する。
週次Routine（日曜21:00）が集計前に自動実行するので、**あなたの操作はステップ3のタップ（or 自動実行）だけ**。

---

## どこまで自動になるか

| 項目 | 自動度 |
|---|---|
| 体重・体脂肪 | ✅ 完全自動（Eufy→ヘルスケア→取得） |
| カロリー・PFC | ✅ 完全自動（MFP→ヘルスケア→取得） |
| トレ内容 | △ 1タップ入力 or Apple Fitness連携（背景自動実行では空になりうる） |
| GitHub送信・取込・週次レポート | ✅ 完全自動 |

## 完全ハンズオフにしたい場合（任意・有料アプリ）

- **Health Auto Export – JSON/CSV**（App Store）: ヘルスケアのデータを毎日バックグラウンドで自動POSTできる。POST先を GitHub Actions（`repository_dispatch`）にすれば、タップ不要でdata.csvまで自動更新できる。必要なら Actions ワークフローも用意する。
