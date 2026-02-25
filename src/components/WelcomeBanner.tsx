import { useState, useEffect } from 'react';
import {
  Download, X, Monitor, Apple, Smartphone,
  Globe, WifiOff, Shield, ArrowRight,
  Chrome, Star
} from 'lucide-react';
import { cn } from '../utils/cn';

interface Props {
  onInstall: () => void;
  onClose: () => void;
  onNativeInstall?: () => void;
  canNativeInstall?: boolean;
  darkMode?: boolean;
}

type OS = 'mac' | 'windows' | 'ios' | 'android' | 'other';

function detectOS(): OS {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (/Mac/.test(ua)) return 'mac';
  if (/Win/.test(ua)) return 'windows';
  return 'other';
}

const OS_STEPS: Record<OS, { icon: React.ComponentType<{ className?: string }>; steps: string[] }> = {
  mac: {
    icon: Apple,
    steps: [
      'Chrome / Edge でこのアプリを開く',
      'アドレスバー右の「⊕」アイコンをクリック',
      '「インストール」をクリック',
      'Launchpad から「領収書アーカイブ」を起動',
    ],
  },
  windows: {
    icon: Monitor,
    steps: [
      'Chrome / Edge でこのアプリを開く',
      'アドレスバー右の「⊕」アイコンをクリック',
      '「インストール」をクリック',
      'スタートメニューから「領収書アーカイブ」を起動',
    ],
  },
  ios: {
    icon: Smartphone,
    steps: [
      'Safari でこのページを開く',
      '画面下の「共有（□↑）」ボタンをタップ',
      '「ホーム画面に追加」を選択',
      'ホーム画面のアイコンから起動',
    ],
  },
  android: {
    icon: Smartphone,
    steps: [
      'Chrome でこのページを開く',
      '「インストール」バナーをタップ、またはメニュー（⋮）→「アプリをインストール」',
      '「インストール」をタップ',
      'ホーム画面のアイコンから起動',
    ],
  },
  other: {
    icon: Globe,
    steps: [
      'Chrome または Edge でこのアプリを開く',
      'アドレスバー右の「⊕」またはメニューから「インストール」',
      'インストールを確認して完了',
      'デスクトップまたはアプリランチャーから起動',
    ],
  },
};

