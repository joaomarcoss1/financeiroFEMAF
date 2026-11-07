import { format, parseISO } from 'date-fns';

/**
 * Formata uma data (string YYYY-MM-DD) sem aplicar conversão de timezone.
 * Usar parseISO evita o bug em que `new Date('2025-04-17')` é tratado como UTC
 * e exibido como o dia anterior em fusos negativos (BRT/AMT).
 */
export function formatDateBR(dateStr: string, pattern = 'dd/MM/yyyy'): string {
  if (!dateStr) return '';
  try {
    return format(parseISO(dateStr), pattern);
  } catch {
    return dateStr;
  }
}

/** YYYY-MM-DD da data local (sem deslocamento UTC). */
export function todayLocalISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
