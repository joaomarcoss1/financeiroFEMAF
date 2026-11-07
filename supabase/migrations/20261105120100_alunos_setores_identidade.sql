-- F6/F7 — Migration B: identidade mínima (alunos, setores, equipe) e funções auxiliares.
-- Aditiva e idempotente. Depende da Migration A (novos valores de app_role).

-- ── Alunos ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.alunos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  matricula text NOT NULL UNIQUE,
  nome text NOT NULL,
  cpf text NOT NULL UNIQUE CHECK (cpf ~ '^[0-9]{11}$'),
  data_nascimento date NOT NULL,
  email text,
  telefone text,
  curso_id text NOT NULL,
  turma_id uuid REFERENCES public.turmas(id) ON DELETE SET NULL,
  situacao text NOT NULL DEFAULT 'ativo' CHECK (situacao IN ('ativo','trancado','formado','cancelado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_alunos_curso ON public.alunos(curso_id);
CREATE INDEX IF NOT EXISTS idx_alunos_turma ON public.alunos(turma_id);

-- ── Setores e equipe ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.setores (
  id text PRIMARY KEY,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true
);
INSERT INTO public.setores (id, nome) VALUES
  ('secretaria','Secretaria Acadêmica'),
  ('coordenacao','Coordenação de Curso'),
  ('comissao_tcc','Comissão de TCC'),
  ('financeiro','Financeiro'),
  ('ouvidoria','Ouvidoria'),
  ('nde','NDE'),
  ('direcao','Direção'),
  ('biblioteca','Biblioteca')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.setor_membros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setor_id text NOT NULL REFERENCES public.setores(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  curso_id text, -- coordenação/comissão por curso; NULL = todos os cursos
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_setor_membros ON public.setor_membros(setor_id, user_id, COALESCE(curso_id, ''));
CREATE INDEX IF NOT EXISTS idx_setor_membros_user ON public.setor_membros(user_id);

ALTER TABLE public.professores ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_professores_user_id ON public.professores(user_id) WHERE user_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.acesso_tentativas (
  chave text PRIMARY KEY,
  tentativas int NOT NULL DEFAULT 0,
  janela_inicio timestamptz NOT NULL DEFAULT now(),
  bloqueado_ate timestamptz
);

CREATE TABLE IF NOT EXISTS public.academico_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  acao text NOT NULL,
  entidade text NOT NULL,
  entidade_id text,
  old_data jsonb,
  new_data jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_acad_audit_entidade ON public.academico_audit_logs(entidade, entidade_id);

-- ── Funções auxiliares ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.has_any_role(_roles public.app_role[])
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = ANY(_roles));
$$;

CREATE OR REPLACE FUNCTION public.current_aluno_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.alunos WHERE user_id = auth.uid() AND auth.uid() IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.membro_setor(_setor text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin')
      OR EXISTS (SELECT 1 FROM public.setor_membros WHERE setor_id = _setor AND user_id = auth.uid());
$$;

CREATE OR REPLACE FUNCTION public.is_secretaria()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_any_role(ARRAY['secretaria','admin']::public.app_role[]) OR public.membro_setor('secretaria');
$$;

CREATE OR REPLACE FUNCTION public.coordena_curso(_curso text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin')
      OR EXISTS (SELECT 1 FROM public.setor_membros
                  WHERE setor_id = 'coordenacao' AND user_id = auth.uid()
                    AND (curso_id IS NULL OR curso_id = _curso))
      OR EXISTS (SELECT 1 FROM public.coordenadores c
                   JOIN public.professores p ON p.id = c.professor_id
                  WHERE p.user_id = auth.uid() AND _curso = ANY(c.cursos));
$$;

-- Pode o usuário atual agir num protocolo que está no setor _setor, do curso _curso?
CREATE OR REPLACE FUNCTION public.pode_atuar_setor(_setor text, _curso text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _setor IN ('coordenacao','comissao_tcc') THEN
      public.coordena_curso(_curso)
      OR EXISTS (SELECT 1 FROM public.setor_membros
                  WHERE setor_id = _setor AND user_id = auth.uid()
                    AND (curso_id IS NULL OR curso_id = _curso))
    WHEN _setor = 'secretaria' THEN public.is_secretaria()
    ELSE public.membro_setor(_setor)
  END;
$$;

CREATE OR REPLACE FUNCTION public.is_equipe()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_any_role(ARRAY['admin','secretaria','coordenador','diretor','setor']::public.app_role[])
      OR EXISTS (SELECT 1 FROM public.setor_membros WHERE user_id = auth.uid());
$$;

-- Primeiro acesso: liga a conta recém-criada ao cadastro do aluno.
-- Não lança exceção em falha para que o contador de tentativas seja gravado.
CREATE OR REPLACE FUNCTION public.aluno_vincular_conta(p_matricula text, p_cpf text, p_nascimento date)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_chave text := 'vinc:' || lower(trim(coalesce(p_matricula, '')));
  v_t public.acesso_tentativas;
  v_aluno public.alunos;
  v_erro constant jsonb := jsonb_build_object('ok', false, 'erro', 'Não foi possível confirmar seus dados. Confira matrícula, CPF e data de nascimento ou procure a secretaria.');
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Sessão expirada. Entre novamente.');
  END IF;
  IF EXISTS (SELECT 1 FROM public.alunos WHERE user_id = v_uid) THEN
    RETURN jsonb_build_object('ok', true, 'ja_vinculado', true);
  END IF;

  INSERT INTO public.acesso_tentativas (chave) VALUES (v_chave) ON CONFLICT (chave) DO NOTHING;
  SELECT * INTO v_t FROM public.acesso_tentativas WHERE chave = v_chave FOR UPDATE;
  IF v_t.bloqueado_ate IS NOT NULL AND v_t.bloqueado_ate > now() THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Muitas tentativas. Aguarde 15 minutos e tente de novo.');
  END IF;
  IF v_t.janela_inicio < now() - interval '15 minutes' THEN
    UPDATE public.acesso_tentativas SET tentativas = 0, janela_inicio = now(), bloqueado_ate = NULL WHERE chave = v_chave;
    v_t.tentativas := 0;
  END IF;

  SELECT * INTO v_aluno FROM public.alunos
   WHERE lower(matricula) = lower(trim(p_matricula))
     AND cpf = regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g')
     AND data_nascimento = p_nascimento
     AND user_id IS NULL
     AND situacao <> 'cancelado';

  IF v_aluno.id IS NULL THEN
    UPDATE public.acesso_tentativas
       SET tentativas = v_t.tentativas + 1,
           bloqueado_ate = CASE WHEN v_t.tentativas + 1 >= 5 THEN now() + interval '15 minutes' END
     WHERE chave = v_chave;
    RETURN v_erro;
  END IF;

  UPDATE public.alunos SET user_id = v_uid, updated_at = now() WHERE id = v_aluno.id;
  INSERT INTO public.user_roles (user_id, role)
    SELECT v_uid, 'aluno' WHERE NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_uid AND role = 'aluno');
  DELETE FROM public.acesso_tentativas WHERE chave = v_chave;
  INSERT INTO public.academico_audit_logs (user_id, acao, entidade, entidade_id)
    VALUES (v_uid, 'vincular_conta', 'alunos', v_aluno.id::text);
  RETURN jsonb_build_object('ok', true, 'aluno_id', v_aluno.id);
END;
$$;

-- Admin: contas da equipe (exclui contas de aluno) com papéis e setores.
CREATE OR REPLACE FUNCTION public.equipe_usuarios()
RETURNS TABLE (user_id uuid, email text, nome text, created_at timestamptz, roles text[], setores jsonb, professor_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT u.id, u.email::text, coalesce(u.raw_user_meta_data->>'nome', '')::text, u.created_at,
         coalesce((SELECT array_agg(r.role::text ORDER BY r.role::text) FROM public.user_roles r WHERE r.user_id = u.id), '{}'),
         coalesce((SELECT jsonb_agg(jsonb_build_object('id', m.id, 'setor_id', m.setor_id, 'curso_id', m.curso_id))
                     FROM public.setor_membros m WHERE m.user_id = u.id), '[]'::jsonb),
         (SELECT p.id FROM public.professores p WHERE p.user_id = u.id LIMIT 1)
    FROM auth.users u
   WHERE NOT EXISTS (SELECT 1 FROM public.alunos a WHERE a.user_id = u.id)
     AND coalesce(u.raw_user_meta_data->>'tipo', '') <> 'aluno'
   ORDER BY u.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.notificacoes_minhas_marcar_lidas(p_ids uuid[])
RETURNS void LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.notificacoes SET lida = true WHERE user_id = auth.uid() AND id = ANY(p_ids);
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.alunos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.setor_membros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acesso_tentativas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.academico_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Aluno le o proprio cadastro" ON public.alunos;
CREATE POLICY "Aluno le o proprio cadastro" ON public.alunos FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Secretaria gerencia alunos" ON public.alunos;
CREATE POLICY "Secretaria gerencia alunos" ON public.alunos FOR ALL TO authenticated
  USING (public.is_secretaria()) WITH CHECK (public.is_secretaria());

DROP POLICY IF EXISTS "Autenticados leem setores" ON public.setores;
CREATE POLICY "Autenticados leem setores" ON public.setores FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin gerencia setores" ON public.setores;
CREATE POLICY "Admin gerencia setores" ON public.setores FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Membro le os proprios setores" ON public.setor_membros;
CREATE POLICY "Membro le os proprios setores" ON public.setor_membros FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Admin gerencia setor_membros" ON public.setor_membros;
CREATE POLICY "Admin gerencia setor_membros" ON public.setor_membros FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Secretaria le auditoria academica" ON public.academico_audit_logs;
CREATE POLICY "Secretaria le auditoria academica" ON public.academico_audit_logs FOR SELECT TO authenticated USING (public.is_secretaria());

DROP POLICY IF EXISTS "Usuario le as proprias notificacoes" ON public.notificacoes;
CREATE POLICY "Usuario le as proprias notificacoes" ON public.notificacoes FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ── Grants ────────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.has_any_role(public.app_role[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_aluno_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.membro_setor(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_secretaria() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.coordena_curso(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pode_atuar_setor(text, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_equipe() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.aluno_vincular_conta(text, text, date) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.equipe_usuarios() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.notificacoes_minhas_marcar_lidas(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_any_role(public.app_role[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_aluno_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.membro_setor(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_secretaria() TO authenticated;
GRANT EXECUTE ON FUNCTION public.coordena_curso(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_atuar_setor(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_equipe() TO authenticated;
GRANT EXECUTE ON FUNCTION public.aluno_vincular_conta(text, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.equipe_usuarios() TO authenticated;
GRANT EXECUTE ON FUNCTION public.notificacoes_minhas_marcar_lidas(uuid[]) TO authenticated;
