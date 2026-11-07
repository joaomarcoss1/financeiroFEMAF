import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { useConfirm } from '@/hooks/useConfirm';
import { cn } from '@/lib/utils';
import CentralLayout from '../layouts/CentralLayout';
import { useCancelarProtocolo, useProtocoloDetalhe, useResponderPendencia } from '../api/protocolos';
import { enviarAnexo } from '../api/uploads';
import { StatusBadge, PrazoBadge } from '../components/Badges';
import { LinhaDoTempo } from '../components/LinhaDoTempo';
import { DadosProtocolo } from '../components/DadosProtocolo';
import { AnexosUploader } from '../components/AnexosUploader';
import { AnexoLink } from '../components/AnexoLink';
import { Carregando, Erro } from '../components/Estados';
import { Secao } from '../components/Secao';
import { LinhaDocumento } from '@/features/documentos/components/BotaoDocumento';
import { dataBR, dataHoraLocal } from '../lib/rotulos';
import type { AnexoDef, AnexoEnviado } from '../lib/types';

const COMPLEMENTO: AnexoDef = {
  id: 'complemento', rotulo: 'Documentos complementares', mimes: ['application/pdf', 'image/jpeg', 'image/png'], max_mb: 10, multiplo: true,
};

export default function ProtocoloAluno() {
  const { id } = useParams();
  const { data: d, isLoading, error } = useProtocoloDetalhe(id);
  const responder = useResponderPendencia();
  const cancelar = useCancelarProtocolo();
  const { toast } = useToast();
  const { confirm, ConfirmDialog } = useConfirm();
  const [texto, setTexto] = useState('');
  const [arquivos, setArquivos] = useState<Record<string, File[]>>({});
  const [enviando, setEnviando] = useState<number | null>(null);

  async function enviarResposta() {
    if (!d) return;
    const files = arquivos.complemento ?? [];
    try {
      setEnviando(0);
      const anexos: AnexoEnviado[] = [];
      for (let i = 0; i < files.length; i++) {
        anexos.push(await enviarAnexo(d.protocolo.aluno_id, d.protocolo.id, files[i], 'complemento'));
        setEnviando(Math.round(((i + 1) / files.length) * 90));
      }
      await responder.mutateAsync({ id: d.protocolo.id, texto, anexos });
      setTexto('');
      setArquivos({});
      toast({ title: 'Resposta enviada' });
    } catch (e) {
      toast({ title: 'Não foi possível enviar', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setEnviando(null);
    }
  }

  async function pedirCancelamento() {
    if (!d) return;
    const ok = await confirm('O pedido será encerrado e não poderá ser reaberto.', { title: 'Cancelar protocolo?', confirmLabel: 'Cancelar protocolo', danger: true });
    if (!ok) return;
    cancelar.mutate({ id: d.protocolo.id, motivo: 'Cancelado pelo aluno' }, {
      onError: (e) => toast({ title: (e as Error).message, variant: 'destructive' }),
    });
  }

  return (
    <CentralLayout>
      {ConfirmDialog}
      <Link to="/central/protocolos" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /> Meus protocolos</Link>
      {isLoading ? <Carregando rows={3} /> : error || !d ? <Erro erro={error} /> : (
        <div className="space-y-6">
          <div className="border-b border-border pb-4">
            <p className="inst-kicker">Protocolo nº <span className="inst-num">{d.protocolo.numero}</span></p>
            <h1 className="inst-title mt-1 text-[28px] leading-tight sm:text-[32px]">{d.tipo.nome}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
              <StatusBadge status={d.protocolo.status} />
              <span>Aberto em {dataHoraLocal(d.protocolo.aberto_em)}</span>
              {d.setor_nome && !['concluido', 'indeferido', 'cancelado'].includes(d.protocolo.status) && <span>· Em análise por {d.setor_nome}</span>}
            </div>
          </div>

          {d.protocolo.status === 'aguardando_aluno' && (
            <Secao titulo="Pendência a responder" className="border-amber-400/70"
              acao={<div className="flex flex-wrap items-center gap-2"><PrazoBadge status={d.protocolo.status} prazo={d.protocolo.prazo_resposta_em} />
                {d.protocolo.prazo_resposta_em && <span className="text-xs text-muted-foreground">até {dataBR(d.protocolo.prazo_resposta_em)}</span>}</div>}>
              <div className="space-y-4">
                <blockquote className="whitespace-pre-wrap border-l-2 border-amber-400 pl-3 text-sm">{[...d.tramites].reverse().find((t) => t.acao === 'solicitar_complementacao')?.parecer}</blockquote>
                <Textarea placeholder="Sua resposta" value={texto} onChange={(e) => setTexto(e.target.value)} rows={3} className="rounded-md" />
                <AnexosUploader defs={[COMPLEMENTO]} arquivos={arquivos} onChange={(k, f) => setArquivos({ ...arquivos, [k]: f })} />
                {enviando !== null && <Progress value={enviando} />}
                <Button className="rounded-md" onClick={enviarResposta} disabled={enviando !== null || (!texto.trim() && !(arquivos.complemento ?? []).length)}>Enviar resposta</Button>
              </div>
            </Secao>
          )}

          {d.protocolo.decisao && (
            <div className={cn('rounded-md border-l-4 bg-card p-4 text-sm', d.protocolo.decisao === 'deferido' ? 'border-emerald-600' : 'border-destructive')}>
              <p className="inst-kicker">Decisão</p>
              <p className="mt-1 font-semibold">{d.protocolo.decisao === 'deferido' ? 'Deferido' : 'Indeferido'}</p>
              {d.protocolo.parecer_final && <p className="mt-1 whitespace-pre-wrap text-foreground/85">{d.protocolo.parecer_final}</p>}
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <div className="space-y-6">
              <Secao titulo="Dados do pedido">
                <div className="space-y-4">
                  <DadosProtocolo tipo={d.tipo} dados={d.protocolo.dados} />
                  <div className="flex flex-wrap gap-2">{d.anexos.filter((a) => !a.tramite_id || d.tramites.find((t) => t.id === a.tramite_id)?.acao === 'abertura').map((a) => <AnexoLink key={a.id} anexo={a} />)}</div>
                </div>
              </Secao>
              <Secao titulo="Andamento">
                <LinhaDoTempo tramites={d.tramites} anexos={d.anexos.filter((a) => d.tramites.find((t) => t.id === a.tramite_id)?.acao !== 'abertura')} />
              </Secao>
            </div>
            <div className="space-y-6">
              {d.documentos.length > 0 && (
                <Secao titulo="Documentos" semCorpo>
                  <div className="inst-list px-4 sm:px-5">{d.documentos.map((doc) => <LinhaDocumento key={doc.id} doc={doc} compacta />)}</div>
                </Secao>
              )}
              {d.protocolo.status === 'aberto' && (
                <Button variant="outline" className="w-full rounded-md text-destructive" onClick={pedirCancelamento} disabled={cancelar.isPending}>Cancelar protocolo</Button>
              )}
            </div>
          </div>
        </div>
      )}
    </CentralLayout>
  );
}
