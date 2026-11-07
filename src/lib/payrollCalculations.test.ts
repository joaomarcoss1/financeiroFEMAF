import { describe, expect, it } from 'vitest';
import { fixedInstallments, hourlyRecordValue, sumCents, type FixedSubject } from './payrollCalculations';

const subject: FixedSubject = { id: 'm', nome: 'Estágio', curso_id: 'ped', pagamento_tipo: 'fixo_semestral', valor_fixo_semestral: 800, pagamento_inicio: '2026-09-01', pagamento_fim: '2026-12-31' };
describe('payroll calculations', () => {
  it('pays six recurring hours since October without an automatic end', () => {
    const recurring = { ...subject, pagamento_tipo: 'fixo_quinzenal', valor_fixo_semestral: 313.86,
      horas_fixas_quinzenais: 6, pagamento_inicio: '2026-10-01', pagamento_fim: null };
    expect(fixedInstallments(recurring, '2026-09-01', '2026-09-30')).toEqual([]);
    expect(fixedInstallments(recurring, '2026-10-01', '2026-10-15')).toMatchObject([{ value: 313.86, hours: 6, recurring: true }]);
    expect(sumCents(fixedInstallments(recurring, '2026-10-01', '2026-10-31').map(x => x.value))).toBe(627.72);
    expect(fixedInstallments(recurring, '2027-02-16', '2027-02-28')).toMatchObject([{ value: 313.86, hours: 6 }]);
    const record = { professor_id: 'p', materia_id: 'm', turma_id: 't', data: '2026-10-05', quantidade_horarios: 2, valor_total: 104.62 };
    expect(hourlyRecordValue(record, new Map([['m', recurring]]))).toBe(0);
    expect(hourlyRecordValue({ ...record, data: '2026-09-30' }, new Map([['m', recurring]]))).toBe(104.62);
    expect(sumCents([200, ...fixedInstallments(recurring, '2026-10-01', '2026-10-15').map(x => x.value)])).toBe(513.86);
    expect(fixedInstallments({ ...recurring, pagamento_fim: '2026-11-15' }, '2026-11-16', '2026-11-30')).toEqual([]);
  });
  it('pays one installment per half-month, including a fixed-only teacher', () => {
    expect(fixedInstallments(subject, '2026-09-16', '2026-09-30')).toMatchObject([{ index: 2, count: 8, value: 100 }]);
    expect(sumCents(fixedInstallments(subject, '2026-09-01', '2026-09-30').map(x => x.value))).toBe(200);
  });
  it('includes the half-month containing the starting date and balances cents', () => {
    const extension = { ...subject, valor_fixo_semestral: 600.01, pagamento_inicio: '2026-09-30', pagamento_fim: '2026-12-15' };
    const installments = fixedInstallments(extension, '2026-09-01', '2026-12-31');
    expect(installments).toHaveLength(6);
    expect(installments[0].start).toBe('2026-09-16');
    expect(sumCents(installments.map(x => x.value))).toBe(600.01);
  });
  it('adds multiple fixed installments to hourly and coordinator pay without double counting', () => {
    const extension = { ...subject, valor_fixo_semestral: 600, pagamento_inicio: '2026-09-30', pagamento_fim: '2026-12-15' };
    const fixed = [subject, extension].flatMap(item => fixedInstallments(item, '2026-09-16', '2026-09-30'));
    expect(fixed.map(item => item.value)).toEqual([100, 100]);
    expect(sumCents([271.56, ...fixed.map(item => item.value), 1000])).toBe(1471.56);
    expect(sumCents(fixedInstallments(subject, '2026-09-01', '2026-09-30').map(item => item.value))).toBe(200);
  });
  it('never doubles active fixed-subject attendance but preserves earlier hourly pay', () => {
    const record = { professor_id: 'p', materia_id: 'm', turma_id: 't', data: '2026-09-20', quantidade_horarios: 2, valor_total: 80 };
    expect(hourlyRecordValue(record, new Map([['m', subject]]))).toBe(0);
    expect(hourlyRecordValue({ ...record, data: '2026-08-20' }, new Map([['m', subject]]))).toBe(80);
    expect(hourlyRecordValue({ ...record, materia_id: 'other' }, new Map([['m', subject]]))).toBe(80);
  });
  it('never zeroes hourly pay for a fixed contract missing an end date (regression: silent pay loss)', () => {
    const openEnded: FixedSubject = { ...subject, pagamento_fim: null };
    const record = { professor_id: 'p', materia_id: 'm', turma_id: 't', data: '2026-10-05', quantidade_horarios: 2, valor_total: 80 };
    expect(hourlyRecordValue(record, new Map([['m', openEnded]]))).toBe(80);
    expect(fixedInstallments(openEnded, '2026-09-01', '2026-12-31')).toEqual([]);
  });
  it('zeroes the whole half-month a partial fixed contract starts in, not just the exact start date (regression: double pay)', () => {
    const midMonth: FixedSubject = { ...subject, pagamento_inicio: '2026-09-20' };
    const beforeExactStart = { professor_id: 'p', materia_id: 'm', turma_id: 't', data: '2026-09-17', quantidade_horarios: 2, valor_total: 80 };
    // 2026-09-17 is before the exact pagamento_inicio but inside the same
    // half-month (16-30) that fixedInstallments already pays in full.
    expect(hourlyRecordValue(beforeExactStart, new Map([['m', midMonth]]))).toBe(0);
    expect(fixedInstallments(midMonth, '2026-09-01', '2026-09-30')).toMatchObject([{ start: '2026-09-16', end: '2026-09-30' }]);
  });
  it('pays a flat recurring value per quinzena when the total is an exact multiple (CEJUSC: 6h x R$53.26)', () => {
    const cejusc: FixedSubject = {
      id: 'cejusc', nome: 'CEJUSC', curso_id: 'dir', pagamento_tipo: 'fixo_semestral',
      valor_fixo_semestral: 1597.80, pagamento_inicio: '2026-10-01', pagamento_fim: '2026-12-15',
    };
    const installments = fixedInstallments(cejusc, '2026-10-01', '2026-12-15');
    expect(installments).toHaveLength(5);
    expect(installments.map(i => i.value)).toEqual([319.56, 319.56, 319.56, 319.56, 319.56]);
  });
});