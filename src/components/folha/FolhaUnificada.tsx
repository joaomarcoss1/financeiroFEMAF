import { Fragment, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { downloadFemafPdf, downloadFemafXlsx, type FemafColumn, type FemafSection } from '@/lib/exportFemaf';
import { fixedInstallments, hourlyRecordValue, reais, sumCents, type FixedSubject, type PayrollRecord } from '@/lib/payrollCalculations';
import { Download, FileText } from 'lucide-react';

type Person = { id: string; nome: string; cpf: string | null; agencia_bb: string | null; conta_bb: string | null };
type Coordinator = { professor_id: string; cursos: string[]; valor_quinzenal: number };
type Employee = { id: string; nome_completo: string; cpf: string | null; funcao_id: string | null; salario_quinzenal: number; agencia: string | null; conta: string | null; ativo: boolean };
type AdminPayroll = { funcionario_id: string; valor_final: number };
type Row = {
  id: string; nome: string; cpf: string; setor: string; composicao: string; horas: number;
  agencia: string; conta: string; total: number;
  docencia: number; coordenacao: number; administrativo: number;
};
const courseNames: Record<string, string> = { adm: 'Administração', ped: 'Pedagogia', dir: 'Direito' };
// Ordem fixa de exibição e cor de cada setor na folha (hex sem "#", usado tanto no Excel quanto no PDF).
const SETOR_ORDEM = ['Administração', 'Pedagogia', 'Direito', 'Docência', 'Setor Administrativo'];
const SETOR_COR: Record<string, string> = {
  'Administração': '3E6B8A',
  'Pedagogia': '7A4F9E',
  'Direito': '9C3F5C',
  'Docência': '55637A',
  'Setor Administrativo': '4C8C5B',
};
const cols: FemafColumn[] = [
  { header: 'Nº', xlsxWidth: 5, pdfWidth: 9, int: true },
  { header: 'Nome', xlsxWidth: 32, pdfWidth: 38 },
  { header: 'CPF', xlsxWidth: 17, pdfWidth: 22 },
  { header: 'Setor', xlsxWidth: 22, pdfWidth: 27 },
  { header: 'Composição', xlsxWidth: 65, pdfWidth: 92, fontSize: 7 },
  { header: 'H/A', xlsxWidth: 7, pdfWidth: 11, int: true },
  { header: 'Agência BB', xlsxWidth: 14, pdfWidth: 18 },
  { header: 'Conta BB', xlsxWidth: 16, pdfWidth: 19 },
  { header: 'TOTAL A RECEBER', xlsxWidth: 19, pdfWidth: 26, money: true, bold: true },
];

export default function FolhaUnificada() {
  const today = new Date();
  const [month, setMonth] = useState(format(today, 'yyyy-MM'));
  const [half, setHalf] = useState(today.getDate() <= 15 ? '1' : '2');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [year, mon] = month.split('-').map(Number);
  const start = `${month}-${half === '1' ? '01' : '16'}`;
  const end = `${month}-${half === '1' ? '15' : new Date(year, mon, 0).getDate()}`;

  useEffect(() => {
    let alive = true;
    setLoading(true); setError(false); setRows([]);
    async function load() {
      const records: PayrollRecord[] = [];
      for (let from = 0; ; from += 1000) {
        const result = await supabase.from('registros_ponto').select('professor_id,materia_id,turma_id,data,valor_total,quantidade_horarios').eq('status_aprovacao', 'aprovado').gte('data', start).lte('data', end).order('data').range(from, from + 999);
        if (result.error) throw result.error;
        records.push(...((result.data || []) as PayrollRecord[]));
        if (!result.data || result.data.length < 1000) break;
      }
      const [prof, mat, link, coord, turmas, funcs, payroll, roles] = await Promise.all([
        supabase.from('professores').select('id,nome,cpf,agencia_bb,conta_bb'),
        supabase.from('materias').select('id,nome,curso_id,pagamento_tipo,valor_fixo_semestral,pagamento_inicio,pagamento_fim,horas_fixas_quinzenais'),
        supabase.from('professor_materias').select('professor_id,materia_id'),
        supabase.from('coordenadores').select('professor_id,cursos,valor_quinzenal'),
        supabase.from('turmas').select('id,curso_id'),
        supabase.from('funcionarios_administrativos').select('id,nome_completo,cpf,funcao_id,salario_quinzenal,agencia,conta,ativo'),
        supabase.from('folha_administrativo_apoio').select('funcionario_id,valor_final').eq('periodo_inicio', start).eq('periodo_fim', end),
        supabase.from('funcoes_administrativas').select('id,nome'),
      ]);
      const results = [prof, mat, link, coord, turmas, funcs, payroll, roles];
      const failed = results.find(result => result.error);
      if (failed?.error) throw failed.error;
      const subjects = new Map((mat.data as FixedSubject[]).map(m => [m.id, m]));
      const classroom = new Map((turmas.data || []).map(t => [t.id, t.curso_id]));
      const connections = new Map<string, Set<string>>();
      for (const relation of link.data || []) {
        if (!connections.has(relation.professor_id)) connections.set(relation.professor_id, new Set());
        connections.get(relation.professor_id)?.add(relation.materia_id);
      }
      const coordinators = new Map((coord.data as Coordinator[]).map(c => [c.professor_id, c]));
      const next: Row[] = [];
      for (const person of prof.data as Person[]) {
        const entries: string[] = [];
        const amounts = new Map<string, number>();
        let hours = 0;
        for (const record of records.filter(r => r.professor_id === person.id)) {
          const value = hourlyRecordValue(record, subjects);
          if (!value) continue;
          const course = classroom.get(record.turma_id) || subjects.get(record.materia_id)?.curso_id || 'outros';
          amounts.set(course, sumCents([amounts.get(course) || 0, value]));
          hours += Number(record.quantidade_horarios) || 0;
        }
        const fixed: { course: string; amount: number }[] = [];
        for (const subjectId of connections.get(person.id) || []) {
          const subject = subjects.get(subjectId);
          if (!subject) continue;
          for (const installment of fixedInstallments(subject, start, end)) {
            fixed.push({ course: subject.curso_id, amount: installment.value });
            hours += installment.hours;
            entries.push(`${subject.nome} — ${installment.recurring ? `${installment.hours} H/A fixas por quinzena` : `parcela fixa ${installment.index}/${installment.count}`}: R$ ${installment.value.toFixed(2)}`);
          }
        }
        for (const [course, value] of amounts) entries.unshift(`${courseNames[course] || course} (aulas): R$ ${value.toFixed(2)}`);
        const coordinator = coordinators.get(person.id);
        const coordPay = coordinator ? reais(Number(coordinator.valor_quinzenal) || 0) : 0;
        if (coordinator) entries.push(`Coordenação (${coordinator.cursos.map(c => courseNames[c] || c).join(', ')}): R$ ${coordPay.toFixed(2)}`);
        const docencia = sumCents([...amounts.values(), ...fixed.map(f => f.amount)]);
        const total = sumCents([docencia, coordPay]);
        if (!entries.length) continue;
        const course = [...amounts.keys(), ...fixed.map(f => f.course), ...(coordinator?.cursos || [])][0];
        next.push({
          id: person.id, nome: person.nome, cpf: person.cpf || '—', setor: courseNames[course] || 'Docência',
          composicao: entries.join(' | '), horas: hours, agencia: person.agencia_bb || '—', conta: person.conta_bb || '—',
          total, docencia, coordenacao: coordPay, administrativo: 0,
        });
      }
      const rolesMap = new Map((roles.data || []).map(role => [role.id, role.nome]));
      const payrollMap = new Map((payroll.data as AdminPayroll[]).map(pay => [pay.funcionario_id, pay.valor_final]));
      for (const employee of funcs.data as Employee[]) {
        if (!employee.ativo && !payrollMap.has(employee.id)) continue;
        const closed = payrollMap.has(employee.id);
        const total = reais(Number(closed ? payrollMap.get(employee.id) : employee.salario_quinzenal) || 0);
        next.push({
          id: employee.id, nome: employee.nome_completo, cpf: employee.cpf || '—', setor: 'Setor Administrativo',
          composicao: `${rolesMap.get(employee.funcao_id || '') || 'Administrativo'} — quinzena: R$ ${total.toFixed(2)}${closed ? '' : ' (prévia)'}`,
          horas: 0, agencia: employee.agencia || '—', conta: employee.conta || '—',
          total, docencia: 0, coordenacao: 0, administrativo: total,
        });
      }
      if (alive) setRows(next.sort((a, b) => SETOR_ORDEM.indexOf(a.setor) - SETOR_ORDEM.indexOf(b.setor) || a.nome.localeCompare(b.nome)));
    }
    load().catch(() => { if (alive) { setError(true); toast({ title: 'Não foi possível calcular a folha', description: 'Confira a conexão e tente novamente. Nenhum arquivo incompleto será gerado.', variant: 'destructive' }); } }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [start, end]);

  const total = useMemo(() => sumCents(rows.map(r => r.total)), [rows]);

  // Agrupa em seções por setor (ordem fixa, só entram as que têm gente) —
  // a numeração da coluna Nº é contínua entre as seções, como na folha
  // antiga que serve de referência visual.
  const grouped = useMemo(() => {
    const bySetor = new Map<string, Row[]>();
    for (const r of rows) {
      if (!bySetor.has(r.setor)) bySetor.set(r.setor, []);
      bySetor.get(r.setor)!.push(r);
    }
    let n = 0;
    const sections: FemafSection[] = [];
    for (const setor of SETOR_ORDEM) {
      const setorRows = bySetor.get(setor);
      if (!setorRows?.length) continue;
      const subtotal = sumCents(setorRows.map(r => r.total));
      sections.push({
        label: setor,
        colorHex: SETOR_COR[setor] || '555555',
        countLabel: `${setorRows.length} pessoa(s)`,
        subtotal,
        rows: setorRows.map(r => [++n, r.nome, r.cpf, r.setor, r.composicao, r.horas || '—', r.agencia, r.conta, r.total]),
      });
    }
    return sections;
  }, [rows]);

  const resumo = useMemo(() => {
    const totalDocencia = sumCents(rows.map(r => r.docencia));
    const totalCoordenacao = sumCents(rows.map(r => r.coordenacao));
    const totalAdministrativo = sumCents(rows.map(r => r.administrativo));
    return [
      ...grouped.map(s => ({ label: s.label, value: s.subtotal, isMoney: true })),
      { label: 'Total docência (aulas)', value: totalDocencia, isMoney: true },
      { label: 'Total coordenação', value: totalCoordenacao, isMoney: true },
      { label: 'Total administrativo/apoio', value: totalAdministrativo, isMoney: true },
      { label: 'TOTAL GERAL DA FOLHA', value: total, isMoney: true },
    ];
  }, [grouped, rows, total]);

  const report = {
    subtitulo: 'Folha de Pagamento Unificada — Docentes, Coordenação, Administrativo, Apoio e Serviços Gerais',
    periodoLabel: `${half}ª quinzena — ${month}`,
    columns: cols,
    rows: [] as (string | number)[][],
    sections: grouped,
    totalLabel: 'TOTAL GERAL DA FOLHA',
    totalValue: total,
    resumo,
    filename: `Folha-Unificada-FEMAF-${month}-Q${half}`,
  };

  return <div className="space-y-4">
    <h1 className="text-3xl font-display font-bold">Folha de Pagamento Unificada</h1>
    <div className="flex flex-wrap items-end gap-3">
      <div><Label htmlFor="unified-month">Mês</Label><Input id="unified-month" type="month" value={month} onChange={e => setMonth(e.target.value)} /></div>
      <div><Label htmlFor="unified-half">Quinzena</Label><select id="unified-half" className="flex h-10 rounded-md border border-input bg-background px-3 text-sm" value={half} onChange={e => setHalf(e.target.value)}><option value="1">1ª (01–15)</option><option value="2">2ª (16–fim)</option></select></div>
      <div className="flex gap-2"><Button variant="outline" disabled={loading || error || !rows.length} onClick={() => downloadFemafPdf(report)}><FileText className="mr-2 h-4 w-4" />PDF</Button><Button disabled={loading || error || !rows.length} onClick={() => downloadFemafXlsx(report)}><Download className="mr-2 h-4 w-4" />Excel</Button></div>
    </div>
    <p className="text-sm font-semibold">{loading ? 'Calculando…' : error ? 'Não foi possível carregar os valores.' : `${rows.length} pessoa(s) · R$ ${total.toFixed(2)}`}</p>
    {!loading && !error && (
      <div className="overflow-x-auto rounded-xl border border-border/60">
        <table className="w-full min-w-[900px] text-sm">
          <thead><tr className="border-b border-border text-left bg-muted/40">{cols.slice(1).map(c => <th className="p-2" key={c.header}>{c.header}</th>)}</tr></thead>
          <tbody>
            {grouped.map((section) => (
              <Fragment key={section.label}>
                <tr>
                  <td colSpan={cols.length - 1} className="p-2 font-bold text-white" style={{ backgroundColor: `#${section.colorHex}` }}>
                    {section.label.toUpperCase()} — {section.countLabel} · R$ {section.subtotal.toFixed(2)}
                  </td>
                </tr>
                {section.rows.map((r) => (
                  <tr key={r[0] as number} className="border-b border-border" style={{ backgroundColor: `#${section.colorHex}1A` }}>
                    <td className="p-2 font-medium">{r[1]}</td>
                    <td className="p-2">{r[2]}</td>
                    <td className="p-2">{r[3]}</td>
                    <td className="p-2 text-xs">{r[4]}</td>
                    <td className="p-2">{r[5]}</td>
                    <td className="p-2">{r[6]}</td>
                    <td className="p-2">{r[7]}</td>
                    <td className="p-2 text-right font-bold">R$ {Number(r[8]).toFixed(2)}</td>
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>;
}
