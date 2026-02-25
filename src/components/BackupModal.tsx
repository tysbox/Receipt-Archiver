/**
 * BackupModal.tsx
 *
 * データのバックアップ・リストア機能
 *
 * 機能:
 * 1. JSONバックアップ export（全データをJSONファイルとして保存）
 * 2. JSONバックアップ import（JSONファイルを読み込んでリストア）
 * 3. ストレージ使用量の表示
 * 4. PDFデータの保存状況説明
 * 5. データ整合性チェック
 */

import { useState, useRef } from 'react';
import { useReceiptStore } from '../store/receiptStore';
import { Receipt } from '../types/receipt';
import {
  X, Download, Upload, AlertTriangle, CheckCircle2,
  Database, HardDrive, FileJson, Info, Trash2,
  RefreshCw, Shield, Archive
} from 'lucide-react';
import { cn } from '../utils/cn';

interface Props {
  onClose: () => void;
  darkMode?: boolean;
}

const STORAGE_KEY = 'receipt_archive_v2';

function getStorageInfo() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? '';
    const bytes = new Blob([raw]).size;
    const mb = bytes / 1024 / 1024;
    const kb = bytes / 1024;
    return {
      bytes,
      display: mb >= 1 ? `${mb.toFixed(2)} MB` : `${kb.toFixed(1)} KB`,
      percent: Math.min(100, (mb / 5) * 100), // localStorageは通常5MB制限
    };
  } catch {
    return { bytes: 0, display: '不明', percent: 0 };
  }
}

