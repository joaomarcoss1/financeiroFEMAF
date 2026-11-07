import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeftRight, Check, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { motion } from 'framer-motion';

interface Permuta {
  id: string;
  professor_a_id: string;
  professor_b_id: string;
  data_a: string;
  horarios_a: number[];
  materia_a_id: string;
  turma_a_id: string;
  data_b: string;
  horarios_b: number[];
  materia_b_id: string;
  turma_b_id: string;
  observacao: string | null;
  status: string;
  motivo_rejeicao: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  pendente_b: { label: 'Aguardando professor', cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  pendente_admin: { label: 'Aguardando aprovação', cls: 'bg-blue-500/15 text-blue-700 dark:text-blue-300' },
  aprovado: { label: 'Aprovada', cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300' },
  rejeitado: { label: 'Rejeitada', cls: 'bg-red-500/15 text-red-700 dark:text-red-300' },
  cancelado: { label: 'Cancelada', cls: 'bg-gray-500/15 text-gray-700 dark:text-gray-300' },
};

export default function Permutas() {
  const [permutas, setPermutas] = useState<Permuta[]>([]);
  const [profMap, setProfMap] = useState<Record<string, string>>({});
  const [matMap, setMatMap] = useState<Record<string, string>>({});
  const [turmaMap, setTurmaMap] = useState<Record<string, string>>({});
  const [rejeitando, setRejeitando] = useState<Permuta | null>(null);
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [{ data: p }, { data: profs }, { data: mats }, { data: turmas }] = await Promise.all([
      supabase.from('permutas' as any).select('*').order('created_at', { ascending: false }),
      supabase.from('professores').select('id,nome'),
      supabase.from('materias').select('id,nome'),
      supabase.from('turmas').select('id,nome'),
    ]);
    setPermutas((p || []) as any);
    setProfMap(Object.fromEntries((profs || []).map((x: any) => [x.id, x.nome])));
    setMatMap(Object.fromEntries((mats || []).map((x: any) => [x.id, x.nome])));
    setTurmaMap(Object.fromEntries((turmas || []).map((x: any) => [x.id, x.nome])));
    setLoading(false);
  }

  async function aprovar(p: Permuta) {
    if (!confirm('Aprovar esta permuta? Os registros serão lançados na folha de pagamento.')) return;
    const { error } = await supabase.rpc('permuta_aprovar' as any, {
      p_permuta_id: p.id, p_acao: 'aprovar', p_motivo: null,
    });
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    toast({ title: 'Permuta aprovada' });
    load();
  }

  async function rejeitar() {
    if (!rejeitando) return;
    if (motivo.trim().length < 3) return toast({ title: 'Informe o motivo', variant: 'destructive' });
    const { error } = await supabase.rpc('permuta_aprovar' as any, {
      p_permuta_id: rejeitando.id, p_acao: 'rejeitar', p_motivo: motivo.trim(),
    });
    if (error) return toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    toast({ title: 'Permuta rejeitada' });
    setRejeitando(null);
    setMotivo('');
    load();
  }

  const pendentes = permutas.filter(p => p.status === 'pendente_admin');
  const outras = permutas.filter(p => p.status !== 'pendente_admin');

  function renderLado(p: Permuta, lado: 'a' | 'b') {
    const profId = lado === 'a' ? p.professor_a_id : p.professor_b_id;
    const matId = lado === 'a' ? p.materia_a_id : p.materia_b_id;
    const turmaId = lado === 'a' ? p.turma_a_id : p.turma_b_id;
    const data = lado === 'a' ? p.data_a : p.data_b;
    const hs = lado === 'a' ? p.horarios_a : p.horarios_b;
    return (
      <div className="flex-1 p-3 rounded-lg bg-muted/40 border border-border/50">
        <p className="text-xs text-muted-foreground">{lado === 'a' ? 'Solicitante assume' : 'Receptor assume'}</p>
        <p className="font-semibold text-sm">{profMap[profId] || '—'}</p>
        <p className="text-xs">{matMap[matId] || '—'} • {turmaMap[turmaId] || '—'}</p>
        <p className="text-xs text-muted-foreground">{new Date(data + 'T00:00:00').toLocaleDateString('pt-BR')} • Horários: {hs.join(', ')}</p>
      </div>
    );
  }

  function Item({ p }: { p: Permuta }) {
    const st = STATUS_LABEL[p.status] || { label: p.status, cls: 'bg-muted' };
    return (
      <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="glass-card-hover">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowLeftRight className="h-4 w-4" />
                <span className="text-sm font-medium">Permuta</span>
                <Badge className={st.cls}>{st.label}</Badge>
              </div>
              <span className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleString('pt-BR')}</span>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              {renderLado(p, 'a')}
              <div className="flex items-center justify-center"><ArrowLeftRight className="h-5 w-5 text-muted-foreground" /></div>
              {renderLado(p, 'b')}
            </div>
            {p.observacao && <p className="text-xs text-muted-foreground italic">"{p.observacao}"</p>}
            {p.motivo_rejeicao && <p className="text-xs text-red-600 dark:text-red-400">Motivo: {p.motivo_rejeicao}</p>}
            {p.status === 'pendente_admin' && (
              <div className="flex gap-2 justify-end">
                <Button size="sm" variant="outline" onClick={() => { setRejeitando(p); setMotivo(''); }}>
                  <X className="h-4 w-4 mr-1" /> Rejeitar
                </Button>
                <Button size="sm" onClick={() => aprovar(p)}>
                  <Check className="h-4 w-4 mr-1" /> Aprovar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <div className="container py-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight flex items-center gap-2.5"><ArrowLeftRight className="h-7 w-7 sm:h-8 sm:w-8 text-primary" /> Permutas</h1>
        <p className="text-sm text-muted-foreground">Trocas de horário entre professores, aprovadas por ambos e validadas pela administração.</p>
      </motion.div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Aguardando aprovação ({pendentes.length})</h2>
        {pendentes.length === 0 && <Card className="glass-card"><CardContent className="py-6 text-center text-muted-foreground text-sm">Nenhuma permuta aguardando aprovação.</CardContent></Card>}
        {pendentes.map(p => <Item key={p.id} p={p} />)}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Histórico ({outras.length})</h2>
        {loading && <p className="text-sm text-muted-foreground">Carregando...</p>}
        {outras.map(p => <Item key={p.id} p={p} />)}
      </section>

      <Dialog open={!!rejeitando} onOpenChange={o => !o && setRejeitando(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rejeitar permuta</DialogTitle></DialogHeader>
          <Textarea value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Motivo da rejeição..." rows={4} />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setRejeitando(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={rejeitar}>Rejeitar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
