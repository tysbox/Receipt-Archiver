/**
 * imagePreprocess.ts
 * OCR精度を上げるための画像前処理ユーティリティ
 *
 * 処理パイプライン:
 * 1. グレースケール変換
 * 2. コントラスト・明度正規化（CLAHE近似）
 * 3. ノイズ除去（Gaussianブラー近似）
 * 4. 適応的二値化（Otsuアルゴリズム近似）
 * 5. 解像度アップスケール（300dpi相当に）
 */

/** 前処理設定 */
export interface PreprocessOptions {
  /** アップスケール倍率（1〜4, デフォルト2） */
  scale?: number;
  /** コントラスト強調量（0〜2, デフォルト1.4） */
  contrast?: number;
  /** 明度補正（-128〜128, デフォルト10） */
  brightness?: number;
  /** シャープ強度（0〜1, デフォルト0.5） */
  sharpen?: number;
  /** 二値化（true=白黒, false=グレースケールのみ） */
  binarize?: boolean;
  /** 二値化閾値（0〜255, 0=Otsu自動, デフォルト0） */
  threshold?: number;
  /** ノイズ除去カーネルサイズ（1〜3, デフォルト1） */
  denoise?: number;
  /** デバッグ: 前処理結果をコンソールに出力 */
  debug?: boolean;
}

const DEFAULT_OPTIONS: Required<PreprocessOptions> = {
  scale: 2,
  contrast: 1.5,
  brightness: 15,
  sharpen: 0.6,
  binarize: true,
  threshold: 0,   // 0 = Otsu自動
  denoise: 1,
  debug: false,
};

/**
 * メイン前処理関数
 * canvas を受け取り、OCR用に最適化した新しいcanvasを返す
 */
export function preprocessForOcr(
  src: HTMLCanvasElement,
  options: PreprocessOptions = {}
): HTMLCanvasElement {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // 1. アップスケール
  const scaled = upscale(src, opts.scale);

  // 2. グレースケール変換
  const gray = toGrayscale(scaled);

  // 3. コントラスト・明度補正
  const contrasted = adjustContrast(gray, opts.contrast, opts.brightness);

  // 4. シャープ化
  const sharpened = opts.sharpen > 0 ? sharpen(contrasted, opts.sharpen) : contrasted;

  // 5. ノイズ除去（軽め）
  const denoised = opts.denoise > 1 ? gaussianBlur(sharpened, opts.denoise) : sharpened;

  // 6. 二値化
  const result = opts.binarize ? binarize(denoised, opts.threshold) : denoised;

  if (opts.debug) {
    console.log('[OCR Preprocess] 完了:', {
      original: `${src.width}x${src.height}`,
      processed: `${result.width}x${result.height}`,
      scale: opts.scale,
    });
  }

  return result;
}

/** アップスケール */
function upscale(src: HTMLCanvasElement, scale: number): HTMLCanvasElement {
  if (scale <= 1) return src;
  const dst = document.createElement('canvas');
  dst.width = Math.round(src.width * scale);
  dst.height = Math.round(src.height * scale);
  const ctx = dst.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, dst.width, dst.height);
  return dst;
}

/** グレースケール変換（輝度重みつき: BT.709） */
function toGrayscale(src: HTMLCanvasElement): HTMLCanvasElement {
  const dst = document.createElement('canvas');
  dst.width = src.width;
  dst.height = src.height;
  const ctx = dst.getContext('2d')!;
  ctx.drawImage(src, 0, 0);

  const imgData = ctx.getImageData(0, 0, dst.width, dst.height);
  const d = imgData.data;

  for (let i = 0; i < d.length; i += 4) {
    // BT.709 輝度係数
    const gray = Math.round(d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722);
    d[i] = d[i + 1] = d[i + 2] = gray;
  }

  ctx.putImageData(imgData, 0, 0);
  return dst;
}

/** コントラスト・明度補正 */
function adjustContrast(src: HTMLCanvasElement, contrast: number, brightness: number): HTMLCanvasElement {
  const dst = document.createElement('canvas');
  dst.width = src.width;
  dst.height = src.height;
  const ctx = dst.getContext('2d')!;
  ctx.drawImage(src, 0, 0);

  const imgData = ctx.getImageData(0, 0, dst.width, dst.height);
  const d = imgData.data;

  // contrast: 1.0=変化なし, >1.0=強調
  // brightness: 0=変化なし
  const factor = contrast;
  const offset = brightness;

  for (let i = 0; i < d.length; i += 4) {
    for (let c = 0; c < 3; c++) {
      let v = d[i + c];
      // コントラスト: (v - 128) * factor + 128
      v = (v - 128) * factor + 128 + offset;
      d[i + c] = Math.max(0, Math.min(255, Math.round(v)));
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return dst;
}

/** アンシャープマスクによるシャープ化 */
function sharpen(src: HTMLCanvasElement, strength: number): HTMLCanvasElement {
  const dst = document.createElement('canvas');
  dst.width = src.width;
  dst.height = src.height;
  const ctx = dst.getContext('2d')!;
  ctx.drawImage(src, 0, 0);

  const imgData = ctx.getImageData(0, 0, dst.width, dst.height);
  const original = ctx.getImageData(0, 0, dst.width, dst.height);
  const d = imgData.data;
  const od = original.data;
  const w = dst.width;
  const h = dst.height;

  // 3x3 シャープカーネル（アンシャープマスク近似）
  const kernel = [
    0, -strength, 0,
    -strength, 1 + 4 * strength, -strength,
    0, -strength, 0,
  ];

  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        let sum = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const ki = (ky + 1) * 3 + (kx + 1);
            const pi = ((y + ky) * w + (x + kx)) * 4;
            sum += od[pi + c] * kernel[ki];
          }
        }
        d[idx + c] = Math.max(0, Math.min(255, Math.round(sum)));
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return dst;
}

