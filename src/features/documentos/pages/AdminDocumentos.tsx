import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FilePlus2, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { academicoDb, rpc } from '@/features/protocolos/api/db';
import { Carregando, Erro, Vazio } from '@/features/protocolos/components/Estados';
import { useDocumentos, type DocumentoLista } from '../api/documentos';
import { LinhaDocumento } from '../components/BotaoDocumento';
import { ListaAssinaturas } from './Assinaturas';

/** Documentos emitidos: busca, cancelamento e emissão de declaração avulsa. */
export default function AdminDocumentos() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data, isLoading, error } = useDocumentos();
  const [busca, setBusca] = useState('');
  const [cancelar, setCancelar] = useState<DocumentoLista | null>(null);
  const [motivo, setMotivo] = useState('');
  const [declaracao, setDeclaracao] = useState<{ aluno_id: string; titulo: string; texto: string } | null>(null);
  const [buscaAluno, setBuscaAluno] = useState('');
  const alunos = useQuery({
    queryKey: ['alunos_busca', buscaAluno],
    enabled: !!declaracao && buscaAluno.trim().length >= 2,
    queryFn: async () => {
      const q = buscaAluno.trim().replace(/[%,()]/g, '');
      const { data } = await academicoDb.from('alunos').select('id, nome, matricula').or(`nome.ilike.%${q}%,matricula.ilike.%${q}%`).limit(20);
      return (data ?? []) as { id: string; nome: string; matricula: string }[];
    },
  });

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (data ?? []).filter((d) => !q || d.codigo.toLowerCase().includes(q) || d.titulo.toLowerCase().includes(q)
      || (d.aluno?.nome ?? '').toLowerCase().includes(q) || (d.aluno?.matricula ?? '').toLowerCase().includes(q));
  }, [data, busca]);

  const recarregar = () => void qc.invalidateQueries({ queryKey: ['documentos'] });

  async function confirmarCancelamento() {
    if (!cancelar) return;
    try {
      await rpc('documento_cancelar', { p_id: cancelar.id, p_motivo: motivo });
      setCancelar(null);
      setMotivo('');
      recarregar();
    } catch (e) {
      toast({ title: (e as Error).message, variant: 'destructive' });
    }
  }

  async function emitir() {
    if (!declaracao) return;
    try {
      const { aluno_id, ...resto } = declaracao;
      await rpc('documento_criar', { p_modelo: 'declaracao', p_protocolo: null, p_dados: aluno_id ? declaracao : resto });
      setDeclaracao(null);
      toast({ title: 'Declaração emitida', description: 'Assine em "Aguardando minha assinatura".' });
      recarregar();
      void qc.invalidateQueries({ queryKey: ['para_assinar'] });
    } catch (e) {
      toast({ title: (e as Error).message, variant: 'destructive' });
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2">
        <h2 className="font-semibold">Aguardando minha assinatura</h2>
        <ListaAssinaturas />
      </section>
      <section className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[12rem]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Código, título, aluno ou matrícula" value={busca} onChange={(e) => setBusca(e.target.value)} />
          </div>
          <Button onClick={() => setDeclaracao({ aluno_id: '', titulo: 'Declaração', texto: '' })}><FilePlus2 className="h-4 w-4" /> Nova declaração</Button>
        </div>
        {isLoading ? <Carregando /> : error ? <Erro erro={error} /> : !lista.length ? <Vazio texto="Nenhum documento emitido." /> : (
          <div className="divide-y divide-border rounded-md border border-border bg-card px-4">
            {lista.map((d) => (
              <div key={d.id} className="pb-2">
                <LinhaDocumento doc={d} />
                <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-muted-foreground">
                  <span>{d.aluno?.nome ? `${d.aluno.nome} · ${d.aluno.matricula}` : 'Sem titular'}</span>
                  {d.status !== 'cancelado' && <Button size="sm" variant="ghost" className="h-7 text-destructive" onClick={() => setCancelar(d)}>Cancelar documento</Button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {cancelar && (
        <Dialog open onOpenChange={(o) => !o && setCancelar(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>Cancelar {cancelar.codigo}</DialogTitle></DialogHeader>
            <p className="text-sm text-muted-foreground">A validação pública passará a mostrar "Cancelado". Não é possível desfazer.</p>
            <div className="space-y-1"><Label>Motivo *</Label><Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} /></div>
            <DialogFooter><Button variant="ghost" onClick={() => setCancelar(null)}>Voltar</Button><Button variant="destructive" disabled={!motivo.trim()} onClick={confirmarCancelamento}>Cancelar documento</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {declaracao && (
        <Dialog open onOpenChange={(o) => !o && setDeclaracao(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Nova declaração</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Aluno (opcional)</Label>
                <Input className="input-premium h-11" placeholder="Digite nome ou matrícula" value={buscaAluno} onChange={(e) => setBuscaAluno(e.target.value)} />
                {(alunos.data ?? []).length > 0 && (
                  <Select value={declaracao.aluno_id} onValueChange={(v) => setDeclaracao({ ...declaracao, aluno_id: v })}>
                    <SelectTrigger><SelectValue placeholder="Escolha o aluno" /></SelectTrigger>
                    <SelectContent>{alunos.data!.map((a) => <SelectItem key={a.id} value={a.id}>{a.nome} · {a.matricula}</SelectItem>)}</SelectContent>
                  </Select>
                )}
              </div>
              <div className="space-y-1"><Label>Título</Label><Input className="input-premium h-11" value={declaracao.titulo} onChange={(e) => setDeclaracao({ ...declaracao, titulo: e.target.value })} /></div>
              <div className="space-y-1"><Label>Texto *</Label><Textarea rows={6} value={declaracao.texto} onChange={(e) => setDeclaracao({ ...declaracao, texto: e.target.value })} /></div>
              <p className="text-xs text-muted-foreground">Assinam: secretaria e direção, nesta ordem.</p>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDeclaracao(null)}>Cancelar</Button>
              <Button disabled={!declaracao.texto.trim()} onClick={() => void emitir()}>Emitir</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
