import { useState } from 'react';
import { Paperclip, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { urlAnexo } from '../api/uploads';
import type { AnexoRow } from '../lib/types';

export function AnexoLink({ anexo }: { anexo: AnexoRow }) {
  const { toast } = useToast();
  const [abrindo, setAbrindo] = useState(false);
  async function abrir() {
    setAbrindo(true);
    try {
      window.open(await urlAnexo(anexo.storage_path), '_blank', 'noopener');
    } catch (e) {
      toast({ title: (e as Error).message, variant: 'destructive' });
    } finally {
      setAbrindo(false);
    }
  }
  return (
    <Button type="button" variant="outline" size="sm" onClick={abrir} disabled={abrindo} className="max-w-full">
      {anexo.sensivel ? <ShieldAlert className="h-4 w-4 text-amber-600" /> : <Paperclip className="h-4 w-4" />}
      <span className="truncate">{anexo.nome_arquivo}</span>
    </Button>
  );
}
