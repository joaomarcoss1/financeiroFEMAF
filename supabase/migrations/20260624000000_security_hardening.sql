-- ============================================================
--  SECURITY HARDENING — resolve os achados críticos da auditoria
--  (get_historico_professor sem PIN, permuta_aprovar sem checagem,
--   PIN em texto puro sem limite de tentativas, tabela de backup
--   sem RLS, view de ajustes exposta, bucket de anexos público)
-- ============================================================

-- ============================================================
-- 0) pgcrypto para hash de PIN
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- dblink: usado só para o contador de tentativas de PIN sobreviver ao
-- ROLLBACK do RAISE EXCEPTION de "credenciais inválidas" (ver função
-- _registrar_falha_pin abaixo). Se a extensão não puder ser criada neste
-- projeto, a validação do PIN continua 100% correta — só o bloqueio por
-- tentativas fica inativo (best-effort, nunca compromete a checagem em si).
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS dblink;
EXCEPTION WHEN OTHERS THEN
  NULL;
END;
$$;

-- ============================================================
-- 1) Colunas de controle de tentativas / bloqueio de PIN
-- ============================================================
ALTER TABLE public.professores
  ADD COLUMN IF NOT EXISTS pin_tentativas integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pin_bloqueado_ate timestamptz;

ALTER TABLE public.funcionarios_administrativos
  ADD COLUMN IF NOT EXISTS pin_tentativas integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pin_bloqueado_ate timestamptz;

-- Coluna computada: permite ao front saber "tem PIN?" sem nunca buscar o hash.
ALTER TABLE public.professores
  ADD COLUMN IF NOT EXISTS tem_pin boolean GENERATED ALWAYS AS (pin IS NOT NULL) STORED;

ALTER TABLE public.funcionarios_administrativos
  ADD COLUMN IF NOT EXISTS tem_pin boolean GENERATED ALWAYS AS (pin IS NOT NULL) STORED;

-- ============================================================
-- 2) Hashear PINs existentes (idempotente — hash bcrypt sempre
--    começa com $2a$/$2b$/$2y$, então rodar de novo não duplica hash)
-- ============================================================
UPDATE public.professores
SET pin = crypt(pin, gen_salt('bf'))
WHERE pin IS NOT NULL AND pin !~ '^\$2[aby]\$';

UPDATE public.funcionarios_administrativos
SET pin = crypt(pin, gen_salt('bf'))
WHERE pin IS NOT NULL AND pin !~ '^\$2[aby]\$';

-- ============================================================
-- 3) Trigger: qualquer PIN novo/alterado (via admin, coordenador
--    ou qualquer via futura) é hasheado automaticamente antes de
--    gravar, e o bloqueio é resetado quando o PIN muda.
-- ============================================================
CREATE OR REPLACE FUNCTION public._hash_pin_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.pin IS NOT NULL AND NEW.pin !~ '^\$2[aby]\$' THEN
    NEW.pin := crypt(NEW.pin, gen_salt('bf'));
  END IF;
  NEW.pin_tentativas := 0;
  NEW.pin_bloqueado_ate := NULL;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_professores_hash_pin ON public.professores;
CREATE TRIGGER trg_professores_hash_pin
  BEFORE INSERT OR UPDATE OF pin ON public.professores
  FOR EACH ROW EXECUTE FUNCTION public._hash_pin_trigger();

DROP TRIGGER IF EXISTS trg_funcionarios_hash_pin ON public.funcionarios_administrativos;
CREATE TRIGGER trg_funcionarios_hash_pin
  BEFORE INSERT OR UPDATE OF pin ON public.funcionarios_administrativos
  FOR EACH ROW EXECUTE FUNCTION public._hash_pin_trigger();

