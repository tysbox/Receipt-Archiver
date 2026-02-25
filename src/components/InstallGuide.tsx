import { useState, useEffect } from 'react';
import {
  X, Monitor, Apple, Chrome, Download, CheckCircle2,
  ArrowRight, Smartphone, FolderOpen, Globe,
  BookOpen, Star, Shield, Wifi, WifiOff, Package,
  ExternalLink, Copy, Check
} from 'lucide-react';
import { cn } from '../utils/cn';

interface Props {
  onClose: () => void;
  darkMode?: boolean;
}

type OS = 'mac' | 'windows' | 'other';
type Tab = 'install' | 'standalone' | 'mobile' | 'faq';

function detectOS(): OS {
  const ua = navigator.userAgent;
  if (ua.includes('Mac')) return 'mac';
  if (ua.includes('Win')) return 'windows';
  return 'other';
}

export function InstallGuide({ onClose, darkMode = false }: Props) {
  const [os, setOs] = useState<OS>('windows');
  const [tab, setTab] = useState<Tab>('install');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [installed, setInstalled] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOs(detectOS());
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    const installedHandler = () => setInstalled(true);
    window.addEventListener('appinstalled', installedHandler);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const handleNativeInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    setInstalled(true);
    setInstallPrompt(null);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const dm = darkMode;
  const bg = dm ? 'bg-slate-800' : 'bg-slate-50';
  const card = cn('rounded-2xl border p-5', dm ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200');
  const text = dm ? 'text-slate-200' : 'text-slate-700';
  const sub = dm ? 'text-slate-400' : 'text-slate-500';
  const stepCls = 'flex items-start gap-3';
  const numCls = 'w-7 h-7 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center shrink-0 font-bold mt-0.5';
  const codeCls = cn(
    'inline-flex items-center gap-1 px-2 py-0.5 rounded font-mono text-xs font-semibold',
    dm ? 'bg-slate-600 text-blue-300 border border-slate-500' : 'bg-slate-100 text-blue-700 border border-slate-200'
  );
  const warnBox = cn('rounded-xl p-3 border text-xs', dm ? 'bg-yellow-900/30 border-yellow-700 text-yellow-300' : 'bg-yellow-50 border-yellow-200 text-yellow-700');
  const infoBox = cn('rounded-xl p-3 border text-xs', dm ? 'bg-blue-900/30 border-blue-700 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-700');
  const successBox = cn('rounded-xl p-3 border text-xs', dm ? 'bg-green-900/30 border-green-700 text-green-300' : 'bg-green-50 border-green-200 text-green-700');

  const tabs: { id: Tab; icon: string; label: string }[] = [
    { id: 'install', icon: '🖥️', label: 'PWAインストール' },
    { id: 'standalone', icon: '📄', label: 'HTMLファイル起動' },
    { id: 'mobile', icon: '📱', label: 'スマホ・タブレット' },
    { id: 'faq', icon: '❓', label: 'よくある質問' },
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 p-3">
      <div className={cn(
        'w-full max-w-2xl flex flex-col rounded-2xl shadow-2xl overflow-hidden max-h-[96vh]',
        bg
      )}>

        {/* ===== ヘッダー ===== */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-800 to-blue-800 text-white px-6 py-5 flex items-start justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <Download className="w-5 h-5" />
              インストール・起動ガイド
            </h2>
            <p className="text-blue-200 text-xs mt-1">
              Mac / Windows / スマホ でアプリとして使う方法
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/20 transition shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ===== PWAインストールバナー（利用可能時） ===== */}
        {installPrompt && !installed && (
          <div className="mx-5 mt-4 shrink-0 bg-green-600 rounded-2xl p-4 flex items-center gap-3 text-white shadow-lg">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
              <Download className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm">✨ 今すぐインストールできます！</p>
              <p className="text-green-200 text-xs mt-0.5">
                ブラウザがPWAインストールに対応しています。クリックするだけで完了！
              </p>
            </div>
            <button
              onClick={handleNativeInstall}
              className="bg-white text-green-700 font-bold text-sm px-4 py-2.5 rounded-xl hover:bg-green-50 transition shrink-0 shadow"
            >
              インストール
            </button>
          </div>
        )}
        {installed && (
          <div className="mx-5 mt-4 shrink-0 bg-green-600 rounded-2xl p-4 flex items-center gap-3 text-white">
            <CheckCircle2 className="w-6 h-6 shrink-0" />
            <div>
              <p className="font-bold text-sm">✅ インストール完了！</p>
              <p className="text-green-200 text-xs mt-0.5">
                デスクトップ・Launchpadまたはスタートメニューからアプリを起動できます
              </p>
            </div>
          </div>
        )}

        {/* ===== タブ ===== */}
        <div className={cn(
          'flex gap-1 px-5 pt-4 shrink-0 flex-wrap',
        )}>
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition',
                tab === t.id
                  ? 'bg-blue-600 text-white shadow'
                  : dm
                  ? 'text-slate-400 hover:bg-slate-700 hover:text-slate-200'
                  : 'text-slate-500 hover:bg-white hover:text-slate-700 border border-slate-200'
              )}
            >
              <span>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* ===== コンテンツ ===== */}
        <div className="overflow-auto flex-1 p-5 flex flex-col gap-4">

          {/* ===== PWAインストール ===== */}
          {tab === 'install' && (
            <>
              {/* OS選択 */}
              <div className="flex gap-2">
                {([
                  ['mac', Apple, 'Mac'],
                  ['windows', Monitor, 'Windows'],
                ] as [OS, React.ComponentType<{ className?: string }>, string][]).map(([o, Icon, label]) => (
                  <button
                    key={o}
                    onClick={() => setOs(o)}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 text-sm font-medium transition',
                      os === o
                        ? 'border-blue-500 bg-blue-600 text-white shadow-md'
                        : dm
                        ? 'border-slate-600 text-slate-400 hover:border-slate-500 hover:bg-slate-700'
                        : 'border-slate-200 text-slate-500 hover:border-blue-300 bg-white'
                    )}
                  >
                    <Icon className="w-5 h-5" />
                    {label}
                  </button>
                ))}
              </div>

              {/* 特徴 */}
              <div className={cn('grid grid-cols-3 gap-2')}>
                {[
                  { icon: <Globe className="w-4 h-4 text-blue-500" />, label: 'ブラウザ不要', desc: 'アドレスバーなし' },
                  { icon: <WifiOff className="w-4 h-4 text-green-500" />, label: 'オフライン動作', desc: 'サーバー不要' },
                  { icon: <Shield className="w-4 h-4 text-purple-500" />, label: 'ローカル保存', desc: 'クラウド送信なし' },
                ].map((f) => (
                  <div key={f.label} className={cn('rounded-xl border p-3 flex flex-col items-center gap-1.5 text-center', dm ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200')}>
                    {f.icon}
                    <p className={cn('text-xs font-bold', text)}>{f.label}</p>
                    <p className={cn('text-[10px]', sub)}>{f.desc}</p>
                  </div>
                ))}
              </div>

              {/* Chrome / Edge 手順 */}
              <div className={card}>
                <h3 className={cn('font-bold text-sm mb-4 flex items-center gap-2', text)}>
                  <Chrome className="w-5 h-5 text-blue-500" />
                  {os === 'mac' ? 'Chrome / Chromium（Mac）' : 'Chrome / Edge（Windows）'} — PWAインストール
                </h3>
                <div className="flex flex-col gap-4">
                  <div className={stepCls}>
                    <span className={numCls}>1</span>
                    <div>
                      <p className={cn('text-sm font-medium', text)}>
                        <strong>Google Chrome</strong> または <strong>Microsoft Edge</strong> でこのアプリを開く
                      </p>
                      <p className={cn('text-xs mt-1', sub)}>
                        他のブラウザ（Firefox・Operaなど）ではPWAインストールに非対応の場合があります
                      </p>
                    </div>
                  </div>

                  <div className={stepCls}>
                    <span className={numCls}>2</span>
                    <div>
                      <p className={cn('text-sm font-medium', text)}>
                        アドレスバー右側の
                        <span className="mx-1 inline-flex items-center gap-1 bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold text-sm">
                          ⊕
                        </span>
                        アイコンをクリック
                      </p>
                      {/* アドレスバーのビジュアルガイド */}
                      <div className={cn(
                        'mt-3 rounded-xl border p-3 flex items-center gap-2 text-xs',
                        dm ? 'bg-slate-600 border-slate-500' : 'bg-slate-50 border-slate-200'
                      )}>
                        <div className={cn('flex items-center gap-1.5 flex-1 rounded-lg px-3 py-2 border', dm ? 'bg-slate-700 border-slate-500 text-slate-300' : 'bg-white border-slate-300 text-slate-600')}>
                          <Globe className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-mono flex-1">localhost:5173</span>
                          <span className="bg-blue-500 text-white px-2 py-0.5 rounded font-bold text-sm animate-pulse">⊕</span>
                          <span className={sub}>⋮</span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-blue-500 shrink-0" />
                        <div className={cn('bg-blue-600 text-white text-xs px-3 py-2 rounded-lg font-bold whitespace-nowrap')}>
                          インストール
                        </div>
                      </div>
                      <div className={cn('mt-2 text-xs', sub)}>
                        <strong>⊕ が表示されない場合：</strong><br />
                        Chrome: アドレスバー右の「⋮」→「キャスト、保存、共有」→「ページをアプリとしてインストール」<br />
                        Edge: 「…」→「アプリ」→「このサイトをアプリとしてインストール」
                      </div>
                    </div>
                  </div>

                  <div className={stepCls}>
                    <span className={numCls}>3</span>
                    <div>
                      <p className={cn('text-sm font-medium', text)}>
                        「<strong>インストール</strong>」ボタンをクリック
                      </p>
                      <p className={cn('text-xs mt-1', sub)}>
                        アプリ名「領収書アーカイブ」とアイコンを確認してインストールを完了
                      </p>
                    </div>
                  </div>

                  <div className={stepCls}>
                    <span className={numCls}>4</span>
                    <div>
                      <p className={cn('text-sm font-medium', text)}>
                        {os === 'mac'
                          ? '🍎 Launchpad または Dock から「領収書アーカイブ」を起動'
                          : '🪟 スタートメニュー または デスクトップ から「領収書アーカイブ」を起動'}
                      </p>
                      <div className={cn('mt-2', successBox)}>
                        ✅ ブラウザのアドレスバーなしで、ネイティブアプリのように動作します
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mac Safari */}
              {os === 'mac' && (
                <div className={card}>
                  <h3 className={cn('font-bold text-sm mb-3 flex items-center gap-2', text)}>
                    <Apple className="w-4 h-4" />
                    Safari（macOS 14 Sonoma以降）
                  </h3>
                  <div className="flex flex-col gap-3">
                    <div className={stepCls}>
                      <span className={numCls}>1</span>
                      <p className={cn('text-sm', text)}>Safari でこのアプリを開く</p>
                    </div>
                    <div className={stepCls}>
                      <span className={numCls}>2</span>
                      <p className={cn('text-sm', text)}>ツールバーの <strong>共有ボタン（□↑）</strong> をクリック</p>
                    </div>
                    <div className={stepCls}>
                      <span className={numCls}>3</span>
                      <p className={cn('text-sm', text)}>「<strong>Dockに追加</strong>」を選択 → 「追加」をクリック</p>
                    </div>
                    <div className={warnBox}>
                      ⚠️ Safari での OCR・PDF出力は一部制限される場合があります。<strong>Chrome/Edge を推奨</strong>します。
                    </div>
                  </div>
                </div>
              )}

              {/* アンインストール方法 */}
              <div className={card}>
                <h3 className={cn('font-bold text-sm mb-3', text)}>🗑️ アンインストール方法</h3>
                <div className={cn('text-xs flex flex-col gap-2', sub)}>
                  <div>
                    <strong className={text}>Chrome（Mac/Windows）：</strong> chrome://apps でアプリを右クリック → 「Chromeから削除」
                  </div>
                  <div>
                    <strong className={text}>Edge（Windows）：</strong> スタートメニューでアプリを右クリック → 「アンインストール」
                  </div>
                  <div className={infoBox}>
                    💡 アンインストールしてもブラウザの localStorage に保存されたデータは残ります。
                    データも削除する場合はアプリ内の「全削除」ボタンを使用してください。
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ===== HTMLファイル起動 ===== */}
          {tab === 'standalone' && (
            <>
              <div className={card}>
                <h3 className={cn('font-bold text-sm mb-1 flex items-center gap-2', text)}>
                  <FolderOpen className="w-4 h-4 text-blue-500" />
                  HTMLファイル単体で起動する方法
                </h3>
                <p className={cn('text-xs mb-4', sub)}>
                  このアプリは <span className={codeCls}>index.html</span> 1ファイルにすべての機能がまとまっています。
                  Webサーバー不要でどのPCでも動きます。
                </p>

                <div className="flex flex-col gap-5">
                  <div className={stepCls}>
                    <span className={numCls}>1</span>
                    <div className="flex-1">
                      <p className={cn('text-sm font-medium', text)}>
                        ビルドされた <span className={codeCls}>dist/index.html</span> をダウンロード・保存
                      </p>
                      <p className={cn('text-xs mt-1', sub)}>
                        USB・メール・Dropbox・Google Drive 経由でどのPCにも配布可能
                      </p>
                      {/* ファイルパスのコピー */}
                      <div className={cn('mt-2 flex items-center gap-2 rounded-lg border px-3 py-2', dm ? 'bg-slate-600 border-slate-500' : 'bg-slate-50 border-slate-200')}>
                        <span className={cn('font-mono text-xs flex-1', text)}>dist/index.html</span>
                        <button
                          onClick={() => handleCopy('dist/index.html')}
                          className={cn('flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition', dm ? 'hover:bg-slate-500 text-slate-300' : 'hover:bg-slate-200 text-slate-600')}
                        >
                          {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                          {copied ? 'コピー済み' : 'コピー'}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className={stepCls}>
                    <span className={numCls}>2</span>
                    <div>
                      <p className={cn('text-sm font-medium', text)}>起動方法（どちらか）</p>
                      <div className="mt-2 flex flex-col gap-2">
                        <div className={cn('flex items-center gap-3 rounded-xl border p-3', dm ? 'bg-slate-600 border-slate-500' : 'bg-slate-50 border-slate-200')}>
                          <span className="text-2xl">🖱️</span>
                          <div>
                            <p className={cn('text-xs font-bold', text)}>ダブルクリックで起動</p>
                            <p className={cn('text-[10px]', sub)}>index.html をダブルクリック → デフォルトのブラウザで起動</p>
                          </div>
                        </div>
                        <div className={cn('flex items-center gap-3 rounded-xl border p-3', dm ? 'bg-slate-600 border-slate-500' : 'bg-slate-50 border-slate-200')}>
                          <span className="text-2xl">🪟</span>
                          <div>
                            <p className={cn('text-xs font-bold', text)}>ドラッグ＆ドロップ</p>
                            <p className={cn('text-[10px]', sub)}>Chrome / Edge のウィンドウに index.html をドラッグ</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className={stepCls}>
                    <span className={numCls}>3</span>
                    <div>
                      <p className={cn('text-sm font-medium', text)}>アプリが起動します</p>
                      <div className={cn('mt-2', warnBox)}>
                        ⚠️ OCR機能（Tesseract.js）は初回のみインターネット接続が必要です。<br />
                        PDF保存・Excel出力・データ管理はオフラインで動作します。
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ブックマーク登録 */}
              <div className={card}>
                <h3 className={cn('font-bold text-sm mb-3 flex items-center gap-2', text)}>
                  <Star className="w-4 h-4 text-yellow-500" />
                  ブックマーク・お気に入り登録
                </h3>
                <div className="flex flex-col gap-3">
                  <div className={stepCls}>
                    <span className={numCls}>1</span>
                    <p className={cn('text-sm', text)}>Chrome/Edge でこのアプリを開く</p>
                  </div>
                  <div className={stepCls}>
                    <span className={numCls}>2</span>
                    <div>
                      <p className={cn('text-sm', text)}>キーボードショートカットでブックマーク追加</p>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        <span className={codeCls}>Ctrl+D</span>
                        <span className={cn('text-xs self-center', sub)}>（Windows / Linux）</span>
                        <span className={codeCls}>Cmd+D</span>
                        <span className={cn('text-xs self-center', sub)}>（Mac）</span>
                      </div>
                    </div>
                  </div>
                  <div className={stepCls}>
                    <span className={numCls}>3</span>
                    <p className={cn('text-sm', text)}>「ブックマークバーに追加」を選択するとワンクリックで起動できます</p>
                  </div>
                </div>
              </div>

              {/* ショートカット */}
              <div className={card}>
                <h3 className={cn('font-bold text-sm mb-3 flex items-center gap-2', text)}>
                  <BookOpen className="w-4 h-4 text-purple-500" />
                  アプリ内キーボードショートカット
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    ['r', '画像を右90°回転'],
                    ['Shift+R', '画像を左90°回転'],
                    ['Enter', 'クロップ確定'],
                    ['Esc', 'モーダルを閉じる'],
                    ['← →', 'PDFページ切替'],
                    ['ホイール', 'ズームイン/アウト'],
                  ].map(([key, desc]) => (
                    <div key={key} className="flex items-center gap-2">
                      <span className={codeCls}>{key}</span>
                      <span className={cn('text-xs', sub)}>{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ===== モバイル ===== */}
          {tab === 'mobile' && (
            <>
              {/* iPhone / iPad */}
              <div className={card}>
                <h3 className={cn('font-bold text-sm mb-4 flex items-center gap-2', text)}>
                  <Smartphone className="w-4 h-4" />
                  iPhone / iPad（Safari）
                </h3>
                <div className="flex flex-col gap-4">
                  <div className={stepCls}>
                    <span className={numCls}>1</span>
                    <p className={cn('text-sm', text)}>Safari でこのアプリのURLを開く</p>
                  </div>
                  <div className={stepCls}>
                    <span className={numCls}>2</span>
                    <div>
                      <p className={cn('text-sm', text)}>
                        画面下部（または上部）の
                        <strong> 共有ボタン 「□↑」 </strong> をタップ
                      </p>
                      <div className={cn('mt-2 flex justify-center items-center gap-3 rounded-xl border p-4', dm ? 'bg-slate-600 border-slate-500' : 'bg-slate-50 border-slate-200')}>
                        <div className="flex flex-col items-center gap-1">
                          <div className="w-12 h-20 rounded-xl bg-slate-300 border-2 border-slate-400 flex flex-col items-center justify-end pb-2">
                            <div className="w-8 h-1.5 bg-slate-400 rounded mb-1" />
                            <div className="w-8 h-1.5 bg-slate-400 rounded" />
                          </div>
                          <span className={cn('text-[10px]', sub)}>iPhone</span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-blue-500" />
                        <div className="text-center">
                          <div className="text-3xl mb-1">□↑</div>
                          <span className={cn('text-[10px]', sub)}>共有ボタン</span>
                        </div>
                        <ArrowRight className="w-4 h-4 text-blue-500" />
                        <div className={cn('px-3 py-2 rounded-xl border text-xs font-bold', dm ? 'bg-blue-900 border-blue-700 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-700')}>
                          ホーム画面<br />に追加
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className={stepCls}>
                    <span className={numCls}>3</span>
                    <p className={cn('text-sm', text)}>「<strong>ホーム画面に追加</strong>」をタップ</p>
                  </div>
                  <div className={stepCls}>
                    <span className={numCls}>4</span>
                    <p className={cn('text-sm', text)}>右上の「<strong>追加</strong>」をタップ → ホーム画面にアイコンが追加されます</p>
                  </div>
                  <div className={stepCls}>
                    <span className={numCls}>5</span>
                    <p className={cn('text-sm', text)}>ホーム画面の「<strong>領収書アーカイブ</strong>」アイコンをタップして起動</p>
                  </div>
                </div>
              </div>

              {/* Android */}
              <div className={card}>
                <h3 className={cn('font-bold text-sm mb-4 flex items-center gap-2', text)}>
                  <Smartphone className="w-4 h-4" />
                  Android（Chrome）
                </h3>
                <div className="flex flex-col gap-3">
                  <div className={stepCls}>
                    <span className={numCls}>1</span>
                    <p className={cn('text-sm', text)}>Chrome でこのアプリのURLを開く</p>
                  </div>
                  <div className={stepCls}>
                    <span className={numCls}>2</span>
                    <div>
                      <p className={cn('text-sm', text)}>
                        自動的に「<strong>アプリをインストール</strong>」バナーが表示されます
                      </p>
                      <p className={cn('text-xs mt-1', sub)}>
                        表示されない場合：右上「⋮」→「ホーム画面に追加」または「アプリをインストール」
                      </p>
                    </div>
                  </div>
                  <div className={stepCls}>
                    <span className={numCls}>3</span>
                    <p className={cn('text-sm', text)}>「<strong>インストール</strong>」をタップ</p>
                  </div>
                  <div className={stepCls}>
                    <span className={numCls}>4</span>
                    <p className={cn('text-sm', text)}>ホーム画面のアイコンから起動</p>
                  </div>
                </div>
              </div>

              <div className={infoBox}>
                <div className="flex items-start gap-2">
                  <Wifi className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold mb-1">スマートフォンでの機能について</p>
                    <ul className="space-y-1">
                      <li>📷 カメラで撮影したレシート画像を直接読み込み可能</li>
                      <li>🔍 OCR読み取り・タグ管理・PDF出力に対応</li>
                      <li>📊 Excel/CSV出力（ダウンロードフォルダに保存）</li>
                      <li>💾 データはスマホのブラウザに保存（クラウド不使用）</li>
                    </ul>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ===== FAQ ===== */}
          {tab === 'faq' && (
            <>
              {[
                {
                  q: 'データはどこに保存されますか？',
                  a: 'すべてのデータはお使いのブラウザの「localStorage」に保存されます。インターネット上のサーバーには一切送信されません。プライバシーが完全に保護されます。',
                  icon: '🔒'
                },
                {
                  q: '別のPCでデータを使うには？',
                  a: 'アーカイブ一覧からExcel（.xlsx）またはCSVでエクスポートしてください。データをJSONで直接バックアップ・リストアする機能は今後追加予定です。',
                  icon: '💾'
                },
                {
                  q: 'OCRの精度が低い場合は？',
                  a: '画像の解像度が高いほど精度が上がります。クロップモーダルで必要な部分だけを切り出すと精度が向上します。OCR結果は常に手動で修正可能です。',
                  icon: '🔍'
                },
                {
                  q: 'ブラウザを変えるとデータが消える？',
                  a: 'localStorage はブラウザごとに独立しています。ChromeでインストールしたデータはEdgeでは見えません。同じブラウザを使い続けることを推奨します。',
                  icon: '⚠️'
                },
                {
                  q: 'アプリをアップデートするには？',
                  a: 'Service Worker が自動的にキャッシュを更新します。手動で更新する場合はブラウザで Ctrl+Shift+R（Mac: Cmd+Shift+R）でハードリロードしてください。',
                  icon: '🔄'
                },
                {
                  q: 'オフラインでも使えますか？',
                  a: 'PWAインストール後はオフラインでも基本機能が使えます。ただし、OCR（Tesseract.js）は初回のみインターネット接続が必要です。PDF・Excel出力はオフラインで動作します。',
                  icon: '📶'
                },
                {
                  q: '対応ファイル形式は？',
                  a: 'PDF（複数ページ対応）、JPEG/JPG、PNG、WebP 形式に対応しています。スキャンデータ・スマホ撮影どちらも読み込めます。',
                  icon: '📄'
                },
                {
                  q: 'スプレッドシート出力の内容は？',
                  a: 'Excelファイルには「領収書一覧シート」と「集計シート（カテゴリ別・月別・勘定科目別）」の2シートが生成されます。CSVはBOM付きUTF-8でExcel/Numbersで文字化けしません。',
                  icon: '📊'
                },
              ].map((faq) => (
                <div key={faq.q} className={card}>
                  <div className="flex items-start gap-3">
                    <span className="text-2xl shrink-0">{faq.icon}</span>
                    <div>
                      <p className={cn('font-bold text-sm mb-2', text)}>Q. {faq.q}</p>
                      <p className={cn('text-xs leading-relaxed', sub)}>{faq.a}</p>
                    </div>
                  </div>
                </div>
              ))}

              <div className={cn('rounded-xl p-4 border text-center', dm ? 'bg-slate-700 border-slate-600' : 'bg-white border-slate-200')}>
                <Package className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                <p className={cn('text-sm font-bold mb-1', text)}>技術仕様</p>
                <div className="flex flex-wrap justify-center gap-2 mt-2">
                  {['React 19', 'TypeScript', 'Tailwind CSS', 'Tesseract.js OCR', 'PDF.js', 'jsPDF', 'xlsx', 'PWA / Service Worker'].map((tech) => (
                    <span key={tech} className={cn('text-[10px] px-2 py-1 rounded-full border font-medium', dm ? 'bg-slate-600 border-slate-500 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600')}>
                      {tech}
                    </span>
                  ))}
                </div>
                <p className={cn('text-[10px] mt-3', sub)}>
                  <ExternalLink className="w-3 h-3 inline mr-1" />
                  サーバーレス・完全ブラウザ動作 · Mac/Windows/iOS/Android 対応
                </p>
              </div>
            </>
          )}
        </div>

        {/* ===== フッター ===== */}
        <div className={cn(
          'flex items-center justify-between px-5 py-4 border-t shrink-0',
          dm ? 'border-slate-700 bg-slate-800' : 'border-slate-200 bg-white'
        )}>
          <p className={cn('text-xs flex items-center gap-1.5', sub)}>
            <Shield className="w-3.5 h-3.5 text-green-500" />
            データはすべてローカル保存（クラウド送信なし）
          </p>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition shadow"
          >
            アプリを使う
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
