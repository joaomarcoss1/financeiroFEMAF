CREATE OR REPLACE FUNCTION public._minutos_pagamento_hora_aula()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT GREATEST(COALESCE((data->>'minutos_pagamento_hora_aula')::int, 60), 1)
  FROM public.app_settings
  WHERE id = 'global'
$$;

CREATE OR REPLACE FUNCTION public.processar_data_gerar(
  p_data date,
  p_tipo text,
  p_origem text,
  p_titulo text,
  p_scope_type text DEFAULT 'instituicao'::text,
  p_scope_id uuid DEFAULT NULL::uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_vinc uuid := gen_random_uuid();
  v_minutos int;
  v_valor numeric;
  v_carga int;
  v_total numeric;
  v_reg_id uuid;
  v_criados int := 0;
  v_ignorados int := 0;
  v_obs text;
  r RECORD;
BEGIN
  IF NOT public.has_role(v_user,'admin') THEN
    RAISE EXCEPTION 'sem permissão';
  END IF;
  IF p_tipo NOT IN ('feriado_remunerado','ponto_facultativo') THEN
    RAISE EXCEPTION 'tipo inválido';
  END IF;

  v_minutos := public._minutos_pagamento_hora_aula();
  v_obs := CASE p_tipo
    WHEN 'feriado_remunerado' THEN 'Registro gerado automaticamente por feriado cadastrado no calendário acadêmico.'
    ELSE 'Registro gerado automaticamente por ponto facultativo cadastrado pela administração.'
  END;

  FOR r IN
    SELECT * FROM public.processar_data_preview(p_data, p_scope_type, p_scope_id)
    WHERE ja_existe = false
  LOOP
    BEGIN
      SELECT COALESCE(valor_hora_aula,0) INTO v_valor FROM public.professores WHERE id = r.professor_id;
      v_carga := v_minutos;
      v_total := ROUND(v_valor, 2);

      INSERT INTO public.registros_ponto(
        professor_id, materia_id, turma_id, data, horarios,
        quantidade_horarios, carga_horaria, valor_total,
        observacao, status_aprovacao,
        tipo_registro, origem, gerado_por, gerado_em, vinculo_processamento
      ) VALUES (
        r.professor_id, r.materia_id, r.turma_id, p_data, ARRAY[r.horario_id],
        1, v_carga, v_total,
        v_obs || ' (' || COALESCE(p_titulo,'') || ')', 'aprovado',
        p_tipo, COALESCE(p_origem,'calendario_academico'), v_user, now(), v_vinc
      ) RETURNING id INTO v_reg_id;

      INSERT INTO public.generated_class_records(
        source_type, source_date, source_title,
        professor_id, turma_id, materia_id, horario_id,
        hours_quantity, registro_ponto_id, vinculo_processamento,
        generated_by, notes
      ) VALUES (
        p_tipo, p_data, p_titulo,
        r.professor_id, r.turma_id, r.materia_id, r.horario_id,
        1, v_reg_id, v_vinc, v_user, v_obs
      );
      v_criados := v_criados + 1;
    EXCEPTION WHEN unique_violation THEN
      v_ignorados := v_ignorados + 1;
    END;
  END LOOP;

  INSERT INTO public.payroll_adjustment_audit_logs(user_id, action, entity_type, entity_id, description, new_data)
  VALUES (v_user, 'processar_data', 'data', NULL,
          'Processamento da data ' || p_data || ' tipo ' || p_tipo,
          jsonb_build_object('data', p_data, 'tipo', p_tipo, 'titulo', p_titulo,
                             'criados', v_criados, 'ignorados', v_ignorados,
                             'vinculo', v_vinc));

  RETURN jsonb_build_object('ok', true, 'criados', v_criados, 'ignorados', v_ignorados, 'vinculo', v_vinc);
END;
$$;

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
  p_tipo text DEFAULT 'hora_aula_extra'::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_minutos int;
  v_valor numeric;
  v_qtd int;
  v_carga int;
  v_total numeric;
  v_reg uuid;
BEGIN
  IF NOT public.has_role(v_user,'admin') THEN
    RAISE EXCEPTION 'sem permissão';
  END IF;
  IF p_motivo IS NULL OR length(trim(p_motivo)) < 3 THEN
    RAISE EXCEPTION 'motivo obrigatório';
  END IF;
  IF p_horarios IS NULL OR array_length(p_horarios,1) IS NULL THEN
    RAISE EXCEPTION 'horários obrigatórios';
  END IF;
  IF p_tipo NOT IN ('hora_aula_extra','ajuste_retroativo') THEN
    RAISE EXCEPTION 'tipo inválido';
  END IF;

  v_minutos := public._minutos_pagamento_hora_aula();
  v_qtd := array_length(p_horarios,1);
  v_carga := v_qtd * v_minutos;
  SELECT COALESCE(valor_hora_aula,0) INTO v_valor FROM public.professores WHERE id = p_professor_id;
  v_total := ROUND((v_qtd * v_valor), 2);

  INSERT INTO public.registros_ponto(
    professor_id, materia_id, turma_id, data, horarios,
    quantidade_horarios, carga_horaria, valor_total,
    observacao, status_aprovacao, retroativo,
    tipo_registro, origem, gerado_por, gerado_em, competencia_pagamento
  ) VALUES (
    p_professor_id, p_materia_id, p_turma_id, p_data, p_horarios,
    v_qtd, v_carga, v_total,
    COALESCE(p_observacao,'') || E'\nMotivo: ' || p_motivo, 'aprovado', true,
    p_tipo, 'ajuste_admin', v_user, now(), p_competencia_pagamento
  ) RETURNING id INTO v_reg;

  INSERT INTO public.payroll_adjustment_audit_logs(user_id, action, entity_type, entity_id, description, new_data)
  VALUES (v_user, 'lancar_extra', 'registro_ponto', v_reg,
          'Lançamento de ' || p_tipo,
          jsonb_build_object('professor', p_professor_id, 'data', p_data,
                             'horarios', p_horarios, 'competencia_pagamento', p_competencia_pagamento,
                             'motivo', p_motivo));

  RETURN jsonb_build_object('ok', true, 'id', v_reg, 'valor_total', v_total);
END;
$$;

CREATE OR REPLACE FUNCTION public.recalcular_ajustes_pagamento(p_minutos_pagamento integer DEFAULT 60)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_minutos int := GREATEST(COALESCE(p_minutos_pagamento, 60), 1);
  v_atualizados int;
BEGIN
  IF NOT public.has_role(v_user,'admin') THEN
    RAISE EXCEPTION 'sem permissão';
  END IF;

  UPDATE public.registros_ponto r
  SET quantidade_horarios = GREATEST(COALESCE(r.quantidade_horarios, array_length(r.horarios, 1), 1), 1),
      carga_horaria = GREATEST(COALESCE(r.quantidade_horarios, array_length(r.horarios, 1), 1), 1) * v_minutos,
      valor_total = ROUND(GREATEST(COALESCE(r.quantidade_horarios, array_length(r.horarios, 1), 1), 1) * COALESCE(p.valor_hora_aula, 0), 2),
      updated_at = now()
  FROM public.professores p
  WHERE p.id = r.professor_id
    AND r.tipo_registro IN ('feriado_remunerado','ponto_facultativo','hora_aula_extra','ajuste_retroativo')
    AND r.status_aprovacao <> 'rejeitado';

  GET DIAGNOSTICS v_atualizados = ROW_COUNT;

  INSERT INTO public.payroll_adjustment_audit_logs(user_id, action, entity_type, description, new_data)
  VALUES (v_user, 'recalcular_ajustes_pagamento', 'registros_ponto',
          'Recalculo administrativo dos ajustes de pagamento',
          jsonb_build_object('atualizados', v_atualizados, 'minutos_pagamento', v_minutos));

  RETURN jsonb_build_object('ok', true, 'atualizados', v_atualizados);
END;
$$;

REVOKE ALL ON FUNCTION public.processar_data_preview(date,text,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.processar_data_gerar(date,text,text,text,text,uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.lancar_hora_aula_extra(uuid,uuid,uuid,date,integer[],text,date,date,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancelar_ajuste(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.recalcular_ajustes_pagamento(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public._minutos_pagamento_hora_aula() FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.processar_data_preview(date,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.processar_data_gerar(date,text,text,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lancar_hora_aula_extra(uuid,uuid,uuid,date,integer[],text,date,date,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_ajuste(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.recalcular_ajustes_pagamento(integer) TO authenticated;

DROP POLICY IF EXISTS "Anon read permutas" ON public.permutas;
DROP POLICY IF EXISTS "Anon read notificacoes" ON public.notificacoes;
DROP POLICY IF EXISTS "Anon update lida" ON public.notificacoes;
DROP POLICY IF EXISTS "Auth read push_subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Anon insert push_subscriptions" ON public.push_subscriptions;

CREATE POLICY "Own or admin read push subscriptions"
ON public.push_subscriptions
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());

CREATE POLICY "Own or admin insert push subscriptions"
ON public.push_subscriptions
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());

CREATE POLICY "Own or admin update push subscriptions"
ON public.push_subscriptions
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid())
WITH CHECK (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());

CREATE POLICY "Own or admin delete push subscriptions"
ON public.push_subscriptions
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR user_id = auth.uid());