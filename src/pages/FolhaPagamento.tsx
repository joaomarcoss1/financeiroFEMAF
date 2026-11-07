import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Download, FileSpreadsheet, FileText, Eye } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAppSettings } from '@/hooks/useAppSettings';
import { downloadFemafXlsx, downloadFemafPdf, type FemafColumn } from '@/lib/exportFemaf';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GraduationCap, Briefcase } from 'lucide-react';
import FolhaAdministrativo from '@/components/folha/FolhaAdministrativo';
import FolhaUnificada from '@/components/folha/FolhaUnificada';
import { fixedInstallments, hourlyRecordValue, sumCents, type FixedSubject } from '@/lib/payrollCalculations';

export default function FolhaPagamentoPage() {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="unificada" className="w-full">
        <TabsList className="grid grid-cols-3 w-full max-w-xl">
          <TabsTrigger value="unificada" className="gap-1.5">Unificada</TabsTrigger>
          <TabsTrigger value="docentes" className="gap-1.5"><GraduationCap size={14} /> Docentes</TabsTrigger>
          <TabsTrigger value="adm" className="gap-1.5"><Briefcase size={14} /> Adm/Apoio</TabsTrigger>
        </TabsList>
        <TabsContent value="unificada" className="mt-4"><FolhaUnificada /></TabsContent>
        <TabsContent value="docentes" className="mt-4"><FolhaDocentes /></TabsContent>
        <TabsContent value="adm" className="mt-4"><FolhaAdministrativo /></TabsContent>
      </Tabs>
    </div>
  );
}

