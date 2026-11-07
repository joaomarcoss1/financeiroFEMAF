import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CalendarCheck, Plus, Play, History, AlertTriangle, CheckCircle2, X, DollarSign, RefreshCw, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import { HORARIOS, CURSOS } from '@/lib/types';

type OverrideRow = {
  id: string; date: string; type: string; title: string;
  description: string | null; scope_type: string; scope_id: string | null; is_active: boolean;
};
type CalRow = { data: string; tipo: string; descricao: string | null };
type PreviewRow = {
  professor_id: string; professor_nome: string;
  turma_id: string; turma_nome: string; curso_id: string;
  materia_id: string | null; materia_nome: string | null;
  horario_id: number; dia_semana: number; ja_existe: boolean;
};
type AjusteRow = {
  id: string; data: string; tipo_registro: string; origem: string | null;
  professor_id: string; turma_id: string; materia_id: string | null;
  horarios: number[]; quantidade_horarios: number; carga_horaria: number; valor_total: number;
  observacao: string | null; status_aprovacao: string;
  competencia_pagamento: string | null; created_at: string;
};
type ProfessorPagamento = { id: string; nome: string; valor_hora_aula: number | null };

const TIPO_LABEL: Record<string,string> = {
  feriado: 'Feriado', ponto_facultativo: 'Ponto Facultativo', suspensao_remunerada: 'Suspensão Remunerada',
  feriado_remunerado: 'Feriado Remunerado',
  hora_aula_extra: 'Hora-Aula Extra', ajuste_retroativo: 'Ajuste Retroativo', normal: 'Normal',
};

