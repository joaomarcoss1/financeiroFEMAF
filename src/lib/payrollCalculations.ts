export type FixedSubject = {
  id: string;
  nome: string;
  curso_id: string;
  pagamento_tipo: string;
  valor_fixo_semestral: number | null;
  pagamento_inicio: string | null;
  pagamento_fim: string | null;
  horas_fixas_quinzenais?: number;
};

export type PayrollRecord = {
  professor_id: string;
  materia_id: string;
  data: string;
  valor_total: number;
  quantidade_horarios: number;
  turma_id: string;
};

export const cents = (value: number) => Math.round((value + Number.EPSILON) * 100);
export const reais = (value: number) => cents(value) / 100;

export function quinzenaDates(day: string) {
  const month = day.slice(0, 7);
  const last = new Date(Number(month.slice(0, 4)), Number(month.slice(5)), 0).getDate();
  return day.slice(8) <= '15'
    ? { start: `${month}-01`, end: `${month}-15` }
    : { start: `${month}-16`, end: `${month}-${last}` };
}

/**
 * Janela (alinhada às quinzenas) em que a matéria está sob contrato fixo —
 * única fonte de verdade usada tanto para gerar as parcelas fixas quanto
 * para zerar o valor por hora-aula nesse período, para as duas contas
 * nunca divergirem. Exige pagamento_inicio E pagamento_fim preenchidos:
 * sem uma data de fim, a matéria NÃO é tratada como fixa (o professor
 * continua recebendo por hora-aula normalmente). Antes, um contrato fixo
 * cadastrado sem data de fim zerava o pagamento por hora-aula para sempre
 * sem nunca gerar a parcela fixa equivalente — perda silenciosa e
 * indefinida de pagamento. As datas são arredondadas para a quinzena que
 * as contém: a parcela fixa de uma quinzena parcial paga a quinzena
 * inteira, então o zeramento das aulas por hora precisa cobrir a mesma
 * quinzena inteira — do contrário, aulas dadas antes da data exata de
 * início (mas dentro da quinzena já paga integralmente pela parcela fixa)
 * eram pagas de novo por hora-aula, em dobro.
 */
export function fixedCoverageWindow(subject: FixedSubject): { start: string; end: string } | null {
  if (subject.pagamento_tipo === 'fixo_quinzenal') {
    if (!subject.pagamento_inicio || !(Number(subject.valor_fixo_semestral) > 0) ||
      !(Number(subject.horas_fixas_quinzenais) > 0) ||
      (subject.pagamento_fim && subject.pagamento_inicio > subject.pagamento_fim)) return null;
    return { start: quinzenaDates(subject.pagamento_inicio).start,
      end: subject.pagamento_fim ? quinzenaDates(subject.pagamento_fim).end : '9999-12-31' };
  }
  if (
    subject.pagamento_tipo !== 'fixo_semestral' ||
    !subject.pagamento_inicio ||
    !subject.pagamento_fim ||
    subject.pagamento_inicio > subject.pagamento_fim ||
    !Number.isFinite(Number(subject.valor_fixo_semestral))
  ) return null;
  return {
    start: quinzenaDates(subject.pagamento_inicio).start,
    end: quinzenaDates(subject.pagamento_fim).end,
  };
}

/** Lista as quinzenas (alinhadas) entre duas datas — ex.: para prever quantas parcelas um contrato fixo vai gerar. */
export function listQuinzenas(windowStart: string, windowEnd: string) {
  const periods: { start: string; end: string }[] = [];
  let cursor = windowStart;
  while (cursor <= windowEnd && periods.length < 120) {
    periods.push(quinzenaDates(cursor));
    const [year, month] = cursor.slice(0, 7).split('-').map(Number);
    cursor = cursor.endsWith('-01') ? `${cursor.slice(0, 7)}-16` : `${year + (month === 12 ? 1 : 0)}-${String(month === 12 ? 1 : month + 1).padStart(2, '0')}-01`;
  }
  return periods;
}

/** One installment per overlapping half-month; any rounding remainder goes to the last one. */
export function fixedInstallments(subject: FixedSubject, start: string, end: string) {
  const window = fixedCoverageWindow(subject);
  if (!window) return [];
  if (subject.pagamento_tipo === 'fixo_quinzenal') {
    if (start > end || end < window.start || start > window.end) return [];
    const first = quinzenaDates(start > window.start ? start : window.start).start;
    const last = end < window.end ? end : window.end;
    return listQuinzenas(first, last).map(period => ({ ...period,
      index: 0, count: 0, value: reais(Number(subject.valor_fixo_semestral)),
      hours: Number(subject.horas_fixas_quinzenais), recurring: true,
    }));
  }
  const periods = listQuinzenas(window.start, window.end);
  const total = cents(Number(subject.valor_fixo_semestral));
  const base = Math.trunc(total / periods.length);
  return periods.map((period, index) => ({
    ...period,
    index: index + 1,
    count: periods.length,
    hours: 0,
    recurring: false,
    value: (base + (index === periods.length - 1 ? total - base * periods.length : 0)) / 100,
  })).filter(period => period.start <= end && period.end >= start);
}

export function hourlyRecordValue(record: PayrollRecord, subjects: Map<string, FixedSubject>) {
  const subject = subjects.get(record.materia_id);
  const window = subject ? fixedCoverageWindow(subject) : null;
  // Preserve historical hourly earnings before/after the fixed contract's window.
  if (window && record.data >= window.start && record.data <= window.end) return 0;
  return reais(Number(record.valor_total) || 0);
}

export function sumCents(values: number[]) {
  return values.reduce((sum, value) => sum + cents(value), 0) / 100;
}