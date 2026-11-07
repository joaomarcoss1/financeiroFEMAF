// Edge Function: prova-checklist
// Validação "a seco": roda o checklist do modelo padrão sobre um PDF já
// enviado ao bucket provas-envios, sem criar registro de prova. Usado pelo
// front para dar feedback imediato (quesito a quesito) assim que o professor
// escolhe o arquivo, antes de preencher o resto do formulário.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => null);
    const arquivoPath = body?.arquivo_path as string | undefined;
    const modeloId = body?.modelo_id as string | undefined;
    if (!arquivoPath || !arquivoPath.toLowerCase().endsWith(".pdf")) {
      return json({ error: "arquivo_path (PDF) é obrigatório" }, 400);
    }

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let checklist: ChecklistRule[] = CHECKLIST_PADRAO_FEMAF;
    if (modeloId) {
      const { data: modelo } = await supabase.from("prova_modelos").select("checklist, ativo").eq("id", modeloId).maybeSingle();
      if (modelo?.checklist) checklist = modelo.checklist as ChecklistRule[];
    } else {
      const { data: modelo } = await supabase.from("prova_modelos").select("checklist").eq("ativo", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (modelo?.checklist) checklist = modelo.checklist as ChecklistRule[];
    }

    const { data: fileBlob, error: dlErr } = await supabase.storage.from("provas-envios").download(arquivoPath);
    if (dlErr || !fileBlob) return json({ error: "Não foi possível ler o arquivo enviado" }, 400);
    const bytes = new Uint8Array(await fileBlob.arrayBuffer());

    const pages = await extractPdfPages(bytes);
    const resultado = runChecklist(fullText(pages), checklist);

    return json({ ok: resultado.ok, itens: resultado.itens, primeiroErro: resultado.primeiroErro });
  } catch (e) {
    return json({ error: `Não foi possível ler o PDF enviado: ${(e as Error).message}` }, 400);
  }
});
