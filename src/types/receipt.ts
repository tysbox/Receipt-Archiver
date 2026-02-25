export type Category = string;

export const DEFAULT_CATEGORIES: Category[] = [
  '交通費',
  '食費・飲食',
  '宿泊費',
  '通信費',
  '事務用品',
  '接待交際費',
  '医療費',
  '光熱費',
  'その他',
];

// カスタムカテゴリ（localStorage で管理）
const CATEGORY_STORAGE_KEY = 'receipt_custom_categories_v1';

export function loadCategories(): Category[] {
  try {
    const raw = localStorage.getItem(CATEGORY_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [...DEFAULT_CATEGORIES];
}

export function saveCategories(cats: Category[]) {
  try {
    localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(cats));
  } catch { /* ignore */ }
}

// 動的に参照できるよう関数で返す
export function getCategories(): Category[] {
  return loadCategories();
}

// 後方互換性のため（既存コードが CATEGORIES を直接参照している箇所用）
export let CATEGORIES: Category[] = loadCategories();

/** 勘定科目（適用） */
export type AccountTitle = string;

export const DEFAULT_ACCOUNT_TITLES: string[] = [
  '旅費交通費',
  '会議費',
  '接待交際費',
  '消耗品費',
  '通信費',
  '水道光熱費',
  '福利厚生費',
  '広告宣伝費',
  '研修費',
  '雑費',
];

// カスタム勘定科目（localStorage管理）
const ACCOUNT_TITLE_STORAGE_KEY = 'receipt_account_titles_v1';

export function loadAccountTitles(): string[] {
  try {
    const raw = localStorage.getItem(ACCOUNT_TITLE_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [...DEFAULT_ACCOUNT_TITLES];
}

export function saveAccountTitlesList(titles: string[]) {
  try {
    localStorage.setItem(ACCOUNT_TITLE_STORAGE_KEY, JSON.stringify(titles));
  } catch { /* ignore */ }
}

// 後方互換性（既存コードの ACCOUNT_TITLES 参照用）
export let ACCOUNT_TITLES: string[] = ['', ...loadAccountTitles()];

/** 税区分 */
export type TaxCategory =
  | '課税（10%）'
  | '軽減税率（8%）'
  | '非課税'
  | '不課税'
  | '';

export const TAX_CATEGORIES: TaxCategory[] = [
  '',
  '課税（10%）',
  '軽減税率（8%）',
  '非課税',
  '不課税',
];

export interface Receipt {
  id: string;
  filename: string;
  date: string;           // YYYY-MM-DD
  vendor: string;         // 支払先
  amount: number;         // 金額（円）
  taxAmount: number;      // 消費税額
  category: Category;
  accountTitle: AccountTitle; // 勘定科目（適用）
  taxCategory: TaxCategory;   // 税区分
  purpose: string;            // 用途・適用（自由記述）
  memo: string;
  tags: string[];             // タグリスト
  originalType: 'pdf' | 'image';
  croppedImageData: string;   // base64 cropped image
  pdfData: string;            // base64 pdf
  createdAt: string;          // ISO timestamp
  ocrRawText: string;         // OCR生テキスト
  ocrConfidence: number;      // OCR信頼度(0-100)
}

export type SortKey = 'date' | 'amount' | 'vendor' | 'category' | 'createdAt';
export type SortOrder = 'asc' | 'desc';

export interface FilterState {
  category: Category | 'すべて';
  accountTitle: AccountTitle | 'すべて';
  dateFrom: string;
  dateTo: string;
  keyword: string;
  tags: string[];
}
