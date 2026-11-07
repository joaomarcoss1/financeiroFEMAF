// Importação da lista de alunos de uma turma (nome + matrícula) a partir de
// Excel/CSV ou PDF. Ambos os parsers são heurísticos e retornam uma prévia
// editável — o admin revisa/corrige antes de confirmar o lançamento, em vez
// de o sistema inserir cegamente linhas malformadas.

export interface AlunoImportado {
  nome: string;
  matricula: string;
  linhaOriginal: string;
}

function limparNome(s: string): string {
  return s
    .replace(/[|_]+/g, ' ')
    .replace(/^[\s.\-–:)]+/, '')
    .replace(/[\s.\-–:]+$/, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function pareceTituloOuCabecalho(s: string): boolean {
  const n = s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  return /^(nome|aluno|matr[ií]cula|relacao de alunos|lista de alunos|turma|n[ºo°]?\s*$)/.test(n.trim());
}

export function parseRosterExcel(rows: unknown[][]): AlunoImportado[] {
  if (!rows.length) return [];

  const norm = (v: unknown) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  let headerRowIdx = -1;
  let colNome = 0;
  let colMatricula = 1;

  for (let i = 0; i < Math.min(rows.length, 5); i++) {
    const cells = (rows[i] || []).map(norm);
    const iNome = cells.findIndex((c) => c === 'nome' || c.includes('nome do aluno') || c === 'aluno');
    const iMat = cells.findIndex((c) => c.includes('matricula') || c.includes('matr.') || c === 'ra' || c === 'registro');
    if (iNome !== -1) {
      headerRowIdx = i;
      colNome = iNome;
      colMatricula = iMat !== -1 ? iMat : (iNome === 0 ? 1 : 0);
      break;
    }
  }

  const dataRows = headerRowIdx === -1 ? rows : rows.slice(headerRowIdx + 1);
  const out: AlunoImportado[] = [];
  for (const row of dataRows) {
    if (!row || row.length === 0) continue;
    const nome = limparNome(String(row[colNome] ?? ''));
    const matricula = String(row[colMatricula] ?? '').trim();
    if (!nome || pareceTituloOuCabecalho(nome)) continue;
    out.push({ nome, matricula, linhaOriginal: row.join(' | ') });
  }
  return out;
}

export async function readSpreadsheetFile(file: File): Promise<unknown[][]> {
  const { default: XLSX } = await import('xlsx-js-style');
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
}

// Extrai linhas de texto de um PDF (uma string por linha visual, agrupando
// fragmentos pela coordenada Y) usando pdfjs-dist no navegador.
async function extractPdfLines(file: File): Promise<string[]> {
  const pdfjsLib = await import('pdfjs-dist');
  const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
  pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const linhas: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const porLinha = new Map<number, { x: number; str: string }[]>();
    for (const raw of content.items as any[]) {
      if (typeof raw.str !== 'string' || !raw.str.trim()) continue;
      const y = Math.round((raw.transform?.[5] ?? 0) / 3) * 3;
      if (!porLinha.has(y)) porLinha.set(y, []);
      porLinha.get(y)!.push({ x: raw.transform?.[4] ?? 0, str: raw.str });
    }
    const ys = [...porLinha.keys()].sort((a, b) => b - a);
    for (const y of ys) {
      const itens = porLinha.get(y)!.sort((a, b) => a.x - b.x);
      linhas.push(itens.map((it) => it.str).join(' ').replace(/\s{2,}/g, ' ').trim());
    }
  }
  return linhas.filter(Boolean);
}

const RE_MATRICULA = /\b\d{4,15}\b/;

export function parseRosterPdfLines(linhas: string[]): AlunoImportado[] {
  const out: AlunoImportado[] = [];
  for (const linhaOriginal of linhas) {
    const linha = linhaOriginal.replace(/^\s*\d{1,3}[.)-]\s+/, ''); // remove numeração "1. " / "01) "
    if (pareceTituloOuCabecalho(linha)) continue;

    const m = linha.match(RE_MATRICULA);
    const matricula = m ? m[0] : '';
    const nome = limparNome(matricula ? linha.replace(RE_MATRICULA, ' ') : linha);

    if (!nome || nome.length < 3 || !/[A-Za-zÀ-ÿ]{3,}/.test(nome)) continue;
    out.push({ nome, matricula, linhaOriginal });
  }
  return out;
}

export async function parseRosterPdf(file: File): Promise<AlunoImportado[]> {
  const linhas = await extractPdfLines(file);
  return parseRosterPdfLines(linhas);
}

export async function parseRosterFile(file: File): Promise<AlunoImportado[]> {
  const ext = file.name.toLowerCase().split('.').pop();
  if (ext === 'pdf') return parseRosterPdf(file);
  const rows = await readSpreadsheetFile(file);
  return parseRosterExcel(rows);
}