function FolhaDocentes() {
  const { cursos: CURSOS } = useAppSettings();
  // Por padrão, abre na QUINZENA atual (1ª se hoje ≤ 15, senão 2ª).
  const hoje = new Date();
  const [tipo, setTipo] = useState<'mensal' | 'quinzenal'>('quinzenal');
  const [mes, setMes] = useState(format(hoje, 'yyyy-MM'));
  const [quinzena, setQuinzena] = useState<'1' | '2'>(hoje.getDate() <= 15 ? '1' : '2');
  const [cursoFiltro, setCursoFiltro] = useState<string>('todos');
  const [showPreview, setShowPreview] = useState(false);

  const [profs, setProfs] = useState<any[]>([]);
  const [registros, setRegistros] = useState<any[]>([]);
  const [matsMap, setMatsMap] = useState<Record<string, string>>({});
  const [turmasMap, setTurmasMap] = useState<Record<string, { nome: string; curso_id: string }>>({});
  const [subjects, setSubjects] = useState<Map<string, FixedSubject>>(new Map());
  const [fixedLinks, setFixedLinks] = useState<{ professor_id: string; materia_id: string }[]>([]);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);

  function getDateRange() {
    const [y, m] = mes.split('-').map(Number);
    if (tipo === 'mensal') {
      const start = `${mes}-01`;
      const end = `${mes}-${new Date(y, m, 0).getDate()}`;
      return { start, end, label: format(new Date(y, m - 1), 'MMMM yyyy', { locale: ptBR }) };
    }
    if (quinzena === '1') {
      return { start: `${mes}-01`, end: `${mes}-15`, label: `1ª quinzena - ${format(new Date(y, m - 1), 'MMM/yyyy', { locale: ptBR })}` };
    }
    return { start: `${mes}-16`, end: `${mes}-${new Date(y, m, 0).getDate()}`, label: `2ª quinzena - ${format(new Date(y, m - 1), 'MMM/yyyy', { locale: ptBR })}` };
  }

  const { start, end, label: periodoLabel } = getDateRange();

  useEffect(() => { loadData(); /* eslint-disable-next-line */ }, [start, end]);

  async function loadData() {
    setLoading(true);
    setLoadError(false);
    setRegistros([]);
    // Busca paginada apenas dentro do período (evita o limite de 1000 do Supabase em períodos grandes)
    const PAGE = 1000;
    let from = 0;
    const allRegs: any[] = [];
    while (true) {
      const { data, error } = await supabase
        .from('registros_ponto')
        .select('*')
        .eq('status_aprovacao', 'aprovado')
        .gte('data', start)
        .lte('data', end)
        .order('data')
        .range(from, from + PAGE - 1);
      if (error) { setLoadError(true); setLoading(false); return; }
      allRegs.push(...(data || []));
      if (!data || data.length < PAGE) break;
      from += PAGE;
    }
    const [{ data: p, error: pError }, { data: m, error: mError }, { data: t, error: tError }, { data: links, error: linkError }] = await Promise.all([
      supabase.from('professores').select('id,nome,cpf,email,telefone,valor_hora_aula,chave_pix,agencia_bb,conta_bb,status,created_at'),
      supabase.from('materias').select('id,nome,curso_id,pagamento_tipo,valor_fixo_semestral,pagamento_inicio,pagamento_fim,horas_fixas_quinzenais'),
      supabase.from('turmas').select('id, nome, curso_id'),
      supabase.from('professor_materias').select('professor_id,materia_id'),
    ]);
    if (pError || mError || tError || linkError) { setLoadError(true); setLoading(false); return; }
    setProfs(p || []);
    setRegistros(allRegs);
    setMatsMap(Object.fromEntries((m || []).map((x: any) => [x.id, x.nome])));
    setSubjects(new Map(((m || []) as FixedSubject[]).map(x => [x.id, x])));
    setFixedLinks(links || []);
    setTurmasMap(Object.fromEntries((t || []).map((x: any) => [x.id, { nome: x.nome, curso_id: x.curso_id }])));
    setLoading(false);
  }

  // Filtra os registros pelo curso (via turma)
  const filtered = cursoFiltro === 'todos'
    ? registros
    : registros.filter(r => turmasMap[r.turma_id]?.curso_id === cursoFiltro);

  const folha = profs.map(p => {
    const regs = filtered.filter(r => r.professor_id === p.id);
    const parcelas = fixedLinks.filter(link => link.professor_id === p.id).flatMap(link => {
      const subject = subjects.get(link.materia_id);
      if (!subject || (cursoFiltro !== 'todos' && subject.curso_id !== cursoFiltro)) return [];
      return fixedInstallments(subject, start, end).map(installment => ({ subject, installment }));
    });
    if (regs.length === 0 && parcelas.length === 0) return null;
    const materias = [...new Set([...regs.map(r => matsMap[r.materia_id] || '—'), ...parcelas.map(item => item.subject.nome)])].join(', ');
    const datas = [...new Set(regs.map(r => format(parseISO(r.data), 'dd/MM')))].join(', ');
    const hourly = regs.filter(r => hourlyRecordValue(r, subjects) !== 0);
    const totalHoras = hourly.reduce((s: number, r: any) => s + Number(r.quantidade_horarios || 0), 0) + parcelas.reduce((s, item) => s + item.installment.hours, 0);
    const totalValor = sumCents([...hourly.map(r => hourlyRecordValue(r, subjects)), ...parcelas.map(item => item.installment.value)]);
    const details = parcelas.map(item => `${item.subject.nome} (${item.installment.recurring ? `${item.installment.hours} H/A fixas por quinzena` : `${item.installment.index}/${item.installment.count}`}): R$ ${item.installment.value.toFixed(2)}`).join('; ');
    return { nome: p.nome, cpf: p.cpf || '—', materias, datas, totalHoras, totalValor, details, chavePix: p.chave_pix || '—', valorHora: Number(p.valor_hora_aula), agenciaBB: (p as any).agencia_bb || '—', contaBB: (p as any).conta_bb || '—' };
  }).filter(Boolean) as any[];

  const totalGeral = sumCents(folha.map(f => f.totalValor));
  const totalHA = folha.reduce((s, f) => s + f.totalHoras, 0);
  const filenameSuffix = `${cursoFiltro === 'todos' ? 'Geral' : cursoFiltro.toUpperCase()}-${mes}${tipo === 'quinzenal' ? `-Q${quinzena}` : ''}`;

  const colunasPix: FemafColumn[] = [
    { header: 'Nº', xlsxWidth: 5, pdfWidth: 8, align: 'center' },
    { header: 'Professor(a)', xlsxWidth: 30, pdfWidth: 40 },
    { header: 'CPF', xlsxWidth: 16, pdfWidth: 22, align: 'center' },
    { header: 'Disciplina(s) / Parcela fixa', xlsxWidth: 48, pdfWidth: 55 },
    { header: 'Datas das Aulas', xlsxWidth: 32, pdfWidth: 40, align: 'center', fontSize: 7 },
    { header: 'H/A', xlsxWidth: 6, pdfWidth: 10, align: 'center', int: true },
    { header: 'Valor H/A', xlsxWidth: 13, pdfWidth: 20, align: 'right', money: true },
    { header: 'Total Bruto', xlsxWidth: 16, pdfWidth: 23, align: 'right', money: true, bold: true },
    { header: 'Chave PIX', xlsxWidth: 28, pdfWidth: 40, fontSize: 7 },
  ];
  const colunasBB: FemafColumn[] = [
    { header: 'Nº', xlsxWidth: 5, pdfWidth: 8, align: 'center' },
    { header: 'Professor(a)', xlsxWidth: 30, pdfWidth: 38 },
    { header: 'CPF', xlsxWidth: 16, pdfWidth: 22, align: 'center' },
    { header: 'Disciplina(s) / Parcela fixa', xlsxWidth: 48, pdfWidth: 48 },
    { header: 'Datas das Aulas', xlsxWidth: 30, pdfWidth: 34, align: 'center', fontSize: 7 },
    { header: 'H/A', xlsxWidth: 6, pdfWidth: 10, align: 'center', int: true },
    { header: 'Valor H/A', xlsxWidth: 13, pdfWidth: 20, align: 'right', money: true },
    { header: 'Total Bruto', xlsxWidth: 16, pdfWidth: 22, align: 'right', money: true, bold: true },
    { header: 'Agência', xlsxWidth: 12, pdfWidth: 18, align: 'center' },
    { header: 'Conta', xlsxWidth: 14, pdfWidth: 22, align: 'center' },
  ];
  const linhasPix = folha.map((f, i) => [i + 1, f.nome, f.cpf, [f.materias, f.details].filter(Boolean).join(' — '), f.datas, f.totalHoras, f.valorHora, f.totalValor, f.chavePix]);
  const linhasBB = folha.map((f, i) => [i + 1, f.nome, f.cpf, [f.materias, f.details].filter(Boolean).join(' — '), f.datas, f.totalHoras, f.valorHora, f.totalValor, f.agenciaBB, f.contaBB]);

  const resumo = [
    { label: 'Total de professores na folha', value: folha.length },
    { label: 'Total de horas-aula', value: `${totalHA} h/a` },
    { label: 'Valor médio por professor', value: folha.length ? Number((totalGeral / folha.length).toFixed(2)) : 0, isMoney: true },
    { label: 'Valor total bruto da folha', value: Number(totalGeral), isMoney: true },
  ];
  const assinaturas: [string, string] = ['Coordenação Administrativa', 'Diretoria Financeira'];

  function gerarPlanilha() {
    downloadFemafXlsx({
      subtitulo: 'Folha de Pagamento - Corpo Docente',
      periodoLabel,
      columns: colunasPix,
      rows: linhasPix,
      totalLabel: 'TOTAL GERAL',
      totalValue: totalGeral,
      totalExtra: `${folha.length} prof.`,
      resumo,
      assinaturas,
      filename: `Folha-Pagamento-FEMAF-${filenameSuffix}`,
    });
  }

  function gerarPDF() {
    downloadFemafPdf({
      subtitulo: 'Folha de Pagamento - Corpo Docente',
      periodoLabel,
      columns: colunasPix,
      rows: linhasPix,
      totalValue: totalGeral,
      totalExtra: `${folha.length} prof.`,
      assinaturas,
      filename: `Folha-Pagamento-FEMAF-${filenameSuffix}`,
    });
  }

  function gerarPlanilhaBB() {
    downloadFemafXlsx({
      subtitulo: 'Folha de Pagamento BANCO DO BRASIL - Corpo Docente',
      periodoLabel,
      columns: colunasBB,
      rows: linhasBB,
      totalLabel: 'TOTAL GERAL',
      totalValue: totalGeral,
      totalExtra: `${folha.length} prof.`,
      assinaturas,
      filename: `Folha-Pagamento-BB-FEMAF-${filenameSuffix}`,
    });
  }

  function gerarPDFBB() {
    downloadFemafPdf({
      subtitulo: 'Folha de Pagamento BANCO DO BRASIL - Corpo Docente',
      periodoLabel,
      columns: colunasBB,
      rows: linhasBB,
      totalValue: totalGeral,
      totalExtra: `${folha.length} prof.`,
      assinaturas,
      filename: `Folha-Pagamento-BB-FEMAF-${filenameSuffix}`,
    });
  }

  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
          <FileSpreadsheet size={20} className="text-primary" />
        </div>
        <div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight">Folha de Pagamento</h1>
          <p className="text-muted-foreground text-sm">Gere folhas em planilha</p>
        </div>
      </motion.div>

      <Card className="glass-card">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Tipo</Label>
              <Select value={tipo} onValueChange={(v: any) => setTipo(v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensal">Mensal</SelectItem>
                  <SelectItem value="quinzenal">Quinzenal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Mês</Label>
              <Input type="month" value={mes} onChange={e => setMes(e.target.value)} className="mt-1" />
            </div>
          </div>
          {tipo === 'quinzenal' && (
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Quinzena</Label>
              <Select value={quinzena} onValueChange={(v: any) => setQuinzena(v)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1ª Quinzena (01 a 15)</SelectItem>
                  <SelectItem value="2">2ª Quinzena (16 ao fim)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">Filtrar por curso</Label>
            <Select value={cursoFiltro} onValueChange={setCursoFiltro}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Folha geral (todos os cursos)</SelectItem>
                {CURSOS.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground mt-1">
              Quando um curso é selecionado, entram apenas as aulas e parcelas fixas desse curso.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2">
        <p className="text-sm text-muted-foreground">{loading ? 'Calculando…' : loadError ? 'Não foi possível carregar a folha.' : `${folha.length} professor(es) • R$ ${totalGeral.toFixed(2)}`}</p>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)} className="gap-1" disabled={loading || loadError || folha.length === 0}>
            <Eye size={14} /> {showPreview ? 'Ocultar' : 'Visualizar'}
          </Button>
          <Button variant="outline" size="sm" onClick={gerarPDF} className="gap-1" disabled={loading || loadError || folha.length === 0}>
            <FileText size={14} /> PDF PIX
          </Button>
          <Button size="sm" onClick={gerarPlanilha} className="gap-1" disabled={loading || loadError || folha.length === 0}>
            <Download size={14} /> Excel PIX
          </Button>
          <Button variant="outline" size="sm" onClick={gerarPDFBB} className="gap-1 border-primary/40 text-primary hover:bg-primary/10" disabled={loading || loadError || folha.length === 0}>
            <FileText size={14} /> PDF BB
          </Button>
          <Button size="sm" onClick={gerarPlanilhaBB} className="gap-1 bg-primary/90 hover:bg-primary" disabled={loading || loadError || folha.length === 0}>
            <Download size={14} /> Excel BB
          </Button>
        </div>
      </div>


      {showPreview && folha.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
          {/* Mobile: cards */}
          <div className="md:hidden space-y-2">
            {folha.map((f, i) => (
              <Card key={i} className="glass-card">
                <CardContent className="p-3 space-y-1.5">
                  <div className="flex items-start justify-between gap-2 min-w-0">
                    <p className="font-medium truncate flex-1">{f.nome}</p>
                    <p className="font-bold text-primary shrink-0">R$ {f.totalValor.toFixed(2)}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{f.materias}</p>
                  {f.details && <p className="text-xs text-muted-foreground">Parcelas fixas: {f.details}</p>}
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border pt-1.5">
                    <span>{f.totalHoras}h/a • {f.datas}</span>
                    <span className="truncate max-w-[140px]">{f.chavePix}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
            <Card className="bg-muted/30">
              <CardContent className="p-3 flex items-center justify-between font-bold">
                <span>TOTAL GERAL</span>
                <span className="text-primary">R$ {totalGeral.toFixed(2)}</span>
              </CardContent>
            </Card>
          </div>

          {/* Desktop: table */}
          <Card className="glass-card overflow-x-auto hidden md:block">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Professor</TableHead>
                    <TableHead>Disciplina(s)</TableHead>
                    <TableHead>Datas</TableHead>
                    <TableHead className="text-center">Horas</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>PIX</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {folha.map((f, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{f.nome}</TableCell>
                      <TableCell className="text-xs max-w-[260px] break-words">{f.materias}{f.details && <span className="block text-muted-foreground">Parcelas fixas: {f.details}</span>}</TableCell>
                      <TableCell className="text-xs max-w-[200px]">{f.datas}</TableCell>
                      <TableCell className="text-center">{f.totalHoras}h/a</TableCell>
                      <TableCell className="text-right font-bold">R$ {f.totalValor.toFixed(2)}</TableCell>
                      <TableCell className="text-xs">{f.chavePix}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/30">
                    <TableCell colSpan={4} className="font-bold text-right">TOTAL GERAL</TableCell>
                    <TableCell className="text-right font-bold text-primary">R$ {totalGeral.toFixed(2)}</TableCell>
                    <TableCell />
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {!loading && !loadError && folha.length === 0 && <p className="text-center text-muted-foreground py-10">Nenhum pagamento no período selecionado</p>}
    </div>
  );
}
