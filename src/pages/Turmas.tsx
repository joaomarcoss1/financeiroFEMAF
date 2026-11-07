import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, GraduationCap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { CURSOS } from '@/lib/types';
import type { Turma, Materia } from '@/lib/types';
import { toast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import { useConfirm } from '@/hooks/useConfirm';
import ListSkeleton from '@/components/ListSkeleton';

export default function Turmas() {
  const { confirm, ConfirmDialog } = useConfirm();
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [turmaMaterias, setTurmaMaterias] = useState<{ turma_id: string; materia_id: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Turma | null>(null);
  const [form, setForm] = useState({ nome: '', cursoId: '', periodo: '', turno: 'Noturno', materiaIds: [] as string[] });
  const [cursoFiltro, setCursoFiltro] = useState('todos');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const [{ data: t }, { data: m }, { data: tm }] = await Promise.all([
      supabase.from('turmas').select('*').order('nome'),
      supabase.from('materias').select('*').order('nome'),
      supabase.from('turma_materias').select('turma_id, materia_id'),
    ]);
    setTurmas((t || []) as any);
    setMaterias((m || []) as any);
    setTurmaMaterias(tm || []);
    setLoading(false);
  }

  function getMateriaIds(turmaId: string) {
    return turmaMaterias.filter(tm => tm.turma_id === turmaId).map(tm => tm.materia_id);
  }

  const materiasFiltradas = form.cursoId ? materias.filter(m => m.curso_id === form.cursoId) : materias;

  function openNew() {
    setEditing(null);
    setForm({ nome: '', cursoId: '', periodo: '', turno: 'Noturno', materiaIds: [] });
    setDialogOpen(true);
  }

  function openEdit(t: Turma) {
    setEditing(t);
    setForm({ nome: t.nome, cursoId: t.curso_id, periodo: t.periodo || '', turno: t.turno || 'Noturno', materiaIds: getMateriaIds(t.id) });
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!form.nome.trim() || !form.cursoId) {
      toast({ title: 'Preencha os campos obrigatórios', variant: 'destructive' });
      return;
    }
    const payload = { nome: form.nome, curso_id: form.cursoId, periodo: form.periodo || null, turno: form.turno };

    if (editing) {
      const { error } = await supabase.from('turmas').update(payload).eq('id', editing.id);
      if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
      await supabase.from('turma_materias').delete().eq('turma_id', editing.id);
      if (form.materiaIds.length > 0) {
        await supabase.from('turma_materias').insert(form.materiaIds.map(mid => ({ turma_id: editing.id, materia_id: mid })));
      }
      toast({ title: 'Turma atualizada!' });
    } else {
      const { data: newTurma, error } = await supabase.from('turmas').insert(payload).select().single();
      if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
      if (form.materiaIds.length > 0 && newTurma) {
        await supabase.from('turma_materias').insert(form.materiaIds.map(mid => ({ turma_id: newTurma.id, materia_id: mid })));
      }
      toast({ title: 'Turma cadastrada!' });
    }
    setDialogOpen(false);
    loadData();
  }

  async function handleDelete(id: string) {
    if (!(await confirm('Excluir turma?', { danger: true, confirmLabel: 'Excluir' }))) return;
    await supabase.from('turmas').delete().eq('id', id);
    toast({ title: 'Turma removida' });
    loadData();
  }

  function toggleMateria(id: string) {
    setForm(f => ({ ...f, materiaIds: f.materiaIds.includes(id) ? f.materiaIds.filter(m => m !== id) : [...f.materiaIds, id] }));
  }

  const grouped = CURSOS.map(c => ({ ...c, turmas: turmas.filter(t => t.curso_id === c.id) }));
  const filteredGrouped = cursoFiltro === 'todos' ? grouped : grouped.filter(g => g.id === cursoFiltro);

  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-warning/10 flex items-center justify-center">
            <GraduationCap size={20} className="text-warning" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight">Turmas</h1>
            <p className="text-muted-foreground text-sm">{turmas.length} turma(s)</p>
          </div>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus size={16} /> Nova</Button>
      </motion.div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <Badge variant={cursoFiltro === 'todos' ? 'default' : 'outline'} className="cursor-pointer whitespace-nowrap" onClick={() => setCursoFiltro('todos')}>
          Todos ({turmas.length})
        </Badge>
        {CURSOS.map(c => {
          const count = turmas.filter(t => t.curso_id === c.id).length;
          return (
            <Badge key={c.id} variant={cursoFiltro === c.id ? 'default' : 'outline'} className="cursor-pointer whitespace-nowrap" onClick={() => setCursoFiltro(c.id)}>
              {c.nome} ({count})
            </Badge>
          );
        })}
      </div>

      {loading ? <ListSkeleton /> : filteredGrouped.map(g => (
        <div key={g.id} className="space-y-2">
          <h2 className="text-lg font-semibold text-primary flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary" />
            {g.nome}
          </h2>
          {g.turmas.length === 0 ? (
            <p className="text-sm text-muted-foreground pl-4">Nenhuma turma</p>
          ) : (
            <div className="space-y-1.5">
              {g.turmas.map((t, i) => (
                <motion.div key={t.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}>
                  <Card className="glass-card-hover">
                    <CardContent className="p-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-sm">{t.nome}</p>
                          <p className="text-xs text-muted-foreground">{t.periodo} • {t.turno}</p>
                          {getMateriaIds(t.id).length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {getMateriaIds(t.id).map(mid => {
                                const m = materias.find(x => x.id === mid);
                                return m ? <Badge key={mid} variant="outline" className="text-[10px]">{m.nome}</Badge> : null;
                              })}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-0.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(t)}><Edit size={13} /></Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(t.id)}><Trash2 size={13} className="text-destructive" /></Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      ))}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? 'Editar Turma' : 'Nova Turma'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} placeholder="Ex: DIR 1º Período" /></div>
            <div>
              <Label>Curso *</Label>
              <Select value={form.cursoId} onValueChange={v => setForm(f => ({ ...f, cursoId: v, materiaIds: [] }))}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{CURSOS.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Período</Label><Input value={form.periodo} onChange={e => setForm(f => ({ ...f, periodo: e.target.value }))} placeholder="1º Período" /></div>
              <div>
                <Label>Turno</Label>
                <Select value={form.turno} onValueChange={v => setForm(f => ({ ...f, turno: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Noturno">Noturno</SelectItem>
                    <SelectItem value="Matutino">Matutino</SelectItem>
                    <SelectItem value="Vespertino">Vespertino</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Matérias Vinculadas</Label>
              {materiasFiltradas.length === 0 ? (
                <p className="text-xs text-muted-foreground">{form.cursoId ? 'Nenhuma matéria para este curso' : 'Selecione o curso primeiro'}</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 mt-2 max-h-48 overflow-y-auto">
                  {materiasFiltradas.map(m => (
                    <Badge key={m.id} variant={form.materiaIds.includes(m.id) ? 'default' : 'outline'} className="cursor-pointer text-xs" onClick={() => toggleMateria(m.id)}>
                      {m.nome}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <Button onClick={handleSave} className="w-full">{editing ? 'Atualizar' : 'Cadastrar'}</Button>
          </div>
        </DialogContent>
      </Dialog>
      {ConfirmDialog}
    </div>
  );
}
