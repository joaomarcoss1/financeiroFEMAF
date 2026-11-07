import { useState } from 'react';
import { Download, Eye, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { baixarBlob, obterPdf } from '../api/documentos';
import { VisualizadorPdf } from './VisualizadorPdf';

const STATUS: Record<string, string> = { aguardando_assinatura: 'Aguardando assinatura', assinado: 'Assinado', cancelado: 'Cancelado' };
const COR: Record<string, string> = {
  assinado: 'text-emerald-700 dark:text-emerald-300',
  cancelado: 'text-destructive',
  aguardando_assinatura: 'text-amber-700 dark:text-amber-300',
};

interface Doc { id: string; codigo: string; titulo: string; status: string; emitido_em: string }

/** Linha de documento com visualizar e baixar (gera/registra o PDF final quando preciso). */
/** `compacta`: ações abaixo do título (colunas laterais estreitas). */
export function LinhaDocumento({ doc, className, compacta = false }: { doc: Doc; className?: string; compacta?: boolean }) {
  const { toast } = useToast();
  const { isEquipe } = useAuth();
  const [ocupado, setOcupado] = useState(false);
  const [pdf, setPdf] = useState<Blob | null>(null);
  async function pegar(acao: 'ver' | 'baixar') {
    setOcupado(true);
    try {
      const { blob, nome } = await obterPdf(doc.id, isEquipe);
      if (acao === 'baixar') baixarBlob(blob, nome); else setPdf(blob);
    } catch (e) {
      toast({ title: 'Não foi possível gerar o documento', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setOcupado(false);
    }
  }
  return (
    <div className={cn('flex flex-wrap items-center gap-x-3 gap-y-1 py-3', className)}>
      <FileText className={cn('h-5 w-5 shrink-0 text-muted-foreground', compacta && 'self-start mt-0.5')} />
      <div className={cn('min-w-0 flex-1', compacta && 'basis-[calc(100%-2rem)]')}>
        <p className="break-words text-sm font-medium">{doc.titulo}</p>
        <p className="text-xs text-muted-foreground">
          <span className="inst-num">{doc.codigo}</span> · {new Date(doc.emitido_em).toLocaleDateString('pt-BR')} · <span className={COR[doc.status]}>{STATUS[doc.status] ?? doc.status}</span>
        </p>
      </div>
      <div className={cn('flex items-center gap-1', compacta && '-ml-2 pl-8')}>
        <Button size="sm" variant="ghost" onClick={() => pegar('ver')} disabled={ocupado}><Eye className="h-4 w-4" /> Ver</Button>
        <Button size="sm" variant="ghost" onClick={() => pegar('baixar')} disabled={ocupado}><Download className="h-4 w-4" /> PDF</Button>
      </div>
      {pdf && <VisualizadorPdf blob={pdf} titulo={doc.titulo} onClose={() => setPdf(null)} />}
    </div>
  );
}
