// Edge Function: registrar-ponto
// Valida PIN, geofence, grade. Retroativos viram PENDENTE para aprovação admin.
// Suporta substituição: professor substituto registra ponto contra a grade do substituído.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const DEFAULT_FEMAF_LAT = -4.5635410; // FEMAF – Av. Dr. João Alberto, 100, Pedreiras-MA
const DEFAULT_FEMAF_LNG = -44.5994555;
const DEFAULT_RAIO_PERMITIDO_METROS = 900;
const DEFAULT_MINUTOS_POR_HORARIO = 50;

function calcularDistancia(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface Payload {
  professor_id: string;
  materia_id: string;
  turma_id: string;
  data: string;
  horarios: number[];
  observacao?: string | null;
  pin: string;
  latitude: number;
  longitude: number;
  retroativo?: boolean;
  justificativa?: string | null;
  anexo_url?: string | null;
  // Substituição: id do professor que está sendo substituído
  professor_substituido_id?: string | null;
}

function diaSemanaFromISO(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).getDay();
}

function todayBrasiliaISO(): string {
  // Fortaleza/Maranhão (UTC-3, sem horário de verão) — robusto via Intl
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Fortaleza',
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
  return fmt.format(new Date()); // YYYY-MM-DD
}

function validate(p: any): { ok: true; data: Payload } | { ok: false; msg: string } {
  if (!p || typeof p !== "object") return { ok: false, msg: "payload inválido" };
  const required = ["professor_id","materia_id","turma_id","data","horarios","pin","latitude","longitude"];
  for (const k of required) {
    if (p[k] === undefined || p[k] === null || p[k] === "") {
      return { ok: false, msg: `campo obrigatório: ${k}` };
    }
  }
  if (!Array.isArray(p.horarios) || p.horarios.length === 0) return { ok: false, msg: "horários inválidos" };
  if (!p.horarios.every((h: any) => Number.isInteger(h) && h >= 1 && h <= 8)) return { ok: false, msg: "horários fora do intervalo 1-8" };
  if (typeof p.latitude !== "number" || typeof p.longitude !== "number") return { ok: false, msg: "coordenadas inválidas" };
  if (typeof p.pin !== "string" || p.pin.length < 4 || p.pin.length > 6) return { ok: false, msg: "PIN inválido" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.data)) return { ok: false, msg: "data inválida (use YYYY-MM-DD)" };
  return { ok: true, data: p as Payload };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => null);
    const v = validate(body);
    if (!v.ok) return new Response(JSON.stringify({ error: v.msg }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const p = v.data;

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Carrega settings dinâmicas (geofence + minutos_por_horario)
    const { data: cfgRow } = await supabase.from("app_settings").select("data").eq("id", "global").maybeSingle();
    const cfg: any = cfgRow?.data || {};
    const FEMAF_LAT = Number(cfg?.geofence?.lat ?? DEFAULT_FEMAF_LAT);
    const FEMAF_LNG = Number(cfg?.geofence?.lng ?? DEFAULT_FEMAF_LNG);
    const RAIO_PERMITIDO_METROS = Number(cfg?.geofence?.raio_m ?? DEFAULT_RAIO_PERMITIDO_METROS);
    const MINUTOS_POR_HORARIO = Number(cfg?.minutos_por_horario ?? DEFAULT_MINUTOS_POR_HORARIO);

    const dist = calcularDistancia(p.latitude, p.longitude, FEMAF_LAT, FEMAF_LNG);
    if (dist > RAIO_PERMITIDO_METROS) {
      return new Response(JSON.stringify({ error: `Fora da área permitida (${Math.round(dist)}m). Máximo: ${RAIO_PERMITIDO_METROS}m` }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }


    const { data: prof, error: profErr } = await supabase
      .from("professores").select("id, status, valor_hora_aula, nome").eq("id", p.professor_id).maybeSingle();

    if (profErr || !prof) return new Response(JSON.stringify({ error: "Professor não encontrado" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    if (prof.status !== "ativo") return new Response(JSON.stringify({ error: "Professor inativo" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // PIN é validado (hash + bloqueio por tentativas) dentro do banco via
    // _prof_validate — o hash nunca trafega para esta função.
    const { error: pinErr } = await supabase.rpc("_prof_validate", { p_prof_id: p.professor_id, p_pin: p.pin });
    if (pinErr) {
      const msg = /muitas tentativas/i.test(pinErr.message) ? pinErr.message : "PIN incorreto";
      return new Response(JSON.stringify({ error: msg }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const hoje = todayBrasiliaISO();
    if (p.data > hoje) return new Response(JSON.stringify({ error: "Data futura não permitida" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const isRetroativo = p.data < hoje;
    const isSubstituicao = !!p.professor_substituido_id;

    if (isRetroativo) {
      if (!p.justificativa || p.justificativa.trim().length < 5) {
        return new Response(JSON.stringify({ error: "Justificativa obrigatória para data retroativa" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Calendário acadêmico: bloqueia feriados, recessos, domingo e sábado não letivo.
    const { data: calRow } = await supabase
      .from("calendario_academico").select("tipo, descricao").eq("data", p.data).maybeSingle();
    const dow = new Date(p.data + "T12:00:00").getUTCDay();
    if (calRow && (calRow.tipo === "feriado" || calRow.tipo === "recesso")) {
      return new Response(JSON.stringify({ error: `Sem aula em ${p.data}: ${calRow.descricao} (${calRow.tipo}).` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!calRow) {
      if (dow === 0) return new Response(JSON.stringify({ error: "Domingo não é dia letivo." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (dow === 6) return new Response(JSON.stringify({ error: "Sábado não letivo. Solicite reposição/sábado letivo no calendário." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Para substituição, valida grade do PROFESSOR SUBSTITUÍDO; senão, do próprio professor.
    const profGradeId = isSubstituicao ? p.professor_substituido_id! : p.professor_id;
    const dia = diaSemanaFromISO(p.data);
    const { data: grade, error: gradeErr } = await supabase
      .from("horarios_aula").select("horario_id")
      .eq("professor_id", profGradeId)
      .eq("materia_id", p.materia_id)
      .eq("turma_id", p.turma_id)
      .eq("dia_semana", dia);

    if (gradeErr) return new Response(JSON.stringify({ error: gradeErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const permitidos = new Set((grade || []).map((g: any) => g.horario_id));
    if (permitidos.size === 0) {
      const msg = isSubstituicao
        ? "O professor substituído não tem aula prevista neste dia/disciplina/turma"
        : "Não há aula prevista na grade para este dia/disciplina/turma";
      return new Response(JSON.stringify({ error: msg }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const invalidos = p.horarios.filter((h) => !permitidos.has(h));
    if (invalidos.length > 0) {
      return new Response(JSON.stringify({ error: `Horário(s) ${invalidos.join(", ")} fora da grade. Permitidos: ${[...permitidos].sort().join(", ")}` }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Substituição exige nome do substituído na observação automaticamente
    let obsFinal = p.observacao || null;
    let profSubstNome: string | null = null;
    if (isSubstituicao) {
      const { data: substProf } = await supabase.from("professores").select("nome").eq("id", p.professor_substituido_id!).maybeSingle();
      profSubstNome = substProf?.nome ?? null;
      const tag = `SUBSTITUIÇÃO de ${profSubstNome || "professor"}`;
      obsFinal = obsFinal ? `[${tag}] ${obsFinal}` : `[${tag}]`;
    }

    const qtd = p.horarios.length;
    const cargaHoraria = qtd * MINUTOS_POR_HORARIO;
    const valorTotal = qtd * Number(prof.valor_hora_aula || 0);

    // Status: retroativo OU substituição => pendente; senão aprovado
    const statusAprovacao = (isRetroativo || isSubstituicao) ? "pendente" : "aprovado";

    const { data: inserted, error: insErr } = await supabase
      .from("registros_ponto")
      .insert({
        professor_id: p.professor_id,
        materia_id: p.materia_id,
        turma_id: p.turma_id,
        data: p.data,
        horarios: p.horarios,
        quantidade_horarios: qtd,
        carga_horaria: cargaHoraria,
        valor_total: valorTotal,
        observacao: obsFinal,
        latitude: p.latitude,
        longitude: p.longitude,
        retroativo: isRetroativo,
        justificativa: isRetroativo ? p.justificativa : null,
        anexo_url: isRetroativo ? (p.anexo_url || null) : null,
        substituicao: isSubstituicao,
        professor_substituido_id: isSubstituicao ? p.professor_substituido_id : null,
        status_aprovacao: statusAprovacao,
        aprovado_em: statusAprovacao === "aprovado" ? new Date().toISOString() : null,
      })
      .select().single();

    if (insErr) {
      const msg = (insErr.message || "").toLowerCase();
      if (msg.includes("já registrado") || msg.includes("unique")) {
        return new Response(JSON.stringify({ error: "Duplicidade: horário já registrado neste dia" }), { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: insErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Cria notificação para admins se for pendente
    if (statusAprovacao === "pendente") {
      const tipoNotif = isSubstituicao ? "substituicao_pendente" : "retroativo_pendente";
      const titulo = isSubstituicao ? "Nova substituição aguardando aprovação" : "Novo ponto retroativo aguardando aprovação";
      const mensagem = isSubstituicao
        ? `${prof.nome} solicitou substituir ${profSubstNome || ""} em ${p.data}.`
        : `${prof.nome} lançou ponto retroativo em ${p.data}.`;
      await supabase.from("notificacoes").insert({
        destino_role: "admin",
        tipo: tipoNotif,
        titulo,
        mensagem,
        link: "/admin/registros",
      });
      // Dispara push para admins (best-effort)
      try {
        await supabase.functions.invoke("send-push", {
          body: { destino_role: "admin", titulo, mensagem, url: "/admin/registros" },
        });
      } catch (_) {}
    }

    return new Response(JSON.stringify({
      ok: true, registro: inserted, valor_total: valorTotal, carga_horaria: cargaHoraria, quantidade_horarios: qtd,
      status_aprovacao: statusAprovacao,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
