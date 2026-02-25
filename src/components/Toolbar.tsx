import { cn } from '../utils/cn';
import { useReceiptStore } from '../store/receiptStore';

interface ToolItem {
  id: string;
  icon: React.ReactNode;
  label: string;
  badge?: number | string;
  onClick: () => void;
  active?: boolean;
  color?: string;
  dividerAfter?: boolean;
}

interface Props {
  items: ToolItem[];
}

export function Toolbar({ items }: Props) {
  return (
    <div className="flex items-center gap-1 p-1.5 bg-white/90 backdrop-blur-sm border border-slate-200 rounded-2xl shadow-lg">
      {items.map((item, idx) => (
        <div key={item.id} className="flex items-center">
          <ToolButton item={item} />
          {item.dividerAfter && idx < items.length - 1 && (
            <div className="w-px h-8 bg-slate-200 mx-1" />
          )}
        </div>
      ))}
    </div>
  );
}

function ToolButton({ item }: { item: ToolItem }) {
  return (
    <button
      onClick={item.onClick}
      title={item.label}
      className={cn(
        'relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl transition-all group',
        'hover:scale-105 active:scale-95',
        item.active
          ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-800'
      )}
    >
      <span className={cn('w-5 h-5 flex items-center justify-center', item.color && !item.active ? item.color : '')}>
        {item.icon}
      </span>
      <span className="text-[9px] font-medium leading-none whitespace-nowrap">{item.label}</span>
      {item.badge !== undefined && (
        <span className={cn(
          'absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center',
          item.active ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'
        )}>
          {item.badge}
        </span>
      )}
      {/* ツールチップ */}
      <span className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-slate-800 text-white text-[10px] px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition pointer-events-none z-50 shadow">
        {item.label}
      </span>
    </button>
  );
}

/** 使用されているストア情報を返すフック */
export function useToolbarStats() {
  const { receipts, getFiltered } = useReceiptStore();
  return {
    totalCount: receipts.length,
    filteredCount: getFiltered().length,
  };
}
