/*
 * engine.js — レジメン推奨ロジック
 *
 * 入力: 患者プロファイル(profile)
 * 出力: {
 *   firstLine: [{ regimen, rationale[] }...],
 *   sequence:  [{ line, options[], note }...],  // 後続ライン戦略
 *   tests:     { biomarker[], baseline[], monitoring[] },
 *   flags:     [警告・注意メッセージ],
 * }
 *
 * profile のフィールド:
 *   ps:        '0-1' | '2' | '3-4'
 *   organ:     'fit' | 'unfit'          // 主要臓器機能が強力な治療に耐えうるか
 *   age:       数値
 *   ras:       'wt' | 'mut' | 'unknown'
 *   braf:      'wt' | 'mut' | 'unknown'
 *   msi:       'mss' | 'msi-h' | 'unknown'
 *   her2:      'pos' | 'neg' | 'unknown'
 *   krasG12C:  'pos' | 'neg' | 'unknown'
 *   side:      'left' | 'right' | 'unknown'   // 原発占居部位
 *   goal:      'conversion' | 'palliative'    // 治療目標
 *   ugt1a1:    'wt' | 'variant' | 'unknown'
 *   priorOxaliplatin: bool
 *   priorIrinotecan:  bool
 *   priorEgfr:        bool
 *   priorBev:         bool
 *   priorIo:          bool
 */

