/**
 * VendorPresetModal.tsx
 * よく使う購入先のプリセット管理モーダル
 */
import { useState } from 'react';
import { useReceiptStore, VendorPreset } from '../store/receiptStore';
import { ACCOUNT_TITLES, TAX_CATEGORIES } from '../types/receipt';
import { cn } from '../utils/cn';
import {
  X, Plus, Trash2, Edit3, Save, Star, Building2,
  ChevronDown, ChevronUp, Search, Check, RotateCcw
} from 'lucide-react';

interface Props {
  onClose: () => void;
  onSelect?: (preset: VendorPreset) => void;
  darkMode?: boolean;
  selectMode?: boolean; // true=選択モード, false=管理モード
}

const DEFAULT_PRESETS: Omit<VendorPreset, 'id' | 'usageCount' | 'lastUsed'>[] = [
  { name: 'コンビニ（セブン）', category: '食費・飲食', accountTitle: '消耗品費', taxCategory: '軽減税率（8%）', memo: '' },
  { name: 'コンビニ（ファミマ）', category: '食費・飲食', accountTitle: '消耗品費', taxCategory: '軽減税率（8%）', memo: '' },
  { name: 'コンビニ（ローソン）', category: '食費・飲食', accountTitle: '消耗品費', taxCategory: '軽減税率（8%）', memo: '' },
  { name: 'スターバックス', category: '接待交際費', accountTitle: '会議費', taxCategory: '課税（10%）', memo: '' },
  { name: 'ドトールコーヒー', category: '接待交際費', accountTitle: '会議費', taxCategory: '課税（10%）', memo: '' },
  { name: 'スーパー（食料品）', category: '食費・飲食', accountTitle: '消耗品費', taxCategory: '軽減税率（8%）', memo: '' },
  { name: 'Amazon', category: '事務用品', accountTitle: '消耗品費', taxCategory: '課税（10%）', memo: '' },
  { name: 'ヨドバシカメラ', category: '事務用品', accountTitle: '消耗品費', taxCategory: '課税（10%）', memo: '' },
  { name: 'ビックカメラ', category: '事務用品', accountTitle: '消耗品費', taxCategory: '課税（10%）', memo: '' },
  { name: 'JR（交通費）', category: '交通費', accountTitle: '旅費交通費', taxCategory: '非課税', memo: '' },
  { name: 'タクシー', category: '交通費', accountTitle: '旅費交通費', taxCategory: '課税（10%）', memo: '' },
  { name: 'ガソリンスタンド', category: '交通費', accountTitle: '旅費交通費', taxCategory: '課税（10%）', memo: '' },
  { name: 'ホテル（宿泊）', category: '宿泊費', accountTitle: '旅費交通費', taxCategory: '課税（10%）', memo: '' },
  { name: '薬局・ドラッグストア', category: '医療費', accountTitle: '福利厚生費', taxCategory: '軽減税率（8%）', memo: '' },
  { name: '郵便局', category: '通信費', accountTitle: '通信費', taxCategory: '非課税', memo: '' },
];

const CATEGORY_COLORS: Record<string, string> = {
  '交通費': 'bg-blue-100 text-blue-700 border-blue-200',
  '食費・飲食': 'bg-orange-100 text-orange-700 border-orange-200',
  '宿泊費': 'bg-purple-100 text-purple-700 border-purple-200',
  '通信費': 'bg-teal-100 text-teal-700 border-teal-200',
  '事務用品': 'bg-yellow-100 text-yellow-800 border-yellow-200',
  '接待交際費': 'bg-pink-100 text-pink-700 border-pink-200',
  '医療費': 'bg-red-100 text-red-700 border-red-200',
  '光熱費': 'bg-green-100 text-green-700 border-green-200',
  'その他': 'bg-slate-100 text-slate-600 border-slate-200',
};

function getCategoryColor(cat: string): string {
  return CATEGORY_COLORS[cat] ?? 'bg-indigo-100 text-indigo-700 border-indigo-200';
}

interface EditFormState {
  name: string;
  category: string;
  accountTitle: string;
  taxCategory: string;
  memo: string;
}