export default function FeriadosAjustes() {
  const [tab, setTab] = useState('feriados');

  // dados auxiliares
  const [professores, setProfessores] = useState<ProfessorPagamento[]>([]);
  const [turmas, setTurmas] = useState<{ id: string; nome: string; curso_id: string }[]>([]);
  const [materias, setMaterias] = useState<{ id: string; nome: string }[]>([]);

  // aba 1
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [feriadosCal, setFeriadosCal] = useState<CalRow[]>([]);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [overrideForm, setOverrideForm] = useState({
    date: new Date().toISOString().slice(0,10),
    type: 'ponto_facultativo', title: '', description: '',
    scope_type: 'instituicao', scope_id: '' as string | '',
  });

  // aba 2
  const [procData, setProcData] = useState(new Date().toISOString().slice(0,10));
  const [procTipo, setProcTipo] = useState<'feriado_remunerado'|'ponto_facultativo'>('feriado_remunerado');
  const [procTitulo, setProcTitulo] = useState('');
  const [procScope, setProcScope] = useState<'instituicao'|'curso'|'turma'|'professor'>('instituicao');
  const [procScopeId, setProcScopeId] = useState<string>('');
  const [preview, setPreview] = useState<PreviewRow[] | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [generating, setGenerating] = useState(false);

  // aba 3
  const [extraForm, setExtraForm] = useState({
    professor_id: '', turma_id: '', materia_id: '', data: new Date().toISOString().slice(0,10),
    horarios: [] as number[], motivo: '', competencia_origem: '', competencia_pagamento: '',
    observacao: '', tipo: 'hora_aula_extra' as 'hora_aula_extra'|'ajuste_retroativo',
  });

  // aba 4
  const [ajustes, setAjustes] = useState<AjusteRow[]>([]);
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');

  // aba 5
  const [valorHoraEdits, setValorHoraEdits] = useState<Record<string, string>>({});
  const [minutosPagamento, setMinutosPagamento] = useState(60);
  const [settingsData, setSettingsData] = useState<Record<string, any>>({});
  const [savingPagamento, setSavingPagamento] = useState<string | null>(null);
  const [savingMinutos, setSavingMinutos] = useState(false);
  const [recalculating, setRecalculating] = useState(false);

  useEffect(() => { loadBase(); }, []);

  async function loadBase() {
    const [p, t, m, ov, cal, aj, st] = await Promise.all([
      supabase.from('professores').select('id,nome,valor_hora_aula').eq('status','ativo').order('nome'),
      supabase.from('turmas').select('id,nome,curso_id').order('nome'),
      supabase.from('materias').select('id,nome').order('nome'),
      (supabase as any).from('academic_day_overrides').select('*').order('date', { ascending: false }),
      supabase.from('calendario_academico').select('data,tipo,descricao').in('tipo',['feriado','recesso']).order('data', { ascending: false }).limit(200),
      (supabase as any).from('registros_ponto').select('id,data,tipo_registro,origem,professor_id,turma_id,materia_id,horarios,quantidade_horarios,carga_horaria,valor_total,observacao,status_aprovacao,competencia_pagamento,created_at').neq('tipo_registro','normal').order('created_at',{ascending:false}).limit(500),
      (supabase as any).from('app_settings').select('data').eq('id','global').maybeSingle(),
    ]);
    const profs = (p.data||[]) as ProfessorPagamento[];
    const rawSettings = (st.data?.data || {}) as Record<string, any>;
    setProfessores(profs);
    setTurmas((t.data||[]) as any);
    setMaterias((m.data||[]) as any);
    setOverrides((ov.data||[]) as any);
    setFeriadosCal((cal.data||[]) as any);
    setAjustes((aj.data||[]) as any);
    setValorHoraEdits(Object.fromEntries(profs.map(prof => [prof.id, String(Number(prof.valor_hora_aula || 0).toFixed(2))])));
    setSettingsData(rawSettings);
    setMinutosPagamento(Number(rawSettings.minutos_pagamento_hora_aula || 60));
  }

  // ---------- ABA 1 ----------
  async function salvarOverride() {
    if (!overrideForm.title.trim()) return toast({ title: 'Informe o título', variant: 'destructive' });
    const payload: any = {
      date: overrideForm.date, type: overrideForm.type,
      title: overrideForm.title.trim(), description: overrideForm.description || null,
      scope_type: overrideForm.scope_type,
      scope_id: overrideForm.scope_type === 'instituicao' ? null : (overrideForm.scope_id || null),
      is_active: true,
    };
    const { error } = await (supabase as any).from('academic_day_overrides').insert(payload);
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    toast({ title: 'Ponto facultativo cadastrado com sucesso.' });
    setOverrideOpen(false);
    setOverrideForm({ ...overrideForm, title: '', description: '' });
    loadBase();
  }

  async function toggleOverride(o: OverrideRow) {
    await (supabase as any).from('academic_day_overrides').update({ is_active: !o.is_active }).eq('id', o.id);
    loadBase();
  }

  function abrirProcessamento(date: string, tipo: 'feriado_remunerado'|'ponto_facultativo', titulo: string) {
    setProcData(date); setProcTipo(tipo); setProcTitulo(titulo);
    setProcScope('instituicao'); setProcScopeId(''); setPreview(null);
    setTab('processar');
  }

  // ---------- ABA 2 ----------
  async function verificarGrade() {
    setLoadingPreview(true); setPreview(null);
    const { data, error } = await (supabase as any).rpc('processar_data_preview', {
      p_data: procData,
      p_scope_type: procScope,
      p_scope_id: procScope === 'instituicao' ? null : (procScopeId || null),
    });
    setLoadingPreview(false);
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    setPreview((data||[]) as any);
    if (!data || data.length === 0) toast({ title: 'Nenhuma aula encontrada para esta data.' });
  }

  async function gerarRegistros() {
    if (!preview || preview.length === 0) return;
    const aGerar = preview.filter(p => !p.ja_existe).length;
    if (!confirm(`Gerar ${aGerar} registro(s) remunerado(s) para ${procData}?`)) return;
    setGenerating(true);
    const { data, error } = await (supabase as any).rpc('processar_data_gerar', {
      p_data: procData, p_tipo: procTipo, p_origem: 'calendario_academico',
      p_titulo: procTitulo, p_scope_type: procScope,
      p_scope_id: procScope === 'instituicao' ? null : (procScopeId || null),
    });
    setGenerating(false);
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    const resultado = data as any;
    toast({ title: 'Registros remunerados gerados com sucesso.', description: `Criados: ${resultado.criados} • Ignorados: ${resultado.ignorados}` });
    await verificarGrade();
    await loadBase();
  }

  // ---------- ABA 3 ----------
  async function lancarExtra() {
    const f = extraForm;
    if (!f.professor_id || !f.turma_id || !f.data || f.horarios.length === 0) {
      return toast({ title: 'Preencha professor, turma, data e ao menos um horário', variant: 'destructive' });
    }
    if (f.motivo.trim().length < 3) return toast({ title: 'Informe o motivo do ajuste', variant: 'destructive' });
    const { data, error } = await (supabase as any).rpc('lancar_hora_aula_extra', {
      p_professor_id: f.professor_id, p_materia_id: f.materia_id || null, p_turma_id: f.turma_id,
      p_data: f.data, p_horarios: f.horarios, p_motivo: f.motivo,
      p_competencia_origem: f.competencia_origem || null,
      p_competencia_pagamento: f.competencia_pagamento || null,
      p_observacao: f.observacao || null, p_tipo: f.tipo,
    });
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    toast({ title: 'Hora-aula extra adicionada com sucesso.' });
    setExtraForm({ ...f, horarios: [], motivo: '', observacao: '' });
    await loadBase();
    setTab('historico');
  }

  function toggleExtraHorario(id: number) {
    setExtraForm(f => ({
      ...f, horarios: f.horarios.includes(id) ? f.horarios.filter(x=>x!==id) : [...f.horarios, id].sort((a,b)=>a-b),
    }));
  }

  // ---------- ABA 4 ----------
  async function cancelarAjuste(id: string) {
    const motivo = prompt('Motivo do cancelamento:');
    if (!motivo) return;
    const { error } = await (supabase as any).rpc('cancelar_ajuste', { p_id: id, p_motivo: motivo });
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    toast({ title: 'Ajuste cancelado com sucesso.' });
    loadBase();
  }

  async function salvarValorProfessor(professorId: string) {
    const novoValor = Number(String(valorHoraEdits[professorId] || '').replace(',', '.'));
    if (!Number.isFinite(novoValor) || novoValor < 0) {
      return toast({ title: 'Informe um valor válido', variant: 'destructive' });
    }
    setSavingPagamento(professorId);
    const { error } = await (supabase as any)
      .from('professores')
      .update({ valor_hora_aula: novoValor })
      .eq('id', professorId)
      .eq('status', 'ativo');
    setSavingPagamento(null);
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    toast({ title: 'Valor de hora-aula atualizado com sucesso.' });
    await loadBase();
  }

  async function salvarMinutosPagamento() {
    const valor = Math.max(1, Number(minutosPagamento || 60));
    setSavingMinutos(true);
    const { error } = await (supabase as any)
      .from('app_settings')
      .upsert({
        id: 'global',
        data: { ...settingsData, minutos_pagamento_hora_aula: valor },
        updated_at: new Date().toISOString(),
      });
    setSavingMinutos(false);
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    setSettingsData(s => ({ ...s, minutos_pagamento_hora_aula: valor }));
    toast({ title: 'Configuração de pagamento salva.' });
  }

  async function recalcularAjustesPagamento() {
    if (!confirm('Recalcular todos os ajustes de pagamento? Registros normais e rejeitados não serão alterados.')) return;
    setRecalculating(true);
    // Recálculo feito em uma única transação no servidor (RPC admin-only),
    // em vez de N updates paralelos disparados pelo navegador.
    const { data, error } = await (supabase as any).rpc('recalcular_ajustes_pagamento', {
      p_minutos_pagamento: Number(minutosPagamento || 60),
    });
    setRecalculating(false);
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    toast({ title: 'Ajustes recalculados com sucesso.', description: `${(data as any)?.atualizados ?? 0} registro(s) atualizado(s).` });
    await loadBase();
  }

  const profMap = useMemo(() => new Map(professores.map(p=>[p.id,p.nome])), [professores]);
  const turmaMap = useMemo(() => new Map(turmas.map(t=>[t.id,t.nome])), [turmas]);
  const matMap = useMemo(() => new Map(materias.map(m=>[m.id,m.nome])), [materias]);

  const ajustesFiltrados = ajustes.filter(a => filtroTipo === 'todos' ? true : a.tipo_registro === filtroTipo);
  const eventosLista = useMemo(() => {
    const a = feriadosCal.map(f => ({
      kind: 'cal' as const, date: f.data, type: f.tipo, title: f.descricao || 'Feriado', id: 'cal-'+f.data, is_active: true,
    }));
    const b = overrides.map(o => ({
      kind: 'override' as const, date: o.date, type: o.type, title: o.title, id: o.id, is_active: o.is_active, raw: o,
    }));
    return [...a, ...b].sort((x,y) => y.date.localeCompare(x.date));
  }, [feriadosCal, overrides]);

  return (
    <div className="container py-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2">
        <CalendarCheck className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight">Feriados e Ajustes</h1>
          <p className="text-sm text-muted-foreground">Geração remunerada para feriados/pontos facultativos e ajustes retroativos de folha.</p>
        </div>
      </motion.div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-2 sm:grid-cols-5 w-full">
          <TabsTrigger value="feriados">Feriados/Facultativos</TabsTrigger>
          <TabsTrigger value="processar">Processamento</TabsTrigger>
          <TabsTrigger value="extra">Hora-Aula Extra</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
          <TabsTrigger value="pagamento">Pagamento</TabsTrigger>
        </TabsList>

        {/* ABA 1 */}
        <TabsContent value="feriados" className="space-y-4">
          <div className="flex justify-end">
            <Button onClick={() => setOverrideOpen(true)}><Plus className="h-4 w-4 mr-2" /> Novo Ponto Facultativo</Button>
          </div>
          {eventosLista.length === 0 && (
            <Card className="glass-card"><CardContent className="py-8 text-center text-muted-foreground">Nenhum registro encontrado.</CardContent></Card>
          )}
          <div className="grid gap-3">
            {eventosLista.map(ev => (
              <motion.div key={ev.id} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}}>
                <Card className="glass-card-hover">
                  <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold">{new Date(ev.date+'T00:00').toLocaleDateString('pt-BR')}</span>
                        <Badge variant="outline">{TIPO_LABEL[ev.type] || ev.type}</Badge>
                        <Badge variant="secondary">{ev.kind === 'cal' ? 'Calendário' : 'Manual'}</Badge>
                        {!ev.is_active && <Badge variant="destructive">Inativo</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">{ev.title}</p>
                    </div>
                    <div className="flex gap-2">
                      {ev.kind === 'override' && (
                        <Button size="sm" variant="outline" onClick={() => toggleOverride(ev.raw!)}>
                          {ev.is_active ? 'Desativar' : 'Ativar'}
                        </Button>
                      )}
                      <Button size="sm" onClick={() => abrirProcessamento(
                        ev.date,
                        ev.type === 'ponto_facultativo' ? 'ponto_facultativo' : 'feriado_remunerado',
                        ev.title,
                      )}>
                        <Play className="h-4 w-4 mr-1" /> Processar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </TabsContent>

        {/* ABA 2 */}
        <TabsContent value="processar" className="space-y-4">
          <Card className="glass-card"><CardContent className="p-4 space-y-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div><Label>Data</Label><Input type="date" value={procData} onChange={e=>setProcData(e.target.value)} /></div>
              <div>
                <Label>Tipo</Label>
                <Select value={procTipo} onValueChange={v=>setProcTipo(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="feriado_remunerado">Feriado Remunerado</SelectItem>
                    <SelectItem value="ponto_facultativo">Ponto Facultativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Título</Label><Input value={procTitulo} onChange={e=>setProcTitulo(e.target.value)} placeholder="Ex.: Corpus Christi" /></div>
              <div>
                <Label>Abrangência</Label>
                <Select value={procScope} onValueChange={v=>{setProcScope(v as any); setProcScopeId('');}}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instituicao">Toda a instituição</SelectItem>
                    <SelectItem value="curso">Curso</SelectItem>
                    <SelectItem value="turma">Turma</SelectItem>
                    <SelectItem value="professor">Professor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {procScope !== 'instituicao' && (
                <div className="lg:col-span-2">
                  <Label>{procScope === 'curso' ? 'Curso' : procScope === 'turma' ? 'Turma' : 'Professor'}</Label>
                  <Select value={procScopeId} onValueChange={setProcScopeId}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      {procScope === 'curso' && CURSOS.map(c=><SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                      {procScope === 'turma' && turmas.map(t=><SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                      {procScope === 'professor' && professores.map(p=><SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={verificarGrade} disabled={loadingPreview}>{loadingPreview ? 'Verificando...' : 'Verificar grade do dia'}</Button>
              {preview && preview.some(p=>!p.ja_existe) && (
                <Button variant="default" onClick={gerarRegistros} disabled={generating}>
                  {generating ? 'Gerando...' : 'Gerar registros remunerados'}
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" /> Confira a prévia antes de gerar os registros. Nada é gerado sem confirmação.
            </p>
          </CardContent></Card>

          {preview && (
            <Card className="glass-card"><CardContent className="p-0 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Professor</TableHead>
                    <TableHead>Turma</TableHead>
                    <TableHead>Disciplina</TableHead>
                    <TableHead>Horário</TableHead>
                    <TableHead>Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {preview.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhuma aula encontrada para esta data.</TableCell></TableRow>
                  )}
                  {preview.map((r,i)=>{
                    const h = HORARIOS.find(x=>x.id===r.horario_id);
                    return (
                      <TableRow key={i}>
                        <TableCell>{r.professor_nome}</TableCell>
                        <TableCell>{r.turma_nome}</TableCell>
                        <TableCell>{r.materia_nome || '—'}</TableCell>
                        <TableCell>{h ? `${h.label} (${h.inicio}-${h.fim})` : r.horario_id}</TableCell>
                        <TableCell>
                          {r.ja_existe
                            ? <Badge variant="secondary">Já existe</Badge>
                            : <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">Pronto para gerar</Badge>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent></Card>
          )}
        </TabsContent>

        {/* ABA 3 */}
        <TabsContent value="extra" className="space-y-4">
          <Card className="glass-card"><CardContent className="p-4 space-y-4">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <Label>Professor</Label>
                <Select value={extraForm.professor_id} onValueChange={v=>setExtraForm({...extraForm, professor_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{professores.map(p=><SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Turma</Label>
                <Select value={extraForm.turma_id} onValueChange={v=>setExtraForm({...extraForm, turma_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{turmas.map(t=><SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Disciplina</Label>
                <Select value={extraForm.materia_id} onValueChange={v=>setExtraForm({...extraForm, materia_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
                  <SelectContent>{materias.map(m=><SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Data da aula</Label><Input type="date" value={extraForm.data} onChange={e=>setExtraForm({...extraForm, data: e.target.value})} /></div>
              <div>
                <Label>Tipo</Label>
                <Select value={extraForm.tipo} onValueChange={v=>setExtraForm({...extraForm, tipo: v as any})}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="hora_aula_extra">Hora-Aula Extra</SelectItem>
                    <SelectItem value="ajuste_retroativo">Ajuste Retroativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Competência de pagamento</Label>
                <Input type="date" value={extraForm.competencia_pagamento} onChange={e=>setExtraForm({...extraForm, competencia_pagamento: e.target.value})} />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <Label>Horários</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {HORARIOS.map(h => (
                    <button key={h.id} type="button" onClick={()=>toggleExtraHorario(h.id)}
                      className={`px-3 py-1.5 text-xs rounded-md border transition-colors ${extraForm.horarios.includes(h.id) ? 'bg-primary text-primary-foreground border-primary' : 'bg-background hover:bg-accent'}`}>
                      {h.label} {h.inicio}-{h.fim}
                    </button>
                  ))}
                </div>
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <Label>Motivo *</Label>
                <Textarea value={extraForm.motivo} onChange={e=>setExtraForm({...extraForm, motivo: e.target.value})} placeholder="Ex.: Professor esqueceu de bater ponto e aula não foi contabilizada na folha anterior." />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <Label>Observação</Label>
                <Input value={extraForm.observacao} onChange={e=>setExtraForm({...extraForm, observacao: e.target.value})} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={lancarExtra}><Plus className="h-4 w-4 mr-1" /> Lançar</Button>
            </div>
          </CardContent></Card>
        </TabsContent>

        {/* ABA 4 */}
        <TabsContent value="historico" className="space-y-4">
          <Card className="glass-card"><CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <History className="h-4 w-4" />
              <Label>Tipo:</Label>
              <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos</SelectItem>
                  <SelectItem value="feriado_remunerado">Feriado Remunerado</SelectItem>
                  <SelectItem value="ponto_facultativo">Ponto Facultativo</SelectItem>
                  <SelectItem value="hora_aula_extra">Hora-Aula Extra</SelectItem>
                  <SelectItem value="ajuste_retroativo">Ajuste Retroativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Professor</TableHead>
                    <TableHead>Turma</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Horários</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Comp. Pgto</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ajustesFiltrados.length === 0 && (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-6">Nenhum registro encontrado.</TableCell></TableRow>
                  )}
                  {ajustesFiltrados.map(a => (
                    <TableRow key={a.id}>
                      <TableCell>{new Date(a.data+'T00:00').toLocaleDateString('pt-BR')}</TableCell>
                      <TableCell>{profMap.get(a.professor_id) || '—'}</TableCell>
                      <TableCell>{turmaMap.get(a.turma_id) || '—'}</TableCell>
                      <TableCell><Badge variant="outline">{TIPO_LABEL[a.tipo_registro] || a.tipo_registro}</Badge></TableCell>
                      <TableCell className="text-xs">{a.horarios.join(', ')}</TableCell>
                      <TableCell>R$ {Number(a.valor_total||0).toFixed(2)}</TableCell>
                      <TableCell>
                        {a.status_aprovacao === 'rejeitado'
                          ? <Badge variant="destructive">Cancelado</Badge>
                          : <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" />Aprovado</Badge>}
                      </TableCell>
                      <TableCell className="text-xs">{a.competencia_pagamento ? new Date(a.competencia_pagamento+'T00:00').toLocaleDateString('pt-BR') : '—'}</TableCell>
                      <TableCell>
                        {a.status_aprovacao !== 'rejeitado' && (
                          <Button size="sm" variant="ghost" onClick={()=>cancelarAjuste(a.id)} title="Cancelar"><X className="h-4 w-4" /></Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent></Card>
        </TabsContent>

        {/* ABA 5 */}
        <TabsContent value="pagamento" className="space-y-4">
          <Card className="glass-card">
            <CardContent className="p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary" />
                    <h2 className="font-semibold">Configurações de Pagamento</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">Cada horário é pago como uma hora-aula cheia, conforme o valor individual do professor.</p>
                </div>
                <Button variant="outline" onClick={recalcularAjustesPagamento} disabled={recalculating}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${recalculating ? 'animate-spin' : ''}`} />
                  {recalculating ? 'Recalculando...' : 'Recalcular ajustes de pagamento'}
                </Button>
              </div>

              <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end rounded-lg border p-3 bg-muted/20">
                <div>
                  <Label>Minutos equivalentes por hora-aula para pagamento</Label>
                  <Input
                    type="number"
                    min="1"
                    value={minutosPagamento}
                    onChange={e => setMinutosPagamento(Number(e.target.value) || 60)}
                    className="mt-1"
                  />
                  <p className="text-xs text-muted-foreground mt-1">Afeta somente a carga horária registrada. O valor pago continua sendo quantidade de horários × valor da hora-aula.</p>
                </div>
                <Button onClick={salvarMinutosPagamento} disabled={savingMinutos}>
                  <Save className="h-4 w-4 mr-2" /> {savingMinutos ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardContent className="p-0 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Professor</TableHead>
                    <TableHead>Valor atual</TableHead>
                    <TableHead>Novo valor</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {professores.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Nenhum professor ativo encontrado.</TableCell></TableRow>
                  )}
                  {professores.map(professor => (
                    <TableRow key={professor.id}>
                      <TableCell className="font-medium">{professor.nome}</TableCell>
                      <TableCell>R$ {Number(professor.valor_hora_aula || 0).toFixed(2)}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={valorHoraEdits[professor.id] ?? ''}
                          onChange={e => setValorHoraEdits(v => ({ ...v, [professor.id]: e.target.value }))}
                          className="w-32"
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" onClick={() => salvarValorProfessor(professor.id)} disabled={savingPagamento === professor.id}>
                          <Save className="h-4 w-4 mr-1" /> {savingPagamento === professor.id ? 'Salvando...' : 'Salvar'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={overrideOpen} onOpenChange={setOverrideOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Novo Ponto Facultativo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Data</Label><Input type="date" value={overrideForm.date} onChange={e=>setOverrideForm({...overrideForm, date: e.target.value})} /></div>
            <div>
              <Label>Tipo</Label>
              <Select value={overrideForm.type} onValueChange={v=>setOverrideForm({...overrideForm, type: v})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ponto_facultativo">Ponto Facultativo</SelectItem>
                  <SelectItem value="feriado">Feriado</SelectItem>
                  <SelectItem value="suspensao_remunerada">Suspensão Remunerada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Título</Label><Input value={overrideForm.title} onChange={e=>setOverrideForm({...overrideForm, title: e.target.value})} /></div>
            <div><Label>Descrição</Label><Textarea value={overrideForm.description} onChange={e=>setOverrideForm({...overrideForm, description: e.target.value})} /></div>
            <div>
              <Label>Abrangência</Label>
              <Select value={overrideForm.scope_type} onValueChange={v=>setOverrideForm({...overrideForm, scope_type: v, scope_id: ''})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="instituicao">Toda a instituição</SelectItem>
                  <SelectItem value="curso">Curso</SelectItem>
                  <SelectItem value="turma">Turma</SelectItem>
                  <SelectItem value="professor">Professor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {overrideForm.scope_type !== 'instituicao' && (
              <div>
                <Label>Alvo</Label>
                <Select value={overrideForm.scope_id} onValueChange={v=>setOverrideForm({...overrideForm, scope_id: v})}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {overrideForm.scope_type === 'curso' && CURSOS.map(c=><SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                    {overrideForm.scope_type === 'turma' && turmas.map(t=><SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                    {overrideForm.scope_type === 'professor' && professores.map(p=><SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={()=>setOverrideOpen(false)}>Cancelar</Button>
              <Button onClick={salvarOverride}>Cadastrar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
