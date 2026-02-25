import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import { Receipt } from '../types/receipt';

/** Receipt → 行データに変換 */
function toRow(r: Receipt, index: number) {
  return {
    'No.': index + 1,
    '日付': r.date,
    '支払先': r.vendor,
    '金額（円）': r.amount,
    '消費税額（円）': r.taxAmount ?? 0,
    'カテゴリ': r.category,
    '勘定科目': r.accountTitle || '',
    '税区分': r.taxCategory || '',
    '適用・用途': r.purpose || '',
    'タグ': (r.tags ?? []).join(', '),
    'メモ': r.memo || '',
    '元ファイル形式': r.originalType === 'pdf' ? 'PDF' : '画像',
    'OCR精度（%）': r.ocrConfidence ?? 0,
    'ファイル名': r.filename,
    '登録日時': new Date(r.createdAt).toLocaleString('ja-JP'),
  };
}

/** Excel（.xlsx）として出力 */
export function exportToExcel(receipts: Receipt[], filename = '領収書一覧') {
  const rows = receipts.map(toRow);
  const ws = XLSX.utils.json_to_sheet(rows);

  // 列幅の自動調整
  const colWidths = [
    { wch: 5 },  // No.
    { wch: 12 }, // 日付
    { wch: 25 }, // 支払先
    { wch: 12 }, // 金額
    { wch: 12 }, // 消費税
    { wch: 14 }, // カテゴリ
    { wch: 16 }, // 勘定科目
    { wch: 16 }, // 税区分
    { wch: 30 }, // 適用・用途
    { wch: 25 }, // タグ
    { wch: 30 }, // メモ
    { wch: 14 }, // 元ファイル形式
    { wch: 12 }, // OCR精度
    { wch: 40 }, // ファイル名
    { wch: 20 }, // 登録日時
  ];
  ws['!cols'] = colWidths;

  // ヘッダー行のスタイル（xlsxコミュニティ版では限定的）
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  for (let C = range.s.c; C <= range.e.c; C++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c: C })];
    if (cell) {
      cell.s = {
        font: { bold: true, color: { rgb: 'FFFFFF' } },
        fill: { fgColor: { rgb: '1E3A8A' } },
        alignment: { horizontal: 'center' },
      };
    }
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '領収書一覧');

  // 集計シートを追加
  const summaryRows = buildSummary(receipts);
  const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
  wsSummary['!cols'] = [{ wch: 20 }, { wch: 8 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, '集計');

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  saveAs(blob, `${filename}_${dateStr}.xlsx`);
}

/** CSV として出力 */
export function exportToCsv(receipts: Receipt[], filename = '領収書一覧') {
  const rows = receipts.map(toRow);
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);

  // BOM付きUTF-8（Excelで文字化けしないように）
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });

  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  saveAs(blob, `${filename}_${dateStr}.csv`);
}

/** 弥生 青色申告向けCSVとして出力（仕訳形式） */
export function exportToYayoiCsv(receipts: Receipt[], filename = '弥生取込_領収書仕訳') {
  const rows = receipts.map((receipt) => ({
    '取引日': receipt.date,
    '借方勘定科目': receipt.accountTitle || '雑費',
    '借方補助科目': '',
    '借方部門': '',
    '借方税区分': mapTaxCategoryForYayoi(receipt.taxCategory),
    '借方金額': receipt.amount,
    '借方税額': receipt.taxAmount ?? 0,
    '貸方勘定科目': '事業主借',
    '貸方補助科目': '',
    '貸方部門': '',
    '貸方税区分': '対象外',
    '貸方金額': receipt.amount,
    '貸方税額': 0,
    '摘要': buildYayoiDescription(receipt),
    '取引先': receipt.vendor || '',
    '仕訳メモ': receipt.memo || '',
    '付箋1': (receipt.tags ?? [])[0] || '',
    '付箋2': (receipt.tags ?? [])[1] || '',
    '調整': 0,
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);

  // BOM付きUTF-8（文字化け対策）
  const bom = '\uFEFF';
  const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });

  const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  saveAs(blob, `${filename}_${dateStr}.csv`);
}

function mapTaxCategoryForYayoi(taxCategory: Receipt['taxCategory']) {
  switch (taxCategory) {
    case '課税（10%）':
      return '課対仕入10%';
    case '軽減税率（8%）':
      return '課対仕入8%';
    case '非課税':
      return '非課税仕入';
    case '不課税':
      return '対象外';
    default:
      return '対象外';
  }
}

function buildYayoiDescription(receipt: Receipt) {
  const parts = [receipt.purpose, receipt.filename].filter(Boolean);
  return parts.join(' / ');
}

/** 集計シート用データ生成 */
function buildSummary(receipts: Receipt[]) {
  const total = receipts.reduce((s, r) => s + r.amount, 0);
  const rows: Record<string, string | number>[] = [
    { '項目': '総件数', '件数': receipts.length, '金額合計': total },
    { '項目': '', '件数': '', '金額合計': '' },
    { '項目': '【カテゴリ別】', '件数': '', '金額合計': '' },
  ];

  // カテゴリ別
  const byCategory: Record<string, { count: number; amount: number }> = {};
  receipts.forEach((r) => {
    if (!byCategory[r.category]) byCategory[r.category] = { count: 0, amount: 0 };
    byCategory[r.category].count += 1;
    byCategory[r.category].amount += r.amount;
  });
  Object.entries(byCategory)
    .sort(([, a], [, b]) => b.amount - a.amount)
    .forEach(([cat, v]) => {
      rows.push({ '項目': cat, '件数': v.count, '金額合計': v.amount });
    });

  rows.push({ '項目': '', '件数': '', '金額合計': '' });
  rows.push({ '項目': '【月別】', '件数': '', '金額合計': '' });

  // 月別
  const byMonth: Record<string, { count: number; amount: number }> = {};
  receipts.forEach((r) => {
    const m = r.date.slice(0, 7);
    if (!byMonth[m]) byMonth[m] = { count: 0, amount: 0 };
    byMonth[m].count += 1;
    byMonth[m].amount += r.amount;
  });
  Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .forEach(([month, v]) => {
      rows.push({ '項目': month, '件数': v.count, '金額合計': v.amount });
    });

  // 勘定科目別
  rows.push({ '項目': '', '件数': '', '金額合計': '' });
  rows.push({ '項目': '【勘定科目別】', '件数': '', '金額合計': '' });
  const byAccount: Record<string, { count: number; amount: number }> = {};
  receipts.forEach((r) => {
    const key = r.accountTitle || '未設定';
    if (!byAccount[key]) byAccount[key] = { count: 0, amount: 0 };
    byAccount[key].count += 1;
    byAccount[key].amount += r.amount;
  });
  Object.entries(byAccount)
    .sort(([, a], [, b]) => b.amount - a.amount)
    .forEach(([acc, v]) => {
      rows.push({ '項目': acc, '件数': v.count, '金額合計': v.amount });
    });

  return rows;
}
