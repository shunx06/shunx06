# 週次フィットネスレポート（自動）

摂取カロリー・体重・トレーニングを週次で自動集計する仕組み。

## データの流れ

```
毎日: iPhoneショートカットが Apple ヘルスケア(体重/体脂肪/kcal/PFC)を読み
      GitHub の inbox/ にCSV行を送信（詳細は iphone-input-setup.md）
週次: scripts/ingest_inbox.py が inbox/ を data.csv に取り込み
   └→ scripts/weekly_report.py が data.csv + plan-config.json を集計
   └→ weekly-report/YYYY-Www.md を生成 → Claude がコーチフィードバックを追記
```

手入力する場合は「体重 + MyFitnessPalスクショ + トレ一言」を Claude に投げれば data.csv に追記される（iPhone自動化との併用可）。

## 数値の唯一の正 = `daily-log/data.csv`

| 列 | 内容 |
|---|---|
| date | YYYY-MM-DD |
| weight_kg | 体重（Eufy） |
| bodyfat_pct | 体脂肪率（Eufy/BIA） |
| kcal / protein_g / fat_g / carb_g | MyFitnessPal の摂取量 |
| training | トレーニング内容（自由記述） |
| note | 体感・メモ |

欠損セルは空欄でよい（集計側で除外）。markdown の daily-log は体感・詳細メモ用に併用。

## 集計スクリプト

```bash
python3 scripts/weekly_report.py                    # 直近の完了週（先週 月〜日）
python3 scripts/weekly_report.py --week-end 2026-07-20   # 指定日を週末(日)として集計
python3 scripts/weekly_report.py --stdout           # 標準出力（ファイル生成しない）
```

- 体重は **7日移動平均** と前週比、`plan-config.json` の週次目標との差を算出。
- 栄養はフェーズ目標（`plan-config.json`）との差分。
- 数値は実測データからの決定的計算のみ。**推測では埋めない**（コーチフィードバックのみ後追記）。

## 自動実行

Claude Code（web）の Routine（定期実行）で週1回発火 → スクリプト実行 → コーチフィードバック追記 → コミット。
プラン（フェーズ日程・カロリー・週次体重目標）を変えたら **`plan-config.json` と `plan.md` の両方**を同期する。
