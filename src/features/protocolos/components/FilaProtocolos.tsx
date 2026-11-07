import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useFila, useTipos } from '../api/protocolos';
import { StatusBadge, PrazoBadge } from './Badges';
import { Carregando, Erro } from './Estados';
import { STATUS_FINAIS, dataBR } from '../lib/rotulos';
import { hojeIso } from '../lib/prazos';
import type { ProtocoloFilaRow } from '../lib/types';
import { useContagem } from './identidade/useContagem';

function Numero({ valor, alerta }: { valor: number; alerta: boolean }) {
  const v = useContagem(valor);
  return <dd className={`mt-1 font-['Source_Serif_4',Georgia,serif] text-3xl font-semibold tabular-nums transition-colors ${alerta && valor > 0 ? 'text-destructive' : ''}`}>{v}</dd>;
}

type Aba = 'minha' | 'aguardando' | 'andamento' | 'concluidos';
const TODOS = '__todos';

/** Fila de trabalho da equipe; a RPC já limita ao setor/curso de quem está logado. */
export function FilaProtocolos({ base = '/central/equipe/protocolos' }: { base?: string }) {
  const [aba, setAba] = useState<Aba>('minha');
  const [tipoId, setTipoId] = useState(TODOS);
  const [cursoId, setCursoId] = useState(TODOS);
  const [soVencidos, setSoVencidos] = useState(false);
  const { data, isLoading, error } = useFila({ tipo_id: tipoId === TODOS ? undefined : tipoId, curso_id: cursoId === TODOS ? undefined : cursoId });
  const { data: tipos = [] } = useTipos(true);
  const { cursos } = useAppSettings();

  const hoje = hojeIso();
  const vencido = (p: ProtocoloFilaRow) => !!p.prazo_resposta_em && p.prazo_resposta_em < hoje && !STATUS_FINAIS.includes(p.status);
  const grupos = useMemo(() => {
    const l = data ?? [];
    return {
      minha: l.filter((p) => p.minha_etapa),
      aguardando: l.filter((p) => p.status === 'aguardando_aluno'),
      andamento: l.filter((p) => !p.minha_etapa && ['aberto', 'em_analise'].includes(p.status)),
      concluidos: l.filter((p) => STATUS_FINAIS.includes(p.status)),
    };
  }, [data]);
  const lista = grupos[aba].filter((p) => !soVencidos || vencido(p) || p.fora_do_prazo);

  const indicadores: [string, number, boolean][] = [
    ['Na minha etapa', grupos.minha.length, false],
    ['Aguardando aluno', grupos.aguardando.length, false],
    ['Prazo de resposta vencido', (data ?? []).filter(vencido).length, true],
    ['Fora do prazo regimental', grupos.minha.filter((p) => p.fora_do_prazo).length, true],
  ];

  return (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 divide-border overflow-hidden rounded-md border border-border bg-card sm:grid-cols-4 sm:divide-x">
        {indicadores.map(([k, v, alerta]) => (
          <div key={k} className="inst-entrar border-b border-border px-4 py-4 transition-colors hover:bg-muted/40 sm:border-b-0 sm:px-5">
            <dt className="inst-kicker">{k}</dt>
            <Numero valor={v} alerta={alerta} />
          </div>
        ))}
      </dl>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={tipoId} onValueChange={setTipoId}>
          <SelectTrigger className="h-10 w-full rounded-md sm:w-60"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent><SelectItem value={TODOS}>Todos os tipos</SelectItem>{tipos.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={cursoId} onValueChange={setCursoId}>
          <SelectTrigger className="h-10 w-full rounded-md sm:w-48"><SelectValue placeholder="Curso" /></SelectTrigger>
          <SelectContent><SelectItem value={TODOS}>Todos os cursos</SelectItem>{cursos.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm"><Checkbox checked={soVencidos} onCheckedChange={(v) => setSoVencidos(!!v)} /> Só com alerta de prazo</label>
      </div>

      <div className="overflow-hidden rounded-md border border-border bg-card">
        <Tabs value={aba} onValueChange={(v) => setAba(v as Aba)}>
          <TabsList className="h-auto w-full justify-start gap-0 overflow-x-auto rounded-none border-b border-border bg-transparent p-0">
            {([['minha', 'Minha etapa', grupos.minha.length], ['aguardando', 'Aguardando aluno', grupos.aguardando.length],
              ['andamento', 'Em outras etapas', grupos.andamento.length], ['concluidos', 'Encerrados', grupos.concluidos.length]] as const).map(([v, k, n]) => (
              <TabsTrigger key={v} value={v}
                className="-mb-px shrink-0 rounded-none border-b-2 border-transparent px-4 py-3 text-sm data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:font-semibold data-[state=active]:shadow-none">
                {k} <span className="ml-1.5 tabular-nums text-muted-foreground">{n}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        {isLoading ? <div className="p-4"><Carregando /></div> : error ? <div className="p-4"><Erro erro={error} /></div> : !lista.length ? (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">Nenhum protocolo nesta lista.</p>
        ) : (
          <ul className="inst-list">
            {lista.map((p) => (
              <li key={p.id}>
                <Link to={`${base}/${p.id}`} className="inst-row flex-wrap sm:flex-nowrap">
                  <span className="w-28 shrink-0 inst-num text-sm tabular-nums">{p.numero}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{p.tipo_nome}</span>
                    <span className="block truncate text-sm text-muted-foreground">{p.aluno_nome} · {p.matricula} · {cursos.find((c) => c.id === p.curso_id)?.nome ?? p.curso_id}</span>
                  </span>
                  <span className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={p.status} />
                    <PrazoBadge status={p.status} prazo={p.prazo_resposta_em} foraDoPrazo={p.fora_do_prazo} />
                  </span>
                  <span className="hidden w-24 shrink-0 text-right text-sm tabular-nums text-muted-foreground md:block">{dataBR(p.aberto_em)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