function PresetEditForm({
  initial,
  categories,
  onSave,
  onCancel,
  darkMode,
}: {
  initial?: Partial<EditFormState>;
  categories: string[];
  onSave: (data: EditFormState) => void;
  onCancel: () => void;
  darkMode: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [category, setCategory] = useState(initial?.category ?? 'その他');
  const [accountTitle, setAccountTitle] = useState(initial?.accountTitle ?? '');
  const [taxCategory, setTaxCategory] = useState(initial?.taxCategory ?? '');
  const [memo, setMemo] = useState(initial?.memo ?? '');

  const inp = cn(
    'w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
    darkMode ? 'bg-slate-600 border-slate-500 text-slate-200' : 'bg-white border-slate-300 text-slate-800'
  );

  return (
    <div className={cn(
      'rounded-xl border p-4 flex flex-col gap-3',
      darkMode ? 'bg-slate-700 border-slate-600' : 'bg-blue-50 border-blue-200'
    )}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <label className={cn('text-xs font-bold mb-1 block', darkMode ? 'text-slate-300' : 'text-slate-600')}>
            購入先名 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="例: スターバックス渋谷店"
            className={inp}
            autoFocus
          />
        </div>
        <div>
          <label className={cn('text-xs font-bold mb-1 block', darkMode ? 'text-slate-300' : 'text-slate-600')}>カテゴリ</label>
          <select value={category} onChange={e => setCategory(e.target.value)} className={inp}>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className={cn('text-xs font-bold mb-1 block', darkMode ? 'text-slate-300' : 'text-slate-600')}>勘定科目</label>
          <select value={accountTitle} onChange={e => setAccountTitle(e.target.value)} className={inp}>
            {ACCOUNT_TITLES.map(a => <option key={a} value={a}>{a || '未設定'}</option>)}
          </select>
        </div>
        <div>
          <label className={cn('text-xs font-bold mb-1 block', darkMode ? 'text-slate-300' : 'text-slate-600')}>税区分</label>
          <select value={taxCategory} onChange={e => setTaxCategory(e.target.value)} className={inp}>
            {TAX_CATEGORIES.map(t => <option key={t} value={t}>{t || '未設定'}</option>)}
          </select>
        </div>
        <div>
          <label className={cn('text-xs font-bold mb-1 block', darkMode ? 'text-slate-300' : 'text-slate-600')}>メモ</label>
          <input
            type="text"
            value={memo}
            onChange={e => setMemo(e.target.value)}
            placeholder="備考（任意）"
            className={inp}
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className={cn(
          'px-4 py-2 rounded-lg border text-sm transition',
          darkMode ? 'border-slate-500 text-slate-400 hover:bg-slate-600' : 'border-slate-300 text-slate-600 hover:bg-slate-100'
        )}>
          キャンセル
        </button>
        <button
          onClick={() => { if (name.trim()) onSave({ name: name.trim(), category, accountTitle, taxCategory, memo }); }}
          disabled={!name.trim()}
          className={cn(
            'flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-medium transition',
            name.trim() ? 'bg-blue-600 hover:bg-blue-700' : 'bg-slate-300 cursor-not-allowed'
          )}
        >
          <Save className="w-4 h-4" />保存
        </button>
      </div>
    </div>
  );
}

export function VendorPresetModal({ onClose, onSelect, darkMode = false, selectMode = false }: Props) {
  const {
    vendorPresets, addVendorPreset, updateVendorPreset,
    deleteVendorPreset, useVendorPreset, getTopVendors, customCategories
  } = useReceiptStore();

  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showDefaults, setShowDefaults] = useState(false);
  const [filterCat, setFilterCat] = useState<string>('すべて');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const dm = darkMode;

  const categories = ['すべて', ...customCategories];

  const filtered = vendorPresets.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCat === 'すべて' || p.category === filterCat;
    return matchSearch && matchCat;
  });

  const topVendors = getTopVendors(5);

  const handleSelect = (preset: VendorPreset) => {
    const updated = useVendorPreset(preset.id);
    if (onSelect && updated) {
      onSelect(updated);
      onClose();
    } else {
      setSelectedId(preset.id === selectedId ? null : preset.id);
    }
  };

  const handleAddDefaults = () => {
    const existingNames = new Set(vendorPresets.map(p => p.name));
    DEFAULT_PRESETS.forEach(p => {
      if (!existingNames.has(p.name)) {
        addVendorPreset(p);
      }
    });
    setShowDefaults(false);
  };

  const card = cn(
    'rounded-2xl border',
    dm ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200'
  );
  const text = dm ? 'text-slate-200' : 'text-slate-700';
  const sub = dm ? 'text-slate-400' : 'text-slate-500';
  const inp = cn(
    'rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
    dm ? 'bg-slate-700 border-slate-600 text-slate-200 placeholder:text-slate-500' : 'bg-white border-slate-300 text-slate-700'
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-3">
      <div className={cn(
        'w-full max-w-2xl flex flex-col rounded-2xl shadow-2xl overflow-hidden max-h-[95vh]',
        dm ? 'bg-slate-800' : 'bg-slate-50'
      )}>

        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold flex items-center gap-2">
              <Star className="w-5 h-5" />
              {selectMode ? '購入先を選択' : 'よく使う購入先 管理'}
            </h2>
            <p className="text-amber-100 text-xs mt-0.5">
              {selectMode
                ? 'プリセットから選択すると入力を省略できます'
                : '購入先・カテゴリ・勘定科目をまとめて登録'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-auto flex-1 p-5 flex flex-col gap-4">

          {/* よく使う上位5件 */}
          {topVendors.length > 0 && (
            <div className={cn('p-4 rounded-xl border', dm ? 'bg-amber-900/20 border-amber-700' : 'bg-amber-50 border-amber-200')}>
              <h3 className={cn('text-xs font-bold mb-2 flex items-center gap-1', dm ? 'text-amber-300' : 'text-amber-700')}>
                <Star className="w-3.5 h-3.5" />よく使う購入先（使用頻度順）
              </h3>
              <div className="flex flex-wrap gap-2">
                {topVendors.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleSelect(p)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border transition hover:shadow-md',
                      getCategoryColor(p.category)
                    )}
                  >
                    <Building2 className="w-3 h-3" />
                    {p.name}
                    <span className="opacity-60 text-[9px]">×{p.usageCount}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 検索・フィルター */}
          <div className="flex gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="購入先を検索..."
                className={cn(inp, 'pl-9 w-full')}
              />
            </div>
            <select
              value={filterCat}
              onChange={e => setFilterCat(e.target.value)}
              className={cn(inp, 'min-w-[130px]')}
            >
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {/* 追加ボタン群 */}
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition"
            >
              <Plus className="w-4 h-4" />
              新しい購入先を追加
            </button>
            <button
              onClick={() => setShowDefaults(!showDefaults)}
              className={cn(
                'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium border transition',
                dm ? 'border-slate-600 text-slate-300 hover:bg-slate-700' : 'border-slate-300 text-slate-600 hover:bg-slate-50'
              )}
            >
              <RotateCcw className="w-4 h-4" />
              デフォルトを追加
              {showDefaults ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>

          {/* デフォルトプリセット一覧 */}
          {showDefaults && (
            <div className={cn('rounded-xl border p-4', dm ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200')}>
              <div className="flex items-center justify-between mb-3">
                <p className={cn('text-xs font-bold', text)}>デフォルトプリセット（{DEFAULT_PRESETS.length}件）</p>
                <button
                  onClick={handleAddDefaults}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-medium transition"
                >
                  <Plus className="w-3 h-3" />未登録のみ一括追加
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {DEFAULT_PRESETS.map(p => {
                  const exists = vendorPresets.some(vp => vp.name === p.name);
                  return (
                    <span
                      key={p.name}
                      className={cn(
                        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border font-medium',
                        exists ? 'opacity-40' : getCategoryColor(p.category)
                      )}
                    >
                      {exists && <Check className="w-3 h-3" />}
                      {p.name}
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* 新規追加フォーム */}
          {showAddForm && (
            <PresetEditForm
              categories={customCategories}
              onSave={(data) => {
                addVendorPreset(data);
                setShowAddForm(false);
              }}
              onCancel={() => setShowAddForm(false)}
              darkMode={dm}
            />
          )}

          {/* プリセット一覧 */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className={cn('text-xs font-bold', sub)}>
                {filtered.length} 件
                {vendorPresets.length !== filtered.length && ` / 全${vendorPresets.length}件`}
              </p>
            </div>

            {filtered.length === 0 ? (
              <div className={cn('rounded-xl border p-8 text-center', card)}>
                <Building2 className={cn('w-12 h-12 mx-auto mb-3 opacity-20', text)} />
                <p className={cn('text-sm', sub)}>
                  {vendorPresets.length === 0
                    ? '購入先プリセットがありません。「新しい購入先を追加」または「デフォルトを追加」してください。'
                    : '検索条件に一致する購入先がありません。'}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {filtered.map(preset => {
                  const isEditing = editingId === preset.id;
                  const isSelected = selectedId === preset.id;

                  return (
                    <div
                      key={preset.id}
                      className={cn(
                        'rounded-xl border transition',
                        isSelected
                          ? 'border-blue-500 shadow-md'
                          : dm ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200 hover:border-slate-300',
                      )}
                    >
                      {isEditing ? (
                        <div className="p-3">
                          <PresetEditForm
                            initial={preset}
                            categories={customCategories}
                            onSave={(data) => {
                              updateVendorPreset(preset.id, data);
                              setEditingId(null);
                            }}
                            onCancel={() => setEditingId(null)}
                            darkMode={dm}
                          />
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 p-3">
                          {/* カテゴリバッジ */}
                          <span className={cn(
                            'shrink-0 px-2 py-0.5 rounded-full text-[10px] font-bold border',
                            getCategoryColor(preset.category)
                          )}>
                            {preset.category}
                          </span>

                          {/* 名前・詳細 */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className={cn('font-bold text-sm truncate', text)}>{preset.name}</p>
                              {preset.usageCount > 0 && (
                                <span className={cn('text-[10px] shrink-0', sub)}>
                                  {preset.usageCount}回使用
                                </span>
                              )}
                            </div>
                            <div className="flex gap-2 flex-wrap mt-0.5">
                              {preset.accountTitle && (
                                <span className={cn('text-[10px]', sub)}>{preset.accountTitle}</span>
                              )}
                              {preset.taxCategory && (
                                <span className={cn('text-[10px]', sub)}>{preset.taxCategory}</span>
                              )}
                              {preset.memo && (
                                <span className={cn('text-[10px] truncate max-w-[150px]', sub)}>{preset.memo}</span>
                              )}
                            </div>
                          </div>

                          {/* 操作ボタン */}
                          <div className="flex items-center gap-1 shrink-0">
                            {selectMode || onSelect ? (
                              <button
                                onClick={() => handleSelect(preset)}
                                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition"
                              >
                                <Check className="w-3.5 h-3.5" />
                                選択
                              </button>
                            ) : (
                              <button
                                onClick={() => handleSelect(preset)}
                                className={cn(
                                  'px-2.5 py-1.5 rounded-lg text-xs font-medium border transition',
                                  isSelected
                                    ? 'bg-blue-600 text-white border-blue-600'
                                    : dm ? 'border-slate-500 text-slate-300 hover:bg-slate-600' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
                                )}
                              >
                                {isSelected ? '✓ 選択中' : '選択'}
                              </button>
                            )}
                            <button
                              onClick={() => setEditingId(preset.id)}
                              className={cn(
                                'p-1.5 rounded-lg transition',
                                dm ? 'hover:bg-slate-600 text-slate-400 hover:text-slate-200' : 'hover:bg-slate-100 text-slate-400 hover:text-slate-600'
                              )}
                              title="編集"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => {
                                if (confirm(`「${preset.name}」を削除しますか？`)) {
                                  deleteVendorPreset(preset.id);
                                }
                              }}
                              className={cn(
                                'p-1.5 rounded-lg transition',
                                dm ? 'hover:bg-red-900/30 text-slate-400 hover:text-red-400' : 'hover:bg-red-50 text-slate-400 hover:text-red-500'
                              )}
                              title="削除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* フッター */}
        <div className={cn(
          'flex items-center justify-between px-5 py-4 border-t shrink-0',
          dm ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'
        )}>
          <p className={cn('text-xs', sub)}>
            {vendorPresets.length}件のプリセット登録済み
          </p>
          <button
            onClick={onClose}
            className="px-5 py-2.5 rounded-xl bg-slate-600 hover:bg-slate-700 text-white text-sm font-medium transition"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
