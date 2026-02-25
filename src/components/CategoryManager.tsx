/**
 * CategoryManager.tsx
 * カテゴリのカスタマイズ管理モーダル
 */
import { useState } from 'react';
import { useReceiptStore } from '../store/receiptStore';
import { DEFAULT_CATEGORIES } from '../types/receipt';
import { cn } from '../utils/cn';
import {
  X, Plus, Trash2, GripVertical, RotateCcw,
  Tag, Check, AlertTriangle
} from 'lucide-react';

interface Props {
  onClose: () => void;
  darkMode?: boolean;
}

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

const PRESET_COLORS = [
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-orange-100 text-orange-700 border-orange-200',
  'bg-purple-100 text-purple-700 border-purple-200',
  'bg-teal-100 text-teal-700 border-teal-200',
  'bg-yellow-100 text-yellow-800 border-yellow-200',
  'bg-pink-100 text-pink-700 border-pink-200',
  'bg-red-100 text-red-700 border-red-200',
  'bg-green-100 text-green-700 border-green-200',
  'bg-indigo-100 text-indigo-700 border-indigo-200',
  'bg-cyan-100 text-cyan-700 border-cyan-200',
  'bg-rose-100 text-rose-700 border-rose-200',
  'bg-lime-100 text-lime-800 border-lime-200',
];

function getCategoryColor(cat: string, index: number): string {
  return CATEGORY_COLORS[cat] ?? PRESET_COLORS[index % PRESET_COLORS.length];
}

// おすすめカテゴリのサジェスト
const SUGGESTED_CATEGORIES = [
  '研究費', '教育・研修費', 'サブスクリプション', 'ソフトウェア',
  '駐車場', '保険料', '税金・公課', '広告宣伝費',
  '新聞・書籍', 'クリーニング', 'ギフト・贈答品', '慶弔費',
  '工具・消耗品', 'リース料', 'メンテナンス費', 'プロジェクト費',
];

