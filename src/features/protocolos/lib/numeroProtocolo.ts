// Número do protocolo: AAAA.NNNNNN, sequencial por ano (gerado em public.protocolo_abrir).
const RE = /^(\d{4})\.(\d{6})$/;

export function formatarNumeroProtocolo(ano: number, sequencia: number): string {
  return `${ano}.${String(sequencia).padStart(6, '0')}`;
}

export function parseNumeroProtocolo(numero: string): { ano: number; sequencia: number } | null {
  const m = RE.exec((numero ?? '').trim());
  return m ? { ano: Number(m[1]), sequencia: Number(m[2]) } : null;
}

export function proximoNumero(ano: number, existentes: string[]): string {
  const max = existentes.reduce((acc, n) => {
    const p = parseNumeroProtocolo(n);
    return p && p.ano === ano ? Math.max(acc, p.sequencia) : acc;
  }, 0);
  return formatarNumeroProtocolo(ano, max + 1);
}
