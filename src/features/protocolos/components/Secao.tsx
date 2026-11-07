import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Bloco de conteúdo institucional: fio de contorno, cabeçalho em versalete e corpo. */
export function Secao({ titulo, acao, children, className, semCorpo = false }: {
  titulo?: ReactNode; acao?: ReactNode; children: ReactNode; className?: string; semCorpo?: boolean;
}) {
  return (
    <section className={cn('inst-section', className)}>
      {(titulo || acao) && (
        <header className="inst-section-head">
          {titulo && <h2 className="inst-section-title">{titulo}</h2>}
          {acao}
        </header>
      )}
      {semCorpo ? children : <div className="inst-section-body">{children}</div>}
    </section>
  );
}

/** Lista de pares rótulo/valor (dados cadastrais, dados do pedido). */
export function Campos({ itens, colunas = 2 }: { itens: [string, ReactNode][]; colunas?: 1 | 2 | 3 }) {
  return (
    <dl className={cn('grid gap-x-8 gap-y-4 text-sm', colunas === 2 && 'sm:grid-cols-2', colunas === 3 && 'sm:grid-cols-3')}>
      {itens.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="inst-kicker">{k}</dt>
          <dd className="mt-1 break-words text-foreground">{v || '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
