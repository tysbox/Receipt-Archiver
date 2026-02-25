/**
 * pdfUtils.ts — pdfjs-dist v5 完全対応版
 *
 * pdfjs-dist v5 では workerSrc = '' では動作しない。
 * PDFWorker を直接インポートして GlobalWorkerOptions に設定する方法を使う。
 */

// pdfjs-dist v5 の正しい worker 設定方法
import * as pdfjsLib from 'pdfjs-dist';

// Vite の ?url サフィックスで worker ファイルの URL を取得してバンドルに含める
// viteSingleFile 環境では inline化される
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

// Worker を一度だけ設定する
let workerConfigured = false;

function ensureWorker() {
  if (workerConfigured) return;
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;
  workerConfigured = true;
}

/** PDF の情報（ページ数など）を返す */
export async function getPdfInfo(arrayBuffer: ArrayBuffer): Promise<{ numPages: number }> {
  ensureWorker();
  const data = new Uint8Array(arrayBuffer.slice(0));
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  return { numPages: pdf.numPages };
}

/** PDF の指定ページを canvas に描画して返す */
export async function pdfPageToCanvas(
  arrayBuffer: ArrayBuffer,
  pageNum = 1,
  scale = 2.0
): Promise<HTMLCanvasElement> {
  ensureWorker();
  const data = new Uint8Array(arrayBuffer.slice(0));
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext('2d')!;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await page.render({ canvasContext: ctx as any, canvas, viewport }).promise;

  return canvas;
}

/** 画像ファイルを canvas に描画して返す */
export function imageToCanvas(dataUrl: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      resolve(canvas);
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/** canvas の一部を切り取って dataURL を返す */
export function cropCanvas(
  src: HTMLCanvasElement,
  x: number,
  y: number,
  w: number,
  h: number
): string {
  const dst = document.createElement('canvas');
  dst.width = Math.max(1, Math.round(w));
  dst.height = Math.max(1, Math.round(h));
  const ctx = dst.getContext('2d')!;
  ctx.drawImage(src, x, y, w, h, 0, 0, dst.width, dst.height);
  return dst.toDataURL('image/jpeg', 0.92);
}
