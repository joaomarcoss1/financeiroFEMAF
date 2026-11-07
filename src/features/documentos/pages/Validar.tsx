import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileSearch, ShieldX, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import CentralLayout from '@/features/protocolos/layouts/CentralLayout';
import { rpc } from '@/features/protocolos/api/db';
import { codigoValido, normalizarCodigo } from '../lib/codigo';
import Selo from '@/features/protocolos/components/identidade/Selo';
import { sha256Hex } from '../lib/sha256';

interface Resultado {
  encontrado: boolean;
  erro?: string;
  codigo?: string;
  tipo?: string;
  titulo?: string;
  status?: 'aguardando_assinatura' | 'assinado' | 'cancelado';
  titular?: string | null;
  matricula?: string | null;
  emitido_em?: string;
  cancelado_em?: string | null;
  sha256?: string | null;
  signatarios?: { nome: string | null; cargo: string | null; status: string; assinado_em: string | null }[];
}

const dh = (v?: string | null) => (v ? new Date(v).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '');

/** Validação pública por código ou QR; compara o SHA-256 do PDF enviado no navegador. */
export default function Validar() {
  const { codigo: param } = useParams();
  const navigate = useNavigate();
  const [entrada, setEntrada] = useState(param ?? '');
  const [hashArquivo, setHashArquivo] = useState<string | null>(null);
  const codigo = param ? normalizarCodigo(param) : null;
  useEffect(() => { setEntrada(param ?? ''); setHashArquivo(null); }, [param]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['validar', codigo],
    enabled: !!codigo && codigoValido(codigo),
    queryFn: () => rpc<Resultado>('documento_validar', { p_codigo: codigo }),
    retry: false,
  });

  function buscar(e: React.FormEvent) {
    e.preventDefault();
    const c = normalizarCodigo(entrada);
    navigate(c ? `/validar/${c}` : '/validar');
  }

  const invalido = !!param && (!codigo || !codigoValido(codigo));
  const autentico = data?.encontrado && data.status === 'assinado';

  return (
    <CentralLayout titulo="Validar documento" subtitulo="Confira a autenticidade de um documento emitido pela FEMAF pelo código impresso no rodapé ou pelo QR Code.">
      <form onSubmit={buscar} className="mb-6 flex max-w-xl gap-2">
        <Input placeholder="IPD-XXXX-XXXX" value={entrada} onChange={(e) => setEntrada(e.target.value)} className="inst-field inst-num uppercase tracking-wider" aria-label="Código do documento" />
        <Button type="submit" className="h-11 rounded-md px-5"><FileSearch className="h-4 w-4" /> Validar</Button>
      </form>

      {invalido && <p className="text-sm text-destructive">Código inválido. Confira os 8 caracteres após "IPD".</p>}
      {isLoading && <p className="text-sm text-muted-foreground">Consultando…</p>}
      {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}

      {data && !data.encontrado && (
        <div className="flex max-w-3xl items-start gap-3 rounded-md border border-border border-l-4 border-l-destructive bg-card p-5">
          <ShieldX className="h-7 w-7 shrink-0 text-destructive" />
          <div><p className="font-semibold">Documento não encontrado</p><p className="text-sm text-muted-foreground">{data.erro ?? 'Nenhum documento com este código foi emitido pela FEMAF.'}</p></div>
        </div>
      )}

      {data?.encontrado && (
        <section className={cn('inst-entrar max-w-3xl rounded-md border border-border border-l-4 bg-card', autentico ? 'border-l-emerald-600' : 'border-l-amber-500')}>
          <header className="flex items-center gap-4 border-b border-border px-5 py-4">
            <Selo key={data.codigo} texto={autentico ? 'Documento autêntico' : data.status === 'cancelado' ? 'Documento cancelado' : 'Assinaturas pendentes'}
              tom={autentico ? 'verde' : 'ambar'} icone={autentico ? 'check' : 'alerta'} className="h-24 w-24 shrink-0" />
            <div>
              <p className="inst-title text-xl">{autentico ? 'Documento autêntico' : data.status === 'cancelado' ? 'Documento cancelado' : 'Aguardando assinaturas'}</p>
              <p className="text-xs text-muted-foreground">Consulta realizada em {dh(new Date().toISOString())}</p>
            </div>
          </header>
          <div className="space-y-5 px-5 py-5 text-sm">
            <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
              {[['Código', data.codigo], ['Tipo', data.tipo], ['Título', data.titulo], ['Titular', data.titular], ['Matrícula', data.matricula],
                ['Emitido em', dh(data.emitido_em)], ...(data.cancelado_em ? [['Cancelado em', dh(data.cancelado_em)]] : [])]
                .filter(([, v]) => v).map(([k, v]) => (
                  <div key={k}><dt className="inst-kicker">{k}</dt><dd className="mt-1 break-words">{v}</dd></div>
                ))}
            </dl>
            <div>
              <p className="inst-kicker mb-2">Assinaturas eletrônicas</p>
              <ul className="divide-y divide-border rounded-md border border-border">
                {(data.signatarios ?? []).map((s, i) => (
                  <li key={i} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5">
                    <span><span className="font-medium">{s.nome ?? '—'}</span> <span className="text-muted-foreground">· {s.cargo}</span></span>
                    <span className="text-xs text-muted-foreground">{s.status === 'assinado' ? `Assinado em ${dh(s.assinado_em)}` : 'Pendente'}</span>
                  </li>
                ))}
              </ul>
            </div>
            {data.sha256 && (
              <div className="space-y-2 rounded-md border border-border p-4">
                <p className="text-xs text-muted-foreground">Compare com o seu arquivo (o PDF não sai do seu aparelho):</p>
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-primary">
                  <Upload className="h-4 w-4" /> Escolher PDF
                  <input type="file" accept="application/pdf" className="hidden" onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) setHashArquivo(await sha256Hex(await f.arrayBuffer()));
                  }} />
                </label>
                {hashArquivo && (hashArquivo === data.sha256
                  ? <p className="font-medium text-emerald-700 dark:text-emerald-300">O arquivo é idêntico ao documento registrado.</p>
                  : <p className="font-medium text-destructive">O arquivo NÃO corresponde ao documento registrado.</p>)}
                <p className="break-all inst-num text-[11px] text-muted-foreground">SHA-256: {data.sha256}</p>
              </div>
            )}
          </div>
        </section>
      )}
    </CentralLayout>
  );
}
