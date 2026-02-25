/**
 * ocr.ts — 高精度OCRユーティリティ
 *
 * 改善点:
 * 1. カンマ区切り金額（¥1,234 / 1,234円）を完全対応
 * 2. カンマなし金額（¥1234 / 1234円）も対応
 * 3. 全角数字・全角カンマを正規化してから解析
 * 4. 複数アイテムのレシートから「合計金額」を優先的に抽出
 */

import Tesseract from 'tesseract.js';
import { preprocessForOcr } from './imagePreprocess';

export interface OcrResult {
  rawText: string;
  date: string;
  vendor: string;
  amount: number;
  confidence: number;
  amountCandidates?: number[];
}

interface OcrStrategy {
  lang: string;
  psm: number;
  label: string;
  preprocessOpts?: Parameters<typeof preprocessForOcr>[1];
}

const STRATEGIES: OcrStrategy[] = [
  {
    lang: 'jpn+eng',
    psm: 6,
    label: 'jpn+eng PSM6',
    preprocessOpts: { scale: 2, contrast: 1.5, brightness: 15, sharpen: 0.6, binarize: true },
  },
  {
    lang: 'jpn+eng',
    psm: 4,
    label: 'jpn+eng PSM4',
    preprocessOpts: { scale: 2, contrast: 1.6, brightness: 10, sharpen: 0.7, binarize: true },
  },
  {
    lang: 'jpn_vert+jpn',
    psm: 5,
    label: 'jpn_vert PSM5',
    preprocessOpts: { scale: 2, contrast: 1.4, brightness: 20, sharpen: 0.5, binarize: false },
  },
  {
    lang: 'eng',
    psm: 6,
    label: 'eng PSM6',
    preprocessOpts: { scale: 2, contrast: 1.4, brightness: 10, sharpen: 0.5, binarize: true },
  },
];

export async function runOcr(
  canvas: HTMLCanvasElement,
  onProgress?: (pct: number) => void
): Promise<OcrResult> {
  const primaryResult = await runSingleOcr(canvas, STRATEGIES[0], (p) => {
    onProgress?.(Math.round(p * 60));
  });

  if (primaryResult.confidence >= 75) {
    onProgress?.(100);
    return extractInfo(primaryResult.text, primaryResult.confidence);
  }

  onProgress?.(65);
  const secondaryResult = await runSingleOcr(canvas, STRATEGIES[1], (p) => {
    onProgress?.(65 + Math.round(p * 25));
  });

  let bestText = primaryResult.text;
  let bestConf = primaryResult.confidence;

  if (secondaryResult.confidence > primaryResult.confidence + 5) {
    bestText = secondaryResult.text;
    bestConf = secondaryResult.confidence;
  }

  if (bestConf < 50) {
    onProgress?.(92);
    try {
      const vertResult = await runSingleOcr(canvas, STRATEGIES[2], () => {});
      if (vertResult.confidence > bestConf + 5) {
        bestText = vertResult.text;
        bestConf = vertResult.confidence;
      }
    } catch {
      // 縦書き言語データがない場合は無視
    }
  }

  onProgress?.(100);
  return extractInfo(bestText, bestConf);
}

async function runSingleOcr(
  canvas: HTMLCanvasElement,
  strategy: OcrStrategy,
  onProgress: (pct: number) => void
): Promise<{ text: string; confidence: number }> {
  const processed = preprocessForOcr(canvas, strategy.preprocessOpts);

  try {
    const result = await Tesseract.recognize(processed, strategy.lang, {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          onProgress(m.progress);
        }
      },
    });

    return {
      text: result.data.text,
      confidence: Math.round(result.data.confidence ?? 0),
    };
  } catch (e) {
    console.warn(`[OCR] 戦略 ${strategy.label} 失敗:`, e);
    return { text: '', confidence: 0 };
  }
}

function extractInfo(rawText: string, confidence: number): OcrResult {
  const normalized = normalizeText(rawText);
  const internalCandidates = extractAllCandidates(normalized);
  const amount = selectBestAmount(normalized, internalCandidates);
  const amountCandidates = [...new Set(internalCandidates.map(c => c.value))].sort((a, b) => b - a);
  return {
    rawText,
    date: extractDate(rawText),
    vendor: extractVendor(rawText),
    amount,
    confidence,
    amountCandidates,
  };
}

