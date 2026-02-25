import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, Scan, RotateCcw } from 'lucide-react';
import { cn } from '../utils/cn';

interface OcrField {
  label: string;
  key: 'date' | 'vendor' | 'amount';
  original: string;
  current: string;
  confidence: 'high' | 'medium' | 'low';
}

interface Props {
  rawText: string;
  ocrConfidence: number;
  originalValues: { date: string; vendor: string; amount: string };
  currentValues: { date: string; vendor: string; amount: string };
  onRestore: (key: 'date' | 'vendor' | 'amount') => void;
}

function confidenceLabel(c: number): { label: string; color: string; level: 'high' | 'medium' | 'low' } {
  if (c >= 80) return { label: '高精度', color: 'text-green-600', level: 'high' };
  if (c >= 50) return { label: '中精度', color: 'text-yellow-600', level: 'medium' };
  return { label: '低精度', color: 'text-red-600', level: 'low' };
}

export function OcrCorrector({ rawText, ocrConfidence, originalValues, currentValues, onRestore }: Props) {
  const [expanded, setExpanded] = useState(ocrConfidence < 70);
  const conf = confidenceLabel(ocrConfidence);

  const fields: OcrField[] = [
    {
      label: '日付',
      key: 'date',
      original: originalValues.date,
      current: currentValues.date,
      confidence: originalValues.date === currentValues.date ? conf.level : 'low',
    },
    {
      label: '支払先',
      key: 'vendor',
      original: originalValues.vendor,
      current: currentValues.vendor,
      confidence: originalValues.vendor === currentValues.vendor ? conf.level : 'low',
    },
    {
      label: '金額',
      key: 'amount',
      original: originalValues.amount,
      current: currentValues.amount,
      confidence: originalValues.amount === currentValues.amount ? conf.level : 'low',
    },
  ];

  return (
    <div
      className={cn(
        'rounded-xl border overflow-hidden',
        ocrConfidence < 50 ? 'border-red-200 bg-red-50' :
        ocrConfidence < 70 ? 'border-yellow-200 bg-yellow-50' :
        'border-green-200 bg-green-50'
      )}
    >
      {/* ヘッダー */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left"
      >
        <Scan className="w-4 h-4 shrink-0 text-slate-600" />
        <span className="text-xs font-bold text-slate-700">OCR読み取り結果</span>
        <span className={cn('ml-1 text-xs font-semibold', conf.color)}>
          {conf.label}（{ocrConfidence}%）
        </span>
        {ocrConfidence < 70 && (
          <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 ml-1" />
        )}
        <span className="ml-auto">
          {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </span>
      </button>

      {expanded && (
        <div className="px-4 pb-4 flex flex-col gap-3">
          {/* OCR元の抽出値と現在値の比較 */}
          <div className="bg-white/70 rounded-lg border border-white p-3 flex flex-col gap-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">OCR抽出値 → 現在の値（変更があれば元に戻せます）</p>
            <div className="grid grid-cols-3 gap-2">
              {fields.map((f) => {
                const changed = f.original !== f.current;
                return (
                  <div key={f.key} className="flex flex-col gap-1">
                    <span className="text-[10px] text-slate-500 font-medium">{f.label}</span>
                    <div className={cn(
                      'flex items-center gap-1 rounded-md px-2 py-1 text-xs',
                      changed ? 'bg-blue-50 border border-blue-200' : 'bg-slate-50 border border-slate-200'
                    )}>
                      <span className="text-slate-600 truncate flex-1" title={f.original}>
                        {f.original || '―'}
                      </span>
                      {changed && (
                        <button
                          type="button"
                          title="OCR値に戻す"
                          onClick={() => onRestore(f.key)}
                          className="shrink-0 p-0.5 rounded hover:bg-blue-100 text-blue-600 transition"
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* OCR生テキスト */}
          {rawText && (
            <div className="flex flex-col gap-1">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Scan className="w-3 h-3" />OCR生テキスト
              </p>
              <pre className="text-[10px] leading-relaxed text-slate-600 bg-white/80 rounded-lg border border-slate-200 p-3 overflow-auto max-h-32 whitespace-pre-wrap font-mono">
                {rawText}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
