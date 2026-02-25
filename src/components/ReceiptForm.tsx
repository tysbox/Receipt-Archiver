import { useState } from 'react';
import { Receipt, TAX_CATEGORIES, TaxCategory, AccountTitle } from '../types/receipt';
import { cn } from '../utils/cn';
import { Save, X, ChevronDown, ChevronUp, Star, Settings, BookOpen } from 'lucide-react';
import { TagInput } from './TagInput';
import { OcrCorrector } from './OcrCorrector';
import { VendorPresetModal } from './VendorPresetModal';
import { CategoryManager } from './CategoryManager';
import { AccountTitleManager } from './AccountTitleManager';
import { useReceiptStore, VendorPreset } from '../store/receiptStore';

type Category = string;

interface Props {
  initial: {
    date: string;
    vendor: string;
    amount: number;
    category: Category;
    memo: string;
  };
  croppedDataUrl: string;
  ocrText: string;
  ocrConfidence: number;
  /** OCRが検出した金額候補一覧（複数アイテムのレシート対応） */
  amountCandidates?: number[];
  onSave: (data: Omit<Receipt, 'id' | 'createdAt' | 'originalType' | 'croppedImageData' | 'pdfData'>) => void;
  onCancel: () => void;
  isSaving: boolean;
}

function buildFilename(date: string, vendor: string, amount: number): string {
  const d = date.replace(/-/g, '');
  const v = vendor.replace(/[^\w\u3040-\u9FFF\u30A0-\u30FF]/g, '_').slice(0, 20);
  const a = amount.toLocaleString();
  return `${d}_${v}_¥${a}.pdf`;
}

const inputCls =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white';

