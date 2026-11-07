-- ============================================================
--  MÓDULO DE PROVAS — envio, checklist, alunos e geração
--  personalizada de provas com o nome de cada aluno.
-- ============================================================

-- ============================================================
-- 1) Modelo padrão de prova (definido pelo admin)
--    - checklist: array de regras (tipo, parâmetros, mensagem)
--    - campos: posições x/y de cada campo dinâmico por página,
--      usadas para sobrepor texto no PDF na hora de gerar as
--      cópias personalizadas.
-- ============================================================
CREATE TABLE public.prova_modelos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  arquivo_url text,
  ativo boolean NOT NULL DEFAULT true,
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  campos jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prova_modelos TO authenticated;
GRANT ALL ON public.prova_modelos TO service_role;
ALTER TABLE public.prova_modelos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin gerencia modelos de prova" ON public.prova_modelos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_prova_modelos_upd BEFORE UPDATE ON public.prova_modelos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- 2) Alunos por turma (roster para personalização das provas)
-- ============================================================
CREATE TABLE public.turma_alunos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id uuid NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  matricula text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_turma_alunos_turma ON public.turma_alunos(turma_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.turma_alunos TO authenticated;
GRANT ALL ON public.turma_alunos TO service_role;
ALTER TABLE public.turma_alunos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin gerencia alunos" ON public.turma_alunos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============================================================
-- 3) Provas enviadas pelos professores
-- ============================================================
CREATE TABLE public.provas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id uuid NOT NULL REFERENCES public.professores(id),
  titulo text NOT NULL,
  materia_id uuid NOT NULL REFERENCES public.materias(id),
  turma_id uuid NOT NULL REFERENCES public.turmas(id),
  modelo_id uuid REFERENCES public.prova_modelos(id),
  data_prova date NOT NULL,
  arquivo_original_url text NOT NULL,
  status text NOT NULL DEFAULT 'aprovada' CHECK (status IN ('aprovada','rejeitada','cancelada')),
  checklist_resultado jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_provas_turma ON public.provas(turma_id);
CREATE INDEX idx_provas_professor ON public.provas(professor_id);

GRANT SELECT, UPDATE, DELETE ON public.provas TO authenticated;
GRANT ALL ON public.provas TO service_role;
ALTER TABLE public.provas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin gerencia provas" ON public.provas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
-- Sem policy para anon/professor: toda escrita de professor passa pela
-- edge function `prova-enviar`, que usa a service_role key (mesmo padrão
-- de registrar-ponto).

-- ============================================================
-- 4) Lotes de geração (PDF único) + arquivos individuais
-- ============================================================
CREATE TABLE public.prova_geracoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prova_id uuid NOT NULL REFERENCES public.provas(id) ON DELETE CASCADE,
  pdf_lote_url text,
  quantidade_alunos int NOT NULL DEFAULT 0,
  gerado_por uuid,
  gerado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.prova_geracoes TO authenticated;
GRANT ALL ON public.prova_geracoes TO service_role;
ALTER TABLE public.prova_geracoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin gerencia geracoes" ON public.prova_geracoes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.prova_geracao_arquivos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prova_geracao_id uuid NOT NULL REFERENCES public.prova_geracoes(id) ON DELETE CASCADE,
  aluno_id uuid REFERENCES public.turma_alunos(id),
  aluno_nome text NOT NULL,
  arquivo_url text NOT NULL
);

CREATE INDEX idx_prova_geracao_arquivos_lote ON public.prova_geracao_arquivos(prova_geracao_id);

GRANT SELECT, INSERT, DELETE ON public.prova_geracao_arquivos TO authenticated;
GRANT ALL ON public.prova_geracao_arquivos TO service_role;
ALTER TABLE public.prova_geracao_arquivos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin gerencia arquivos de geracao" ON public.prova_geracao_arquivos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============================================================
-- 5) RPC pública (PIN-gated): professor lista suas próprias
--    provas enviadas — mesmo padrão do resto do sistema.
-- ============================================================
CREATE OR REPLACE FUNCTION public.prova_listar_professor(p_prof_id uuid, p_pin text)
RETURNS TABLE(
  id uuid, titulo text, materia_id uuid, materia_nome text,
  turma_id uuid, turma_nome text, data_prova date,
  status text, checklist_resultado jsonb, created_at timestamptz,
  gerada boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._prof_validate(p_prof_id, p_pin);
  RETURN QUERY
    SELECT p.id, p.titulo, p.materia_id, m.nome, p.turma_id, t.nome,
           p.data_prova, p.status, p.checklist_resultado, p.created_at,
           EXISTS(SELECT 1 FROM public.prova_geracoes g WHERE g.prova_id = p.id) AS gerada
    FROM public.provas p
    JOIN public.materias m ON m.id = p.materia_id
    JOIN public.turmas t ON t.id = p.turma_id
    WHERE p.professor_id = p_prof_id
    ORDER BY p.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.prova_listar_professor(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.prova_listar_professor(uuid,text) TO anon, authenticated;

-- ============================================================
-- 6) Storage: buckets privados para modelos, envios e provas
--    geradas. Upload de envio é restrito por caminho (uuid do
--    professor), mesmo padrão do bucket "justificativas".
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('provas-modelos', 'provas-modelos', false),
  ('provas-envios', 'provas-envios', false),
  ('provas-geradas', 'provas-geradas', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admins gerenciam provas-modelos" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'provas-modelos' AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (bucket_id = 'provas-modelos' AND public.has_role(auth.uid(),'admin'));

CREATE POLICY "Admins leem provas-envios" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'provas-envios' AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "Uploads restritos a provas-envios" ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (
    bucket_id = 'provas-envios'
    AND name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[A-Za-z0-9._-]+\.pdf$'
    AND COALESCE((metadata->>'size')::bigint, 0) <= 26214400
    AND COALESCE(metadata->>'mimetype','') = 'application/pdf'
  );

CREATE POLICY "Admins gerenciam provas-geradas" ON storage.objects FOR ALL TO authenticated
  USING (bucket_id = 'provas-geradas' AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (bucket_id = 'provas-geradas' AND public.has_role(auth.uid(),'admin'));

-- ============================================================
-- 7) Auditoria: reaproveita payroll_adjustment_audit_logs? Não —
--    é um domínio diferente. Log simples dedicado.
-- ============================================================
CREATE TABLE public.provas_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prova_id uuid,
  actor text NOT NULL, -- 'professor:<id>' ou 'admin:<uid>'
  action text NOT NULL,
  detalhe jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.provas_audit_logs TO authenticated;
GRANT ALL ON public.provas_audit_logs TO service_role;
ALTER TABLE public.provas_audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin le auditoria de provas" ON public.provas_audit_logs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'admin'));