-- ============================================================
-- 3.1) Contador de tentativas falhas de PIN — via dblink (loopback) para
--      que o UPDATE sobreviva ao ROLLBACK do RAISE EXCEPTION que acontece
--      logo em seguida na mesma transação (senão o contador nunca avança:
--      testado localmente e confirmado que, sem isso, pin_tentativas fica
--      sempre em 0 e o bloqueio nunca ativa).
-- ============================================================
CREATE OR REPLACE FUNCTION public._registrar_falha_pin(p_tabela text, p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM dblink_exec(
    'dbname=' || current_database() || ' user=' || current_user,
    format(
      'UPDATE public.%I SET pin_tentativas = pin_tentativas + 1,
         pin_bloqueado_ate = CASE WHEN pin_tentativas + 1 >= 5 THEN now() + interval ''15 minutes'' ELSE pin_bloqueado_ate END
       WHERE id = %L',
      p_tabela, p_id
    )
  );
EXCEPTION WHEN OTHERS THEN
  -- best-effort: se dblink não estiver disponível, a checagem de PIN
  -- em si continua correta, só o bloqueio por tentativas fica inativo.
  NULL;
END;
$$;

-- ============================================================
-- 4) _prof_validate / _func_adm_validate / _coord_validate:
--    comparação por hash + bloqueio de 15min após 5 tentativas.
--    Assinatura e comportamento (RAISE em falha) preservados —
--    nenhum chamador existente precisa mudar.
-- ============================================================
CREATE OR REPLACE FUNCTION public._prof_validate(p_prof_id uuid, p_pin text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_row RECORD;
BEGIN
  SELECT id, pin, status, pin_tentativas, pin_bloqueado_ate
    INTO v_row
  FROM public.professores
  WHERE id = p_prof_id;

  IF v_row.id IS NULL OR v_row.status <> 'ativo' OR v_row.pin IS NULL THEN
    RAISE EXCEPTION 'Credenciais inválidas' USING ERRCODE = '28000';
  END IF;

  IF v_row.pin_bloqueado_ate IS NOT NULL AND v_row.pin_bloqueado_ate > now() THEN
    RAISE EXCEPTION 'Muitas tentativas. Tente novamente em alguns minutos.' USING ERRCODE = '28000';
  END IF;

  IF v_row.pin <> crypt(p_pin, v_row.pin) THEN
    PERFORM public._registrar_falha_pin('professores', p_prof_id);
    RAISE EXCEPTION 'Credenciais inválidas' USING ERRCODE = '28000';
  END IF;

  UPDATE public.professores SET pin_tentativas = 0, pin_bloqueado_ate = NULL WHERE id = p_prof_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public._func_adm_validate(p_id uuid, p_pin text)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_row RECORD;
BEGIN
  SELECT id, pin, ativo, pin_tentativas, pin_bloqueado_ate
    INTO v_row
  FROM public.funcionarios_administrativos
  WHERE id = p_id;

  IF v_row.id IS NULL OR v_row.ativo <> true OR v_row.pin IS NULL THEN
    RAISE EXCEPTION 'Credenciais inválidas' USING ERRCODE = '28000';
  END IF;

  IF v_row.pin_bloqueado_ate IS NOT NULL AND v_row.pin_bloqueado_ate > now() THEN
    RAISE EXCEPTION 'Muitas tentativas. Tente novamente em alguns minutos.' USING ERRCODE = '28000';
  END IF;

  IF v_row.pin <> crypt(p_pin, v_row.pin) THEN
    PERFORM public._registrar_falha_pin('funcionarios_administrativos', p_id);
    RAISE EXCEPTION 'Credenciais inválidas' USING ERRCODE = '28000';
  END IF;

  UPDATE public.funcionarios_administrativos SET pin_tentativas = 0, pin_bloqueado_ate = NULL WHERE id = p_id;
  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public._coord_validate(p_prof_id uuid, p_pin text)
RETURNS text[]
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_row RECORD;
BEGIN
  SELECT p.id, p.pin, p.status, p.pin_tentativas, p.pin_bloqueado_ate, c.cursos
    INTO v_row
  FROM public.professores p
  JOIN public.coordenadores c ON c.professor_id = p.id
  WHERE p.id = p_prof_id;

  IF v_row.id IS NULL OR v_row.status <> 'ativo' OR v_row.pin IS NULL THEN
    RAISE EXCEPTION 'Credenciais inválidas' USING ERRCODE = '28000';
  END IF;

  IF v_row.pin_bloqueado_ate IS NOT NULL AND v_row.pin_bloqueado_ate > now() THEN
    RAISE EXCEPTION 'Muitas tentativas. Tente novamente em alguns minutos.' USING ERRCODE = '28000';
  END IF;

  IF v_row.pin <> crypt(p_pin, v_row.pin) THEN
    PERFORM public._registrar_falha_pin('professores', p_prof_id);
    RAISE EXCEPTION 'Credenciais inválidas' USING ERRCODE = '28000';
  END IF;

  UPDATE public.professores SET pin_tentativas = 0, pin_bloqueado_ate = NULL WHERE id = p_prof_id;
  RETURN v_row.cursos;
END;
$$;

-- coordenador_login tem checagem de PIN própria (não usa _coord_validate,
-- pois ainda não sabe o id do professor — só o nome). Mesmo tratamento.
CREATE OR REPLACE FUNCTION public.coordenador_login(p_nome text, p_pin text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_prof RECORD;
  v_cursos text[];
BEGIN
  SELECT p.id, p.nome, p.pin, p.pin_tentativas, p.pin_bloqueado_ate
    INTO v_prof
  FROM public.professores p
  JOIN public.coordenadores c ON c.professor_id = p.id
  WHERE lower(trim(p.nome)) = lower(trim(p_nome))
    AND p.status = 'ativo'
  LIMIT 1;

  IF v_prof.id IS NULL THEN
    RAISE EXCEPTION 'Credenciais inválidas' USING ERRCODE = '28000';
  END IF;

  IF v_prof.pin_bloqueado_ate IS NOT NULL AND v_prof.pin_bloqueado_ate > now() THEN
    RAISE EXCEPTION 'Muitas tentativas. Tente novamente em alguns minutos.' USING ERRCODE = '28000';
  END IF;

  IF v_prof.pin IS NULL OR v_prof.pin <> crypt(p_pin, v_prof.pin) THEN
    PERFORM public._registrar_falha_pin('professores', v_prof.id);
    RAISE EXCEPTION 'Credenciais inválidas' USING ERRCODE = '28000';
  END IF;

  UPDATE public.professores SET pin_tentativas = 0, pin_bloqueado_ate = NULL WHERE id = v_prof.id;

  SELECT cursos INTO v_cursos FROM public.coordenadores WHERE professor_id = v_prof.id;
  RETURN jsonb_build_object('id', v_prof.id, 'nome', v_prof.nome, 'cursos', v_cursos);
END;
$$;

-- ============================================================
-- 5) get_historico_professor: era pública e SEM checagem de PIN
--    (achado crítico #1 da auditoria) — agora exige PIN como
--    todas as outras funções da mesma família.
-- ============================================================
DROP FUNCTION IF EXISTS public.get_historico_professor(uuid, int);

CREATE OR REPLACE FUNCTION public.get_historico_professor(p_prof_id uuid, p_pin text, p_limite int DEFAULT 5)
RETURNS TABLE (
  id uuid,
  professor_id uuid,
  materia_id uuid,
  turma_id uuid,
  data date,
  horarios integer[],
  quantidade_horarios integer,
  carga_horaria integer,
  valor_total numeric,
  observacao text,
  status_aprovacao text,
  retroativo boolean,
  substituicao boolean,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public._prof_validate(p_prof_id, p_pin);
  RETURN QUERY
    SELECT
      r.id, r.professor_id, r.materia_id, r.turma_id, r.data,
      r.horarios, r.quantidade_horarios, r.carga_horaria, r.valor_total,
      r.observacao, r.status_aprovacao, r.retroativo, r.substituicao, r.created_at
    FROM public.registros_ponto r
    WHERE r.professor_id = p_prof_id
    ORDER BY r.created_at DESC
    LIMIT GREATEST(LEAST(p_limite, 100), 1);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_historico_professor(uuid, text, int) TO anon, authenticated;

-- ============================================================
-- 6) permuta_aprovar: não tinha has_role(admin) nem PIN, e
--    NUNCA recebeu GRANT/REVOKE (executável por PUBLIC por
--    padrão do Postgres). Também corrige o cálculo de valor_total,
--    que dividia por 60 incorretamente (deveria ser sempre
--    quantidade_horarios × valor_hora_aula, igual ao resto do sistema).
-- ============================================================
CREATE OR REPLACE FUNCTION public.permuta_aprovar(
  p_permuta_id uuid, p_acao text, p_motivo text
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v RECORD; v_pa numeric; v_pb numeric;
  v_carga_a int; v_carga_b int;
  v_minutos int := 50;
  v_qtd_a int; v_qtd_b int;
  v_reg_a uuid; v_reg_b uuid;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'sem permissão' USING ERRCODE = '28000';
  END IF;

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

  SELECT COALESCE(valor_hora_aula,0) INTO v_pa FROM public.professores WHERE id=v.professor_a_id;
  SELECT COALESCE(valor_hora_aula,0) INTO v_pb FROM public.professores WHERE id=v.professor_b_id;

  SELECT COALESCE((data->>'minutos_por_horario')::int, 50) INTO v_minutos
  FROM public.app_settings WHERE id='global';

  v_qtd_a := COALESCE(array_length(v.horarios_a,1),0);
  v_qtd_b := COALESCE(array_length(v.horarios_b,1),0);
  v_carga_a := v_qtd_a * v_minutos;
  v_carga_b := v_qtd_b * v_minutos;

  INSERT INTO public.registros_ponto(
    professor_id, materia_id, turma_id, data, horarios,
    quantidade_horarios, carga_horaria, valor_total,
    observacao, status_aprovacao
  ) VALUES (
    v.professor_a_id, v.materia_a_id, v.turma_a_id, v.data_a, v.horarios_a,
    v_qtd_a, v_carga_a, ROUND(v_qtd_a * v_pa, 2),
    'Permuta aprovada (assumiu aula de outro professor)', 'aprovado'
  ) RETURNING id INTO v_reg_a;

  INSERT INTO public.registros_ponto(
    professor_id, materia_id, turma_id, data, horarios,
    quantidade_horarios, carga_horaria, valor_total,
    observacao, status_aprovacao
  ) VALUES (
    v.professor_b_id, v.materia_b_id, v.turma_b_id, v.data_b, v.horarios_b,
    v_qtd_b, v_carga_b, ROUND(v_qtd_b * v_pb, 2),
    'Permuta aprovada (assumiu aula de outro professor)', 'aprovado'
  ) RETURNING id INTO v_reg_b;

  UPDATE public.permutas SET status='aprovado',
    aprovado_admin_em=now(), aprovado_por=auth.uid(),
    registro_a_id=v_reg_a, registro_b_id=v_reg_b
  WHERE id=p_permuta_id;

  INSERT INTO public.notificacoes(tipo,titulo,mensagem,destino_role,professor_id,link)
  VALUES ('permuta','Permuta aprovada','Sua permuta foi aprovada e registrada na folha.','professor',v.professor_a_id,'/permuta'),
         ('permuta','Permuta aprovada','A permuta foi aprovada e registrada na folha.','professor',v.professor_b_id,'/permuta');

  INSERT INTO public.payroll_adjustment_audit_logs(user_id, action, entity_type, entity_id, description, new_data)
  VALUES (auth.uid(), 'permuta_aprovada', 'permuta', p_permuta_id,
          'Permuta aprovada entre professores',
          jsonb_build_object('registro_a', v_reg_a, 'registro_b', v_reg_b));

  RETURN jsonb_build_object('ok',true,'status','aprovado','registro_a_id',v_reg_a,'registro_b_id',v_reg_b);
END;
$$;

-- Trava explicitamente o EXECUTE público (herdado por padrão do Postgres)
-- e concede apenas o que cada função realmente precisa.
-- IMPORTANTE: no Supabase, funções novas recebem EXECUTE diretamente para
-- os roles anon/authenticated via default privileges do projeto — não é um
-- grant a PUBLIC. "REVOKE ALL FROM PUBLIC" sozinho não remove isso (testado
-- localmente: anon continuava com EXECUTE mesmo depois do REVOKE FROM
-- PUBLIC). Por isso revogamos explicitamente de PUBLIC e anon, replicando o
-- padrão já usado alhures neste projeto (ex.: migration 20260617000323).
REVOKE ALL ON FUNCTION public.permuta_solicitar(uuid,text,uuid,date,int[],uuid,uuid,date,int[],uuid,uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.permuta_responder(uuid,text,uuid,boolean,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.permuta_listar(uuid,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.permuta_aprovar(uuid,text,text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.permuta_solicitar(uuid,text,uuid,date,int[],uuid,uuid,date,int[],uuid,uuid,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.permuta_responder(uuid,text,uuid,boolean,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.permuta_listar(uuid,text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.permuta_aprovar(uuid,text,text) TO authenticated;

-- ============================================================
-- 7) _backup_registros_ponto: única tabela sem RLS.
-- ============================================================
ALTER TABLE public._backup_registros_ponto ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins only backup registros" ON public._backup_registros_ponto;
CREATE POLICY "Admins only backup registros"
  ON public._backup_registros_ponto FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

REVOKE ALL ON public._backup_registros_ponto FROM anon, authenticated;
GRANT SELECT ON public._backup_registros_ponto TO authenticated;

-- ============================================================
-- 8) vw_ajustes_pagamento: view "de conferência" interna, não é
--    usada por nenhuma tela do app, mas estava com GRANT SELECT
--    para todo `authenticated` sem checagem de admin — e como view
--    comum ela ignora o RLS de registros_ponto/professores.
--    Revoga o acesso direto (permanece consultável só por
--    service_role/postgres para conferência manual).
-- ============================================================
REVOKE ALL ON public.vw_ajustes_pagamento FROM authenticated, anon;

-- ============================================================
-- 9) coord_professor_update altera valor_hora_aula sem deixar
--    auditoria (diferente de todo o resto da folha, que já loga
--    em payroll_adjustment_audit_logs).
-- ============================================================
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
  v_old RECORD;
BEGIN
  v_cursos := public._coord_validate(p_prof_id, p_pin);
  SELECT EXISTS (
    SELECT 1 FROM public.horarios_aula h
    JOIN public.turmas t ON t.id = h.turma_id
    WHERE h.professor_id = p_target_id AND t.curso_id = ANY(v_cursos)
  ) INTO v_ok;
  IF NOT v_ok THEN RAISE EXCEPTION 'professor fora dos cursos do coordenador'; END IF;

  SELECT nome, email, telefone, chave_pix, valor_hora_aula INTO v_old
  FROM public.professores WHERE id = p_target_id;

  UPDATE public.professores SET
    nome = COALESCE(p_nome, nome),
    email = p_email,
    telefone = p_telefone,
    chave_pix = p_chave_pix,
    valor_hora_aula = COALESCE(p_valor_hora, valor_hora_aula)
  WHERE id = p_target_id;

  IF p_valor_hora IS NOT NULL AND p_valor_hora IS DISTINCT FROM v_old.valor_hora_aula THEN
    INSERT INTO public.payroll_adjustment_audit_logs(
      user_id, action, entity_type, entity_id, description, old_data, new_data
    ) VALUES (
      p_prof_id, 'coord_altera_valor_hora', 'professor', p_target_id,
      'Coordenador alterou valor da hora-aula',
      jsonb_build_object('valor_hora_aula', v_old.valor_hora_aula),
      jsonb_build_object('valor_hora_aula', p_valor_hora)
    );
  END IF;

  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ============================================================
-- 10) Bucket de anexos (atestados/justificativas) era público —
--     qualquer um com o link direto baixava o documento sem
--     passar pelo RLS de storage.objects. Passa a privado;
--     acesso segue via URL assinada de curta duração.
-- ============================================================
UPDATE storage.buckets SET public = false WHERE id = 'justificativas';
