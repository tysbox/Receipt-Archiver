/**
 * CropModal.tsx — 完全リライト版
 *
 * 設計方針:
 * 1. rawCanvas → imageDataUrl (useEffect, 1回のみ変換) → <img> 表示
 * 2. 回転/反転はオフスクリーンキャンバスで処理し displayDataUrl を更新
 * 3. クロップ選択は overlay canvas の座標系で管理
 * 4. 「確定」時に displayCanvas にクロップ処理して dataUrl を親へ渡す
 * 5. PDF ページ切替時: rawCanvas が変わる → imageDataUrl 再生成
 */
import React, {
  useRef, useState, useEffect, useCallback,
} from 'react';
import { cn } from '../utils/cn';
import {
  RotateCcw, RotateCw, ZoomIn, ZoomOut,
  Crop, Check, X, FlipHorizontal,
  ChevronLeft, ChevronRight, Move, FileText, Loader2,
  RefreshCw, Maximize2,
} from 'lucide-react';

// ===== 型 =====
interface Rect { x: number; y: number; w: number; h: number }
type Tool = 'crop' | 'pan';

export interface CropModalProps {
  canvas: HTMLCanvasElement;
  onConfirm: (croppedDataUrl: string) => void;
  onCancel: () => void;
  isPdf?: boolean;
  pdfNumPages?: number;
  pdfCurrentPage?: number;
  onPdfPageChange?: (page: number) => Promise<void>;
}

// ===== ユーティリティ関数 =====

/** 任意角度の回転（canvasベース） */
function applyTransform(
  src: HTMLCanvasElement,
  rotation: number,
  flipH: boolean
): HTMLCanvasElement {
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const dw = Math.round(src.width * cos + src.height * sin);
  const dh = Math.round(src.width * sin + src.height * cos);

  const dst = document.createElement('canvas');
  dst.width = dw;
  dst.height = dh;
  const ctx = dst.getContext('2d')!;

  ctx.translate(dw / 2, dh / 2);
  if (flipH) ctx.scale(-1, 1);
  ctx.rotate(rad);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);

  return dst;
}

/** canvas → dataURL（JPEG） */
function canvasToDataUrl(c: HTMLCanvasElement): string {
  return c.toDataURL('image/jpeg', 0.95);
}

/** クロップして dataURL を返す */
function cropCanvasToDataUrl(
  src: HTMLCanvasElement,
  x: number, y: number, w: number, h: number
): string {
  const cw = Math.max(1, Math.round(w));
  const ch = Math.max(1, Math.round(h));
  const dst = document.createElement('canvas');
  dst.width = cw;
  dst.height = ch;
  dst.getContext('2d')!.drawImage(src, x, y, w, h, 0, 0, cw, ch);
  return dst.toDataURL('image/jpeg', 0.95);
}

/** サムネイル生成（小さいキャンバス） */
function makeThumbnail(src: HTMLCanvasElement, maxW = 100): string {
  const scale = Math.min(maxW / src.width, 1);
  const tw = Math.round(src.width * scale);
  const th = Math.round(src.height * scale);
  const dst = document.createElement('canvas');
  dst.width = tw;
  dst.height = th;
  dst.getContext('2d')!.drawImage(src, 0, 0, tw, th);
  return dst.toDataURL('image/jpeg', 0.7);
}

// ===== ページ番号リスト生成 =====
function buildPageNumbers(current: number, total: number): (number | '…')[] {
  if (total <= 9) return Array.from({ length: total }, (_, i) => i + 1);
  const res: (number | '…')[] = [];
  let prev = 0;
  for (let p = 1; p <= total; p++) {
    const show = p === 1 || p === total || Math.abs(p - current) <= 2;
    if (show) {
      if (prev > 0 && p - prev > 1) res.push('…');
      res.push(p);
      prev = p;
    }
  }
  return res;
}

