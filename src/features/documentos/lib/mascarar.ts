const CONECTIVOS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);

/** "Maria Silva de Oliveira" → "Maria S*** O***" (mesma regra de public._mascarar_nome). */
export function mascararNome(nome: string): string {
  const partes = (nome ?? '').trim().split(/\s+/).filter(Boolean);
  return partes
    .filter((p, i) => i === 0 || !CONECTIVOS.has(p.toLowerCase()))
    .map((p, i) => (i === 0 ? p : `${p[0].toUpperCase()}***`))
    .join(' ');
}

/** "12345678909" → "***.456.789-**" */
export function mascararCpf(cpf: string): string {
  const d = (cpf ?? '').replace(/\D/g, '');
  return d.length === 11 ? `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**` : '***';
}

/** "2026001" → "****001" */
export function mascararMatricula(m: string): string {
  const s = m ?? '';
  return '*'.repeat(Math.max(s.length - 3, 1)) + s.slice(-3);
}
