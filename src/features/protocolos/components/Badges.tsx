import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { STATUS_LABEL, dataBR } from '../lib/rotulos';
import type { StatusProtocolo } from '../lib/types';
import { hojeIso } from '../lib/prazos';

const COR: Record<StatusProtocolo, string> = {
  aberto: 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200',
  em_analise: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200',
  aguardando_aluno: 'bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200',
  deferido: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  concluido: 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200',
  indeferido: 'bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200',
  cancelado: 'bg-muted text-muted-foreground',
};

export function StatusBadge({ status }: { status: StatusProtocolo }) {
  const atencao = status === 'aguardando_aluno' || status === 'aberto';
  return (
    <Badge variant="outline" className={cn('gap-1.5 rounded-sm border-transparent px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide', COR[status])}>
      {atencao && <span className="inst-pulso" aria-hidden="true" />}{STATUS_LABEL[status]}
    </Badge>
  );
}

/** Prazo de resposta vencido e/ou pedido fora do prazo regimental. */
export function PrazoBadge({ prazo, foraDoPrazo, status }: { prazo?: string | null; foraDoPrazo?: boolean; status: StatusProtocolo }) {
  const ativo = ['aberto', 'em_analise', 'aguardando_aluno'].includes(status);
  const vencido = ativo && !!prazo && prazo < hojeIso();
  return (
    <>
      {foraDoPrazo && <Badge variant="outline" className="border-red-300 text-red-700 dark:text-red-300">Fora do prazo regimental</Badge>}
      {vencido && <Badge variant="destructive">Prazo vencido {dataBR(prazo)}</Badge>}
    </>
  );
}