/** ガウシアンブラー（ノイズ除去） */
function gaussianBlur(src: HTMLCanvasElement, radius: number): HTMLCanvasElement {
  const dst = document.createElement('canvas');
  dst.width = src.width;
  dst.height = src.height;
  const ctx = dst.getContext('2d')!;

  // CSS filter blur を利用（高速）
  ctx.filter = `blur(${radius * 0.5}px)`;
  ctx.drawImage(src, 0, 0);
  ctx.filter = 'none';
  return dst;
}

/**
 * 適応的二値化
 * threshold=0 の場合はOtsuアルゴリズムで自動閾値を決定
 */
function binarize(src: HTMLCanvasElement, threshold: number): HTMLCanvasElement {
  const dst = document.createElement('canvas');
  dst.width = src.width;
  dst.height = src.height;
  const ctx = dst.getContext('2d')!;
  ctx.drawImage(src, 0, 0);

  const imgData = ctx.getImageData(0, 0, dst.width, dst.height);
  const d = imgData.data;

  // Otsu閾値自動計算
  const t = threshold > 0 ? threshold : otsuThreshold(d);

  for (let i = 0; i < d.length; i += 4) {
    const gray = d[i]; // すでにグレースケール
    const v = gray > t ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = v;
  }

  ctx.putImageData(imgData, 0, 0);
  return dst;
}

/** Otsuアルゴリズムで最適閾値を計算 */
function otsuThreshold(data: Uint8ClampedArray): number {
  // ヒストグラム作成
  const hist = new Array(256).fill(0);
  const total = data.length / 4;

  for (let i = 0; i < data.length; i += 4) {
    hist[data[i]]++;
  }

  let sumAll = 0;
  for (let i = 0; i < 256; i++) sumAll += i * hist[i];

  let sumB = 0;
  let wB = 0;
  let wF = 0;
  let maxVar = 0;
  let threshold = 128;

  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;

    wF = total - wB;
    if (wF === 0) break;

    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sumAll - sumB) / wF;

    const varBetween = wB * wF * (mB - mF) ** 2;
    if (varBetween > maxVar) {
      maxVar = varBetween;
      threshold = t;
    }
  }

  // レシートは白背景が多いので閾値を少し下げる
  return Math.max(100, threshold - 10);
}

/**
 * 画像の傾き検出と補正（簡易版）
 * Hough変換の近似として、水平線の密度を計算
 */
export function detectSkewAngle(src: HTMLCanvasElement): number {
  const ctx = src.getContext('2d')!;
  const imgData = ctx.getImageData(0, 0, src.width, src.height);
  const d = imgData.data;
  const w = src.width;
  const h = src.height;

  // サンプリング（全ピクセルは重いので間引き）
  const sampleStep = Math.max(1, Math.floor(Math.min(w, h) / 200));

  // 各角度での黒ピクセル密度を計算
  const angles = [-10, -7, -5, -3, -2, -1, 0, 1, 2, 3, 5, 7, 10];
  let bestAngle = 0;
  let maxScore = -1;

  for (const angle of angles) {
    const rad = (angle * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);

    // 行ごとの黒ピクセル数の分散を計算（高い分散 = 文字行が揃っている）
    const rowCounts: number[] = [];

    for (let y = 0; y < h; y += sampleStep) {
      let count = 0;
      for (let x = 0; x < w; x += sampleStep) {
        // 回転後の座標
        const nx = Math.round((x - w / 2) * cos - (y - h / 2) * sin + w / 2);
        const ny = Math.round((x - w / 2) * sin + (y - h / 2) * cos + h / 2);
        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
          const idx = (ny * w + nx) * 4;
          if (d[idx] < 128) count++;
        }
      }
      rowCounts.push(count);
    }

    // 分散計算
    const mean = rowCounts.reduce((a, b) => a + b, 0) / rowCounts.length;
    const variance = rowCounts.reduce((a, b) => a + (b - mean) ** 2, 0) / rowCounts.length;

    if (variance > maxScore) {
      maxScore = variance;
      bestAngle = angle;
    }
  }

  return bestAngle;
}

/**
 * キャンバスを指定角度で回転して返す
 */
export function rotateCanvas(src: HTMLCanvasElement, angleDeg: number): HTMLCanvasElement {
  if (angleDeg === 0) return src;
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));
  const dw = Math.round(src.width * cos + src.height * sin);
  const dh = Math.round(src.width * sin + src.height * cos);

  const dst = document.createElement('canvas');
  dst.width = dw;
  dst.height = dh;
  const ctx = dst.getContext('2d')!;
  ctx.translate(dw / 2, dh / 2);
  ctx.rotate(rad);
  ctx.drawImage(src, -src.width / 2, -src.height / 2);
  return dst;
}

/**
 * デバッグ用: 前処理前後を比較するcanvasを生成
 */
export function createDebugCanvas(
  original: HTMLCanvasElement,
  processed: HTMLCanvasElement
): HTMLCanvasElement {
  const w = Math.max(original.width, processed.width);
  const h = Math.max(original.height, processed.height);
  const dst = document.createElement('canvas');
  dst.width = w * 2 + 20;
  dst.height = h;
  const ctx = dst.getContext('2d')!;
  ctx.fillStyle = '#333';
  ctx.fillRect(0, 0, dst.width, dst.height);
  ctx.drawImage(original, 0, 0);
  ctx.drawImage(processed, w + 20, 0);
  return dst;
}
