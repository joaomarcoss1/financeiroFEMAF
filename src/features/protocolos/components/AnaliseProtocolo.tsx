import { useEffect, useRef, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useAuth } from '@/contexts/AuthContext';
import { useProtocoloDetalhe } from '../api/protocolos';
import { StatusBadge, PrazoBadge } from './Badges';
import { LinhaDoTempo } from './LinhaDoTempo';
import { DadosProtocolo } from './DadosProtocolo';
import { AnexoLink } from './AnexoLink';
import { AcaoTramite } from './AcaoTramite';
import { Carregando, Erro } from './Estados';
import { Campos, Secao } from './Secao';
import { LinhaDocumento } from '@/features/documentos/components/BotaoDocumento';
import { obterPdf } from '@/features/documentos/api/documentos';
import { ACAO_BOTAO, dataBR, dataHoraLocal } from '../lib/rotulos';

/**
 * Documentos já assinados por todos mas sem PDF registrado (ex.: comprovante, assinado só pelo aluno):
 * quando a equipe abre o protocolo, gera o PDF determinístico, envia e registra o SHA-256 uma única vez,
 * para que a validação pública possa comparar o arquivo.
 */
function useRegistrarPdfsPendentes(docs: { id: string; status: string; storage_path: string | null }[] | undefined) {
  const { isEquipe } = useAuth();
  const qc = useQueryClient();
  const feitos = useRef(new Set<string>());
  useEffect(() => {
    if (!isEquipe || !docs) return;
    const pendentes = docs.filter((d) => d.status === 'assinado' && !d.storage_path && !feitos.current.has(d.id));
    if (!pendentes.length) return;
    pendentes.forEach((d) => feitos.current.add(d.id));
    void Promise.allSettled(pendentes.map((d) => obterPdf(d.id, true)))
      .then(() => qc.invalidateQueries({ queryKey: ['protocolo'] }));
  }, [docs, isEquipe, qc]);
}

/** Tela de análise e tramitação usada pela Central da equipe e pelo admin. */
export function AnaliseProtocolo({ id }: { id: string }) {
  const { data: d, isLoading, error } = useProtocoloDetalhe(id);
  const { cursos } = useAppSettings();
  const { toast } = useToast();
  const [acao, setAcao] = useState<string | null>(null);
  useRegistrarPdfsPendentes(d?.documentos);

  if (isLoading) return <Carregando rows={3} />;
  if (error || !d) return <Erro erro={error} />;

  const etapa = d.tipo.etapas[d.protocolo.etapa_atual - 1];
  const acoes = d.pode_atuar ? etapa?.acoes ?? [] : [];
  const anexosAbertura = d.anexos.filter((a) => d.tramites.find((t) => t.id === a.tramite_id)?.acao === 'abertura' || !a.tramite_id);
  const etapaNome = `${etapa?.nome ?? d.setor_nome ?? ''}${d.setor_nome && etapa?.setor === '*' ? ` (${d.setor_nome})` : ''}`;

  return (
    <div className="space-y-6">
      <div className="border-b border-border pb-4">
        <p className="inst-kicker">Protocolo nº <span className="inst-num">{d.protocolo.numero}</span> · Etapa {d.protocolo.etapa_atual}: {etapaNome}</p>
        <h1 className="inst-title mt-1 text-[28px] leading-tight sm:text-[32px]">{d.tipo.nome}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
          <StatusBadge status={d.protocolo.status} />
          <PrazoBadge status={d.protocolo.status} prazo={d.protocolo.prazo_resposta_em} foraDoPrazo={d.protocolo.fora_do_prazo} />
          <span>Aberto em {dataHoraLocal(d.protocolo.aberto_em)}</span>
        </div>
      </div>

      {(acoes.length > 0 || d.pode_comentar) && (
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-card p-3">
          <span className="mr-2 inst-kicker">Ações</span>
          {acoes.map((a) => (
            <Button key={a} size="sm"
              variant={a === 'indeferir' || a === 'solicitar_complementacao' || a === 'encaminhar' ? 'outline' : 'default'}
              className={a === 'indeferir' ? 'rounded-md border-destructive/50 text-destructive hover:bg-destructive/5 hover:text-destructive' : 'rounded-md'} onClick={() => setAcao(a)}>
              {ACAO_BOTAO[a] ?? a}
            </Button>
          ))}
          {d.pode_comentar && <Button size="sm" variant="ghost" className="rounded-md" onClick={() => setAcao('comentar')}>Comentar</Button>}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <Secao titulo="Dados do pedido">
            <div className="space-y-4">
              <DadosProtocolo tipo={d.tipo} dados={d.protocolo.dados} />
              <div className="flex flex-wrap gap-2">{anexosAbertura.map((a) => <AnexoLink key={a.id} anexo={a} />)}</div>
              {d.anexos_ocultos > 0 && (
                <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300"><ShieldAlert className="h-3.5 w-3.5" /> {d.anexos_ocultos} anexo(s) sensível(is), visível(is) só para a coordenação e a secretaria.</p>
              )}
            </div>
          </Secao>
          <Secao titulo="Histórico">
            <LinhaDoTempo tramites={d.tramites} anexos={d.anexos.filter((a) => !anexosAbertura.includes(a))} />
          </Secao>
        </div>
        <div className="space-y-6">
          <Secao titulo="Requerente">
            <Campos colunas={1} itens={[
              ['Nome', d.aluno.nome],
              ['Matrícula', d.aluno.matricula],
              ['Curso e turma', `${cursos.find((c) => c.id === d.aluno.curso_id)?.nome ?? d.aluno.curso_id}${d.aluno.turma ? ` · ${d.aluno.turma}` : ''}`],
              ['Contato', [d.aluno.email, d.aluno.telefone].filter(Boolean).join(' · ')],
              ...(d.protocolo.prazo_resposta_em ? [['Prazo de resposta', dataBR(d.protocolo.prazo_resposta_em)] as [string, string]] : []),
            ]} />
          </Secao>
          {d.documentos.length > 0 && (
            <Secao titulo="Documentos" semCorpo>
              <div className="inst-list px-4 sm:px-5">{d.documentos.map((doc) => <LinhaDocumento key={doc.id} doc={doc} compacta />)}</div>
            </Secao>
          )}
        </div>
      </div>

      {acao && (
        <AcaoTramite detalhe={d} acao={acao} etapa={etapa} onClose={() => setAcao(null)}
          onDone={() => { setAcao(null); toast({ title: 'Registrado', description: 'Documentos a assinar aparecem em Assinaturas.' }); }} />
      )}
    </div>
  );
}
