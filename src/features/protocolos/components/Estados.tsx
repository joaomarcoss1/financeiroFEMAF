import { Children, type ReactNode } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Inbox } from 'lucide-react';
import ListSkeleton from '@/components/ListSkeleton';

const EASE = [0.16, 1, 0.3, 1] as const;

export function Carregando({ rows = 4 }: { rows?: number }) {
  return <ListSkeleton rows={rows} />;
}

/** Lista com entrada escalonada dos itens. */
export function ListaAnimada({ children, className = 'space-y-2.5' }: { children: ReactNode; className?: string }) {
  return (
    <motion.div className={className} initial="hidden" animate="show" variants={{ hidden: {}, show: { transition: { staggerChildren: 0.05 } } }}>
      {Children.map(children, (c) => (
        <motion.div variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } } }}>{c}</motion.div>
      ))}
    </motion.div>
  );
}

export function Vazio({ texto, children }: { texto: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-md border border-dashed border-border px-6 py-12 text-center text-muted-foreground">
      <Inbox className="h-6 w-6" />
      <p className="max-w-sm text-sm">{texto}</p>
      {children}
    </div>
  );
}

export function Erro({ erro }: { erro: unknown }) {
  return (
    <div role="alert" className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{erro instanceof Error ? erro.message : 'Não foi possível carregar. Tente novamente.'}</span>
    </div>
  );
}
