#!/usr/bin/env python3
"""週次フィットネスレポート集計スクリプト。

daily-log/data.csv と plan-config.json を読み、指定週（既定は直近の月〜日）の
体重・摂取カロリー・PFC・トレーニングを集計し、weekly-report/YYYY-Www.md を生成する。

数値はすべて実測データからの決定的な計算のみで埋める（推測で埋めない）。
コーチフィードバックは末尾のプレースホルダに Claude / 本人が後から追記する。

使い方:
    python3 scripts/weekly_report.py                 # 直近の完了週（先週の月〜日）
    python3 scripts/weekly_report.py --week-end 2026-07-20   # 指定日を週末(日曜)として集計
    python3 scripts/weekly_report.py --stdout        # ファイル出力せず標準出力に表示
"""
from __future__ import annotations

import argparse
import csv
import json
import statistics
from datetime import date, datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_CSV = ROOT / "daily-log" / "data.csv"
PLAN_JSON = ROOT / "plan-config.json"
OUT_DIR = ROOT / "weekly-report"

NUM_FIELDS = ("weight_kg", "bodyfat_pct", "kcal", "protein_g", "fat_g", "carb_g")


def parse_num(v):
    v = (v or "").strip()
    if v == "":
        return None
    try:
        return float(v)
    except ValueError:
        return None


def load_rows():
    if not DATA_CSV.exists():
        raise SystemExit(f"データファイルがありません: {DATA_CSV}")
    rows = []
    with DATA_CSV.open(encoding="utf-8") as f:
        for r in csv.DictReader(f):
            d = (r.get("date") or "").strip()
            if not d:
                continue
            try:
                dt = datetime.strptime(d, "%Y-%m-%d").date()
            except ValueError:
                continue
            row = {"date": dt}
            for k in NUM_FIELDS:
                row[k] = parse_num(r.get(k))
            row["training"] = (r.get("training") or "").strip()
            row["note"] = (r.get("note") or "").strip()
            rows.append(row)
    rows.sort(key=lambda x: x["date"])
    return rows


def load_plan():
    if PLAN_JSON.exists():
        return json.loads(PLAN_JSON.read_text(encoding="utf-8"))
    return {}


def phase_for(plan, d: date):
    for ph in plan.get("phases", []):
        try:
            s = datetime.strptime(ph["start"], "%Y-%m-%d").date()
            e = datetime.strptime(ph["end"], "%Y-%m-%d").date()
        except (KeyError, ValueError):
            continue
        if s <= d <= e:
            return ph
    return None


def avg(values):
    vals = [v for v in values if v is not None]
    return statistics.mean(vals) if vals else None


def fmt(v, unit="", nd=1):
    if v is None:
        return "—"
    return f"{v:.{nd}f}{unit}"


def moving_avg_ending(rows, end: date, window=7):
    """end 以前 window 日以内の体重の平均（7日移動平均）。"""
    lo = end - timedelta(days=window - 1)
    vals = [r["weight_kg"] for r in rows if lo <= r["date"] <= end and r["weight_kg"] is not None]
    return statistics.mean(vals) if vals else None


def resolve_week(args, rows):
    if args.week_end:
        end = datetime.strptime(args.week_end, "%Y-%m-%d").date()
    else:
        # 直近の完了週: 今日を含む週の1つ前の週（月〜日）
        today = date.today()
        this_monday = today - timedelta(days=today.weekday())
        end = this_monday - timedelta(days=1)  # 先週の日曜
    # end を週末(日曜)とみなし、月曜を起点に
    start = end - timedelta(days=6)
    return start, end


