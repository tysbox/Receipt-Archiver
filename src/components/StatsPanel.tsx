import { useReceiptStore } from '../store/receiptStore';
import { CATEGORIES } from '../types/receipt';
import { TrendingUp, FileText, BarChart3, Tag } from 'lucide-react';
import { cn } from '../utils/cn';

const COLORS = [
  '#3b82f6','#f97316','#a855f7','#14b8a6','#eab308',
  '#ec4899','#ef4444','#22c55e','#6b7280'
];

interface Props {
  fullMode?: boolean;
  darkMode?: boolean;
}

export function StatsPanel({ fullMode = false, darkMode = false }: Props) {
  const { receipts, getAllTags } = useReceiptStore();

  const total = receipts.reduce((s, r) => s + r.amount, 0);

  const byCategory = CATEGORIES.map((cat, i) => {
    const items = receipts.filter((r) => r.category === cat);
    return {
      cat,
      count: items.length,
      amount: items.reduce((s, r) => s + r.amount, 0),
      color: COLORS[i],
    };
  }).filter((c) => c.count > 0).sort((a, b) => b.amount - a.amount);

  const byMonth = Object.entries(
    receipts.reduce<Record<string, number>>((acc, r) => {
      const m = r.date.slice(0, 7);
      acc[m] = (acc[m] || 0) + r.amount;
      return acc;
    }, {})
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6);

  const maxMonthAmt = Math.max(...byMonth.map(([, v]) => v), 1);

  // タグ別集計
  const allTags = getAllTags();
  const byTag = allTags.map((tag) => {
    const items = receipts.filter((r) => r.tags?.includes(tag));
    return {
      tag,
      count: items.length,
      amount: items.reduce((s, r) => s + r.amount, 0),
    };
  }).sort((a, b) => b.amount - a.amount).slice(0, 8);

  const card = darkMode
    ? 'bg-slate-700 border-slate-600'
    : 'bg-white border-slate-200';

  return (
    <div className={`flex flex-col gap-5 ${fullMode ? 'max-w-3xl' : ''}`}>
      {/* サマリカード */}
      <div className={`grid gap-3 ${fullMode ? 'grid-cols-3' : 'grid-cols-2'}`}>
        <StatCard
          icon={<FileText className="w-5 h-5 text-blue-500" />}
          label="総件数"
          value={`${receipts.length} 件`}
          darkMode={darkMode}
        />
        <StatCard
          icon={<TrendingUp className="w-5 h-5 text-green-500" />}
          label="総合計金額"
          value={`¥${total.toLocaleString()}`}
          darkMode={darkMode}
        />
        {fullMode && (
          <StatCard
            icon={<Tag className="w-5 h-5 text-purple-500" />}
            label="タグ数"
            value={`${allTags.length} 種類`}
            darkMode={darkMode}
          />
        )}
      </div>

      {/* カテゴリ別 */}
      {byCategory.length > 0 && (
        <div className={cn('rounded-xl border p-4', card)}>
          <h3 className={cn('text-sm font-bold mb-3 flex items-center gap-1.5', darkMode ? 'text-slate-200' : 'text-slate-700')}>
            <BarChart3 className="w-4 h-4" />カテゴリ別集計
          </h3>
          <div className="flex flex-col gap-2.5">
            {byCategory.map(({ cat, count, amount, color }) => (
              <div key={cat} className="flex flex-col gap-1">
                <div className="flex justify-between text-xs">
                  <span className={cn('font-medium', darkMode ? 'text-slate-300' : 'text-slate-600')}>
                    {cat} <span className={darkMode ? 'text-slate-500' : 'text-slate-400'}>({count}件)</span>
                  </span>
                  <span className={cn('font-bold', darkMode ? 'text-slate-200' : 'text-slate-700')}>
                    ¥{amount.toLocaleString()}
                  </span>
                </div>
                <div className={cn('h-2 rounded-full overflow-hidden', darkMode ? 'bg-slate-600' : 'bg-slate-100')}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${total > 0 ? (amount / total) * 100 : 0}%`, backgroundColor: color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 月別推移 */}
      {byMonth.length > 0 && (
        <div className={cn('rounded-xl border p-4', card)}>
          <h3 className={cn('text-sm font-bold mb-3', darkMode ? 'text-slate-200' : 'text-slate-700')}>
            月別支出推移（直近6ヶ月）
          </h3>
          <div className="flex items-end gap-2 h-28">
            {byMonth.map(([month, amt]) => (
              <div key={month} className="flex-1 flex flex-col items-center gap-1">
                <span className={cn('text-[9px] font-mono', darkMode ? 'text-slate-400' : 'text-slate-500')}>
                  ¥{(amt / 1000).toFixed(0)}k
                </span>
                <div
                  className="w-full rounded-t bg-gradient-to-t from-blue-600 to-blue-400 transition-all duration-500 min-h-[4px]"
                  style={{ height: `${(amt / maxMonthAmt) * 80}px` }}
                />
                <span className={cn('text-[9px]', darkMode ? 'text-slate-400' : 'text-slate-500')}>
                  {month.slice(5)}月
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* タグ別集計（fullModeのみ） */}
      {fullMode && byTag.length > 0 && (
        <div className={cn('rounded-xl border p-4', card)}>
          <h3 className={cn('text-sm font-bold mb-3 flex items-center gap-1.5', darkMode ? 'text-slate-200' : 'text-slate-700')}>
            <Tag className="w-4 h-4" />タグ別集計（上位8件）
          </h3>
          <div className="flex flex-col gap-2">
            {byTag.map(({ tag, count, amount }) => (
              <div key={tag} className="flex items-center gap-3 text-xs">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium min-w-[80px] text-center justify-center">
                  {tag}
                </span>
                <span className={darkMode ? 'text-slate-400' : 'text-slate-400'}>{count}件</span>
                <div className={cn('flex-1 h-2 rounded-full overflow-hidden', darkMode ? 'bg-slate-600' : 'bg-slate-100')}>
                  <div
                    className="h-full rounded-full bg-purple-400 transition-all duration-500"
                    style={{ width: `${total > 0 ? (amount / total) * 100 : 0}%` }}
                  />
                </div>
                <span className={cn('font-bold min-w-[80px] text-right', darkMode ? 'text-slate-200' : 'text-slate-700')}>
                  ¥{amount.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {receipts.length === 0 && (
        <div className={cn('text-center text-sm py-6', darkMode ? 'text-slate-500' : 'text-slate-400')}>
          領収書を追加するとここに統計が表示されます
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon, label, value, darkMode = false
}: {
  icon: React.ReactNode; label: string; value: string; darkMode?: boolean;
}) {
  return (
    <div className={cn(
      'rounded-xl border p-4 flex flex-col gap-1.5',
      darkMode ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200'
    )}>
      <div className={cn('flex items-center gap-2', darkMode ? 'text-slate-400' : 'text-slate-500')}>
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className={cn('text-lg font-bold', darkMode ? 'text-slate-100' : 'text-slate-800')}>{value}</p>
    </div>
  );
}
