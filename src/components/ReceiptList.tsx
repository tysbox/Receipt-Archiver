import { useState } from 'react';
import { useReceiptStore } from '../store/receiptStore';
import { Receipt, CATEGORIES, ACCOUNT_TITLES, SortKey } from '../types/receipt';
import { cn } from '../utils/cn';
import { downloadPdf } from '../utils/generatePdf';
import { TagBadge } from './TagInput';
import {
  Trash2, Download, Eye, ChevronUp, ChevronDown,
  Search, Filter, SlidersHorizontal, Calendar, Tag,
  DollarSign, Building2, X, FileSpreadsheet
} from 'lucide-react';

const CATEGORY_COLORS: Record<string, string> = {
  '交通費': 'bg-blue-100 text-blue-700',
  '食費・飲食': 'bg-orange-100 text-orange-700',
  '宿泊費': 'bg-purple-100 text-purple-700',
  '通信費': 'bg-teal-100 text-teal-700',
  '事務用品': 'bg-yellow-100 text-yellow-800',
  '接待交際費': 'bg-pink-100 text-pink-700',
  '医療費': 'bg-red-100 text-red-700',
  '光熱費': 'bg-green-100 text-green-700',
  'その他': 'bg-slate-100 text-slate-600',
};

interface Props {
  onPreview: (r: Receipt) => void;
  darkMode?: boolean;
  onExport?: () => void;
}

