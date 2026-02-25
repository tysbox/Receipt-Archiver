/**
 * generatePdf.ts
 *
 * 日本語文字化け完全解決版
 * jsPDF デフォルトは Latin フォントのみ → 日本語が文字化けする
 *
 * 解決策:
 * - ラベルを ASCII（英語）で表示し、値は canvas に描画して画像として貼り付ける
 * - または jsPDF の html() 機能でHTMLをPDFに変換する
 *
 * 採用方針:
 * 「情報テーブル部分を canvas に描画 → PNG として jsPDF に埋め込む」
 * これにより日本語を含むすべてのテキストが正確に表示される
 */

import { jsPDF } from 'jspdf';
import { Receipt } from '../types/receipt';

type PdfInfo = Pick<
  Receipt,
  | 'date'
  | 'vendor'
  | 'amount'
  | 'taxAmount'
  | 'category'
  | 'accountTitle'
  | 'taxCategory'
  | 'purpose'
  | 'memo'
  | 'tags'
  | 'filename'
>;

/**
 * 情報テーブルを canvas に描画して dataURL を返す
 * フォント: システムフォント（日本語対応）を使用
 */
function buildInfoCanvas(info: PdfInfo): HTMLCanvasElement {
  const W = 1200;
  const PADDING = 40;
  const LINE_H = 52;
  const LABEL_W = 220;
  const fontSize = 26;
  const headerFontSize = 32;

  const rows: [string, string][] = [
    ['日付', info.date],
    ['支払先', info.vendor],
    ['金額', `¥${info.amount.toLocaleString()}${info.taxAmount ? `　（税額: ¥${info.taxAmount.toLocaleString()}）` : ''}`],
    ['カテゴリ', info.category],
    ['勘定科目', info.accountTitle || '―'],
    ['税区分', info.taxCategory || '―'],
    ['適用・用途', info.purpose || '―'],
    ['タグ', info.tags?.length ? info.tags.join('　') : '―'],
    ['メモ', info.memo || '―'],
  ];

  // キャンバス高さを動的計算
  const H = PADDING * 2 + headerFontSize + 16 + rows.length * LINE_H + PADDING;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  // 背景
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, W, H);

  // ヘッダー帯
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(0, 0, W, headerFontSize + PADDING);

  // ヘッダーテキスト
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${headerFontSize}px "Hiragino Sans", "Yu Gothic", "Meiryo", "Noto Sans JP", sans-serif`;
  ctx.fillText('領収書アーカイブ', PADDING, headerFontSize + 8);

  // ファイル名（右上）
  ctx.font = `${fontSize * 0.7}px "Hiragino Sans", "Yu Gothic", "Meiryo", sans-serif`;
  ctx.fillStyle = '#93c5fd';
  const fnText = info.filename;
  const fnW = ctx.measureText(fnText).width;
  ctx.fillText(fnText, W - PADDING - fnW, headerFontSize + 4);

  // テーブル
  let y = headerFontSize + PADDING + PADDING / 2;

  rows.forEach(([label, value], i) => {
    const rowY = y + i * LINE_H;

    // 行背景（奇数行）
    if (i % 2 === 0) {
      ctx.fillStyle = '#eff6ff';
      ctx.fillRect(PADDING, rowY - LINE_H * 0.7, W - PADDING * 2, LINE_H);
    }

    // ラベル
    ctx.font = `bold ${fontSize}px "Hiragino Sans", "Yu Gothic", "Meiryo", "Noto Sans JP", sans-serif`;
    ctx.fillStyle = '#475569';
    ctx.fillText(label, PADDING + 10, rowY);

    // 区切り線
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PADDING + LABEL_W, rowY - LINE_H * 0.7);
    ctx.lineTo(PADDING + LABEL_W, rowY + LINE_H * 0.3);
    ctx.stroke();

    // 値（長い場合は省略）
    ctx.font = `${fontSize}px "Hiragino Sans", "Yu Gothic", "Meiryo", "Noto Sans JP", sans-serif`;
    ctx.fillStyle = '#1e293b';
    const maxValW = W - PADDING * 2 - LABEL_W - 20;
    let val = value;
    while (ctx.measureText(val).width > maxValW && val.length > 3) {
      val = val.slice(0, -2) + '…';
    }
    ctx.fillText(val, PADDING + LABEL_W + 20, rowY);
  });

  // 下線
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(PADDING, H - PADDING / 2);
  ctx.lineTo(W - PADDING, H - PADDING / 2);
  ctx.stroke();

  return canvas;
}

/**
 * 日時テキストを canvas に描画（フッター用）
 */
function buildFooterCanvas(dateStr: string, filename: string): HTMLCanvasElement {
  const W = 1200;
  const H = 60;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = '#f1f5f9';
  ctx.fillRect(0, 0, W, H);

  ctx.font = '22px "Hiragino Sans", "Yu Gothic", "Meiryo", "Noto Sans JP", sans-serif';
  ctx.fillStyle = '#94a3b8';
  ctx.fillText(`生成日時: ${dateStr}　　ファイル: ${filename}`, 20, 38);

  return canvas;
}

/**
 * クロップ画像と情報からPDFを生成してbase64で返す
 * 日本語フォントをcanvas経由で画像として埋め込むことで文字化けを完全解決
 */
export function generateReceiptPdf(croppedDataUrl: string, info: PdfInfo): string {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const PAGE_W = 210;  // A4幅 mm
  const PAGE_H = 297;  // A4高さ mm
  const MARGIN = 11;   // 左右マージン mm

  // ===== 情報テーブルをcanvasで描画して画像として貼り付け =====
  const infoCanvas = buildInfoCanvas(info);
  const infoDataUrl = infoCanvas.toDataURL('image/png');

  // canvas の縦横比を維持しつつ幅を合わせる
  const infoW = PAGE_W - MARGIN * 2;
  const infoH = (infoCanvas.height / infoCanvas.width) * infoW;

  doc.addImage(infoDataUrl, 'PNG', MARGIN, MARGIN, infoW, infoH);

  let currentY = MARGIN + infoH + 4;

  // ===== 区切り線 =====
  doc.setDrawColor(180, 180, 200);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, currentY, PAGE_W - MARGIN, currentY);
  currentY += 4;

  // ===== クロップ画像を貼り付け =====
  try {
    const imgProps = doc.getImageProperties(croppedDataUrl);
    const maxW = PAGE_W - MARGIN * 2;
    const maxH = PAGE_H - currentY - 20; // フッター用20mm確保

    if (maxH > 10) {
      let iw = imgProps.width;
      let ih = imgProps.height;
      const ratio = Math.min(maxW / iw, maxH / ih);
      iw *= ratio;
      ih *= ratio;

      const xOff = MARGIN + (maxW - iw) / 2;
      doc.addImage(croppedDataUrl, 'JPEG', xOff, currentY, iw, ih);
      currentY += ih + 4;
    }
  } catch {
    // 画像の貼り付けに失敗した場合はスキップ
    currentY += 4;
  }

  // ===== フッター（canvas経由で日本語対応） =====
  const footerCanvas = buildFooterCanvas(
    new Date().toLocaleString('ja-JP'),
    info.filename
  );
  const footerDataUrl = footerCanvas.toDataURL('image/png');
  const footerW = PAGE_W - MARGIN * 2;
  const footerH = (footerCanvas.height / footerCanvas.width) * footerW;

  // フッターはページ最下部に固定
  doc.addImage(footerDataUrl, 'PNG', MARGIN, PAGE_H - footerH - 4, footerW, footerH);

  return doc.output('datauristring');
}

/**
 * base64 PDF を Blob URL でダウンロード
 */
export function downloadPdf(base64DataUri: string, filename: string) {
  // data URI から Blob を生成してダウンロード
  try {
    const base64 = base64DataUri.split(',')[1];
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    // フォールバック: 直接リンク
    const a = document.createElement('a');
    a.href = base64DataUri;
    a.download = filename;
    a.click();
  }
}