function recommend(profile) {
  const flags = [];
  const R = REGIMENS;

  // ---- 0. 検査未実施のバイオマーカーを警告 ----
  const missing = [];
  if (profile.ras === 'unknown') missing.push('RAS');
  if (profile.braf === 'unknown') missing.push('BRAF V600E');
  if (profile.msi === 'unknown') missing.push('MMR/MSI');
  if (missing.length) {
    flags.push({
      level: 'warn',
      text: `未実施のバイオマーカー（${missing.join('・')}）があります。治療方針の分岐に必須のため、治療開始前の測定を強く推奨します。判定不能の項目は「陰性/野生型でない可能性」を残したうえで暫定的に評価しています。`,
    });
  }

  // ---- 1. 全身状態による治療強度のトリアージ ----
  if (profile.ps === '3-4') {
    return {
      firstLine: [{
        regimen: R.BSC,
        rationale: [
          'PS 3-4 では細胞傷害性抗がん薬の有害事象リスクが利益を上回りやすく、標準的には薬物療法の適応は限定的です。',
          'ただしMSI-H/dMMRや、PS低下の主因が腫瘍量そのものである場合など、可逆的な要因があれば個別に免疫療法や減量レジメンを検討します。',
        ],
      }],
      sequence: [{ line: '—', options: ['症状緩和・支持療法を最優先。全身状態が改善すれば薬物療法の再評価を検討。'], note: '' }],
      tests: buildTests(profile, { minimal: true }),
      flags: flags.concat([{ level: 'info', text: 'PS改善が得られた場合は、下記バイオマーカーに基づく薬物療法の再評価が可能です。' }]),
    };
  }

  // ---- 2. MSI-H/dMMR は最優先で免疫療法 ----
  if (profile.msi === 'msi-h') {
    const firstLine = [
      {
        regimen: R.PEMBRO,
        rationale: [
          'MSI-H/dMMR の切除不能大腸癌では、一次治療から抗PD-1抗体が化学療法を上回るPFSを示しています（KEYNOTE-177）。',
          'RAS/BRAF の状態や原発部位に関わらず、免疫療法が最優先の選択肢となります。',
        ],
      },
      {
        regimen: R.NIVO,
        rationale: ['ニボルマブ（±イピリムマブ）も MSI-H/dMMR に対する有力な選択肢です。'],
      },
    ];
    return {
      firstLine,
      sequence: buildSequence(profile, { ioFirst: true }),
      tests: buildTests(profile),
      flags: flags.concat([{ level: 'info', text: 'irAE（免疫関連有害事象）に備え、治療開始前の内分泌・肝・呼吸器のベースライン評価を行ってください。' }]),
    };
  }

  // ---- 3. MSS/pMMR（または未検査）— 殺細胞性 + 分子標的 ----
  // 3a. 治療強度の決定
  const reducedIntensity = profile.ps === '2' || profile.organ === 'unfit';
  const elderly = typeof profile.age === 'number' && profile.age >= 75;

  // 3b. 併用する分子標的（抗VEGF vs 抗EGFR）の決定
  const biologic = chooseBiologic(profile, flags);

  const firstLine = [];

  if (reducedIntensity) {
    // 減量方針: フッ化ピリミジン ± bev
    flags.push({
      level: 'info',
      text: `${profile.ps === '2' ? 'PS 2' : '臓器機能'}を考慮し、毒性を抑えた減量レジメンを基本とします。忍容性を見ながら段階的な強化（オキサリプラチン追加等）も検討可能です。`,
    });
    const rationale = [
      '強力な併用療法の忍容性が懸念されるため、フッ化ピリミジンを基盤とした緩和的レジメンを提示します。',
    ];
    if (biologic.id === 'BEV') rationale.push('ベバシズマブの上乗せは毒性の増加が比較的小さく、フッ化ピリミジン単剤への併用が可能です。');
    firstLine.push({ regimen: R.FP, rationale, plusBiologic: biologic.id === 'BEV' ? R.BEV : null });
    // 忍容性次第でダブレットも
    firstLine.push({
      regimen: R.CAPOX,
      rationale: ['全身状態が許容すれば、減量したオキサリプラチン基盤ダブレット + ベバシズマブへの強化も選択肢です。'],
      plusBiologic: R.BEV,
    });
  } else if (profile.goal === 'conversion' && profile.braf !== 'mut') {
    // 積極的縮小狙い（BRAF変異以外）: FOLFOXIRI + bev を軸に
    firstLine.push({
      regimen: R.FOLFOXIRI,
      plusBiologic: R.BEV,
      rationale: [
        '腫瘍縮小（コンバージョン／深達奏効）を目標とし、PS・臓器機能が良好なため、奏効率と深達度に優れる3剤併用 + ベバシズマブを軸にします（TRIBE）。',
        '毒性が強いため、忍容性・年齢・合併症を慎重に評価してください。',
      ],
    });
    // 左側RAS/BRAF野生型なら EGFR併用ダブレットも縮小狙いの有力候補
    if (biologic.id === 'EGFR') {
      firstLine.push({
        regimen: R.FOLFOX,
        plusBiologic: R.EGFR,
        rationale: [
          'RAS/BRAF野生型・左側原発では、抗EGFR抗体併用ダブレットも高い奏効・縮小が期待でき、コンバージョンの有力な選択肢です（PARADIGM）。',
        ],
      });
    } else {
      firstLine.push({
        regimen: R.FOLFOX,
        plusBiologic: R.BEV,
        rationale: ['3剤併用が過剰と判断される場合は、ダブレット + ベバシズマブでも縮小を狙えます。'],
      });
    }
  } else if (profile.braf === 'mut') {
    // BRAF V600E: 予後不良、強力併用を検討
    flags.push({ level: 'warn', text: 'BRAF V600E 変異は予後不良因子です。PS良好例では強力な初期治療を、既治療ではBRAF標的療法（エンコラフェニブ+セツキシマブ）を計画に組み込みます。' });
    firstLine.push({
      regimen: R.FOLFOXIRI,
      plusBiologic: R.BEV,
      rationale: [
        'BRAF V600E変異例では予後改善を狙い、忍容性が許せば3剤併用 + ベバシズマブが検討されます。',
        '抗EGFR抗体はBRAF変異例では単独併用の効果が限定的なため、一次治療の第一選択とはしません。',
      ],
    });
    firstLine.push({
      regimen: R.FOLFOX,
      plusBiologic: R.BEV,
      rationale: ['3剤併用が困難な場合はダブレット + ベバシズマブ。'],
    });
  } else {
    // 標準的な一次治療: ダブレット + 分子標的
    const backbone = pickDoublet(profile);
    firstLine.push({
      regimen: R[backbone],
      plusBiologic: biologic.id === 'EGFR' ? R.EGFR : R.BEV,
      rationale: biologicRationale(profile, biologic, backbone),
    });
    // 代替の骨格 / 分子標的
    if (biologic.id === 'EGFR') {
      firstLine.push({
        regimen: R[backbone],
        plusBiologic: R.BEV,
        rationale: ['ベバシズマブ併用も一次治療の妥当な代替であり、皮膚毒性回避や患者背景により選択されます。'],
      });
    }
  }

  return {
    firstLine,
    sequence: buildSequence(profile, { biologic }),
    tests: buildTests(profile),
    flags,
  };
}

