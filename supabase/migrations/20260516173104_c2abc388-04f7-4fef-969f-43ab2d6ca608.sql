
-- 1. Tabela de coordenadores (vínculo professor -> cursos)
CREATE TABLE IF NOT EXISTS public.coordenadores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id uuid NOT NULL UNIQUE,
  cursos text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.coordenadores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage coordenadores"
  ON public.coordenadores FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Auth read coordenadores"
  ON public.coordenadores FOR SELECT TO authenticated USING (true);

-- 2. Exemplo: atribuir coordenação de curso(s) a um professor já cadastrado
-- INSERT INTO public.coordenadores (professor_id, cursos)
-- VALUES ('<uuid-do-professor>', ARRAY['ped'])
-- ON CONFLICT (professor_id) DO UPDATE SET cursos = EXCLUDED.cursos;

-- 3. Função interna de validação coordenador (nome+pin) -> retorna cursos ou erro
CREATE OR REPLACE FUNCTION public._coord_validate(p_prof_id uuid, p_pin text)
RETURNS text[]
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cursos text[];
BEGIN
  SELECT c.cursos INTO v_cursos
  FROM public.coordenadores c
  JOIN public.professores p ON p.id = c.professor_id
  WHERE c.professor_id = p_prof_id
    AND p.status = 'ativo'
    AND p.pin IS NOT NULL
    AND p.pin = p_pin;
  IF v_cursos IS NULL THEN
    RAISE EXCEPTION 'Credenciais inválidas' USING ERRCODE = '28000';
  END IF;
  RETURN v_cursos;
END;
$$;

