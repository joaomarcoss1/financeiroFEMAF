import { supabase } from '@/integrations/supabase/client';
import { sha256Hex } from '@/features/documentos/lib/sha256';
import type { AnexoEnviado } from '../lib/types';

const nomeSeguro = (n: string) =>
  n.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').slice(-80);

/** Envia um arquivo para protocolos/{aluno}/{protocolo}/{uuid}-{nome}. */
export async function enviarAnexo(alunoId: string, protocoloId: string, file: File, tipoAnexo: string): Promise<AnexoEnviado> {
  const path = `${alunoId}/${protocoloId}/${crypto.randomUUID()}-${nomeSeguro(file.name)}`;
  const [{ error }, sha256] = await Promise.all([
    supabase.storage.from('protocolos').upload(path, file, { contentType: file.type, upsert: false }),
    file.arrayBuffer().then(sha256Hex),
  ]);
  if (error) throw new Error(`Falha ao enviar ${file.name}: ${error.message}`);
  return { tipo_anexo: tipoAnexo, nome_arquivo: file.name, storage_path: path, sha256, mime: file.type, tamanho: file.size };
}

/** URL assinada (60 s) — o bucket só libera para quem pode ver o protocolo. */
export async function urlAnexo(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('protocolos').createSignedUrl(path, 60);
  if (error || !data) throw new Error('Não foi possível abrir o anexo.');
  return data.signedUrl;
}
