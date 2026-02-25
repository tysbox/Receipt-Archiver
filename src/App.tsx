import { useCallback, useEffect, useRef, useState } from 'react';
import { Receipt } from './types/receipt';
import { useReceiptStore } from './store/receiptStore';
import { pdfPageToCanvas, imageToCanvas, getPdfInfo } from './utils/pdfUtils';
import { runOcr, postprocessOcrText } from './utils/ocr';
import { generateReceiptPdf } from './utils/generatePdf';
import { CropModal } from './components/CropModal';
import { ReceiptForm } from './components/ReceiptForm';
import { ReceiptList } from './components/ReceiptList';
import { PreviewModal } from './components/PreviewModal';
import { StatsPanel } from './components/StatsPanel';
import { ExportModal } from './components/ExportModal';
import { BackupModal } from './components/BackupModal';
import { VendorPresetModal } from './components/VendorPresetModal';
import { CategoryManager } from './components/CategoryManager';
import { AccountTitleManager } from './components/AccountTitleManager';
import { Toolbar } from './components/Toolbar';
import { InstallGuide } from './components/InstallGuide';
import { WelcomeBanner } from './components/WelcomeBanner';
import { cn } from './utils/cn';
import {
  Upload, LayoutList, BarChart3, FolderOpen,
  Loader2, AlertCircle, CheckCircle2, Download,
  FileSpreadsheet, Plus, Trash2, RefreshCw,
  Moon, Sun, Info, MonitorDown, X, Star, Tag, BookOpen
} from 'lucide-react';

type Step = 'idle' | 'cropping' | 'ocr' | 'form' | 'done';
type Tab = 'list' | 'stats';

interface OcrResultData {
  rawText: string;
  date: string;
  vendor: string;
  amount: number;
  confidence: number;
  amountCandidates: number[];
}

interface ProcessState {
  step: Step;
  canvas: HTMLCanvasElement | null;
  croppedDataUrl: string;
  ocrResult: OcrResultData | null;
  ocrProgress: number;
  error: string | null;
  originalType: 'pdf' | 'image';
  pdfArrayBuffer: ArrayBuffer | null;
  pdfNumPages: number;
  pdfCurrentPage: number;
}

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** ServiceWorkerを登録 */
function registerSW() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {/* ignore */});
    });
  }
}