-- 4. Login coordenador (nome completo + pin)
CREATE OR REPLACE FUNCTION public.coordenador_login(p_nome text, p_pin text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_prof RECORD;
  v_cursos text[];
BEGIN
  SELECT p.id, p.nome INTO v_prof
  FROM public.professores p
  JOIN public.coordenadores c ON c.professor_id = p.id
  WHERE lower(trim(p.nome)) = lower(trim(p_nome))
    AND p.status = 'ativo'
    AND p.pin = p_pin
  LIMIT 1;

  IF v_prof.id IS NULL THEN
    RAISE EXCEPTION 'Credenciais inválidas' USING ERRCODE = '28000';
  END IF;

  SELECT cursos INTO v_cursos FROM public.coordenadores WHERE professor_id = v_prof.id;
  RETURN jsonb_build_object('id', v_prof.id, 'nome', v_prof.nome, 'cursos', v_cursos);
END;
$$;

-- 5. Registros do período filtrados pelos cursos do coordenador
CREATE OR REPLACE FUNCTION public.coord_registros_periodo(
  p_prof_id uuid, p_pin text, p_start date, p_end date
)
RETURNS TABLE(
  id uuid, professor_id uuid, professor_nome text,
  materia_id uuid, materia_nome text,
  turma_id uuid, turma_nome text, curso_id text,
  data date, horarios integer[], quantidade_horarios integer,
  carga_horaria integer, valor_total numeric, valor_hora numeric,
  chave_pix text, cpf text,
  status_aprovacao text, retroativo boolean,
  observacao text, justificativa text, anexo_url text,
  motivo_rejeicao text, created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_cursos text[];
BEGIN
  v_cursos := public._coord_validate(p_prof_id, p_pin);
  RETURN QUERY
    SELECT r.id, r.professor_id, p.nome, r.materia_id, m.nome,
           r.turma_id, t.nome, t.curso_id, r.data, r.horarios,
           r.quantidade_horarios, r.carga_horaria, r.valor_total,
           p.valor_hora_aula, p.chave_pix, p.cpf,
           r.status_aprovacao, r.retroativo,
           r.observacao, r.justificativa, r.anexo_url,
           r.motivo_rejeicao, r.created_at
    FROM public.registros_ponto r
    JOIN public.turmas t ON t.id = r.turma_id
    JOIN public.professores p ON p.id = r.professor_id
    LEFT JOIN public.materias m ON m.id = r.materia_id
    WHERE t.curso_id = ANY(v_cursos)
      AND r.data BETWEEN p_start AND p_end
    ORDER BY r.data DESC, p.nome;
END;
$$;

-- 6. Pendentes retroativos para o coordenador
CREATE OR REPLACE FUNCTION public.coord_pendentes(p_prof_id uuid, p_pin text)
RETURNS TABLE(
  id uuid, professor_id uuid, professor_nome text,
  materia_nome text, turma_nome text, curso_id text,
  data date, horarios integer[], carga_horaria integer,
  valor_total numeric, justificativa text, anexo_url text,
  created_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_cursos text[];
BEGIN
  v_cursos := public._coord_validate(p_prof_id, p_pin);
  RETURN QUERY
    SELECT r.id, r.professor_id, p.nome, m.nome, t.nome, t.curso_id,
           r.data, r.horarios, r.carga_horaria, r.valor_total,
           r.justificativa, r.anexo_url, r.created_at
    FROM public.registros_ponto r
    JOIN public.turmas t ON t.id = r.turma_id
    JOIN public.professores p ON p.id = r.professor_id
    LEFT JOIN public.materias m ON m.id = r.materia_id
    WHERE t.curso_id = ANY(v_cursos)
      AND r.status_aprovacao = 'pendente'
    ORDER BY r.created_at DESC;
END;
$$;

-- 7. Aprovar/rejeitar registro (validação curso do coord)
CREATE OR REPLACE FUNCTION public.coord_aprovar_registro(
  p_prof_id uuid, p_pin text, p_registro_id uuid, p_acao text, p_motivo text
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cursos text[];
  v_reg RECORD;
  v_novo_status text;
BEGIN
  v_cursos := public._coord_validate(p_prof_id, p_pin);
  IF p_acao NOT IN ('aprovar','rejeitar') THEN
    RAISE EXCEPTION 'ação inválida';
  END IF;
  IF p_acao = 'rejeitar' AND (p_motivo IS NULL OR length(trim(p_motivo)) < 3) THEN
    RAISE EXCEPTION 'motivo obrigatório para rejeição';
  END IF;

  SELECT r.*, t.curso_id INTO v_reg
  FROM public.registros_ponto r
  JOIN public.turmas t ON t.id = r.turma_id
  WHERE r.id = p_registro_id;

  IF v_reg.id IS NULL THEN
    RAISE EXCEPTION 'registro não encontrado';
  END IF;
  IF NOT (v_reg.curso_id = ANY(v_cursos)) THEN
    RAISE EXCEPTION 'sem permissão para este curso';
  END IF;

  v_novo_status := CASE p_acao WHEN 'aprovar' THEN 'aprovado' ELSE 'rejeitado' END;

  UPDATE public.registros_ponto SET
    status_aprovacao = v_novo_status,
    aprovado_em = now(),
    motivo_rejeicao = CASE WHEN p_acao = 'rejeitar' THEN p_motivo ELSE NULL END
  WHERE id = p_registro_id;

  RETURN jsonb_build_object('ok', true, 'status', v_novo_status);
END;
$$;

-- 8. Grade de horários do(s) curso(s) do coord
CREATE OR REPLACE FUNCTION public.coord_grade(p_prof_id uuid, p_pin text)
RETURNS TABLE(
  id uuid, professor_id uuid, professor_nome text,
  materia_id uuid, materia_nome text,
  turma_id uuid, turma_nome text, curso_id text,
  dia_semana integer, horario_id integer
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_cursos text[];
BEGIN
  v_cursos := public._coord_validate(p_prof_id, p_pin);
  RETURN QUERY
    SELECT h.id, h.professor_id, p.nome, h.materia_id, m.nome,
           h.turma_id, t.nome, t.curso_id, h.dia_semana, h.horario_id
    FROM public.horarios_aula h
    JOIN public.turmas t ON t.id = h.turma_id
    JOIN public.professores p ON p.id = h.professor_id
    LEFT JOIN public.materias m ON m.id = h.materia_id
    WHERE t.curso_id = ANY(v_cursos)
    ORDER BY t.nome, h.dia_semana, h.horario_id;
END;
$$;

-- 9. Upsert/delete horário (valida que turma pertence ao curso do coord)
CREATE OR REPLACE FUNCTION public.coord_horario_upsert(
  p_prof_id uuid, p_pin text,
  p_id uuid, p_professor_id uuid, p_materia_id uuid,
  p_turma_id uuid, p_dia_semana integer, p_horario_id integer
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cursos text[];
  v_curso text;
BEGIN
  v_cursos := public._coord_validate(p_prof_id, p_pin);
  SELECT curso_id INTO v_curso FROM public.turmas WHERE id = p_turma_id;
  IF v_curso IS NULL OR NOT (v_curso = ANY(v_cursos)) THEN
    RAISE EXCEPTION 'turma fora dos cursos do coordenador';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.horarios_aula (professor_id, materia_id, turma_id, dia_semana, horario_id)
    VALUES (p_professor_id, p_materia_id, p_turma_id, p_dia_semana, p_horario_id);
  ELSE
    UPDATE public.horarios_aula SET
      professor_id = p_professor_id, materia_id = p_materia_id,
      turma_id = p_turma_id, dia_semana = p_dia_semana, horario_id = p_horario_id
    WHERE id = p_id;
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.coord_horario_delete(
  p_prof_id uuid, p_pin text, p_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cursos text[];
  v_curso text;
BEGIN
  v_cursos := public._coord_validate(p_prof_id, p_pin);
  SELECT t.curso_id INTO v_curso
  FROM public.horarios_aula h
  JOIN public.turmas t ON t.id = h.turma_id
  WHERE h.id = p_id;
  IF v_curso IS NULL OR NOT (v_curso = ANY(v_cursos)) THEN
    RAISE EXCEPTION 'sem permissão';
  END IF;
  DELETE FROM public.horarios_aula WHERE id = p_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 10. Professores que dão aula nos cursos do coordenador (com edição básica)
CREATE OR REPLACE FUNCTION public.coord_professores(p_prof_id uuid, p_pin text)
RETURNS TABLE(
  id uuid, nome text, email text, telefone text, cpf text,
  chave_pix text, valor_hora_aula numeric, status text,
  cursos text[]
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_cursos text[];
BEGIN
  v_cursos := public._coord_validate(p_prof_id, p_pin);
  RETURN QUERY
    SELECT p.id, p.nome, p.email, p.telefone, p.cpf, p.chave_pix,
           p.valor_hora_aula, p.status,
           ARRAY(
             SELECT DISTINCT t.curso_id
             FROM public.horarios_aula h
             JOIN public.turmas t ON t.id = h.turma_id
             WHERE h.professor_id = p.id AND t.curso_id = ANY(v_cursos)
           ) AS cursos_atua
    FROM public.professores p
    WHERE EXISTS (
      SELECT 1 FROM public.horarios_aula h2
      JOIN public.turmas t2 ON t2.id = h2.turma_id
      WHERE h2.professor_id = p.id AND t2.curso_id = ANY(v_cursos)
    )
    ORDER BY p.nome;
END;
$$;

CREATE OR REPLACE FUNCTION public.coord_professor_update(
  p_prof_id uuid, p_pin text, p_target_id uuid,
  p_nome text, p_email text, p_telefone text,
  p_chave_pix text, p_valor_hora numeric
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_cursos text[];
  v_ok boolean;
BEGIN
  v_cursos := public._coord_validate(p_prof_id, p_pin);
  SELECT EXISTS (
    SELECT 1 FROM public.horarios_aula h
    JOIN public.turmas t ON t.id = h.turma_id
    WHERE h.professor_id = p_target_id AND t.curso_id = ANY(v_cursos)
  ) INTO v_ok;
  IF NOT v_ok THEN RAISE EXCEPTION 'professor fora dos cursos do coordenador'; END IF;

  UPDATE public.professores SET
    nome = COALESCE(p_nome, nome),
    email = p_email,
    telefone = p_telefone,
    chave_pix = p_chave_pix,
    valor_hora_aula = COALESCE(p_valor_hora, valor_hora_aula)
  WHERE id = p_target_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- 11. Permitir RPC anon
GRANT EXECUTE ON FUNCTION public.coordenador_login(text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.coord_registros_periodo(uuid,text,date,date) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.coord_pendentes(uuid,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.coord_aprovar_registro(uuid,text,uuid,text,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.coord_grade(uuid,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.coord_horario_upsert(uuid,text,uuid,uuid,uuid,uuid,integer,integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.coord_horario_delete(uuid,text,uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.coord_professores(uuid,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.coord_professor_update(uuid,text,uuid,text,text,text,text,numeric) TO anon, authenticated;
