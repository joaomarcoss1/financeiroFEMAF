// Edge Function: prova-gerar
// Uso exclusivo do admin (JWT obrigatório — verify_jwt padrão). Gera, a partir
// da prova aprovada, uma cópia personalizada em PDF para cada aluno ativo da
// turma (com o nome do aluno inserido) e um PDF único com todas as cópias
// juntas, pronto para impressão em lote.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { extractPdfPages, overlayFields, mergePdfs, findAnchor, type OverlayField } from "../_shared/pdfEngine.ts";
import { CAMPOS_PADRAO_FEMAF, type CampoConfig } from "../_shared/checklist.ts";

// Tenta cada rótulo da lista, na ordem, e usa o primeiro que existir nesta
// prova — permite que o mesmo campo seja localizado em modelos levemente
// diferentes (ex.: "Aluno(a) / Assinatura:" no modelo oficial, "Aluno(a)"
// num modelo mais simples) sem travar a geração por um rótulo ausente.
function resolveAnchor(pages: Awaited<ReturnType<typeof extractPdfPages>>, anchors: string[]): string | null {
  for (const a of anchors) {
    if (findAnchor(pages, a)) return a;
  }
  return null;
}

// Listas de alunos importadas de planilha às vezes trazem o número da
// linha colado no início do nome (ex.: "1 Maria Silva", "30 João Souza") —
// resquício da coluna de numeração do Excel/CSV original. Isso não é parte
// do nome e não deve aparecer na prova impressa.
function limparNomeAluno(nome: string): string {
  return nome.replace(/^\d+[\s.)\-]+/, "").trim();
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const MAX_ALUNOS_POR_GERACAO = 300;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseAuth = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await supabaseAuth.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Não autenticado" }, 401);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userData.user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Acesso restrito a administradores" }, 403);

    const body = await req.json().catch(() => null);
    const provaId = body?.prova_id as string | undefined;
    if (!provaId) return json({ error: "prova_id é obrigatório" }, 400);

    const { data: prova, error: provaErr } = await supabase
      .from("provas")
      .select("id, titulo, professor_id, materia_id, turma_id, data_prova, arquivo_original_url, status")
      .eq("id", provaId).maybeSingle();
    if (provaErr || !prova) return json({ error: "Prova não encontrada" }, 404);
    if (prova.status !== "aprovada") return json({ error: "Só é possível gerar cópias de provas aprovadas no checklist" }, 400);

    const [{ data: professor }, { data: materia }, { data: turma }, { data: modeloAtivo }] = await Promise.all([
      supabase.from("professores").select("nome").eq("id", prova.professor_id).maybeSingle(),
      supabase.from("materias").select("nome").eq("id", prova.materia_id).maybeSingle(),
      supabase.from("turmas").select("nome, curso_id, periodo").eq("id", prova.turma_id).maybeSingle(),
      supabase.from("prova_modelos").select("campos").eq("ativo", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (!professor || !materia || !turma) return json({ error: "Dados da prova incompletos" }, 400);

    let camposCfg: Record<string, CampoConfig> = CAMPOS_PADRAO_FEMAF;
    const camposModelo = modeloAtivo?.campos as Record<string, CampoConfig> | null | undefined;
    if (camposModelo && typeof camposModelo === "object" && Object.keys(camposModelo).length > 0) {
      camposCfg = camposModelo;
    }

    const { data: alunos, error: alunosErr } = await supabase
      .from("turma_alunos").select("id, nome, matricula").eq("turma_id", prova.turma_id).eq("ativo", true).order("nome");
    if (alunosErr) return json({ error: alunosErr.message }, 500);
    if (!alunos || alunos.length === 0) return json({ error: "A turma não possui alunos cadastrados. Lance a lista de alunos antes de gerar as provas." }, 400);
    if (alunos.length > MAX_ALUNOS_POR_GERACAO) {
      return json({ error: `Turma com ${alunos.length} alunos excede o limite de ${MAX_ALUNOS_POR_GERACAO} por geração.` }, 400);
    }

    const { data: fileBlob, error: dlErr } = await supabase.storage.from("provas-envios").download(prova.arquivo_original_url);
    if (dlErr || !fileBlob) return json({ error: "Não foi possível ler o arquivo original da prova" }, 400);
    const originalBytes = new Uint8Array(await fileBlob.arrayBuffer());
    const pages = await extractPdfPages(originalBytes);

    const { data: geracao, error: gerErr } = await supabase
      .from("prova_geracoes")
      .insert({ prova_id: provaId, quantidade_alunos: alunos.length, gerado_por: userData.user.id })
      .select().single();
    if (gerErr) return json({ error: gerErr.message }, 500);

    const individuais: Uint8Array[] = [];
    const arquivosRows: { prova_geracao_id: string; aluno_id: string; aluno_nome: string; arquivo_url: string }[] = [];

    // O sistema só sobrepõe campos que ficam EM BRANCO no modelo original
    // (Aluno(a)/Assinatura e, quando existir, Matrícula) — nunca um campo
    // que o professor já preencheu no Word (Curso/Disciplina/Período/Data/
    // Avaliação/Professor). Testado e confirmado: desenhar um valor novo
    // em cima de um texto que já existe no PDF produz as duas camadas de
    // texto sobrepostas e ilegíveis, porque não há como apagar com
    // segurança só o texto antigo sem arriscar invadir a célula vizinha
    // (os rótulos ficam bem próximos uns dos outros nesse cabeçalho). Por
    // isso a verificação de que a prova "está de acordo com o modelo" é
    // feita pelo checklist (ver _shared/checklist.ts), que BLOQUEIA o
    // envio e lista os erros quando o cabeçalho está muito diferente —
    // não por reescrever o que o professor já digitou.
    const cfgAluno = camposCfg.aluno ?? CAMPOS_PADRAO_FEMAF.aluno;
    const cfgMatricula = camposCfg.matricula ?? CAMPOS_PADRAO_FEMAF.matricula;
    const anchorAluno = resolveAnchor(pages, cfgAluno.anchors) ?? cfgAluno.anchors[0];
    const anchorMatricula = resolveAnchor(pages, cfgMatricula.anchors);

    for (const aluno of alunos) {
      // O nome vai sozinho no campo do aluno — sem anexar a matrícula com
      // um traço. Quando o modelo não tem um rótulo "Matrícula:" próprio
      // (caso do modelo oficial), colar "— Mat. 12345678" no fim do nome
      // juntos disputavam a mesma largura máxima e, em nomes mais
      // compridos, o traço aparecia sozinho, cortado antes do número —
      // pior do que simplesmente não mostrar a matrícula na prova impressa.
      const nomeAluno = limparNomeAluno(aluno.nome);
      const campos: OverlayField[] = [
        { anchor: anchorAluno, valor: nomeAluno, maxWidth: cfgAluno.maxWidth ?? 220, mode: cfgAluno.modo },
      ];
      if (anchorMatricula && aluno.matricula) {
        campos.push({ anchor: anchorMatricula, valor: aluno.matricula, maxWidth: cfgMatricula.maxWidth ?? 100, mode: cfgMatricula.modo });
      }
      const bytes = await overlayFields(originalBytes, pages, campos);
      individuais.push(bytes);
      const path = `${provaId}/${aluno.id}.pdf`;
      const { error: upErr } = await supabase.storage.from("provas-geradas").upload(path, bytes, { contentType: "application/pdf", upsert: true });
      if (upErr) return json({ error: `Falha ao salvar prova de ${aluno.nome}: ${upErr.message}` }, 500);
      arquivosRows.push({ prova_geracao_id: geracao.id, aluno_id: aluno.id, aluno_nome: aluno.nome, arquivo_url: path });
    }

    const lotePath = `${provaId}/lote-${geracao.id}.pdf`;
    const loteBytes = await mergePdfs(individuais);
    const { error: loteUpErr } = await supabase.storage.from("provas-geradas").upload(lotePath, loteBytes, { contentType: "application/pdf", upsert: true });
    if (loteUpErr) return json({ error: `Falha ao salvar o PDF em lote: ${loteUpErr.message}` }, 500);

    await supabase.from("prova_geracoes").update({ pdf_lote_url: lotePath }).eq("id", geracao.id);
    await supabase.from("prova_geracao_arquivos").insert(arquivosRows);
    await supabase.from("provas_audit_logs").insert({
      prova_id: provaId,
      actor: `admin:${userData.user.id}`,
      action: "provas_geradas",
      detalhe: { quantidade_alunos: alunos.length, geracao_id: geracao.id },
    });

    return json({ ok: true, geracao_id: geracao.id, quantidade_alunos: alunos.length, pdf_lote_url: lotePath, arquivos: arquivosRows });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
