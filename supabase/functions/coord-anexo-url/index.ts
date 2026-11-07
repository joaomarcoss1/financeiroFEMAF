// Gera uma URL assinada de curta duração para o anexo (atestado/justificativa)
// de um registro de ponto, para a tela de Coordenação — que não usa Supabase
// Auth (login é PIN), então não pode chamar storage.createSignedUrl direto do
// navegador (RLS de storage.objects exige sessão authenticated + admin).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BUCKET = "justificativas";
const TTL_SECONDS = 300;

function extractPath(raw: string): string {
  const marker = `/object/public/${BUCKET}/`;
  const idx = raw.indexOf(marker);
  if (idx !== -1) return decodeURIComponent(raw.slice(idx + marker.length));
  return raw.replace(/^\/+/, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { prof_id, pin, registro_id } = await req.json().catch(() => ({}));
    if (!prof_id || !pin || !registro_id) {
      return new Response(JSON.stringify({ error: "parâmetros obrigatórios" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: cursos, error: coordErr } = await supabase.rpc("_coord_validate", { p_prof_id: prof_id, p_pin: pin });
    if (coordErr || !cursos) {
      return new Response(JSON.stringify({ error: "Credenciais inválidas" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: reg, error: regErr } = await supabase
      .from("registros_ponto")
      .select("anexo_url, turma_id")
      .eq("id", registro_id)
      .maybeSingle();
    if (regErr || !reg || !reg.anexo_url) {
      return new Response(JSON.stringify({ error: "Anexo não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: turma } = await supabase.from("turmas").select("curso_id").eq("id", reg.turma_id).maybeSingle();
    if (!turma || !(cursos as string[]).includes(turma.curso_id)) {
      return new Response(JSON.stringify({ error: "Sem permissão para este curso" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const path = extractPath(reg.anexo_url as string);
    const { data: signed, error: signErr } = await supabase.storage.from(BUCKET).createSignedUrl(path, TTL_SECONDS);
    if (signErr || !signed?.signedUrl) {
      return new Response(JSON.stringify({ error: "Falha ao gerar link do anexo" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ ok: true, url: signed.signedUrl }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
