import { Lock } from 'lucide-react';
import { ACAO_LABEL, dataBR, dataHoraLocal } from '../lib/rotulos';
import type { AnexoRow, Tramite } from '../lib/types';
import { AnexoLink } from './AnexoLink';

const ROTULO_DADO: Record<string, string> = {
  data_prova: 'Data', horario: 'Horário', local: 'Local', taxa_valor: 'Taxa (R$)', boleto_link: 'Boleto', nota_homologada: 'Nota homologada',
};

function DadosAcao({ dados }: { dados: Record<string, unknown> }) {
  const itens = Object.entries(dados ?? {}).filter(([k, v]) => ROTULO_DADO[k] && v !== null && v !== '');
  if (!itens.length) return null;
  return (
    <ul className="mt-1 text-sm text-muted-foreground">
      {itens.map(([k, v]) => (
        <li key={k}>
          {ROTULO_DADO[k]}: {k === 'data_prova' ? dataBR(String(v)) : k === 'boleto_link' && /^https?:\/\//i.test(String(v))
            ? <a className="underline text-primary break-all" href={String(v)} target="_blank" rel="noopener noreferrer">{String(v)}</a>
            : String(v)}
        </li>
      ))}
    </ul>
  );
}

export function LinhaDoTempo({ tramites, anexos }: { tramites: Tramite[]; anexos: AnexoRow[] }) {
  if (!tramites.length) return <p className="text-sm text-muted-foreground">Sem movimentações.</p>;
  return (
    <ol className="relative border-l border-border ml-2 space-y-5">
      {tramites.map((t) => {
        const doTramite = anexos.filter((a) => a.tramite_id === t.id);
        return (
          <li key={t.id} className="ml-4">
            <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-background bg-primary" />
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="font-medium text-sm">{ACAO_LABEL[t.acao] ?? t.acao}</span>
              {t.setor_nome && <span className="text-xs text-muted-foreground">{t.setor_nome}</span>}
              {!t.visivel_aluno && (
                <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300"><Lock className="h-3 w-3" /> interno</span>
              )}
            </div>
            <time className="text-xs text-muted-foreground">{dataHoraLocal(t.created_at)}{t.autor ? ` · ${t.autor}` : ''}</time>
            {t.parecer && <p className="mt-1 text-sm whitespace-pre-wrap">{t.parecer}</p>}
            <DadosAcao dados={t.dados} />
            {doTramite.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-2">{doTramite.map((a) => <AnexoLink key={a.id} anexo={a} />)}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
