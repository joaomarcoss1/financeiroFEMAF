// Envia Web Push para inscrições filtradas (professor_id ou destino_role).
// Requer autenticação: somente service_role (chamadas internas de outras edge functions)
// ou usuários autenticados com role 'admin' podem invocar.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "https://esm.sh/web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@femaf.edu.br";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
}

function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    // ----- Authentication / Authorization -----
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const token = authHeader.replace("Bearer ", "").trim();
    const claims = decodeJwtPayload(token);
    if (!claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let isService = claims.role === "service_role";
    let isAdmin = false;
    if (!isService) {
      // Verify user JWT + admin role
      const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await userClient.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: roleRow } = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin").maybeSingle();
      isAdmin = !!roleRow;
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
      return new Response(JSON.stringify({ error: "VAPID não configurado" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const body = await req.json().catch(() => ({}));
    const { professor_id, destino_role, titulo, mensagem, url } = body || {};

    // Basic input validation
    if (typeof titulo !== "string" || titulo.length < 1 || titulo.length > 200) {
      return new Response(JSON.stringify({ error: "titulo inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (typeof mensagem !== "string" || mensagem.length < 1 || mensagem.length > 1000) {
      return new Response(JSON.stringify({ error: "mensagem inválida" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (destino_role && !["admin", "professor", "broadcast"].includes(destino_role)) {
      return new Response(JSON.stringify({ error: "destino_role inválido" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const safeUrl = typeof url === "string" && /^\/[A-Za-z0-9/_\-?=&%.]*$/.test(url) ? url : "/";

    let q = supabase.from("push_subscriptions").select("*");
    if (professor_id) q = q.eq("professor_id", professor_id);
    else if (destino_role) q = q.eq("role", destino_role);
    const { data: subs, error } = await q;
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const payload = JSON.stringify({ title: titulo, body: mensagem, url: safeUrl });
    const results = await Promise.allSettled((subs || []).map(async (s: any) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
      } catch (err: any) {
        const status = err?.statusCode;
        if (status === 410 || status === 404) {
          await supabase.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
        }
        throw err;
      }
    }));

    const ok = results.filter(r => r.status === "fulfilled").length;
    const fail = results.length - ok;
    return new Response(JSON.stringify({ enviadas: ok, falhas: fail, total: results.length }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