export function CategoryManager({ onClose, darkMode = false }: Props) {
  const { customCategories, addCategory, removeCategory, reorderCategories, receipts } = useReceiptStore();
  const [newCat, setNewCat] = useState('');
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saved, setSaved] = useState(false);

  const dm = darkMode;

  // カテゴリ別使用件数
  const usageCount = (cat: string) => receipts.filter(r => r.category === cat).length;

  const handleAdd = () => {
    const trimmed = newCat.trim();
    if (!trimmed) return;
    if (customCategories.includes(trimmed)) return;
    addCategory(trimmed);
    setNewCat('');
    flashSaved();
  };

  const handleRemove = (cat: string) => {
    const count = usageCount(cat);
    if (count > 0) {
      if (!confirm(`「${cat}」は${count}件の領収書で使用中です。削除しますか？\n（領収書のカテゴリは変更されません）`)) return;
    }
    removeCategory(cat);
    flashSaved();
  };

  const handleReset = () => {
    if (!confirm('カテゴリをデフォルトに戻しますか？\nカスタムカテゴリは削除されます。')) return;
    reorderCategories([...DEFAULT_CATEGORIES]);
    flashSaved();
  };

  const flashSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  // ドラッグ＆ドロップによる並び替え
  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    setDragOverIdx(idx);
  };
  const handleDrop = (idx: number) => {
    if (dragIdx === null || dragIdx === idx) {
      setDragIdx(null);
      setDragOverIdx(null);
      return;
    }
    const next = [...customCategories];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(idx, 0, moved);
    reorderCategories(next);
    setDragIdx(null);
    setDragOverIdx(null);
    flashSaved();
  };

  const inp = cn(
    'flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
    dm ? 'bg-slate-700 border-slate-600 text-slate-200 placeholder:text-slate-500' : 'bg-white border-slate-300 text-slate-700'
  );
  const text = dm ? 'text-slate-200' : 'text-slate-700';
  const sub = dm ? 'text-slate-400' : 'text-slate-500';

  const availableSuggestions = SUGGESTED_CATEGORIES.filter(s => !customCategories.includes(s));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-3">
      <div className={cn(
        'w-full max-w-lg flex flex-col rounded-2xl shadow-2xl overflow-hidden max-h-[95vh]',
        dm ? 'bg-slate-800' : 'bg-slate-50'
      )}>

        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-violet-700 to-purple-700 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold flex items-center gap-2">
              <Tag className="w-5 h-5" />
              カテゴリのカスタマイズ
            </h2>
            <p className="text-violet-200 text-xs mt-0.5">
              カテゴリの追加・削除・並び替えができます
            </p>
          </div>
          <div className="flex items-center gap-2">
            {saved && (
              <span className="flex items-center gap-1 text-xs text-green-300 font-medium">
                <Check className="w-3.5 h-3.5" />保存済み
              </span>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="overflow-auto flex-1 p-5 flex flex-col gap-4">

          {/* 新規カテゴリ追加 */}
          <div className={cn('rounded-xl border p-4', dm ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200')}>
            <h3 className={cn('text-sm font-bold mb-3 flex items-center gap-2', text)}>
              <Plus className="w-4 h-4 text-blue-500" />
              新しいカテゴリを追加
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCat}
                onChange={e => setNewCat(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                placeholder="カテゴリ名を入力（例: 研究費）"
                className={inp}
              />
              <button
                onClick={handleAdd}
                disabled={!newCat.trim() || customCategories.includes(newCat.trim())}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-medium transition shrink-0',
                  newCat.trim() && !customCategories.includes(newCat.trim())
                    ? 'bg-blue-600 hover:bg-blue-700'
                    : 'bg-slate-300 cursor-not-allowed'
                )}
              >
                <Plus className="w-4 h-4" />追加
              </button>
            </div>
            {newCat.trim() && customCategories.includes(newCat.trim()) && (
              <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />このカテゴリは既に存在します
              </p>
            )}

            {/* サジェスト */}
            <div className="mt-3">
              <button
                onClick={() => setShowSuggestions(!showSuggestions)}
                className={cn('text-xs font-medium transition', dm ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700')}
              >
                {showSuggestions ? '▲ おすすめカテゴリを隠す' : '▼ おすすめカテゴリから選ぶ'}
              </button>
              {showSuggestions && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {availableSuggestions.map((s, i) => (
                    <button
                      key={s}
                      onClick={() => {
                        addCategory(s);
                        flashSaved();
                      }}
                      className={cn(
                        'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border font-medium transition hover:opacity-80',
                        PRESET_COLORS[i % PRESET_COLORS.length]
                      )}
                    >
                      <Plus className="w-3 h-3" />{s}
                    </button>
                  ))}
                  {availableSuggestions.length === 0 && (
                    <span className={cn('text-xs', sub)}>すべてのおすすめカテゴリが追加済みです</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* カテゴリ一覧（ドラッグ並び替え） */}
          <div className={cn('rounded-xl border p-4', dm ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200')}>
            <div className="flex items-center justify-between mb-3">
              <h3 className={cn('text-sm font-bold flex items-center gap-2', text)}>
                <Tag className="w-4 h-4 text-violet-500" />
                カテゴリ一覧（{customCategories.length}件）
              </h3>
              <div className="flex items-center gap-2">
                <span className={cn('text-[10px]', sub)}>ドラッグで並び替え</span>
                <button
                  onClick={handleReset}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border transition',
                    dm ? 'border-slate-500 text-slate-400 hover:bg-slate-600' : 'border-slate-300 text-slate-500 hover:bg-slate-50'
                  )}
                  title="デフォルトに戻す"
                >
                  <RotateCcw className="w-3 h-3" />リセット
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              {customCategories.map((cat, idx) => {
                const count = usageCount(cat);
                const isDefault = DEFAULT_CATEGORIES.includes(cat);
                const isDraggingOver = dragOverIdx === idx;

                return (
                  <div
                    key={cat}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={e => handleDragOver(e, idx)}
                    onDrop={() => handleDrop(idx)}
                    onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-xl border transition cursor-grab active:cursor-grabbing',
                      isDraggingOver
                        ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                        : dragIdx === idx
                        ? 'opacity-40'
                        : dm ? 'bg-slate-600 border-slate-500 hover:border-slate-400' : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    )}
                  >
                    <GripVertical className={cn('w-4 h-4 shrink-0', sub)} />

                    <span className={cn(
                      'px-2.5 py-0.5 rounded-full text-xs font-medium border shrink-0',
                      getCategoryColor(cat, idx)
                    )}>
                      {cat}
                    </span>

                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      {isDefault && (
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded border shrink-0', dm ? 'bg-slate-700 border-slate-600 text-slate-400' : 'bg-white border-slate-200 text-slate-400')}>
                          デフォルト
                        </span>
                      )}
                      {count > 0 && (
                        <span className={cn('text-[10px]', sub)}>{count}件使用中</span>
                      )}
                    </div>

                    <span className={cn('text-xs font-mono w-4 text-center', sub)}>{idx + 1}</span>

                    <button
                      onClick={() => handleRemove(cat)}
                      className={cn(
                        'p-1.5 rounded-lg transition shrink-0',
                        dm ? 'hover:bg-red-900/30 text-slate-500 hover:text-red-400' : 'hover:bg-red-50 text-slate-400 hover:text-red-500'
                      )}
                      title="削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}

              {customCategories.length === 0 && (
                <div className={cn('text-center py-8 text-sm', sub)}>
                  カテゴリがありません。上のフォームから追加してください。
                </div>
              )}
            </div>
          </div>

          {/* 注意事項 */}
          <div className={cn('rounded-xl border p-3 text-xs', dm ? 'bg-slate-700 border-slate-600 text-slate-400' : 'bg-amber-50 border-amber-200 text-amber-700')}>
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold mb-1">カスタマイズの注意点</p>
                <ul className="space-y-1">
                  <li>• カテゴリを削除しても既存の領収書のカテゴリ設定は変わりません</li>
                  <li>• 並び替えはフォームの選択肢の順序に反映されます</li>
                  <li>• カテゴリ設定はブラウザに保存されます</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* フッター */}
        <div className={cn(
          'flex items-center justify-between px-5 py-4 border-t shrink-0',
          dm ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'
        )}>
          <p className={cn('text-xs flex items-center gap-1.5', sub)}>
            <Tag className="w-3.5 h-3.5 text-violet-500" />
            {customCategories.length}件のカテゴリ
          </p>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-bold transition"
          >
            <Check className="w-4 h-4" />完了
          </button>
        </div>
      </div>
    </div>
  );
}
