import { Receipt, CATEGORIES, Category, AccountTitle, TAX_CATEGORIES, TaxCategory } from '../types/receipt';
import { useReceiptStore } from '../store/receiptStore';
import { downloadPdf, generateReceiptPdf } from '../utils/generatePdf';
import { X, Download, Edit3, Save, Scan } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../utils/cn';
import { TagInput, TagBadge } from './TagInput';

export function PreviewModal({ receipt, onClose }: { receipt: Receipt; onClose: () => void }) {
  const { updateReceipt, getAllTags } = useReceiptStore();
  const [editing, setEditing] = useState(false);
  const [showOcr, setShowOcr] = useState(false);

  // 編集用ステート
  const [date, setDate] = useState(receipt.date);
  const [vendor, setVendor] = useState(receipt.vendor);
  const [amount, setAmount] = useState(String(receipt.amount));
  const [taxAmount, setTaxAmount] = useState(String(receipt.taxAmount ?? 0));
  const [category, setCategory] = useState<Category>(receipt.category);
  const [accountTitle, setAccountTitle] = useState<AccountTitle>(receipt.accountTitle ?? '');
  const [taxCategory, setTaxCategory] = useState<TaxCategory>(receipt.taxCategory ?? '');
  const [purpose, setPurpose] = useState(receipt.purpose ?? '');
  const [memo, setMemo] = useState(receipt.memo);
  const [tags, setTags] = useState<string[]>(receipt.tags ?? []);

  const handleSave = () => {
    const filename = `${date.replace(/-/g, '')}_${vendor.replace(/[^\w\u3040-\u9FFF\u30A0-\u30FF]/g, '_').slice(0, 20)}_¥${Number(amount).toLocaleString()}.pdf`;
    const newPdf = generateReceiptPdf(receipt.croppedImageData, {
      date, vendor,
      amount: Number(amount),
      taxAmount: Number(taxAmount),
      category, accountTitle, taxCategory,
      purpose, memo, tags, filename,
    });
    updateReceipt(receipt.id, {
      date, vendor,
      amount: Number(amount),
      taxAmount: Number(taxAmount),
      category, accountTitle, taxCategory,
      purpose, memo, tags, filename,
      pdfData: newPdf,
    });
    setEditing(false);
  };

  const inp = 'w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';
  const allTags = getAllTags();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden max-h-[95vh]">
        {/* ヘッダー */}
        <div className="bg-blue-700 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div className="min-w-0">
            <h2 className="text-sm font-bold truncate pr-4">{receipt.filename}</h2>
            <p className="text-blue-300 text-[10px] mt-0.5">
              登録日時: {new Date(receipt.createdAt).toLocaleString('ja-JP')}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col md:flex-row overflow-auto flex-1 min-h-0">
          {/* 左：画像 */}
          <div className="md:w-2/5 bg-slate-900 flex flex-col items-center justify-start p-4 gap-3 shrink-0">
            <img
              src={receipt.croppedImageData}
              alt="receipt"
              className="max-h-[50vh] object-contain rounded shadow w-full"
            />
            {/* OCR情報 */}
            {receipt.ocrRawText && (
              <div className="w-full">
                <button
                  type="button"
                  onClick={() => setShowOcr(!showOcr)}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition w-full"
                >
                  <Scan className="w-3.5 h-3.5" />
                  OCRテキスト ({receipt.ocrConfidence ?? 0}% 精度)
                </button>
                {showOcr && (
                  <pre className="mt-2 text-[10px] text-slate-300 bg-slate-800 rounded-lg p-2.5 overflow-auto max-h-32 whitespace-pre-wrap font-mono">
                    {receipt.ocrRawText}
                  </pre>
                )}
              </div>
            )}
          </div>

          {/* 右：情報 */}
          <div className="flex-1 flex flex-col overflow-auto">
            {editing ? (
              <div className="p-5 flex flex-col gap-4 flex-1">
                <div className="grid grid-cols-2 gap-3">
                  <EditField label="日付">
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className={inp} />
                  </EditField>
                  <EditField label="支払先">
                    <input type="text" value={vendor} onChange={e => setVendor(e.target.value)} className={inp} />
                  </EditField>
                  <EditField label="金額（円）">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">¥</span>
                      <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className={cn(inp, 'pl-7')} />
                    </div>
                  </EditField>
                  <EditField label="消費税額（円）">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">¥</span>
                      <input type="number" value={taxAmount} onChange={e => setTaxAmount(e.target.value)} className={cn(inp, 'pl-7')} />
                    </div>
                  </EditField>
                  <EditField label="カテゴリ">
                    <select value={category} onChange={e => setCategory(e.target.value as Category)} className={inp}>
                      {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                    </select>
                  </EditField>
                  <EditField label="税区分">
                    <select value={taxCategory} onChange={e => setTaxCategory(e.target.value as TaxCategory)} className={inp}>
                      {TAX_CATEGORIES.map(t => <option key={t} value={t}>{t || '未設定'}</option>)}
                    </select>
                  </EditField>
                </div>

                <EditField label="勘定科目">
                  <select value={accountTitle} onChange={e => setAccountTitle(e.target.value as AccountTitle)} className={inp}>
                    {ACCOUNT_TITLES.map(a => <option key={a} value={a}>{a || '未設定'}</option>)}
                  </select>
                </EditField>

                <EditField label="適用・用途">
                  <input type="text" value={purpose} onChange={e => setPurpose(e.target.value)} className={inp} placeholder="例: ○○プロジェクト打ち合わせ" />
                </EditField>

                <EditField label="タグ">
                  <TagInput tags={tags} onChange={setTags} suggestions={allTags} />
                </EditField>

                <EditField label="メモ">
                  <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={2} className={cn(inp, 'resize-none')} />
                </EditField>
              </div>
            ) : (
              <div className="p-5 flex flex-col gap-4 flex-1">
                {/* 金額強調 */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-xl px-5 py-4 text-white">
                  <p className="text-xs text-blue-200">お支払い金額</p>
                  <p className="text-3xl font-bold mt-1">¥{receipt.amount.toLocaleString()}</p>
                  {receipt.taxAmount > 0 && (
                    <p className="text-xs text-blue-200 mt-1">うち消費税 ¥{receipt.taxAmount.toLocaleString()}</p>
                  )}
                </div>

                {/* 基本情報グリッド */}
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  <InfoItem label="日付" value={receipt.date} />
                  <InfoItem label="支払先" value={receipt.vendor} />
                  <InfoItem label="カテゴリ" value={receipt.category} />
                  <InfoItem label="税区分" value={receipt.taxCategory || '―'} />
                  <InfoItem label="勘定科目" value={receipt.accountTitle || '―'} />
                  <InfoItem label="ファイル形式" value={receipt.originalType === 'pdf' ? 'PDF' : '画像'} />
                </div>

                {/* 適用・用途 */}
                {receipt.purpose && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-slate-400 font-medium">適用・用途</span>
                    <span className="text-sm text-slate-700 bg-slate-50 rounded-lg px-3 py-2 border border-slate-200">
                      {receipt.purpose}
                    </span>
                  </div>
                )}

                {/* タグ */}
                <div className="flex flex-col gap-1.5">
                  <span className="text-xs text-slate-400 font-medium">タグ</span>
                  {receipt.tags && receipt.tags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {receipt.tags.map((tag) => (
                        <TagBadge key={tag} tag={tag} />
                      ))}
                    </div>
                  ) : (
                    <span className="text-sm text-slate-400">―</span>
                  )}
                </div>

                {/* メモ */}
                {receipt.memo && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-slate-400 font-medium">メモ</span>
                    <span className="text-sm text-slate-600">{receipt.memo}</span>
                  </div>
                )}
              </div>
            )}

            {/* アクションボタン */}
            <div className="flex gap-2 p-4 border-t border-slate-200 bg-slate-50 shrink-0">
              {editing ? (
                <>
                  <button
                    onClick={() => setEditing(false)}
                    className="flex-1 py-2 rounded-lg border border-slate-300 text-slate-600 text-sm hover:bg-slate-100 transition"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handleSave}
                    className="flex-1 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition flex items-center justify-center gap-1"
                  >
                    <Save className="w-4 h-4" />保存して更新
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => setEditing(true)}
                    className="flex-1 py-2 rounded-lg border border-blue-300 text-blue-600 text-sm hover:bg-blue-50 transition flex items-center justify-center gap-1"
                  >
                    <Edit3 className="w-4 h-4" />編集・修正
                  </button>
                  <button
                    onClick={() => downloadPdf(receipt.pdfData, receipt.filename)}
                    className="flex-1 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition flex items-center justify-center gap-1"
                  >
                    <Download className="w-4 h-4" />PDF保存
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">{label}</span>
      <span className="text-sm font-medium text-slate-800">{value}</span>
    </div>
  );
}

function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-slate-500">{label}</label>
      {children}
    </div>
  );
}