export function ReceiptList({ onPreview, darkMode = false, onExport }: Props) {
  const {
    filter, setFilter, sortKey, sortOrder,
    setSortKey, setSortOrder, deleteReceipt, getFiltered, getAllTags,
  } = useReceiptStore();
  const [showFilter, setShowFilter] = useState(false);

  const receipts = getFiltered();
  const allTags = getAllTags();

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('desc');
    }
  };

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) return <SlidersHorizontal className="w-3 h-3 opacity-30" />;
    return sortOrder === 'asc'
      ? <ChevronUp className="w-3 h-3 text-blue-600" />
      : <ChevronDown className="w-3 h-3 text-blue-600" />;
  };

  const totalAmount = receipts.reduce((s, r) => s + r.amount, 0);

  const toggleFilterTag = (tag: string) => {
    const current = filter.tags ?? [];
    if (current.includes(tag)) {
      setFilter({ tags: current.filter((t) => t !== tag) });
    } else {
      setFilter({ tags: [...current, tag] });
    }
  };

  const activeFilterCount = [
    filter.category !== 'すべて',
    filter.accountTitle && filter.accountTitle !== 'すべて',
    filter.dateFrom,
    filter.dateTo,
    (filter.tags ?? []).length > 0,
  ].filter(Boolean).length;

  const dm = darkMode;
  const inputCls = cn(
    'rounded-lg border px-2 py-1.5 text-sm',
    dm
      ? 'bg-slate-700 border-slate-600 text-slate-200'
      : 'bg-white border-slate-300 text-slate-700'
  );

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* 検索バー */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={filter.keyword}
            onChange={(e) => setFilter({ keyword: e.target.value })}
            placeholder="支払先・タグ・用途・ファイル名で検索..."
            className={cn(
              'w-full pl-9 pr-4 py-2 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500',
              dm ? 'bg-slate-700 border-slate-600 text-slate-200 placeholder:text-slate-500' : 'border-slate-200'
            )}
          />
          {filter.keyword && (
            <button onClick={() => setFilter({ keyword: '' })} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilter(!showFilter)}
          className={cn(
            'flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm transition relative',
            showFilter || activeFilterCount > 0
              ? 'bg-blue-600 text-white border-blue-600'
              : dm
              ? 'border-slate-600 text-slate-400 hover:bg-slate-700'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50'
          )}
        >
          <Filter className="w-4 h-4" />
          フィルター
          {activeFilterCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
              {activeFilterCount}
            </span>
          )}
        </button>

        {/* エクスポートボタン */}
        {onExport && (
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border text-sm transition bg-green-600 text-white border-green-600 hover:bg-green-700"
            title="スプレッドシート出力"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span className="hidden sm:inline">出力</span>
          </button>
        )}
      </div>

      {/* フィルターパネル */}
      {showFilter && (
        <div className={cn(
          'rounded-xl border p-4 flex flex-col gap-4',
          dm ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200'
        )}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="flex flex-col gap-1">
              <label className={cn('text-xs font-semibold flex items-center gap-1', dm ? 'text-slate-400' : 'text-slate-500')}>
                <Tag className="w-3 h-3" />カテゴリ
              </label>
              <select
                value={filter.category}
                onChange={(e) => setFilter({ category: e.target.value as typeof filter.category })}
                className={inputCls}
              >
                <option value="すべて">すべて</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className={cn('text-xs font-semibold', dm ? 'text-slate-400' : 'text-slate-500')}>勘定科目</label>
              <select
                value={filter.accountTitle ?? 'すべて'}
                onChange={(e) => setFilter({ accountTitle: e.target.value as typeof filter.accountTitle })}
                className={inputCls}
              >
                <option value="すべて">すべて</option>
                {ACCOUNT_TITLES.filter(Boolean).map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className={cn('text-xs font-semibold flex items-center gap-1', dm ? 'text-slate-400' : 'text-slate-500')}>
                <Calendar className="w-3 h-3" />日付（から）
              </label>
              <input
                type="date"
                value={filter.dateFrom}
                onChange={(e) => setFilter({ dateFrom: e.target.value })}
                className={inputCls}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className={cn('text-xs font-semibold flex items-center gap-1', dm ? 'text-slate-400' : 'text-slate-500')}>
                <Calendar className="w-3 h-3" />日付（まで）
              </label>
              <input
                type="date"
                value={filter.dateTo}
                onChange={(e) => setFilter({ dateTo: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>

          {/* タグフィルター */}
          {allTags.length > 0 && (
            <div className="flex flex-col gap-2">
              <label className={cn('text-xs font-semibold flex items-center gap-1', dm ? 'text-slate-400' : 'text-slate-500')}>
                <Tag className="w-3 h-3" />タグで絞り込み
              </label>
              <div className="flex flex-wrap gap-1.5">
                {allTags.map((tag) => {
                  const active = (filter.tags ?? []).includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => toggleFilterTag(tag)}
                      className={cn('transition', active ? 'ring-2 ring-blue-500 ring-offset-1' : '')}
                    >
                      <TagBadge tag={tag} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {activeFilterCount > 0 && (
            <button
              onClick={() => setFilter({ category: 'すべて', accountTitle: 'すべて', dateFrom: '', dateTo: '', tags: [] })}
              className="text-xs text-red-500 hover:text-red-700 self-start flex items-center gap-1 transition"
            >
              <X className="w-3 h-3" />フィルターをリセット
            </button>
          )}
        </div>
      )}

      {/* アクティブタグフィルターバッジ */}
      {(filter.tags ?? []).length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('text-xs', dm ? 'text-slate-400' : 'text-slate-500')}>絞り込み中：</span>
          {(filter.tags ?? []).map((tag) => (
            <TagBadge key={tag} tag={tag} onRemove={() => toggleFilterTag(tag)} />
          ))}
        </div>
      )}

      {/* 集計バー */}
      <div className={cn(
        'flex items-center justify-between text-sm rounded-xl px-4 py-2.5 border',
        dm ? 'bg-blue-900/30 border-blue-800 text-blue-300' : 'bg-blue-50 border-blue-100 text-blue-700'
      )}>
        <span className="font-medium">{receipts.length} 件</span>
        <div className="flex items-center gap-3">
          <span className={cn('font-bold', dm ? 'text-blue-200' : 'text-blue-800')}>
            合計: ¥{totalAmount.toLocaleString()}
          </span>
          {onExport && receipts.length > 0 && (
            <button
              onClick={onExport}
              className="text-xs flex items-center gap-1 text-green-600 hover:text-green-700 font-medium transition"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel出力
            </button>
          )}
        </div>
      </div>

      {/* テーブル */}
      {receipts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-16">
          <Search className={cn('w-12 h-12 opacity-20', dm ? 'text-slate-300' : 'text-slate-500')} />
          <p className={cn('text-sm', dm ? 'text-slate-500' : 'text-slate-400')}>
            該当する領収書がありません
          </p>
          <p className={cn('text-xs', dm ? 'text-slate-600' : 'text-slate-300')}>
            左側からPDFまたは画像を追加してください
          </p>
        </div>
      ) : (
        <div className={cn(
          'overflow-auto rounded-xl border flex-1',
          dm ? 'border-slate-700' : 'border-slate-200'
        )}>
          <table className="w-full text-sm min-w-[700px]">
            <thead className={cn('sticky top-0 z-10', dm ? 'bg-slate-700' : 'bg-slate-100')}>
              <tr>
                {([
                  ['date', '日付', Calendar],
                  ['vendor', '支払先', Building2],
                  ['amount', '金額', DollarSign],
                  ['category', 'カテゴリ', Tag],
                ] as [SortKey, string, React.ComponentType<{ className?: string }>][]).map(([k, label, Icon]) => (
                  <th
                    key={k}
                    className={cn(
                      'px-3 py-2.5 text-left font-semibold cursor-pointer transition select-none',
                      dm
                        ? 'text-slate-300 hover:bg-slate-600'
                        : 'text-slate-600 hover:bg-slate-200'
                    )}
                    onClick={() => toggleSort(k)}
                  >
                    <span className="flex items-center gap-1.5">
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                      <SortIcon k={k} />
                    </span>
                  </th>
                ))}
                <th className={cn('px-3 py-2.5 text-left font-semibold', dm ? 'text-slate-300' : 'text-slate-600')}>
                  適用・タグ
                </th>
                <th className={cn('px-3 py-2.5 text-center font-semibold', dm ? 'text-slate-300' : 'text-slate-600')}>
                  操作
                </th>
              </tr>
            </thead>
            <tbody>
              {receipts.map((r, i) => (
                <tr
                  key={r.id}
                  className={cn(
                    'border-t transition group',
                    dm
                      ? 'border-slate-700 hover:bg-slate-700/50'
                      : 'border-slate-100 hover:bg-blue-50/40',
                    i % 2 === 0
                      ? dm ? 'bg-slate-800' : 'bg-white'
                      : dm ? 'bg-slate-800/50' : 'bg-slate-50/30'
                  )}
                >
                  <td className={cn('px-3 py-3 whitespace-nowrap text-xs', dm ? 'text-slate-300' : 'text-slate-700')}>
                    {r.date}
                  </td>
                  <td className="px-3 py-3 max-w-[180px]">
                    <div className={cn('font-medium truncate text-sm', dm ? 'text-slate-200' : 'text-slate-800')}>
                      {r.vendor}
                    </div>
                    {r.purpose && (
                      <div className={cn('text-[10px] truncate mt-0.5', dm ? 'text-slate-500' : 'text-slate-400')}>
                        {r.purpose}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span className={cn('font-mono font-semibold', dm ? 'text-slate-200' : 'text-slate-800')}>
                      ¥{r.amount.toLocaleString()}
                    </span>
                    {r.taxAmount > 0 && (
                      <div className={cn('text-[10px]', dm ? 'text-slate-500' : 'text-slate-400')}>
                        税 ¥{r.taxAmount.toLocaleString()}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', CATEGORY_COLORS[r.category])}>
                      {r.category}
                    </span>
                    {r.accountTitle && (
                      <div className={cn('text-[10px] mt-0.5', dm ? 'text-slate-500' : 'text-slate-400')}>
                        {r.accountTitle}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-3 max-w-[180px]">
                    <div className="flex flex-wrap gap-1">
                      {(r.tags ?? []).slice(0, 3).map((tag) => (
                        <TagBadge key={tag} tag={tag} size="sm" />
                      ))}
                      {(r.tags ?? []).length > 3 && (
                        <span className={cn('text-[10px]', dm ? 'text-slate-500' : 'text-slate-400')}>
                          +{(r.tags ?? []).length - 3}
                        </span>
                      )}
                      {(r.tags ?? []).length === 0 && r.memo && (
                        <span className={cn('text-[10px] truncate max-w-[150px]', dm ? 'text-slate-500' : 'text-slate-400')}>
                          {r.memo}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1 justify-center opacity-60 group-hover:opacity-100 transition">
                      <button
                        title="プレビュー・編集"
                        onClick={() => onPreview(r)}
                        className="p-1.5 rounded-lg hover:bg-blue-100 text-blue-600 transition"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        title="PDFダウンロード"
                        onClick={() => downloadPdf(r.pdfData, r.filename)}
                        className="p-1.5 rounded-lg hover:bg-green-100 text-green-600 transition"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        title="削除"
                        onClick={() => {
                          if (confirm(`「${r.filename}」を削除しますか？`)) deleteReceipt(r.id);
                        }}
                        className="p-1.5 rounded-lg hover:bg-red-100 text-red-500 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
