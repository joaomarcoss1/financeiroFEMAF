import { useRef } from 'react';
import { Paperclip, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { validarArquivo } from '../lib/validarDados';
import type { AnexoDef } from '../lib/types';

const extensoes = (mimes: string[]) =>
  mimes.map((m) => ({ 'application/pdf': 'PDF', 'image/jpeg': 'JPG', 'image/png': 'PNG', 'application/msword': 'DOC',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'DOCX' }[m] ?? m)).join(', ');

interface Props {
  defs: AnexoDef[];
  arquivos: Record<string, File[]>;
  onChange: (id: string, files: File[]) => void;
}

/** Seleção de arquivos por tipo de anexo; valida formato e tamanho antes do envio. */
export function AnexosUploader({ defs, arquivos, onChange }: Props) {
  return <div className="space-y-4">{defs.map((d) => <Campo key={d.id} def={d} files={arquivos[d.id] ?? []} onChange={(f) => onChange(d.id, f)} />)}</div>;
}

function Campo({ def, files, onChange }: { def: AnexoDef; files: File[]; onChange: (f: File[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  function adicionar(lista: FileList | null) {
    const novos: File[] = [];
    for (const f of Array.from(lista ?? [])) {
      const erro = validarArquivo(def, f);
      if (erro) toast({ title: erro, variant: 'destructive' });
      else novos.push(f);
    }
    onChange(def.multiplo ? [...files, ...novos] : novos.slice(0, 1));
    if (ref.current) ref.current.value = '';
  }
  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{def.rotulo}{def.obrigatorio && <span className="text-destructive"> *</span>}</p>
          <p className="text-xs text-muted-foreground">{extensoes(def.mimes)} · até {def.max_mb ?? 10} MB{def.multiplo ? ' · vários arquivos' : ''}{def.sensivel ? ' · visível só para coordenação e secretaria' : ''}</p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => ref.current?.click()}>
          <Paperclip className="h-4 w-4" /> {files.length && !def.multiplo ? 'Trocar' : 'Escolher'}
        </Button>
        <input ref={ref} type="file" className="hidden" accept={def.mimes.join(',')} multiple={!!def.multiplo} onChange={(e) => adicionar(e.target.files)} />
      </div>
      {files.map((f, i) => (
        <div key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded bg-muted/50 px-2 py-1 text-sm">
          <span className="truncate">{f.name}</span>
          <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label={`Remover ${f.name}`} onClick={() => onChange(files.filter((_, j) => j !== i))}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
    </div>
  );
}
