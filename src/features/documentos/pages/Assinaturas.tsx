import { useState } from 'react';
import { PenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import CentralLayout from '@/features/protocolos/layouts/CentralLayout';
import { Carregando, Erro, Vazio } from '@/features/protocolos/components/Estados';
import { useParaAssinar, type ParaAssinar } from '../api/documentos';
import { LinhaDocumento } from '../components/BotaoDocumento';
import { DialogAssinar } from '../components/DialogAssinar';

/** Documentos aguardando a assinatura do usuário logado (ordem e papel conferidos no banco). */
export function ListaAssinaturas() {
  const { data, isLoading, error } = useParaAssinar();
  const [doc, setDoc] = useState<ParaAssinar | null>(null);
  if (isLoading) return <Carregando />;
  if (error) return <Erro erro={error} />;
  if (!data?.length) return <Vazio texto="Nenhum documento aguardando sua assinatura." />;
  return (
    <div className="divide-y divide-border rounded-md border border-border bg-card px-4 sm:px-5">
      {data.map((d) => (
        <div key={`${d.id}-${d.papel}`} className="pb-3">
          <LinhaDocumento doc={{ ...d, status: 'aguardando_assinatura' }} />
          <div className="flex flex-wrap items-center justify-between gap-2 px-1">
            <span className="text-xs text-muted-foreground">{d.aluno_nome ?? 'Documento avulso'} · assinar como {d.cargo ?? d.papel}</span>
            <Button size="sm" className="rounded-md" onClick={() => setDoc(d)}><PenLine className="h-4 w-4" /> Assinar</Button>
          </div>
        </div>
      ))}
      {doc && <DialogAssinar documento={doc} onClose={() => setDoc(null)} />}
    </div>
  );
}

export default function Assinaturas() {
  return <CentralLayout titulo="Assinaturas pendentes" subtitulo="Documentos que aguardam a sua assinatura eletrônica."><ListaAssinaturas /></CentralLayout>;
}