function Field({ label, children, required }: { label: string; children: React.ReactNode; required?: boolean }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-slate-600">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

export function ReceiptForm({ initial, croppedDataUrl, ocrText, ocrConfidence, amountCandidates = [], onSave, onCancel, isSaving }: Props) {
  const { getAllTags, customCategories, customAccountTitles } = useReceiptStore();

  // 基本情報
  const [date, setDate] = useState(initial.date || '');
  const [vendor, setVendor] = useState(initial.vendor || '');
  const [amount, setAmount] = useState(String(initial.amount || '0'));
  const [taxAmount, setTaxAmount] = useState('0');
  const [category, setCategory] = useState<Category>(initial.category || 'その他');

  // 適用・勘定科目
  const [accountTitle, setAccountTitle] = useState<AccountTitle>('');
  const [taxCategory, setTaxCategory] = useState<TaxCategory>('');
  const [purpose, setPurpose] = useState('');

  // メモ・タグ
  const [memo, setMemo] = useState(initial.memo || '');
  const [tags, setTags] = useState<string[]>([]);

  // UI 状態
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showPresetModal, setShowPresetModal] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showAccountTitleManager, setShowAccountTitleManager] = useState(false);

  // プリセット選択時の適用
  const applyPreset = (preset: VendorPreset) => {
    setVendor(preset.name);
    setCategory(preset.category || 'その他');
    if (preset.accountTitle) setAccountTitle(preset.accountTitle as AccountTitle);
    if (preset.taxCategory) setTaxCategory(preset.taxCategory as TaxCategory);
    if (preset.memo) setMemo(preset.memo);
    setShowPresetModal(false);
  };

  // OCR オリジナル値（復元用）
  const ocrOriginal = {
    date: initial.date,
    vendor: initial.vendor,
    amount: String(initial.amount || '0'),
  };

  const handleOcrRestore = (key: 'date' | 'vendor' | 'amount') => {
    if (key === 'date') setDate(ocrOriginal.date);
    if (key === 'vendor') setVendor(ocrOriginal.vendor);
    if (key === 'amount') setAmount(ocrOriginal.amount);
  };

  const filename = buildFilename(date, vendor, Number(amount));
  const valid = date && vendor && Number(amount) >= 0;

  const handleSave = () => {
    onSave({
      date,
      vendor,
      amount: Number(amount),
      taxAmount: Number(taxAmount),
      category,
      accountTitle,
      taxCategory,
      purpose,
      memo,
      tags,
      filename,
      ocrRawText: ocrText,
      ocrConfidence,
    });
  };

  const allTags = getAllTags();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col overflow-hidden max-h-[95vh]">
        {/* ヘッダー */}
        <div className="bg-blue-700 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold">領収書情報の確認・編集</h2>
            <p className="text-blue-200 text-xs mt-0.5">OCR結果を確認し、必要に応じて修正してください</p>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-white/20 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col md:flex-row overflow-auto flex-1 min-h-0">
          {/* 左：クロップ画像プレビュー */}
          <div className="md:w-64 bg-slate-900 flex flex-col items-center justify-start p-4 gap-3 shrink-0">
            <p className="text-xs text-slate-400 font-medium">クロップ画像プレビュー</p>
            <img
              src={croppedDataUrl}
              alt="crop"
              className="rounded-lg shadow object-contain max-h-72 w-full"
            />
            {/* OCR修正パネルをサムネイル下に */}
            <div className="w-full">
              <OcrCorrector
                rawText={ocrText}
                ocrConfidence={ocrConfidence}
                originalValues={ocrOriginal}
                currentValues={{ date, vendor, amount }}
                onRestore={handleOcrRestore}
              />
            </div>
          </div>

          {/* 右：フォーム */}
          <div className="flex-1 flex flex-col gap-0 overflow-auto">
            {/* ファイル名プレビュー */}
            <div className="mx-5 mt-4 bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-xs text-blue-700 break-all">
              <span className="font-semibold">📄 保存ファイル名：</span>{filename}
            </div>

            <div className="p-5 flex flex-col gap-4">
              {/* 基本情報 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="日付" required>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className={inputCls}
                  />
                </Field>

                <Field label="支払先" required>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={vendor}
                      onChange={(e) => setVendor(e.target.value)}
                      placeholder="例: スターバックス"
                      className={cn(inputCls, 'flex-1')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPresetModal(true)}
                      title="よく使う購入先から選択"
                      className="shrink-0 flex items-center gap-1 px-2.5 py-2 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-700 border border-amber-200 text-xs font-medium transition"
                    >
                      <Star className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">プリセット</span>
                    </button>
                  </div>
                </Field>

                <Field label="金額（円）" required>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">¥</span>
                    <input
                      type="number"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      min={0}
                      className={cn(inputCls, 'pl-7')}
                    />
                  </div>
                  {/* OCR金額候補ボタン */}
                  {amountCandidates.length > 1 && (
                    <div className="flex flex-wrap gap-1 mt-1">
                      <span className="text-[10px] text-slate-400 self-center">候補:</span>
                      {amountCandidates.slice(0, 6).map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setAmount(String(v))}
                          className={cn(
                            'px-2 py-0.5 rounded-lg text-[10px] font-mono border transition',
                            String(v) === amount
                              ? 'bg-blue-600 text-white border-blue-600 font-bold'
                              : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-blue-50 hover:border-blue-300'
                          )}
                        >
                          ¥{v.toLocaleString()}
                        </button>
                      ))}
                    </div>
                  )}
                </Field>

                <Field label="消費税額（円）">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">¥</span>
                    <input
                      type="number"
                      value={taxAmount}
                      onChange={(e) => setTaxAmount(e.target.value)}
                      min={0}
                      className={cn(inputCls, 'pl-7')}
                    />
                  </div>
                </Field>

                <Field label="カテゴリ">
                  <div className="flex gap-1.5">
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className={cn(inputCls, 'flex-1')}
                    >
                      {customCategories.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowCategoryManager(true)}
                      title="カテゴリを管理"
                      className="shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-violet-100 hover:bg-violet-200 text-violet-700 border border-violet-200 transition"
                    >
                      <Settings className="w-4 h-4" />
                    </button>
                  </div>
                </Field>

                <Field label="税区分">
                  <select
                    value={taxCategory}
                    onChange={(e) => setTaxCategory(e.target.value as TaxCategory)}
                    className={inputCls}
                  >
                    {TAX_CATEGORIES.map((t) => (
                      <option key={t} value={t}>{t || '未設定'}</option>
                    ))}
                  </select>
                </Field>
              </div>

              {/* タグ入力 */}
              <Field label="タグ">
                <div className="relative">
                  <TagInput
                    tags={tags}
                    onChange={setTags}
                    suggestions={allTags}
                    placeholder="タグを追加（例: 出張, 経費, 2024年度）"
                  />
                </div>
              </Field>

              {/* 適用・用途 */}
              <Field label="適用・用途">
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="例: ○○プロジェクト打ち合わせ / 東京出張交通費"
                  className={inputCls}
                />
              </Field>

              {/* 詳細設定（展開式） */}
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowAdvanced(!showAdvanced)}
                  className="w-full flex items-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 transition text-sm font-medium text-slate-700"
                >
                  <span>詳細設定（勘定科目・メモ）</span>
                  {showAdvanced ? <ChevronUp className="w-4 h-4 ml-auto" /> : <ChevronDown className="w-4 h-4 ml-auto" />}
                </button>
                {showAdvanced && (
                  <div className="p-4 flex flex-col gap-4">
                    <Field label="勘定科目">
                      <div className="flex gap-1.5">
                        <select
                          value={accountTitle}
                          onChange={(e) => setAccountTitle(e.target.value as AccountTitle)}
                          className={cn(inputCls, 'flex-1')}
                        >
                          <option value="">未設定</option>
                          {customAccountTitles.map((a) => (
                            <option key={a} value={a}>{a}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setShowAccountTitleManager(true)}
                          title="勘定科目を管理"
                          className="shrink-0 flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-700 border border-emerald-200 transition"
                        >
                          <BookOpen className="w-4 h-4" />
                        </button>
                      </div>
                    </Field>

                    <Field label="メモ・備考">
                      <textarea
                        value={memo}
                        onChange={(e) => setMemo(e.target.value)}
                        rows={2}
                        className={cn(inputCls, 'resize-none')}
                        placeholder="自由記述メモ"
                      />
                    </Field>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* フッター */}
        <div className="flex gap-3 justify-end px-6 py-4 border-t border-slate-200 bg-slate-50 shrink-0">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 text-sm"
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            disabled={!valid || isSaving}
            className={cn(
              'flex items-center gap-2 px-6 py-2 rounded-lg text-white text-sm font-medium transition',
              valid && !isSaving
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-slate-300 cursor-not-allowed'
            )}
          >
            <Save className="w-4 h-4" />
            {isSaving ? '処理中...' : '保存してアーカイブ'}
          </button>
        </div>
      </div>

      {/* プリセット選択モーダル */}
      {showPresetModal && (
        <VendorPresetModal
          onClose={() => setShowPresetModal(false)}
          onSelect={applyPreset}
          selectMode={true}
        />
      )}

      {/* カテゴリ管理モーダル */}
      {showCategoryManager && (
        <CategoryManager
          onClose={() => setShowCategoryManager(false)}
        />
      )}

      {/* 勘定科目管理モーダル */}
      {showAccountTitleManager && (
        <AccountTitleManager
          onClose={() => setShowAccountTitleManager(false)}
        />
      )}
    </div>
  );
}