// 抗VEGF / 抗EGFR の選択 ------------------------------------------------
function chooseBiologic(profile, flags) {
  const rasWt = profile.ras === 'wt';
  const brafWt = profile.braf === 'wt';
  const leftSided = profile.side === 'left';

  if (rasWt && brafWt && leftSided) {
    return { id: 'EGFR' };
  }
  if (rasWt && brafWt && profile.side === 'right') {
    flags.push({ level: 'info', text: '右側原発では抗EGFR抗体の一次治療効果が左側に劣るため、ベバシズマブ併用を第一選択とします（後方ラインで抗EGFRを温存）。' });
    return { id: 'BEV' };
  }
  if (rasWt && brafWt && profile.side === 'unknown') {
    flags.push({ level: 'warn', text: 'RAS/BRAF野生型ですが原発部位が未入力です。左側なら抗EGFR、右側ならベバシズマブが目安になるため、占居部位を確認してください。暫定的にベバシズマブを提示します。' });
    return { id: 'BEV' };
  }
  // RAS変異 or BRAF変異 or 未検査 → 抗VEGF
  return { id: 'BEV' };
}

// フッ化ピリミジン基盤ダブレットの骨格選択 -----------------------------
function pickDoublet(profile) {
  // イリノテカン基盤はUGT1A1多型で注意。一次治療は基本オキサリプラチン基盤を提示。
  return 'FOLFOX';
}

function biologicRationale(profile, biologic, backbone) {
  const r = [];
  if (biologic.id === 'EGFR') {
    r.push('RAS野生型・BRAF野生型・左側原発のため、抗EGFR抗体併用ダブレットが一次治療で良好な成績を示します（PARADIGM / CALGB80405）。');
    r.push('ざ瘡様皮疹・低Mg血症の管理と、予防的スキンケアを計画してください。');
  } else {
    if (profile.ras === 'mut') r.push('RAS変異のため抗EGFR抗体は無効であり、ベバシズマブ併用ダブレットが標準です。');
    else if (profile.braf === 'mut') r.push('BRAF変異のため抗EGFR単独併用の効果は限定的で、ベバシズマブ併用を選択します。');
    else r.push('ベバシズマブ併用ダブレットは原発部位やRAS状態に依らず標準的に用いられます。');
    r.push('高血圧・尿蛋白の定期モニタリング、周術期の休薬を計画してください。');
  }
  return r;
}

