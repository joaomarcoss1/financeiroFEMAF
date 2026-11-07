import { Link } from 'react-router-dom';
import { ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CentralLayout from '../layouts/CentralLayout';
import { useMeusProtocolos } from '../api/protocolos';
import { StatusBadge, PrazoBadge } from '../components/Badges';
import { Carregando, Erro, Vazio } from '../components/Estados';
import { Secao } from '../components/Secao';
import { dataBR } from '../lib/rotulos';

export default function MeusProtocolos() {
  const { data, isLoading, error } = useMeusProtocolos();
  const novo = <Button asChild size="sm" className="rounded-md"><Link to="/central/protocolos/novo"><Plus className="h-4 w-4" /> Novo pedido</Link></Button>;
  return (
    <CentralLayout titulo="Meus protocolos">
      {isLoading ? <Carregando /> : error ? <Erro erro={error} /> : !data?.length ? (
        <Vazio texto="Você ainda não abriu nenhum protocolo.">{novo}</Vazio>
      ) : (
        <Secao titulo={`${data.length} protocolo(s)`} acao={novo} semCorpo>
          <div className="hidden grid-cols-[8rem_1fr_9rem_8rem_1.25rem] gap-4 border-b border-border px-5 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground md:grid">
            <span>Número</span><span>Solicitação</span><span>Situação</span><span>Abertura</span><span />
          </div>
          <ul className="inst-list">
            {data.map((p) => (
              <li key={p.id}>
                <Link to={`/central/protocolos/${p.id}`} className="inst-row group md:grid md:grid-cols-[8rem_1fr_9rem_8rem_1.25rem] md:gap-4">
                  <span className="hidden inst-num text-sm tabular-nums md:block">{p.numero}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium md:truncate">{p.protocolo_tipos?.nome ?? p.tipo_id}</span>
                    <span className="block text-xs text-muted-foreground md:hidden">Nº {p.numero} · {dataBR(p.aberto_em)}</span>
                    <span className="mt-1.5 flex flex-wrap gap-1.5 empty:hidden">
                      <span className="md:hidden"><StatusBadge status={p.status} /></span>
                      {p.status === 'aguardando_aluno' && <PrazoBadge status={p.status} prazo={p.prazo_resposta_em} />}
                    </span>
                  </span>
                  <span className="hidden md:block"><StatusBadge status={p.status} /></span>
                  <span className="hidden text-sm tabular-nums text-muted-foreground md:block">{dataBR(p.aberto_em)}</span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </Link>
              </li>
            ))}
          </ul>
        </Secao>
      )}
    </CentralLayout>
  );
}
