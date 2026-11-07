import { dataBR } from '../lib/rotulos';
import type { ItemAC, TipoProtocolo } from '../lib/types';
import { ItensAtividadeLeitura } from './ItensAtividadeComplementar';
import { useCategoriasAC } from '../api/protocolos';

/** Campos do pedido com rótulos do tipo; usa os nomes gravados na abertura. */
export function DadosProtocolo({ tipo, dados }: { tipo: TipoProtocolo; dados: Record<string, unknown> }) {
  const { data: categorias = [] } = useCategoriasAC();
  const nome = (id: string) => {
    const v = dados[id];
    if (id === 'materia_id') return String(dados.materia_nome ?? v ?? '');
    if (id === 'professor_id') return String(dados.professor_nome ?? '');
    if (id === 'orientador_id') return String(dados.orientador_nome ?? '');
    if (id === 'disciplinas') return ((dados.disciplinas_nomes as string[] | undefined) ?? []).join(', ');
    return v === undefined || v === null ? '' : String(v);
  };
  return (
    <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
      {tipo.campos.map((c) => {
        if (c.tipo === 'itens_ac') {
          return (
            <div key={c.id} className="sm:col-span-2">
              <dt className="inst-kicker">{c.rotulo}</dt>
              <dd className="mt-1"><ItensAtividadeLeitura itens={(dados.itens as ItemAC[]) ?? []} categorias={categorias} /></dd>
            </div>
          );
        }
        const v = c.tipo === 'date' ? dataBR(String(dados[c.id] ?? '')) : nome(c.id);
        if (!v) return null;
        return (
          <div key={c.id} className={c.tipo === 'textarea' ? 'sm:col-span-2' : ''}>
            <dt className="inst-kicker">{c.rotulo}</dt>
            <dd className="text-sm whitespace-pre-wrap break-words">{v}</dd>
          </div>
        );
      })}
    </dl>
  );
}