export function App() {
  const [tab, setTab] = useState<Tab>('list');
  const [proc, setProc] = useState<ProcessState>({
    step: 'idle', canvas: null, croppedDataUrl: '',
    ocrResult: null, ocrProgress: 0, error: null, originalType: 'image',
    pdfArrayBuffer: null, pdfNumPages: 1, pdfCurrentPage: 1,
  });
  const [previewReceipt, setPreviewReceipt] = useState<Receipt | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [showBackup, setShowBackup] = useState(false);
  const [showVendorPresets, setShowVendorPresets] = useState(false);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [showAccountTitleManager, setShowAccountTitleManager] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [installBanner, setInstallBanner] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [installPromptEvent, setInstallPromptEvent] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { addReceipt, receipts, deleteReceipt } = useReceiptStore();
  const dropRef = useRef<HTMLDivElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // ServiceWorker登録 & PWAインストールイベント捕捉
  useEffect(() => {
    registerSW();

    // インストール済み判定
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.navigator as any).standalone === true;

    if (!isStandalone) {
      // beforeinstallprompt: Chromeがインストール可能と判断した時
      const handler = (e: Event) => {
        e.preventDefault();
        setInstallPromptEvent(e);
        setInstallBanner(true);
      };
      window.addEventListener('beforeinstallprompt', handler);

      // 初回訪問時はウェルカムバナーを自動表示（1.5秒後）
      const shown = sessionStorage.getItem('welcome_shown');
      if (!shown) {
        setTimeout(() => {
          setShowWelcome(true);
          sessionStorage.setItem('welcome_shown', '1');
        }, 1500);
      }

      return () => window.removeEventListener('beforeinstallprompt', handler);
    }
  }, []);

  const handleNativeInstall = async () => {
    if (!installPromptEvent) return;
    await installPromptEvent.prompt();
    setInstallBanner(false);
    setInstallPromptEvent(null);
  };

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const reset = () => setProc({
    step: 'idle', canvas: null, croppedDataUrl: '',
    ocrResult: null, ocrProgress: 0, error: null, originalType: 'image',
    pdfArrayBuffer: null, pdfNumPages: 1, pdfCurrentPage: 1,
  });

  const handleFile = useCallback(async (file: File) => {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImg = file.type.startsWith('image/');
    if (!isPdf && !isImg) {
      setProc(p => ({ ...p, error: 'PDFまたは画像ファイルを選択してください。' }));
      return;
    }

    // 先にリセットしてエラーをクリア
    setProc(p => ({ ...p, error: null, step: 'idle' }));

    try {
      if (isPdf) {
        const buf = await file.arrayBuffer();
        const { numPages } = await getPdfInfo(buf);
        const canvas = await pdfPageToCanvas(buf, 1, 2.0);
        // step を 'cropping' にセットしてクロップモーダルを開く
        setProc({
          step: 'cropping',
          canvas,
          croppedDataUrl: '',
          ocrResult: null,
          ocrProgress: 0,
          error: null,
          originalType: 'pdf',
          pdfArrayBuffer: buf,
          pdfNumPages: numPages,
          pdfCurrentPage: 1,
        });
      } else {
        const dataUrl = await new Promise<string>((res, rej) => {
          const fr = new FileReader();
          fr.onload = () => res(fr.result as string);
          fr.onerror = rej;
          fr.readAsDataURL(file);
        });
        const canvas = await imageToCanvas(dataUrl);
        // step を 'cropping' にセットしてクロップモーダルを開く
        setProc({
          step: 'cropping',
          canvas,
          croppedDataUrl: '',
          ocrResult: null,
          ocrProgress: 0,
          error: null,
          originalType: 'image',
          pdfArrayBuffer: null,
          pdfNumPages: 1,
          pdfCurrentPage: 1,
        });
      }
    } catch (e) {
      setProc(p => ({ ...p, error: `ファイル読み込みエラー: ${String(e)}`, step: 'idle' }));
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleCropConfirm = async (croppedDataUrl: string) => {
    setProc((p) => ({ ...p, step: 'ocr', croppedDataUrl, ocrProgress: 0 }));

    const img = new Image();
    img.src = croppedDataUrl;
    await new Promise((r) => { img.onload = r; });
    const tmpCanvas = document.createElement('canvas');
    tmpCanvas.width = img.naturalWidth;
    tmpCanvas.height = img.naturalHeight;
    tmpCanvas.getContext('2d')!.drawImage(img, 0, 0);

    try {
      const result = await runOcr(tmpCanvas, (pct) => {
        setProc((p) => ({ ...p, ocrProgress: pct }));
      });
      setProc((p) => ({
        ...p,
        step: 'form',
        ocrResult: {
          rawText: postprocessOcrText(result.rawText),
          date: result.date,
          vendor: result.vendor,
          amount: result.amount,
          confidence: result.confidence ?? 0,
          amountCandidates: result.amountCandidates ?? [],
        },
      }));
    } catch {
      setProc((p) => ({
        ...p, step: 'form',
        ocrResult: {
          rawText: '',
          date: new Date().toISOString().slice(0, 10),
          vendor: '不明',
          amount: 0,
          confidence: 0,
          amountCandidates: [],
        },
      }));
    }
  };

  const handleFormSave = async (
    data: Omit<Receipt, 'id' | 'createdAt' | 'originalType' | 'croppedImageData' | 'pdfData'>
  ) => {
    setIsSaving(true);
    try {
      const pdfDataUri = generateReceiptPdf(proc.croppedDataUrl, data);
      const receipt: Receipt = {
        id: uid(),
        ...data,
        originalType: proc.originalType,
        croppedImageData: proc.croppedDataUrl,
        pdfData: pdfDataUri,
        createdAt: new Date().toISOString(),
      };
      addReceipt(receipt);
      reset();
      setTab('list');
      showToast('✅ 領収書をアーカイブに保存しました');
    } catch (e) {
      showToast(`保存に失敗しました: ${String(e)}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const steps: Step[] = ['idle', 'cropping', 'ocr', 'form'];
  const currentStepIdx = steps.indexOf(proc.step);

  // ツールバーアイテム定義
  const toolbarItems = [
    {
      id: 'upload',
      icon: <Plus className="w-5 h-5" />,
      label: '新規追加',
      onClick: () => fileInputRef.current?.click(),
      color: 'text-blue-600',
      active: false,
      dividerAfter: false,
    },
    {
      id: 'list',
      icon: <LayoutList className="w-5 h-5" />,
      label: '一覧',
      onClick: () => setTab('list'),
      active: tab === 'list',
      badge: receipts.length > 0 ? receipts.length : undefined,
      dividerAfter: false,
    },
    {
      id: 'stats',
      icon: <BarChart3 className="w-5 h-5" />,
      label: '分析',
      onClick: () => setTab('stats'),
      active: tab === 'stats',
      dividerAfter: true,
    },
    {
      id: 'export',
      icon: <FileSpreadsheet className="w-5 h-5" />,
      label: 'エクスポート',
      onClick: () => setShowExport(true),
      color: 'text-green-600',
      active: false,
      dividerAfter: false,
    },
    {
      id: 'backup',
      icon: <Download className="w-5 h-5" />,
      label: 'バックアップ',
      onClick: () => setShowBackup(true),
      color: 'text-indigo-500',
      active: false,
      dividerAfter: false,
    },
    {
      id: 'vendors',
      icon: <Star className="w-5 h-5" />,
      label: 'プリセット',
      onClick: () => setShowVendorPresets(true),
      color: 'text-amber-500',
      active: false,
      dividerAfter: false,
    },
    {
      id: 'categories',
      icon: <Tag className="w-5 h-5" />,
      label: 'カテゴリ',
      onClick: () => setShowCategoryManager(true),
      color: 'text-violet-500',
      active: false,
      dividerAfter: false,
    },
    {
      id: 'accounttitles',
      icon: <BookOpen className="w-5 h-5" />,
      label: '勘定科目',
      onClick: () => setShowAccountTitleManager(true),
      color: 'text-emerald-500',
      active: false,
      dividerAfter: true,
    },
    {
      id: 'install',
      icon: <MonitorDown className="w-5 h-5" />,
      label: 'インストール',
      onClick: () => setShowInstallGuide(true),
      color: 'text-purple-600',
      active: false,
      dividerAfter: false,
    },
    {
      id: 'dark',
      icon: darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />,
      label: darkMode ? 'ライト' : 'ダーク',
      onClick: () => setDarkMode(!darkMode),
      active: darkMode,
      dividerAfter: false,
    },
    {
      id: 'help',
      icon: <Info className="w-5 h-5" />,
      label: 'ヘルプ',
      onClick: () => setShowHelp(!showHelp),
      active: showHelp,
      dividerAfter: false,
    },
  ];

  return (
    <div className={cn(
      'min-h-screen flex flex-col transition-colors duration-300',
      darkMode
        ? 'bg-slate-900 text-slate-100'
        : 'bg-gradient-to-br from-slate-100 via-blue-50 to-slate-100'
    )}>

      {/* ===== PWAインストールバナー ===== */}
      {installBanner && (
        <div className={cn(
          'z-30 flex items-center gap-3 px-4 py-3 text-sm',
          'bg-gradient-to-r from-purple-700 to-indigo-700 text-white shadow-lg'
        )}>
          <MonitorDown className="w-5 h-5 shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="font-bold">このアプリをインストールできます！</span>
            <span className="ml-2 text-purple-200 text-xs hidden sm:inline">
              デスクトップアプリとして使用するとさらに快適です
            </span>
          </div>
          <button
            onClick={handleNativeInstall}
            className="bg-white text-purple-700 font-bold text-xs px-4 py-1.5 rounded-lg hover:bg-purple-50 transition shrink-0"
          >
            インストール
          </button>
          <button
            onClick={() => setShowInstallGuide(true)}
            className="text-purple-200 text-xs hover:text-white transition shrink-0 underline"
          >
            詳しく見る
          </button>
          <button
            onClick={() => setInstallBanner(false)}
            className="p-1 rounded hover:bg-white/20 transition shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ===== ヘッダー ===== */}
      <header className={cn(
        'sticky top-0 z-30 shadow-md',
        darkMode
          ? 'bg-slate-800 border-b border-slate-700'
          : 'bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-800'
      )}>
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center gap-3">
          {/* ロゴ */}
          <div
            className="flex items-center justify-center w-9 h-9 rounded-xl bg-white/20 shrink-0 cursor-pointer hover:bg-white/30 transition"
            onClick={() => setShowInstallGuide(true)}
            title="インストール・起動方法を見る"
          >
            <FolderOpen className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-white leading-tight">
              領収書・レシート アーカイブ管理システム
            </h1>
            <p className="text-blue-300 text-[10px]">
              OCR自動読み取り ／ タグ・適用管理 ／ PDF保管 ／ スプレッドシート出力
            </p>
          </div>

          {/* ===== ドックツールバー（ヘッダー右側） ===== */}
          <div className="ml-auto">
            <Toolbar items={toolbarItems} />
          </div>
        </div>

        {/* ファイル入力（隠し） */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          className="hidden"
          onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ''; }}
        />
      </header>

      {/* ===== ヘルプバナー ===== */}
      {showHelp && (
        <div className={cn(
          'border-b px-4 py-3',
          darkMode ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-blue-50 border-blue-200 text-blue-800'
        )}>
          <div className="max-w-7xl mx-auto flex flex-wrap gap-4 text-xs">
            <HelpItem icon="📂" label="新規追加" desc="PDFまたは画像をドロップ・選択" />
            <HelpItem icon="✂️" label="クロップ" desc="必要部分をドラッグで選択" />
            <HelpItem icon="🔍" label="OCR読み取り" desc="日付・支払先・金額を自動抽出" />
            <HelpItem icon="✏️" label="修正・保存" desc="誤読があれば修正してPDF保存" />
            <HelpItem icon="🏷️" label="タグ" desc="自由なタグで分類・絞り込み" />
            <HelpItem icon="📊" label="エクスポート" desc="Excel/CSV/PDF一括ダウンロード" />
            <HelpItem icon="🖥️" label="インストール" desc="ツールバーの「インストール」ボタンから" />
          </div>
        </div>
      )}

      {/* ===== メインコンテンツ ===== */}
      <div className="max-w-7xl mx-auto w-full px-4 py-5 flex flex-col lg:flex-row gap-5 flex-1">

        {/* 左サイドバー */}
        <aside className="w-full lg:w-72 flex flex-col gap-4 shrink-0">

          {/* インストールカード */}
          <div
            className={cn(
              'rounded-2xl border p-4 flex items-center gap-3 cursor-pointer transition group',
              darkMode
                ? 'bg-purple-900/30 border-purple-800 hover:bg-purple-900/50'
                : 'bg-gradient-to-r from-purple-50 to-indigo-50 border-purple-200 hover:from-purple-100 hover:to-indigo-100'
            )}
            onClick={() => setShowInstallGuide(true)}
          >
            <div className={cn(
              'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition',
              darkMode ? 'bg-purple-800' : 'bg-purple-600 group-hover:bg-purple-700'
            )}>
              <MonitorDown className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn('text-sm font-bold', darkMode ? 'text-purple-300' : 'text-purple-800')}>
                アプリをインストール
              </p>
              <p className={cn('text-xs mt-0.5', darkMode ? 'text-purple-400' : 'text-purple-600')}>
                Mac / Windows に追加して快適に使う
              </p>
            </div>
            <span className={cn('text-xs font-medium', darkMode ? 'text-purple-400' : 'text-purple-500')}>
              詳しく→
            </span>
          </div>

          {/* ドロップゾーン */}
          <div
            ref={dropRef}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            className={cn(
              'rounded-2xl border-2 border-dashed transition-all cursor-pointer',
              'flex flex-col items-center justify-center gap-3 p-6 text-center group',
              isDragOver
                ? 'bg-blue-100 border-blue-500 scale-[1.02] shadow-lg shadow-blue-200'
                : darkMode
                ? 'bg-slate-800 border-slate-600 hover:border-blue-400 hover:bg-slate-700'
                : 'bg-white border-slate-300 hover:bg-blue-50 hover:border-blue-400'
            )}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className={cn(
              'w-16 h-16 rounded-2xl flex items-center justify-center transition',
              isDragOver ? 'bg-blue-500' : darkMode ? 'bg-slate-700' : 'bg-blue-100 group-hover:bg-blue-200'
            )}>
              <Upload className={cn('w-8 h-8', isDragOver ? 'text-white' : 'text-blue-600')} />
            </div>
            <div>
              <p className={cn('font-bold text-sm', darkMode ? 'text-slate-200' : 'text-slate-700')}>
                {isDragOver ? 'ここにドロップ！' : 'PDFまたは画像をドロップ'}
              </p>
              <p className={cn('text-xs mt-1', darkMode ? 'text-slate-400' : 'text-slate-400')}>
                またはクリックして選択
              </p>
              <p className={cn('text-xs', darkMode ? 'text-slate-500' : 'text-slate-400')}>
                .pdf / .jpg / .jpeg / .png / .webp
              </p>
            </div>
            <div className={cn(
              'text-xs rounded-lg px-3 py-1.5 font-medium border',
              darkMode
                ? 'bg-blue-900/50 text-blue-300 border-blue-800'
                : 'text-blue-600 bg-blue-50 border-blue-200'
            )}>
              ① アップロード → ② クロップ → ③ OCR → ④ 保存
            </div>
          </div>

          {/* エラー */}
          {proc.error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              {proc.error}
            </div>
          )}

          {/* 処理フロー */}
          <div className={cn(
            'rounded-2xl border p-4',
            darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
          )}>
            <h3 className={cn('text-xs font-bold mb-3 uppercase tracking-wider', darkMode ? 'text-slate-400' : 'text-slate-500')}>
              処理フロー
            </h3>
            <div className="flex flex-col gap-2.5">
              {([
                ['ファイル選択・ドロップ', 'idle', '📂'],
                ['クロップ範囲選択', 'cropping', '✂️'],
                ['OCR自動読み取り', 'ocr', '🔍'],
                ['情報確認・修正・保存', 'form', '✏️'],
              ] as [string, Step, string][]).map(([label, s, icon], i) => {
                const stepIdx = steps.indexOf(s);
                const done = currentStepIdx > stepIdx;
                const active = proc.step === s;
                return (
                  <div key={s} className={cn(
                    'flex items-center gap-3 text-xs rounded-xl px-3 py-2 transition',
                    active
                      ? 'bg-blue-600 text-white font-bold shadow'
                      : done
                      ? darkMode ? 'text-green-400' : 'text-green-600'
                      : darkMode ? 'text-slate-500' : 'text-slate-400'
                  )}>
                    <span className={cn(
                      'w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[11px] font-bold',
                      active ? 'bg-white text-blue-600' :
                      done ? 'bg-green-100 text-green-600' :
                      darkMode ? 'bg-slate-700' : 'bg-slate-100'
                    )}>
                      {done ? '✓' : i + 1}
                    </span>
                    <span>{icon} {label}</span>
                    {active && proc.step === 'ocr' && (
                      <span className="ml-auto flex items-center gap-1 text-blue-200">
                        <Loader2 className="w-3 h-3 animate-spin" />{proc.ocrProgress}%
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* クイックエクスポートボタン */}
          <div className={cn(
            'rounded-2xl border p-4 flex flex-col gap-2',
            darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
          )}>
            <h3 className={cn('text-xs font-bold mb-1 uppercase tracking-wider', darkMode ? 'text-slate-400' : 'text-slate-500')}>
              📤 データ出力
            </h3>
            <button
              onClick={() => setShowExport(true)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition active:scale-95"
            >
              <FileSpreadsheet className="w-4 h-4 shrink-0" />
              <div className="text-left">
                <p className="text-xs font-bold">スプレッドシート出力</p>
                <p className="text-[10px] text-green-200">Excel (.xlsx) / CSV</p>
              </div>
            </button>
            <button
              onClick={() => setShowExport(true)}
              className={cn(
                'flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition active:scale-95',
                darkMode
                  ? 'bg-slate-700 hover:bg-slate-600 text-slate-200'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
              )}
            >
              <Download className="w-4 h-4 shrink-0 text-orange-500" />
              <div className="text-left">
                <p className="text-xs font-bold">PDF 一括ダウンロード</p>
                <p className={cn('text-[10px]', darkMode ? 'text-slate-400' : 'text-slate-400')}>
                  {receipts.length}件のPDFをまとめて取得
                </p>
              </div>
            </button>
            <button
              onClick={() => setShowBackup(true)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition active:scale-95"
            >
              <Download className="w-4 h-4 shrink-0" />
              <div className="text-left">
                <p className="text-xs font-bold">JSONバックアップ</p>
                <p className="text-[10px] text-indigo-200">データを安全に保存・リストア</p>
              </div>
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => setShowVendorPresets(true)}
                className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium transition active:scale-95"
              >
                <Star className="w-4 h-4 shrink-0" />
                <div className="text-left">
                  <p className="text-xs font-bold">購入先プリセット</p>
                  <p className="text-[10px] text-amber-100">よく使う購入先を管理</p>
                </div>
              </button>
              <button
                onClick={() => setShowCategoryManager(true)}
                className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition active:scale-95"
              >
                <Tag className="w-4 h-4 shrink-0" />
                <div className="text-left">
                  <p className="text-xs font-bold">カテゴリ管理</p>
                  <p className="text-[10px] text-violet-200">追加・並び替え</p>
                </div>
              </button>
            </div>
            <button
              onClick={() => setShowAccountTitleManager(true)}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition active:scale-95"
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              <div className="text-left">
                <p className="text-xs font-bold">勘定科目管理</p>
                <p className="text-[10px] text-emerald-200">科目の追加・並び替え・プリセット</p>
              </div>
            </button>
            <div className="flex gap-2">
            </div>
          </div>

          {/* 統計パネル */}
          <StatsPanel darkMode={darkMode} />
        </aside>

        {/* メインコンテンツ */}
        <main className="flex-1 flex flex-col gap-4 min-w-0">
          {/* タブ */}
          <div className={cn(
            'flex gap-1 rounded-xl border p-1 w-fit',
            darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
          )}>
            {([
              ['list', 'アーカイブ一覧', LayoutList],
              ['stats', '分析ダッシュボード', BarChart3],
            ] as [Tab, string, React.ComponentType<{ className?: string }>][]).map(([t, label, Icon]) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm transition font-medium',
                  tab === t
                    ? 'bg-blue-600 text-white shadow'
                    : darkMode
                    ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                )}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </div>

          {/* コンテンツ */}
          <div className={cn(
            'flex-1 rounded-2xl border p-5 flex flex-col min-h-[400px]',
            darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'
          )}>
            {tab === 'list' && (
              <ReceiptList
                onPreview={setPreviewReceipt}
                darkMode={darkMode}
                onExport={() => setShowExport(true)}
              />
            )}
            {tab === 'stats' && <StatsPanel fullMode darkMode={darkMode} />}
          </div>
        </main>
      </div>

      {/* ===== フローティングアクションボタン（モバイル用） ===== */}
      <button
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-blue-600 text-white shadow-xl shadow-blue-300 hover:bg-blue-700 active:scale-95 transition flex items-center justify-center lg:hidden"
        onClick={() => fileInputRef.current?.click()}
        title="新しい領収書を追加"
      >
        <Plus className="w-7 h-7" />
      </button>

      {/* ===== モーダル類 ===== */}

      {/* クロップモーダル */}
      {proc.step === 'cropping' && proc.canvas && (
        <CropModal
          canvas={proc.canvas}
          onConfirm={handleCropConfirm}
          onCancel={reset}
          isPdf={proc.originalType === 'pdf'}
          pdfNumPages={proc.pdfNumPages}
          pdfCurrentPage={proc.pdfCurrentPage}
          onPdfPageChange={async (page) => {
            if (!proc.pdfArrayBuffer) return;
            try {
              const newCanvas = await pdfPageToCanvas(proc.pdfArrayBuffer, page, 2.0);
              setProc((p) => ({ ...p, canvas: newCanvas, pdfCurrentPage: page }));
            } catch (e) {
              console.error('Page change error:', e);
            }
          }}
        />
      )}

      {/* OCR処理中オーバーレイ */}
      {proc.step === 'ocr' && proc.croppedDataUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-white rounded-2xl p-8 flex flex-col items-center gap-5 shadow-2xl min-w-[300px]">
            <div className="relative w-20 h-20">
              <div className="absolute inset-0 rounded-2xl bg-blue-100 flex items-center justify-center">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
              </div>
              <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="36" fill="none" stroke="#dbeafe" strokeWidth="6" />
                <circle
                  cx="40" cy="40" r="36" fill="none" stroke="#2563eb" strokeWidth="6"
                  strokeDasharray={`${2 * Math.PI * 36}`}
                  strokeDashoffset={`${2 * Math.PI * 36 * (1 - proc.ocrProgress / 100)}`}
                  strokeLinecap="round"
                  className="transition-all duration-300"
                />
              </svg>
            </div>
            <div className="text-center">
              <p className="font-bold text-slate-800 text-base">🔍 OCR読み取り中...</p>
              <p className="text-sm text-slate-500 mt-1">日本語・英語テキストを解析中</p>
              <p className="text-xs text-blue-600 mt-1 font-bold">{proc.ocrProgress}% 完了</p>
            </div>
            <div className="w-64 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-300 rounded-full"
                style={{ width: `${proc.ocrProgress}%` }}
              />
            </div>
            <p className="text-[10px] text-slate-400">読み取り後に修正・確認画面が表示されます</p>
          </div>
        </div>
      )}

      {/* フォームモーダル */}
      {proc.step === 'form' && proc.ocrResult && (
        <ReceiptForm
          initial={{
            date: proc.ocrResult.date,
            vendor: proc.ocrResult.vendor,
            amount: proc.ocrResult.amount,
            category: 'その他',
            memo: '',
          }}
          croppedDataUrl={proc.croppedDataUrl}
          ocrText={proc.ocrResult.rawText}
          ocrConfidence={proc.ocrResult.confidence}
          amountCandidates={proc.ocrResult.amountCandidates}
          onSave={handleFormSave}
          onCancel={reset}
          isSaving={isSaving}
        />
      )}

      {/* プレビューモーダル */}
      {previewReceipt && (
        <PreviewModal receipt={previewReceipt} onClose={() => setPreviewReceipt(null)} />
      )}

      {/* エクスポートモーダル */}
      {showExport && (
        <ExportModal onClose={() => setShowExport(false)} />
      )}

      {/* バックアップ・リストアモーダル */}
      {showBackup && (
        <BackupModal onClose={() => setShowBackup(false)} darkMode={darkMode} />
      )}

      {/* プリセット管理モーダル */}
      {showVendorPresets && (
        <VendorPresetModal
          onClose={() => setShowVendorPresets(false)}
          darkMode={darkMode}
        />
      )}

      {/* カテゴリ管理モーダル */}
      {showCategoryManager && (
        <CategoryManager
          onClose={() => setShowCategoryManager(false)}
          darkMode={darkMode}
        />
      )}

      {/* 勘定科目管理モーダル */}
      {showAccountTitleManager && (
        <AccountTitleManager
          onClose={() => setShowAccountTitleManager(false)}
          darkMode={darkMode}
        />
      )}

      {/* インストールガイドモーダル */}
      {showInstallGuide && (
        <InstallGuide onClose={() => setShowInstallGuide(false)} darkMode={darkMode} />
      )}

      {/* ウェルカムバナー（初回表示） */}
      {showWelcome && (
        <WelcomeBanner
          onInstall={() => { setShowWelcome(false); setShowInstallGuide(true); }}
          onClose={() => setShowWelcome(false)}
          onNativeInstall={installPromptEvent ? async () => {
            await installPromptEvent.prompt();
            setShowWelcome(false);
            setInstallBanner(false);
            setInstallPromptEvent(null);
          } : undefined}
          canNativeInstall={!!installPromptEvent}
          darkMode={darkMode}
        />
      )}

      {/* データリセット確認 */}
      {receipts.length > 0 && (
        <div className="fixed bottom-6 left-6 z-40">
          <button
            onClick={() => {
              if (confirm(`${receipts.length}件のデータをすべて削除しますか？\nこの操作は取り消せません。`)) {
                receipts.forEach((r) => deleteReceipt(r.id));
                showToast('すべてのデータを削除しました', 'error');
              }
            }}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition opacity-40 hover:opacity-100',
              darkMode ? 'bg-slate-700 text-red-400' : 'bg-white border border-slate-200 text-red-500 shadow'
            )}
            title="全データをリセット"
          >
            <Trash2 className="w-3.5 h-3.5" />
            全削除
          </button>
        </div>
      )}

      {/* トースト通知 */}
      {toast && (
        <div className={cn(
          'fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] px-6 py-3 rounded-2xl shadow-2xl',
          'flex items-center gap-2.5 text-sm text-white',
          toast.type === 'success' ? 'bg-green-700' : 'bg-red-700'
        )}>
          {toast.type === 'success'
            ? <CheckCircle2 className="w-5 h-5 shrink-0" />
            : <AlertCircle className="w-5 h-5 shrink-0" />
          }
          {toast.msg}
        </div>
      )}

      {/* ステータスバー */}
      <footer className={cn(
        'border-t text-[10px] py-1.5 px-4 flex items-center gap-4 flex-wrap',
        darkMode ? 'bg-slate-800 border-slate-700 text-slate-500' : 'bg-white border-slate-200 text-slate-400'
      )}>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block animate-pulse" />
          ローカルストレージ保存
        </span>
        <span>📄 {receipts.length} 件保存済み</span>
        <span>💾 {(() => {
          try {
            const b = JSON.stringify(localStorage.getItem('receipt_archive_v2') ?? '').length;
            return b > 1024 * 1024
              ? `${(b / 1024 / 1024).toFixed(1)} MB`
              : `${(b / 1024).toFixed(0)} KB`;
          } catch { return '―'; }
        })()} 使用中</span>
        <span className="ml-auto">
          Mac / Windows / Chromium ブラウザ対応 ・ v3.1
        </span>
        <button
          onClick={() => setShowInstallGuide(true)}
          className={cn(
            'flex items-center gap-1 hover:text-purple-600 transition',
            darkMode ? 'hover:text-purple-400' : ''
          )}
        >
          <MonitorDown className="w-3 h-3" />
          インストール方法
        </button>
        <button
          onClick={() => setShowExport(true)}
          className="flex items-center gap-1 hover:text-green-600 transition"
        >
          <RefreshCw className="w-3 h-3" />
          データ出力
        </button>
        <button
          onClick={() => setShowBackup(true)}
          className="flex items-center gap-1 hover:text-indigo-600 transition"
        >
          <Download className="w-3 h-3" />
          バックアップ
        </button>
      </footer>
    </div>
  );
}

function HelpItem({ icon, label, desc }: { icon: string; label: string; desc: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-base">{icon}</span>
      <div>
        <span className="font-bold">{label}</span>
        <span className="text-slate-500 ml-1">{desc}</span>
      </div>
    </div>
  );
}