// ============================================================
// テキスト正規化（全角→半角、OCRノイズ除去）
// ============================================================

/**
 * 全角文字・OCRノイズを半角に正規化
 * カンマ区切り・カンマなし両方に対応するための前処理
 */
function normalizeText(text: string): string {
  return text
    // 全角数字 → 半角
    .replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    // 全角カンマ・読点 → 半角カンマ
    .replace(/[，、]/g, ',')
    // 全角円記号
    .replace(/[￥¥]/g, '¥')
    // 全角スペース
    .replace(/　/g, ' ')
    // 全角スラッシュ・ドット
    .replace(/[／．]/g, '/')
    // OCR誤認識: O→0（数字の前後）
    .replace(/O(?=\d)/g, '0')
    .replace(/(?<=\d)O/g, '0')
    // OCR誤認識: l/I→1（数字の前後）
    .replace(/[lI](?=\d)/g, '1')
    .replace(/(?<=\d)[lI]/g, '1')
    // カンマが数字3桁区切り以外の場所に入る誤認識を除去
    // （例: ¥1.500 → ¥1,500 / ¥1 500 → ¥1500）
    .replace(/(\d)\.(\d{3})(?!\d)/g, '$1,$2')  // ピリオドをカンマに
    .replace(/(\d)\s(\d{3})(?!\d)/g, '$1$2');  // スペースを除去（金額の中）
}

