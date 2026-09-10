#!/usr/bin/env python3
"""inbox/ に届いた日次データを daily-log/data.csv に取り込む。

iPhone のショートカットが GitHub API で inbox/*.csv を作成する想定。
各 inbox ファイルは data.csv と同じ列順（ヘッダ無し）の1行以上：
    date,weight_kg,bodyfat_pct,kcal,protein_g,fat_g,carb_g,training,note

取り込みルール:
- date をキーに data.csv へ upsert（同一日付の行を更新、無ければ追加）。
- フィールド単位マージ: 入力側が非空の列だけ上書き、空欄は既存値を保持
  （体重だけの自動実行が、別途入れたトレ内容を消さないため）。
- 取り込んだ inbox ファイルは削除する（呼び出し側で git add -A してコミット）。

使い方:
    python3 scripts/ingest_inbox.py            # inbox を取り込み、data.csv を更新
    python3 scripts/ingest_inbox.py --dry-run  # 変更内容を表示するだけ
"""
from __future__ import annotations

import argparse
import csv
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_CSV = ROOT / "daily-log" / "data.csv"
INBOX = ROOT / "inbox"
HEADER = ["date", "weight_kg", "bodyfat_pct", "kcal",
          "protein_g", "fat_g", "carb_g", "training", "note"]
NCOL = len(HEADER)


def valid_date(s: str) -> bool:
    try:
        datetime.strptime(s.strip(), "%Y-%m-%d")
        return True
    except ValueError:
        return False


def load_data():
    rows = {}
    if DATA_CSV.exists():
        with DATA_CSV.open(encoding="utf-8") as f:
            reader = csv.reader(f)
            header = next(reader, None)
            for r in reader:
                if not r or not r[0].strip():
                    continue
                r = (r + [""] * NCOL)[:NCOL]
                rows[r[0].strip()] = r
    return rows


def collect_inbox():
    """inbox の全 .csv を名前順（=時刻順）に読み、[(row, path)] を返す。"""
    items = []
    if not INBOX.exists():
        return items
    for p in sorted(INBOX.glob("*.csv")):
        with p.open(encoding="utf-8") as f:
            for r in csv.reader(f):
                if not r or not r[0].strip():
                    continue
                # 先頭がヘッダ行なら無視
                if r[0].strip().lower() == "date":
                    continue
                if not valid_date(r[0]):
                    continue
                items.append(((r + [""] * NCOL)[:NCOL], p))
    return items


def merge(existing, incoming):
    """フィールド単位マージ: incoming が非空の列だけ上書き。"""
    out = list(existing)
    for i in range(NCOL):
        v = (incoming[i] or "").strip()
        if v != "":
            out[i] = v
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    data = load_data()
    inbox = collect_inbox()
    if not inbox:
        print("inbox に取り込むデータはありません。")
        return

    touched_dates = []
    used_files = set()
    for row, path in inbox:
        d = row[0].strip()
        row[0] = d
        if d in data:
            data[d] = merge(data[d], row)
        else:
            data[d] = merge([""] * NCOL, row)
            data[d][0] = d
        touched_dates.append(d)
        used_files.add(path)

    ordered = [data[k] for k in sorted(data.keys())]

    if args.dry_run:
        print(f"[dry-run] 取り込み対象日付: {sorted(set(touched_dates))}")
        for r in ordered:
            if r[0] in touched_dates:
                print("  " + ",".join(r))
        return

    with DATA_CSV.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(HEADER)
        w.writerows(ordered)

    for p in used_files:
        p.unlink()

    print(f"取り込み完了: {len(set(touched_dates))}日分 → daily-log/data.csv")
    print(f"更新日付: {sorted(set(touched_dates))}")


if __name__ == "__main__":
    main()
