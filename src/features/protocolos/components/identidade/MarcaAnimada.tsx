import { cn } from '@/lib/utils';
import { CORES_FEMAF, CORES_FEMAF_SOBRE_ESCURO, FECHADO_FEMAF, PAGINAS_FEMAF } from '@/components/MarcaFemaf';

/**
 * Símbolo FEMAF que se abre como um livro (página a página, a partir da lombada).
 * `tom` escolhe a paleta ("escuro" = sobre as barras índigo, padrão). `mono` usa currentColor. `atraso` em ms. Respeita prefers-reduced-motion (via CSS).
 */
export default function MarcaAnimada({ className, mono = false, atraso = 0, animar = true, tom = 'escuro' }: {
  className?: string; mono?: boolean; atraso?: number; animar?: boolean; tom?: 'claro' | 'escuro';
}) {
  const cores = tom === 'escuro' ? CORES_FEMAF_SOBRE_ESCURO : CORES_FEMAF;
  return (
    <svg viewBox="0 0 120 80" className={cn('overflow-visible', className)} aria-hidden="true" focusable="false">
      {PAGINAS_FEMAF.map((d, i) => (
        <path key={d} d={d} fill={mono ? 'currentColor' : cores[i]}
          className={animar ? 'inst-folha' : undefined}
          style={animar ? ({ '--ang': `${FECHADO_FEMAF[i]}deg`, animationDelay: `${atraso + i * 70}ms` } as React.CSSProperties) : undefined} />
      ))}
    </svg>
  );
}
