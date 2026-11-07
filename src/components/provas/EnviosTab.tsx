import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Inbox, ChevronDown, Loader2, Printer, Download, CheckCircle2, XCircle, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { legacyExamClient } from '@/lib/legacyExamClient';
import { toast } from '@/hooks/use-toast';
import ListSkeleton from '@/components/ListSkeleton';

interface ChecklistItem { id: string; label: string; ok: boolean; mensagem: string }
interface ProvaRow {
  id: string; titulo: string; data_prova: string; status: string; created_at: string;
  checklist_resultado: ChecklistItem[];
  professores: { nome: string } | null;
  materias: { nome: string } | null;
  turmas: { nome: string; id: string } | null;
}
interface Geracao { id: string; pdf_lote_url: string | null; quantidade_alunos: number; gerado_em: string }

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  aprovada: { label: 'Aprovada', className: 'bg-success/15 text-success border-success/30' },
  rejeitada: { label: 'Rejeitada', className: 'bg-destructive/15 text-destructive border-destructive/30' },
  cancelada: { label: 'Cancelada', className: 'bg-muted text-muted-foreground' },
};

export default function EnviosTab() {
  const [provas, setProvas] = useState<ProvaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [geracoes, setGeracoes] = useState<Record<string, Geracao[]>>({});
  const [gerando, setGerando] = useState<string | null>(null);
  const [qtdAlunos, setQtdAlunos] = useState<Record<string, number>>({});

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const { data } = await legacyExamClient
      .from('provas')
      .select('id, titulo, data_prova, status, created_at, checklist_resultado, professores(nome), materias(nome), turmas(nome, id)')
      .order('created_at', { ascending: false });
    setProvas((data || []) as any);
    setLoading(false);
  }

  async function toggleExpand(p: ProvaRow) {
    const next = expandedId === p.id ? null : p.id;
    setExpandedId(next);
    if (next && !geracoes[p.id]) {
      const { data } = await legacyExamClient.from('prova_geracoes').select('id, pdf_lote_url, quantidade_alunos, gerado_em').eq('prova_id', p.id).order('gerado_em', { ascending: false });
      setGeracoes((g) => ({ ...g, [p.id]: (data || []) as any }));
    }
    if (next && p.turmas?.id && qtdAlunos[p.id] === undefined) {
      const { count } = await legacyExamClient.from('turma_alunos').select('id', { count: 'exact', head: true }).eq('turma_id', p.turmas.id).eq('ativo', true);
      setQtdAlunos((q) => ({ ...q, [p.id]: count || 0 }));
    }
  }

  async function gerarProvas(prova: ProvaRow) {
    setGerando(prova.id);
    try {
      const { data, error } = await supabase.functions.invoke('prova-gerar', { body: { prova_id: prova.id } });
      if (error) {
        const ctx = (error as any).context;
        const body = ctx ? await ctx.json().catch(() => null) : null;
        throw new Error(body?.error || error.message);
      }
      toast({ title: `${data.quantidade_alunos} cópia(s) gerada(s)!`, description: 'Já disponíveis para download.' });
      const { data: novas } = await legacyExamClient.from('prova_geracoes').select('id, pdf_lote_url, quantidade_alunos, gerado_em').eq('prova_id', prova.id).order('gerado_em', { ascending: false });
      setGeracoes((g) => ({ ...g, [prova.id]: (novas || []) as any }));
    } catch (e: any) {
      toast({ title: 'Erro ao gerar provas', description: e.message, variant: 'destructive' });
    } finally {
      setGerando(null);
    }
  }

  async function baixarLote(path: string) {
    const { data, error } = await supabase.storage.from('provas-geradas').createSignedUrl(path, 120);
    if (error || !data) { toast({ title: 'Erro ao gerar link', description: error?.message, variant: 'destructive' }); return; }
    window.open(data.signedUrl, '_blank');
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      {loading ? <ListSkeleton /> : provas.length === 0 ? (
        <Card className="premium-card"><CardContent className="p-8 text-center text-muted-foreground text-sm flex flex-col items-center gap-2">
          <Inbox size={28} className="text-muted-foreground/50" /> Nenhuma prova enviada ainda.
        </CardContent></Card>
      ) : provas.map((p) => (
        <Card key={p.id} className="glass-card-hover overflow-hidden">
          <button className="w-full text-left" onClick={() => toggleExpand(p)}>
            <CardContent className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-sm truncate">{p.titulo}</p>
                  <Badge variant="outline" className={STATUS_BADGE[p.status]?.className}>{STATUS_BADGE[p.status]?.label || p.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">
                  {p.professores?.nome} • {p.materias?.nome} • {p.turmas?.nome} • {p.data_prova?.split('-').reverse().join('/')}
                </p>
              </div>
              <ChevronDown size={16} className={`shrink-0 transition-transform ${expandedId === p.id ? 'rotate-180' : ''}`} />
            </CardContent>
          </button>

          <AnimatePresence>
            {expandedId === p.id && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}>
                <CardContent className="px-4 pb-4 pt-0 space-y-3 border-t border-border">
                  <div className="space-y-1 pt-3">
                    {(p.checklist_resultado || []).map((c) => (
                      <div key={c.id} className="flex items-start gap-1.5 text-[11px]">
                        {c.ok ? <CheckCircle2 size={12} className="text-success mt-0.5 shrink-0" /> : <XCircle size={12} className="text-destructive mt-0.5 shrink-0" />}
                        <span className={c.ok ? 'text-muted-foreground' : 'text-destructive font-medium'}>{c.label}{!c.ok && `: ${c.mensagem}`}</span>
                      </div>
                    ))}
                  </div>

                  {p.status === 'aprovada' && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                        <span className="text-xs flex items-center gap-1.5"><Users size={13} /> {qtdAlunos[p.id] ?? '—'} aluno(s) ativo(s) na turma</span>
                        <Button size="sm" onClick={() => gerarProvas(p)} disabled={gerando === p.id || !qtdAlunos[p.id]} className="btn-premium gap-1.5 h-8">
                          {gerando === p.id ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />} Gerar provas
                        </Button>
                      </div>

                      {(geracoes[p.id] || []).map((g) => (
                        <div key={g.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs">
                          <span>{g.quantidade_alunos} cópia(s) — {new Date(g.gerado_em).toLocaleString('pt-BR')}</span>
                          {g.pdf_lote_url && (
                            <Button size="sm" variant="outline" className="h-7 gap-1.5" onClick={() => baixarLote(g.pdf_lote_url!)}>
                              <Download size={12} /> Baixar lote
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </motion.div>
            )}
          </AnimatePresence>
        </Card>
      ))}
    </motion.div>
  );
}
