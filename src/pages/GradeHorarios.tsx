import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Edit, Trash2, CalendarDays } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAppSettings } from '@/hooks/useAppSettings';

const DIAS = [
  { id: 1, label: 'Segunda', short: 'Seg' },
  { id: 2, label: 'Terça', short: 'Ter' },
  { id: 3, label: 'Quarta', short: 'Qua' },
  { id: 4, label: 'Quinta', short: 'Qui' },
  { id: 5, label: 'Sexta', short: 'Sex' },
  { id: 6, label: 'Sábado', short: 'Sáb' },
];

interface HorarioAula {
  id: string;
  professor_id: string;
  materia_id: string;
  turma_id: string;
  dia_semana: number;
  horario_id: number;
}
interface Prof { id: string; nome: string }
interface Mat { id: string; nome: string; curso_id: string }
interface Tur { id: string; nome: string; curso_id: string; turno: string | null }

export default function GradeHorarios() {
  const { cursos: CURSOS, horarios: HORARIOS } = useAppSettings();
  const [grade, setGrade] = useState<HorarioAula[]>([]);
  const [profs, setProfs] = useState<Prof[]>([]);
  const [mats, setMats] = useState<Mat[]>([]);
  const [turmas, setTurmas] = useState<Tur[]>([]);
  const [cursoFiltro, setCursoFiltro] = useState<string>('todos');
  const [turmaFiltro, setTurmaFiltro] = useState<string>('todas');
  const [loading, setLoading] = useState(true);

  const [dialog, setDialog] = useState(false);
  const [editing, setEditing] = useState<HorarioAula | null>(null);
  const [form, setForm] = useState({ professor_id: '', materia_id: '', turma_id: '', dia_semana: 1, horario_id: 1 });
  const [confirmDel, setConfirmDel] = useState<HorarioAula | null>(null);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: g }, { data: p }, { data: m }, { data: t }] = await Promise.all([
      supabase.from('horarios_aula').select('*'),
      supabase.from('professores').select('id,nome').eq('status', 'ativo').order('nome'),
      supabase.from('materias').select('id,nome,curso_id').order('nome'),
      supabase.from('turmas').select('id,nome,curso_id,turno').order('nome'),
    ]);
    setGrade((g as any) || []);
    setProfs((p as any) || []);
    setMats((m as any) || []);
    setTurmas((t as any) || []);
    setLoading(false);
  }

  const turmasFiltradas = useMemo(
    () => cursoFiltro === 'todos' ? turmas : turmas.filter(t => t.curso_id === cursoFiltro),
    [turmas, cursoFiltro]
  );

  const turmaSel = turmaFiltro !== 'todas' ? turmas.find(t => t.id === turmaFiltro) : null;

  const horariosVisiveis = useMemo(() => {
    if (turmaSel?.turno?.toLowerCase().includes('vesper')) return HORARIOS.filter(h => h.turno === 'vespertino');
    if (turmaSel?.turno?.toLowerCase().includes('not')) return HORARIOS.filter(h => h.turno === 'noturno');
    return HORARIOS;
  }, [turmaSel]);

  const gradeFiltrada = useMemo(() => {
    return grade.filter(g => {
      if (turmaFiltro !== 'todas' && g.turma_id !== turmaFiltro) return false;
      if (cursoFiltro !== 'todos') {
        const t = turmas.find(tt => tt.id === g.turma_id);
        if (!t || t.curso_id !== cursoFiltro) return false;
      }
      return true;
    });
  }, [grade, turmaFiltro, cursoFiltro, turmas]);

  function cellItems(dia: number, horario: number) {
    return gradeFiltrada.filter(g => g.dia_semana === dia && g.horario_id === horario);
  }

  function profNome(id: string) { return profs.find(p => p.id === id)?.nome || '—'; }
  function matNome(id: string) { return mats.find(m => m.id === id)?.nome || '—'; }
  function turNome(id: string) { return turmas.find(t => t.id === id)?.nome || '—'; }

  function openNew(dia?: number, horario?: number) {
    setEditing(null);
    setForm({
      professor_id: '',
      materia_id: '',
      turma_id: turmaFiltro !== 'todas' ? turmaFiltro : '',
      dia_semana: dia ?? 1,
      horario_id: horario ?? (horariosVisiveis[0]?.id ?? 1),
    });
    setDialog(true);
  }

  function openEdit(h: HorarioAula) {
    setEditing(h);
    setForm({ ...h });
    setDialog(true);
  }

  async function save() {
    if (!form.professor_id || !form.materia_id || !form.turma_id) {
      toast({ title: 'Preencha professor, matéria e turma', variant: 'destructive' });
      return;
    }
    if (editing) {
      const { error } = await supabase.from('horarios_aula').update(form).eq('id', editing.id);
      if (error) return toast({ title: 'Erro ao atualizar', description: error.message, variant: 'destructive' });
      toast({ title: 'Horário atualizado' });
    } else {
      const { error } = await supabase.from('horarios_aula').insert(form);
      if (error) return toast({ title: 'Erro ao criar', description: error.message, variant: 'destructive' });
      toast({ title: 'Horário criado' });
    }
    setDialog(false);
    load();
  }

  async function del(id: string) {
    const { error } = await supabase.from('horarios_aula').delete().eq('id', id);
    if (error) return toast({ title: 'Erro ao excluir', description: error.message, variant: 'destructive' });
    toast({ title: 'Horário removido' });
    setConfirmDel(null);
    load();
  }

  const matsForm = mats.filter(m => {
    const t = turmas.find(tt => tt.id === form.turma_id);
    return !t ? true : m.curso_id === t.curso_id;
  });

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight flex items-center gap-2.5"><CalendarDays className="h-7 w-7 sm:h-8 sm:w-8 text-primary" /> Grade de Horários</h1>
          <p className="text-sm text-muted-foreground">Visualize e edite as aulas por dia, horário e turma</p>
        </div>
        <Button onClick={() => openNew()} className="gap-2"><Plus size={16} /> Nova aula</Button>
      </motion.div>

      <Card className="glass-card">
        <CardContent className="p-4 flex flex-wrap gap-3">
          <div className="min-w-[180px]">
            <label className="text-xs text-muted-foreground">Curso</label>
            <Select value={cursoFiltro} onValueChange={(v) => { setCursoFiltro(v); setTurmaFiltro('todas'); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {CURSOS.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[200px]">
            <label className="text-xs text-muted-foreground">Turma</label>
            <Select value={turmaFiltro} onValueChange={setTurmaFiltro}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas as turmas</SelectItem>
                {turmasFiltradas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="ml-auto self-end text-sm text-muted-foreground">
            {gradeFiltrada.length} aula(s) na visão atual
          </div>
        </CardContent>
      </Card>

      <Card className="glass-card overflow-hidden">
        <CardContent className="p-0 overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando…</div>
          ) : (
            <table className="w-full text-sm min-w-[760px]">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-3 py-2 text-left w-32">Horário</th>
                  {DIAS.map(d => <th key={d.id} className="px-3 py-2 text-left">{d.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {horariosVisiveis.map(h => (
                  <tr key={h.id} className="border-t border-border/50">
                    <td className="px-3 py-2 align-top">
                      <div className="font-semibold">{h.label}</div>
                      <div className="text-xs text-muted-foreground">{h.inicio}–{h.fim}</div>
                      <Badge variant="secondary" className="mt-1 text-[10px]">{h.turno}</Badge>
                    </td>
                    {DIAS.map(d => {
                      const items = cellItems(d.id, h.id);
                      return (
                        <td key={d.id} className="px-2 py-2 align-top min-w-[160px]">
                          <div className="space-y-1.5">
                            {items.map(item => (
                              <div key={item.id} className="group rounded-lg border border-border/60 bg-card/60 p-2 hover:border-primary/50 transition-colors">
                                <div className="text-xs font-semibold line-clamp-2">{matNome(item.materia_id)}</div>
                                <div className="text-[11px] text-muted-foreground line-clamp-1">{profNome(item.professor_id)}</div>
                                {turmaFiltro === 'todas' && (
                                  <div className="text-[10px] text-primary line-clamp-1">{turNome(item.turma_id)}</div>
                                )}
                                <div className="flex gap-1 mt-1 opacity-70 group-hover:opacity-100 transition-opacity">
                                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEdit(item)}><Edit size={12} /></Button>
                                  <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => setConfirmDel(item)}><Trash2 size={12} /></Button>
                                </div>
                              </div>
                            ))}
                            <button
                              onClick={() => openNew(d.id, h.id)}
                              className="w-full text-[11px] text-muted-foreground hover:text-primary border border-dashed border-border/50 rounded-lg py-1 transition-colors"
                            >
                              + adicionar
                            </button>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* Editor */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar aula' : 'Nova aula'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted-foreground">Turma</label>
              <Select value={form.turma_id} onValueChange={(v) => setForm(f => ({ ...f, turma_id: v, materia_id: '' }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar turma" /></SelectTrigger>
                <SelectContent>
                  {turmas.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Matéria</label>
              <Select value={form.materia_id} onValueChange={(v) => setForm(f => ({ ...f, materia_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar matéria" /></SelectTrigger>
                <SelectContent>
                  {matsForm.map(m => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Professor</label>
              <Select value={form.professor_id} onValueChange={(v) => setForm(f => ({ ...f, professor_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar professor" /></SelectTrigger>
                <SelectContent>
                  {profs.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Dia da semana</label>
                <Select value={String(form.dia_semana)} onValueChange={(v) => setForm(f => ({ ...f, dia_semana: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DIAS.map(d => <SelectItem key={d.id} value={String(d.id)}>{d.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Horário</label>
                <Select value={String(form.horario_id)} onValueChange={(v) => setForm(f => ({ ...f, horario_id: Number(v) }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {HORARIOS.map(h => <SelectItem key={h.id} value={String(h.id)}>{h.label} ({h.turno} · {h.inicio})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancelar</Button>
            <Button onClick={save}>{editing ? 'Salvar alterações' : 'Criar'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir aula da grade?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDel && (
                <>
                  {matNome(confirmDel.materia_id)} — {profNome(confirmDel.professor_id)}<br />
                  {turNome(confirmDel.turma_id)} · {DIAS.find(d => d.id === confirmDel.dia_semana)?.label} · Horário {confirmDel.horario_id}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDel && del(confirmDel.id)} className="bg-destructive">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
