-- ============================================================
--  FEMAF — MÓDULO DE PONTO E PAGAMENTO
--  VERSÃO FINAL CORRIGIDA PARA SUPABASE
--
--  REGRA CENTRAL:
--    1 horário = 1 hora-aula cheia
--    valor_total = quantidade_horarios × professores.valor_hora_aula
--
--  EXEMPLOS:
--    Professor com valor_hora_aula = 35:
--      1 horário  = R$ 35,00
--      2 horários = R$ 70,00
--      3 horários = R$ 105,00
--      4 horários = R$ 140,00
--
--  IMPORTANTE:
--    Este arquivo é SQL puro.
--    Não contém bash, cat, echo ou SQLEOF.
-- ============================================================


-- ============================================================
-- 0) EXTENDER registros_ponto ANTES DO BACKUP
-- ============================================================

ALTER TABLE public.registros_ponto
  ADD COLUMN IF NOT EXISTS tipo_registro text DEFAULT 'normal',
  ADD COLUMN IF NOT EXISTS origem text,
  ADD COLUMN IF NOT EXISTS competencia_pagamento date,
  ADD COLUMN IF NOT EXISTS gerado_por uuid,
  ADD COLUMN IF NOT EXISTS gerado_em timestamptz,
  ADD COLUMN IF NOT EXISTS vinculo_processamento uuid;

CREATE INDEX IF NOT EXISTS idx_rp_tipo
  ON public.registros_ponto (tipo_registro);

CREATE INDEX IF NOT EXISTS idx_rp_competencia
  ON public.registros_ponto (competencia_pagamento);

CREATE INDEX IF NOT EXISTS idx_rp_professor_data
  ON public.registros_ponto (professor_id, data);


-- ============================================================
-- 1) BACKUP DE SEGURANÇA DOS REGISTROS DE AJUSTE
-- ============================================================

CREATE TABLE IF NOT EXISTS public._backup_registros_ponto AS
SELECT
  rp.*,
  now() AS backup_em,
  current_user AS backup_por
FROM public.registros_ponto rp
WHERE rp.tipo_registro IN (
  'feriado_remunerado',
  'ponto_facultativo',
  'hora_aula_extra',
  'ajuste_retroativo'
);


-- ============================================================
-- 2) GARANTIR FUNÇÃO update_updated_at_column
-- ============================================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- ============================================================
-- 3) TABELA academic_day_overrides
-- ============================================================

CREATE TABLE IF NOT EXISTS public.academic_day_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  type text NOT NULL CHECK (
    type IN (
      'feriado',
      'ponto_facultativo',
      'suspensao_remunerada'
    )
  ),
  title text NOT NULL,
  description text,
  scope_type text NOT NULL DEFAULT 'instituicao' CHECK (
    scope_type IN (
      'instituicao',
      'curso',
      'turma',
      'professor'
    )
  ),
  scope_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ado_date
  ON public.academic_day_overrides (date)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_ado_scope
  ON public.academic_day_overrides (scope_type, scope_id)
  WHERE is_active = true;

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.academic_day_overrides TO authenticated;

GRANT ALL
  ON public.academic_day_overrides TO service_role;

ALTER TABLE public.academic_day_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "autenticados leem overrides ativos"
  ON public.academic_day_overrides;

DROP POLICY IF EXISTS "admin gerencia overrides"
  ON public.academic_day_overrides;

DROP POLICY IF EXISTS "admin manages overrides"
  ON public.academic_day_overrides;

CREATE POLICY "autenticados leem overrides ativos"
  ON public.academic_day_overrides
  FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "admin gerencia overrides"
  ON public.academic_day_overrides
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS trg_overrides_updated
  ON public.academic_day_overrides;

CREATE TRIGGER trg_overrides_updated
  BEFORE UPDATE ON public.academic_day_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================
-- 4) TABELA generated_class_records
-- ============================================================

CREATE TABLE IF NOT EXISTS public.generated_class_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL,
  source_date date NOT NULL,
  source_title text,
  professor_id uuid NOT NULL,
  turma_id uuid,
  materia_id uuid,
  horario_id integer,
  hours_quantity numeric NOT NULL DEFAULT 0,
  registro_ponto_id uuid,
  vinculo_processamento uuid,
  generated_by uuid,
  generated_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

