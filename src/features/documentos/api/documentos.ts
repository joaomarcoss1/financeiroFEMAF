import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { academicoDb, rpc } from '@/features/protocolos/api/db';
import logoFemaf from '@/assets/logo-femaf.png';
import { carregarDataUrl, renderDocumentoPdf, type AssinaturaRender, type SnapshotDocumento } from '../lib/renderPdf';
import { sha256Hex } from '../lib/sha256';

export interface DocumentoCompleto {
  id: string;
  codigo: string;
  modelo_id: string;
  titulo: string;
  aluno_id: string | null;
  protocolo_id: string | null;
  snapshot: SnapshotDocumento;
  storage_path: string | null;
  sha256: string | null;
  status: 'aguardando_assinatura' | 'assinado' | 'cancelado';
  emitido_em: string;
  cancelado_motivo: string | null;
  pode_assinar: boolean;
  assinaturas: AssinaturaRender[];
}

export interface DocumentoLista {
  id: string; codigo: string; titulo: string; modelo_id: string; status: DocumentoCompleto['status'];
  storage_path: string | null; emitido_em: string; protocolo_id: string | null; aluno_id: string | null;
  aluno: { nome?: string; matricula?: string } | null;
}

export interface ParaAssinar { id: string; codigo: string; titulo: string; modelo_id: string; emitido_em: string; aluno_nome: string | null; papel: string; cargo: string | null }

export const urlValidacao = (codigo: string) => `${window.location.origin}/validar/${codigo}`;

/** Documentos visíveis pela RLS (aluno: os próprios; secretaria: todos). */
export const useDocumentos = (filtro: { alunoId?: string } = {}) =>
  useQuery({
    queryKey: ['documentos', filtro],
    queryFn: async () => {
      let q = academicoDb.from('documentos')
        .select('id, codigo, titulo, modelo_id, status, storage_path, emitido_em, protocolo_id, aluno_id, aluno:snapshot->aluno')
        .order('emitido_em', { ascending: false })
        .limit(500); // shortcut: lista os 500 mais recentes; paginar quando o volume crescer
      if (filtro.alunoId) q = q.eq('aluno_id', filtro.alunoId);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as DocumentoLista[];
    },
  });

export const useParaAssinar = () =>
  useQuery({ queryKey: ['para_assinar'], queryFn: () => rpc<ParaAssinar[]>('documentos_para_assinar'), refetchInterval: 60_000 });

export const obterDocumento = (id: string) => rpc<DocumentoCompleto>('documento_obter', { p_id: id });

let logoCache: Promise<string | undefined> | null = null;
const logo = () => (logoCache ??= carregarDataUrl(logoFemaf));

async function gerarPdf(doc: DocumentoCompleto): Promise<Uint8Array> {
  return renderDocumentoPdf({
    snapshot: doc.snapshot,
    assinaturas: doc.assinaturas,
    codigo: doc.codigo,
    status: doc.status,
    urlValidacao: urlValidacao(doc.codigo),
    logoDataUrl: await logo(),
  });
}

/**
 * Devolve o PDF do documento. Se já assinado por todos e ainda sem arquivo, gera, envia ao bucket
 * e registra o SHA-256 (uma única vez; só a equipe registra). Pendente ⇒ prévia local com marca d'água.
 */
export async function obterPdf(id: string, registrar = false): Promise<{ blob: Blob; nome: string }> {
  const doc = await obterDocumento(id);
  const nome = `${doc.codigo}.pdf`;
  if (doc.storage_path) {
    const { data, error } = await supabase.storage.from('documentos').download(doc.storage_path);
    if (!error && data) return { blob: data, nome };
  }
  const bytes = await gerarPdf(doc);
  const blob = new Blob([bytes], { type: 'application/pdf' });
  if (registrar && doc.status === 'assinado' && !doc.storage_path) {
    const sha = await sha256Hex(bytes);
    // Renderização determinística: se outro cliente já enviou, o conteúdo é o mesmo.
    await supabase.storage.from('documentos').upload(`${doc.id}.pdf`, blob, { contentType: 'application/pdf', upsert: false });
    await rpc('documento_registrar_arquivo', { p_id: doc.id, p_sha256: sha }).catch(() => undefined);
  }
  return { blob, nome };
}

export function baixarBlob(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function useAssinar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (v: { id: string; email: string; senha: string }) => {
      // Reautenticação: caracteriza a assinatura eletrônica avançada (Lei 14.063/2020).
      const { error } = await supabase.auth.signInWithPassword({ email: v.email, password: v.senha });
      if (error) throw new Error('Senha incorreta.');
      const r = await rpc<{ completo: boolean }>('documento_assinar', { p_id: v.id, p_user_agent: navigator.userAgent });
      if (r.completo) await obterPdf(v.id, true).catch(() => undefined); // gera e registra o PDF final
      return r;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['para_assinar'] });
      void qc.invalidateQueries({ queryKey: ['documentos'] });
      void qc.invalidateQueries({ queryKey: ['protocolo'] });
    },
  });
}
