/*
 * data.js — 切除不能・再発大腸癌 レジメン／検査データベース
 *
 * 出典の考え方:
 *  - 大腸癌研究会「大腸癌治療ガイドライン 医師用 2024年版」の薬物療法アルゴリズムを基本骨格とする
 *  - 主要臨床試験（下記 TRIALS 参照）およびバイオマーカーに基づく標準的な国内実臨床を反映
 *
 * ※ 本データは臨床意思決定「支援」のための参考情報であり、最新の添付文書・
 *   ガイドライン・保険適用を必ず確認すること。用量・スケジュールは記載しない
 *   （施設プロトコル・体表面積・臓器機能で個別化されるため）。
 */

// レジメン定義 -----------------------------------------------------------
// backbone: 細胞傷害性の骨格。 mods: 併用分子標的/免疫。
const REGIMENS = {
  // --- 殺細胞性 骨格 ---
  FOLFOX: {
    id: 'FOLFOX',
    name: 'FOLFOX（5-FU/l-LV + オキサリプラチン）',
    class: 'doublet',
    key: ['oxaliplatin', 'fluoropyrimidine'],
    note: 'オキサリプラチン基盤ダブレット。末梢神経障害に注意。',
  },
  CAPOX: {
    id: 'CAPOX',
    name: 'CAPOX / XELOX（カペシタビン + オキサリプラチン）',
    class: 'doublet',
    key: ['oxaliplatin', 'fluoropyrimidine'],
    note: '経口フッ化ピリミジンを用いる通院しやすいダブレット。手足症候群・下痢に注意。',
  },
  SOX: {
    id: 'SOX',
    name: 'SOX（S-1 + オキサリプラチン）',
    class: 'doublet',
    key: ['oxaliplatin', 'fluoropyrimidine'],
    note: '国内で汎用されるオキサリプラチン基盤ダブレット。',
  },
  FOLFIRI: {
    id: 'FOLFIRI',
    name: 'FOLFIRI（5-FU/l-LV + イリノテカン）',
    class: 'doublet',
    key: ['irinotecan', 'fluoropyrimidine'],
    note: 'イリノテカン基盤ダブレット。好中球減少・下痢に注意。UGT1A1確認。',
  },
  IRIS: {
    id: 'IRIS',
    name: 'IRIS（S-1 + イリノテカン）',
    class: 'doublet',
    key: ['irinotecan', 'fluoropyrimidine'],
    note: 'イリノテカン + S-1 の経口併用ダブレット。UGT1A1確認。',
  },
  FOLFOXIRI: {
    id: 'FOLFOXIRI',
    name: 'FOLFOXIRI（5-FU/l-LV + オキサリプラチン + イリノテカン）',
    class: 'triplet',
    key: ['oxaliplatin', 'irinotecan', 'fluoropyrimidine'],
    note: '3剤併用トリプレット。奏効・深達度が高い一方で毒性も強く、PS良好・臓器機能良好例に限定。',
  },
  FP: {
    id: 'FP',
    name: 'フッ化ピリミジン単剤（5-FU/LV・カペシタビン・S-1 いずれか）',
    class: 'single',
    key: ['fluoropyrimidine'],
    note: '毒性を抑えた緩和的レジメン。高齢・PS不良・臓器機能低下例に。',
  },

  // --- 分子標的（併用） ---
  BEV: {
    id: 'BEV',
    name: 'ベバシズマブ（抗VEGF）',
    class: 'mab',
    note: 'RAS/BRAF・左右いずれでも上乗せ可。高血圧・蛋白尿・出血・消化管穿孔・創傷治癒遅延・血栓に注意。手術前後は休薬。',
  },
  EGFR: {
    id: 'EGFR',
    name: '抗EGFR抗体（セツキシマブ or パニツムマブ）',
    class: 'mab',
    note: 'RAS野生型かつBRAF野生型で、原発左側の症例に有用。ざ瘡様皮疹・低Mg血症。右側原発では一次治療の第一選択としない。',
  },
  RAM: {
    id: 'RAM',
    name: 'ラムシルマブ（抗VEGFR2）',
    class: 'mab',
    note: '二次治療でFOLFIRIに併用（一次でオキサリプラチン+bev既治療例）。',
  },
  AFL: {
    id: 'AFL',
    name: 'アフリベルセプト ベータ（抗VEGF融合蛋白）',
    class: 'mab',
    note: '二次治療でFOLFIRIに併用（一次でオキサリプラチン既治療例）。',
  },

  // --- バイオマーカー特異的 ---
  PEMBRO: {
    id: 'PEMBRO',
    name: 'ペムブロリズマブ（抗PD-1）',
    class: 'io',
    note: 'MSI-H/dMMR の一次治療（KEYNOTE-177）。免疫関連有害事象（irAE）に注意。',
  },
  NIVO: {
    id: 'NIVO',
    name: 'ニボルマブ ± イピリムマブ（抗PD-1 ± 抗CTLA-4）',
    class: 'io',
    note: 'MSI-H/dMMR に対する選択肢。irAEに注意。',
  },
  ENCO_CET: {
    id: 'ENCO_CET',
    name: 'エンコラフェニブ + セツキシマブ（+ ビニメチニブ）',
    class: 'targeted',
    note: 'BRAF V600E 変異の既治療例（BEACON CRC）。',
  },
  HER2: {
    id: 'HER2',
    name: '抗HER2療法（トラスツズマブ + ペルツズマブ / トラスツズマブ デルクステカン）',
    class: 'targeted',
    note: 'HER2陽性（RAS/BRAF野生型）の既治療例。T-DXdは間質性肺疾患に注意。',
  },
  SOTO_PANI: {
    id: 'SOTO_PANI',
    name: 'ソトラシブ + パニツムマブ',
    class: 'targeted',
    note: 'KRAS G12C 変異の既治療例（CodeBreaK 300）。',
  },

  // --- 後方ライン／サルベージ ---
  REGO: {
    id: 'REGO',
    name: 'レゴラフェニブ（マルチキナーゼ阻害）',
    class: 'salvage',
    note: '不応・不耐後のサルベージ（CORRECT）。手足皮膚反応・肝機能・高血圧。',
  },
  FTD_TPI: {
    id: 'FTD_TPI',
    name: 'トリフルリジン・チピラシル（FTD/TPI, Lonsurf）± ベバシズマブ',
    class: 'salvage',
    note: 'サルベージ（RECOURSE / SUNLIGHT でbev併用の上乗せ）。骨髄抑制。',
  },
  FRUQ: {
    id: 'FRUQ',
    name: 'フルキンチニブ（抗VEGFR-TKI）',
    class: 'salvage',
    note: '後方ラインのサルベージ選択肢（FRESCO-2）。',
  },
  BSC: {
    id: 'BSC',
    name: 'ベストサポーティブケア（BSC）／緩和ケア中心',
    class: 'bsc',
    note: '全身状態不良で薬物療法の益が見込めない場合。症状緩和とQOLを最優先。',
  },
};

