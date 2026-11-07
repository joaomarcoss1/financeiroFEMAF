import { useMemo } from 'react';
import { cn } from '@/lib/utils';

/**
 * Rosácea guilhochê (padrão de segurança de diplomas e cédulas), gerada em vetor.
 * Cada anel é r(θ) = R + a·sen(kθ); os anéis se desenham na entrada e o conjunto gira muito devagar.
 */
function anel(R: number, a: number, k: number, fase: number) {
  const passos = 540;
  let d = '';
  for (let i = 0; i <= passos; i++) {
    const t = (i / passos) * Math.PI * 2;
    const r = R + a * Math.sin(k * t + fase);
    d += `${i ? 'L' : 'M'}${(r * Math.cos(t)).toFixed(2)},${(r * Math.sin(t)).toFixed(2)}`;
  }
  return d + 'Z';
}

export default function Guilloche({ className, aneis = 9, raio = 300, girar = true, desenhar = true }: {
  className?: string; aneis?: number; raio?: number; girar?: boolean; desenhar?: boolean;
}) {
  const caminhos = useMemo(() => Array.from({ length: aneis }, (_, i) => {
    const R = raio * (0.38 + (i / aneis) * 0.62);
    return { d: anel(R, 6 + (i % 3) * 3, 18 + (i % 4) * 6, i * 0.7), dourado: i % 3 !== 1 };
  }), [aneis, raio]);
  const lado = raio * 1.12;
  return (
    <svg viewBox={`${-lado} ${-lado} ${lado * 2} ${lado * 2}`} className={cn('pointer-events-none', className)} aria-hidden="true" focusable="false">
      <g className={girar ? 'inst-girar' : undefined}>
        {caminhos.map((c, i) => (
          <path key={i} d={c.d} pathLength={1} fill="none" vectorEffect="non-scaling-stroke"
            className={cn(c.dourado ? 'inst-traco-ouro' : 'inst-traco-verde', desenhar && 'inst-desenhar')}
            style={desenhar ? { animationDelay: `${i * 140}ms` } : undefined} />
        ))}
      </g>
    </svg>
  );
}
