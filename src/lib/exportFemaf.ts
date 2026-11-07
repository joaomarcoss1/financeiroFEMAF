// Builders compartilhados para os relatórios/folhas em PDF e Excel com a
// identidade visual da FEMAF (antes duplicados quase que linha-a-linha em
// FolhaPagamento.tsx, FolhaAdministrativo.tsx, Administrativo.tsx e
// Coordenador.tsx). Cada tela monta apenas as colunas/linhas e chama
// downloadFemafXlsx / downloadFemafPdf.
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
// xlsx-js-style (~600kB) e jspdf+autotable (~400kB) só são baixados quando
// o usuário realmente exporta um relatório — importados sob demanda dentro
// de cada função, em vez de no topo do módulo, pra não atrasar o
// carregamento de toda tela que só exibe os dados na página.

export const FEMAF_PRIMARIA_HEX = '1E1180';
export const FEMAF_DESTAQUE_HEX = '0095E8';
export const FEMAF_CINZA_HEX = 'F4F4F4';
export const FEMAF_PRETO_HEX = '111111';
export const FEMAF_BRANCO_HEX = 'FFFFFF';
export const FEMAF_PRIMARIA_RGB: [number, number, number] = [30, 17, 128];
export const FEMAF_DESTAQUE_RGB: [number, number, number] = [0, 149, 232];

const MONEY_FMT = 'R$ #,##0.00;[Red](R$ #,##0.00)';
const INT_FMT = '0';

export interface FemafColumn {
  header: string;
  /** Largura em "caracteres" (Excel !cols wch). */
  xlsxWidth: number;
  /** Largura em mm (jspdf-autotable cellWidth). */
  pdfWidth: number;
  align?: 'left' | 'center' | 'right';
  money?: boolean;
  int?: boolean;
  bold?: boolean;
  fontSize?: number;
}

export interface FemafResumoLinha {
  label: string;
  value: string | number;
  isMoney?: boolean;
}

/** Um grupo de linhas com cabeçalho e cor próprios (ex.: um curso/setor na folha unificada). */
export interface FemafSection {
  label: string;
  /** Cor de fundo do cabeçalho da seção e (bem clareada) das linhas dela. */
  colorHex: string;
  rows: (string | number)[][];
  /** Texto livre ao lado do rótulo no cabeçalho, ex.: "7 pessoa(s)". */
  countLabel?: string;
  subtotal: number;
}

export interface FemafReportOptions {
  subtitulo: string;
  periodoLabel: string;
  columns: FemafColumn[];
  /** Ignorado quando `sections` é informado. */
  rows: (string | number)[][];
  /** Agrupa as linhas em blocos com cabeçalho/cor próprios, numeração contínua entre eles. */
  sections?: FemafSection[];
  totalLabel?: string;
  totalValue?: number;
  totalExtra?: string;
  resumo?: FemafResumoLinha[];
  assinaturas?: [string, string];
  filename: string;
}

/** Clareia uma cor hex misturando com branco — para o fundo das linhas de uma seção (o cabeçalho usa a cor cheia). */
function tintHex(hex: string, amount: number): string {
  const n = parseInt(hex, 16);
  const r = (n >> 16) & 0xff, g = (n >> 8) & 0xff, b = n & 0xff;
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  return [mix(r), mix(g), mix(b)].map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase();
}

function moneyCell(v: number) {
  return `R$ ${Number(v || 0).toFixed(2)}`;
}

