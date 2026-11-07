import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';

/** Placeholder de carregamento para listas de cards (Professores, Matérias, Turmas...). */
export default function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2" role="status" aria-label="Carregando">
      {Array.from({ length: rows }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-4 flex items-center gap-3">
            <Skeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/4" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
