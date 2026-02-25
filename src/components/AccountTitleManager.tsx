/**
 * AccountTitleManager.tsx
 * 勘定科目のカスタマイズ管理モーダル
 *
 * 機能:
 * - 勘定科目の追加・削除・並び替え（ドラッグ＆ドロップ）
 * - おすすめ勘定科目からワンクリック追加
 * - デフォルトへのリセット
 * - 各科目の使用件数表示
 */
import { useState } from 'react';
import { useReceiptStore } from '../store/receiptStore';
import { DEFAULT_ACCOUNT_TITLES } from '../types/receipt';
import { cn } from '../utils/cn';
import {
  X, Plus, Trash2, GripVertical, RotateCcw,
  BookOpen, Check, AlertTriangle, Settings2,
} from 'lucide-react';

interface Props {
  onClose: () => void;
  darkMode?: boolean;
}

// 各勘定科目のカラー（見た目の区別用）
const ACCOUNT_COLORS: Record<string, string> = {
  '旅費交通費':   'bg-blue-100 text-blue-700 border-blue-200',
  '会議費':       'bg-teal-100 text-teal-700 border-teal-200',
  '接待交際費':   'bg-pink-100 text-pink-700 border-pink-200',
  '消耗品費':     'bg-yellow-100 text-yellow-800 border-yellow-200',
  '通信費':       'bg-cyan-100 text-cyan-700 border-cyan-200',
  '水道光熱費':   'bg-green-100 text-green-700 border-green-200',
  '福利厚生費':   'bg-purple-100 text-purple-700 border-purple-200',
  '広告宣伝費':   'bg-orange-100 text-orange-700 border-orange-200',
  '研修費':       'bg-indigo-100 text-indigo-700 border-indigo-200',
  '雑費':         'bg-slate-100 text-slate-600 border-slate-200',
};

const PRESET_COLORS = [
  'bg-blue-100 text-blue-700 border-blue-200',
  'bg-teal-100 text-teal-700 border-teal-200',
  'bg-pink-100 text-pink-700 border-pink-200',
  'bg-yellow-100 text-yellow-800 border-yellow-200',
  'bg-cyan-100 text-cyan-700 border-cyan-200',
  'bg-green-100 text-green-700 border-green-200',
  'bg-purple-100 text-purple-700 border-purple-200',
  'bg-orange-100 text-orange-700 border-orange-200',
  'bg-indigo-100 text-indigo-700 border-indigo-200',
  'bg-rose-100 text-rose-700 border-rose-200',
  'bg-lime-100 text-lime-800 border-lime-200',
  'bg-amber-100 text-amber-800 border-amber-200',
];

function getAccountColor(title: string, idx: number): string {
  return ACCOUNT_COLORS[title] ?? PRESET_COLORS[idx % PRESET_COLORS.length];
}

// 追加できるおすすめ勘定科目
const SUGGESTED_ACCOUNT_TITLES = [
  '地代家賃', '保険料', '租税公課', '減価償却費',
  '修繕費', 'リース料', '外注費', '荷造運賃',
  '支払手数料', '新聞図書費', '寄付金', '交際費',
  '採用費', 'プロジェクト費', 'ソフトウェア費', 'クラウド費',
  '備品費', '医療費', '慶弔費', '駐車場代',
];

