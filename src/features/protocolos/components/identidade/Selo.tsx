import { useId } from 'react';
import { cn } from '@/lib/utils';
import Guilloche from './Guilloche';

/**
 * Selo institucional animado: carimba (escala + giro), desenha o visto e mantém o texto circular
 * girando devagar. `tom`: verde (autêntico/registrado) ou âmbar (pendente/cancelado).
 */
export default function Selo({ texto, tom = 'verde', className, icone = 'check' }: {
  texto: string; tom?: 'verde' | 'ambar'; className?: string; icone?: 'check' | 'alerta';
}) {
  const id = useId().replace(/:/g, '');
  const cor = tom === 'verde' ? 'hsl(var(--inst-verde))' : 'hsl(212 85% 42%)';
  // Duas repetições preenchem o anel (2π·42 ≈ 264); espaços não separáveis para o SVG não descartá-los.
  const sep = '\u00A0\u00A0•\u00A0\u00A0';
  const repetido = `${texto}${sep}${texto}${sep}`;
  return (
    <div className={cn('inst-selo relative', className)} role="img" aria-label={texto}>
      <Guilloche aneis={4} raio={60} girar={false} desenhar={false} className="absolute inset-0 h-full w-full opacity-70" />
      <svg viewBox="-60 -60 120 120" className="relative h-full w-full" aria-hidden="true">
        <defs><path id={`c${id}`} d="M0,-42 a42,42 0 1,1 -0.01,0" /></defs>
        <circle r="53" fill="none" stroke={cor} strokeOpacity=".35" strokeWidth="1" />
        <g className="inst-girar-lento">
          <text fontSize="9.5" fill={cor} fontWeight="700" style={{ textTransform: 'uppercase', fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif" }}
            textLength="258" lengthAdjust="spacingAndGlyphs">
            <textPath href={`#c${id}`} textLength="258" lengthAdjust="spacingAndGlyphs">{repetido.toUpperCase()}</textPath>
          </text>
        </g>
        <circle r="33" fill={cor} />
        <circle r="29" fill="none" stroke="hsl(201 85% 62%)" strokeWidth="1" strokeDasharray="1.5 2.5" />
        {icone === 'check'
          ? <path d="M-12,1 L-3,10 L14,-9" fill="none" stroke="white" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="inst-visto" />
          : <path d="M0,-13 L0,4 M0,12 L0,12.5" fill="none" stroke="white" strokeWidth="5" strokeLinecap="round" pathLength={1} className="inst-visto" />}
      </svg>
    </div>
  );
}
