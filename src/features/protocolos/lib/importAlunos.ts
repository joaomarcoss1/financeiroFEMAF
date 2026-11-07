import { cpfValido, somenteDigitos } from './cpf';

export interface LinhaAluno {
  linha: number;
  matricula: string;
  nome: string;
  cpf: string;
  data_nascimento: string; // ISO
  email: string | null;
  curso_id: string;
  turma_id: string | null;
  erros: string[];
  duplicado: boolean;
}

const norm = (v: unknown) => String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const COLUNAS: Record<keyof Omit<LinhaAluno, 'linha' | 'erros' | 'duplicado' | 'turma_id'> | 'turma', (h: string) => boolean> = {
  matricula: (h) => h.includes('matricula') || h === 'ra',
  nome: (h) => h === 'nome' || h.includes('nome do aluno') || h === 'aluno' || h === 'nome completo',
  cpf: (h) => h === 'cpf',
  data_nascimento: (h) => h.includes('nascimento') || h === 'data nasc' || h === 'dn',
  email: (h) => h.includes('email') || h.includes('e-mail'),
  curso_id: (h) => h === 'curso',
  turma: (h) => h === 'turma',
};

/** dd/mm/aaaa, aaaa-mm-dd ou número serial do Excel → aaaa-mm-dd (ou '' se inválida). */
export function parseData(v: unknown): string {
  if (typeof v === 'number' && v > 59) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  const s = String(v ?? '').trim();
  let m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  if (m) return valida(`${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`);
  m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? valida(`${m[1]}-${m[2]}-${m[3]}`) : '';
}
function valida(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso ? iso : '';
}

/**
 * Converte a planilha (primeira linha = cabeçalho) em linhas validadas.
 * Curso e turma aceitam id ou nome. Marca duplicados no arquivo e já cadastrados.
 */
export function parsePlanilhaAlunos(
  rows: unknown[][],
  cursos: { id: string; nome: string }[],
  turmas: { id: string; nome: string; curso_id: string }[],
  existentes: { matriculas: Set<string>; cpfs: Set<string> },
): LinhaAluno[] {
  if (!rows.length) return [];
  const cab = rows[0].map(norm);
  const idx = Object.fromEntries(Object.entries(COLUNAS).map(([k, f]) => [k, cab.findIndex(f)])) as Record<keyof typeof COLUNAS, number>;
  const cel = (r: unknown[], k: keyof typeof COLUNAS) => (idx[k] >= 0 ? r[idx[k]] : undefined);
  const vistosM = new Set<string>();
  const vistosC = new Set<string>();
  const out: LinhaAluno[] = [];

  rows.slice(1).forEach((r, i) => {
    if (!r || r.every((c) => String(c ?? '').trim() === '')) return;
    const erros: string[] = [];
    const matricula = String(cel(r, 'matricula') ?? '').trim();
    const nome = String(cel(r, 'nome') ?? '').replace(/\s+/g, ' ').trim();
    const cpf = somenteDigitos(String(cel(r, 'cpf') ?? '')).padStart(11, '0');
    const data_nascimento = parseData(cel(r, 'data_nascimento'));
    const email = String(cel(r, 'email') ?? '').trim() || null;
    const cursoTxt = norm(cel(r, 'curso_id'));
    const curso = cursos.find((c) => norm(c.id) === cursoTxt || norm(c.nome) === cursoTxt);
    const turmaTxt = norm(cel(r, 'turma'));
    const turma = turmaTxt ? turmas.find((t) => (norm(t.id) === turmaTxt || norm(t.nome) === turmaTxt) && (!curso || t.curso_id === curso.id)) : undefined;

    if (!matricula) erros.push('matrícula vazia');
    if (!nome) erros.push('nome vazio');
    if (!cpfValido(cpf)) erros.push('CPF inválido');
    if (!data_nascimento) erros.push('data de nascimento inválida');
    if (!curso) erros.push('curso não encontrado');
    if (turmaTxt && !turma) erros.push('turma não encontrada');
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) erros.push('e-mail inválido');

    const mKey = matricula.toLowerCase();
    const duplicado = vistosM.has(mKey) || vistosC.has(cpf) || existentes.matriculas.has(mKey) || existentes.cpfs.has(cpf);
    if (vistosM.has(mKey) || vistosC.has(cpf)) erros.push('repetido no arquivo');
    else if (existentes.matriculas.has(mKey) || existentes.cpfs.has(cpf)) erros.push('já cadastrado');
    vistosM.add(mKey);
    vistosC.add(cpf);

    out.push({ linha: i + 2, matricula, nome, cpf, data_nascimento, email, curso_id: curso?.id ?? '', turma_id: turma?.id ?? null, erros, duplicado });
  });
  return out;
}