// 主要臨床試験の短い注記（根拠の裏付け表示用） -------------------------
const TRIALS = {
  'KEYNOTE-177': 'MSI-H mCRC 一次治療でペムブロリズマブが化学療法に対しPFSを延長。',
  'BEACON': 'BRAF V600E 既治療例でエンコラフェニブ+セツキシマブがOSを改善。',
  'TRIBE': 'FOLFOXIRI+bev が一次治療でダブレット+bevに対しOS/奏効を改善（毒性は増加）。',
  'CALGB/SWOG 80405': '左側RAS野生型で抗EGFRが良好、右側では抗VEGFが良好という原発部位差を示唆。',
  'PARADIGM': 'RAS野生型・左側の一次治療でパニツムマブがベバシズマブに対しOSを改善。',
  'RAISE': '二次治療でFOLFIRI+ラムシルマブがOSを改善。',
  'VELOUR': '二次治療でFOLFIRI+アフリベルセプトがOSを改善。',
  'CORRECT': '標準治療不応例でレゴラフェニブがOSを改善。',
  'RECOURSE/SUNLIGHT': 'FTD/TPI（±bev）が後方ラインでOSを改善。',
  'DESTINY-CRC': 'HER2陽性既治療例でT-DXdが有効。',
  'CodeBreaK 300': 'KRAS G12C 既治療例でソトラシブ+パニツムマブが有効。',
};

// 検査項目 --------------------------------------------------------------
// バイオマーカー（治療方針の分岐に必須）
const BIOMARKER_TESTS = [
  { id: 'RAS', name: 'RAS遺伝子検査（KRAS/NRAS エクソン2,3,4）', why: '抗EGFR抗体の適応判定に必須。変異型では抗EGFRは無効。' },
  { id: 'BRAF', name: 'BRAF V600E 変異検査', why: '予後不良因子。変異例では治療強度・後方ラインのBRAF標的療法を検討。' },
  { id: 'MMR', name: 'MMR蛋白（IHC）／ MSI検査', why: 'MSI-H/dMMR では免疫チェックポイント阻害薬が一次治療から有効。' },
  { id: 'HER2', name: 'HER2検査（IHC/FISH）', why: 'HER2陽性で抗HER2療法の候補。RAS/BRAF野生型で特に検討。' },
  { id: 'UGT1A1', name: 'UGT1A1遺伝子多型（*6, *28）', why: 'イリノテカン使用時の重篤な骨髄抑制・下痢リスク評価。' },
];

// ベースライン全身評価
const BASELINE_TESTS = [
  { id: 'cbc', name: '血算（好中球・血小板・Hb）', why: '骨髄機能の確認。治療開始・継続の基準。' },
  { id: 'chem', name: '生化学（肝機能・腎機能・電解質・Mg・Alb）', why: '薬剤選択・減量・抗EGFRでの低Mg補正など。' },
  { id: 'tumor', name: '腫瘍マーカー（CEA, CA19-9）', why: '治療効果・再発モニタリングのベースライン。' },
  { id: 'ct', name: '造影CT（胸腹骨盤）でRECISTベースライン', why: '効果判定の基準病変設定。' },
  { id: 'hbv', name: 'B型肝炎 screening（HBs抗原・HBc抗体・HBs抗体）', why: '化学療法・免疫療法によるHBV再活性化予防。' },
  { id: 'cardiac', name: '心機能評価（心疾患既往時／フッ化ピリミジンの冠攣縮）', why: '5-FU・カペシタビンの心毒性リスク評価。' },
  { id: 'preg', name: '妊娠検査・妊孕性温存の相談（生殖年齢）', why: '催奇形性・性腺毒性への配慮。' },
];

// レジメン特異的モニタリング
const MONITORING = {
  oxaliplatin: '末梢神経障害（累積・寒冷過敏）。程度に応じ休薬・中止（stop-and-go）。',
  irinotecan: '早発性/遅発性下痢、好中球減少。UGT1A1多型例は特に慎重に。',
  fluoropyrimidine: '手足症候群、口内炎、下痢、心毒性（冠攣縮）。DPD欠損に注意。',
  BEV: '血圧・尿蛋白の定期測定、出血・穿孔・血栓・創傷治癒遅延。周術期は休薬。',
  EGFR: '皮膚症状（ざ瘡様皮疹・爪囲炎）の予防的スキンケア、血清Mg。',
  io: '免疫関連有害事象（甲状腺・肝・腸炎・肺臓炎・下垂体・皮膚等）を全身で監視。',
};