ALTER TABLE public.generated_class_records
  ADD COLUMN IF NOT EXISTS hours_quantity numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vinculo_processamento uuid,
  ADD COLUMN IF NOT EXISTS generated_by uuid,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE UNIQUE INDEX IF NOT EXISTS uq_generated_class_records
  ON public.generated_class_records (
    source_date,
    professor_id,
    COALESCE(turma_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(materia_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(horario_id, -1),
    source_type
  );

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.generated_class_records TO authenticated;

GRANT ALL
  ON public.generated_class_records TO service_role;

ALTER TABLE public.generated_class_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin gerencia generated"
  ON public.generated_class_records;

DROP POLICY IF EXISTS "admin manages generated"
  ON public.generated_class_records;

CREATE POLICY "admin gerencia generated"
  ON public.generated_class_records
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));


-- ============================================================
-- 5) TABELA payroll_adjustment_audit_logs
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payroll_adjustment_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  description text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_user
  ON public.payroll_adjustment_audit_logs (user_id);

CREATE INDEX IF NOT EXISTS idx_audit_entity
  ON public.payroll_adjustment_audit_logs (entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_audit_created
  ON public.payroll_adjustment_audit_logs (created_at DESC);

GRANT SELECT, INSERT
  ON public.payroll_adjustment_audit_logs TO authenticated;

GRANT ALL
  ON public.payroll_adjustment_audit_logs TO service_role;

ALTER TABLE public.payroll_adjustment_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin le auditoria"
  ON public.payroll_adjustment_audit_logs;

DROP POLICY IF EXISTS "admin insere auditoria"
  ON public.payroll_adjustment_audit_logs;

DROP POLICY IF EXISTS "admin reads audit"
  ON public.payroll_adjustment_audit_logs;

DROP POLICY IF EXISTS "admin inserts audit"
  ON public.payroll_adjustment_audit_logs;

CREATE POLICY "admin le auditoria"
  ON public.payroll_adjustment_audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admin insere auditoria"
  ON public.payroll_adjustment_audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));


-- ============================================================
-- 6) HELPERS CENTRAIS DE CÁLCULO
-- ============================================================

CREATE OR REPLACE FUNCTION public._minutos_por_horario()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 60;
$$;

CREATE OR REPLACE FUNCTION public._carga_horaria(p_qtd integer)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(p_qtd, 0) * public._minutos_por_horario();
$$;

CREATE OR REPLACE FUNCTION public._valor_total(
  p_qtd integer,
  p_valor_hora_aula numeric
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ROUND(COALESCE(p_qtd, 0) * COALESCE(p_valor_hora_aula, 0), 2);
$$;


-- ============================================================
-- 7) processar_data_preview
-- Mantém assinatura e retorno originais.
-- ============================================================

CREATE OR REPLACE FUNCTION public.processar_data_preview(
  p_data date,
  p_scope_type text DEFAULT 'instituicao',
  p_scope_id uuid DEFAULT NULL
)
RETURNS TABLE (
  professor_id uuid,
  professor_nome text,
  turma_id uuid,
  turma_nome text,
  curso_id text,
  materia_id uuid,
  materia_nome text,
  horario_id integer,
  dia_semana integer,
  ja_existe boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dow integer;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'sem permissão';
  END IF;

  IF p_data IS NULL THEN
    RAISE EXCEPTION 'p_data é obrigatório';
  END IF;

  v_dow := EXTRACT(DOW FROM p_data);

  RETURN QUERY
    SELECT
      h.professor_id,
      p.nome AS professor_nome,
      h.turma_id,
      t.nome AS turma_nome,
      t.curso_id,
      h.materia_id,
      m.nome AS materia_nome,
      h.horario_id,
      h.dia_semana,
      EXISTS (
        SELECT 1
        FROM public.registros_ponto r
        WHERE r.professor_id = h.professor_id
          AND r.data = p_data
          AND h.horario_id = ANY(r.horarios)
          AND COALESCE(r.status_aprovacao, '') <> 'rejeitado'
      ) AS ja_existe
    FROM public.horarios_aula h
    JOIN public.professores p
      ON p.id = h.professor_id
     AND p.status = 'ativo'
    JOIN public.turmas t
      ON t.id = h.turma_id
    LEFT JOIN public.materias m
      ON m.id = h.materia_id
    WHERE h.dia_semana = v_dow
      AND (
        p_scope_type = 'instituicao'
        OR (p_scope_type = 'curso' AND t.curso_id = p_scope_id::text)
        OR (p_scope_type = 'turma' AND t.id = p_scope_id)
        OR (p_scope_type = 'professor' AND h.professor_id = p_scope_id)
      )
    ORDER BY p.nome, h.horario_id;
END;
$$;


-- ============================================================
-- 8) processar_data_gerar
-- Gera feriado remunerado e ponto facultativo.
-- Regra: 1 horário = 1 hora-aula cheia.
-- ============================================================