// ===== メインコンポーネント =====
export function CropModal({
  canvas: rawCanvas,
  onConfirm,
  onCancel,
  isPdf = false,
  pdfNumPages = 1,
  pdfCurrentPage = 1,
  onPdfPageChange,
}: CropModalProps) {

  // --- 変換パラメータ ---
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);

  // --- 変換済みキャンバス（回転・反転を適用したもの） ---
  const [workCanvas, setWorkCanvas] = useState<HTMLCanvasElement>(() => rawCanvas);
  // --- 表示用 dataUrl (workCanvas → string, img src に使う) ---
  const [displayUrl, setDisplayUrl] = useState<string>('');

  // --- ズーム・パン ---
  const [zoom, setZoom] = useState(1.0);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  // --- ツール ---
  const [tool, setTool] = useState<Tool>('crop');

  // --- クロップ ---
  const [cropRect, setCropRect] = useState<Rect | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  // --- パン ---
  const [panning, setPanning] = useState(false);
  const panStartRef = useRef({ x: 0, y: 0, px: 0, py: 0 });

  // --- クロッププレビュー ---
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // --- PDF ---
  const [pageLoading, setPageLoading] = useState(false);
  const [thumbMap, setThumbMap] = useState<Record<number, string>>({});

  // --- overlay canvas ---
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ============================================================
  // rawCanvas が変わるたびに transform を再適用
  // ============================================================
  useEffect(() => {
    const transformed = applyTransform(rawCanvas, rotation, flipH);
    setWorkCanvas(transformed);
    const url = canvasToDataUrl(transformed);
    setDisplayUrl(url);
    setCropRect(null);
    setPreviewUrl(null);
    // ページ切り替え時にサムネイルを生成
    if (isPdf) {
      const thumb = makeThumbnail(rawCanvas, 100);
      setThumbMap(prev => ({ ...prev, [pdfCurrentPage]: thumb }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawCanvas]); // rawCanvas が変わった時だけ

  // ============================================================
  // rotation / flipH が変わったときに transform を再適用
  // ============================================================
  useEffect(() => {
    const transformed = applyTransform(rawCanvas, rotation, flipH);
    setWorkCanvas(transformed);
    const url = canvasToDataUrl(transformed);
    setDisplayUrl(url);
    setCropRect(null);
    setPreviewUrl(null);
  }, [rawCanvas, rotation, flipH]);

  // ============================================================
  // 表示サイズ計算
  // ============================================================
  const maxW = Math.min(
    typeof window !== 'undefined' ? window.innerWidth * 0.68 : 800,
    900
  );
  const maxH = typeof window !== 'undefined' ? window.innerHeight * 0.55 : 600;
  const baseScale = Math.min(maxW / workCanvas.width, maxH / workCanvas.height, 1);
  const dispW = Math.round(workCanvas.width * baseScale * zoom);
  const dispH = Math.round(workCanvas.height * baseScale * zoom);

  // ============================================================
  // オーバーレイ描画
  // ============================================================
  useEffect(() => {
    const oc = overlayRef.current;
    if (!oc) return;
    oc.width = dispW;
    oc.height = dispH;
    const ctx = oc.getContext('2d')!;
    ctx.clearRect(0, 0, dispW, dispH);

    if (!cropRect || cropRect.w < 4 || cropRect.h < 4) return;

    // 暗幕
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, dispW, dispH);
    ctx.clearRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);

    // 枠線
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.strokeRect(cropRect.x, cropRect.y, cropRect.w, cropRect.h);

    // コーナーハンドル
    const hs = 10;
    ctx.fillStyle = '#3b82f6';
    [
      [cropRect.x, cropRect.y],
      [cropRect.x + cropRect.w - hs, cropRect.y],
      [cropRect.x, cropRect.y + cropRect.h - hs],
      [cropRect.x + cropRect.w - hs, cropRect.y + cropRect.h - hs],
    ].forEach(([cx, cy]) => ctx.fillRect(cx, cy, hs, hs));

    // 三分割グリッド
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 3; i++) {
      const gx = cropRect.x + (cropRect.w * i) / 3;
      const gy = cropRect.y + (cropRect.h * i) / 3;
      ctx.beginPath(); ctx.moveTo(gx, cropRect.y); ctx.lineTo(gx, cropRect.y + cropRect.h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(cropRect.x, gy); ctx.lineTo(cropRect.x + cropRect.w, gy); ctx.stroke();
    }

    // サイズラベル
    const px = Math.round(cropRect.w / (baseScale * zoom));
    const py = Math.round(cropRect.h / (baseScale * zoom));
    const lbl = `${px} × ${py}px`;
    ctx.font = 'bold 12px sans-serif';
    const tw = ctx.measureText(lbl).width;
    const lx = cropRect.x + cropRect.w / 2 - tw / 2 - 6;
    const ly = cropRect.y - 26;
    if (ly > 0) {
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(lx, ly, tw + 12, 20);
      ctx.fillStyle = '#fff';
      ctx.fillText(lbl, lx + 6, ly + 14);
    }
  }, [cropRect, dispW, dispH, baseScale, zoom]);

  // ============================================================
  // マウス座標取得（containerRef基準）
  // ============================================================
  const getLocalPos = (e: React.MouseEvent) => {
    const r = containerRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  // ============================================================
  // マウスイベント
  // ============================================================
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const pos = getLocalPos(e);
    if (tool === 'pan' || e.button === 1) {
      setPanning(true);
      panStartRef.current = { x: pos.x, y: pos.y, px: panX, py: panY };
    } else {
      setDragging(true);
      dragStartRef.current = pos;
      setCropRect({ x: pos.x, y: pos.y, w: 0, h: 0 });
      setPreviewUrl(null);
    }
  }, [tool, panX, panY]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    const pos = getLocalPos(e);
    if (panning) {
      const dx = pos.x - panStartRef.current.x;
      const dy = pos.y - panStartRef.current.y;
      setPanX(panStartRef.current.px + dx);
      setPanY(panStartRef.current.py + dy);
      return;
    }
    if (!dragging) return;
    const sx = dragStartRef.current.x;
    const sy = dragStartRef.current.y;
    const x = Math.max(0, Math.min(pos.x, sx));
    const y = Math.max(0, Math.min(pos.y, sy));
    const w = Math.min(Math.abs(pos.x - sx), dispW - x);
    const h = Math.min(Math.abs(pos.y - sy), dispH - y);
    setCropRect({ x, y, w, h });
  }, [dragging, panning, dispW, dispH]);

  const onMouseUp = useCallback(() => {
    setDragging(false);
    setPanning(false);
  }, []);

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.max(0.3, Math.min(5.0, z + (e.deltaY > 0 ? -0.12 : 0.12))));
  }, []);

  // ============================================================
  // 回転
  // ============================================================
  const rotate = useCallback((deg: number) => {
    setRotation(r => ((r + deg) % 360 + 360) % 360);
    setZoom(1.0);
    setPanX(0);
    setPanY(0);
  }, []);

  const resetView = useCallback(() => {
    setZoom(1.0);
    setPanX(0);
    setPanY(0);
    setCropRect(null);
    setPreviewUrl(null);
  }, []);

  // ============================================================
  // PDFページ切替
  // ============================================================
  const changePage = useCallback(async (page: number) => {
    if (!onPdfPageChange || page < 1 || page > pdfNumPages || pageLoading) return;
    setPageLoading(true);
    setRotation(0);
    setFlipH(false);
    setZoom(1.0);
    setPanX(0);
    setPanY(0);
    setCropRect(null);
    setPreviewUrl(null);
    try {
      await onPdfPageChange(page);
    } finally {
      setPageLoading(false);
    }
  }, [onPdfPageChange, pdfNumPages, pageLoading]);

  // ============================================================
  // クロッププレビュー
  // ============================================================
  const generatePreview = useCallback(() => {
    if (!cropRect || cropRect.w < 5 || cropRect.h < 5) return;
    const scale = baseScale * zoom;
    const cx = Math.max(0, cropRect.x / scale);
    const cy = Math.max(0, cropRect.y / scale);
    const cw = Math.min(cropRect.w / scale, workCanvas.width - cx);
    const ch = Math.min(cropRect.h / scale, workCanvas.height - cy);
    setPreviewUrl(cropCanvasToDataUrl(workCanvas, cx, cy, cw, ch));
  }, [cropRect, baseScale, zoom, workCanvas]);

  // ============================================================
  // 確定
  // ============================================================
  const handleConfirm = useCallback(() => {
    if (cropRect && cropRect.w > 5 && cropRect.h > 5) {
      const scale = baseScale * zoom;
      const cx = Math.max(0, Math.round(cropRect.x / scale));
      const cy = Math.max(0, Math.round(cropRect.y / scale));
      const cw = Math.min(Math.round(cropRect.w / scale), workCanvas.width - cx);
      const ch = Math.min(Math.round(cropRect.h / scale), workCanvas.height - cy);
      onConfirm(cropCanvasToDataUrl(workCanvas, cx, cy, cw, ch));
    } else {
      onConfirm(canvasToDataUrl(workCanvas));
    }
  }, [cropRect, baseScale, zoom, workCanvas, onConfirm]);

  // ============================================================
  // キーボードショートカット
  // ============================================================
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // モーダル内のinputにフォーカスがある場合はスキップ
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'Escape') { onCancel(); return; }
      if (e.key === 'Enter') { handleConfirm(); return; }
      if (e.key === 'r' && !e.shiftKey) { rotate(90); return; }
      if (e.key === 'R' && e.shiftKey) { rotate(-90); return; }
      if (isPdf) {
        if (e.key === 'ArrowRight') changePage(pdfCurrentPage + 1);
        if (e.key === 'ArrowLeft') changePage(pdfCurrentPage - 1);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel, handleConfirm, rotate, isPdf, pdfCurrentPage, changePage]);

  const hasCrop = cropRect !== null && cropRect.w > 5 && cropRect.h > 5;
  const pageNumbers = buildPageNumbers(pdfCurrentPage, pdfNumPages);

  // ============================================================
  // レンダリング
  // ============================================================
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/92" style={{ maxHeight: '100vh' }}>

      {/* ===== ヘッダー ===== */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800 border-b border-slate-700 shrink-0 gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Crop className="w-5 h-5 text-blue-400 shrink-0" />
          <h2 className="text-white font-bold text-sm truncate">
            {isPdf ? '📄 PDFプレビュー・編集・クロップ' : '🖼️ 画像プレビュー・編集・クロップ'}
          </h2>
          {isPdf && (
            <span className="flex items-center gap-1.5 bg-blue-900/70 text-blue-300 text-xs px-3 py-1 rounded-full border border-blue-700 shrink-0">
              <FileText className="w-3.5 h-3.5" />
              {pdfCurrentPage} / {pdfNumPages} ページ
            </span>
          )}
          <span className="text-slate-500 text-xs hidden sm:inline shrink-0">
            {workCanvas.width} × {workCanvas.height} px
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400 shrink-0">
          <span className="hidden sm:flex items-center gap-2">
            <kbd className="bg-slate-700 px-1.5 py-0.5 rounded text-[10px]">r</kbd>回転
            {isPdf && <><kbd className="bg-slate-700 px-1.5 py-0.5 rounded text-[10px]">←→</kbd>ページ</>}
            <kbd className="bg-slate-700 px-1.5 py-0.5 rounded text-[10px]">Enter</kbd>確定
            <kbd className="bg-slate-700 px-1.5 py-0.5 rounded text-[10px]">Esc</kbd>キャンセル
          </span>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* ===== ツールバー ===== */}
      <div className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 border-b border-slate-700 shrink-0 flex-wrap">
        {/* 回転グループ */}
        <div className="flex items-center gap-0.5 bg-slate-700 rounded-xl p-1">
          <TBtn icon={<RotateCcw className="w-4 h-4" />} label="左90° (Shift+R)" onClick={() => rotate(-90)} />
          <TBtn icon={<RotateCw className="w-4 h-4" />} label="右90° (r)" onClick={() => rotate(90)} />
          <TBtn icon={<FlipHorizontal className="w-4 h-4" />} label="水平反転" onClick={() => setFlipH(f => !f)} active={flipH} />
        </div>

        {/* 角度プリセット */}
        <div className="flex items-center gap-0.5 bg-slate-700 rounded-xl px-2 py-1.5">
          {[0, 90, 180, 270].map(deg => (
            <button key={deg}
              onClick={() => { setRotation(deg); setZoom(1); setPanX(0); setPanY(0); }}
              className={cn('px-2 py-0.5 rounded-lg text-xs font-bold transition',
                rotation === deg ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white')}
            >{deg}°</button>
          ))}
        </div>

        <div className="w-px h-6 bg-slate-600" />

        {/* ズーム */}
        <div className="flex items-center gap-0.5 bg-slate-700 rounded-xl p-1">
          <TBtn icon={<ZoomOut className="w-4 h-4" />} label="縮小" onClick={() => setZoom(z => Math.max(0.3, z - 0.15))} />
          <span className="text-slate-300 text-xs font-mono px-2 min-w-[44px] text-center">{Math.round(zoom * 100)}%</span>
          <TBtn icon={<ZoomIn className="w-4 h-4" />} label="拡大" onClick={() => setZoom(z => Math.min(5.0, z + 0.15))} />
        </div>

        <div className="w-px h-6 bg-slate-600" />

        {/* ツール選択 */}
        <div className="flex items-center gap-0.5 bg-slate-700 rounded-xl p-1">
          <TBtn icon={<Crop className="w-4 h-4" />} label="クロップ" onClick={() => setTool('crop')} active={tool === 'crop'} />
          <TBtn icon={<Move className="w-4 h-4" />} label="パン移動" onClick={() => setTool('pan')} active={tool === 'pan'} />
        </div>

        <TBtn icon={<Maximize2 className="w-4 h-4" />} label="表示リセット" onClick={resetView} />
        <TBtn icon={<RefreshCw className="w-4 h-4" />} label="全体選択"
          onClick={() => setCropRect({ x: 0, y: 0, w: dispW, h: dispH })} />

        {hasCrop && (
          <button onClick={generatePreview}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-600 text-white text-xs font-medium transition">
            👁 確認
          </button>
        )}

        {/* PDFページナビ（ツールバー内） */}
        {isPdf && pdfNumPages > 1 && (
          <>
            <div className="w-px h-6 bg-slate-600" />
            <div className="flex items-center gap-0.5 bg-slate-700 rounded-xl p-1">
              <TBtn icon={<ChevronLeft className="w-4 h-4" />} label="前ページ (←)"
                onClick={() => changePage(pdfCurrentPage - 1)} />
              <span className="text-slate-300 text-xs font-mono px-2">{pdfCurrentPage}/{pdfNumPages}</span>
              <TBtn icon={<ChevronRight className="w-4 h-4" />} label="次ページ (→)"
                onClick={() => changePage(pdfCurrentPage + 1)} />
            </div>
          </>
        )}
      </div>

      {/* ===== メインエリア ===== */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* --- PDF サムネイルパネル（左） --- */}
        {isPdf && pdfNumPages > 1 && (
          <div className="w-24 bg-slate-950 border-r border-slate-700 flex flex-col overflow-y-auto shrink-0 p-2 gap-2">
            <p className="text-slate-500 text-[9px] font-bold uppercase tracking-wider text-center py-1">PAGES</p>
            {Array.from({ length: pdfNumPages }, (_, i) => i + 1).map(page => (
              <button key={page}
                onClick={() => changePage(page)}
                disabled={pageLoading}
                className={cn(
                  'relative rounded-lg border-2 overflow-hidden transition flex flex-col items-center pb-1 gap-0.5',
                  page === pdfCurrentPage
                    ? 'border-blue-500 shadow-lg shadow-blue-900'
                    : 'border-slate-700 hover:border-slate-500'
                )}
              >
                {thumbMap[page] ? (
                  <img src={thumbMap[page]} alt={`p${page}`} className="w-full object-contain" />
                ) : (
                  <div className="w-full h-14 bg-slate-800 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-slate-600" />
                  </div>
                )}
                <span className={cn('text-[9px] font-bold',
                  page === pdfCurrentPage ? 'text-blue-400' : 'text-slate-500')}>{page}</span>
                {page === pdfCurrentPage && (
                  <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-blue-500" />
                )}
              </button>
            ))}
          </div>
        )}

        {/* --- 画像エリア（中央） --- */}
        <div
          className="flex-1 overflow-hidden relative flex items-center justify-center"
          style={{
            cursor: tool === 'pan' || panning ? (panning ? 'grabbing' : 'grab') : 'crosshair',
            background: 'repeating-conic-gradient(#1a1a1a 0% 25%, #111 0% 50%) 0 0 / 24px 24px',
          }}
        >
          {/* ページ読み込みオーバーレイ */}
          {pageLoading && (
            <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/80">
              <Loader2 className="w-12 h-12 text-blue-400 animate-spin mb-3" />
              <p className="text-slate-300 text-sm font-medium">ページを読み込み中...</p>
            </div>
          )}

          {/* 画像コンテナ */}
          <div
            ref={containerRef}
            className="relative select-none"
            style={{
              width: dispW,
              height: dispH,
              transform: `translate(${panX}px, ${panY}px)`,
              transition: dragging || panning ? 'none' : 'transform 0.12s',
              touchAction: 'none',
              flexShrink: 0,
            }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onWheel={onWheel}
          >
            {/* 画像表示（dataUrlを使うことでキャンバスのレンダリングループを回避） */}
            {displayUrl && (
              <img
                src={displayUrl}
                alt="preview"
                draggable={false}
                style={{
                  width: dispW,
                  height: dispH,
                  display: 'block',
                  userSelect: 'none',
                  imageRendering: zoom > 1.5 ? 'pixelated' : 'auto',
                }}
              />
            )}

            {/* オーバーレイキャンバス（クロップ選択表示） */}
            <canvas
              ref={overlayRef}
              className="absolute inset-0 pointer-events-none"
              style={{ width: dispW, height: dispH }}
            />
          </div>

          {/* PDF ページナビ（フローティング） */}
          {isPdf && pdfNumPages > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 bg-slate-800/95 backdrop-blur border border-slate-600 rounded-2xl px-4 py-2.5 shadow-2xl">
              <NavBtn onClick={() => changePage(1)} disabled={pdfCurrentPage <= 1 || pageLoading} title="最初">≪</NavBtn>
              <NavBtn onClick={() => changePage(pdfCurrentPage - 1)} disabled={pdfCurrentPage <= 1 || pageLoading}>
                <ChevronLeft className="w-3.5 h-3.5" />
              </NavBtn>
              {pageNumbers.map((item, idx) =>
                item === '…' ? (
                  <span key={`e${idx}`} className="text-slate-500 px-1 text-xs">…</span>
                ) : (
                  <button key={item}
                    onClick={() => changePage(item as number)}
                    disabled={pageLoading}
                    className={cn('w-7 h-7 rounded-lg text-xs font-bold transition',
                      item === pdfCurrentPage
                        ? 'bg-blue-600 text-white shadow'
                        : 'text-slate-400 hover:bg-slate-700 hover:text-white'
                    )}
                  >{item}</button>
                )
              )}
              <NavBtn onClick={() => changePage(pdfCurrentPage + 1)} disabled={pdfCurrentPage >= pdfNumPages || pageLoading}>
                <ChevronRight className="w-3.5 h-3.5" />
              </NavBtn>
              <NavBtn onClick={() => changePage(pdfNumPages)} disabled={pdfCurrentPage >= pdfNumPages || pageLoading} title="最後">≫</NavBtn>
              {pageLoading && <Loader2 className="w-4 h-4 text-blue-400 animate-spin ml-1" />}
            </div>
          )}
        </div>

        {/* --- 右サイドパネル --- */}
        <div className="w-48 bg-slate-800 border-l border-slate-700 flex flex-col gap-3 p-3 shrink-0 overflow-y-auto">

          {/* 操作ヒント */}
          <div>
            <p className="text-slate-500 text-[9px] font-bold uppercase tracking-wider mb-1.5">操作方法</p>
            <div className="flex flex-col gap-1 text-[10px] text-slate-400">
              <HRow k="Drag" v="クロップ範囲選択" />
              <HRow k="Wheel" v="ズーム" />
              <HRow k="Pan" v="画像を移動" />
              <HRow k="r" v="右90°回転" />
              <HRow k="R" v="左90°回転" />
              {isPdf && <HRow k="←→" v="ページ切替" />}
              <HRow k="Enter" v="確定" />
              <HRow k="Esc" v="キャンセル" />
            </div>
          </div>

          {/* 情報 */}
          <div className="bg-slate-700 rounded-xl p-2.5 flex flex-col gap-1.5">
            <p className="text-slate-500 text-[9px] font-bold uppercase tracking-wider mb-0.5">情報</p>
            {isPdf && <IRow label="ページ" value={`${pdfCurrentPage}/${pdfNumPages}`} />}
            <IRow label="回転" value={`${rotation}°`} />
            <IRow label="反転" value={flipH ? 'あり' : 'なし'} />
            <IRow label="ズーム" value={`${Math.round(zoom * 100)}%`} />
            <IRow label="サイズ" value={`${workCanvas.width}×${workCanvas.height}`} />
            {hasCrop && (
              <>
                <div className="w-full h-px bg-slate-600 my-0.5" />
                <IRow label="範囲W" value={`${Math.round(cropRect!.w / (baseScale * zoom))}px`} />
                <IRow label="範囲H" value={`${Math.round(cropRect!.h / (baseScale * zoom))}px`} />
              </>
            )}
          </div>

          {/* クイック回転 */}
          <div>
            <p className="text-slate-500 text-[9px] font-bold uppercase tracking-wider mb-1.5">クイック回転</p>
            <div className="grid grid-cols-2 gap-1">
              {[
                { label: '↺ 左90', deg: -90 },
                { label: '↻ 右90', deg: 90 },
                { label: '↕ 180', deg: 180 },
                { label: '⤢ リセット', deg: -rotation },
              ].map(btn => (
                <button key={btn.label} onClick={() => rotate(btn.deg)}
                  className="px-1.5 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-[10px] font-medium transition text-center">
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* クロッププレビュー */}
          {previewUrl && (
            <div>
              <p className="text-slate-500 text-[9px] font-bold uppercase tracking-wider mb-1.5">クロップ確認</p>
              <div className="bg-slate-700 rounded-xl overflow-hidden border border-slate-600">
                <img src={previewUrl} alt="preview" className="w-full object-contain max-h-28" />
              </div>
              <p className="text-green-400 text-[9px] text-center mt-1">✓ この範囲でOCR処理</p>
            </div>
          )}

          {/* 全体選択ボタン */}
          <button
            onClick={() => {
              setCropRect(null);
              setPreviewUrl(null);
            }}
            className="px-2 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-[10px] font-medium transition text-center"
          >
            選択解除（全体を使用）
          </button>
        </div>
      </div>

      {/* ===== フッター ===== */}
      <div className="flex items-center justify-between px-5 py-3 bg-slate-800 border-t border-slate-700 shrink-0 gap-3 flex-wrap">
        <div className="flex items-center gap-4 text-[11px]">
          {hasCrop ? (
            <span className="text-blue-400 flex items-center gap-1.5">
              <Crop className="w-3.5 h-3.5" />
              クロップ: {Math.round(cropRect!.w / (baseScale * zoom))} × {Math.round(cropRect!.h / (baseScale * zoom))} px
            </span>
          ) : (
            <span className="text-slate-500">ドラッグでクロップ範囲を選択（未選択は全体を使用）</span>
          )}
          {rotation !== 0 && <span className="text-yellow-400">↻ {rotation}° 回転中</span>}
          {flipH && <span className="text-orange-400">⇄ 反転中</span>}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button onClick={onCancel}
            className="px-4 py-2 rounded-xl border border-slate-600 text-slate-400 hover:text-white hover:bg-slate-700 text-sm transition">
            キャンセル
          </button>
          <button onClick={handleConfirm}
            className={cn(
              'flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-bold transition shadow-lg',
              hasCrop
                ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-900'
                : 'bg-slate-600 hover:bg-slate-500'
            )}>
            <Check className="w-4 h-4" />
            {hasCrop ? 'クロップしてOCRへ' : '全体でOCRへ'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===== 小コンポーネント =====

function TBtn({
  icon, label, onClick, active = false,
}: {
  icon: React.ReactNode; label: string; onClick: () => void; active?: boolean;
}) {
  return (
    <button onClick={onClick} title={label}
      className={cn('p-1.5 rounded-lg transition',
        active ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-600 hover:text-white')}>
      {icon}
    </button>
  );
}

function NavBtn({
  onClick, disabled, title, children,
}: {
  onClick: () => void; disabled?: boolean; title?: string; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} disabled={disabled} title={title}
      className={cn('flex items-center justify-center min-w-[28px] h-7 px-1.5 rounded-lg text-xs font-bold transition',
        disabled ? 'text-slate-600 cursor-not-allowed' : 'text-white hover:bg-slate-700 active:bg-slate-600')}>
      {children}
    </button>
  );
}

function HRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start gap-1.5">
      <span className="shrink-0 font-mono bg-slate-700 px-1 py-0.5 rounded text-[9px] text-slate-300">{k}</span>
      <span>{v}</span>
    </div>
  );
}

function IRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center text-[10px]">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-200 font-mono">{value}</span>
    </div>
  );
}
