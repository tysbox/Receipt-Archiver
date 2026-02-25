import { create } from 'zustand';
import {
  Receipt, SortKey, SortOrder, FilterState, Category, AccountTitle,
  loadCategories, saveCategories,
  loadAccountTitles, saveAccountTitlesList,
} from '../types/receipt';

// ===== プリセットベンダー管理 =====
const VENDOR_PRESET_KEY = 'receipt_vendor_presets_v1';

export interface VendorPreset {
  id: string;
  name: string;
  category: Category;
  accountTitle: string;
  taxCategory: string;
  memo: string;
  usageCount: number;
  lastUsed: string;
}

function loadVendorPresets(): VendorPreset[] {
  try {
    const raw = localStorage.getItem(VENDOR_PRESET_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveVendorPresets(presets: VendorPreset[]) {
  try {
    localStorage.setItem(VENDOR_PRESET_KEY, JSON.stringify(presets));
  } catch { /* ignore */ }
}

// ===== カスタムカテゴリ管理 =====
const CATEGORY_STORAGE_KEY = 'receipt_custom_categories_v1';

function loadCustomCategories(): Category[] {
  try {
    const raw = localStorage.getItem(CATEGORY_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return loadCategories();
}

function saveCustomCategories(cats: Category[]) {
  try {
    localStorage.setItem(CATEGORY_STORAGE_KEY, JSON.stringify(cats));
    saveCategories(cats);
  } catch { /* ignore */ }
}

// ===== カスタム勘定科目管理 =====
function loadCustomAccountTitles(): string[] {
  return loadAccountTitles();
}

function saveCustomAccountTitles(titles: string[]) {
  saveAccountTitlesList(titles);
}

const STORAGE_KEY = 'receipt_archive_v2';

function loadFromStorage(): Receipt[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const old = localStorage.getItem('receipt_archive_v1');
      if (old) {
        const items: Receipt[] = JSON.parse(old);
        return items.map((r) => ({
          ...r,
          taxAmount: r.taxAmount ?? 0,
          accountTitle: r.accountTitle ?? '',
          taxCategory: r.taxCategory ?? '',
          purpose: r.purpose ?? '',
          tags: r.tags ?? [],
          ocrRawText: r.ocrRawText ?? '',
          ocrConfidence: r.ocrConfidence ?? 0,
        }));
      }
      return [];
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveToStorage(receipts: Receipt[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(receipts));
  } catch {
    console.error('Storage save failed');
  }
}

interface ReceiptStore {
  receipts: Receipt[];
  sortKey: SortKey;
  sortOrder: SortOrder;
  filter: FilterState;
  selectedId: string | null;

  // プリセットベンダー
  vendorPresets: VendorPreset[];
  addVendorPreset: (preset: Omit<VendorPreset, 'id' | 'usageCount' | 'lastUsed'>) => void;
  updateVendorPreset: (id: string, partial: Partial<VendorPreset>) => void;
  deleteVendorPreset: (id: string) => void;
  useVendorPreset: (id: string) => VendorPreset | undefined;
  getTopVendors: (n?: number) => VendorPreset[];

  // カスタムカテゴリ
  customCategories: Category[];
  addCategory: (cat: Category) => void;
  removeCategory: (cat: Category) => void;
  reorderCategories: (cats: Category[]) => void;

  // カスタム勘定科目
  customAccountTitles: string[];
  addAccountTitle: (title: string) => void;
  removeAccountTitle: (title: string) => void;
  reorderAccountTitles: (titles: string[]) => void;

  addReceipt: (r: Receipt) => void;
  updateReceipt: (id: string, partial: Partial<Receipt>) => void;
  deleteReceipt: (id: string) => void;
  setSortKey: (key: SortKey) => void;
  setSortOrder: (order: SortOrder) => void;
  setFilter: (f: Partial<FilterState>) => void;
  setSelectedId: (id: string | null) => void;
  getFiltered: () => Receipt[];
  getAllTags: () => string[];
}

export const useReceiptStore = create<ReceiptStore>((set, get) => ({
  receipts: loadFromStorage(),
  sortKey: 'date',
  sortOrder: 'desc',
  filter: {
    category: 'すべて',
    accountTitle: 'すべて',
    dateFrom: '',
    dateTo: '',
    keyword: '',
    tags: [],
  },
  selectedId: null,

  // ===== プリセットベンダー =====
  vendorPresets: loadVendorPresets(),

  addVendorPreset: (preset) => {
    const newPreset: VendorPreset = {
      ...preset,
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      usageCount: 0,
      lastUsed: new Date().toISOString(),
    };
    const next = [...get().vendorPresets, newPreset];
    saveVendorPresets(next);
    set({ vendorPresets: next });
  },

  updateVendorPreset: (id, partial) => {
    const next = get().vendorPresets.map(p => p.id === id ? { ...p, ...partial } : p);
    saveVendorPresets(next);
    set({ vendorPresets: next });
  },

  deleteVendorPreset: (id) => {
    const next = get().vendorPresets.filter(p => p.id !== id);
    saveVendorPresets(next);
    set({ vendorPresets: next });
  },

  useVendorPreset: (id) => {
    const preset = get().vendorPresets.find(p => p.id === id);
    if (!preset) return undefined;
    const next = get().vendorPresets.map(p =>
      p.id === id
        ? { ...p, usageCount: p.usageCount + 1, lastUsed: new Date().toISOString() }
        : p
    );
    saveVendorPresets(next);
    set({ vendorPresets: next });
    return preset;
  },

  getTopVendors: (n = 10) => {
    return [...get().vendorPresets]
      .sort((a, b) => b.usageCount - a.usageCount || b.lastUsed.localeCompare(a.lastUsed))
      .slice(0, n);
  },

  // ===== カスタムカテゴリ =====
  customCategories: loadCustomCategories(),

  addCategory: (cat) => {
    const current = get().customCategories;
    if (current.includes(cat)) return;
    const next = [...current, cat];
    saveCustomCategories(next);
    set({ customCategories: next });
  },

  removeCategory: (cat) => {
    const next = get().customCategories.filter(c => c !== cat);
    saveCustomCategories(next);
    set({ customCategories: next });
  },

  reorderCategories: (cats) => {
    saveCustomCategories(cats);
    set({ customCategories: cats });
  },

  // ===== カスタム勘定科目 =====
  customAccountTitles: loadCustomAccountTitles(),

  addAccountTitle: (title) => {
    const current = get().customAccountTitles;
    if (current.includes(title)) return;
    const next = [...current, title];
    saveCustomAccountTitles(next);
    set({ customAccountTitles: next });
  },

  removeAccountTitle: (title) => {
    const next = get().customAccountTitles.filter(t => t !== title);
    saveCustomAccountTitles(next);
    set({ customAccountTitles: next });
  },

  reorderAccountTitles: (titles) => {
    saveCustomAccountTitles(titles);
    set({ customAccountTitles: titles });
  },

  addReceipt: (r) => {
    const next = [...get().receipts, r];
    saveToStorage(next);
    set({ receipts: next });
  },

  updateReceipt: (id, partial) => {
    const next = get().receipts.map((r) => (r.id === id ? { ...r, ...partial } : r));
    saveToStorage(next);
    set({ receipts: next });
  },

  deleteReceipt: (id) => {
    const next = get().receipts.filter((r) => r.id !== id);
    saveToStorage(next);
    set({ receipts: next, selectedId: get().selectedId === id ? null : get().selectedId });
  },

  setSortKey: (key) => set({ sortKey: key }),
  setSortOrder: (order) => set({ sortOrder: order }),
  setFilter: (f) => set({ filter: { ...get().filter, ...f } }),
  setSelectedId: (id) => set({ selectedId: id }),

  getAllTags: () => {
    const tagSet = new Set<string>();
    get().receipts.forEach((r) => r.tags?.forEach((t) => tagSet.add(t)));
    return Array.from(tagSet).sort();
  },

  getFiltered: () => {
    const { receipts, filter, sortKey, sortOrder } = get();
    let list = [...receipts];

    if (filter.category !== 'すべて') {
      list = list.filter((r) => r.category === (filter.category as Category));
    }
    if (filter.accountTitle && filter.accountTitle !== 'すべて') {
      list = list.filter((r) => r.accountTitle === (filter.accountTitle as AccountTitle));
    }
    if (filter.dateFrom) {
      list = list.filter((r) => r.date >= filter.dateFrom);
    }
    if (filter.dateTo) {
      list = list.filter((r) => r.date <= filter.dateTo);
    }
    if (filter.keyword) {
      const kw = filter.keyword.toLowerCase();
      list = list.filter(
        (r) =>
          r.vendor.toLowerCase().includes(kw) ||
          r.memo.toLowerCase().includes(kw) ||
          r.filename.toLowerCase().includes(kw) ||
          r.purpose?.toLowerCase().includes(kw) ||
          r.tags?.some((t) => t.toLowerCase().includes(kw))
      );
    }
    if (filter.tags && filter.tags.length > 0) {
      list = list.filter((r) =>
        filter.tags.every((ft) => r.tags?.includes(ft))
      );
    }

    list.sort((a, b) => {
      let va: string | number = a[sortKey] ?? '';
      let vb: string | number = b[sortKey] ?? '';
      if (sortKey === 'amount') {
        va = Number(va);
        vb = Number(vb);
      }
      if (va < vb) return sortOrder === 'asc' ? -1 : 1;
      if (va > vb) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  },
}));
