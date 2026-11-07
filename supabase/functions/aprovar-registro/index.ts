// Aprova ou rejeita um registro_ponto pendente. Apenas admins.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") || "";
    const jwt = auth.replace(/^Bearer\s+/i, "");
    if (!jwt) return new Response(JSON.stringify({ error: "não autenticado" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supaUser = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const { data: userData } = await supaUser.auth.getUser();
    const user = userData?.user;
    if (!user) return new Response(JSON.stringify({ error: "sessão inválida" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
    if (!roleRow) return new Response(JSON.stringify({ error: "permissão negada" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { registro_id, acao, motivo } = await req.json();
    if (!registro_id || !["aprovar", "rejeitar"].includes(acao)) {
      return new Response(JSON.stringify({ error: "parâmetros inválidos" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (acao === "rejeitar" && (!motivo || String(motivo).trim().length < 3)) {
      return new Response(JSON.stringify({ error: "motivo obrigatório para rejeição" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const novoStatus = acao === "aprovar" ? "aprovado" : "rejeitado";
    const { data: reg, error } = await admin.from("registros_ponto").update({
      status_aprovacao: novoStatus,
      aprovado_por: user.id,
      aprovado_em: new Date().toISOString(),
      motivo_rejeicao: acao === "rejeitar" ? motivo : null,
    }).eq("id", registro_id).select("*, professor:professores!registros_ponto_professor_id_fkey(nome)").single();

    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Busca nome do professor (sem depender de FK declarada)
    const { data: profRow } = await admin.from("professores").select("nome").eq("id", reg.professor_id).maybeSingle();
    const profNome = profRow?.nome || "";

    // Notifica professor (in-app)
    const titulo = acao === "aprovar" ? "Ponto aprovado ✅" : "Ponto rejeitado ❌";
    const mensagem = acao === "aprovar"
      ? `Seu lançamento de ${reg.data} foi aprovado.`
      : `Seu lançamento de ${reg.data} foi rejeitado. Motivo: ${motivo}`;
    await admin.from("notificacoes").insert({
      destino_role: "professor", professor_id: reg.professor_id,
      tipo: `aprovacao_${novoStatus}`, titulo, mensagem, link: "/",
    });
    try {
      await admin.functions.invoke("send-push", {
        body: { professor_id: reg.professor_id, titulo, mensagem, url: "/" },
      });
    } catch (_) {}

    return new Response(JSON.stringify({ ok: true, registro: reg }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
