// Código de validação IPD-XXXX-XXXX: 7 caracteres + 1 dígito verificador.
// Mesmo algoritmo de public._documento_codigo (Migration D). Alfabeto sem 0/O/1/I.
export const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function digitoVerificador(corpo7: string): string {
  let soma = 0;
  for (let i = 0; i < 7; i++) soma += ALFABETO.indexOf(corpo7[i]) * (2 * i + 1);
  return ALFABETO[soma % 32];
}

export function gerarCodigo(random: () => number = Math.random): string {
  let corpo = '';
  for (let i = 0; i < 7; i++) corpo += ALFABETO[Math.floor(random() * 32) % 32];
  corpo += digitoVerificador(corpo);
  return `IPD-${corpo.slice(0, 4)}-${corpo.slice(4)}`;
}

/** Aceita minúsculas, espaços e sem hífens; devolve o formato canônico ou null. */
export function normalizarCodigo(entrada: string): string | null {
  const s = (entrada ?? '').toUpperCase().replace(/[\s-]/g, '').replace(/^IPD/, '');
  if (s.length !== 8 || [...s].some((c) => !ALFABETO.includes(c))) return null;
  return `IPD-${s.slice(0, 4)}-${s.slice(4)}`;
}

export function codigoValido(entrada: string): boolean {
  const c = normalizarCodigo(entrada);
  if (!c) return false;
  const corpo = c.slice(4, 8) + c.slice(9, 13);
  return digitoVerificador(corpo.slice(0, 7)) === corpo[7];
}