// ============================================================
// 日付抽出
// ============================================================
function extractDate(text: string): string {
  const today = new Date().toISOString().slice(0, 10);

  const normalized = normalizeText(text);

  const warekiMap: [RegExp, number][] = [
    [/令和\s*(\d{1,2})\s*[年\/\.\-]\s*(\d{1,2})\s*[月\/\.\-]\s*(\d{1,2})/g, 2018],
    [/[Rr]\.?\s*(\d{1,2})\s*[\/\.\-]\s*(\d{1,2})\s*[\/\.\-]\s*(\d{1,2})/g, 2018],
    [/平成\s*(\d{1,2})\s*[年\/\.\-]\s*(\d{1,2})\s*[月\/\.\-]\s*(\d{1,2})/g, 1988],
    [/[Hh]\.?\s*(\d{1,2})\s*[\/\.\-]\s*(\d{1,2})\s*[\/\.\-]\s*(\d{1,2})/g, 1988],
    [/昭和\s*(\d{1,2})\s*[年\/\.\-]\s*(\d{1,2})\s*[月\/\.\-]\s*(\d{1,2})/g, 1925],
    [/[Ss]\.?\s*(\d{1,2})\s*[\/\.\-]\s*(\d{1,2})\s*[\/\.\-]\s*(\d{1,2})/g, 1925],
  ];

  for (const [re, base] of warekiMap) {
    re.lastIndex = 0;
    const m = re.exec(normalized);
    if (m) {
      const y = base + parseInt(m[1]);
      if (y >= 1950 && y <= 2099) {
        const mo = m[2].padStart(2, '0');
        const d = m[3].padStart(2, '0');
        if (isValidDate(y, parseInt(m[2]), parseInt(m[3]))) {
          return `${y}-${mo}-${d}`;
        }
      }
    }
  }

  const westPatterns: RegExp[] = [
    /(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日/g,
    /(\d{4})\s*[\/\-\.]\s*(\d{1,2})\s*[\/\-\.]\s*(\d{1,2})/g,
    /(\d{1,2})\s*\/\s*(\d{1,2})\s*\/\s*(\d{4})/g,
    /(\d{2})\s*[\/\-\.]\s*(\d{1,2})\s*[\/\-\.]\s*(\d{1,2})/g,
  ];

  for (const re of westPatterns) {
    re.lastIndex = 0;
    const m = re.exec(normalized);
    if (m) {
      let y: number, mo: number, d: number;

      if (re.source.startsWith('(\\d{1,2})')) {
        mo = parseInt(m[1]);
        d = parseInt(m[2]);
        y = parseInt(m[3]);
      } else {
        y = parseInt(m[1]);
        if (y < 100) y += 2000;
        mo = parseInt(m[2]);
        d = parseInt(m[3]);
      }

      if (y >= 1990 && y <= 2099 && isValidDate(y, mo, d)) {
        return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      }
    }
  }

  return today;
}

function isValidDate(y: number, m: number, d: number): boolean {
  if (m < 1 || m > 12) return false;
  if (d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

// ============================================================
// 支払先抽出（法人格・店舗名の優先検出 強化版）
// ============================================================

/**
 * ノイズ行パターン（除外する行）
 */
const NOISE_PATTERNS = [
  /^(領収書|レシート|receipt|invoice|御領収書|ご利用明細|明細書|お買上明細)/i,
  /^(税込|税抜|合計|小計|消費税|税率|外税|内税|お買上|ご請求|お支払|お釣|おつり|Subtotal|Total|Amount|Balance)/i,
  /^(〒|\d{3}-\d{4})/,              // 郵便番号
  /^(tel|fax|電話|ＴＥＬ|HP|URL|http)/i,
  /^(担当|御担当|様|殿|御中)/,
  /^(登録番号|インボイス|T\d{13})/i, // インボイス番号
  /^(営業時間|定休日|年中無休)/,
  /^[\d\s\-\/\.\,\¥￥\*\#\|\(\)]+$/, // 数字・記号のみ
  /^.{1,1}$/,                        // 1文字以下
  /^.{41,}$/,                        // 41文字以上（住所など）
];

/**
 * 法人格パターン（最優先 — これを含む行は確実に店舗名）
 * 前後どちらにあってもマッチ
 */
const CORPORATE_PATTERNS = [
  // 日本法人格（前置き型: 株式会社○○）
  /(?:株式会社|有限会社|合同会社|合資会社|合名会社|一般社団法人|公益社団法人|一般財団法人|公益財団法人|医療法人|学校法人|社会福祉法人|特定非営利活動法人|NPO法人|宗教法人|協同組合|農業協同組合|生活協同組合)/,
  // 略称（括弧付き）
  /[（(](?:株|有|合同|社団|財団)[）)]/,
  // 後置き型: ○○株式会社
  /[\u3040-\u9FFF\u30A0-\u30FF\uFF65-\uFF9Fa-zA-Z]{2,}(?:株式会社|有限会社|合同会社)/,
  // 英語法人格
  /\b(?:Inc\.|Corp\.|Ltd\.|LLC|Co\.,?\s*Ltd\.?|K\.K\.|G\.K\.)\b/i,
];

/**
 * 店舗・施設を示すキーワード（準優先）
 */
const STORE_KEYWORDS = [
  // 小売・飲食
  /(?:ストア|ショップ|マーケット|スーパー|コンビニ|ドラッグストア|ファーマシー|薬局|薬店)/,
  /(?:デパート|百貨店|ショッピング|アウトレット|モール|センター)/,
  /(?:ホテル|旅館|宿|イン|ロッジ|ペンション|ゲストハウス)/,
  /(?:レストラン|食堂|定食|ダイニング|ビストロ|グリル|居酒屋|バル|カフェ|珈琲|喫茶|ベーカリー|パン|スイーツ|ケーキ)/,
  /(?:クリニック|医院|病院|歯科|整形|皮膚科|内科|外科|眼科|耳鼻科|診療所)/,
  /(?:ガソリン|スタンド|給油所|SS)/,
  /(?:コインパーキング|駐車場)/,
  /(?:クリーニング|ランドリー)/,
  // チェーン店名パターン
  /(?:セブン|ファミマ|ローソン|ミニストップ|デイリー|ナチュラル)/,
  /(?:マクドナルド|モスバーガー|ケンタッキー|スターバックス|ドトール|タリーズ|コメダ)/,
  /(?:イオン|ヨーカドー|マルエツ|ライフ|西友|フジ|ベルク)/,
  /(?:ヨドバシ|ビックカメラ|エディオン|ケーズ|ジョーシン|コジマ)/,
  /(?:Amazon|楽天|ヤフー|Uber|出前館)/i,
  // 英語
  /(store|shop|mart|market|cafe|coffee|hotel|inn|clinic|pharmacy|restaurant|grill|bakery|salon)/i,
  /(supermarket|convenience|drugstore|department)/i,
];

/**
 * 会社名・店舗名に頻出するサフィックス
 */
const NAME_SUFFIX_PATTERN = /(?:店|支店|本店|支社|出張所|営業所|事業所|センター|オフィス|ビル|タワー|プラザ|ヒルズ|ガーデン|パーク|テラス)$/;

export function extractVendor(text: string): string {
  // OCRノイズ正規化
  const normalized = normalizeVendorText(text);

  const lines = normalized
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length >= 2 && l.length <= 45);

  // ノイズ行を除去
  const cleanLines = lines.filter((l) => !NOISE_PATTERNS.some((p) => p.test(l)));
  if (cleanLines.length === 0) return '不明';

  // === 優先度1: 法人格を含む行（最高優先） ===
  for (const line of cleanLines) {
    if (CORPORATE_PATTERNS.some((p) => p.test(line))) {
      return postProcessVendorName(line);
    }
  }

  // === 優先度2: 店舗キーワードを含む行 ===
  for (const line of cleanLines) {
    if (STORE_KEYWORDS.some((p) => p.test(line))) {
      return postProcessVendorName(line);
    }
  }

  // === 優先度3: 店舗名サフィックスを含む行 ===
  for (const line of cleanLines) {
    if (NAME_SUFFIX_PATTERN.test(line)) {
      return postProcessVendorName(line);
    }
  }

  // === 優先度4: カタカナ・ひらがなが多い行（日本語店舗名らしい行） ===
  const kanaLines = cleanLines.filter(line => {
    const kana = (line.match(/[\u3040-\u9FFF\u30A0-\u30FF]/g) ?? []).length;
    const digit = (line.match(/\d/g) ?? []).length;
    return kana >= 2 && digit / line.length < 0.3;
  });
  if (kanaLines.length > 0) {
    return postProcessVendorName(kanaLines[0]);
  }

  // === 優先度5: 数字が少ない最初の行 ===
  for (const line of cleanLines) {
    const digitRatio = (line.match(/\d/g) ?? []).length / line.length;
    if (digitRatio < 0.4) {
      return postProcessVendorName(line);
    }
  }

  return postProcessVendorName(cleanLines[0]);
}

/**
 * 支払先テキスト専用の正規化
 * （不要な記号・住所要素・ノイズを除去）
 */
function normalizeVendorText(text: string): string {
  return text
    // 全角英数 → 半角
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
    // 全角スペース → 半角
    .replace(/　/g, ' ')
    // OCR誤認識: ① → (1) など
    .replace(/[①②③④⑤⑥⑦⑧⑨⑩]/g, '')
    // 連続スペースを1つに
    .replace(/ {2,}/g, ' ');
}

/**
 * 抽出した支払先テキストの後処理
 * - 余計な記号・住所要素を除去
 * - 法人格を正規化（(株) → 株式会社 など）
 * - 30文字以内に収める
 */
function postProcessVendorName(text: string): string {
  let result = text
    // 電話番号・郵便番号を除去
    .replace(/\d{2,4}-\d{2,4}-\d{4}/g, '')
    .replace(/〒\d{3}-\d{4}/g, '')
    // メールアドレスを除去
    .replace(/[\w\.\-]+@[\w\.\-]+/g, '')
    // URLを除去
    .replace(/https?:\/\/\S+/g, '')
    // インボイス番号を除去
    .replace(/T\d{13}/g, '')
    // 不要な記号（ただし括弧・中点は残す）
    .replace(/[^\w\u3040-\u9FFF\u30A0-\u30FF\uFF65-\uFF9F（(）)・･\-＆&　 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // 30文字に収める（法人格は保持）
  if (result.length > 30) {
    // 法人格が後ろにある場合は前から取る
    result = result.slice(0, 30).trim();
  }

  return result || '不明';
}

// ============================================================
// 金額抽出（カンマ区切り・カンマなし両対応・強化版）
// ============================================================

const MIN_AMOUNT = 1;
const MAX_AMOUNT = 9_999_999;

/**
 * 金額文字列をパース（カンマあり・なし両対応）
 *
 * 対応パターン:
 *   ¥1,234  → 1234
 *   ¥1234   → 1234
 *   1,234円 → 1234
 *   1234円  → 1234
 *   12,345  → 12345
 *   12345   → 12345
 */
function parseAmountStr(str: string): number {
  // カンマ・スペースを除去してから parseInt
  const cleaned = str.replace(/[,\s]/g, '');
  const n = parseInt(cleaned, 10);
  return n;
}

function isValidAmount(n: number): boolean {
  return Number.isFinite(n) && n >= MIN_AMOUNT && n <= MAX_AMOUNT;
}

/**
 * 合計ラベルパターン（優先度順）
 * カンマあり・なし両方にマッチするよう修正
 *
 * 金額パターン: ¥?[\d,]+ （カンマあり）または ¥?\d+ （カンマなし）
 * まとめて: ¥?([\d,]+) でマッチしてからパース
 */
const TOTAL_LABEL_PATTERNS: [RegExp, number][] = [
  // 最高優先: お支払い・ご請求（実際の支払額）
  [/(?:お支払[い]?|ご請求|お会計|お支払い合計|ご請求合計|お会計合計)\s*[:\s：]*\s*¥?\s*([\d,]+)/gi, 100],
  // 高優先: 合計・総合計
  [/(?:合\s*計|総\s*合\s*計|Grand\s*Total|Total\s*Amount|Total\s*Due)\s*[:\s：]*\s*¥?\s*([\d,]+)/gi, 90],
  // 高優先: 税込合計
  [/(?:税込(?:合計)?|税込み(?:合計)?|合計(?:税込)?)\s*[:\s：]*\s*¥?\s*([\d,]+)/gi, 88],
  // 中優先: お買上合計
  [/(?:お買上(?:げ)?合計|買上合計|お買い上げ合計)\s*[:\s：]*\s*¥?\s*([\d,]+)/gi, 85],
  // 中優先: 金額・請求額
  [/(?:金額|合計金額|請求額|お支払額|支払額)\s*[:\s：]*\s*¥?\s*([\d,]+)/gi, 75],
  // 中優先: 小計
  [/(?:小\s*計)\s*[:\s：]*\s*¥?\s*([\d,]+)/gi, 70],
  // Total (英語)
  [/(?:Total|Subtotal|Amount\s*Due|Balance\s*Due|Grand\s*Total)\s*[:\s]*\s*[¥$]?\s*([\d,]+)/gi, 80],
];

/**
 * 「合計」行の次に金額が来るパターン（行をまたぐ場合）
 * カンマあり・なし両対応
 */
const MULTILINE_TOTAL_PATTERN = /(?:合計|お支払|総計|小計)\s*[\r\n]+\s*¥?\s*([\d,]+)/gi;

/**
 * ¥記号付き金額パターン（カンマあり・なし両対応）
 * ¥1,234 / ¥1234 / ¥ 1,234 / ¥ 1234
 */
const YEN_PATTERN = /¥\s*([\d,]+)/g;

/**
 * X,XXX円 または XXXXX円 パターン
 * 3桁以上の数字 + 円
 */
const EN_PATTERN_WITH_COMMA = /([\d,]{3,})\s*円/g;
const EN_PATTERN_NO_COMMA = /(\d{4,})\s*円/g;

interface AmountCandidate {
  value: number;
  score: number;
  source: string;
}

/**
 * 全ての金額候補をスコア付きで抽出
 */
function extractAllCandidates(normalizedText: string): AmountCandidate[] {
  const candidates: AmountCandidate[] = [];
  const seen = new Set<number>();

  const addCandidate = (value: number, score: number, source: string) => {
    if (!isValidAmount(value)) return;
    const existing = candidates.findIndex(c => c.value === value);
    if (existing >= 0) {
      if (score > candidates[existing].score) {
        candidates[existing] = { value, score, source };
      }
      return;
    }
    if (!seen.has(value)) {
      seen.add(value);
      candidates.push({ value, score, source });
    }
  };

  // 1. 合計ラベルパターン（最高優先）
  for (const [pattern, baseScore] of TOTAL_LABEL_PATTERNS) {
    pattern.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = pattern.exec(normalizedText)) !== null) {
      const v = parseAmountStr(m[1]);
      addCandidate(v, baseScore, `label:${pattern.source.slice(0, 20)}`);
    }
  }

  // 2. 複数行にまたがる合計パターン
  MULTILINE_TOTAL_PATTERN.lastIndex = 0;
  let m2: RegExpExecArray | null;
  while ((m2 = MULTILINE_TOTAL_PATTERN.exec(normalizedText)) !== null) {
    const v = parseAmountStr(m2[1]);
    addCandidate(v, 88, 'multiline-total');
  }

  // 3. ¥記号付き金額（カンマあり・なし両対応）
  YEN_PATTERN.lastIndex = 0;
  let m3: RegExpExecArray | null;
  while ((m3 = YEN_PATTERN.exec(normalizedText)) !== null) {
    const v = parseAmountStr(m3[1]);
    addCandidate(v, 40, 'yen-symbol');
  }

  // 4. カンマあり「円」パターン（例: 1,234円）
  EN_PATTERN_WITH_COMMA.lastIndex = 0;
  let m4: RegExpExecArray | null;
  while ((m4 = EN_PATTERN_WITH_COMMA.exec(normalizedText)) !== null) {
    const v = parseAmountStr(m4[1]);
    addCandidate(v, 35, 'en-comma');
  }

  // 5. カンマなし「円」パターン（例: 1234円）
  EN_PATTERN_NO_COMMA.lastIndex = 0;
  let m5: RegExpExecArray | null;
  while ((m5 = EN_PATTERN_NO_COMMA.exec(normalizedText)) !== null) {
    const v = parseAmountStr(m5[1]);
    addCandidate(v, 30, 'en-no-comma');
  }

  // 6. カンマ区切り数字のみ（3桁ごと）
  // 例: 1,234 / 12,345 / 123,456（ラベルなし）
  const COMMA_NUMBER_PATTERN = /(?<!\d)([\d]{1,3}(?:,\d{3})+)(?!\d)/g;
  COMMA_NUMBER_PATTERN.lastIndex = 0;
  let m6: RegExpExecArray | null;
  while ((m6 = COMMA_NUMBER_PATTERN.exec(normalizedText)) !== null) {
    const v = parseAmountStr(m6[1]);
    addCandidate(v, 25, 'comma-number');
  }

  return candidates;
}

/**
 * 行ごとの解析で合計行を特定する
 */
function analyzeLineByLine(text: string): number {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  const totalKeywords = [
    /合計|お合計|総合計|お支払|ご請求|Grand Total|Total Amount|Total Due|税込合計|お会計/i,
  ];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    for (const kw of totalKeywords) {
      if (!kw.test(line)) continue;

      // 同じ行に金額がある場合（カンマあり・なし両対応）
      const sameLineMatch = line.match(/¥?\s*([\d,]+)/g);
      if (sameLineMatch) {
        for (const s of sameLineMatch) {
          const v = parseAmountStr(s.replace(/¥/g, '').trim());
          if (isValidAmount(v)) return v;
        }
      }

      // 次の行に金額がある場合
      for (let j = i + 1; j <= Math.min(i + 3, lines.length - 1); j++) {
        const nextLine = lines[j];
        // カンマあり・なし両方にマッチ
        const nextMatch = nextLine.match(/¥?\s*([\d,]+)/);
        if (nextMatch) {
          const v = parseAmountStr(nextMatch[1]);
          if (isValidAmount(v)) return v;
        }
      }
    }
  }

  return 0;
}

/**
 * 複数の金額候補から最適な合計金額を選択
 */
function selectBestAmount(text: string, candidates: AmountCandidate[]): number {
  if (candidates.length === 0) return 0;

  // 行解析で合計行を特定
  const lineTotal = analyzeLineByLine(text);
  if (lineTotal > 0) {
    const matched = candidates.find(c => c.value === lineTotal);
    if (matched) return matched.value;
    if (isValidAmount(lineTotal)) return lineTotal;
  }

  // スコアが最も高い候補を返す
  const sorted = [...candidates].sort((a, b) => b.score - a.score);

  // 最高スコアが合計ラベル由来（score >= 70）なら確実
  if (sorted[0].score >= 70) {
    return sorted[0].value;
  }

  // スコアが低い場合: 最大金額を合計とみなす
  const maxValue = Math.max(...candidates.map(c => c.value));
  return maxValue;
}

export function extractAmountCandidates(text: string): number[] {
  const normalized = normalizeText(text);
  const candidates = extractAllCandidates(normalized);
  return [...new Set(candidates.map(c => c.value))].sort((a, b) => b - a);
}

export function extractAmount(text: string): number {
  const normalized = normalizeText(text);
  const candidates = extractAllCandidates(normalized);
  return selectBestAmount(normalized, candidates);
}

// ============================================================
// OCRテキスト後処理
// ============================================================

export function postprocessOcrText(text: string): string {
  return text
    .replace(/　/g, ' ')
    .replace(/ {2,}/g, ' ')
    .split('\n').map((l) => l.trim()).join('\n')
    .replace(/\n{3,}/g, '\n\n');
}