CREATE OR REPLACE FUNCTION public.processar_data_gerar(
  p_data date,
  p_tipo text,
  p_origem text,
  p_titulo text,
  p_scope_type text DEFAULT 'instituicao',
  p_scope_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_vinc uuid := gen_random_uuid();
  v_obs text;
  v_criados integer := 0;
  v_ignorados integer := 0;
BEGIN
  IF NOT public.has_role(v_user, 'admin') THEN
    RAISE EXCEPTION 'sem permissão';
  END IF;

  IF p_data IS NULL THEN
    RAISE EXCEPTION 'p_data é obrigatório';
  END IF;

  IF p_tipo NOT IN ('feriado_remunerado', 'ponto_facultativo') THEN
    RAISE EXCEPTION 'tipo inválido: use feriado_remunerado ou ponto_facultativo';
  END IF;

  v_obs :=
    CASE p_tipo
      WHEN 'feriado_remunerado'
        THEN 'Registro gerado automaticamente — feriado cadastrado no calendário acadêmico.'
      WHEN 'ponto_facultativo'
        THEN 'Registro gerado automaticamente — ponto facultativo cadastrado pela administração.'
    END
    || CASE
         WHEN p_titulo IS NOT NULL AND trim(p_titulo) <> ''
           THEN ' (' || p_titulo || ')'
         ELSE ''
       END;

  WITH preview AS (
    SELECT
      pr.professor_id,
      pr.turma_id,
      pr.materia_id,
      pr.horario_id,
      COALESCE(p.valor_hora_aula, 0) AS valor_hora_aula
    FROM public.processar_data_preview(p_data, p_scope_type, p_scope_id) pr
    JOIN public.professores p
      ON p.id = pr.professor_id
    WHERE pr.ja_existe = false
  ),

  ins_rp AS (
    INSERT INTO public.registros_ponto (
      professor_id,
      materia_id,
      turma_id,
      data,
      horarios,
      quantidade_horarios,
      carga_horaria,
      valor_total,
      observacao,
      status_aprovacao,
      tipo_registro,
      origem,
      gerado_por,
      gerado_em,
      vinculo_processamento
    )
    SELECT
      pv.professor_id,
      pv.materia_id,
      pv.turma_id,
      p_data,
      ARRAY[pv.horario_id],
      1,
      public._carga_horaria(1),
      public._valor_total(1, pv.valor_hora_aula),
      v_obs,
      'aprovado',
      p_tipo,
      COALESCE(p_origem, 'calendario_academico'),
      v_user,
      now(),
      v_vinc
    FROM preview pv
    ON CONFLICT DO NOTHING
    RETURNING
      id AS rp_id,
      professor_id,
      turma_id,
      materia_id,
      horarios[1] AS horario_id
  ),

  ins_gcr AS (
    INSERT INTO public.generated_class_records (
      source_type,
      source_date,
      source_title,
      professor_id,
      turma_id,
      materia_id,
      horario_id,
      hours_quantity,
      registro_ponto_id,
      vinculo_processamento,
      generated_by,
      notes
    )
    SELECT
      p_tipo,
      p_data,
      p_titulo,
      ir.professor_id,
      ir.turma_id,
      ir.materia_id,
      ir.horario_id,
      1,
      ir.rp_id,
      v_vinc,
      v_user,
      v_obs
    FROM ins_rp ir
    ON CONFLICT DO NOTHING
    RETURNING 1
  )

  SELECT
    (SELECT COUNT(*) FROM ins_rp),
    (SELECT COUNT(*) FROM preview) - (SELECT COUNT(*) FROM ins_rp)
  INTO v_criados, v_ignorados;

  INSERT INTO public.payroll_adjustment_audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    description,
    new_data
  )
  VALUES (
    v_user,
    'processar_data',
    'data',
    NULL,
    'Processamento da data ' || p_data || ' — tipo: ' || p_tipo,
    jsonb_build_object(
      'data', p_data,
      'tipo', p_tipo,
      'titulo', p_titulo,
      'scope_type', p_scope_type,
      'scope_id', p_scope_id,
      'criados', v_criados,
      'ignorados', v_ignorados,
      'vinculo', v_vinc
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'criados', v_criados,
    'ignorados', v_ignorados,
    'vinculo', v_vinc
  );
END;
$$;


-- ============================================================
-- 9) lancar_hora_aula_extra
-- Regra: quantidade de horários × valor_hora_aula do professor.
-- p_competencia_pagamento aceita NULL e usa p_data como fallback.
-- ============================================================