// ============================================================
// Excel (xlsx-js-style)
// ============================================================
export async function downloadFemafXlsx(opts: FemafReportOptions) {
  const { default: XLSX } = await import('xlsx-js-style');
  const { subtitulo, periodoLabel, columns, rows, sections, totalLabel = 'TOTAL GERAL', totalValue, totalExtra, resumo, assinaturas, filename } = opts;
  const lastCol = columns.length - 1;
  const border = {
    top: { style: 'thin', color: { rgb: 'CCCCCC' } },
    bottom: { style: 'thin', color: { rgb: 'CCCCCC' } },
    left: { style: 'thin', color: { rgb: 'CCCCCC' } },
    right: { style: 'thin', color: { rgb: 'CCCCCC' } },
  } as const;
  const titleStyle = { font: { name: 'Calibri', sz: 18, bold: true, color: { rgb: FEMAF_BRANCO_HEX } }, fill: { fgColor: { rgb: FEMAF_PRIMARIA_HEX } }, alignment: { horizontal: 'center', vertical: 'center' } };
  const subtitleStyle = { font: { name: 'Calibri', sz: 11, italic: true, color: { rgb: FEMAF_BRANCO_HEX } }, fill: { fgColor: { rgb: FEMAF_PRIMARIA_HEX } }, alignment: { horizontal: 'center', vertical: 'center' } };
  const periodoStyle = { font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: FEMAF_PRETO_HEX } }, fill: { fgColor: { rgb: FEMAF_DESTAQUE_HEX } }, alignment: { horizontal: 'center', vertical: 'center' } };
  const headerStyle = { font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: FEMAF_BRANCO_HEX } }, fill: { fgColor: { rgb: FEMAF_PRIMARIA_HEX } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border };
  const cellBase = { font: { name: 'Calibri', sz: 10, color: { rgb: FEMAF_PRETO_HEX } }, alignment: { vertical: 'center', wrapText: true }, border };
  const cellAlt = { ...cellBase, fill: { fgColor: { rgb: FEMAF_CINZA_HEX } } };

  const wb = XLSX.utils.book_new();
  const ws: any = {};
  const merges: any[] = [];
  const setCell = (addr: string, v: any, s?: any, z?: string) => {
    ws[addr] = { v, t: typeof v === 'number' ? 'n' : 's', s, ...(z ? { z } : {}) };
  };

  setCell('A1', 'FEMAF – FACULDADE DE EDUCAÇÃO MEMORIAL ADELAIDE FRANCO', titleStyle);
  merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: lastCol } });
  setCell('A2', subtitulo, subtitleStyle);
  merges.push({ s: { r: 1, c: 0 }, e: { r: 1, c: lastCol } });
  setCell('A3', `Período: ${periodoLabel.toUpperCase()}`, periodoStyle);
  const periodoEnd = Math.max(5, Math.floor(lastCol / 2));
  merges.push({ s: { r: 2, c: 0 }, e: { r: 2, c: Math.min(periodoEnd, lastCol) } });
  if (periodoEnd < lastCol) {
    setCell(XLSX.utils.encode_cell({ r: 2, c: periodoEnd + 1 }), `Emissão: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, {
      font: { name: 'Calibri', sz: 10, italic: true, color: { rgb: FEMAF_PRETO_HEX } },
      fill: { fgColor: { rgb: FEMAF_DESTAQUE_HEX } },
      alignment: { horizontal: 'center', vertical: 'center' },
    });
    merges.push({ s: { r: 2, c: periodoEnd + 1 }, e: { r: 2, c: lastCol } });
  }

  columns.forEach((c, i) => setCell(XLSX.utils.encode_cell({ r: 3, c: i }), c.header, headerStyle));

  let row = 4;
  const writeRow = (r: (string | number)[], base: any) => {
    r.forEach((v, ci) => {
      const col = columns[ci];
      const align = col.align || (col.money || col.int ? 'right' : 'left');
      const style = {
        ...base,
        alignment: { ...base.alignment, horizontal: align },
        ...(col.bold ? { font: { ...base.font, bold: true } } : {}),
        ...(col.fontSize ? { font: { ...base.font, ...(col.bold ? { bold: true } : {}), sz: col.fontSize } } : {}),
      };
      const fmt = col.money ? MONEY_FMT : col.int ? INT_FMT : undefined;
      setCell(XLSX.utils.encode_cell({ r: row, c: ci }), v, style, fmt);
    });
    row++;
  };

  if (sections && sections.length > 0) {
    sections.forEach((section) => {
      const headerFill = { rgb: section.colorHex };
      const sectionHeaderStyle = {
        font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: FEMAF_BRANCO_HEX } },
        fill: { fgColor: headerFill },
        alignment: { horizontal: 'left', vertical: 'center' },
        border,
      };
      const headerText = `${section.label.toUpperCase()}${section.countLabel ? ` — ${section.countLabel}` : ''} · ${moneyCell(section.subtotal)}`;
      setCell(XLSX.utils.encode_cell({ r: row, c: 0 }), headerText, sectionHeaderStyle);
      merges.push({ s: { r: row, c: 0 }, e: { r: row, c: lastCol } });
      row++;
      const tinted = { rgb: tintHex(section.colorHex, 0.85) };
      section.rows.forEach((r) => writeRow(r, { ...cellBase, fill: { fgColor: tinted } }));
    });
  } else {
    rows.forEach((r, idx) => writeRow(r, idx % 2 === 0 ? cellBase : cellAlt));
  }

  if (totalValue !== undefined) {
    const totalLabelStyle = { font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: FEMAF_BRANCO_HEX } }, fill: { fgColor: { rgb: FEMAF_PRIMARIA_HEX } }, alignment: { horizontal: 'right', vertical: 'center' }, border };
    const totalValueStyle = { font: { name: 'Calibri', sz: 13, bold: true, color: { rgb: FEMAF_BRANCO_HEX } }, fill: { fgColor: { rgb: FEMAF_PRIMARIA_HEX } }, alignment: { horizontal: 'right', vertical: 'center' }, border };
    const valueCol = Math.max(1, columns.reduce((index, col, i) => col.money && col.bold ? i : index, -1));
    setCell(XLSX.utils.encode_cell({ r: row, c: 0 }), totalLabel, totalLabelStyle);
    merges.push({ s: { r: row, c: 0 }, e: { r: row, c: Math.max(valueCol - 1, 0) } });
    setCell(XLSX.utils.encode_cell({ r: row, c: valueCol }), Number(totalValue), totalValueStyle, MONEY_FMT);
    if (totalExtra !== undefined && valueCol < lastCol) {
      setCell(XLSX.utils.encode_cell({ r: row, c: valueCol + 1 }), totalExtra, { ...totalLabelStyle, alignment: { horizontal: 'center', vertical: 'center' } });
      if (valueCol + 1 < lastCol) merges.push({ s: { r: row, c: valueCol + 1 }, e: { r: row, c: lastCol } });
    }
    row++;
  }

  if (resumo && resumo.length > 0) {
    row += 1;
    const resumoTitulo = { font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: FEMAF_PRETO_HEX } }, fill: { fgColor: { rgb: FEMAF_DESTAQUE_HEX } }, alignment: { horizontal: 'left', vertical: 'center' }, border };
    setCell(XLSX.utils.encode_cell({ r: row, c: 0 }), 'RESUMO', resumoTitulo);
    merges.push({ s: { r: row, c: 0 }, e: { r: row, c: lastCol } });
    row++;
    resumo.forEach((linha) => {
      setCell(XLSX.utils.encode_cell({ r: row, c: 0 }), linha.label, {
        font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: FEMAF_PRETO_HEX } },
        alignment: { horizontal: 'left', vertical: 'center' }, border,
      });
      merges.push({ s: { r: row, c: 0 }, e: { r: row, c: Math.max(lastCol - 2, 0) } });
      setCell(XLSX.utils.encode_cell({ r: row, c: Math.max(lastCol - 1, 0) }), linha.value, {
        font: { name: 'Calibri', sz: 10, bold: true, color: { rgb: FEMAF_PRETO_HEX } },
        alignment: { horizontal: 'right', vertical: 'center' }, border,
      }, linha.isMoney ? MONEY_FMT : undefined);
      merges.push({ s: { r: row, c: Math.max(lastCol - 1, 0) }, e: { r: row, c: lastCol } });
      row++;
    });
  }

  if (assinaturas) {
    row += 2;
    const assinaturaStyle = {
      font: { name: 'Calibri', sz: 10, color: { rgb: FEMAF_PRETO_HEX } },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: { top: { style: 'thin', color: { rgb: FEMAF_PRETO_HEX } } },
    };
    const mid = Math.floor(lastCol / 2);
    setCell(XLSX.utils.encode_cell({ r: row, c: 0 }), assinaturas[0], assinaturaStyle);
    merges.push({ s: { r: row, c: 0 }, e: { r: row, c: Math.max(mid - 1, 0) } });
    setCell(XLSX.utils.encode_cell({ r: row, c: mid + 1 }), assinaturas[1], assinaturaStyle);
    merges.push({ s: { r: row, c: mid + 1 }, e: { r: row, c: lastCol } });
  }

  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: row, c: lastCol } });
  ws['!merges'] = merges;
  ws['!cols'] = columns.map((c) => ({ wch: c.xlsxWidth }));
  ws['!rows'] = [{ hpt: 28 }, { hpt: 18 }, { hpt: 22 }, { hpt: 32 }];
  (ws as any)['!freeze'] = { xSplit: 0, ySplit: 4 };

  XLSX.utils.book_append_sheet(wb, ws, subtitulo.slice(0, 31));
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// ============================================================
// PDF (jsPDF + autoTable)
// ============================================================
function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex, 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

export async function downloadFemafPdf(opts: FemafReportOptions, orientation: 'landscape' | 'portrait' = 'landscape') {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const { subtitulo, periodoLabel, columns, rows, sections, totalLabel = 'TOTAL GERAL:', totalValue, totalExtra, assinaturas, filename } = opts;
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFillColor(...FEMAF_PRIMARIA_RGB);
  doc.rect(0, 0, pageW, 22, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('FEMAF – FACULDADE DE EDUCAÇÃO MEMORIAL ADELAIDE FRANCO', pageW / 2, 10, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(subtitulo, pageW / 2, 16, { align: 'center' });

  doc.setFillColor(...FEMAF_DESTAQUE_RGB);
  doc.rect(0, 22, pageW, 8, 'F');
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(`PERÍODO: ${periodoLabel.toUpperCase()}`, 10, 27.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`Emissão: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageW - 10, 27.5, { align: 'right' });

  const formatRow = (r: (string | number)[]) => r.map((v, ci) => {
    const col = columns[ci];
    if (col.money && typeof v === 'number') return moneyCell(v);
    return String(v);
  });

  // Quando agrupado em seções, cada bloco vira uma linha-cabeçalho mesclada
  // (colSpan cobrindo todas as colunas) seguida das linhas daquele setor —
  // guardamos as faixas de índice pra tingir o fundo de cada uma na hora de
  // desenhar (didParseCell), já que o corpo é uma tabela única (o cabeçalho
  // de colunas não se repete a cada seção).
  const sectionTint: { from: number; to: number; color: [number, number, number] }[] = [];
  let body: any[];
  if (sections && sections.length > 0) {
    body = [];
    sections.forEach((section) => {
      const headerText = `${section.label.toUpperCase()}${section.countLabel ? ` — ${section.countLabel}` : ''} · ${moneyCell(section.subtotal)}`;
      body.push([{ content: headerText, colSpan: columns.length, styles: { fillColor: hexToRgb(section.colorHex), textColor: 255, fontStyle: 'bold', halign: 'left', fontSize: 9 } }]);
      const from = body.length;
      section.rows.forEach((r) => body.push(formatRow(r)));
      sectionTint.push({ from, to: body.length - 1, color: hexToRgb(tintHex(section.colorHex, 0.88)) });
    });
  } else {
    body = rows.map(formatRow);
  }

  const foot = totalValue !== undefined ? [columns.map(() => '')] : undefined;
  if (foot) {
    const valueCol = Math.max(1, columns.reduce((index, col, i) => col.money && col.bold ? i : index, -1));
    foot[0][valueCol - 1] = totalLabel;
    foot[0][valueCol] = moneyCell(totalValue);
    if (totalExtra !== undefined && valueCol < columns.length - 1) foot[0][valueCol + 1] = totalExtra;
  }

  const columnStyles: Record<number, any> = {};
  columns.forEach((c, i) => {
    columnStyles[i] = {
      cellWidth: c.pdfWidth,
      halign: c.align || (c.money || c.int ? 'right' : 'left'),
      ...(c.bold ? { fontStyle: 'bold' } : {}),
      ...(c.fontSize ? { fontSize: c.fontSize } : {}),
    };
  });

  autoTable(doc, {
    startY: 36,
    head: [columns.map((c) => c.header)],
    body,
    foot,
    headStyles: { fillColor: FEMAF_PRIMARIA_RGB, textColor: 255, fontStyle: 'bold', halign: 'center' },
    footStyles: { fillColor: FEMAF_PRIMARIA_RGB, textColor: 255, fontStyle: 'bold', halign: 'right' },
    bodyStyles: { fontSize: 8, cellPadding: 1.8 },
    alternateRowStyles: sectionTint.length ? undefined : { fillColor: [244, 244, 244] },
    columnStyles,
    margin: { left: 8, right: 8 },
    didParseCell: sectionTint.length
      ? (data) => {
          if (data.section !== 'body') return;
          const band = sectionTint.find((b) => data.row.index >= b.from && data.row.index <= b.to);
          if (band) data.cell.styles.fillColor = band.color;
        }
      : undefined,
    didDrawPage: (data) => {
      const ph = doc.internal.pageSize.getHeight();
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text(`Documento gerado eletronicamente — FEMAF • Página ${data.pageNumber}`, pageW / 2, ph - 6, { align: 'center' });
    },
  });

  if (assinaturas) {
    const finalY = (doc as any).lastAutoTable.finalY + 18;
    if (finalY < doc.internal.pageSize.getHeight() - 30) {
      const signW = 70;
      doc.setDrawColor(0, 0, 0);
      doc.line(20, finalY, 20 + signW, finalY);
      doc.line(pageW - 20 - signW, finalY, pageW - 20, finalY);
      doc.setFontSize(9);
      doc.setTextColor(50, 50, 50);
      doc.text(assinaturas[0], 20 + signW / 2, finalY + 5, { align: 'center' });
      doc.text(assinaturas[1], pageW - 20 - signW / 2, finalY + 5, { align: 'center' });
    }
  }

  doc.save(`${filename}.pdf`);
}
