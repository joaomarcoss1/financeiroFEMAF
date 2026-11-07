import { supabase } from '@/integrations/supabase/client';

const BUCKET = 'justificativas';
const SIGNED_URL_TTL_SECONDS = 300;

/**
 * O bucket de anexos é privado. Registros antigos guardam a URL pública
 * completa (formato .../object/public/justificativas/<path>); registros
 * novos guardam só o <path>. Em ambos os casos, abrir o anexo exige gerar
 * uma URL assinada de curta duração — nunca reusar a URL antiga direto.
 */
function extractPath(raw: string): string {
  const marker = `/object/public/${BUCKET}/`;
  const idx = raw.indexOf(marker);
  if (idx !== -1) return decodeURIComponent(raw.slice(idx + marker.length));
  return raw.replace(/^\/+/, '');
}

export async function getAnexoSignedUrl(raw: string | null | undefined): Promise<string | null> {
  if (!raw) return null;
  const path = raw.startsWith('http') ? extractPath(raw) : raw;
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
