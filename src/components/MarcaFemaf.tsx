/**
 * Símbolo da FEMAF — livro aberto com páginas em leque (azul-céu/royal à esquerda,
 * índigo à direita), redesenhado em vetor a partir da logo oficial.
 * As páginas partem da lombada (60, 74) no viewBox 0 0 120 80.
 */
export const PAGINAS_FEMAF = [
  // esquerda (externa → interna)
  'M60,74 C46,63 26,60 2,66 L8,38 C30,31 48,38 60,52 Z',
  'M60,70 C50,54 34,44 12,42 L24,16 C42,18 54,32 60,46 Z',
  'M60,66 C57,48 50,30 36,16 L52,4 C59,18 61,32 60,42 Z',
  // direita (interna → externa)
  'M60,66 C63,48 70,30 84,16 L68,4 C61,18 59,32 60,42 Z',
  'M60,70 C70,54 86,44 108,42 L96,16 C78,18 66,32 60,46 Z',
  'M60,74 C74,63 94,60 118,66 L112,38 C90,31 72,38 60,52 Z',
];

export const CORES_FEMAF = ['#0095E8', '#0A78D8', '#006CB4', '#3C3C90', '#1E1180', '#12106A'];

/** Variação para fundos escuros (barras índigo): mesmas posições, páginas da direita clareadas. */
export const CORES_FEMAF_SOBRE_ESCURO = ['#38BDF8', '#0EA5E9', '#4FA3E8', '#C7D2FE', '#A5B4FC', '#818CF8'];

/** Ângulo de "livro fechado" de cada página, usado pela versão animada. */
export const FECHADO_FEMAF = [48, 30, 12, -12, -30, -48];

export default function MarcaFemaf({ className, mono }: { className?: string; mono?: boolean }) {
  return (
    <svg viewBox="0 0 120 80" className={className} aria-hidden="true" focusable="false">
      {PAGINAS_FEMAF.map((d, i) => (
        <path key={d} d={d} fill={mono ? 'currentColor' : CORES_FEMAF[i]} />
      ))}
    </svg>
  );
}
