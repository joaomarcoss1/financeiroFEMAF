
-- =====================================================================
-- 1) JUNÇÃO DE DISCIPLINAS (materia_juncoes)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.materia_juncoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  materia_ids uuid[] NOT NULL DEFAULT '{}',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.materia_juncoes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.materia_juncoes TO authenticated;
GRANT ALL ON public.materia_juncoes TO service_role;

ALTER TABLE public.materia_juncoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon read materia_juncoes" ON public.materia_juncoes FOR SELECT TO anon USING (true);
CREATE POLICY "Auth read materia_juncoes" ON public.materia_juncoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage materia_juncoes" ON public.materia_juncoes FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TRIGGER materia_juncoes_updated
  BEFORE UPDATE ON public.materia_juncoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- 2) Atualiza trigger de duplicidade para considerar junções de disciplinas
-- =====================================================================
CREATE OR REPLACE FUNCTION public.check_horario_duplicado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
DECLARE
  h INTEGER;
  conflito RECORD;
  v_juncao_turmas uuid[];
  v_juncao_materias uuid[];
BEGIN
  IF NEW.status_aprovacao = 'rejeitado' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(array_agg(DISTINCT t), '{}')::uuid[]
    INTO v_juncao_turmas
  FROM public.turma_juncoes j,
       LATERAL unnest(j.turma_ids) AS t
  WHERE j.ativo = true AND NEW.turma_id = ANY(j.turma_ids);

  SELECT COALESCE(array_agg(DISTINCT m), '{}')::uuid[]
    INTO v_juncao_materias
  FROM public.materia_juncoes j,
       LATERAL unnest(j.materia_ids) AS m
  WHERE j.ativo = true AND NEW.materia_id = ANY(j.materia_ids);

  FOREACH h IN ARRAY NEW.horarios LOOP
    SELECT id, turma_id, materia_id INTO conflito
    FROM public.registros_ponto
    WHERE professor_id = NEW.professor_id
      AND data = NEW.data
      AND h = ANY(horarios)
      AND status_aprovacao <> 'rejeitado'
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND NOT (turma_id = ANY(v_juncao_turmas))
      AND NOT (materia_id = ANY(v_juncao_materias))
    LIMIT 1;

    IF FOUND THEN
      RAISE EXCEPTION 'Horário % já registrado para este professor nesta data', h
        USING ERRCODE = 'unique_violation';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$function$;

-- =====================================================================
-- 3) PERMUTAS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.permutas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_a_id uuid NOT NULL,            -- solicitante
  professor_b_id uuid NOT NULL,            -- outro professor
  -- aula que A vai assumir (originalmente de B)
  data_a date NOT NULL,
  horarios_a int[] NOT NULL,
  materia_a_id uuid NOT NULL,
  turma_a_id uuid NOT NULL,
  -- aula que B vai assumir (originalmente de A)
  data_b date NOT NULL,
  horarios_b int[] NOT NULL,
  materia_b_id uuid NOT NULL,
  turma_b_id uuid NOT NULL,
  observacao text,
  status text NOT NULL DEFAULT 'pendente_b'
    CHECK (status IN ('pendente_b','pendente_admin','aprovado','rejeitado','cancelado')),
  aceito_b_em timestamptz,
  aprovado_admin_em timestamptz,
  aprovado_por uuid,
  motivo_rejeicao text,
  registro_a_id uuid,
  registro_b_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.permutas TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.permutas TO authenticated;
GRANT ALL ON public.permutas TO service_role;

ALTER TABLE public.permutas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon read permutas" ON public.permutas FOR SELECT TO anon USING (true);
CREATE POLICY "Auth read permutas" ON public.permutas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage permutas" ON public.permutas FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TRIGGER permutas_updated
  BEFORE UPDATE ON public.permutas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- 4) Helper: valida professor + pin
-- =====================================================================
CREATE OR REPLACE FUNCTION public._prof_validate(p_prof_id uuid, p_pin text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_ok boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.professores
    WHERE id = p_prof_id AND status = 'ativo' AND pin IS NOT NULL AND pin = p_pin
  ) INTO v_ok;
  IF NOT v_ok THEN RAISE EXCEPTION 'Credenciais inválidas' USING ERRCODE = '28000'; END IF;
  RETURN true;
END;
$$;

