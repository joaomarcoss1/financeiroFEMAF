import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, MapPin, Download, Check, X, Briefcase, GraduationCap, Clock as ClockIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { formatDateBR } from '@/lib/datetime';
import { toast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';
import RegistrosDocentes from '@/components/registros/RegistrosDocentes';

const TIPO_LABEL: Record<string, string> = {
  entrada_expediente: 'Entrada',
  saida_intervalo: 'Saída intervalo',
  retorno_intervalo: 'Retorno intervalo',
  saida_expediente: 'Saída',
};

export default function Registros() {
  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight">Registros de Ponto</h1>
        <p className="text-muted-foreground text-sm">Auditoria e aprovação de marcações</p>
      </motion.div>

      <Tabs defaultValue="docentes" className="w-full">
        <TabsList className="grid grid-cols-2 w-full max-w-md">
          <TabsTrigger value="docentes" className="gap-1.5"><GraduationCap size={14} /> Docentes</TabsTrigger>
          <TabsTrigger value="adm" className="gap-1.5"><Briefcase size={14} /> Adm/Apoio</TabsTrigger>
        </TabsList>
        <TabsContent value="docentes" className="mt-4">
          <RegistrosDocentes />
        </TabsContent>
        <TabsContent value="adm" className="mt-4">
          <RegistrosAdministrativos />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RegistrosAdministrativos() {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 8) + '01';
  const [ini, setIni] = useState(firstOfMonth);
  const [fim, setFim] = useState(today);
  const [list, setList] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'pendente' | 'aprovado' | 'rejeitado'>('todos');
  const [rejeitarDialog, setRejeitarDialog] = useState<any>(null);
  const [motivo, setMotivo] = useState('');
  const [loadingId, setLoadingId] = useState<string | null>(null);

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [ini, fim]);

  async function load() {
    const { data, error } = await supabase.rpc('listar_registros_admin_full', { p_inicio: ini, p_fim: fim });
    if (error) {
      toast({ title: 'Erro ao carregar', description: error.message, variant: 'destructive' });
      return;
    }
    setList((data as any) || []);
  }

  const filtered = list.filter(r => {
    const matchSearch = !search ||
      (r.funcionario_nome || '').toLowerCase().includes(search.toLowerCase()) ||
      r.data.includes(search);
    const matchStatus = filtroStatus === 'todos' || r.status_aprovacao === filtroStatus;
    return matchSearch && matchStatus;
  });

  const pendentes = list.filter(r => r.status_aprovacao === 'pendente').length;

  async function aprovar(r: any, acao: 'aprovar' | 'rejeitar', motivoTxt?: string) {
    setLoadingId(r.id);
    const { error } = await supabase.rpc('aprovar_ponto_admin', { p_id: r.id, p_acao: acao, p_motivo: motivoTxt || null });
    setLoadingId(null);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: acao === 'aprovar' ? 'Aprovado' : 'Rejeitado' });
    setRejeitarDialog(null); setMotivo('');
    load();
  }

  async function excluir(id: string) {
    if (!confirm('Excluir registro?')) return;
    const { error } = await supabase.from('registros_ponto_administrativo').delete().eq('id', id);
    if (error) { toast({ title: 'Erro', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Removido' }); load();
  }

  function exportarCSV() {
    const rows = filtered.map(r => ({
      Funcionário: r.funcionario_nome,
      Função: r.funcao_nome || '',
      Data: formatDateBR(r.data),
      Tipo: TIPO_LABEL[r.tipo_marcacao] || r.tipo_marcacao,
      Previsto: r.horario_previsto?.slice(0, 5) || '',
      Real: new Date(r.horario_real).toLocaleString('pt-BR'),
      Diff: r.diferenca_minutos,
      Status: r.status,
      'Status Aprovação': r.status_aprovacao,
      Retroativo: r.retroativo ? 'Sim' : 'Não',
      Justificativa: r.justificativa || '',
      'Motivo Rejeição': r.motivo_rejeicao || '',
    }));
    const header = Object.keys(rows[0] || {});
    const csv = [header, ...rows.map(r => header.map(h => `"${String((r as any)[h] ?? '').replace(/"/g, '""')}"`))]
      .map(r => r.join(';')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `registros-adm-${ini}_${fim}.csv`; a.click();
    URL.revokeObjectURL(a.href);
  }

  function statusBadge(s: string) {
    if (s === 'pendente') return <Badge className="bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/40 text-[10px]">Pendente</Badge>;
    if (s === 'rejeitado') return <Badge variant="destructive" className="text-[10px]">Rejeitado</Badge>;
    return <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-700 dark:text-emerald-400">Aprovado</Badge>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="text-[11px] uppercase text-muted-foreground">De</label>
          <Input type="date" value={ini} onChange={e => setIni(e.target.value)} className="w-auto" />
        </div>
        <div>
          <label className="text-[11px] uppercase text-muted-foreground">Até</label>
          <Input type="date" value={fim} onChange={e => setFim(e.target.value)} className="w-auto" />
        </div>
        <Button variant="outline" size="sm" onClick={exportarCSV} className="gap-1 ml-auto" disabled={filtered.length === 0}>
          <Download size={14} /> Exportar
        </Button>
      </div>

      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar por funcionário ou data..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
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
            {s === 'pendente' && pendentes > 0 && ` (${pendentes})`}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map((r, i) => (
          <motion.div key={r.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.3) }}>
            <Card className={`glass-card-hover ${r.status_aprovacao === 'pendente' ? 'border-amber-500/40' : ''}`}>
              <CardContent className="p-3 sm:p-4">
                <div className="flex justify-between items-start gap-2 min-w-0">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold truncate">{r.funcionario_nome}</p>
                      {statusBadge(r.status_aprovacao)}
                      {r.retroativo && <Badge variant="outline" className="text-[10px]">Retroativo</Badge>}
                      {r.latitude && <Badge variant="outline" className="text-[10px] gap-0.5 px-1"><MapPin size={8} /> GPS</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground">{r.funcao_nome || '—'}</p>
                    <p className="text-sm flex items-center gap-1 flex-wrap">
                      <span className="font-medium">{TIPO_LABEL[r.tipo_marcacao] || r.tipo_marcacao}</span>
                      <span className="text-muted-foreground">·</span>
                      <span className="text-xs">{formatDateBR(r.data)} {new Date(r.horario_real).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Previsto: {r.horario_previsto?.slice(0, 5) || '—'}
                      {r.diferenca_minutos != null && ` · ${r.diferenca_minutos > 0 ? '+' : ''}${r.diferenca_minutos} min`}
                    </p>
                    {r.justificativa && (
                      <div className="text-xs mt-1 p-2 bg-amber-500/5 border border-amber-500/20 rounded">
                        <p className="font-semibold text-amber-700 dark:text-amber-400">Justificativa:</p>
                        <p className="text-muted-foreground">{r.justificativa}</p>
                      </div>
                    )}
                    {r.motivo_rejeicao && <p className="text-xs text-destructive mt-1">Motivo: {r.motivo_rejeicao}</p>}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge variant="outline" className="text-[10px]">{r.status || '—'}</Badge>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => excluir(r.id)} title="Excluir">
                      <X size={13} className="text-destructive" />
                    </Button>
                  </div>
                </div>

                {r.status_aprovacao === 'pendente' && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                    <Button size="sm" className="flex-1 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                      onClick={() => aprovar(r, 'aprovar')} disabled={loadingId === r.id}>
                      <Check size={14} /> Aprovar
                    </Button>
                    <Button size="sm" variant="destructive" className="flex-1 gap-1"
                      onClick={() => { setRejeitarDialog(r); setMotivo(''); }} disabled={loadingId === r.id}>
                      <X size={14} /> Rejeitar
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
        {filtered.length === 0 && (
          <div className="text-center text-muted-foreground py-10 flex flex-col items-center gap-2">
            <ClockIcon size={32} className="opacity-30" />
            <p>Nenhum registro no período</p>
          </div>
        )}
      </div>

      <Dialog open={!!rejeitarDialog} onOpenChange={(o) => !o && setRejeitarDialog(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rejeitar registro</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Informe o motivo da rejeição.</p>
            <Textarea value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Ex: Justificativa insuficiente..." rows={3} />
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setRejeitarDialog(null)}>Cancelar</Button>
              <Button variant="destructive" className="flex-1" onClick={() => aprovar(rejeitarDialog, 'rejeitar', motivo)}
                disabled={!!loadingId || motivo.trim().length < 3}>
                Confirmar rejeição
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
