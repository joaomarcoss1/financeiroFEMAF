import { useEffect, useRef, useState } from 'react';

/** Conta de 0 até `alvo` (ease-out), uma vez por mudança de valor. Sem animação se reduzir movimento. */
export function useContagem(alvo: number, duracao = 900) {
  const [v, setV] = useState(alvo);
  const anterior = useRef(0);
  useEffect(() => {
    const reduzir = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const de = anterior.current;
    anterior.current = alvo;
    if (reduzir || de === alvo) { setV(alvo); return; }
    let raf = 0;
    const t0 = performance.now();
    const passo = (t: number) => {
      const p = Math.min(1, (t - t0) / duracao);
      setV(Math.round(de + (alvo - de) * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(passo);
    };
    raf = requestAnimationFrame(passo);
    return () => cancelAnimationFrame(raf);
  }, [alvo, duracao]);
  return v;
}