def build_report(rows, plan, start: date, end: date):
    wk = [r for r in rows if start <= r["date"] <= end]
    iso = end.isocalendar()
    title = f"{iso[0]}-W{iso[1]:02d}"

    weights = [r["weight_kg"] for r in wk if r["weight_kg"] is not None]
    week_avg_w = avg(weights)
    ma_end = moving_avg_ending(rows, end)
    ma_prev = moving_avg_ending(rows, start - timedelta(days=1))
    delta_ma = (ma_end - ma_prev) if (ma_end is not None and ma_prev is not None) else None

    week_kcal = avg([r["kcal"] for r in wk])
    week_p = avg([r["protein_g"] for r in wk])
    week_f = avg([r["fat_g"] for r in wk])
    week_c = avg([r["carb_g"] for r in wk])

    ph = phase_for(plan, end)
    days_logged = len(wk)
    days_weight = len(weights)
    days_kcal = len([r for r in wk if r["kcal"] is not None])

    L = []
    L.append(f"# 週次レポート {title}（{start:%Y-%m-%d} 〜 {end:%Y-%m-%d}）")
    L.append("")
    L.append(f"- 記録日数: {days_logged}/7　体重 {days_weight}日 / 食事 {days_kcal}日")
    if ph:
        L.append(f"- フェーズ: {ph['name']}（目標 {ph.get('kcal') or '個別'}kcal）")
    L.append("")

    L.append("## 体重・体組成")
    L.append(f"- 週平均体重: {fmt(week_avg_w, 'kg', 2)}")
    L.append(f"- 7日移動平均（週末時点）: {fmt(ma_end, 'kg', 2)}")
    if delta_ma is not None:
        pace = ""
        pr = plan.get("pace_target_kg_per_week", {})
        if pr:
            lo, hi = pr.get("min"), pr.get("max")
            if lo is not None and hi is not None:
                if delta_ma < lo:
                    pace = "（目標より速い→カロリー戻し検討）"
                elif delta_ma > hi:
                    pace = "（目標より遅い→2週継続なら削減検討）"
                else:
                    pace = "（オンペース）"
        L.append(f"- 前週比（移動平均）: {fmt(delta_ma, 'kg', 2)}/週 {pace}")
    else:
        L.append("- 前週比（移動平均）: —（前週データ不足）")
    # 目標体重との差
    for wt in plan.get("weight_targets", []):
        try:
            td = datetime.strptime(wt["date"], "%Y-%m-%d").date()
        except (KeyError, ValueError):
            continue
        if start <= td <= end and ma_end is not None:
            diff = ma_end - wt["weight_kg"]
            L.append(f"- 週次目標 {wt['weight_kg']}kg（{td:%m/%d}）との差: {diff:+.2f}kg")
            break
    L.append("")

    L.append("## 栄養（週平均）")
    tgt = ph if ph else {}
    def line(label, val, key, unit="g"):
        t = tgt.get(key)
        if val is not None and t:
            return f"- {label}: {fmt(val, unit)} / 目標 {t}{unit}（{val - t:+.0f}{unit}）"
        return f"- {label}: {fmt(val, unit)}"
    L.append(line("カロリー", week_kcal, "kcal", "kcal"))
    L.append(line("タンパク質", week_p, "protein_g"))
    L.append(line("脂質", week_f, "fat_g"))
    L.append(line("炭水化物", week_c, "carb_g"))
    L.append("")

    L.append("## トレーニング")
    tr = [r for r in wk if r["training"]]
    if tr:
        for r in tr:
            L.append(f"- {r['date']:%m/%d}: {r['training']}")
    else:
        L.append("- 記録なし")
    L.append("")

    # 日次テーブル
    L.append("## 日次データ")
    L.append("| 日付 | 体重 | 体脂肪 | kcal | P | F | C |")
    L.append("|---|---|---|---|---|---|---|")
    for r in wk:
        L.append(
            f"| {r['date']:%m/%d} | {fmt(r['weight_kg'],'',1)} | {fmt(r['bodyfat_pct'],'%',1)} | "
            f"{fmt(r['kcal'],'',0)} | {fmt(r['protein_g'],'',0)} | {fmt(r['fat_g'],'',0)} | {fmt(r['carb_g'],'',0)} |"
        )
    L.append("")

    L.append("## コーチフィードバック")
    L.append("<!-- ここは Claude / 本人が上記の数値と体感メモを踏まえて追記する。数値の再掲だけでなく、"
             "調整ルール(plan-config.json)に照らした次週アクションを1〜3点。 -->")
    L.append("")
    return title, "\n".join(L)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--week-end", help="週末(日曜)の日付 YYYY-MM-DD")
    ap.add_argument("--stdout", action="store_true", help="ファイル出力せず標準出力")
    args = ap.parse_args()

    rows = load_rows()
    plan = load_plan()
    start, end = resolve_week(args, rows)
    title, report = build_report(rows, plan, start, end)

    if args.stdout:
        print(report)
        return
    OUT_DIR.mkdir(exist_ok=True)
    out = OUT_DIR / f"{title}.md"
    out.write_text(report, encoding="utf-8")
    print(f"生成: {out.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
