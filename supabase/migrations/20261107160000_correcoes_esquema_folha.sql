-- ════════════════════════════════════════════════════════════════════════
--  Correções de esquema que o código da plataforma usa e que estavam só em
--  drizzle/migrations (fora do histórico do Supabase). Sem elas a Folha de
--  Pagamento falha ("Não foi possível calcular a folha") e o histórico do
--  professor na tela de bater ponto não carrega. Idempotente.
-- ════════════════════════════════════════════════════════════════════════

-- 1) Pagamento fixo quinzenal recorrente por disciplina (drizzle 0003)
ALTER TABLE public.materias ADD COLUMN IF NOT EXISTS horas_fixas_quinzenais numeric NOT NULL DEFAULT 0;
COMMENT ON COLUMN public.materias.horas_fixas_quinzenais IS 'Horas fixas creditadas por quinzena nos contratos fixo_quinzenal';
COMMENT ON COLUMN public.materias.valor_fixo_semestral IS 'Total do semestre (fixo_semestral) ou valor por quinzena (fixo_quinzenal)';
ALTER TABLE public.materias DROP CONSTRAINT IF EXISTS materias_pagamento_tipo_valido;
ALTER TABLE public.materias ADD CONSTRAINT materias_pagamento_tipo_valido
  CHECK (pagamento_tipo IN ('hora_aula','fixo_semestral','fixo_quinzenal'));
ALTER TABLE public.materias DROP CONSTRAINT IF EXISTS materias_pagamento_periodo_valido;
ALTER TABLE public.materias ADD CONSTRAINT materias_pagamento_periodo_valido
  CHECK (pagamento_tipo = 'hora_aula' OR (valor_fixo_semestral > 0 AND pagamento_inicio IS NOT NULL AND (
    (pagamento_tipo = 'fixo_semestral' AND pagamento_fim IS NOT NULL AND pagamento_fim >= pagamento_inicio) OR
    (pagamento_tipo = 'fixo_quinzenal' AND horas_fixas_quinzenais > 0 AND (pagamento_fim IS NULL OR pagamento_fim >= pagamento_inicio)))));

-- 2) Turno específico da disciplina (opcional; quando vazio vale o turno da turma)
ALTER TABLE public.materias ADD COLUMN IF NOT EXISTS turno text;

-- 3) Gratificação quinzenal de coordenação, somada na Folha Unificada
ALTER TABLE public.coordenadores ADD COLUMN IF NOT EXISTS valor_quinzenal numeric NOT NULL DEFAULT 0;

-- 4) Histórico do professor protegido por PIN (drizzle 0000)
CREATE OR REPLACE FUNCTION public.get_historico_professor_seguro(p_prof_id uuid, p_pin text, p_limite integer DEFAULT 5)
RETURNS TABLE(id uuid, professor_id uuid, materia_id uuid, turma_id uuid, data date, horarios integer[], quantidade_horarios integer, carga_horaria integer, valor_total numeric, observacao text, status_aprovacao text, retroativo boolean, substituicao boolean, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public._prof_validate(p_prof_id, p_pin) THEN RAISE EXCEPTION 'PIN inválido'; END IF;
  RETURN QUERY SELECT r.id, r.professor_id, r.materia_id, r.turma_id, r.data, r.horarios, r.quantidade_horarios, r.carga_horaria, r.valor_total, r.observacao, r.status_aprovacao, r.retroativo, r.substituicao, r.created_at
    FROM public.registros_ponto r WHERE r.professor_id = p_prof_id ORDER BY r.created_at DESC LIMIT GREATEST(LEAST(p_limite, 100), 1);
END;
$$;
REVOKE ALL ON FUNCTION public.get_historico_professor_seguro(uuid,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_historico_professor_seguro(uuid,text,integer) TO anon, authenticated;
-- Versão antiga sem PIN, se existir, deixa de ser pública
DO $$ BEGIN
  IF to_regprocedure('public.get_historico_professor(uuid,integer)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.get_historico_professor(uuid,integer) FROM PUBLIC, anon, authenticated;
  END IF;
END $$;

-- Atualiza o cache de esquema da API
NOTIFY pgrst, 'reload schema';
