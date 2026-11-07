import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { LogOut, ShieldCheck, CheckCircle2, XCircle, Download, FileText, Edit, Trash2, Plus, CalendarDays, Users, ClipboardList, FileSpreadsheet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CURSOS, HORARIOS } from '@/lib/types';
import { getCoordSession, clearCoordSession } from '@/lib/coordSession';
import logoFemaf from '@/assets/logo-femaf.png';

const DIAS = [
  { id: 1, label: 'Segunda' }, { id: 2, label: 'Terça' }, { id: 3, label: 'Quarta' },
  { id: 4, label: 'Quinta' }, { id: 5, label: 'Sexta' }, { id: 6, label: 'Sábado' },
];

function nomeCurso(id: string) {
  return CURSOS.find(c => c.id === id)?.nome || id;
}

export default function Coordenador() {
  const navigate = useNavigate();
  const sess = getCoordSession();

  useEffect(() => {
    if (!sess) navigate('/coordenador/login', { replace: true });
  }, [sess, navigate]);

  if (!sess) return null;

  function sair() {
    clearCoordSession();
    navigate('/coordenador/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 gradient-primary shadow-lg">
        <div className="container flex items-center justify-between h-16 px-4">
          <div className="flex items-center gap-3">
            <img src={logoFemaf} alt="FEMAF" className="h-10 rounded-xl bg-primary-foreground p-1 shadow-md" />
            <div>
              <p className="text-primary-foreground font-bold text-sm leading-tight flex items-center gap-1"><ShieldCheck size={14} /> Coordenação</p>
              <p className="text-primary-foreground/70 text-[11px] truncate max-w-[200px]">{sess.nome}</p>
            </div>
          </div>
          <Button size="sm" variant="ghost" className="text-primary-foreground hover:bg-primary-foreground/10 gap-2" onClick={sair}>
            <LogOut size={16} /> Sair
          </Button>
        </div>
        <div className="container px-4 pb-3 flex gap-2 flex-wrap">
          {sess.cursos.map(c => (
            <Badge key={c} className="bg-primary-foreground/20 text-primary-foreground border-0">{nomeCurso(c)}</Badge>
          ))}
        </div>
      </header>

      <main className="container px-4 py-6 max-w-6xl">
        <Tabs defaultValue="pendentes" className="space-y-4">
          <TabsList className="flex w-full overflow-x-auto justify-start">
            <TabsTrigger value="pendentes" className="gap-1"><ClipboardList size={14} /> Pendentes</TabsTrigger>
            <TabsTrigger value="folha" className="gap-1"><FileSpreadsheet size={14} /> Folha</TabsTrigger>
            <TabsTrigger value="relatorios" className="gap-1"><FileText size={14} /> Relatórios</TabsTrigger>
            <TabsTrigger value="grade" className="gap-1"><CalendarDays size={14} /> Grade</TabsTrigger>
            <TabsTrigger value="profs" className="gap-1"><Users size={14} /> Professores</TabsTrigger>
          </TabsList>

          <TabsContent value="pendentes"><AbaPendentes /></TabsContent>
          <TabsContent value="folha"><AbaFolha /></TabsContent>
          <TabsContent value="relatorios"><AbaRelatorios /></TabsContent>
          <TabsContent value="grade"><AbaGrade /></TabsContent>
          <TabsContent value="profs"><AbaProfessores /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// ============================================================
// PENDENTES (aprovar/rejeitar retroativos)
// ============================================================
function AbaPendentes() {
  const sess = getCoordSession()!;
  const [pend, setPend] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejId, setRejId] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.rpc('coord_pendentes', { p_prof_id: sess.id, p_pin: sess.pin });
    if (error) toast({ title: 'Erro ao carregar', description: error.message, variant: 'destructive' });
    setPend((data as any[]) || []);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  async function aprovar(id: string, acao: 'aprovar' | 'rejeitar', mot?: string) {
    const { error } = await supabase.rpc('coord_aprovar_registro', {
      p_prof_id: sess.id, p_pin: sess.pin, p_registro_id: id, p_acao: acao, p_motivo: mot || null,
    });
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    toast({ title: acao === 'aprovar' ? 'Ponto aprovado' : 'Ponto rejeitado' });
    setRejId(null); setMotivo('');
    load();
  }

  return (
    <Card className="glass-card">
      <CardContent className="p-4 space-y-3">
        <h2 className="text-lg font-bold flex items-center gap-2"><ClipboardList size={18} /> Pontos retroativos pendentes</h2>
        {loading ? <p className="text-muted-foreground text-sm">Carregando…</p> :
         pend.length === 0 ? <p className="text-muted-foreground text-sm text-center py-6">Nenhum pendente 🎉</p> :
         <div className="space-y-2">
           {pend.map(r => (
             <Card key={r.id} className="bg-card/50">
               <CardContent className="p-3 space-y-2">
                 <div className="flex justify-between items-start flex-wrap gap-2">
                   <div>
                     <p className="font-semibold">{r.professor_nome}</p>
                     <p className="text-xs text-muted-foreground">{r.materia_nome} • {r.turma_nome} • {nomeCurso(r.curso_id)}</p>
                     <p className="text-xs">📅 {format(parseISO(r.data), "dd 'de' MMMM yyyy", { locale: ptBR })} • {r.carga_horaria}h • R$ {Number(r.valor_total).toFixed(2)}</p>
                     {r.justificativa && <p className="text-xs italic mt-1">"{r.justificativa}"</p>}
                     {r.anexo_url && (
                       <button
                         type="button"
                         onClick={async () => {
                           const { data, error } = await supabase.functions.invoke('coord-anexo-url', {
                             body: { prof_id: sess.id, pin: sess.pin, registro_id: r.id },
                           });
                           if (error || (data as any)?.error || !(data as any)?.url) {
                             toast({ title: 'Não foi possível abrir o anexo', variant: 'destructive' });
                             return;
                           }
                           window.open((data as any).url, '_blank', 'noopener,noreferrer');
                         }}
                         className="text-xs text-primary underline"
                       >
                         Ver anexo
                       </button>
                     )}
                   </div>
                   <div className="flex gap-1">
                     <Button size="sm" variant="outline" className="gap-1 text-green-600" onClick={() => aprovar(r.id, 'aprovar')}><CheckCircle2 size={14} /> Aprovar</Button>
                     <Button size="sm" variant="outline" className="gap-1 text-destructive" onClick={() => setRejId(r.id)}><XCircle size={14} /> Rejeitar</Button>
                   </div>
                 </div>
               </CardContent>
             </Card>
           ))}
         </div>}

        <Dialog open={!!rejId} onOpenChange={(o) => { if (!o) { setRejId(null); setMotivo(''); } }}>
          <DialogContent>
            <DialogHeader><DialogTitle>Motivo da rejeição</DialogTitle></DialogHeader>
            <Input value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Descreva o motivo (mín. 3 letras)" />
            <DialogFooter>
              <Button variant="outline" onClick={() => { setRejId(null); setMotivo(''); }}>Cancelar</Button>
              <Button className="bg-destructive" disabled={motivo.trim().length < 3} onClick={() => rejId && aprovar(rejId, 'rejeitar', motivo.trim())}>Rejeitar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ============================================================
// FOLHA DE PAGAMENTO (filtro por curso opcional dentro dos cursos do coord)
// ============================================================
function AbaFolha() {
  const sess = getCoordSession()!;
  const [tipo, setTipo] = useState<'mensal' | 'quinzenal'>('mensal');
  const [mes, setMes] = useState(format(new Date(), 'yyyy-MM'));
  const [quinzena, setQuinzena] = useState<'1' | '2'>('1');
  const [cursoFiltro, setCursoFiltro] = useState<string>('todos');
  const [regs, setRegs] = useState<any[]>([]);

  function getRange() {
    const [y, m] = mes.split('-').map(Number);
    if (tipo === 'mensal') {
      return { start: `${mes}-01`, end: `${mes}-${new Date(y, m, 0).getDate()}`, label: format(new Date(y, m - 1), 'MMMM yyyy', { locale: ptBR }) };
    }
    if (quinzena === '1') return { start: `${mes}-01`, end: `${mes}-15`, label: `1ª quinzena ${format(new Date(y, m - 1), 'MMM/yyyy', { locale: ptBR })}` };
    return { start: `${mes}-16`, end: `${mes}-${new Date(y, m, 0).getDate()}`, label: `2ª quinzena ${format(new Date(y, m - 1), 'MMM/yyyy', { locale: ptBR })}` };
  }
  const { start, end, label } = getRange();

  async function load() {
    const { data, error } = await supabase.rpc('coord_registros_periodo', {
      p_prof_id: sess.id, p_pin: sess.pin, p_start: start, p_end: end,
    });
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    setRegs(((data as any[]) || []).filter(r => r.status_aprovacao === 'aprovado'));
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [start, end]);

  const filtered = cursoFiltro === 'todos' ? regs : regs.filter(r => r.curso_id === cursoFiltro);

  // agrupar por professor, somando apenas os horários do(s) curso(s) selecionados
  const folha = useMemo(() => {
    const map = new Map<string, any>();
    for (const r of filtered) {
      const cur = map.get(r.professor_id) || {
        professor_id: r.professor_id, nome: r.professor_nome, cpf: r.cpf || '—',
        chavePix: r.chave_pix || '—', valorHora: Number(r.valor_hora || 0),
        materias: new Set<string>(), datas: new Set<string>(),
        totalHoras: 0, totalValor: 0, cursos: new Set<string>(),
      };
      cur.materias.add(r.materia_nome || '—');
      cur.datas.add(format(parseISO(r.data), 'dd/MM'));
      cur.cursos.add(nomeCurso(r.curso_id));
      cur.totalHoras += r.quantidade_horarios;
      cur.totalValor += Number(r.valor_total);
      map.set(r.professor_id, cur);
    }
    return Array.from(map.values()).map(f => ({
      ...f,
      materias: Array.from(f.materias).join(', '),
      datas: Array.from(f.datas).join(', '),
      cursos: Array.from(f.cursos).join(', '),
    })).sort((a: any, b: any) => a.nome.localeCompare(b.nome));
  }, [filtered]);

  const total = folha.reduce((s: number, f: any) => s + f.totalValor, 0);
  const totalH = folha.reduce((s: number, f: any) => s + f.totalHoras, 0);

  async function exportExcel() {
    const { default: XLSX } = await import('xlsx-js-style');
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet([
      ['FEMAF – FACULDADE DE EDUCAÇÃO MEMORIAL ADELAIDE FRANCO — Folha de Pagamento'],
      [`Período: ${label}  |  ${cursoFiltro === 'todos' ? 'Todos os cursos da coordenação' : nomeCurso(cursoFiltro)}`],
      [],
      ['Nº', 'Professor(a)', 'CPF', 'Curso(s)', 'Disciplina(s)', 'Datas', 'H/A', 'Valor H/A', 'Total', 'PIX'],
      ...folha.map((f: any, i: number) => [i + 1, f.nome, f.cpf, f.cursos, f.materias, f.datas, f.totalHoras, f.valorHora, f.totalValor, f.chavePix]),
      [],
      ['', '', '', '', '', 'TOTAL', totalH, '', total, ''],
    ]);
    ws['!cols'] = [{ wch: 4 }, { wch: 28 }, { wch: 14 }, { wch: 20 }, { wch: 30 }, { wch: 28 }, { wch: 6 }, { wch: 10 }, { wch: 12 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Folha');
    XLSX.writeFile(wb, `Folha-Coord-${cursoFiltro}-${mes}.xlsx`);
  }

  async function exportPDF() {
    const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14); doc.text('FEMAF – FACULDADE DE EDUCAÇÃO MEMORIAL ADELAIDE FRANCO — Folha de Pagamento (Coordenação)', 14, 14);
    doc.setFontSize(10); doc.text(`Período: ${label}  |  ${cursoFiltro === 'todos' ? 'Todos os cursos' : nomeCurso(cursoFiltro)}`, 14, 21);
    autoTable(doc, {
      startY: 26,
      head: [['Nº', 'Professor', 'CPF', 'Curso(s)', 'Disciplinas', 'Datas', 'H/A', 'Valor H/A', 'Total', 'PIX']],
      body: folha.map((f: any, i: number) => [i + 1, f.nome, f.cpf, f.cursos, f.materias, f.datas, f.totalHoras, `R$ ${f.valorHora.toFixed(2)}`, `R$ ${f.totalValor.toFixed(2)}`, f.chavePix]),
      foot: [['', '', '', '', '', 'TOTAL', totalH, '', `R$ ${total.toFixed(2)}`, '']],
      headStyles: { fillColor: [30, 17, 128] }, footStyles: { fillColor: [30, 17, 128] }, bodyStyles: { fontSize: 8 },
    });
    doc.save(`Folha-Coord-${cursoFiltro}-${mes}.pdf`);
  }

  return (
    <Card className="glass-card">
      <CardContent className="p-4 space-y-3">
        <h2 className="text-lg font-bold flex items-center gap-2"><FileSpreadsheet size={18} /> Folha de Pagamento</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><Label className="text-xs">Tipo</Label>
            <Select value={tipo} onValueChange={(v: any) => setTipo(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="mensal">Mensal</SelectItem><SelectItem value="quinzenal">Quinzenal</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label className="text-xs">Mês</Label><Input type="month" value={mes} onChange={e => setMes(e.target.value)} /></div>
          {tipo === 'quinzenal' && (
            <div><Label className="text-xs">Quinzena</Label>
              <Select value={quinzena} onValueChange={(v: any) => setQuinzena(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="1">1ª</SelectItem><SelectItem value="2">2ª</SelectItem></SelectContent>
              </Select>
            </div>
          )}
          <div><Label className="text-xs">Curso</Label>
            <Select value={cursoFiltro} onValueChange={setCursoFiltro}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos meus cursos</SelectItem>
                {sess.cursos.map(c => <SelectItem key={c} value={c}>{nomeCurso(c)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex flex-wrap justify-between items-center gap-2">
          <p className="text-sm text-muted-foreground">{folha.length} professor(es) • {totalH} h/a • R$ {total.toFixed(2)}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="gap-1" disabled={!folha.length} onClick={exportPDF}><FileText size={14} /> PDF</Button>
            <Button size="sm" className="gap-1" disabled={!folha.length} onClick={exportExcel}><Download size={14} /> Excel</Button>
          </div>
        </div>
        {folha.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Professor</TableHead><TableHead>Curso(s)</TableHead><TableHead>Disciplinas</TableHead>
                <TableHead className="text-center">H/A</TableHead><TableHead className="text-right">Total</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {folha.map((f: any) => (
                  <TableRow key={f.professor_id}>
                    <TableCell className="font-medium">{f.nome}</TableCell>
                    <TableCell className="text-xs">{f.cursos}</TableCell>
                    <TableCell className="text-xs max-w-[260px] truncate">{f.materias}</TableCell>
                    <TableCell className="text-center">{f.totalHoras}</TableCell>
                    <TableCell className="text-right font-bold">R$ {f.totalValor.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : <p className="text-center text-muted-foreground py-6 text-sm">Sem registros no período.</p>}
      </CardContent>
    </Card>
  );
}

// ============================================================
// RELATÓRIOS (lista de todos os registros do período, com export)
// ============================================================
function AbaRelatorios() {
  const sess = getCoordSession()!;
  const hoje = new Date();
  const [start, setStart] = useState(format(new Date(hoje.getFullYear(), hoje.getMonth(), 1), 'yyyy-MM-dd'));
  const [end, setEnd] = useState(format(hoje, 'yyyy-MM-dd'));
  const [cursoFiltro, setCursoFiltro] = useState<string>('todos');
  const [regs, setRegs] = useState<any[]>([]);

  async function load() {
    const { data, error } = await supabase.rpc('coord_registros_periodo', {
      p_prof_id: sess.id, p_pin: sess.pin, p_start: start, p_end: end,
    });
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    setRegs((data as any[]) || []);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [start, end]);

  const filtered = cursoFiltro === 'todos' ? regs : regs.filter(r => r.curso_id === cursoFiltro);

  async function exportExcel() {
    const { default: XLSX } = await import('xlsx-js-style');
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(filtered.map(r => ({
      Data: format(parseISO(r.data), 'dd/MM/yyyy'),
      Professor: r.professor_nome, Matéria: r.materia_nome, Turma: r.turma_nome,
      Curso: nomeCurso(r.curso_id), Horários: r.horarios.join(','),
      'H/A': r.quantidade_horarios, Valor: Number(r.valor_total),
      Status: r.status_aprovacao, Retroativo: r.retroativo ? 'Sim' : 'Não',
    })));
    XLSX.utils.book_append_sheet(wb, ws, 'Relatorio');
    XLSX.writeFile(wb, `Relatorio-Coord-${start}_${end}.xlsx`);
  }

  return (
    <Card className="glass-card">
      <CardContent className="p-4 space-y-3">
        <h2 className="text-lg font-bold flex items-center gap-2"><FileText size={18} /> Relatórios</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div><Label className="text-xs">De</Label><Input type="date" value={start} onChange={e => setStart(e.target.value)} /></div>
          <div><Label className="text-xs">Até</Label><Input type="date" value={end} onChange={e => setEnd(e.target.value)} /></div>
          <div><Label className="text-xs">Curso</Label>
            <Select value={cursoFiltro} onValueChange={setCursoFiltro}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos meus cursos</SelectItem>
                {sess.cursos.map(c => <SelectItem key={c} value={c}>{nomeCurso(c)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end"><Button size="sm" className="w-full gap-1" disabled={!filtered.length} onClick={exportExcel}><Download size={14} /> Excel</Button></div>
        </div>
        <p className="text-sm text-muted-foreground">{filtered.length} registro(s)</p>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Data</TableHead><TableHead>Professor</TableHead><TableHead>Matéria</TableHead>
              <TableHead>Turma</TableHead><TableHead>Curso</TableHead>
              <TableHead className="text-center">H/A</TableHead><TableHead className="text-right">Valor</TableHead><TableHead>Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map(r => (
                <TableRow key={r.id}>
                  <TableCell>{format(parseISO(r.data), 'dd/MM/yy')}</TableCell>
                  <TableCell className="text-xs">{r.professor_nome}</TableCell>
                  <TableCell className="text-xs">{r.materia_nome}</TableCell>
                  <TableCell className="text-xs">{r.turma_nome}</TableCell>
                  <TableCell className="text-xs">{nomeCurso(r.curso_id)}</TableCell>
                  <TableCell className="text-center">{r.quantidade_horarios}</TableCell>
                  <TableCell className="text-right">R$ {Number(r.valor_total).toFixed(2)}</TableCell>
                  <TableCell><Badge variant={r.status_aprovacao === 'aprovado' ? 'default' : r.status_aprovacao === 'rejeitado' ? 'destructive' : 'secondary'}>{r.status_aprovacao}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

// ============================================================
// GRADE DE HORÁRIOS (visualizar/editar/excluir)
// ============================================================
function AbaGrade() {
  const sess = getCoordSession()!;
  const [grade, setGrade] = useState<any[]>([]);
  const [profs, setProfs] = useState<any[]>([]);
  const [mats, setMats] = useState<any[]>([]);
  const [turmas, setTurmas] = useState<any[]>([]);
  const [cursoFiltro, setCursoFiltro] = useState<string>('todos');
  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({ id: null, professor_id: '', materia_id: '', turma_id: '', dia_semana: 1, horario_id: 1 });
  const [confirmDel, setConfirmDel] = useState<any | null>(null);

  async function load() {
    const [g, p, m, t] = await Promise.all([
      supabase.rpc('coord_grade', { p_prof_id: sess.id, p_pin: sess.pin }),
      supabase.from('professores').select('id,nome').eq('status', 'ativo').order('nome'),
      supabase.from('materias').select('id,nome,curso_id').order('nome'),
      supabase.from('turmas').select('id,nome,curso_id,turno').in('curso_id', sess.cursos).order('nome'),
    ]);
    if (g.error) toast({ title: 'Erro grade', description: g.error.message, variant: 'destructive' });
    setGrade((g.data as any[]) || []);
    setProfs(p.data || []); setMats(m.data || []); setTurmas(t.data || []);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const filtered = cursoFiltro === 'todos' ? grade : grade.filter(g => g.curso_id === cursoFiltro);
  const matsForm = mats.filter(m => {
    const t = turmas.find(tt => tt.id === form.turma_id);
    return !t ? false : m.curso_id === t.curso_id;
  });

  function openNew() {
    setEditing(null);
    setForm({ id: null, professor_id: '', materia_id: '', turma_id: '', dia_semana: 1, horario_id: 1 });
    setDialog(true);
  }
  function openEdit(h: any) {
    setEditing(h);
    setForm({ id: h.id, professor_id: h.professor_id, materia_id: h.materia_id, turma_id: h.turma_id, dia_semana: h.dia_semana, horario_id: h.horario_id });
    setDialog(true);
  }
  async function save() {
    if (!form.professor_id || !form.materia_id || !form.turma_id) {
      toast({ title: 'Preencha professor, matéria e turma', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.rpc('coord_horario_upsert', {
      p_prof_id: sess.id, p_pin: sess.pin,
      p_id: form.id, p_professor_id: form.professor_id, p_materia_id: form.materia_id,
      p_turma_id: form.turma_id, p_dia_semana: form.dia_semana, p_horario_id: form.horario_id,
    });
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    toast({ title: editing ? 'Aula atualizada' : 'Aula criada' });
    setDialog(false); load();
  }
  async function del(id: string) {
    const { error } = await supabase.rpc('coord_horario_delete', { p_prof_id: sess.id, p_pin: sess.pin, p_id: id });
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    toast({ title: 'Aula removida' });
    setConfirmDel(null); load();
  }

  return (
    <Card className="glass-card">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-lg font-bold flex items-center gap-2"><CalendarDays size={18} /> Grade de Horários</h2>
          <Button size="sm" className="gap-1" onClick={openNew}><Plus size={14} /> Nova aula</Button>
        </div>
        <div className="max-w-[220px]">
          <Label className="text-xs">Curso</Label>
          <Select value={cursoFiltro} onValueChange={setCursoFiltro}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos meus cursos</SelectItem>
              {sess.cursos.map(c => <SelectItem key={c} value={c}>{nomeCurso(c)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Dia</TableHead><TableHead>Horário</TableHead><TableHead>Turma</TableHead>
              <TableHead>Curso</TableHead><TableHead>Matéria</TableHead><TableHead>Professor</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {filtered.map(h => (
                <TableRow key={h.id}>
                  <TableCell>{DIAS.find(d => d.id === h.dia_semana)?.label}</TableCell>
                  <TableCell>{HORARIOS.find(x => x.id === h.horario_id)?.label} ({HORARIOS.find(x => x.id === h.horario_id)?.inicio})</TableCell>
                  <TableCell>{h.turma_nome}</TableCell>
                  <TableCell>{nomeCurso(h.curso_id)}</TableCell>
                  <TableCell>{h.materia_nome}</TableCell>
                  <TableCell>{h.professor_nome}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(h)}><Edit size={14} /></Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setConfirmDel(h)}><Trash2 size={14} /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!filtered.length && <p className="text-center text-muted-foreground py-6 text-sm">Sem aulas cadastradas.</p>}
        </div>

        <Dialog open={dialog} onOpenChange={setDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editing ? 'Editar aula' : 'Nova aula'}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label className="text-xs">Turma</Label>
                <Select value={form.turma_id} onValueChange={(v) => setForm((f: any) => ({ ...f, turma_id: v, materia_id: '' }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{turmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Matéria</Label>
                <Select value={form.materia_id} onValueChange={(v) => setForm((f: any) => ({ ...f, materia_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{matsForm.map(m => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Professor</Label>
                <Select value={form.professor_id} onValueChange={(v) => setForm((f: any) => ({ ...f, professor_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>{profs.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Dia</Label>
                  <Select value={String(form.dia_semana)} onValueChange={(v) => setForm((f: any) => ({ ...f, dia_semana: Number(v) }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{DIAS.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Horário</Label>
                  <Select value={String(form.horario_id)} onValueChange={(v) => setForm((f: any) => ({ ...f, horario_id: Number(v) }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{HORARIOS.map(h => <SelectItem key={h.id} value={String(h.id)}>{h.label} ({h.turno} · {h.inicio})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
              <Button onClick={save}>{editing ? 'Salvar' : 'Criar'}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir aula?</AlertDialogTitle>
              <AlertDialogDescription>
                {confirmDel && <>{confirmDel.materia_nome} — {confirmDel.professor_nome} ({confirmDel.turma_nome})</>}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => confirmDel && del(confirmDel.id)} className="bg-destructive">Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}

// ============================================================
// PROFESSORES dos cursos do coordenador
// ============================================================
function AbaProfessores() {
  const sess = getCoordSession()!;
  const [list, setList] = useState<any[]>([]);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<any>({ nome: '', email: '', telefone: '', chave_pix: '', valor_hora_aula: 0 });

  async function load() {
    const { data, error } = await supabase.rpc('coord_professores', { p_prof_id: sess.id, p_pin: sess.pin });
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    setList((data as any[]) || []);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  function openEdit(p: any) {
    setEditing(p);
    setForm({ nome: p.nome, email: p.email || '', telefone: p.telefone || '', chave_pix: p.chave_pix || '', valor_hora_aula: Number(p.valor_hora_aula || 0) });
  }
  async function save() {
    const { error } = await supabase.rpc('coord_professor_update', {
      p_prof_id: sess.id, p_pin: sess.pin, p_target_id: editing.id,
      p_nome: form.nome, p_email: form.email || null, p_telefone: form.telefone || null,
      p_chave_pix: form.chave_pix || null, p_valor_hora: Number(form.valor_hora_aula),
    });
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    toast({ title: 'Professor atualizado' });
    setEditing(null); load();
  }

  return (
    <Card className="glass-card">
      <CardContent className="p-4 space-y-3">
        <h2 className="text-lg font-bold flex items-center gap-2"><Users size={18} /> Professores dos meus cursos</h2>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Nome</TableHead><TableHead>Email</TableHead><TableHead>Telefone</TableHead>
              <TableHead>Cursos</TableHead><TableHead className="text-right">R$/h</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {list.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nome}</TableCell>
                  <TableCell className="text-xs">{p.email || '—'}</TableCell>
                  <TableCell className="text-xs">{p.telefone || '—'}</TableCell>
                  <TableCell className="text-xs">{(p.cursos || []).map(nomeCurso).join(', ')}</TableCell>
                  <TableCell className="text-right">R$ {Number(p.valor_hora_aula || 0).toFixed(2)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p)}><Edit size={14} /></Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {!list.length && <p className="text-center text-muted-foreground py-6 text-sm">Nenhum professor vinculado.</p>}
        </div>

        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Editar professor</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label className="text-xs">Nome</Label><Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} /></div>
              <div><Label className="text-xs">Email</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div><Label className="text-xs">Telefone</Label><Input value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} /></div>
              <div><Label className="text-xs">Chave PIX</Label><Input value={form.chave_pix} onChange={e => setForm({ ...form, chave_pix: e.target.value })} /></div>
              <div><Label className="text-xs">Valor por hora-aula</Label><Input type="number" step="0.01" value={form.valor_hora_aula} onChange={e => setForm({ ...form, valor_hora_aula: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button onClick={save}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