export function WelcomeBanner({ onInstall, onClose, onNativeInstall, canNativeInstall, darkMode = false }: Props) {
  const [os, setOs] = useState<OS>('windows');
  const [step, setStep] = useState<'options' | 'guide'>('options');

  useEffect(() => {
    setOs(detectOS());
  }, []);

  const dm = darkMode;
  const OsIcon = OS_STEPS[os].icon;
  const steps = OS_STEPS[os].steps;

  if (step === 'guide') {
    return (
      <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 p-4">
        <div className={cn(
          'w-full max-w-md rounded-2xl shadow-2xl overflow-hidden',
          dm ? 'bg-slate-800' : 'bg-white'
        )}>
          {/* ヘッダー */}
          <div className="bg-gradient-to-r from-blue-900 to-indigo-800 text-white px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <OsIcon className="w-5 h-5" />
              <h3 className="font-bold text-sm">インストール手順</h3>
            </div>
            <button onClick={() => setStep('options')} className="p-1 rounded-lg hover:bg-white/20 transition">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 flex flex-col gap-4">
            {/* ネイティブインストールボタン（利用可能時） */}
            {canNativeInstall && onNativeInstall && (
              <button
                onClick={onNativeInstall}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold transition shadow-lg"
              >
                <Download className="w-5 h-5" />
                ✨ ワンクリックでインストール
              </button>
            )}

            {/* ステップガイド */}
            <div className="flex flex-col gap-3">
              {steps.map((s, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center shrink-0 font-bold mt-0.5">
                    {i + 1}
                  </div>
                  <p className={cn('text-sm pt-1', dm ? 'text-slate-200' : 'text-slate-700')}>{s}</p>
                </div>
              ))}
            </div>

            <div className={cn('rounded-xl p-3 border text-xs flex items-start gap-2', dm ? 'bg-blue-900/30 border-blue-800 text-blue-300' : 'bg-blue-50 border-blue-200 text-blue-700')}>
              <Shield className="w-4 h-4 shrink-0 mt-0.5" />
              <span>データはすべてデバイス内に保存されます。クラウドへの送信は一切ありません。</span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setStep('options')}
                className={cn('flex-1 py-2.5 rounded-xl border text-sm font-medium transition', dm ? 'border-slate-600 text-slate-400 hover:bg-slate-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50')}
              >
                戻る
              </button>
              <button
                onClick={onClose}
                className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition flex items-center justify-center gap-1"
              >
                アプリを使う <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/80 p-4">
      <div className={cn(
        'w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden',
        dm ? 'bg-slate-800' : 'bg-white'
      )}>
        {/* ヘッダー */}
        <div className="bg-gradient-to-br from-blue-900 via-indigo-800 to-purple-900 text-white px-6 pt-8 pb-6 text-center relative">
          <button
            onClick={onClose}
            className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-white/20 transition"
          >
            <X className="w-4 h-4" />
          </button>

          {/* アプリアイコン */}
          <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-xl">
            <span className="text-4xl">🗂️</span>
          </div>
          <h2 className="text-xl font-bold">領収書アーカイブ</h2>
          <p className="text-blue-200 text-sm mt-1">OCR・タグ・PDF・スプレッドシート管理</p>

          {/* 特徴バッジ */}
          <div className="flex justify-center gap-2 mt-4 flex-wrap">
            {[
              { icon: <WifiOff className="w-3 h-3" />, label: 'オフライン動作' },
              { icon: <Shield className="w-3 h-3" />, label: 'ローカル保存' },
              { icon: <Chrome className="w-3 h-3" />, label: 'ブラウザで完結' },
            ].map((f) => (
              <div key={f.label} className="flex items-center gap-1 bg-white/20 text-white text-[10px] px-2.5 py-1 rounded-full font-medium">
                {f.icon}
                {f.label}
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 flex flex-col gap-4">
          <div className="text-center">
            <p className={cn('text-sm font-semibold', dm ? 'text-slate-200' : 'text-slate-700')}>
              このアプリをインストールしますか？
            </p>
            <p className={cn('text-xs mt-1', dm ? 'text-slate-400' : 'text-slate-500')}>
              アドレスバーなしでネイティブアプリとして使えます
            </p>
          </div>

          <div className="flex flex-col gap-2">
            {/* ワンクリックインストール（利用可能時） */}
            {canNativeInstall && onNativeInstall && (
              <button
                onClick={onNativeInstall}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-3.5 bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white rounded-xl font-bold transition shadow-lg text-sm"
              >
                <Download className="w-5 h-5" />
                ✨ ワンクリックでインストール（推奨）
              </button>
            )}

            {/* 手順を見てインストール */}
            <button
              onClick={() => setStep('guide')}
              className={cn(
                'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-medium transition text-sm border-2',
                dm ? 'border-blue-700 text-blue-400 hover:bg-blue-900/30' : 'border-blue-200 text-blue-700 hover:bg-blue-50'
              )}
            >
              <Star className="w-4 h-4" />
              インストール手順を見る（Mac/Windows/スマホ）
            </button>

            {/* 詳細ガイド */}
            <button
              onClick={onInstall}
              className={cn(
                'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium transition text-sm',
                dm ? 'bg-slate-700 text-slate-300 hover:bg-slate-600' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              )}
            >
              📖 詳細なインストールガイドを見る
            </button>

            {/* スキップ */}
            <button
              onClick={onClose}
              className={cn('text-xs text-center transition pt-1', dm ? 'text-slate-500 hover:text-slate-300' : 'text-slate-400 hover:text-slate-600')}
            >
              今はインストールしない（ブラウザで使い続ける）
            </button>
          </div>

          {/* インストール後の利点 */}
          <div className={cn('rounded-xl border p-4 grid grid-cols-2 gap-2', dm ? 'bg-slate-700 border-slate-600' : 'bg-slate-50 border-slate-200')}>
            {[
              ['🚀', 'ブラウザUI不要で起動'],
              ['📌', 'デスクトップに固定'],
              ['💾', 'データはデバイスに保存'],
              ['🔒', 'クラウド送信なし'],
              ['📱', 'Mac/Win/スマホ対応'],
              ['⚡', 'オフラインでも動作'],
            ].map(([icon, label]) => (
              <div key={label} className={cn('flex items-center gap-1.5 text-[11px]', dm ? 'text-slate-300' : 'text-slate-600')}>
                <span>{icon}</span>
                <span>{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