// 後続ライン戦略 --------------------------------------------------------
function buildSequence(profile, ctx) {
  const seq = [];
  const rasWt = profile.ras === 'wt';
  const brafMut = profile.braf === 'mut';

  if (ctx.ioFirst) {
    // MSI-H で一次が免疫療法
    seq.push({
      line: '免疫療法後（増悪時）',
      options: [
        'MSS例に準じた殺細胞性 + 分子標的（RAS/BRAF・原発部位に基づき FOLFOX/FOLFIRI ± ベバシズマブ／抗EGFR）へ移行。',
        'BRAF V600E変異があればエンコラフェニブ + セツキシマブを組み込む。',
      ],
      note: '一次で免疫療法を用いた場合、二次以降は下記の化学療法アルゴリズムに準じます。',
    });
  }

  // 二次治療
  const second = [];
  const usedOxFirst = true; // 一次はオキサリプラチン基盤を基本提示
  second.push('骨格の切り替え: 一次でオキサリプラチン基盤ならFOLFIRI（イリノテカン基盤）へ、逆なら逆へスイッチ。');
  if (ctx.biologic && ctx.biologic.id === 'BEV') {
    second.push('抗VEGF継続/切替: ベバシズマブのbeyond PD、またはFOLFIRI + ラムシルマブ（RAISE）／アフリベルセプト（VELOUR）。');
    if (rasWt && !brafMut) second.push('未使用の抗EGFR抗体（RAS/BRAF野生型）を二次で用いる選択肢。');
  } else if (ctx.biologic && ctx.biologic.id === 'EGFR') {
    second.push('抗VEGFへの切替: FOLFIRI + ベバシズマブ／ラムシルマブ／アフリベルセプト。');
  } else {
    second.push('RAS/BRAF野生型なら未使用の抗EGFR、変異型ならベバシズマブ継続/切替。');
  }
  if (brafMut) second.push('BRAF V600E: エンコラフェニブ + セツキシマブ（BEACON）を二次治療で優先的に検討。');
  if (profile.her2 === 'pos') second.push('HER2陽性（RAS/BRAF野生型）: 抗HER2療法（トラスツズマブ+ペルツズマブ／T-DXd, DESTINY-CRC）。');
  if (profile.krasG12C === 'pos') second.push('KRAS G12C: ソトラシブ + パニツムマブ（CodeBreaK 300）。');
  seq.push({ line: '二次治療', options: second, note: '一次で使用した骨格・分子標的、バイオマーカーに応じて選択します。' });

  // 三次治療
  const third = [];
  third.push('未使用の骨格・分子標的（オキサリプラチン↔イリノテカン、抗EGFR/抗VEGF）を可能な限り使い切る。');
  if (brafMut) third.push('未使用ならBRAF標的療法（エンコラフェニブ+セツキシマブ）。');
  if (profile.her2 === 'pos') third.push('未使用ならHER2標的療法。');
  seq.push({ line: '三次治療', options: third, note: '' });

  // サルベージ
  seq.push({
    line: 'サルベージ（不応・不耐後）',
    options: [
      'レゴラフェニブ（CORRECT）。',
      'トリフルリジン・チピラシル（FTD/TPI）± ベバシズマブ（RECOURSE / SUNLIGHT）。',
      'フルキンチニブ（FRESCO-2）。',
      profile.msi !== 'msi-h' && !profile.priorIo ? '（MSI-H判明時）未使用なら免疫療法。' : null,
    ].filter(Boolean),
    note: '全身状態を都度評価し、投与順は忍容性・毒性プロファイルで個別化します。',
  });

  // CGP
  seq.push({
    line: 'がん遺伝子パネル検査（CGP）',
    options: [
      '標準治療の終了が見込まれる時期（または不応時）に包括的ゲノムプロファイリングを検討し、治験・適応外を含む治療選択肢を探索。',
      'HER2増幅・NTRK融合・その他アクショナブル変異が判明すれば対応する分子標的治療／治験へ。',
    ],
    note: '実施時期は施設・保険要件に従ってください。',
  });

  return seq;
}

// 必要検査の構築 --------------------------------------------------------
function buildTests(profile, opts) {
  opts = opts || {};
  const biomarker = BIOMARKER_TESTS.map((t) => {
    const status = biomarkerStatus(profile, t.id);
    return Object.assign({ status }, t);
  });

  const baseline = BASELINE_TESTS.slice();

  // モニタリング（提示レジメンに関連しうる項目を広めに）
  const monitoring = [];
  monitoring.push({ name: 'オキサリプラチン', text: MONITORING.oxaliplatin });
  monitoring.push({ name: 'イリノテカン', text: MONITORING.irinotecan });
  monitoring.push({ name: 'フッ化ピリミジン', text: MONITORING.fluoropyrimidine });
  monitoring.push({ name: 'ベバシズマブ／抗VEGF', text: MONITORING.BEV });
  if (profile.ras === 'wt' && profile.braf !== 'mut') monitoring.push({ name: '抗EGFR抗体', text: MONITORING.EGFR });
  if (profile.msi === 'msi-h') monitoring.push({ name: '免疫チェックポイント阻害薬', text: MONITORING.io });

  return { biomarker, baseline, monitoring };
}

function biomarkerStatus(profile, id) {
  switch (id) {
    case 'RAS': return statusLabel(profile.ras, { wt: '野生型', mut: '変異型' });
    case 'BRAF': return statusLabel(profile.braf, { wt: '野生型', mut: 'V600E変異' });
    case 'MMR': return statusLabel(profile.msi, { mss: 'MSS/pMMR', 'msi-h': 'MSI-H/dMMR' });
    case 'HER2': return statusLabel(profile.her2, { pos: '陽性', neg: '陰性' });
    case 'UGT1A1': return statusLabel(profile.ugt1a1, { wt: '野生型', variant: '多型あり' });
    default: return '—';
  }
}

function statusLabel(val, map) {
  if (!val || val === 'unknown') return '未検査';
  return map[val] || val;
}

if (typeof module !== 'undefined') module.exports = { recommend };
