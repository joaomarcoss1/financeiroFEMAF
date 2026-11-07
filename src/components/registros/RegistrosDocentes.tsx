import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Trash2, Search, Edit, MapPin, Download, Check, X, FileText, UserCog } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { formatDateBR } from '@/lib/datetime';
import { toast } from '@/hooks/use-toast';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useConfirm } from '@/hooks/useConfirm';
import { HORARIOS } from '@/lib/types';
import { motion } from 'framer-motion';
import { getAnexoSignedUrl } from '@/lib/attachments';

export default function RegistrosDocentes() {
  const { minutos_por_horario: MINUTOS_POR_HORARIO } = useAppSettings();
  const { confirm, ConfirmDialog } = useConfirm();
  const [registros, setRegistros] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'pendente' | 'aprovado' | 'rejeitado'>('todos');
  const [profsMap, setProfsMap] = useState<Record<string, string>>({});
  const [profValorMap, setProfValorMap] = useState<Record<string, number>>({});
  const [matsMap, setMatsMap] = useState<Record<string, string>>({});
  const [turmasMap, setTurmasMap] = useState<Record<string, string>>({});
  const [editDialog, setEditDialog] = useState(false);
  const [editingReg, setEditingReg] = useState<any>(null);
  const [editForm, setEditForm] = useState({ observacao: '', horarios: [] as number[] });
  const [rejeitarDialog, setRejeitarDialog] = useState<any>(null);
  const [motivoRejeicao, setMotivoRejeicao] = useState('');
  const [acaoLoading, setAcaoLoading] = useState<string | null>(null);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    const [{ data: profs }, { data: mats }, { data: turmas }] = await Promise.all([
      supabase.from('professores').select('id, nome, valor_hora_aula'),
      supabase.from('materias').select('id, nome'),
      supabase.from('turmas').select('id, nome'),
    ]);
    const regs: any[] = [];
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from('registros_ponto').select('*')
        .order('created_at', { ascending: false }).range(from, from + 999);
      if (error) { toast({ title: 'Não foi possível carregar os registros', description: error.message, variant: 'destructive' }); return; }
      regs.push(...(data || []));
      if (!data || data.length < 1000) break;
    }
    setRegistros(regs);
    setProfsMap(Object.fromEntries((profs || []).map((p: any) => [p.id, p.nome])));
    setProfValorMap(Object.fromEntries((profs || []).map((p: any) => [p.id, Number(p.valor_hora_aula || 0)])));
    setMatsMap(Object.fromEntries((mats || []).map((m: any) => [m.id, m.nome])));
    setTurmasMap(Object.fromEntries((turmas || []).map((t: any) => [t.id, t.nome])));
  }

  const filtered = registros.filter(r => {
    const profNome = profsMap[r.professor_id] || '';
    const matchSearch = profNome.toLowerCase().includes(search.toLowerCase()) || r.data.includes(search);
    const matchStatus = filtroStatus === 'todos' || r.status_aprovacao === filtroStatus;
    return matchSearch && matchStatus;
  });

  const pendentesCount = registros.filter(r => r.status_aprovacao === 'pendente').length;

  async function handleDelete(id: string) {
    if (!(await confirm('Excluir registro?', { danger: true, confirmLabel: 'Excluir' }))) return;
    await supabase.from('registros_ponto').delete().eq('id', id);
    toast({ title: 'Registro removido' });
    loadData();
  }

  async function handleAprovar(reg: any) {
    setAcaoLoading(reg.id);
    const { data, error } = await supabase.functions.invoke('aprovar-registro', {
      body: { registro_id: reg.id, acao: 'aprovar' },
    });
    setAcaoLoading(null);
    if (error || (data as any)?.error) {
      toast({ title: 'Erro', description: (data as any)?.error || error?.message, variant: 'destructive' });
      return;
    }
    toast({ title: '✅ Registro aprovado' });
    loadData();
  }

  async function handleRejeitarConfirm() {
    if (!rejeitarDialog) return;
    if (motivoRejeicao.trim().length < 3) {
      toast({ title: 'Motivo obrigatório', variant: 'destructive' });
      return;
    }
    setAcaoLoading(rejeitarDialog.id);
    const { data, error } = await supabase.functions.invoke('aprovar-registro', {
      body: { registro_id: rejeitarDialog.id, acao: 'rejeitar', motivo: motivoRejeicao },
    });
    setAcaoLoading(null);
    if (error || (data as any)?.error) {
      toast({ title: 'Erro', description: (data as any)?.error || error?.message, variant: 'destructive' });
      return;
    }
    toast({ title: 'Registro rejeitado' });
    setRejeitarDialog(null);
    setMotivoRejeicao('');
    loadData();
  }

  function openEdit(r: any) {
    setEditingReg(r);
    setEditForm({ observacao: r.observacao || '', horarios: [...r.horarios] });
    setEditDialog(true);
  }

  async function handleEditSave() {
    if (!editingReg || editForm.horarios.length === 0) return;
    const qtd = editForm.horarios.length;
    const valorHora = profValorMap[editingReg.professor_id] || 0;
    const { error } = await supabase.from('registros_ponto').update({
      horarios: editForm.horarios,
      quantidade_horarios: qtd,
      carga_horaria: qtd * MINUTOS_POR_HORARIO,
      valor_total: Number((qtd * valorHora).toFixed(2)),
      observacao: editForm.observacao || null,
    }).eq('id', editingReg.id);

    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Registro atualizado!' });
    setEditDialog(false);
    loadData();
  }

  async function exportarCSV() {
    const { default: XLSX } = await import('xlsx-js-style');
    const data = filtered.map(r => ({
      Professor: profsMap[r.professor_id] || '',
      Matéria: matsMap[r.materia_id] || '',
      Turma: turmasMap[r.turma_id] || '',
      Data: formatDateBR(r.data),
      Status: r.status_aprovacao,
      Substituição: r.substituicao ? `Sim (${profsMap[r.professor_substituido_id] || ''})` : 'Não',
      Horários: (r.horarios || []).map((h: number) => `${h}º`).join(', '),
      'Qtd Horários': r.quantidade_horarios,
      'Valor (R$)': Number(r.valor_total).toFixed(2),
      Observação: r.observacao || '',
      Justificativa: r.justificativa || '',
      Latitude: r.latitude || '',
      Longitude: r.longitude || '',
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Registros');
    XLSX.writeFile(wb, `registros-ponto-${format(new Date(), 'yyyyMMdd')}.xlsx`);
  }

  function statusBadge(s: string) {
    if (s === 'pendente') return <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/40 text-[10px]">Pendente</Badge>;
    if (s === 'rejeitado') return <Badge variant="destructive" className="text-[10px]">Rejeitado</Badge>;
    return <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-700 dark:text-emerald-400">Aprovado</Badge>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
          {registros.length} registro(s)
          {pendentesCount > 0 && <span className="ml-2 text-amber-600 dark:text-amber-400 font-semibold">• {pendentesCount} pendente(s)</span>}
        </p>
        <Button variant="outline" size="sm" onClick={exportarCSV} className="gap-1" disabled={filtered.length === 0}>
          <Download size={14} /> Exportar
        </Button>
      </div>

      <div className="space-y-2">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por professor ou data..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <div className="flex gap-1 overflow-x-auto no-scrollbar">
          {(['todos', 'pendente', 'aprovado', 'rejeitado'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFiltroStatus(s)}
              className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                filtroStatus === s ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/70'
              }`}
            >
              {s === 'todos' ? 'Todos' : s.charAt(0).toUpperCase() + s.slice(1)}
              {s === 'pendente' && pendentesCount > 0 && ` (${pendentesCount})`}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {filtered.map((r, i) => (
          <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.03, 0.3) }}>
            <Card className={`glass-card-hover ${r.status_aprovacao === 'pendente' ? 'border-amber-500/40' : ''}`}>
              <CardContent className="p-3 sm:p-4">
                <div className="flex justify-between items-start gap-2">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold truncate">{profsMap[r.professor_id] || '—'}</p>
                      {statusBadge(r.status_aprovacao)}
                      {r.substituicao && (
                        <Badge variant="outline" className="text-[10px] gap-0.5 border-blue-500/40 text-blue-700 dark:text-blue-400">
                          <UserCog size={10} /> Substituição
                        </Badge>
                      )}
                      {r.retroativo && <Badge variant="outline" className="text-[10px]">Retroativo</Badge>}
                      {r.latitude && (
                        <Badge variant="outline" className="text-[10px] gap-0.5 px-1">
                          <MapPin size={8} /> GPS
                        </Badge>
                      )}
                    </div>
                    {r.substituicao && r.professor_substituido_id && (
                      <p className="text-xs text-blue-700 dark:text-blue-400">Substituindo: {profsMap[r.professor_substituido_id] || '—'}</p>
                    )}
                    <p className="text-sm text-muted-foreground truncate">{matsMap[r.materia_id]} • {turmasMap[r.turma_id]}</p>
                    <p className="text-xs text-muted-foreground">{formatDateBR(r.data)}</p>
                    <div className="flex flex-wrap gap-1">
                      {(r.horarios || []).map((h: number) => {
                        const hor = HORARIOS.find(x => x.id === h);
                        return <Badge key={h} variant="secondary" className="text-[10px]">{hor?.label}</Badge>;
                      })}
                    </div>
                    {r.observacao && <p className="text-xs text-muted-foreground italic mt-1">{r.observacao}</p>}
                    {r.justificativa && (
                      <div className="text-xs mt-1 p-2 bg-amber-500/5 border border-amber-500/20 rounded">
                        <p className="font-semibold text-amber-700 dark:text-amber-400">Justificativa:</p>
                        <p className="text-muted-foreground">{r.justificativa}</p>
                        {r.anexo_url && (
                          <button
                            type="button"
                            onClick={async () => {
                              const url = await getAnexoSignedUrl(r.anexo_url);
                              if (url) window.open(url, '_blank', 'noopener,noreferrer');
                              else toast({ title: 'Não foi possível abrir o anexo', variant: 'destructive' });
                            }}
                            className="inline-flex items-center gap-1 text-primary mt-1 text-[11px] hover:underline"
                          >
                            <FileText size={11} /> Ver anexo
                          </button>
                        )}
                      </div>
                    )}
                    {r.motivo_rejeicao && (
                      <p className="text-xs text-destructive mt-1">Motivo da rejeição: {r.motivo_rejeicao}</p>
                    )}
                  </div>
                  <div className="text-right space-y-1 flex-shrink-0">
                    <p className="text-sm font-bold text-primary">R$ {Number(r.valor_total).toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground">{r.quantidade_horarios}h/a</p>
                    <div className="flex gap-0.5 justify-end">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)} title="Editar">
                        <Edit size={13} />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(r.id)} title="Excluir">
                        <Trash2 size={13} className="text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>

                {r.status_aprovacao === 'pendente' && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                    <Button
                      size="sm"
                      className="flex-1 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => handleAprovar(r)}
                      disabled={acaoLoading === r.id}
                    >
                      <Check size={14} /> Aprovar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1 gap-1"
                      onClick={() => { setRejeitarDialog(r); setMotivoRejeicao(''); }}
                      disabled={acaoLoading === r.id}
                    >
                      <X size={14} /> Rejeitar
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
        {filtered.length === 0 && <p className="text-center text-muted-foreground py-10">Nenhum registro</p>}
      </div>

      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar Registro</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Horários</Label>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {HORARIOS.map(h => (
                  <div
                    key={h.id}
                    onClick={() => setEditForm(f => ({ ...f, horarios: f.horarios.includes(h.id) ? f.horarios.filter(x => x !== h.id) : [...f.horarios, h.id] }))}
                    className={`p-2 rounded-xl border-2 cursor-pointer text-center transition-all ${editForm.horarios.includes(h.id) ? 'border-primary bg-primary/10' : 'border-border'}`}
                  >
                    <p className="text-sm font-medium">{h.label}</p>
                    <p className="text-xs text-muted-foreground">{h.inicio} - {h.fim}</p>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Label>Observação</Label>
              <Input value={editForm.observacao} onChange={e => setEditForm(f => ({ ...f, observacao: e.target.value }))} />
            </div>
            <Button onClick={handleEditSave} className="w-full">Salvar Alterações</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!rejeitarDialog} onOpenChange={(o) => !o && setRejeitarDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rejeitar registro</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Informe o motivo. O professor receberá uma notificação.
            </p>
            <Textarea
              value={motivoRejeicao}
              onChange={(e) => setMotivoRejeicao(e.target.value)}
              placeholder="Ex: Justificativa insuficiente, anexo ilegível..."
              rows={3}
            />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setRejeitarDialog(null)}>Cancelar</Button>
              <Button variant="destructive" className="flex-1" onClick={handleRejeitarConfirm} disabled={!!acaoLoading}>
                Confirmar rejeição
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {ConfirmDialog}
    </div>
  );
}