CREATE OR REPLACE FUNCTION public.lancar_hora_aula_extra(
  p_professor_id uuid,
  p_materia_id uuid,
  p_turma_id uuid,
  p_data date,
  p_horarios integer[],
  p_motivo text,
  p_competencia_origem date,
  p_competencia_pagamento date,
  p_observacao text,
  p_tipo text DEFAULT 'hora_aula_extra'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_valor_hora_aula numeric;
  v_qtd integer;
  v_carga integer;
  v_total numeric;
  v_reg_id uuid;
  v_competencia_pag date;
BEGIN
  IF NOT public.has_role(v_user, 'admin') THEN
    RAISE EXCEPTION 'sem permissão';
  END IF;

  IF p_professor_id IS NULL THEN
    RAISE EXCEPTION 'professor_id é obrigatório';
  END IF;

  IF p_data IS NULL THEN
    RAISE EXCEPTION 'data é obrigatória';
  END IF;

  IF p_motivo IS NULL OR length(trim(p_motivo)) < 3 THEN
    RAISE EXCEPTION 'motivo é obrigatório e deve ter ao menos 3 caracteres';
  END IF;

  IF p_horarios IS NULL OR array_length(p_horarios, 1) IS NULL THEN
    RAISE EXCEPTION 'ao menos um horário deve ser informado';
  END IF;

  IF p_tipo NOT IN ('hora_aula_extra', 'ajuste_retroativo') THEN
    RAISE EXCEPTION 'tipo inválido: use hora_aula_extra ou ajuste_retroativo';
  END IF;

  v_competencia_pag := COALESCE(p_competencia_pagamento, p_data);

  SELECT COALESCE(valor_hora_aula, 0)
  INTO v_valor_hora_aula
  FROM public.professores
  WHERE id = p_professor_id
    AND status = 'ativo';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'professor não encontrado ou inativo';
  END IF;

  v_qtd := array_length(p_horarios, 1);
  v_carga := public._carga_horaria(v_qtd);
  v_total := public._valor_total(v_qtd, v_valor_hora_aula);

  INSERT INTO public.registros_ponto (
    professor_id,
    materia_id,
    turma_id,
    data,
    horarios,
    quantidade_horarios,
    carga_horaria,
    valor_total,
    observacao,
    status_aprovacao,
    retroativo,
    tipo_registro,
    origem,
    gerado_por,
    gerado_em,
    competencia_pagamento
  )
  VALUES (
    p_professor_id,
    p_materia_id,
    p_turma_id,
    p_data,
    p_horarios,
    v_qtd,
    v_carga,
    v_total,
    trim(COALESCE(p_observacao, '') || E'\nMotivo: ' || p_motivo),
    'aprovado',
    true,
    p_tipo,
    'ajuste_admin',
    v_user,
    now(),
    v_competencia_pag
  )
  RETURNING id INTO v_reg_id;

  INSERT INTO public.payroll_adjustment_audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    description,
    new_data
  )
  VALUES (
    v_user,
    'lancar_extra',
    'registro_ponto',
    v_reg_id,
    'Lançamento de ' || p_tipo || ' — professor ' || p_professor_id,
    jsonb_build_object(
      'professor_id', p_professor_id,
      'data', p_data,
      'horarios', p_horarios,
      'quantidade_horarios', v_qtd,
      'carga_horaria_min', v_carga,
      'horas_aula', v_qtd,
      'valor_hora_aula', v_valor_hora_aula,
      'valor_total', v_total,
      'competencia_pagamento', v_competencia_pag,
      'motivo', p_motivo,
      'tipo', p_tipo
    )
  );

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_reg_id,
    'quantidade_horarios', v_qtd,
    'horas_aula', v_qtd,
    'carga_horaria_min', v_carga,
    'valor_hora_aula', v_valor_hora_aula,
    'valor_total', v_total,
    'competencia_pagamento', v_competencia_pag
  );
END;
$$;


-- ============================================================
-- 10) cancelar_ajuste
-- ============================================================

