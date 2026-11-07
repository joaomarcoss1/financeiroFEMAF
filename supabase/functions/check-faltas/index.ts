// Cron: detecta professores que não bateram ponto.
// - 10 min após início da aula sem ponto => alerta professor.
// - Após fim da aula sem ponto => alerta admin.
// Idempotente: usa "tipo" único por (professor, data, horario_id, fase) na tabela notificacoes.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Fallback só para quando app_settings.horarios não carregar — os horários
// reais (incluindo o turno vespertino, ids 5-8) vêm de app_settings, a
// mesma fonte usada no resto do sistema. Antes esta lista ficava travada
// aqui em 4 itens (só o turno noturno) e nenhum professor do vespertino
// jamais recebia lembrete de ponto nem gerava alerta de falta pro admin.
const HORARIOS_FALLBACK = [
  { id: 1, inicio: "18:30", fim: "19:20" },
  { id: 2, inicio: "19:20", fim: "20:10" },
  { id: 3, inicio: "20:20", fim: "21:10" },
  { id: 4, inicio: "21:10", fim: "22:00" },
];

function brasiliaNow(): Date {
  return new Date(Date.now() - 3 * 3600 * 1000);
}
function isoDate(d: Date): string { return d.toISOString().slice(0, 10); }
function hhmm(d: Date): string { return d.toISOString().slice(11, 16); }
function addMin(hhmm: string, min: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  const total = h * 60 + m + min;
  const nh = Math.floor(total / 60), nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    // Restrict invocation: require CRON_SECRET header OR a service_role JWT (internal scheduler).
    const cronSecret = Deno.env.get("CRON_SECRET");
    const provided = req.headers.get("x-cron-secret") || "";
    const authHeader = req.headers.get("Authorization") || "";
    let allowed = false;
    if (cronSecret && provided && provided === cronSecret) allowed = true;
    if (!allowed && authHeader.startsWith("Bearer ")) {
      try {
        const parts = authHeader.replace("Bearer ", "").trim().split(".");
        if (parts.length >= 2) {
          const p = parts[1].replace(/-/g, "+").replace(/_/g, "/");
          const padded = p + "=".repeat((4 - (p.length % 4)) % 4);
          const claims = JSON.parse(atob(padded));
          if (claims.role === "service_role") allowed = true;
        }
      } catch { /* ignore */ }
    }
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const now = brasiliaNow();
    const dataHoje = isoDate(now);
    const agora = hhmm(now);
    const dia = now.getUTCDay(); // 0..6 — em UTC o offset já foi aplicado

    // Feriado/recesso: sem aula, não gera lembrete nem alerta de falta —
    // mesma regra do registrar-ponto. Sem isso, qualquer feriado que caia
    // num dia com grade normal cadastrada disparava alertas falsos de
    // "não bateu ponto" pro admin e "bata o ponto" pro professor.
    const { data: calRow } = await supabase
      .from("calendario_academico").select("tipo, descricao").eq("data", dataHoje).maybeSingle();
    if (calRow && (calRow.tipo === "feriado" || calRow.tipo === "recesso")) {
      return new Response(JSON.stringify({ ok: true, msg: `sem aula hoje: ${calRow.descricao} (${calRow.tipo})` }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Horários reais cadastrados (inclui o turno vespertino, ids 5-8) —
    // mesma fonte usada no resto do sistema (app_settings.horarios).
    const { data: cfgRow } = await supabase.from("app_settings").select("data").eq("id", "global").maybeSingle();
    const horariosCfg = (cfgRow?.data as { horarios?: { id: number; inicio: string; fim: string }[] } | null)?.horarios;
    const HORARIOS = horariosCfg && horariosCfg.length > 0 ? horariosCfg : HORARIOS_FALLBACK;

    // Busca grade do dia
    const { data: grade } = await supabase
      .from("horarios_aula")
      .select("professor_id, materia_id, turma_id, horario_id")
      .eq("dia_semana", dia);

    if (!grade || grade.length === 0) return new Response(JSON.stringify({ ok: true, msg: "sem aulas hoje" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Pontos batidos hoje
    const { data: regs } = await supabase
      .from("registros_ponto").select("professor_id, materia_id, turma_id, horarios")
      .eq("data", dataHoje).neq("status_aprovacao", "rejeitado");

    function jaBateu(prof: string, mat: string, turma: string, hid: number) {
      return (regs || []).some(r => r.professor_id === prof && r.materia_id === mat && r.turma_id === turma && (r.horarios as number[]).includes(hid));
    }

    // Notificações já criadas hoje (para idempotência)
    const { data: notifs } = await supabase
      .from("notificacoes").select("tipo")
      .gte("created_at", `${dataHoje}T00:00:00Z`);
    const tiposExistentes = new Set((notifs || []).map(n => n.tipo));

    // Cache de nomes
    const profIds = [...new Set(grade.map(g => g.professor_id))];
    const matIds = [...new Set(grade.map(g => g.materia_id))];
    const turmaIds = [...new Set(grade.map(g => g.turma_id))];
    const [{ data: profs }, { data: mats }, { data: turmas }] = await Promise.all([
      supabase.from("professores").select("id, nome").in("id", profIds),
      supabase.from("materias").select("id, nome").in("id", matIds),
      supabase.from("turmas").select("id, nome").in("id", turmaIds),
    ]);
    const nomeProf = new Map((profs || []).map((p: any) => [p.id, p.nome]));
    const nomeMat = new Map((mats || []).map((m: any) => [m.id, m.nome]));
    const nomeTurma = new Map((turmas || []).map((t: any) => [t.id, t.nome]));

    const novosNotifs: any[] = [];
    const pushQueue: { professor_id?: string; destino_role?: string; titulo: string; mensagem: string }[] = [];

    for (const g of grade) {
      const h = HORARIOS.find(x => x.id === g.horario_id);
      if (!h) continue;
      if (jaBateu(g.professor_id, g.materia_id, g.turma_id, g.horario_id)) continue;

      const inicio10 = addMin(h.inicio, 10);
      const profKey = `lembrete_${g.professor_id}_${g.materia_id}_${g.turma_id}_${g.horario_id}_${dataHoje}`;
      const adminKey = `falta_${g.professor_id}_${g.materia_id}_${g.turma_id}_${g.horario_id}_${dataHoje}`;

      const profNome = nomeProf.get(g.professor_id) || "Professor";
      const matNome = nomeMat.get(g.materia_id) || "";
      const turmaNome = nomeTurma.get(g.turma_id) || "";

      // 10 min após início — lembrete ao professor
      if (agora >= inicio10 && agora < h.fim && !tiposExistentes.has(profKey)) {
        novosNotifs.push({
          destino_role: "professor", professor_id: g.professor_id, tipo: profKey,
          titulo: "⏰ Não esqueça do ponto!",
          mensagem: `Sua aula de ${matNome} (${turmaNome}) começou. Bata o ponto agora.`,
          link: "/",
        });
        pushQueue.push({ professor_id: g.professor_id, titulo: "⏰ Não esqueça do ponto!", mensagem: `Sua aula de ${matNome} (${turmaNome}) começou. Bata o ponto.` });
      }

      // Após fim — alerta admin
      if (agora >= h.fim && !tiposExistentes.has(adminKey)) {
        novosNotifs.push({
          destino_role: "admin", tipo: adminKey,
          titulo: "🚨 Professor não bateu ponto",
          mensagem: `${profNome} terminou ${matNome} (${turmaNome}) às ${h.fim} sem registrar.`,
          link: "/admin/registros",
        });
        pushQueue.push({ destino_role: "admin", titulo: "🚨 Professor não bateu ponto", mensagem: `${profNome} terminou ${matNome} (${turmaNome}) sem registrar.` });
      }
    }

    if (novosNotifs.length > 0) {
      await supabase.from("notificacoes").insert(novosNotifs);
    }
    // Dispara pushes
    await Promise.allSettled(pushQueue.map(p =>
      supabase.functions.invoke("send-push", { body: { ...p, url: p.destino_role === "admin" ? "/admin/registros" : "/" } })
    ));

    return new Response(JSON.stringify({ ok: true, notifs: novosNotifs.length, pushes: pushQueue.length, agora, dia }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
