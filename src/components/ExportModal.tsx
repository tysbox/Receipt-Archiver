import { useState } from 'react';
import { useReceiptStore } from '../store/receiptStore';
import { exportToExcel, exportToCsv, exportToYayoiCsv } from '../utils/exportSpreadsheet';
import { downloadPdf } from '../utils/generatePdf';
import { X, FileSpreadsheet, FileText, Download, Check, Package } from 'lucide-react';
import { cn } from '../utils/cn';
import { Receipt } from '../types/receipt';

interface Props {
  onClose: () => void;
}

type ExportFormat = 'xlsx' | 'csv' | 'csv_yayoi' | 'pdf_all';
type Scope = 'all' | 'filtered';

export function ExportModal({ onClose }: Props) {
  const { receipts, getFiltered } = useReceiptStore();
  const [format, setFormat] = useState<ExportFormat>('xlsx');
  const [scope, setScope] = useState<Scope>('all');
  const [filename, setFilename] = useState('領収書一覧');
  const [done, setDone] = useState(false);
  const [exporting, setExporting] = useState(false);

  const filtered = getFiltered();
  const target: Receipt[] = scope === 'all' ? receipts : filtered;

  const handleExport = async () => {
    if (target.length === 0) return;
    setExporting(true);
    try {
      if (format === 'xlsx') {
        exportToExcel(target, filename);
      } else if (format === 'csv') {
        exportToCsv(target, filename);
      } else if (format === 'csv_yayoi') {
        exportToYayoiCsv(target, filename);
      } else if (format === 'pdf_all') {
        // 全PDF を個別ダウンロード（zip化は追加ライブラリが必要なので順次DL）
        for (const r of target) {
          await new Promise((res) => setTimeout(res, 300));
          downloadPdf(r.pdfData, r.filename);
        }
      }
      setDone(true);
      setTimeout(() => setDone(false), 2500);
    } finally {
      setExporting(false);
    }
  };

  const formatOptions: { id: ExportFormat; icon: React.ReactNode; label: string; desc: string; color: string }[] = [
    {
      id: 'xlsx',
      icon: <FileSpreadsheet className="w-6 h-6" />,
      label: 'Excel（.xlsx）',
      desc: '集計シート付き・列幅自動調整・Excelで即開ける',
      color: 'text-green-600 bg-green-50 border-green-200',
    },
    {
      id: 'csv',
      icon: <FileText className="w-6 h-6" />,
      label: 'CSV（.csv）',
      desc: 'BOM付きUTF-8・Numbers/スプレッドシートでも利用可',
      color: 'text-blue-600 bg-blue-50 border-blue-200',
    },
    {
      id: 'csv_yayoi',
      icon: <FileText className="w-6 h-6" />,
      label: 'CSV（弥生 青色申告向け）',
      desc: '弥生の取込を想定した仕訳形式CSV',
      color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    },
    {
      id: 'pdf_all',
      icon: <Package className="w-6 h-6" />,
      label: 'PDF 一括ダウンロード',
      desc: '選択範囲の全PDFを順次ダウンロード',
      color: 'text-orange-600 bg-orange-50 border-orange-200',
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-green-700 to-green-600 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold flex items-center gap-2">
              <Download className="w-5 h-5" />
              データエクスポート
            </h2>
            <p className="text-green-200 text-xs mt-0.5">スプレッドシートまたはPDFとして出力</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-5">
          {/* 出力形式 */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">出力形式</label>
            <div className="flex flex-col gap-2">
              {formatOptions.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => setFormat(opt.id)}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-xl border-2 text-left transition',
                    format === opt.id
                      ? `border-current ${opt.color}`
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  )}
                >
                  <span className={cn('shrink-0', format === opt.id ? '' : 'text-slate-400')}>
                    {opt.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-sm font-bold', format === opt.id ? '' : 'text-slate-700')}>
                      {opt.label}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">{opt.desc}</p>
                  </div>
                  {format === opt.id && (
                    <Check className="w-5 h-5 shrink-0 text-current" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* 出力範囲 */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">出力範囲</label>
            <div className="flex gap-2">
              {(([
                ['all', `全件（${receipts.length}件）`],
                ['filtered', `フィルター中（${filtered.length}件）`],
              ] as [Scope, string][]).map(([s, label]) => (
                <button
                  key={s}
                  onClick={() => setScope(s)}
                  className={cn(
                    'flex-1 py-2.5 rounded-xl border-2 text-sm font-medium transition',
                    scope === s
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  )}
                >
                  {label}
                </button>
              )))}
            </div>
          </div>

          {/* ファイル名（スプレッドシートのみ） */}
          {format !== 'pdf_all' && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider">ファイル名</label>
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={filename}
                  onChange={(e) => setFilename(e.target.value)}
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-400 shrink-0">
                  _{new Date().toISOString().slice(0, 10).replace(/-/g, '')}.{format === 'xlsx' ? 'xlsx' : 'csv'}
                </span>
              </div>
            </div>
          )}

          {/* 集計プレビュー */}
          <div className="bg-slate-50 rounded-xl border border-slate-200 p-4">
            <p className="text-xs font-bold text-slate-500 mb-2">エクスポート内容プレビュー</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-white rounded-lg p-2 border border-slate-200">
                <p className="text-lg font-bold text-slate-800">{target.length}</p>
                <p className="text-[10px] text-slate-400">件数</p>
              </div>
              <div className="bg-white rounded-lg p-2 border border-slate-200">
                <p className="text-sm font-bold text-slate-800">
                  ¥{target.reduce((s, r) => s + r.amount, 0).toLocaleString()}
                </p>
                <p className="text-[10px] text-slate-400">合計金額</p>
              </div>
              <div className="bg-white rounded-lg p-2 border border-slate-200">
                <p className="text-lg font-bold text-slate-800">
                  {new Set(target.map((r) => r.category)).size}
                </p>
                <p className="text-[10px] text-slate-400">カテゴリ数</p>
              </div>
            </div>
          </div>
        </div>

        {/* フッター */}
        <div className="flex gap-3 px-5 pb-5">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-slate-300 text-slate-600 text-sm font-medium hover:bg-slate-50 transition"
          >
            キャンセル
          </button>
          <button
            onClick={handleExport}
            disabled={target.length === 0 || exporting}
            className={cn(
              'flex-2 flex-1 py-2.5 rounded-xl text-white text-sm font-bold transition flex items-center justify-center gap-2',
              done
                ? 'bg-green-600'
                : target.length > 0 && !exporting
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-slate-300 cursor-not-allowed'
            )}
          >
            {done ? (
              <><Check className="w-4 h-4" />完了！</>
            ) : exporting ? (
              <><span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin" />出力中...</>
            ) : (
              <><Download className="w-4 h-4" />エクスポート</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
