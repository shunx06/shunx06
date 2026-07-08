/* app.js — フォーム入力 → recommend() → 結果描画 */

(function () {
  const form = document.getElementById('profile-form');
  const resultsEl = document.getElementById('results');
  const resetBtn = document.getElementById('reset-btn');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    const profile = readProfile();
    const result = recommend(profile);
    render(result, profile);
    resultsEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  resetBtn.addEventListener('click', function () {
    form.reset();
    resultsEl.className = 'results-empty';
    resultsEl.innerHTML = '左のプロファイルを入力し「推奨を表示」を押してください。';
  });

  function readProfile() {
    const fd = new FormData(form);
    const ageRaw = fd.get('age');
    return {
      ps: fd.get('ps'),
      organ: fd.get('organ'),
      age: ageRaw ? Number(ageRaw) : null,
      ras: fd.get('ras'),
      braf: fd.get('braf'),
      msi: fd.get('msi'),
      her2: fd.get('her2'),
      krasG12C: fd.get('krasG12C'),
      side: fd.get('side'),
      goal: fd.get('goal'),
      ugt1a1: fd.get('ugt1a1'),
      priorOxaliplatin: fd.get('priorOxaliplatin') === 'on',
      priorIrinotecan: fd.get('priorIrinotecan') === 'on',
      priorBev: fd.get('priorBev') === 'on',
      priorEgfr: fd.get('priorEgfr') === 'on',
      priorIo: fd.get('priorIo') === 'on',
    };
  }

  function render(result, profile) {
    resultsEl.className = '';
    const parts = [];

    parts.push(`<div class="print-actions"><button type="button" onclick="window.print()">印刷 / PDF保存</button></div>`);

    // フラグ
    if (result.flags && result.flags.length) {
      parts.push('<div class="result-block">');
      result.flags.forEach((f) => {
        parts.push(`<div class="flag ${esc(f.level)}">${esc(f.text)}</div>`);
      });
      parts.push('</div>');
    }

    // 一次治療
    parts.push('<div class="result-block"><h3>推奨レジメン（一次治療）</h3>');
    result.firstLine.forEach((rec, i) => {
      parts.push(recCard(rec, i === 0));
    });
    parts.push('</div>');

    // 後続ライン
    if (result.sequence && result.sequence.length) {
      parts.push('<div class="result-block"><h3>後続ラインの治療戦略</h3>');
      result.sequence.forEach((s) => {
        parts.push('<div class="seq-item">');
        parts.push(`<div class="seq-line">${esc(s.line)}</div>`);
        if (s.note) parts.push(`<div class="seq-note">${esc(s.note)}</div>`);
        if (s.options && s.options.length) {
          parts.push('<ul>');
          s.options.forEach((o) => parts.push(`<li>${esc(o)}</li>`));
          parts.push('</ul>');
        }
        parts.push('</div>');
      });
      parts.push('</div>');
    }

    // 必要検査
    const t = result.tests;
    parts.push('<div class="result-block"><h3>推奨・必要な検査</h3>');

    parts.push('<h4 style="margin:4px 0 6px;font-size:.9rem;">バイオマーカー（治療方針の分岐）</h4>');
    parts.push('<table class="tests"><thead><tr><th>検査</th><th>状態</th><th>意義</th></tr></thead><tbody>');
    t.biomarker.forEach((b) => {
      const done = b.status !== '未検査';
      const pill = `<span class="status-pill ${done ? 'done' : 'todo'}">${esc(b.status)}</span>`;
      parts.push(`<tr><td>${esc(b.name)}</td><td>${pill}</td><td>${esc(b.why)}</td></tr>`);
    });
    parts.push('</tbody></table>');

    parts.push('<h4 style="margin:14px 0 6px;font-size:.9rem;">治療開始前のベースライン評価</h4>');
    parts.push('<table class="tests"><tbody>');
    t.baseline.forEach((b) => {
      parts.push(`<tr><td style="width:42%">${esc(b.name)}</td><td>${esc(b.why)}</td></tr>`);
    });
    parts.push('</tbody></table>');

    parts.push('<h4 style="margin:14px 0 6px;font-size:.9rem;">治療中のモニタリング（提示レジメン関連）</h4>');
    parts.push('<ul class="mon-list">');
    t.monitoring.forEach((m) => {
      parts.push(`<li><b>${esc(m.name)}:</b> ${esc(m.text)}</li>`);
    });
    parts.push('</ul>');

    parts.push('</div>');

    // プロファイル要約（記録用）
    parts.push(profileSummary(profile));

    resultsEl.innerHTML = parts.join('');
  }

  function recCard(rec, isPrimary) {
    const r = rec.regimen;
    const rows = [];
    rows.push(`<div class="rec-card ${isPrimary ? 'primary-rec' : ''}">`);
    rows.push(`<span class="rank">${isPrimary ? '第一推奨' : '代替案'}</span>`);
    rows.push(`<div class="rec-name">${esc(r.name)}</div>`);
    if (rec.plusBiologic) {
      rows.push(`<div class="rec-plus">＋ ${esc(rec.plusBiologic.name)}</div>`);
    }
    if (r.note) rows.push(`<div class="rec-note">${esc(r.note)}</div>`);
    if (rec.rationale && rec.rationale.length) {
      rows.push('<ul>');
      rec.rationale.forEach((x) => rows.push(`<li>${esc(x)}</li>`));
      rows.push('</ul>');
    }
    rows.push('</div>');
    return rows.join('');
  }

  function profileSummary(p) {
    const map = {
      ps: { '0-1': 'PS 0-1', '2': 'PS 2', '3-4': 'PS 3-4' },
      organ: { fit: '臓器機能良好', unfit: '臓器機能低下' },
      ras: { wt: 'RAS野生型', mut: 'RAS変異', unknown: 'RAS未検査' },
      braf: { wt: 'BRAF野生型', mut: 'BRAF V600E', unknown: 'BRAF未検査' },
      msi: { mss: 'MSS/pMMR', 'msi-h': 'MSI-H/dMMR', unknown: 'MSI未検査' },
      her2: { pos: 'HER2陽性', neg: 'HER2陰性', unknown: 'HER2未検査' },
      side: { left: '左側原発', right: '右側原発', unknown: '部位不明' },
      goal: { conversion: 'コンバージョン狙い', palliative: '緩和的' },
    };
    const items = [
      map.ps[p.ps], map.organ[p.organ], p.age ? `${p.age}歳` : null,
      map.ras[p.ras], map.braf[p.braf], map.msi[p.msi], map.her2[p.her2],
      map.side[p.side], map.goal[p.goal],
    ].filter(Boolean);
    return `<div class="result-block" style="font-size:.78rem;color:var(--muted);border-top:1px solid var(--line);padding-top:10px;">
      <b>入力プロファイル:</b> ${items.map(esc).join(' / ')}</div>`;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  }
})();
