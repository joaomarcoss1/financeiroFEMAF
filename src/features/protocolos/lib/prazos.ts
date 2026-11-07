// Dias úteis no mesmo critério de public.is_dia_letivo: seg–sex, exceto feriado/recesso;
// sábado só conta quando marcado como letivo no calendário.
export interface DiaCalendario { data: string; tipo: string }

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (s: string) => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };

export function ehDiaUtil(data: string, calendario: Map<string, string>): boolean {
  const tipo = calendario.get(data);
  if (tipo === 'feriado' || tipo === 'recesso') return false;
  if (tipo && ['sabado_letivo', 'reposicao', 'evento', 'prova'].includes(tipo)) return true;
  const dow = parse(data).getDay();
  return dow !== 0 && dow !== 6;
}

export function diasUteisApos(data: string, n: number, calendario: Map<string, string> = new Map()): string {
  const d = parse(data);
  let c = 0;
  while (c < n) {
    d.setDate(d.getDate() + 1);
    if (ehDiaUtil(iso(d), calendario)) c++;
  }
  return iso(d);
}

/** Fora do prazo regimental quando hoje passou do n-ésimo dia útil após a data de referência. */
export function foraDoPrazo(dataRef: string, diasUteis: number, hoje: string, calendario: Map<string, string> = new Map()): boolean {
  return hoje.slice(0, 10) > diasUteisApos(dataRef, diasUteis, calendario);
}

export const calendarioMap = (dias: DiaCalendario[]) => new Map(dias.map((d) => [d.data, d.tipo]));
export const hojeIso = () => iso(new Date());