export function AccountTitleManager({ onClose, darkMode = false }: Props) {
  const {
    customAccountTitles,
    addAccountTitle,
    removeAccountTitle,
    reorderAccountTitles,
    receipts,
  } = useReceiptStore();

  const [newTitle, setNewTitle] = useState('');
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [saved, setSaved] = useState(false);

  const dm = darkMode;

  // 勘定科目別使用件数
  const usageCount = (title: string) =>
    receipts.filter(r => r.accountTitle === title).length;

  const handleAdd = () => {
    const trimmed = newTitle.trim();
    if (!trimmed || customAccountTitles.includes(trimmed)) return;
    addAccountTitle(trimmed);
    setNewTitle('');
    flashSaved();
  };

  const handleRemove = (title: string) => {
    const count = usageCount(title);
    if (count > 0) {
      if (!confirm(`「${title}」は${count}件の領収書で使用中です。削除しますか？`)) return;
    }
    removeAccountTitle(title);
    flashSaved();
  };

  const handleReset = () => {
    if (!confirm('勘定科目をデフォルトに戻しますか？\nカスタム科目は削除されます。')) return;
    reorderAccountTitles([...DEFAULT_ACCOUNT_TITLES]);
    flashSaved();
  };

  const flashSaved = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  // ドラッグ＆ドロップ並び替え
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
    const next = [...customAccountTitles];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(idx, 0, moved);
    reorderAccountTitles(next);
    setDragIdx(null);
    setDragOverIdx(null);
    flashSaved();
  };

  const inp = cn(
    'flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
    dm
      ? 'bg-slate-700 border-slate-600 text-slate-200 placeholder:text-slate-500'
      : 'bg-white border-slate-300 text-slate-700'
  );
  const text = dm ? 'text-slate-200' : 'text-slate-700';
  const sub = dm ? 'text-slate-400' : 'text-slate-500';

  const availableSuggestions = SUGGESTED_ACCOUNT_TITLES.filter(
    s => !customAccountTitles.includes(s)
  );

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-3">
      <div className={cn(
        'w-full max-w-lg flex flex-col rounded-2xl shadow-2xl overflow-hidden max-h-[95vh]',
        dm ? 'bg-slate-800' : 'bg-slate-50'
      )}>

        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-emerald-700 to-teal-700 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold flex items-center gap-2">
              <Settings2 className="w-5 h-5" />
              勘定科目のカスタマイズ
            </h2>
            <p className="text-emerald-200 text-xs mt-0.5">
              勘定科目の追加・削除・並び替えができます
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

          {/* 新規追加 */}
          <div className={cn('rounded-xl border p-4', dm ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200')}>
            <h3 className={cn('text-sm font-bold mb-3 flex items-center gap-2', text)}>
              <Plus className="w-4 h-4 text-emerald-500" />
              新しい勘定科目を追加
            </h3>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
                placeholder="勘定科目名を入力（例: 地代家賃）"
                className={inp}
              />
              <button
                onClick={handleAdd}
                disabled={!newTitle.trim() || customAccountTitles.includes(newTitle.trim())}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 rounded-lg text-white text-sm font-medium transition shrink-0',
                  newTitle.trim() && !customAccountTitles.includes(newTitle.trim())
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-slate-300 cursor-not-allowed'
                )}
              >
                <Plus className="w-4 h-4" />追加
              </button>
            </div>
            {newTitle.trim() && customAccountTitles.includes(newTitle.trim()) && (
              <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />この勘定科目は既に存在します
              </p>
            )}

            {/* おすすめから選ぶ */}
            <div className="mt-3">
              <button
                onClick={() => setShowSuggestions(!showSuggestions)}
                className={cn('text-xs font-medium transition', dm ? 'text-emerald-400 hover:text-emerald-300' : 'text-emerald-700 hover:text-emerald-800')}
              >
                {showSuggestions ? '▲ おすすめを隠す' : '▼ おすすめ勘定科目から選ぶ'}
              </button>
              {showSuggestions && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {availableSuggestions.map((s, i) => (
                    <button
                      key={s}
                      onClick={() => {
                        addAccountTitle(s);
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
                    <span className={cn('text-xs', sub)}>すべてのおすすめ勘定科目が追加済みです</span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 勘定科目一覧（ドラッグ並び替え） */}
          <div className={cn('rounded-xl border p-4', dm ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200')}>
            <div className="flex items-center justify-between mb-3">
              <h3 className={cn('text-sm font-bold flex items-center gap-2', text)}>
                <BookOpen className="w-4 h-4 text-emerald-500" />
                勘定科目一覧（{customAccountTitles.length}件）
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
              {customAccountTitles.map((title, idx) => {
                const count = usageCount(title);
                const isDefault = DEFAULT_ACCOUNT_TITLES.includes(title);
                const isDraggingOver = dragOverIdx === idx;

                return (
                  <div
                    key={title}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={e => handleDragOver(e, idx)}
                    onDrop={() => handleDrop(idx)}
                    onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-xl border transition cursor-grab active:cursor-grabbing',
                      isDraggingOver
                        ? 'border-emerald-400 bg-emerald-50'
                        : dragIdx === idx
                        ? 'opacity-40'
                        : dm
                        ? 'bg-slate-600 border-slate-500 hover:border-slate-400'
                        : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                    )}
                  >
                    <GripVertical className={cn('w-4 h-4 shrink-0', sub)} />

                    <span className={cn(
                      'px-2.5 py-0.5 rounded-full text-xs font-medium border shrink-0',
                      getAccountColor(title, idx)
                    )}>
                      {title}
                    </span>

                    <div className="flex-1 min-w-0 flex items-center gap-2">
                      {isDefault && (
                        <span className={cn(
                          'text-[10px] px-1.5 py-0.5 rounded border shrink-0',
                          dm ? 'bg-slate-700 border-slate-600 text-slate-400' : 'bg-white border-slate-200 text-slate-400'
                        )}>
                          デフォルト
                        </span>
                      )}
                      {count > 0 && (
                        <span className={cn('text-[10px]', sub)}>{count}件使用中</span>
                      )}
                    </div>

                    <span className={cn('text-xs font-mono w-4 text-center', sub)}>{idx + 1}</span>

                    <button
                      onClick={() => handleRemove(title)}
                      className={cn(
                        'p-1.5 rounded-lg transition shrink-0',
                        dm
                          ? 'hover:bg-red-900/30 text-slate-500 hover:text-red-400'
                          : 'hover:bg-red-50 text-slate-400 hover:text-red-500'
                      )}
                      title="削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}

              {customAccountTitles.length === 0 && (
                <div className={cn('text-center py-8 text-sm', sub)}>
                  勘定科目がありません。上のフォームから追加してください。
                </div>
              )}
            </div>
          </div>

          {/* 注意事項 */}
          <div className={cn('rounded-xl border p-3 text-xs', dm ? 'bg-slate-700 border-slate-600 text-slate-400' : 'bg-amber-50 border-amber-200 text-amber-700')}>
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className={cn('font-bold mb-1', dm ? 'text-slate-300' : 'text-amber-800')}>カスタマイズの注意点</p>
                <ul className="space-y-1">
                  <li>• 勘定科目を削除しても既存の領収書の設定は変わりません</li>
                  <li>• 並び替えはフォームの選択肢の順序に反映されます</li>
                  <li>• 追加した勘定科目はブラウザに保存されます</li>
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
            <BookOpen className="w-3.5 h-3.5 text-emerald-500" />
            {customAccountTitles.length}件の勘定科目
          </p>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition"
          >
            <Check className="w-4 h-4" />完了
          </button>
        </div>
      </div>
    </div>
  );
}
