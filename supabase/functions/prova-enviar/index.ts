// Edge Function: prova-enviar
// Recebe a submissão de uma prova pelo professor (PIN-gated). O arquivo PDF já
// deve ter sido enviado pelo cliente diretamente ao bucket privado
// "provas-envios" (caminho: {professor_id}/{arquivo}.pdf); aqui recebemos só o
// caminho + metadados, baixamos o arquivo com a service_role key, rodamos o
// checklist do modelo ativo e só então liberamos (ou bloqueamos) a prova.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { extractPdfPages, fullText } from "../_shared/pdfEngine.ts";
import { runChecklist, CHECKLIST_PADRAO_FEMAF, type ChecklistRule } from "../_shared/checklist.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

interface Payload {
  professor_id: string;
  pin: string;
  titulo: string;
  materia_id: string;
  turma_id: string;
  data_prova: string;
  arquivo_path: string; // caminho dentro do bucket provas-envios
  modelo_id?: string | null;
}

function isProvasAtivo(cfg: any): boolean {
  const p = cfg?.provas;
  if (!p || !p.ativo) return false;
  const hoje = new Date().toISOString().slice(0, 10);
  if (p.data_inicio && hoje < p.data_inicio) return false;
  if (p.data_fim && hoje > p.data_fim) return false;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const body = (await req.json().catch(() => null)) as Payload | null;
    if (!body) return json({ error: "payload inválido" }, 400);
    const required: (keyof Payload)[] = ["professor_id", "pin", "titulo", "materia_id", "turma_id", "data_prova", "arquivo_path"];
    for (const k of required) {
      if (!body[k]) return json({ error: `campo obrigatório: ${k}` }, 400);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.data_prova)) return json({ error: "data da prova inválida" }, 400);
    if (!body.arquivo_path.startsWith(`${body.professor_id}/`) || !body.arquivo_path.toLowerCase().endsWith(".pdf")) {
      return json({ error: "arquivo inválido" }, 400);
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: cfgRow } = await supabase.from("app_settings").select("data").eq("id", "global").maybeSingle();
    if (!isProvasAtivo(cfgRow?.data)) {
      return json({ error: "O período de envio de provas está fechado no momento." }, 403);
    }

    const { data: prof, error: profErr } = await supabase
      .from("professores").select("id, nome, status").eq("id", body.professor_id).maybeSingle();
    if (profErr || !prof) return json({ error: "Professor não encontrado" }, 404);
    if (prof.status !== "ativo") return json({ error: "Professor inativo" }, 403);

    const { error: pinErr } = await supabase.rpc("_prof_validate", { p_prof_id: body.professor_id, p_pin: body.pin });
    if (pinErr) {
      const msg = /muitas tentativas/i.test(pinErr.message) ? pinErr.message : "PIN incorreto";
      return json({ error: msg }, 401);
    }

    const [{ data: materia }, { data: turma }] = await Promise.all([
      supabase.from("materias").select("id, nome").eq("id", body.materia_id).maybeSingle(),
      supabase.from("turmas").select("id, nome, curso_id, periodo").eq("id", body.turma_id).maybeSingle(),
    ]);
    if (!materia) return json({ error: "Disciplina não encontrada" }, 404);
    if (!turma) return json({ error: "Turma não encontrada" }, 404);

    // Modelo padrão a validar: o informado, ou o único/primeiro ativo
    let modeloId = body.modelo_id || null;
    let checklist: ChecklistRule[] = CHECKLIST_PADRAO_FEMAF;
    if (modeloId) {
      const { data: modelo } = await supabase.from("prova_modelos").select("id, checklist, ativo").eq("id", modeloId).maybeSingle();
      if (!modelo || !modelo.ativo) return json({ error: "Modelo de prova indisponível" }, 400);
      checklist = (modelo.checklist as ChecklistRule[]) || CHECKLIST_PADRAO_FEMAF;
    } else {
      const { data: modelo } = await supabase.from("prova_modelos").select("id, checklist").eq("ativo", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (modelo) {
        modeloId = modelo.id;
        checklist = (modelo.checklist as ChecklistRule[]) || CHECKLIST_PADRAO_FEMAF;
      }
    }

    const { data: fileBlob, error: dlErr } = await supabase.storage.from("provas-envios").download(body.arquivo_path);
    if (dlErr || !fileBlob) return json({ error: "Não foi possível ler o arquivo enviado" }, 400);
    const bytes = new Uint8Array(await fileBlob.arrayBuffer());

    let resultado;
    try {
      const pages = await extractPdfPages(bytes);
      resultado = runChecklist(fullText(pages), checklist);
    } catch (e) {
      return json({ error: `Não foi possível ler o PDF enviado: ${(e as Error).message}` }, 400);
    }

    const status = resultado.ok ? "aprovada" : "rejeitada";

    const { data: inserted, error: insErr } = await supabase
      .from("provas")
      .insert({
        professor_id: body.professor_id,
        titulo: body.titulo,
        materia_id: body.materia_id,
        turma_id: body.turma_id,
        modelo_id: modeloId,
        data_prova: body.data_prova,
        arquivo_original_url: body.arquivo_path,
        status,
        checklist_resultado: resultado.itens,
      })
      .select().single();

    if (insErr) return json({ error: insErr.message }, 500);

    await supabase.from("provas_audit_logs").insert({
      prova_id: inserted.id,
      actor: `professor:${body.professor_id}`,
      action: status === "aprovada" ? "envio_aprovado" : "envio_rejeitado",
      detalhe: { checklist: resultado.itens },
    });

    if (!resultado.ok) {
      // Remove o arquivo rejeitado do bucket — o professor deve reenviar corrigido.
      await supabase.storage.from("provas-envios").remove([body.arquivo_path]);
      return json({
        ok: false,
        error: resultado.primeiroErro || "A prova não atende ao modelo padrão.",
        checklist: resultado.itens,
      }, 422);
    }

    return json({ ok: true, prova: inserted, checklist: resultado.itens });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
