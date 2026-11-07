import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { FormularioDinamico } from './FormularioDinamico';
import { useCategoriasAC, useHorasAluno, useSetores, useTramitar } from '../api/protocolos';
import { camposAcaoFaltando } from '../lib/validarDados';
import { saldoPorCategoria, totalDeferido, validarAvaliacao, type AvaliacaoItem } from '../lib/horasAC';
import { ACAO_BOTAO } from '../lib/rotulos';
import type { EtapaDef, ItemAC, ProtocoloDetalhe } from '../lib/types';

interface Props {
  detalhe: ProtocoloDetalhe;
  acao: string;
  etapa: EtapaDef | undefined;
  onClose: () => void;
  onDone: (status: string) => void;
}

const PARECER_OBRIGATORIO = ['indeferir', 'solicitar_complementacao', 'comentar'];

/** Diálogo de uma ação de tramitação com os campos que a etapa exige. */
export function AcaoTramite({ detalhe, acao, etapa, onClose, onDone }: Props) {
  const { toast } = useToast();
  const tramitar = useTramitar();
  const { data: setores = [] } = useSetores();
  const avaliaAC = detalhe.tipo.id === 'atividades_complementares' && acao === 'deferir';
  const { data: categorias = [] } = useCategoriasAC();
  const { data: usadas = {} } = useHorasAluno(avaliaAC ? detalhe.aluno.id : undefined);
  const itens = (detalhe.protocolo.dados.itens as ItemAC[] | undefined) ?? [];

  const [parecer, setParecer] = useState('');
  const [dados, setDados] = useState<Record<string, unknown>>({});
  const [destino, setDestino] = useState('');
  const [visivel, setVisivel] = useState(false);
  const [avaliacao, setAvaliacao] = useState<AvaliacaoItem[]>(() =>
    itens.map((it, indice) => ({ indice, autentico: true, categoria_id: it.categoria_id, horas_deferidas: it.horas_declaradas })));

  const campos = (etapa?.campos_acao ?? []).filter((c) => c.acao === acao && c.tipo !== 'itens_ac_avaliacao');
  const faltando = camposAcaoFaltando(campos, acao, dados);
  const errosAC = useMemo(() => (avaliaAC ? validarAvaliacao(itens, avaliacao, categorias, usadas) : []), [avaliaAC, itens, avaliacao, categorias, usadas]);
  const saldo = saldoPorCategoria(categorias, usadas);
  const exigeParecer = PARECER_OBRIGATORIO.includes(acao);
  const bloqueado = (exigeParecer && !parecer.trim()) || faltando.length > 0 || errosAC.length > 0 || (acao === 'encaminhar' && !destino);

  async function confirmar() {
    const payload: Record<string, unknown> = { ...dados };
    if (avaliaAC) payload.itens = avaliacao;
    if (acao === 'comentar') payload.visivel_aluno = visivel;
    try {
      const r = await tramitar.mutateAsync({ id: detalhe.protocolo.id, acao, parecer, dados: payload, setorDestino: destino || undefined });
      onDone(r.status);
    } catch (e) {
      toast({ title: 'Não foi possível registrar', description: (e as Error).message, variant: 'destructive' });
    }
  }

  const setItem = (i: number, p: Partial<AvaliacaoItem>) => setAvaliacao((a) => a.map((x, j) => (j === i ? { ...x, ...p } : x)));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{ACAO_BOTAO[acao] ?? acao} — {detalhe.protocolo.numero}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {acao === 'encaminhar' && (
            <div className="space-y-1">
              <Label>Setor de destino *</Label>
              <Select value={destino} onValueChange={setDestino}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {setores.filter((s) => s.ativo && s.id !== detalhe.protocolo.setor_atual).map((s) => <SelectItem key={s.id} value={s.id}>{s.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          {campos.length > 0 && <FormularioDinamico campos={campos} valores={dados} onChange={(id, v) => setDados((d) => ({ ...d, [id]: v }))} />}
          {avaliaAC && (
            <div className="space-y-3">
              {itens.map((it, i) => {
                const a = avaliacao[i];
                return (
                  <div key={i} className="rounded border p-3 space-y-2 text-sm">
                    <p className="font-medium">{i + 1}. {it.descricao} <span className="text-muted-foreground">({it.horas_declaradas} h declaradas)</span></p>
                    <label className="flex items-center gap-2"><Checkbox checked={a.autentico} onCheckedChange={(v) => setItem(i, { autentico: !!v })} /> Certificado autêntico</label>
                    {a.autentico && (
                      <div className="grid grid-cols-[1fr_6rem] gap-2">
                        <Select value={a.categoria_id ?? ''} onValueChange={(v) => setItem(i, { categoria_id: v })}>
                          <SelectTrigger><SelectValue placeholder="Categoria" /></SelectTrigger>
                          <SelectContent>{categorias.filter((c) => c.ativo).map((c) => <SelectItem key={c.id} value={c.id}>{c.nome} (saldo {saldo[c.id]} h)</SelectItem>)}</SelectContent>
                        </Select>
                        <Input type="number" min={0} max={it.horas_declaradas} step="0.5" aria-label="Horas deferidas" value={a.horas_deferidas}
                          onChange={(e) => setItem(i, { horas_deferidas: Number(e.target.value) })} />
                      </div>
                    )}
                  </div>
                );
              })}
              <p className="text-sm font-medium">Total a deferir: {totalDeferido(avaliacao)} h</p>
              {errosAC.map((e) => <p key={e} className="text-xs text-destructive">{e}</p>)}
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="parecer">{acao === 'comentar' ? 'Comentário' : 'Parecer'}{exigeParecer && <span className="text-destructive"> *</span>}</Label>
            <Textarea id="parecer" rows={4} value={parecer} onChange={(e) => setParecer(e.target.value)} />
            {acao !== 'comentar' && <p className="text-xs text-muted-foreground">O parecer fica visível para o aluno.</p>}
          </div>
          {acao === 'comentar' && (
            <label className="flex items-center gap-2 text-sm"><Checkbox checked={visivel} onCheckedChange={(v) => setVisivel(!!v)} /> Visível para o aluno</label>
          )}
          {faltando.length > 0 && <p className="text-xs text-muted-foreground">Falta: {faltando.join(', ')}</p>}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={confirmar} disabled={bloqueado || tramitar.isPending} variant={acao === 'indeferir' ? 'destructive' : 'default'}>
            {tramitar.isPending ? 'Registrando…' : ACAO_BOTAO[acao] ?? acao}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
