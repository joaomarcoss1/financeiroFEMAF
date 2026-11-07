import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Plus, Edit, Trash2, BookOpen, Wallet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { CURSOS } from '@/lib/types';
import type { Materia } from '@/lib/types';
import { toast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useConfirm } from '@/hooks/useConfirm';
import ListSkeleton from '@/components/ListSkeleton';
import { quinzenaDates, listQuinzenas, reais } from '@/lib/payrollCalculations';

const FORM_INICIAL = {
  nome: '', cargaHorariaTotal: '', cursoId: '',
  pagamentoTipo: 'hora_aula' as 'hora_aula' | 'fixo_semestral' | 'fixo_quinzenal',
  horasFixas: '',
  valorFixo: '', pagamentoInicio: '', pagamentoFim: '',
};

export default function Materias() {
  const { confirm, ConfirmDialog } = useConfirm();
  const [materias, setMaterias] = useState<Materia[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Materia | null>(null);
  const [form, setForm] = useState(FORM_INICIAL);
  const [cursoFiltro, setCursoFiltro] = useState('todos');

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    const { data } = await supabase.from('materias').select('*').order('nome');
    setMaterias((data || []) as any);
    setLoading(false);
  }

  function openNew() {
    setEditing(null);
    setForm(FORM_INICIAL);
    setDialogOpen(true);
  }

  function openEdit(m: Materia) {
    setEditing(m);
    setForm({
      nome: m.nome, cargaHorariaTotal: String(m.carga_horaria_total), cursoId: m.curso_id,
      pagamentoTipo: m.pagamento_tipo === 'fixo_quinzenal' ? 'fixo_quinzenal' : m.pagamento_tipo === 'fixo_semestral' ? 'fixo_semestral' : 'hora_aula',
      horasFixas: m.horas_fixas_quinzenais ? String(m.horas_fixas_quinzenais) : '',
      valorFixo: m.valor_fixo_semestral ? String(m.valor_fixo_semestral) : '',
      pagamentoInicio: m.pagamento_inicio || '', pagamentoFim: m.pagamento_fim || '',
    });
    setDialogOpen(true);
  }

  // Preview das quinzenas/parcela — mesma lógica de payrollCalculations, para o admin
  // conferir a divisão antes de salvar (ex.: R$ 800 em 8 quinzenas = R$ 100/quinzena).
  const quinzenasPreview = (() => {
    if (form.pagamentoTipo !== 'fixo_semestral' || !form.pagamentoInicio || !form.pagamentoFim) return null;
    if (form.pagamentoInicio > form.pagamentoFim) return null;
    const window = { start: quinzenaDates(form.pagamentoInicio).start, end: quinzenaDates(form.pagamentoFim).end };
    const periods = listQuinzenas(window.start, window.end);
    const total = Number(form.valorFixo) || 0;
    return { count: periods.length, porQuinzena: periods.length > 0 ? reais(total / periods.length) : 0 };
  })();

  async function handleSave() {
    if (!form.nome.trim() || !form.cursoId) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    if (form.pagamentoTipo !== 'hora_aula') {
      if (!form.pagamentoInicio || (form.pagamentoTipo === 'fixo_semestral' && !form.pagamentoFim)) {
        toast({ title: 'Informe o início e o fim do contrato fixo', variant: 'destructive' });
        return;
      }
      if (form.pagamentoFim && form.pagamentoInicio > form.pagamentoFim) {
        toast({ title: 'A data de início deve ser anterior ao fim', variant: 'destructive' });
        return;
      }
      if (!(Number(form.valorFixo) > 0)) {
        toast({ title: 'Informe um valor fixo maior que zero', variant: 'destructive' });
        return;
      }
      if (form.pagamentoTipo === 'fixo_quinzenal' && !(Number(form.horasFixas) > 0)) {
        toast({ title: 'Informe as horas fixas por quinzena', variant: 'destructive' });
        return;
      }
    }
    const payload = {
      nome: form.nome, carga_horaria_total: parseInt(form.cargaHorariaTotal) || 0, curso_id: form.cursoId,
      pagamento_tipo: form.pagamentoTipo,
      valor_fixo_semestral: form.pagamentoTipo !== 'hora_aula' ? (Number(form.valorFixo) || 0) : 0,
      pagamento_inicio: form.pagamentoTipo !== 'hora_aula' ? form.pagamentoInicio : null,
      pagamento_fim: form.pagamentoTipo !== 'hora_aula' ? (form.pagamentoFim || null) : null,
      horas_fixas_quinzenais: form.pagamentoTipo === 'fixo_quinzenal' ? Number(form.horasFixas) : 0,
    };

    if (editing) {
      const { error } = await supabase.from('materias').update(payload).eq('id', editing.id);
      if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Matéria atualizada!' });
    } else {
      const { error } = await supabase.from('materias').insert(payload);
      if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
      toast({ title: 'Matéria cadastrada!' });
    }
    setDialogOpen(false);
    loadData();
  }

  async function handleDelete(id: string) {
    if (!(await confirm('Deseja excluir esta matéria?', { danger: true, confirmLabel: 'Excluir' }))) return;
    await supabase.from('materias').delete().eq('id', id);
    toast({ title: 'Matéria removida' });
    loadData();
  }

  const grouped = CURSOS.map(c => ({
    ...c,
    materias: materias.filter(m => m.curso_id === c.id),
  }));

  const filteredGrouped = cursoFiltro === 'todos' ? grouped : grouped.filter(g => g.id === cursoFiltro);

  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-accent/10 flex items-center justify-center">
            <BookOpen size={20} className="text-accent" />
          </div>
          <div>
            <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight">Matérias</h1>
            <p className="text-muted-foreground text-sm">{materias.length} cadastrada(s)</p>
          </div>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus size={16} /> Nova</Button>
      </motion.div>

      {/* Course filter */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <Badge
          variant={cursoFiltro === 'todos' ? 'default' : 'outline'}
          className="cursor-pointer whitespace-nowrap"
          onClick={() => setCursoFiltro('todos')}
        >
          Todos ({materias.length})
        </Badge>
        {CURSOS.map(c => {
          const count = materias.filter(m => m.curso_id === c.id).length;
          return (
            <Badge
              key={c.id}
              variant={cursoFiltro === c.id ? 'default' : 'outline'}
              className="cursor-pointer whitespace-nowrap"
              onClick={() => setCursoFiltro(c.id)}
            >
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
          {g.materias.length === 0 ? (
            <p className="text-sm text-muted-foreground pl-4">Nenhuma matéria cadastrada</p>
          ) : (
            <div className="space-y-1.5">
              {g.materias.map((m, i) => (
                <motion.div key={m.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}>
                  <Card className="glass-card-hover">
                    <CardContent className="p-3 flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm flex items-center gap-1.5 flex-wrap">
                          {m.nome}
                          {m.pagamento_tipo !== 'hora_aula' && (
                            <Badge variant="outline" className="gap-1 text-[10px] border-accent/40 text-accent">
                              <Wallet size={10} /> Fixo R$ {Number(m.valor_fixo_semestral).toFixed(2)}{m.pagamento_tipo === 'fixo_quinzenal' ? ' / quinzena' : ''}
                            </Badge>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {m.carga_horaria_total}h carga horária
                          {m.pagamento_tipo === 'fixo_quinzenal' && (<> · {m.horas_fixas_quinzenais} H/A por quinzena · desde {m.pagamento_inicio ? new Date(m.pagamento_inicio + 'T12:00').toLocaleDateString('pt-BR') : '—'} · {m.pagamento_fim ? `até ${new Date(m.pagamento_fim + 'T12:00').toLocaleDateString('pt-BR')}` : 'sem término'}</>)}
                          {m.pagamento_tipo === 'fixo_semestral' && m.pagamento_inicio && m.pagamento_fim && (
                            <> · {new Date(m.pagamento_inicio + 'T12:00').toLocaleDateString('pt-BR')} a {new Date(m.pagamento_fim + 'T12:00').toLocaleDateString('pt-BR')}</>
                          )}
                        </p>
                      </div>
                      <div className="flex gap-0.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(m)}><Edit size={13} /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(m.id)}><Trash2 size={13} className="text-destructive" /></Button>
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
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'Editar Matéria' : 'Nova Matéria'}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome *</Label><Input value={form.nome} onChange={e => setForm(f => ({ ...f, nome: e.target.value }))} /></div>
            <div>
              <Label>Curso *</Label>
              <Select value={form.cursoId} onValueChange={v => setForm(f => ({ ...f, cursoId: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecione o curso" /></SelectTrigger>
                <SelectContent>{CURSOS.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Carga Horária Total (h)</Label><Input value={form.cargaHorariaTotal} onChange={e => setForm(f => ({ ...f, cargaHorariaTotal: e.target.value }))} type="number" /></div>

            <div>
              <Label>Forma de pagamento</Label>
              <Select value={form.pagamentoTipo} onValueChange={(v: 'hora_aula' | 'fixo_semestral' | 'fixo_quinzenal') => setForm(f => ({ ...f, pagamentoTipo: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hora_aula">Por hora-aula (padrão)</SelectItem>
                  <SelectItem value="fixo_semestral">Valor fixo (dividido nas quinzenas do período)</SelectItem>
                  <SelectItem value="fixo_quinzenal">Horas fixas por quinzena (recorrente)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.pagamentoTipo !== 'hora_aula' && (
              <div className="space-y-3 rounded-lg border border-accent/30 bg-accent/5 p-3">
                {form.pagamentoTipo === 'fixo_semestral' && <p className="text-xs text-muted-foreground">
                  O valor total abaixo é dividido igualmente entre as quinzenas do período informado.
                  Ex.: R$ 800,00 de início a fim com 8 quinzenas no meio = R$ 100,00 por quinzena.
                </p>}
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Início *</Label><Input type="date" value={form.pagamentoInicio} onChange={e => setForm(f => ({ ...f, pagamentoInicio: e.target.value }))} /></div>
                  <div><Label>{form.pagamentoTipo === 'fixo_quinzenal' ? 'Fim (opcional)' : 'Fim *'}</Label><Input type="date" value={form.pagamentoFim} onChange={e => setForm(f => ({ ...f, pagamentoFim: e.target.value }))} /></div>
                </div>
                <div>
                  <Label>{form.pagamentoTipo === 'fixo_quinzenal' ? 'Valor fixo por quinzena (R$) *' : 'Valor fixo total do período (R$) *'}</Label>
                  <Input type="number" min="0" step="0.01" value={form.valorFixo} onChange={e => setForm(f => ({ ...f, valorFixo: e.target.value }))} />
                </div>
                {form.pagamentoTipo === 'fixo_quinzenal' && <div><Label>Horas fixas por quinzena *</Label><Input type="number" min="0" step="0.01" value={form.horasFixas} onChange={e => setForm(f => ({ ...f, horasFixas: e.target.value }))} /></div>}
                {quinzenasPreview && quinzenasPreview.count > 0 && (
                  <p className="text-xs font-medium text-accent flex items-center gap-1">
                    <Wallet size={12} /> {quinzenasPreview.count} quinzena(s) · R$ {quinzenasPreview.porQuinzena.toFixed(2)} por quinzena
                  </p>
                )}
              </div>
            )}

            <Button onClick={handleSave} className="w-full">{editing ? 'Atualizar' : 'Cadastrar'}</Button>
          </div>
        </DialogContent>
      </Dialog>
      {ConfirmDialog}
    </div>
  );
}