CREATE OR REPLACE FUNCTION public.cancelar_ajuste(
  p_id uuid,
  p_motivo text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_tipo text;
  v_status text;
  v_old jsonb;
BEGIN
  IF NOT public.has_role(v_user, 'admin') THEN
    RAISE EXCEPTION 'sem permissão';
  END IF;

  IF p_id IS NULL THEN
    RAISE EXCEPTION 'id é obrigatório';
  END IF;

  IF p_motivo IS NULL OR length(trim(p_motivo)) < 3 THEN
    RAISE EXCEPTION 'motivo de cancelamento é obrigatório';
  END IF;

  SELECT
    tipo_registro,
    status_aprovacao,
    jsonb_build_object(
      'id', id,
      'professor_id', professor_id,
      'data', data,
      'quantidade_horarios', quantidade_horarios,
      'valor_total', valor_total,
      'tipo_registro', tipo_registro,
      'status_aprovacao', status_aprovacao
    )
  INTO v_tipo, v_status, v_old
  FROM public.registros_ponto
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'registro não encontrado';
  END IF;

  IF v_tipo = 'normal' OR v_tipo IS NULL THEN
    RAISE EXCEPTION 'apenas registros de ajuste podem ser cancelados por esta função';
  END IF;

  IF v_status = 'rejeitado' THEN
    RAISE EXCEPTION 'este registro já está cancelado/rejeitado';
  END IF;

  UPDATE public.registros_ponto
  SET
    status_aprovacao = 'rejeitado',
    motivo_rejeicao = trim(p_motivo)
  WHERE id = p_id;

  INSERT INTO public.payroll_adjustment_audit_logs (
    user_id,
    action,
    entity_type,
    entity_id,
    description,
    old_data
  )
  VALUES (
    v_user,
    'cancelar_ajuste',
    'registro_ponto',
    p_id,
    'Cancelamento de ajuste — motivo: ' || trim(p_motivo),
    v_old
  );

  RETURN jsonb_build_object(
    'ok', true,
    'id', p_id,
    'motivo', trim(p_motivo)
  );
END;
$$;


-- ============================================================
-- 11) CORRIGIR REGISTROS ANTIGOS JÁ GERADOS COM VALOR REDUZIDO
-- Não mexe em registros normais.
-- Não mexe em registros rejeitados.
-- ============================================================

UPDATE public.registros_ponto rp
SET
  quantidade_horarios = COALESCE(
    NULLIF(rp.quantidade_horarios, 0),
    array_length(rp.horarios, 1),
    1
  ),
  carga_horaria = COALESCE(
    NULLIF(rp.quantidade_horarios, 0),
    array_length(rp.horarios, 1),
    1
  ) * 60,
  valor_total = ROUND(
    COALESCE(
      NULLIF(rp.quantidade_horarios, 0),
      array_length(rp.horarios, 1),
      1
    ) * COALESCE(p.valor_hora_aula, 0),
    2
  )
FROM public.professores p
WHERE p.id = rp.professor_id
  AND rp.tipo_registro IN (
    'feriado_remunerado',
    'ponto_facultativo',
    'hora_aula_extra',
    'ajuste_retroativo'
  )
  AND COALESCE(rp.status_aprovacao, '') <> 'rejeitado';


-- ============================================================
-- 12) VIEW DE CONFERÊNCIA
-- ============================================================

DROP VIEW IF EXISTS public.vw_ajustes_pagamento;

CREATE VIEW public.vw_ajustes_pagamento AS
SELECT
  rp.id,
  rp.data,
  rp.tipo_registro,
  p.nome AS professor,
  COALESCE(p.valor_hora_aula, 0) AS valor_hora_aula,
  rp.quantidade_horarios,
  rp.carga_horaria AS carga_min,
  rp.carga_horaria / 60.0 AS carga_horas,
  rp.valor_total AS valor_gravado,
  ROUND(
    rp.quantidade_horarios * COALESCE(p.valor_hora_aula, 0),
    2
  ) AS valor_esperado,
  rp.valor_total IS DISTINCT FROM ROUND(
    rp.quantidade_horarios * COALESCE(p.valor_hora_aula, 0),
    2
  ) AS valor_incorreto,
  rp.status_aprovacao,
  rp.competencia_pagamento,
  rp.vinculo_processamento,
  rp.gerado_por,
  rp.gerado_em,
  rp.observacao
FROM public.registros_ponto rp
JOIN public.professores p
  ON p.id = rp.professor_id
WHERE rp.tipo_registro <> 'normal';

GRANT SELECT ON public.vw_ajustes_pagamento TO authenticated;


-- ============================================================
-- 13) CONSULTAS DE TESTE
-- Se o Supabase/Lovable permitir SELECT no final, elas ajudam a conferir.
-- ============================================================

SELECT
  public._minutos_por_horario() AS minutos_por_horario,
  public._carga_horaria(2) AS carga_2_horarios,
  public._valor_total(1, 35.00) AS total_1_horario_35,
  public._valor_total(2, 35.00) AS total_2_horarios_35,
  public._valor_total(4, 35.00) AS total_4_horarios_35;

SELECT
  COUNT(*) AS registros_com_valor_incorreto
FROM public.vw_ajustes_pagamento
WHERE valor_incorreto = true
  AND COALESCE(status_aprovacao, '') <> 'rejeitado';