-- =====================================================================
-- 5) Solicita uma permuta (professor A com seu PIN)
-- =====================================================================
CREATE OR REPLACE FUNCTION public.permuta_solicitar(
  p_prof_a_id uuid, p_pin text,
  p_prof_b_id uuid,
  p_data_a date, p_horarios_a int[], p_materia_a_id uuid, p_turma_a_id uuid,
  p_data_b date, p_horarios_b int[], p_materia_b_id uuid, p_turma_b_id uuid,
  p_observacao text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_id uuid;
BEGIN
  PERFORM public._prof_validate(p_prof_a_id, p_pin);
  IF p_prof_a_id = p_prof_b_id THEN RAISE EXCEPTION 'Professores devem ser diferentes'; END IF;
  IF array_length(p_horarios_a,1) IS NULL OR array_length(p_horarios_b,1) IS NULL THEN
    RAISE EXCEPTION 'Horários obrigatórios';
  END IF;

  INSERT INTO public.permutas(
    professor_a_id, professor_b_id,
    data_a, horarios_a, materia_a_id, turma_a_id,
    data_b, horarios_b, materia_b_id, turma_b_id,
    observacao, status
  ) VALUES (
    p_prof_a_id, p_prof_b_id,
    p_data_a, p_horarios_a, p_materia_a_id, p_turma_a_id,
    p_data_b, p_horarios_b, p_materia_b_id, p_turma_b_id,
    p_observacao, 'pendente_b'
  ) RETURNING id INTO v_id;

  INSERT INTO public.notificacoes(tipo, titulo, mensagem, destino_role, professor_id, link)
  VALUES ('permuta','Nova solicitação de permuta',
          'Você recebeu uma proposta de troca de horário.','professor',p_prof_b_id,'/permuta');

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

-- =====================================================================
-- 6) Professor B responde
-- =====================================================================
CREATE OR REPLACE FUNCTION public.permuta_responder(
  p_prof_b_id uuid, p_pin text, p_permuta_id uuid, p_aceitar boolean, p_motivo text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v RECORD;
BEGIN
  PERFORM public._prof_validate(p_prof_b_id, p_pin);
  SELECT * INTO v FROM public.permutas WHERE id = p_permuta_id;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Permuta não encontrada'; END IF;
  IF v.professor_b_id <> p_prof_b_id THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF v.status <> 'pendente_b' THEN RAISE EXCEPTION 'Permuta já respondida'; END IF;

  IF p_aceitar THEN
    UPDATE public.permutas SET status='pendente_admin', aceito_b_em=now() WHERE id=p_permuta_id;
    INSERT INTO public.notificacoes(tipo,titulo,mensagem,destino_role,link)
    VALUES('permuta','Permuta aguardando aprovação',
           'Há uma permuta entre professores aguardando aprovação.','admin','/admin/permutas');
  ELSE
    UPDATE public.permutas SET status='rejeitado', motivo_rejeicao=COALESCE(p_motivo,'Recusada pelo professor'),
                                 aceito_b_em=now()
    WHERE id=p_permuta_id;
    INSERT INTO public.notificacoes(tipo,titulo,mensagem,destino_role,professor_id,link)
    VALUES('permuta','Permuta recusada','Sua solicitação de permuta foi recusada.','professor',v.professor_a_id,'/permuta');
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- =====================================================================
-- 7) Lista permutas envolvendo o professor
-- =====================================================================
CREATE OR REPLACE FUNCTION public.permuta_listar(p_prof_id uuid, p_pin text)
RETURNS TABLE(
  id uuid, professor_a_id uuid, professor_a_nome text,
  professor_b_id uuid, professor_b_nome text,
  data_a date, horarios_a int[], materia_a_nome text, turma_a_nome text,
  data_b date, horarios_b int[], materia_b_nome text, turma_b_nome text,
  observacao text, status text, motivo_rejeicao text, created_at timestamptz
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public._prof_validate(p_prof_id, p_pin);
  RETURN QUERY
    SELECT p.id, p.professor_a_id, pa.nome,
           p.professor_b_id, pb.nome,
           p.data_a, p.horarios_a, ma.nome, ta.nome,
           p.data_b, p.horarios_b, mb.nome, tb.nome,
           p.observacao, p.status, p.motivo_rejeicao, p.created_at
    FROM public.permutas p
    LEFT JOIN public.professores pa ON pa.id = p.professor_a_id
    LEFT JOIN public.professores pb ON pb.id = p.professor_b_id
    LEFT JOIN public.materias ma ON ma.id = p.materia_a_id
    LEFT JOIN public.materias mb ON mb.id = p.materia_b_id
    LEFT JOIN public.turmas ta ON ta.id = p.turma_a_id
    LEFT JOIN public.turmas tb ON tb.id = p.turma_b_id
    WHERE p.professor_a_id = p_prof_id OR p.professor_b_id = p_prof_id
    ORDER BY p.created_at DESC;
END;
$$;

-- =====================================================================
-- 8) Admin/Coordenador aprova ou rejeita
-- =====================================================================
CREATE OR REPLACE FUNCTION public.permuta_aprovar(
  p_permuta_id uuid, p_acao text, p_motivo text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v RECORD; v_pa numeric; v_pb numeric;
  v_carga_a int; v_carga_b int;
  v_minutos int := 50;
  v_reg_a uuid; v_reg_b uuid;
BEGIN
  IF p_acao NOT IN ('aprovar','rejeitar') THEN RAISE EXCEPTION 'ação inválida'; END IF;
  SELECT * INTO v FROM public.permutas WHERE id = p_permuta_id;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Permuta não encontrada'; END IF;
  IF v.status <> 'pendente_admin' THEN RAISE EXCEPTION 'Permuta não está aguardando aprovação'; END IF;

  IF p_acao = 'rejeitar' THEN
    UPDATE public.permutas SET status='rejeitado',
      motivo_rejeicao=COALESCE(p_motivo,'Rejeitada'),
      aprovado_admin_em=now(), aprovado_por=auth.uid()
    WHERE id=p_permuta_id;
    INSERT INTO public.notificacoes(tipo,titulo,mensagem,destino_role,professor_id,link)
    VALUES ('permuta','Permuta rejeitada','Sua permuta foi rejeitada pela administração.','professor',v.professor_a_id,'/permuta'),
           ('permuta','Permuta rejeitada','A permuta foi rejeitada pela administração.','professor',v.professor_b_id,'/permuta');
    RETURN jsonb_build_object('ok',true,'status','rejeitado');
  END IF;

  -- Aprovar: cria dois registros_ponto trocados
  SELECT COALESCE(valor_hora_aula,0) INTO v_pa FROM public.professores WHERE id=v.professor_a_id;
  SELECT COALESCE(valor_hora_aula,0) INTO v_pb FROM public.professores WHERE id=v.professor_b_id;

  -- pega minutos por horario da config (fallback 50)
  SELECT COALESCE((data->>'minutos_por_horario')::int, 50) INTO v_minutos
  FROM public.app_settings WHERE id='global';

  v_carga_a := COALESCE(array_length(v.horarios_a,1),0) * v_minutos;
  v_carga_b := COALESCE(array_length(v.horarios_b,1),0) * v_minutos;

  -- A assume a aula de B (data_a, materia_a, turma_a)
  INSERT INTO public.registros_ponto(
    professor_id, materia_id, turma_id, data, horarios,
    quantidade_horarios, carga_horaria, valor_total,
    observacao, status_aprovacao
  ) VALUES (
    v.professor_a_id, v.materia_a_id, v.turma_a_id, v.data_a, v.horarios_a,
    COALESCE(array_length(v.horarios_a,1),0), v_carga_a,
    ROUND((v_carga_a / 60.0) * v_pa, 2),
    'Permuta aprovada (assumiu aula de outro professor)', 'aprovado'
  ) RETURNING id INTO v_reg_a;

  INSERT INTO public.registros_ponto(
    professor_id, materia_id, turma_id, data, horarios,
    quantidade_horarios, carga_horaria, valor_total,
    observacao, status_aprovacao
  ) VALUES (
    v.professor_b_id, v.materia_b_id, v.turma_b_id, v.data_b, v.horarios_b,
    COALESCE(array_length(v.horarios_b,1),0), v_carga_b,
    ROUND((v_carga_b / 60.0) * v_pb, 2),
    'Permuta aprovada (assumiu aula de outro professor)', 'aprovado'
  ) RETURNING id INTO v_reg_b;

  UPDATE public.permutas SET status='aprovado',
    aprovado_admin_em=now(), aprovado_por=auth.uid(),
    registro_a_id=v_reg_a, registro_b_id=v_reg_b
  WHERE id=p_permuta_id;

  INSERT INTO public.notificacoes(tipo,titulo,mensagem,destino_role,professor_id,link)
  VALUES ('permuta','Permuta aprovada','Sua permuta foi aprovada e registrada na folha.','professor',v.professor_a_id,'/permuta'),
         ('permuta','Permuta aprovada','A permuta foi aprovada e registrada na folha.','professor',v.professor_b_id,'/permuta');

  RETURN jsonb_build_object('ok',true,'status','aprovado','registro_a_id',v_reg_a,'registro_b_id',v_reg_b);
END;
$$;