export function BackupModal({ onClose, darkMode = false }: Props) {
  const { receipts, addReceipt, deleteReceipt } = useReceiptStore();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = useState<{
    type: 'success' | 'error' | 'preview';
    message: string;
    count?: number;
    preview?: Receipt[];
    allData?: Receipt[]; // 全件データ（プレビューは5件のみ表示するが全件保持）
  } | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMode, setImportMode] = useState<'merge' | 'replace'>('merge');

  const dm = darkMode;
  const storageInfo = getStorageInfo();

  // ============================================================
  // JSONエクスポート
  // ============================================================
  const handleExport = () => {
    try {
      const backup = {
        version: '3.1',
        exportedAt: new Date().toISOString(),
        appName: '領収書アーカイブ管理システム',
        count: receipts.length,
        receipts: receipts,
      };

      const json = JSON.stringify(backup, null, 2);
      const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      a.download = `領収書アーカイブ_バックアップ_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      setImportResult({
        type: 'success',
        message: `✅ ${receipts.length}件のデータをJSONファイルにエクスポートしました。\n安全な場所に保存してください。`,
        count: receipts.length,
      });
    } catch (e) {
      setImportResult({
        type: 'error',
        message: `エクスポートに失敗しました: ${String(e)}`,
      });
    }
  };

  // ============================================================
  // JSONインポート
  // ============================================================
  const handleFileSelect = async (file: File) => {
    if (!file.name.endsWith('.json')) {
      setImportResult({
        type: 'error',
        message: 'JSONファイル（.json）を選択してください。',
      });
      return;
    }

    setImporting(true);
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      // バリデーション
      if (!data.receipts || !Array.isArray(data.receipts)) {
        throw new Error('不正なバックアップファイルです（receipts配列が見つかりません）');
      }

      const validReceipts = data.receipts.filter((r: unknown) => {
        if (typeof r !== 'object' || r === null) return false;
        const receipt = r as Record<string, unknown>;
        return (
          typeof receipt.id === 'string' &&
          typeof receipt.date === 'string' &&
          typeof receipt.vendor === 'string' &&
          typeof receipt.amount === 'number'
        );
      });

      if (validReceipts.length === 0) {
        throw new Error('有効なデータが見つかりませんでした。');
      }

      setImportResult({
        type: 'preview',
        message: `${validReceipts.length}件のデータが見つかりました。インポートしますか？`,
        count: validReceipts.length,
        preview: validReceipts.slice(0, 5),
        allData: validReceipts, // 全件を保持
      });

    } catch (e) {
      setImportResult({
        type: 'error',
        message: `ファイルの読み込みに失敗しました: ${String(e)}`,
      });
    } finally {
      setImporting(false);
    }
  };

  const handleImportConfirm = () => {
    if (!importResult?.allData) return;

    // 全件データを使用（プレビューの5件ではなく）
    const toImport: Receipt[] = importResult.allData;

    if (importMode === 'replace') {
      // 既存データを全削除してから追加
      receipts.forEach(r => deleteReceipt(r.id));
    }

    let added = 0;
    const existingIds = new Set(receipts.map(r => r.id));

    for (const r of toImport) {
      if (importMode === 'merge' && existingIds.has(r.id)) {
        continue; // 重複スキップ
      }
      const normalized: Receipt = {
        id: r.id || Math.random().toString(36).slice(2),
        filename: r.filename || `${r.date}_${r.vendor}.pdf`,
        date: r.date || '',
        vendor: r.vendor || '不明',
        amount: Number(r.amount) || 0,
        taxAmount: Number(r.taxAmount) || 0,
        category: r.category || 'その他',
        accountTitle: r.accountTitle || '',
        taxCategory: r.taxCategory || '',
        purpose: r.purpose || '',
        memo: r.memo || '',
        tags: Array.isArray(r.tags) ? r.tags : [],
        originalType: r.originalType || 'image',
        croppedImageData: r.croppedImageData || '',
        pdfData: r.pdfData || '',
        createdAt: r.createdAt || new Date().toISOString(),
        ocrRawText: r.ocrRawText || '',
        ocrConfidence: Number(r.ocrConfidence) || 0,
      };
      addReceipt(normalized);
      added++;
    }

    setImportResult({
      type: 'success',
      message: `✅ ${added}件のデータをインポートしました！`,
      count: added,
    });
  };

  const dm_card = cn(
    'rounded-2xl border p-5',
    dm ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200'
  );
  const text = dm ? 'text-slate-200' : 'text-slate-700';
  const sub = dm ? 'text-slate-400' : 'text-slate-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3">
      <div className={cn(
        'w-full max-w-2xl flex flex-col rounded-2xl shadow-2xl overflow-hidden max-h-[95vh]',
        dm ? 'bg-slate-800' : 'bg-slate-50'
      )}>

        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-indigo-800 to-blue-800 text-white px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-base font-bold flex items-center gap-2">
              <Archive className="w-5 h-5" />
              データバックアップ・リストア
            </h2>
            <p className="text-blue-200 text-xs mt-0.5">
              JSONファイルでデータを安全に保存・復元 ／ PDF画像データも含めて完全バックアップ
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-auto flex-1 p-5 flex flex-col gap-4">

          {/* ストレージ状況 */}
          <div className={dm_card}>
            <h3 className={cn('font-bold text-sm mb-3 flex items-center gap-2', text)}>
              <Database className="w-4 h-4 text-blue-500" />
              ストレージ使用状況
            </h3>
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between text-sm">
                <span className={sub}>使用量</span>
                <span className={cn('font-bold font-mono', text)}>{storageInfo.display}</span>
              </div>
              <div className={cn('h-3 rounded-full overflow-hidden', dm ? 'bg-slate-600' : 'bg-slate-200')}>
                <div
                  className={cn('h-full rounded-full transition-all', storageInfo.percent > 80 ? 'bg-red-500' : storageInfo.percent > 60 ? 'bg-yellow-500' : 'bg-blue-500')}
                  style={{ width: `${Math.max(2, storageInfo.percent)}%` }}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className={cn('rounded-xl border p-3 text-center', dm ? 'bg-slate-600 border-slate-500' : 'bg-slate-50 border-slate-200')}>
                  <p className={cn('text-lg font-bold', text)}>{receipts.length}</p>
                  <p className={cn('text-[10px]', sub)}>件保存</p>
                </div>
                <div className={cn('rounded-xl border p-3 text-center', dm ? 'bg-slate-600 border-slate-500' : 'bg-slate-50 border-slate-200')}>
                  <p className={cn('text-sm font-bold', text)}>{storageInfo.display}</p>
                  <p className={cn('text-[10px]', sub)}>使用中</p>
                </div>
                <div className={cn('rounded-xl border p-3 text-center', dm ? 'bg-slate-600 border-slate-500' : 'bg-slate-50 border-slate-200')}>
                  <p className={cn('text-sm font-bold', text)}>
                    {storageInfo.percent > 80 ? '⚠️ 残り少' : '✅ 余裕あり'}
                  </p>
                  <p className={cn('text-[10px]', sub)}>容量状態</p>
                </div>
              </div>

              {/* PDFデータ保存の説明 */}
              <div className={cn('rounded-xl border p-3 text-xs', dm ? 'bg-blue-900/30 border-blue-700 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-700')}>
                <div className="flex items-start gap-2">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold mb-1">📄 アップロードしたPDFはどこに保存されている？</p>
                    <p className="leading-relaxed">
                      クロップ画像と生成PDFは<strong>すべてこのブラウザのlocalStorage</strong>に保存されています。
                      ブラウザを閉じても、PCを再起動しても<strong>データは消えません</strong>。
                      ただし以下の場合はデータが失われます：
                    </p>
                    <ul className="mt-1.5 space-y-1 list-disc list-inside">
                      <li>ブラウザの「閲覧履歴・キャッシュ」を全削除した場合</li>
                      <li>ブラウザをアンインストールした場合</li>
                      <li>異なるブラウザやPCで開いた場合（別のlocalStorage）</li>
                    </ul>
                    <p className="mt-1.5 font-bold">→ 定期的なJSONバックアップを強く推奨します！</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* エクスポート */}
          <div className={dm_card}>
            <h3 className={cn('font-bold text-sm mb-3 flex items-center gap-2', text)}>
              <Download className="w-4 h-4 text-green-500" />
              JSONバックアップをエクスポート
            </h3>
            <p className={cn('text-xs mb-4 leading-relaxed', sub)}>
              全データ（領収書情報・クロップ画像・PDF・タグ・メモすべて）をJSONファイルとして保存します。
              別のPCや将来のリストアに使用できます。
            </p>
            <div className="flex flex-col gap-3">
              <div className={cn('rounded-xl border p-3 text-xs grid grid-cols-2 gap-2', dm ? 'bg-slate-600 border-slate-500' : 'bg-slate-50 border-slate-200')}>
                {[
                  ['📋 件数', `${receipts.length} 件`],
                  ['💾 サイズ', storageInfo.display],
                  ['📄 形式', 'JSON (UTF-8)'],
                  ['🗓️ 日時', new Date().toLocaleDateString('ja-JP')],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between items-center">
                    <span className={sub}>{label}</span>
                    <span className={cn('font-bold', text)}>{value}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={handleExport}
                disabled={receipts.length === 0}
                className={cn(
                  'flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-white font-bold text-sm transition',
                  receipts.length > 0
                    ? 'bg-green-600 hover:bg-green-700 shadow'
                    : 'bg-slate-300 cursor-not-allowed'
                )}
              >
                <FileJson className="w-5 h-5" />
                {receipts.length}件のデータをJSONでバックアップ
              </button>
              {receipts.length === 0 && (
                <p className={cn('text-xs text-center', sub)}>保存されたデータがありません</p>
              )}
            </div>
          </div>

          {/* インポート */}
          <div className={dm_card}>
            <h3 className={cn('font-bold text-sm mb-3 flex items-center gap-2', text)}>
              <Upload className="w-4 h-4 text-blue-500" />
              JSONバックアップからリストア
            </h3>
            <p className={cn('text-xs mb-4 leading-relaxed', sub)}>
              以前にエクスポートしたJSONファイルを読み込んでデータを復元します。
              クロップ画像・PDFデータも含めて完全に復元されます。
            </p>

            {/* インポートモード選択 */}
            <div className="flex gap-2 mb-4">
              {([
                ['merge', '統合（重複スキップ）', '既存データを保持しながら追加。同じIDのデータはスキップ'],
                ['replace', '上書き（全置換）', '既存データをすべて削除してからインポート'],
              ] as [typeof importMode, string, string][]).map(([mode, label, desc]) => (
                <button
                  key={mode}
                  onClick={() => setImportMode(mode)}
                  className={cn(
                    'flex-1 p-3 rounded-xl border-2 text-left transition',
                    importMode === mode
                      ? mode === 'replace'
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-blue-500 bg-blue-50 text-blue-700'
                      : dm
                      ? 'border-slate-600 text-slate-400 hover:border-slate-500'
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  )}
                >
                  <p className="text-xs font-bold">{label}</p>
                  <p className="text-[10px] mt-0.5 opacity-70">{desc}</p>
                </button>
              ))}
            </div>

            {importMode === 'replace' && (
              <div className={cn('rounded-xl border p-3 mb-3 text-xs flex items-start gap-2', dm ? 'bg-red-900/30 border-red-700 text-red-300' : 'bg-red-50 border-red-200 text-red-700')}>
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span><strong>警告:</strong> 現在保存されている{receipts.length}件のデータがすべて削除されます。この操作は取り消せません。事前にバックアップを取ることを推奨します。</span>
              </div>
            )}

            {/* ファイル選択エリア */}
            <div
              className={cn(
                'border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition',
                dm ? 'border-slate-600 hover:border-blue-500 hover:bg-slate-700' : 'border-slate-300 hover:border-blue-400 hover:bg-blue-50'
              )}
              onClick={() => fileInputRef.current?.click()}
            >
              <FileJson className={cn('w-10 h-10 mx-auto mb-2', dm ? 'text-slate-500' : 'text-slate-400')} />
              <p className={cn('text-sm font-medium', text)}>
                {importing ? '読み込み中...' : 'JSONファイルをクリックして選択'}
              </p>
              <p className={cn('text-xs mt-1', sub)}>
                バックアップした .json ファイルを選択してください
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  handleFileSelect(e.target.files[0]);
                  e.target.value = '';
                }
              }}
            />
          </div>

          {/* インポート結果 */}
          {importResult && (
            <div className={cn(
              'rounded-2xl border p-4',
              importResult.type === 'success'
                ? dm ? 'bg-green-900/30 border-green-700' : 'bg-green-50 border-green-200'
                : importResult.type === 'error'
                ? dm ? 'bg-red-900/30 border-red-700' : 'bg-red-50 border-red-200'
                : dm ? 'bg-blue-900/30 border-blue-700' : 'bg-blue-50 border-blue-200'
            )}>
              <div className="flex items-start gap-3">
                {importResult.type === 'success' && <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />}
                {importResult.type === 'error' && <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />}
                {importResult.type === 'preview' && <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />}
                <div className="flex-1 min-w-0">
                  <p className={cn('text-sm font-medium whitespace-pre-line',
                    importResult.type === 'success' ? (dm ? 'text-green-300' : 'text-green-700') :
                    importResult.type === 'error' ? (dm ? 'text-red-300' : 'text-red-700') :
                    (dm ? 'text-blue-300' : 'text-blue-700')
                  )}>
                    {importResult.message}
                  </p>

                  {/* プレビュー */}
                  {importResult.type === 'preview' && importResult.preview && (
                    <div className="mt-3 flex flex-col gap-2">
                      <p className={cn('text-xs font-bold', dm ? 'text-slate-300' : 'text-slate-600')}>
                        プレビュー（最初の{Math.min(5, importResult.preview.length)}件）:
                      </p>
                      <div className={cn('rounded-xl overflow-hidden border text-xs', dm ? 'border-slate-600' : 'border-slate-200')}>
                        {importResult.preview.map((r, i) => (
                          <div key={r.id} className={cn(
                            'flex items-center gap-3 px-3 py-2',
                            i % 2 === 0
                              ? dm ? 'bg-slate-700' : 'bg-white'
                              : dm ? 'bg-slate-600' : 'bg-slate-50'
                          )}>
                            <span className={cn('font-mono', dm ? 'text-slate-400' : 'text-slate-400')}>{r.date}</span>
                            <span className={cn('flex-1 truncate font-medium', dm ? 'text-slate-200' : 'text-slate-700')}>{r.vendor}</span>
                            <span className={cn('font-bold font-mono', dm ? 'text-slate-300' : 'text-slate-700')}>¥{r.amount?.toLocaleString()}</span>
                          </div>
                        ))}
                        {(importResult.count ?? 0) > 5 && (
                          <div className={cn('px-3 py-2 text-center', dm ? 'bg-slate-700 text-slate-400' : 'bg-slate-50 text-slate-400')}>
                            ... 他 {(importResult.count ?? 0) - 5} 件
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => setImportResult(null)}
                          className={cn('flex-1 py-2 rounded-xl border text-sm font-medium transition', dm ? 'border-slate-600 text-slate-400 hover:bg-slate-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}
                        >
                          キャンセル
                        </button>
                        <button
                          onClick={handleImportConfirm}
                          className={cn(
                            'flex-1 py-2 rounded-xl text-white text-sm font-bold transition',
                            importMode === 'replace'
                              ? 'bg-red-600 hover:bg-red-700'
                              : 'bg-blue-600 hover:bg-blue-700'
                          )}
                        >
                          {importMode === 'replace' ? '⚠️ 上書きでインポート' : '統合インポート'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 注意事項 */}
          <div className={cn('rounded-xl border p-4 text-xs', dm ? 'bg-slate-700 border-slate-600 text-slate-400' : 'bg-white border-slate-200 text-slate-500')}>
            <div className="flex items-start gap-2">
              <Shield className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
              <div>
                <p className={cn('font-bold mb-2', dm ? 'text-slate-300' : 'text-slate-700')}>💡 データ保存のベストプラクティス</p>
                <ul className="space-y-1.5">
                  <li className="flex items-start gap-1.5">
                    <span className="text-blue-500 shrink-0">①</span>
                    <span><strong>月1回</strong>はJSONバックアップをエクスポートして、USBや別フォルダに保存</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-blue-500 shrink-0">②</span>
                    <span>重要な領収書は個別の<strong>PDFとして必ずダウンロード保存</strong>（アーカイブ一覧→ダウンロードボタン）</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-blue-500 shrink-0">③</span>
                    <span>ブラウザの<strong>「閲覧履歴を削除」はデータが消えるので注意</strong>（サイトデータ削除の場合）</span>
                  </li>
                  <li className="flex items-start gap-1.5">
                    <span className="text-blue-500 shrink-0">④</span>
                    <span>PC移行時はJSONバックアップを新しいPCのブラウザにインポート</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* データリセット */}
          {receipts.length > 0 && (
            <div className={cn('rounded-xl border p-4', dm ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200')}>
              <h3 className={cn('font-bold text-sm mb-2 flex items-center gap-2 text-red-500')}>
                <Trash2 className="w-4 h-4" />
                全データ削除
              </h3>
              <p className={cn('text-xs mb-3', sub)}>
                すべてのデータを削除します。この操作は取り消せません。事前にバックアップを取ってください。
              </p>
              <button
                onClick={() => {
                  if (confirm(`⚠️ ${receipts.length}件のデータをすべて削除しますか？\n\nこの操作は取り消せません。\nバックアップを取りましたか？`)) {
                    receipts.forEach(r => deleteReceipt(r.id));
                    setImportResult({ type: 'success', message: 'すべてのデータを削除しました。' });
                  }
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 border border-red-200 text-red-600 text-sm font-medium hover:bg-red-100 transition"
              >
                <Trash2 className="w-4 h-4" />
                {receipts.length}件を全削除
              </button>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className={cn(
          'flex items-center justify-between px-5 py-4 border-t shrink-0',
          dm ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'
        )}>
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-blue-500" />
            <p className={cn('text-xs', sub)}>
              データはこのブラウザのlocalStorageに保存 · クラウド送信なし
            </p>
          </div>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition"
          >
            <RefreshCw className="w-4 h-4" />
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
}
