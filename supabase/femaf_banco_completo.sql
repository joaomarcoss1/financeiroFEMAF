-- Plataforma de Gestão Financeira FEMAF — banco completo (todas as migrações + carga 2026.2)
-- Gerado a partir de supabase/migrations/ em ordem cronológica. Rode no SQL Editor do Supabase.

-- ===== 20260407041223_daa73bf4-ac58-4d92-8247-6ca33096d843.sql =====
-- Role enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Professores
CREATE TABLE public.professores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cpf text,
  email text,
  telefone text,
  valor_hora_aula numeric(10,2) DEFAULT 0,
  chave_pix text,
  status text DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  pin text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.professores ENABLE ROW LEVEL SECURITY;

-- Materias
CREATE TABLE public.materias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  carga_horaria_total int DEFAULT 0,
  curso_id text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.materias ENABLE ROW LEVEL SECURITY;

-- Professor-Materia link
CREATE TABLE public.professor_materias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id uuid REFERENCES public.professores(id) ON DELETE CASCADE NOT NULL,
  materia_id uuid REFERENCES public.materias(id) ON DELETE CASCADE NOT NULL,
  UNIQUE (professor_id, materia_id)
);
ALTER TABLE public.professor_materias ENABLE ROW LEVEL SECURITY;

-- Turmas
CREATE TABLE public.turmas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  curso_id text NOT NULL,
  periodo text,
  turno text DEFAULT 'Noturno',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.turmas ENABLE ROW LEVEL SECURITY;

-- Turma-Materia link
CREATE TABLE public.turma_materias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id uuid REFERENCES public.turmas(id) ON DELETE CASCADE NOT NULL,
  materia_id uuid REFERENCES public.materias(id) ON DELETE CASCADE NOT NULL,
  UNIQUE (turma_id, materia_id)
);
ALTER TABLE public.turma_materias ENABLE ROW LEVEL SECURITY;

-- Registros de Ponto
CREATE TABLE public.registros_ponto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id uuid REFERENCES public.professores(id) ON DELETE CASCADE NOT NULL,
  materia_id uuid REFERENCES public.materias(id) NOT NULL,
  turma_id uuid REFERENCES public.turmas(id) NOT NULL,
  data date NOT NULL,
  horarios int[] NOT NULL,
  quantidade_horarios int NOT NULL,
  carga_horaria int NOT NULL,
  valor_total numeric(10,2) NOT NULL,
  observacao text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);
ALTER TABLE public.registros_ponto ENABLE ROW LEVEL SECURITY;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_registros_ponto_updated_at
  BEFORE UPDATE ON public.registros_ponto
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: Admin full access
CREATE POLICY "Admins full access professores" ON public.professores FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins full access materias" ON public.materias FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins full access turmas" ON public.turmas FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins full access professor_materias" ON public.professor_materias FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins full access turma_materias" ON public.turma_materias FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins full access registros" ON public.registros_ponto FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS: Anon read access for professor clock-in
CREATE POLICY "Anon read professores" ON public.professores FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read materias" ON public.materias FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read turmas" ON public.turmas FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read professor_materias" ON public.professor_materias FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read turma_materias" ON public.turma_materias FOR SELECT TO anon USING (true);
CREATE POLICY "Anon insert registros" ON public.registros_ponto FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon read registros" ON public.registros_ponto FOR SELECT TO anon USING (true);

-- RLS: Auth read for non-admin authenticated users  
CREATE POLICY "Auth read professores" ON public.professores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth read materias" ON public.materias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth read turmas" ON public.turmas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth read professor_materias" ON public.professor_materias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth read turma_materias" ON public.turma_materias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth read registros" ON public.registros_ponto FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Auth insert registros for authenticated too
CREATE POLICY "Auth insert registros" ON public.registros_ponto FOR INSERT TO authenticated WITH CHECK (true);

-- ===== 20260411014609_0803462a-4871-4e59-9b3f-641ad2d7dd8f.sql =====

ALTER TABLE public.registros_ponto
ADD COLUMN latitude double precision,
ADD COLUMN longitude double precision;


-- ===== 20260417203830_bff2aee2-d2e2-456c-969f-12c5e74d4e86.sql =====
-- 1) Remove a policy permissiva de insert anônimo (substituída por edge function com service role)
DROP POLICY IF EXISTS "Anon insert registros" ON public.registros_ponto;

-- 2) Índice único anti-duplicidade: 1 professor + 1 dia + 1 horário = único registro
-- Usa unnest para criar entrada por horário individual
CREATE OR REPLACE FUNCTION public.check_horario_duplicado()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  h INTEGER;
  conflito RECORD;
BEGIN
  FOREACH h IN ARRAY NEW.horarios LOOP
    SELECT id INTO conflito
    FROM public.registros_ponto
    WHERE professor_id = NEW.professor_id
      AND data = NEW.data
      AND h = ANY(horarios)
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    LIMIT 1;

    IF FOUND THEN
      RAISE EXCEPTION 'Horário % já registrado para este professor nesta data', h
        USING ERRCODE = 'unique_violation';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_horario_duplicado ON public.registros_ponto;
CREATE TRIGGER trg_check_horario_duplicado
BEFORE INSERT OR UPDATE ON public.registros_ponto
FOR EACH ROW
EXECUTE FUNCTION public.check_horario_duplicado();

-- 3) Trigger de updated_at
DROP TRIGGER IF EXISTS trg_registros_ponto_updated_at ON public.registros_ponto;
CREATE TRIGGER trg_registros_ponto_updated_at
BEFORE UPDATE ON public.registros_ponto
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ===== 20260417203842_0925d2eb-1923-4c10-ac21-04d65da00a00.sql =====
-- Remove insert permissivo para authenticated (agora só via edge function service role)
DROP POLICY IF EXISTS "Auth insert registros" ON public.registros_ponto;

-- ===== 20260505150555_bc220396-aa76-4d74-9982-359474aa2de2.sql =====

-- (Dados de exemplo da instituição anterior removidos — a carga da FEMAF está em 20261107120000_dados_femaf_2026_2.sql)

-- 6. Tabela horarios_aula (grade fixa)
CREATE TABLE public.horarios_aula (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id uuid NOT NULL REFERENCES public.professores(id) ON DELETE CASCADE,
  materia_id uuid NOT NULL REFERENCES public.materias(id) ON DELETE CASCADE,
  turma_id uuid NOT NULL REFERENCES public.turmas(id) ON DELETE CASCADE,
  dia_semana int NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  horario_id int NOT NULL CHECK (horario_id BETWEEN 1 AND 4),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (professor_id, materia_id, turma_id, dia_semana, horario_id)
);
ALTER TABLE public.horarios_aula ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anon read horarios_aula" ON public.horarios_aula FOR SELECT TO anon USING (true);
CREATE POLICY "Auth read horarios_aula" ON public.horarios_aula FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage horarios_aula" ON public.horarios_aula FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX idx_horarios_aula_lookup ON public.horarios_aula (professor_id, materia_id, turma_id, dia_semana);

-- 8. Colunas adicionais em registros_ponto
ALTER TABLE public.registros_ponto
  ADD COLUMN IF NOT EXISTS retroativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS justificativa text,
  ADD COLUMN IF NOT EXISTS anexo_url text;

-- 9. Bucket de armazenamento para anexos de justificativa
INSERT INTO storage.buckets (id, name, public)
VALUES ('justificativas', 'justificativas', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can upload justificativas" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'justificativas');

CREATE POLICY "Anyone can view justificativas" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'justificativas');


-- ===== 20260505155607_0facb590-eed7-4146-af71-81c6c7d61223.sql =====

-- 1. registros_ponto: aprovação + substituição
ALTER TABLE public.registros_ponto
  ADD COLUMN IF NOT EXISTS status_aprovacao text NOT NULL DEFAULT 'aprovado',
  ADD COLUMN IF NOT EXISTS aprovado_por uuid,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_rejeicao text,
  ADD COLUMN IF NOT EXISTS substituicao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS professor_substituido_id uuid;

ALTER TABLE public.registros_ponto
  DROP CONSTRAINT IF EXISTS registros_ponto_status_aprovacao_check;
ALTER TABLE public.registros_ponto
  ADD CONSTRAINT registros_ponto_status_aprovacao_check
  CHECK (status_aprovacao IN ('pendente','aprovado','rejeitado'));

CREATE INDEX IF NOT EXISTS idx_registros_status ON public.registros_ponto(status_aprovacao);
CREATE INDEX IF NOT EXISTS idx_registros_data ON public.registros_ponto(data);

-- Atualiza trigger de duplicidade para ignorar rejeitados
CREATE OR REPLACE FUNCTION public.check_horario_duplicado()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  h INTEGER;
  conflito RECORD;
BEGIN
  IF NEW.status_aprovacao = 'rejeitado' THEN
    RETURN NEW;
  END IF;
  FOREACH h IN ARRAY NEW.horarios LOOP
    SELECT id INTO conflito
    FROM public.registros_ponto
    WHERE professor_id = NEW.professor_id
      AND data = NEW.data
      AND h = ANY(horarios)
      AND status_aprovacao <> 'rejeitado'
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    LIMIT 1;

    IF FOUND THEN
      RAISE EXCEPTION 'Horário % já registrado para este professor nesta data', h
        USING ERRCODE = 'unique_violation';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_check_horario_duplicado ON public.registros_ponto;
CREATE TRIGGER trg_check_horario_duplicado
BEFORE INSERT OR UPDATE ON public.registros_ponto
FOR EACH ROW EXECUTE FUNCTION public.check_horario_duplicado();

-- 2. push_subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  professor_id uuid,
  user_id uuid,
  role text NOT NULL DEFAULT 'professor',
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage push_subscriptions" ON public.push_subscriptions
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Anon insert push_subscriptions" ON public.push_subscriptions
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon read push_subscriptions" ON public.push_subscriptions
  FOR SELECT TO anon USING (true);
CREATE POLICY "Auth read push_subscriptions" ON public.push_subscriptions
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_push_prof ON public.push_subscriptions(professor_id);
CREATE INDEX IF NOT EXISTS idx_push_role ON public.push_subscriptions(role);

-- 3. notificacoes (sino in-app)
CREATE TABLE IF NOT EXISTS public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destino_role text NOT NULL DEFAULT 'professor',
  professor_id uuid,
  user_id uuid,
  tipo text NOT NULL,
  titulo text NOT NULL,
  mensagem text NOT NULL,
  link text,
  lida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage notificacoes" ON public.notificacoes
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Anon read notificacoes" ON public.notificacoes
  FOR SELECT TO anon USING (true);
CREATE POLICY "Auth read notificacoes" ON public.notificacoes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anon update lida" ON public.notificacoes
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_notif_prof ON public.notificacoes(professor_id, lida);
CREATE INDEX IF NOT EXISTS idx_notif_role ON public.notificacoes(destino_role, lida);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.registros_ponto;

-- Garante pg_cron e pg_net para cron de notificações
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;


-- ===== 20260508133703_aeb204ed-795e-4880-b704-7ae700237224.sql =====

ALTER TABLE public.horarios_aula DROP CONSTRAINT IF EXISTS horarios_aula_horario_id_check;
ALTER TABLE public.horarios_aula ADD CONSTRAINT horarios_aula_horario_id_check CHECK (horario_id BETWEEN 1 AND 8);


-- ===== 20260509020546_0488a63c-c0a7-4d94-8dd8-f2a448f83ce7.sql =====
-- 1. Revoga acesso anônimo a tabelas sensíveis
DROP POLICY IF EXISTS "Anon read professores" ON public.professores;
DROP POLICY IF EXISTS "Anon read registros" ON public.registros_ponto;
DROP POLICY IF EXISTS "Anon read push_subscriptions" ON public.push_subscriptions;

-- 2. Função pública: lista de professores ativos (sem dados sensíveis)
CREATE OR REPLACE FUNCTION public.list_professores_ativos()
RETURNS TABLE (id uuid, nome text, valor_hora_aula numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.nome, p.valor_hora_aula
  FROM public.professores p
  WHERE p.status = 'ativo'
  ORDER BY p.nome;
$$;

GRANT EXECUTE ON FUNCTION public.list_professores_ativos() TO anon, authenticated;

-- 3. Função pública: histórico recente do professor (sem GPS/justificativa/anexo)
CREATE OR REPLACE FUNCTION public.get_historico_professor(prof_id uuid, limite int DEFAULT 5)
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
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    r.id, r.professor_id, r.materia_id, r.turma_id, r.data,
    r.horarios, r.quantidade_horarios, r.carga_horaria, r.valor_total,
    r.observacao, r.status_aprovacao, r.retroativo, r.substituicao, r.created_at
  FROM public.registros_ponto r
  WHERE r.professor_id = prof_id
  ORDER BY r.created_at DESC
  LIMIT GREATEST(LEAST(limite, 100), 1);
$$;

GRANT EXECUTE ON FUNCTION public.get_historico_professor(uuid, int) TO anon, authenticated;

-- 4. Índices de performance
CREATE INDEX IF NOT EXISTS idx_registros_data ON public.registros_ponto(data);
CREATE INDEX IF NOT EXISTS idx_registros_prof_data ON public.registros_ponto(professor_id, data);
CREATE INDEX IF NOT EXISTS idx_registros_status ON public.registros_ponto(status_aprovacao);

-- ===== 20260510003203_cf67c18a-3c50-4f51-81ab-480b62559313.sql =====

CREATE TABLE IF NOT EXISTS public.calendario_academico (
  data DATE PRIMARY KEY,
  tipo TEXT NOT NULL CHECK (tipo IN ('feriado','recesso','sabado_letivo','evento','prova','reposicao')),
  descricao TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.calendario_academico ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anon read calendario" ON public.calendario_academico FOR SELECT TO anon USING (true);
CREATE POLICY "Auth read calendario" ON public.calendario_academico FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage calendario" ON public.calendario_academico FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.is_dia_letivo(d date)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  t text;
  dow int;
BEGIN
  SELECT tipo INTO t FROM public.calendario_academico WHERE data = d;
  IF t IN ('feriado','recesso') THEN
    RETURN false;
  END IF;
  IF t IN ('sabado_letivo','reposicao','evento','prova') THEN
    RETURN true;
  END IF;
  dow := EXTRACT(DOW FROM d);
  IF dow = 0 THEN RETURN false; END IF; -- domingo
  IF dow = 6 THEN RETURN false; END IF; -- sábado sem marcação
  RETURN true;
END;
$$;

-- (Calendário 2026.1 da instituição anterior removido — o calendário 2026.2 da FEMAF é carregado em 20261107120000_dados_femaf_2026_2.sql)


-- ===== 20260516173104_c2abc388-04f7-4fef-969f-43ab2d6ca608.sql =====

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


-- ===== 20260521203045_a71b23dc-c680-42bf-a637-09bd59e16484.sql =====

-- Exemplo: atualizar/reatribuir coordenação de curso(s)
-- [dados reais de cadastro removidos nesta versão pública/limpa do repositório]
-- UPDATE public.coordenadores SET cursos = ARRAY['dir']::text[] WHERE professor_id = '<uuid-do-professor>';
-- INSERT INTO public.coordenadores (professor_id, cursos)
-- VALUES ('<uuid-do-professor>', ARRAY['adm']::text[])
-- ON CONFLICT (professor_id) DO UPDATE SET cursos = EXCLUDED.cursos;


-- ===== 20260521203655_626d7e3f-ec6e-4c96-b94d-fdf32be83a4b.sql =====

CREATE TABLE IF NOT EXISTS public.app_settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read app_settings" ON public.app_settings;
CREATE POLICY "Anyone can read app_settings" ON public.app_settings FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage app_settings" ON public.app_settings;
CREATE POLICY "Admins manage app_settings" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.app_settings (id, data) VALUES (
  'global',
  jsonb_build_object(
    'geofence', jsonb_build_object('lat', -4.5635410, 'lng', -44.5994555, 'raio_m', 900),
    'minutos_por_horario', 50,
    'valor_hora_padrao', 0,
    'primary_hsl', '246 76% 28%',
    'horarios', jsonb_build_array(
      jsonb_build_object('id',1,'label','1º Horário','inicio','18:30','fim','19:20','turno','noturno'),
      jsonb_build_object('id',2,'label','2º Horário','inicio','19:20','fim','20:10','turno','noturno'),
      jsonb_build_object('id',3,'label','3º Horário','inicio','20:20','fim','21:10','turno','noturno'),
      jsonb_build_object('id',4,'label','4º Horário','inicio','21:10','fim','22:00','turno','noturno'),
      jsonb_build_object('id',5,'label','1º Horário','inicio','14:00','fim','15:00','turno','vespertino'),
      jsonb_build_object('id',6,'label','2º Horário','inicio','15:00','fim','16:00','turno','vespertino'),
      jsonb_build_object('id',7,'label','3º Horário','inicio','16:00','fim','17:00','turno','vespertino'),
      jsonb_build_object('id',8,'label','4º Horário','inicio','17:00','fim','18:00','turno','vespertino')
    ),
    'cursos', jsonb_build_array(
      jsonb_build_object('id','eng','nome','Engenharia Civil'),
      jsonb_build_object('id','ped','nome','Pedagogia'),
      jsonb_build_object('id','psi','nome','Psicologia')
    )
  )
) ON CONFLICT (id) DO NOTHING;


-- ===== 20260529181901_629138e4-1eaf-4adf-b2d0-8bbb5a01c026.sql =====

-- 1) Table for class joinings
CREATE TABLE public.turma_juncoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  turma_ids uuid[] NOT NULL DEFAULT '{}',
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.turma_juncoes TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.turma_juncoes TO authenticated;
GRANT ALL ON public.turma_juncoes TO service_role;

ALTER TABLE public.turma_juncoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage turma_juncoes" ON public.turma_juncoes
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anon read turma_juncoes" ON public.turma_juncoes
  FOR SELECT TO anon USING (true);

CREATE POLICY "Auth read turma_juncoes" ON public.turma_juncoes
  FOR SELECT TO authenticated USING (true);

CREATE TRIGGER trg_turma_juncoes_updated_at
  BEFORE UPDATE ON public.turma_juncoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2) Update duplicate check trigger to allow joined classes
CREATE OR REPLACE FUNCTION public.check_horario_duplicado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  h INTEGER;
  conflito RECORD;
  v_juncao_turmas uuid[];
BEGIN
  IF NEW.status_aprovacao = 'rejeitado' THEN
    RETURN NEW;
  END IF;

  -- Coleta todas as turmas que estão em alguma junção ativa junto com a turma do NEW
  SELECT COALESCE(array_agg(DISTINCT t), '{}')::uuid[]
    INTO v_juncao_turmas
  FROM public.turma_juncoes j,
       LATERAL unnest(j.turma_ids) AS t
  WHERE j.ativo = true
    AND NEW.turma_id = ANY(j.turma_ids);

  FOREACH h IN ARRAY NEW.horarios LOOP
    SELECT id, turma_id INTO conflito
    FROM public.registros_ponto
    WHERE professor_id = NEW.professor_id
      AND data = NEW.data
      AND h = ANY(horarios)
      AND status_aprovacao <> 'rejeitado'
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      -- Ignora conflitos quando a turma conflitante está na mesma junção
      AND NOT (turma_id = ANY(v_juncao_turmas))
    LIMIT 1;

    IF FOUND THEN
      RAISE EXCEPTION 'Horário % já registrado para este professor nesta data', h
        USING ERRCODE = 'unique_violation';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

-- 3) Exemplo: mover a grade de um professor para o turno vespertino (14h-18h => horários 5,6,7,8)
-- UPDATE public.horarios_aula
--    SET horario_id = horario_id + 4
--  WHERE professor_id = '<uuid-do-professor>'
--    AND horario_id BETWEEN 1 AND 4;

-- 4) Exemplo: criar uma junção de turmas (aula simultânea em múltiplas turmas)
-- INSERT INTO public.turma_juncoes (nome, turma_ids, ativo)
-- VALUES (
--   'Extensão Curricular - DIR 5º/6º/7º',
--   ARRAY['<uuid-turma-1>'::uuid, '<uuid-turma-2>'::uuid, '<uuid-turma-3>'::uuid],
--   true
-- );


-- ===== 20260529183235_528f18fb-ab16-409c-97b9-80cadfcb1f60.sql =====

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


-- ===== 20260616001454_2865fec4-bef2-45d0-b6df-113f01fc8d45.sql =====
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


-- ===== 20260616001510_c6afa385-1870-4b6b-bf4b-0dcb071b2720.sql =====

REVOKE EXECUTE ON FUNCTION public.processar_data_preview(date,text,uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.processar_data_gerar(date,text,text,text,text,uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.lancar_hora_aula_extra(uuid,uuid,uuid,date,integer[],text,date,date,text,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cancelar_ajuste(uuid,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public._minutos_por_horario() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.processar_data_preview(date,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.processar_data_gerar(date,text,text,text,text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.lancar_hora_aula_extra(uuid,uuid,uuid,date,integer[],text,date,date,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancelar_ajuste(uuid,text) TO authenticated;


-- ===== 20260617000323_680f2baf-b2dc-4c44-a884-3273048d830d.sql =====
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

-- ===== 20260617000648_dfe8d975-961d-40c8-934e-6109fb1b24cc.sql =====
DROP POLICY IF EXISTS "Auth read notificacoes" ON public.notificacoes;
DROP POLICY IF EXISTS "Auth read permutas" ON public.permutas;
DROP POLICY IF EXISTS "Auth read professores" ON public.professores;
DROP POLICY IF EXISTS "Auth read registros" ON public.registros_ponto;

CREATE POLICY "Admins read notificacoes"
ON public.notificacoes
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins read permutas"
ON public.permutas
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins read professores"
ON public.professores
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins read registros"
ON public.registros_ponto
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.notificacoes_professor_listar(p_prof_id uuid, p_pin text, p_limite integer DEFAULT 30)
RETURNS TABLE(
  id uuid,
  destino_role text,
  professor_id uuid,
  tipo text,
  titulo text,
  mensagem text,
  link text,
  lida boolean,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public._prof_validate(p_prof_id, p_pin);
  RETURN QUERY
    SELECT n.id, n.destino_role, n.professor_id, n.tipo, n.titulo, n.mensagem, n.link, n.lida, n.created_at
    FROM public.notificacoes n
    WHERE n.professor_id = p_prof_id OR n.destino_role = 'broadcast'
    ORDER BY n.created_at DESC
    LIMIT GREATEST(LEAST(COALESCE(p_limite, 30), 100), 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.notificacao_professor_marcar_lida(p_prof_id uuid, p_pin text, p_notificacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public._prof_validate(p_prof_id, p_pin);
  UPDATE public.notificacoes
  SET lida = true
  WHERE id = p_notificacao_id
    AND (professor_id = p_prof_id OR destino_role = 'broadcast');
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.notificacoes_professor_marcar_todas_lidas(p_prof_id uuid, p_pin text, p_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public._prof_validate(p_prof_id, p_pin);
  UPDATE public.notificacoes
  SET lida = true
  WHERE id = ANY(COALESCE(p_ids, '{}'::uuid[]))
    AND (professor_id = p_prof_id OR destino_role = 'broadcast');
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.notificacao_professor_excluir(p_prof_id uuid, p_pin text, p_notificacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public._prof_validate(p_prof_id, p_pin);
  DELETE FROM public.notificacoes
  WHERE id = p_notificacao_id
    AND professor_id = p_prof_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.notificacoes_professor_excluir_todas(p_prof_id uuid, p_pin text, p_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public._prof_validate(p_prof_id, p_pin);
  DELETE FROM public.notificacoes
  WHERE id = ANY(COALESCE(p_ids, '{}'::uuid[]))
    AND professor_id = p_prof_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.notificacoes_professor_listar(uuid,text,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notificacao_professor_marcar_lida(uuid,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notificacoes_professor_marcar_todas_lidas(uuid,text,uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notificacao_professor_excluir(uuid,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notificacoes_professor_excluir_todas(uuid,text,uuid[]) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.notificacoes_professor_listar(uuid,text,integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notificacao_professor_marcar_lida(uuid,text,uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notificacoes_professor_marcar_todas_lidas(uuid,text,uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notificacao_professor_excluir(uuid,text,uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notificacoes_professor_excluir_todas(uuid,text,uuid[]) TO anon, authenticated;

-- ===== 20260617000723_f5fac5ce-2477-4597-bf84-b631daf45309.sql =====
CREATE OR REPLACE FUNCTION public.push_subscribe_professor(
  p_prof_id uuid,
  p_pin text,
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
BEGIN
  PERFORM public._prof_validate(p_prof_id, p_pin);
  IF p_endpoint IS NULL OR length(trim(p_endpoint)) < 10 THEN
    RAISE EXCEPTION 'endpoint inválido';
  END IF;
  IF p_p256dh IS NULL OR p_auth IS NULL THEN
    RAISE EXCEPTION 'chaves push obrigatórias';
  END IF;

  INSERT INTO public.push_subscriptions(endpoint, p256dh, auth, professor_id, user_id, role, user_agent)
  VALUES (p_endpoint, p_p256dh, p_auth, p_prof_id, NULL, 'professor', p_user_agent)
  ON CONFLICT (endpoint) DO UPDATE SET
    p256dh = EXCLUDED.p256dh,
    auth = EXCLUDED.auth,
    professor_id = EXCLUDED.professor_id,
    user_id = NULL,
    role = 'professor',
    user_agent = EXCLUDED.user_agent
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.push_subscribe_professor(uuid,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.push_subscribe_professor(uuid,text,text,text,text,text) TO anon, authenticated;

-- ===== 20260617001149_89d11812-1761-4d5e-aab5-fe92808ef5a1.sql =====
ALTER PUBLICATION supabase_realtime DROP TABLE public.registros_ponto;
ALTER PUBLICATION supabase_realtime DROP TABLE public.notificacoes;

-- ===== 20260617001257_f91c849f-b73b-45ee-80b6-5aa529c1dda4.sql =====
CREATE OR REPLACE FUNCTION public._minutos_pagamento_hora_aula()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE((
    SELECT GREATEST(COALESCE((data->>'minutos_pagamento_hora_aula')::int, 60), 1)
    FROM public.app_settings
    WHERE id = 'global'
  ), 60)
$$;

REVOKE ALL ON FUNCTION public._minutos_pagamento_hora_aula() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._minutos_pagamento_hora_aula() TO authenticated;

-- ===== 20260621233219_4a83c3e3-c21a-4651-a94b-615990656568.sql =====

-- ============ FUNÇÕES / CARGOS ============
CREATE TABLE public.funcoes_administrativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  tipo text NOT NULL CHECK (tipo IN ('administrativo','apoio')),
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.funcoes_administrativas TO authenticated;
GRANT ALL ON public.funcoes_administrativas TO service_role;
ALTER TABLE public.funcoes_administrativas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage funcoes" ON public.funcoes_administrativas
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_funcoes_adm_upd BEFORE UPDATE ON public.funcoes_administrativas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ ESCALAS ============
CREATE TABLE public.escalas_administrativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  dias_semana int[] NOT NULL DEFAULT '{1,2,3,4,5}',
  entrada_prevista time,
  saida_intervalo_prevista time,
  retorno_intervalo_previsto time,
  saida_prevista time,
  intervalo_minutos int NOT NULL DEFAULT 60,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.escalas_administrativas TO authenticated;
GRANT ALL ON public.escalas_administrativas TO service_role;
ALTER TABLE public.escalas_administrativas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage escalas" ON public.escalas_administrativas
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_escalas_adm_upd BEFORE UPDATE ON public.escalas_administrativas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ FUNCIONÁRIOS ============
CREATE TABLE public.funcionarios_administrativos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_completo text NOT NULL,
  funcao_id uuid REFERENCES public.funcoes_administrativas(id),
  tipo_funcionario text NOT NULL DEFAULT 'administrativo' CHECK (tipo_funcionario IN ('administrativo','apoio')),
  salario_quinzenal numeric(12,2) NOT NULL DEFAULT 0,
  pin text,
  pix text,
  banco text,
  agencia text,
  conta text,
  tipo_conta text,
  escala_id uuid REFERENCES public.escalas_administrativas(id),
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.funcionarios_administrativos TO authenticated;
GRANT ALL ON public.funcionarios_administrativos TO service_role;
ALTER TABLE public.funcionarios_administrativos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage funcionarios" ON public.funcionarios_administrativos
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_funcs_adm_upd BEFORE UPDATE ON public.funcionarios_administrativos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ REGISTROS DE PONTO ============
CREATE TABLE public.registros_ponto_administrativo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios_administrativos(id) ON DELETE CASCADE,
  data date NOT NULL,
  tipo_marcacao text NOT NULL CHECK (tipo_marcacao IN ('entrada_expediente','saida_intervalo','retorno_intervalo','saida_expediente')),
  horario_previsto time,
  horario_real timestamptz NOT NULL DEFAULT now(),
  diferenca_minutos int,
  status text,
  justificativa text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_reg_adm_func_data ON public.registros_ponto_administrativo(funcionario_id, data);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.registros_ponto_administrativo TO authenticated;
GRANT ALL ON public.registros_ponto_administrativo TO service_role;
ALTER TABLE public.registros_ponto_administrativo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage reg adm" ON public.registros_ponto_administrativo
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ FOLHA ============
CREATE TABLE public.folha_administrativo_apoio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios_administrativos(id) ON DELETE CASCADE,
  periodo_inicio date NOT NULL,
  periodo_fim date NOT NULL,
  salario_quinzenal numeric(12,2) NOT NULL DEFAULT 0,
  dias_previstos int NOT NULL DEFAULT 0,
  dias_presentes int NOT NULL DEFAULT 0,
  faltas int NOT NULL DEFAULT 0,
  atrasos int NOT NULL DEFAULT 0,
  saidas_antecipadas int NOT NULL DEFAULT 0,
  horas_extras numeric(8,2) NOT NULL DEFAULT 0,
  adicionais numeric(12,2) NOT NULL DEFAULT 0,
  descontos numeric(12,2) NOT NULL DEFAULT 0,
  valor_final numeric(12,2) NOT NULL DEFAULT 0,
  observacoes text,
  status text NOT NULL DEFAULT 'aberta',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(funcionario_id, periodo_inicio, periodo_fim)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.folha_administrativo_apoio TO authenticated;
GRANT ALL ON public.folha_administrativo_apoio TO service_role;
ALTER TABLE public.folha_administrativo_apoio ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage folha adm" ON public.folha_administrativo_apoio
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_folha_adm_upd BEFORE UPDATE ON public.folha_administrativo_apoio
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ajustes_folha_administrativo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios_administrativos(id) ON DELETE CASCADE,
  folha_id uuid REFERENCES public.folha_administrativo_apoio(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('adicional','desconto','hora_extra')),
  valor numeric(12,2) NOT NULL DEFAULT 0,
  quantidade_horas numeric(8,2),
  motivo text,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ajustes_folha_administrativo TO authenticated;
GRANT ALL ON public.ajustes_folha_administrativo TO service_role;
ALTER TABLE public.ajustes_folha_administrativo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage ajustes folha adm" ON public.ajustes_folha_administrativo
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ SEEDS ============
INSERT INTO public.funcoes_administrativas (nome, tipo, descricao) VALUES
  ('Secretário Acadêmico/Financeiro','administrativo','Atendimento, secretaria acadêmica e financeira'),
  ('Vigia','apoio','Vigilância e segurança patrimonial'),
  ('Serviços Gerais','apoio','Limpeza, manutenção e apoio operacional')
ON CONFLICT (nome) DO NOTHING;

INSERT INTO public.escalas_administrativas (nome, dias_semana, entrada_prevista, saida_intervalo_prevista, retorno_intervalo_previsto, saida_prevista, intervalo_minutos) VALUES
  ('Expediente 08h-12h / 14h-18h', '{1,2,3,4,5}', '08:00','12:00','14:00','18:00', 120),
  ('Expediente 14h-22h (1h intervalo)', '{1,2,3,4,5}', '14:00','18:00','19:00','22:00', 60);

-- ============ FUNÇÕES SEGURAS ============

-- Lista pública (sem PIN/salário) para tela inicial
CREATE OR REPLACE FUNCTION public.list_funcionarios_admin_ativos()
RETURNS TABLE(id uuid, nome_completo text, tipo_funcionario text, funcao_nome text, escala_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT f.id, f.nome_completo, f.tipo_funcionario, fn.nome, f.escala_id
  FROM public.funcionarios_administrativos f
  LEFT JOIN public.funcoes_administrativas fn ON fn.id = f.funcao_id
  WHERE f.ativo = true
  ORDER BY f.nome_completo;
$$;
GRANT EXECUTE ON FUNCTION public.list_funcionarios_admin_ativos() TO anon, authenticated;

-- Valida PIN funcionário
CREATE OR REPLACE FUNCTION public._func_adm_validate(p_id uuid, p_pin text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_ok boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.funcionarios_administrativos
    WHERE id=p_id AND ativo=true AND pin IS NOT NULL AND pin=p_pin) INTO v_ok;
  IF NOT v_ok THEN RAISE EXCEPTION 'Credenciais inválidas' USING ERRCODE='28000'; END IF;
  RETURN true;
END $$;

-- Detalhes da escala (para mostrar ao funcionário sem expor outros dados)
CREATE OR REPLACE FUNCTION public.escala_admin_detalhe(p_escala_id uuid)
RETURNS TABLE(id uuid, nome text, dias_semana int[], entrada_prevista time,
              saida_intervalo_prevista time, retorno_intervalo_previsto time,
              saida_prevista time, intervalo_minutos int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT id, nome, dias_semana, entrada_prevista, saida_intervalo_prevista,
         retorno_intervalo_previsto, saida_prevista, intervalo_minutos
  FROM public.escalas_administrativas WHERE id = p_escala_id AND ativo = true;
$$;
GRANT EXECUTE ON FUNCTION public.escala_admin_detalhe(uuid) TO anon, authenticated;

-- Bater ponto
CREATE OR REPLACE FUNCTION public.bater_ponto_admin(
  p_func_id uuid, p_pin text, p_tipo text,
  p_justificativa text DEFAULT NULL,
  p_lat double precision DEFAULT NULL,
  p_lng double precision DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_escala RECORD; v_previsto time; v_real timestamptz := now();
  v_diff int; v_status text; v_id uuid; v_dup boolean;
  v_hora_real time;
BEGIN
  PERFORM public._func_adm_validate(p_func_id, p_pin);
  IF p_tipo NOT IN ('entrada_expediente','saida_intervalo','retorno_intervalo','saida_expediente') THEN
    RAISE EXCEPTION 'tipo de marcação inválido';
  END IF;

  SELECT e.* INTO v_escala
  FROM public.escalas_administrativas e
  JOIN public.funcionarios_administrativos f ON f.escala_id = e.id
  WHERE f.id = p_func_id;

  v_previsto := CASE p_tipo
    WHEN 'entrada_expediente' THEN v_escala.entrada_prevista
    WHEN 'saida_intervalo'    THEN v_escala.saida_intervalo_prevista
    WHEN 'retorno_intervalo'  THEN v_escala.retorno_intervalo_previsto
    WHEN 'saida_expediente'   THEN v_escala.saida_prevista
  END;

  v_hora_real := (v_real AT TIME ZONE 'America/Fortaleza')::time;

  IF v_previsto IS NOT NULL THEN
    v_diff := EXTRACT(EPOCH FROM (v_hora_real - v_previsto))/60;
  ELSE
    v_diff := 0;
  END IF;

  v_status := CASE
    WHEN v_previsto IS NULL THEN 'extra'
    WHEN abs(v_diff) <= 5 THEN 'no_horario'
    WHEN abs(v_diff) < 30 THEN 'tolerancia'
    WHEN v_diff >= 30 AND p_tipo IN ('entrada_expediente','retorno_intervalo') THEN 'atraso'
    WHEN v_diff <= -30 AND p_tipo IN ('saida_expediente','saida_intervalo') THEN 'saida_antecipada'
    WHEN v_diff > 0 AND p_tipo IN ('saida_expediente','saida_intervalo') THEN 'extra'
    ELSE 'tolerancia'
  END;

  IF v_status IN ('atraso','saida_antecipada') AND (p_justificativa IS NULL OR length(trim(p_justificativa)) < 3) THEN
    RAISE EXCEPTION 'JUSTIFICATIVA_OBRIGATORIA';
  END IF;

  -- Evita duplicidade absurda: mesmo tipo nos últimos 5 minutos
  SELECT EXISTS(
    SELECT 1 FROM public.registros_ponto_administrativo
    WHERE funcionario_id = p_func_id AND tipo_marcacao = p_tipo
      AND horario_real > now() - interval '5 minutes'
  ) INTO v_dup;
  IF v_dup THEN RAISE EXCEPTION 'Marcação duplicada recente'; END IF;

  INSERT INTO public.registros_ponto_administrativo(
    funcionario_id, data, tipo_marcacao, horario_previsto, horario_real,
    diferenca_minutos, status, justificativa, latitude, longitude
  ) VALUES (
    p_func_id, (v_real AT TIME ZONE 'America/Fortaleza')::date,
    p_tipo, v_previsto, v_real, v_diff, v_status, p_justificativa, p_lat, p_lng
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok',true,'id',v_id,'status',v_status,'diferenca_minutos',v_diff);
END $$;
GRANT EXECUTE ON FUNCTION public.bater_ponto_admin(uuid,text,text,text,double precision,double precision) TO anon, authenticated;

-- Histórico próprio
CREATE OR REPLACE FUNCTION public.historico_ponto_admin(p_func_id uuid, p_pin text, p_limite int DEFAULT 10)
RETURNS TABLE(id uuid, data date, tipo_marcacao text, horario_previsto time,
              horario_real timestamptz, diferenca_minutos int, status text, justificativa text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public._func_adm_validate(p_func_id, p_pin);
  RETURN QUERY
  SELECT r.id, r.data, r.tipo_marcacao, r.horario_previsto, r.horario_real,
         r.diferenca_minutos, r.status, r.justificativa
  FROM public.registros_ponto_administrativo r
  WHERE r.funcionario_id = p_func_id
  ORDER BY r.horario_real DESC
  LIMIT GREATEST(LEAST(p_limite,50),1);
END $$;
GRANT EXECUTE ON FUNCTION public.historico_ponto_admin(uuid,text,int) TO anon, authenticated;

-- Gera/recalcula folha
CREATE OR REPLACE FUNCTION public.gerar_folha_admin(
  p_periodo_inicio date, p_periodo_fim date, p_funcionario_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  f RECORD; d date; dow int; v_dias_prev int; v_dias_pres int;
  v_faltas int; v_atrasos int; v_saidas int; v_extras numeric;
  v_adic numeric; v_desc numeric; v_final numeric;
  v_count int := 0; v_escala RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'sem permissão'; END IF;
  IF p_periodo_fim < p_periodo_inicio THEN RAISE EXCEPTION 'período inválido'; END IF;

  FOR f IN SELECT * FROM public.funcionarios_administrativos
           WHERE ativo = true AND (p_funcionario_id IS NULL OR id = p_funcionario_id)
  LOOP
    SELECT * INTO v_escala FROM public.escalas_administrativas WHERE id = f.escala_id;
    v_dias_prev := 0;
    d := p_periodo_inicio;
    WHILE d <= p_periodo_fim LOOP
      dow := EXTRACT(DOW FROM d);
      IF v_escala.dias_semana IS NULL THEN
        IF dow BETWEEN 1 AND 5 THEN v_dias_prev := v_dias_prev + 1; END IF;
      ELSIF dow = ANY(v_escala.dias_semana) THEN
        v_dias_prev := v_dias_prev + 1;
      END IF;
      d := d + 1;
    END LOOP;

    SELECT COUNT(DISTINCT data) INTO v_dias_pres
    FROM public.registros_ponto_administrativo
    WHERE funcionario_id = f.id AND data BETWEEN p_periodo_inicio AND p_periodo_fim
      AND tipo_marcacao = 'entrada_expediente';

    v_faltas := GREATEST(v_dias_prev - v_dias_pres, 0);

    SELECT COUNT(*) INTO v_atrasos FROM public.registros_ponto_administrativo
    WHERE funcionario_id = f.id AND data BETWEEN p_periodo_inicio AND p_periodo_fim
      AND status = 'atraso';

    SELECT COUNT(*) INTO v_saidas FROM public.registros_ponto_administrativo
    WHERE funcionario_id = f.id AND data BETWEEN p_periodo_inicio AND p_periodo_fim
      AND status = 'saida_antecipada';

    SELECT COALESCE(SUM(quantidade_horas),0) INTO v_extras
    FROM public.ajustes_folha_administrativo
    WHERE funcionario_id = f.id AND tipo='hora_extra'
      AND created_at::date BETWEEN p_periodo_inicio AND p_periodo_fim;

    SELECT COALESCE(SUM(valor),0) INTO v_adic
    FROM public.ajustes_folha_administrativo
    WHERE funcionario_id = f.id AND tipo IN ('adicional','hora_extra')
      AND created_at::date BETWEEN p_periodo_inicio AND p_periodo_fim;

    SELECT COALESCE(SUM(valor),0) INTO v_desc
    FROM public.ajustes_folha_administrativo
    WHERE funcionario_id = f.id AND tipo='desconto'
      AND created_at::date BETWEEN p_periodo_inicio AND p_periodo_fim;

    v_final := f.salario_quinzenal + v_adic - v_desc;

    INSERT INTO public.folha_administrativo_apoio(
      funcionario_id, periodo_inicio, periodo_fim, salario_quinzenal,
      dias_previstos, dias_presentes, faltas, atrasos, saidas_antecipadas,
      horas_extras, adicionais, descontos, valor_final
    ) VALUES (
      f.id, p_periodo_inicio, p_periodo_fim, f.salario_quinzenal,
      v_dias_prev, v_dias_pres, v_faltas, v_atrasos, v_saidas,
      v_extras, v_adic, v_desc, v_final
    )
    ON CONFLICT (funcionario_id, periodo_inicio, periodo_fim) DO UPDATE SET
      salario_quinzenal = EXCLUDED.salario_quinzenal,
      dias_previstos = EXCLUDED.dias_previstos,
      dias_presentes = EXCLUDED.dias_presentes,
      faltas = EXCLUDED.faltas,
      atrasos = EXCLUDED.atrasos,
      saidas_antecipadas = EXCLUDED.saidas_antecipadas,
      horas_extras = EXCLUDED.horas_extras,
      adicionais = EXCLUDED.adicionais,
      descontos = EXCLUDED.descontos,
      valor_final = EXCLUDED.valor_final,
      updated_at = now();

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('ok',true,'processados',v_count);
END $$;


-- ===== 20260621235919_45e25dbf-5e14-4cff-b033-54165fe5c01d.sql =====

-- Paridade do Ponto Administrativo: geofence, retroativo, aprovação

ALTER TABLE public.registros_ponto_administrativo
  ADD COLUMN IF NOT EXISTS status_aprovacao text NOT NULL DEFAULT 'aprovado',
  ADD COLUMN IF NOT EXISTS retroativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS motivo_rejeicao text,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS aprovado_por uuid,
  ADD COLUMN IF NOT EXISTS justificativa_retroativa text;

-- Função utilitária de distância (Haversine)
CREATE OR REPLACE FUNCTION public._haversine_m(lat1 double precision, lon1 double precision, lat2 double precision, lon2 double precision)
RETURNS double precision LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE r constant double precision := 6371000;
        dlat double precision; dlon double precision; a double precision;
BEGIN
  dlat := radians(lat2 - lat1); dlon := radians(lon2 - lon1);
  a := sin(dlat/2)^2 + cos(radians(lat1))*cos(radians(lat2))*sin(dlon/2)^2;
  RETURN r * 2 * atan2(sqrt(a), sqrt(1-a));
END $$;

-- Substitui bater_ponto_admin para validar geofence (igual ao do professor)
CREATE OR REPLACE FUNCTION public.bater_ponto_admin(
  p_func_id uuid, p_pin text, p_tipo text,
  p_justificativa text DEFAULT NULL,
  p_lat double precision DEFAULT NULL, p_lng double precision DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_escala RECORD; v_previsto time; v_real timestamptz := now();
  v_diff int; v_status text; v_id uuid; v_dup boolean;
  v_hora_real time; v_cfg jsonb; v_lat double precision; v_lng double precision; v_raio int;
  v_dist double precision;
BEGIN
  PERFORM public._func_adm_validate(p_func_id, p_pin);
  IF p_tipo NOT IN ('entrada_expediente','saida_intervalo','retorno_intervalo','saida_expediente') THEN
    RAISE EXCEPTION 'tipo de marcação inválido';
  END IF;

  -- Geofence
  SELECT data INTO v_cfg FROM public.app_settings WHERE id='global';
  v_lat := COALESCE((v_cfg->'geofence'->>'lat')::double precision, -4.5635410);
  v_lng := COALESCE((v_cfg->'geofence'->>'lng')::double precision, -44.5994555);
  v_raio := COALESCE((v_cfg->'geofence'->>'raio_m')::int, 900);
  IF p_lat IS NULL OR p_lng IS NULL THEN
    RAISE EXCEPTION 'GPS_OBRIGATORIO';
  END IF;
  v_dist := public._haversine_m(p_lat, p_lng, v_lat, v_lng);
  IF v_dist > v_raio THEN
    RAISE EXCEPTION 'FORA_DA_AREA: % m (máx %)', round(v_dist)::int, v_raio;
  END IF;

  SELECT e.* INTO v_escala
  FROM public.escalas_administrativas e
  JOIN public.funcionarios_administrativos f ON f.escala_id = e.id
  WHERE f.id = p_func_id;

  v_previsto := CASE p_tipo
    WHEN 'entrada_expediente' THEN v_escala.entrada_prevista
    WHEN 'saida_intervalo'    THEN v_escala.saida_intervalo_prevista
    WHEN 'retorno_intervalo'  THEN v_escala.retorno_intervalo_previsto
    WHEN 'saida_expediente'   THEN v_escala.saida_prevista
  END;

  v_hora_real := (v_real AT TIME ZONE 'America/Fortaleza')::time;

  IF v_previsto IS NOT NULL THEN
    v_diff := EXTRACT(EPOCH FROM (v_hora_real - v_previsto))/60;
  ELSE v_diff := 0; END IF;

  v_status := CASE
    WHEN v_previsto IS NULL THEN 'extra'
    WHEN abs(v_diff) <= 5 THEN 'no_horario'
    WHEN abs(v_diff) < 30 THEN 'tolerancia'
    WHEN v_diff >= 30 AND p_tipo IN ('entrada_expediente','retorno_intervalo') THEN 'atraso'
    WHEN v_diff <= -30 AND p_tipo IN ('saida_expediente','saida_intervalo') THEN 'saida_antecipada'
    WHEN v_diff > 0 AND p_tipo IN ('saida_expediente','saida_intervalo') THEN 'extra'
    ELSE 'tolerancia'
  END;

  IF v_status IN ('atraso','saida_antecipada') AND (p_justificativa IS NULL OR length(trim(p_justificativa)) < 3) THEN
    RAISE EXCEPTION 'JUSTIFICATIVA_OBRIGATORIA';
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.registros_ponto_administrativo
    WHERE funcionario_id = p_func_id AND tipo_marcacao = p_tipo
      AND horario_real > now() - interval '5 minutes'
  ) INTO v_dup;
  IF v_dup THEN RAISE EXCEPTION 'Marcação duplicada recente'; END IF;

  INSERT INTO public.registros_ponto_administrativo(
    funcionario_id, data, tipo_marcacao, horario_previsto, horario_real,
    diferenca_minutos, status, justificativa, latitude, longitude,
    status_aprovacao, retroativo
  ) VALUES (
    p_func_id, (v_real AT TIME ZONE 'America/Fortaleza')::date,
    p_tipo, v_previsto, v_real, v_diff, v_status, p_justificativa, p_lat, p_lng,
    'aprovado', false
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok',true,'id',v_id,'status',v_status,'diferenca_minutos',v_diff);
END $$;

-- Bater ponto retroativo administrativo (vai para aprovação)
CREATE OR REPLACE FUNCTION public.bater_ponto_admin_retroativo(
  p_func_id uuid, p_pin text, p_data date, p_tipo text,
  p_hora time, p_justificativa text,
  p_lat double precision DEFAULT NULL, p_lng double precision DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_escala RECORD; v_previsto time; v_id uuid; v_diff int; v_status text;
  v_real timestamptz;
BEGIN
  PERFORM public._func_adm_validate(p_func_id, p_pin);
  IF p_tipo NOT IN ('entrada_expediente','saida_intervalo','retorno_intervalo','saida_expediente') THEN
    RAISE EXCEPTION 'tipo inválido';
  END IF;
  IF p_data >= (now() AT TIME ZONE 'America/Fortaleza')::date THEN
    RAISE EXCEPTION 'use ponto normal para hoje';
  END IF;
  IF p_justificativa IS NULL OR length(trim(p_justificativa)) < 5 THEN
    RAISE EXCEPTION 'JUSTIFICATIVA_OBRIGATORIA';
  END IF;

  SELECT e.* INTO v_escala
  FROM public.escalas_administrativas e
  JOIN public.funcionarios_administrativos f ON f.escala_id = e.id
  WHERE f.id = p_func_id;

  v_previsto := CASE p_tipo
    WHEN 'entrada_expediente' THEN v_escala.entrada_prevista
    WHEN 'saida_intervalo'    THEN v_escala.saida_intervalo_prevista
    WHEN 'retorno_intervalo'  THEN v_escala.retorno_intervalo_previsto
    WHEN 'saida_expediente'   THEN v_escala.saida_prevista
  END;

  v_real := (p_data + p_hora) AT TIME ZONE 'America/Fortaleza';
  v_diff := CASE WHEN v_previsto IS NULL THEN 0 ELSE EXTRACT(EPOCH FROM (p_hora - v_previsto))/60 END;
  v_status := 'pendente';

  INSERT INTO public.registros_ponto_administrativo(
    funcionario_id, data, tipo_marcacao, horario_previsto, horario_real,
    diferenca_minutos, status, justificativa, latitude, longitude,
    status_aprovacao, retroativo, justificativa_retroativa
  ) VALUES (
    p_func_id, p_data, p_tipo, v_previsto, v_real, v_diff,
    v_status, p_justificativa, p_lat, p_lng,
    'pendente', true, p_justificativa
  ) RETURNING id INTO v_id;

  INSERT INTO public.notificacoes(destino_role, tipo, titulo, mensagem, link)
  VALUES ('admin','retroativo_admin_pendente',
          'Ponto retroativo administrativo',
          'Há um ponto retroativo aguardando aprovação.',
          '/admin/registros');

  RETURN jsonb_build_object('ok',true,'id',v_id);
END $$;

-- Aprovar/rejeitar registro administrativo
CREATE OR REPLACE FUNCTION public.aprovar_ponto_admin(
  p_id uuid, p_acao text, p_motivo text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF NOT public.has_role(v_user,'admin') THEN RAISE EXCEPTION 'sem permissão'; END IF;
  IF p_acao NOT IN ('aprovar','rejeitar') THEN RAISE EXCEPTION 'ação inválida'; END IF;
  IF p_acao = 'rejeitar' AND (p_motivo IS NULL OR length(trim(p_motivo)) < 3) THEN
    RAISE EXCEPTION 'motivo obrigatório';
  END IF;

  UPDATE public.registros_ponto_administrativo SET
    status_aprovacao = CASE p_acao WHEN 'aprovar' THEN 'aprovado' ELSE 'rejeitado' END,
    aprovado_em = now(), aprovado_por = v_user,
    motivo_rejeicao = CASE WHEN p_acao='rejeitar' THEN p_motivo ELSE NULL END
  WHERE id = p_id;

  RETURN jsonb_build_object('ok', true);
END $$;

-- Lista completa de registros administrativos para admin (com nomes)
CREATE OR REPLACE FUNCTION public.listar_registros_admin_full(
  p_inicio date DEFAULT NULL, p_fim date DEFAULT NULL
) RETURNS TABLE(
  id uuid, funcionario_id uuid, funcionario_nome text, funcao_nome text,
  data date, tipo_marcacao text, horario_previsto time, horario_real timestamptz,
  diferenca_minutos int, status text, justificativa text,
  latitude double precision, longitude double precision,
  status_aprovacao text, retroativo boolean, motivo_rejeicao text, created_at timestamptz
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'sem permissão'; END IF;
  RETURN QUERY
    SELECT r.id, r.funcionario_id, f.nome_completo, fn.nome,
           r.data, r.tipo_marcacao, r.horario_previsto, r.horario_real,
           r.diferenca_minutos, r.status, r.justificativa,
           r.latitude, r.longitude,
           r.status_aprovacao, r.retroativo, r.motivo_rejeicao, r.created_at
    FROM public.registros_ponto_administrativo r
    JOIN public.funcionarios_administrativos f ON f.id = r.funcionario_id
    LEFT JOIN public.funcoes_administrativas fn ON fn.id = f.funcao_id
    WHERE (p_inicio IS NULL OR r.data >= p_inicio)
      AND (p_fim IS NULL OR r.data <= p_fim)
    ORDER BY r.horario_real DESC;
END $$;

GRANT EXECUTE ON FUNCTION public.bater_ponto_admin_retroativo TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aprovar_ponto_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_registros_admin_full TO authenticated;


-- ===== 20260622000738_2f42d5d2-5dcd-4bbe-bd63-b69169fbc4cb.sql =====
DROP POLICY IF EXISTS "Anyone can upload justificativas" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view justificativas" ON storage.objects;

CREATE POLICY "Admins manage justificativas"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'justificativas' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'justificativas' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Restricted uploads to justificativas"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'justificativas'
  AND name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[A-Za-z0-9._-]+\.[A-Za-z0-9]{2,5}$'
  AND COALESCE((metadata->>'size')::bigint, 0) <= 10485760
  AND COALESCE(metadata->>'mimetype','') IN (
    'application/pdf','image/png','image/jpeg','image/jpg','image/webp','image/heic'
  )
);

-- ===== 20260623202519_f5380dc1-50c4-4007-b785-0593cc9f03e2.sql =====
ALTER TABLE public.professores
  ADD COLUMN IF NOT EXISTS agencia_bb TEXT,
  ADD COLUMN IF NOT EXISTS conta_bb TEXT;

-- ===== 20260624000000_security_hardening.sql =====
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


-- ===== 20260626000000_provas.sql =====
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


-- ===== 20261003040000_corrige_periodo_ajustes_folha_admin.sql =====
-- ============================================================
-- Corrige bug real: um ajuste administrativo (adicional/desconto/hora
-- extra) lançado hoje para um período JÁ FECHADO não tinha nenhum efeito
-- na folha daquele período — gerar_folha_admin somava os ajustes pela
-- data em que foram DIGITADOS (created_at), não pelo período a que se
-- referem. A tabela já tinha uma coluna folha_id para isso, mas nada no
-- app a preenchia.
--
-- Em vez do FK para folha_administrativo_apoio (que exigiria a folha já
-- existir antes do ajuste, uma ordem de operações frágil), usa-se duas
-- colunas de data simples — o mesmo formato de período usado em toda
-- parte do sistema (ex.: gerar_folha_admin(p_periodo_inicio, p_periodo_fim)).
-- ============================================================

ALTER TABLE public.ajustes_folha_administrativo
  ADD COLUMN IF NOT EXISTS periodo_inicio date,
  ADD COLUMN IF NOT EXISTS periodo_fim date;

-- Backfill: ajustes já lançados presumem o período da quinzena em que
-- foram digitados — o mesmo comportamento (implícito) que o sistema já
-- tinha antes desta correção, preservado para não alterar o resultado de
-- folhas já geradas no passado.
UPDATE public.ajustes_folha_administrativo
SET
  periodo_inicio = CASE WHEN EXTRACT(DAY FROM created_at) <= 15
    THEN date_trunc('month', created_at)::date
    ELSE (date_trunc('month', created_at) + interval '15 days')::date END,
  periodo_fim = CASE WHEN EXTRACT(DAY FROM created_at) <= 15
    THEN (date_trunc('month', created_at) + interval '14 days')::date
    ELSE (date_trunc('month', created_at) + interval '1 month' - interval '1 day')::date END
WHERE periodo_inicio IS NULL;

ALTER TABLE public.ajustes_folha_administrativo
  ALTER COLUMN periodo_inicio SET NOT NULL,
  ALTER COLUMN periodo_fim SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ajustes_folha_admin_periodo
  ON public.ajustes_folha_administrativo (funcionario_id, periodo_inicio, periodo_fim);

-- Recria gerar_folha_admin filtrando os ajustes pelo período A QUE SE
-- REFEREM (periodo_inicio/periodo_fim), não pela data em que foram
-- digitados — corpo idêntico ao original (migration 20260621233219), só
-- trocando essas 3 condições.
CREATE OR REPLACE FUNCTION public.gerar_folha_admin(
  p_periodo_inicio date, p_periodo_fim date, p_funcionario_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  f RECORD; d date; dow int; v_dias_prev int; v_dias_pres int;
  v_faltas int; v_atrasos int; v_saidas int; v_extras numeric;
  v_adic numeric; v_desc numeric; v_final numeric;
  v_count int := 0; v_escala RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'sem permissão'; END IF;
  IF p_periodo_fim < p_periodo_inicio THEN RAISE EXCEPTION 'período inválido'; END IF;

  FOR f IN SELECT * FROM public.funcionarios_administrativos
           WHERE ativo = true AND (p_funcionario_id IS NULL OR id = p_funcionario_id)
  LOOP
    SELECT * INTO v_escala FROM public.escalas_administrativas WHERE id = f.escala_id;
    v_dias_prev := 0;
    d := p_periodo_inicio;
    WHILE d <= p_periodo_fim LOOP
      dow := EXTRACT(DOW FROM d);
      IF v_escala.dias_semana IS NULL THEN
        IF dow BETWEEN 1 AND 5 THEN v_dias_prev := v_dias_prev + 1; END IF;
      ELSIF dow = ANY(v_escala.dias_semana) THEN
        v_dias_prev := v_dias_prev + 1;
      END IF;
      d := d + 1;
    END LOOP;

    SELECT COUNT(DISTINCT data) INTO v_dias_pres
    FROM public.registros_ponto_administrativo
    WHERE funcionario_id = f.id AND data BETWEEN p_periodo_inicio AND p_periodo_fim
      AND tipo_marcacao = 'entrada_expediente';

    v_faltas := GREATEST(v_dias_prev - v_dias_pres, 0);

    SELECT COUNT(*) INTO v_atrasos FROM public.registros_ponto_administrativo
    WHERE funcionario_id = f.id AND data BETWEEN p_periodo_inicio AND p_periodo_fim
      AND status = 'atraso';

    SELECT COUNT(*) INTO v_saidas FROM public.registros_ponto_administrativo
    WHERE funcionario_id = f.id AND data BETWEEN p_periodo_inicio AND p_periodo_fim
      AND status = 'saida_antecipada';

    SELECT COALESCE(SUM(quantidade_horas),0) INTO v_extras
    FROM public.ajustes_folha_administrativo
    WHERE funcionario_id = f.id AND tipo='hora_extra'
      AND periodo_inicio = p_periodo_inicio AND periodo_fim = p_periodo_fim;

    SELECT COALESCE(SUM(valor),0) INTO v_adic
    FROM public.ajustes_folha_administrativo
    WHERE funcionario_id = f.id AND tipo IN ('adicional','hora_extra')
      AND periodo_inicio = p_periodo_inicio AND periodo_fim = p_periodo_fim;

    SELECT COALESCE(SUM(valor),0) INTO v_desc
    FROM public.ajustes_folha_administrativo
    WHERE funcionario_id = f.id AND tipo='desconto'
      AND periodo_inicio = p_periodo_inicio AND periodo_fim = p_periodo_fim;
    -- (correção: antes filtrava por created_at::date BETWEEN ...)

    v_final := f.salario_quinzenal + v_adic - v_desc;

    INSERT INTO public.folha_administrativo_apoio(
      funcionario_id, periodo_inicio, periodo_fim, salario_quinzenal,
      dias_previstos, dias_presentes, faltas, atrasos, saidas_antecipadas,
      horas_extras, adicionais, descontos, valor_final
    ) VALUES (
      f.id, p_periodo_inicio, p_periodo_fim, f.salario_quinzenal,
      v_dias_prev, v_dias_pres, v_faltas, v_atrasos, v_saidas,
      v_extras, v_adic, v_desc, v_final
    )
    ON CONFLICT (funcionario_id, periodo_inicio, periodo_fim) DO UPDATE SET
      salario_quinzenal = EXCLUDED.salario_quinzenal,
      dias_previstos = EXCLUDED.dias_previstos,
      dias_presentes = EXCLUDED.dias_presentes,
      faltas = EXCLUDED.faltas,
      atrasos = EXCLUDED.atrasos,
      saidas_antecipadas = EXCLUDED.saidas_antecipadas,
      horas_extras = EXCLUDED.horas_extras,
      adicionais = EXCLUDED.adicionais,
      descontos = EXCLUDED.descontos,
      valor_final = EXCLUDED.valor_final,
      updated_at = now();

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('ok',true,'processados',v_count);
END $$;


-- ===== 20261003173633_cpf_administrativo_e_materias_fixo.sql =====
-- CPF para o cadastro de administrativo/apoio, para aparecer na folha de
-- pagamento do mesmo jeito que já aparece para professores/coordenadores.
ALTER TABLE public.funcionarios_administrativos ADD COLUMN IF NOT EXISTS cpf text;

-- Registra em migration as colunas de pagamento fixo por disciplina que já
-- existiam no banco (aplicadas fora do histórico de migrations) e que agora
-- ganham UI em Matérias: pagamento_tipo ('hora_aula' | 'fixo_semestral'),
-- valor_fixo_semestral e a janela pagamento_inicio/pagamento_fim em que o
-- valor fixo é dividido igualmente pelas quinzenas do período.
ALTER TABLE public.materias ADD COLUMN IF NOT EXISTS pagamento_tipo text NOT NULL DEFAULT 'hora_aula';
ALTER TABLE public.materias ADD COLUMN IF NOT EXISTS valor_fixo_semestral numeric NOT NULL DEFAULT 0;
ALTER TABLE public.materias ADD COLUMN IF NOT EXISTS pagamento_inicio date;
ALTER TABLE public.materias ADD COLUMN IF NOT EXISTS pagamento_fim date;


-- ===== 20261105120000_app_role_academico.sql =====
-- F6/F7 — Migration A: novos papéis.
-- Fica sozinha porque ADD VALUE não pode ser usado na mesma transação em que o valor é referenciado.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'aluno';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'secretaria';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'coordenador';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'diretor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'setor';


-- ===== 20261105120100_alunos_setores_identidade.sql =====
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


-- ===== 20261105120200_protocolos.sql =====
-- F6/F7 — Migration C: protocolos acadêmicos (F7).
-- Aditiva e idempotente. Depende das Migrations A e B.
-- Escrita somente pelas RPCs SECURITY DEFINER abaixo; nenhuma policy de INSERT/UPDATE para authenticated.
-- As funções referenciam public.documentos/documento_criar (Migration D); o plpgsql resolve na execução.

-- ── Tabelas ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.protocolo_tipos (
  id text PRIMARY KEY,
  nome text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  instrucoes_aluno text NOT NULL DEFAULT '',
  campos jsonb NOT NULL DEFAULT '[]',
  anexos jsonb NOT NULL DEFAULT '[]',
  etapas jsonb NOT NULL DEFAULT '[]',
  prazo_regimental jsonb,
  prazo_resposta_dias_uteis int NOT NULL DEFAULT 5,
  gera_documento text,
  ativo boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.protocolos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  tipo_id text NOT NULL REFERENCES public.protocolo_tipos(id),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id),
  curso_id text NOT NULL,
  turma_id uuid REFERENCES public.turmas(id) ON DELETE SET NULL,
  dados jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'aberto'
    CHECK (status IN ('aberto','em_analise','aguardando_aluno','deferido','indeferido','concluido','cancelado')),
  etapa_atual int NOT NULL DEFAULT 1,
  setor_atual text REFERENCES public.setores(id),
  fora_do_prazo boolean NOT NULL DEFAULT false,
  prazo_resposta_em date,
  aberto_em timestamptz NOT NULL DEFAULT now(),
  concluido_em timestamptz,
  decisao text CHECK (decisao IN ('deferido','indeferido')),
  parecer_final text,
  cancelado_em timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_protocolos_aluno ON public.protocolos(aluno_id);
CREATE INDEX IF NOT EXISTS idx_protocolos_setor ON public.protocolos(setor_atual, status);

CREATE TABLE IF NOT EXISTS public.protocolo_tramites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo_id uuid NOT NULL REFERENCES public.protocolos(id) ON DELETE CASCADE,
  etapa int NOT NULL,
  setor_id text,
  acao text NOT NULL,
  parecer text,
  dados jsonb NOT NULL DEFAULT '{}',
  visivel_aluno boolean NOT NULL DEFAULT true,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tramites_protocolo ON public.protocolo_tramites(protocolo_id, created_at);

CREATE TABLE IF NOT EXISTS public.protocolo_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo_id uuid NOT NULL REFERENCES public.protocolos(id) ON DELETE CASCADE,
  tramite_id uuid REFERENCES public.protocolo_tramites(id) ON DELETE SET NULL,
  tipo_anexo text NOT NULL,
  nome_arquivo text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  mime text,
  tamanho bigint,
  sha256 text,
  enviado_por uuid,
  sensivel boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_anexos_protocolo ON public.protocolo_anexos(protocolo_id);

CREATE TABLE IF NOT EXISTS public.aluno_tcc (
  aluno_id uuid PRIMARY KEY REFERENCES public.alunos(id) ON DELETE CASCADE,
  titulo text,
  orientador_id uuid REFERENCES public.professores(id) ON DELETE SET NULL,
  situacao text NOT NULL DEFAULT 'projeto_aceito' CHECK (situacao IN ('projeto_aceito','concluido')),
  nota_final numeric(5,2),
  protocolo_projeto_id uuid REFERENCES public.protocolos(id),
  protocolo_final_id uuid REFERENCES public.protocolos(id),
  homologado_em timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ac_categorias (
  id text PRIMARY KEY,
  nome text NOT NULL,
  limite_horas numeric(6,1) NOT NULL CHECK (limite_horas >= 0),
  ativo boolean NOT NULL DEFAULT true
);
-- Valores iniciais: a secretaria ajusta os limites conforme o regulamento de cada curso.
INSERT INTO public.ac_categorias (id, nome, limite_horas) VALUES
  ('ensino','Ensino (monitoria, cursos, disciplinas extras)', 60),
  ('pesquisa','Pesquisa (iniciação científica, publicações)', 60),
  ('extensao','Extensão (projetos, ações comunitárias)', 60),
  ('eventos','Eventos científicos (congressos, seminários, palestras)', 40),
  ('cultural','Atividades culturais e sociais', 30),
  ('outras','Outras atividades', 20)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.aluno_horas_complementares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  protocolo_id uuid REFERENCES public.protocolos(id),
  categoria_id text NOT NULL REFERENCES public.ac_categorias(id),
  descricao text NOT NULL,
  emissor text,
  data_atividade date,
  horas_declaradas numeric(6,1) NOT NULL,
  horas_deferidas numeric(6,1) NOT NULL CHECK (horas_deferidas >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_horas_ac_aluno ON public.aluno_horas_complementares(aluno_id, categoria_id);

-- ── Seed dos 6 tipos (seção 2 da especificação) ─────────────────────────────
INSERT INTO public.protocolo_tipos (id, nome, descricao, instrucoes_aluno, campos, anexos, etapas, prazo_regimental, prazo_resposta_dias_uteis, gera_documento, ordem) VALUES
('segunda_chamada', 'Segunda chamada de avaliação',
 'Pedido de nova data para avaliação perdida por impedimento justificado.',
 'Abra o pedido em até 3 dias úteis após a data da prova e anexe o comprovante do impedimento (atestado, declaração de trabalho, certidão).',
 '[{"id":"materia_id","rotulo":"Disciplina","tipo":"materia","obrigatorio":true},
   {"id":"professor_id","rotulo":"Professor","tipo":"professor","obrigatorio":false,"ajuda":"Preenchido pela grade da turma."},
   {"id":"data_avaliacao","rotulo":"Data da avaliação perdida","tipo":"date","obrigatorio":true},
   {"id":"avaliacao","rotulo":"Avaliação","tipo":"select","obrigatorio":true,"opcoes":["AV1","AV2","Final"]},
   {"id":"motivo","rotulo":"Motivo","tipo":"textarea","obrigatorio":true}]',
 '[{"id":"comprovante","rotulo":"Comprovante do impedimento","obrigatorio":true,"mimes":["application/pdf","image/jpeg","image/png"],"max_mb":10,"multiplo":true,"sensivel":true}]',
 '[{"ordem":1,"setor":"coordenacao","nome":"Análise da coordenação","acoes":["deferir","indeferir","solicitar_complementacao"],"ao_deferir":"proxima","ao_indeferir":"encerrar"},
   {"ordem":2,"setor":"secretaria","nome":"Agendamento pela secretaria","acoes":["concluir","solicitar_complementacao"],
    "campos_acao":[{"id":"taxa_valor","rotulo":"Taxa (R$)","tipo":"number","obrigatorio":false,"acao":"concluir"},
                   {"id":"boleto_link","rotulo":"Link do boleto","tipo":"text","obrigatorio":false,"acao":"concluir"},
                   {"id":"data_prova","rotulo":"Data da 2ª chamada","tipo":"date","obrigatorio":true,"acao":"concluir"},
                   {"id":"horario","rotulo":"Horário","tipo":"text","obrigatorio":true,"acao":"concluir"},
                   {"id":"local","rotulo":"Local","tipo":"text","obrigatorio":true,"acao":"concluir"}],
    "ao_concluir":"encerrar","notificar":["aluno","professor_disciplina"]}]',
 '{"campo":"data_avaliacao","dias_uteis":3}', 5, 'deferimento_segunda_chamada', 1),

('tcc_projeto', 'Depósito de projeto de TCC',
 'Entrega do projeto de TCC com o aceite do orientador.',
 'Anexe o projeto (PDF, DOC ou DOCX) e o termo de aceite assinado pelo orientador (PDF).',
 '[{"id":"titulo","rotulo":"Título do projeto","tipo":"text","obrigatorio":true},
   {"id":"orientador_id","rotulo":"Orientador","tipo":"professor","obrigatorio":true},
   {"id":"coorientador","rotulo":"Coorientador (opcional)","tipo":"text","obrigatorio":false},
   {"id":"linha_pesquisa","rotulo":"Linha de pesquisa","tipo":"text","obrigatorio":true}]',
 '[{"id":"projeto","rotulo":"Projeto","obrigatorio":true,"mimes":["application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document"],"max_mb":10,"multiplo":false},
   {"id":"termo_aceite","rotulo":"Termo de aceite do orientador","obrigatorio":true,"mimes":["application/pdf"],"max_mb":10,"multiplo":false}]',
 '[{"ordem":1,"setor":"comissao_tcc","nome":"Coordenação / Comissão de TCC","acoes":["deferir","indeferir","solicitar_complementacao"],"ao_deferir":"proxima","ao_indeferir":"encerrar"},
   {"ordem":2,"setor":"secretaria","nome":"Registro no prontuário","acoes":["concluir","solicitar_complementacao"],"ao_concluir":"encerrar"}]',
 NULL, 5, 'termo_aceite_tcc', 2),

('tcc_final', 'Depósito final do TCC',
 'Entrega da versão final do TCC para homologação da nota.',
 'Anexe a versão final (PDF), o parecer da banca ou aprovação do orientador e a declaração de antiplágio / nada consta.',
 '[{"id":"titulo_final","rotulo":"Título final","tipo":"text","obrigatorio":true},
   {"id":"orientador_id","rotulo":"Orientador","tipo":"professor","obrigatorio":true},
   {"id":"data_defesa","rotulo":"Data da defesa","tipo":"date","obrigatorio":true},
   {"id":"banca","rotulo":"Membros da banca","tipo":"textarea","obrigatorio":true},
   {"id":"nota_final","rotulo":"Nota final","tipo":"number","obrigatorio":true}]',
 '[{"id":"versao_final","rotulo":"Versão final","obrigatorio":true,"mimes":["application/pdf"],"max_mb":10,"multiplo":false},
   {"id":"parecer_banca","rotulo":"Parecer da banca / aprovação do orientador","obrigatorio":true,"mimes":["application/pdf"],"max_mb":10,"multiplo":false},
   {"id":"antiplagio","rotulo":"Declaração de antiplágio / nada consta","obrigatorio":true,"mimes":["application/pdf"],"max_mb":10,"multiplo":false}]',
 '[{"ordem":1,"setor":"coordenacao","nome":"Homologação da coordenação","acoes":["deferir","indeferir","solicitar_complementacao"],
    "campos_acao":[{"id":"nota_homologada","rotulo":"Nota homologada","tipo":"number","obrigatorio":true,"acao":"deferir"}],
    "ao_deferir":"proxima","ao_indeferir":"encerrar"},
   {"ordem":2,"setor":"secretaria","nome":"Registro no histórico","acoes":["concluir","solicitar_complementacao"],"ao_concluir":"encerrar"}]',
 NULL, 5, 'homologacao_tcc', 3),

('abono_faltas', 'Abono ou justificativa de faltas',
 'Justificativa de faltas com documento oficial.',
 'Anexe o documento oficial (atestado, declaração das Forças Armadas, convocação judicial etc.). O atestado fica visível só para a coordenação e a secretaria.',
 '[{"id":"tipo_documento","rotulo":"Tipo de documento","tipo":"select","obrigatorio":true,"opcoes":["Atestado médico","Declaração das Forças Armadas","Convocação judicial","Outro documento oficial"]},
   {"id":"data_inicio","rotulo":"Data inicial","tipo":"date","obrigatorio":true},
   {"id":"data_fim","rotulo":"Data final","tipo":"date","obrigatorio":true},
   {"id":"disciplinas","rotulo":"Disciplinas afetadas","tipo":"materias","obrigatorio":true},
   {"id":"observacao","rotulo":"Observação","tipo":"textarea","obrigatorio":false}]',
 '[{"id":"documento_oficial","rotulo":"Documento oficial","obrigatorio":true,"mimes":["application/pdf","image/jpeg","image/png"],"max_mb":10,"multiplo":true,"sensivel":true}]',
 '[{"ordem":1,"setor":"coordenacao","nome":"Análise da coordenação","acoes":["deferir","indeferir","solicitar_complementacao"],"ao_deferir":"encerrar","ao_indeferir":"encerrar","notificar":["aluno","professores_disciplinas"]}]',
 NULL, 5, NULL, 4),

('atividades_complementares', 'Atividades complementares',
 'Aproveitamento de horas de atividades complementares.',
 'Cadastre cada atividade e anexe o certificado correspondente, com carga horária, data e emissor/CNPJ visíveis.',
 '[{"id":"itens","rotulo":"Atividades","tipo":"itens_ac","obrigatorio":true}]',
 '[{"id":"certificado","rotulo":"Certificado","obrigatorio":true,"mimes":["application/pdf","image/jpeg","image/png"],"max_mb":10,"multiplo":true}]',
 '[{"ordem":1,"setor":"coordenacao","nome":"Avaliação dos certificados","acoes":["deferir","indeferir","solicitar_complementacao"],
    "campos_acao":[{"id":"itens","rotulo":"Horas por atividade","tipo":"itens_ac_avaliacao","obrigatorio":true,"acao":"deferir"}],
    "ao_deferir":"encerrar","ao_indeferir":"encerrar"}]',
 NULL, 5, 'extrato_horas', 5),

('geral', 'Protocolo geral',
 'Requerimentos diversos encaminhados ao setor responsável.',
 'Descreva o pedido e anexe o requerimento fundamentado e/ou comprovantes.',
 '[{"id":"assunto","rotulo":"Assunto","tipo":"text","obrigatorio":true},
   {"id":"descricao","rotulo":"Descrição","tipo":"textarea","obrigatorio":true}]',
 '[{"id":"documentos","rotulo":"Requerimento e comprovantes","obrigatorio":true,"mimes":["application/pdf","image/jpeg","image/png","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document"],"max_mb":10,"multiplo":true}]',
 '[{"ordem":1,"setor":"secretaria","nome":"Triagem da secretaria","acoes":["encaminhar","deferir","indeferir","solicitar_complementacao"],"ao_deferir":"encerrar","ao_indeferir":"encerrar"},
   {"ordem":2,"setor":"*","nome":"Setor de destino","acoes":["deferir","indeferir","solicitar_complementacao"],"ao_deferir":"encerrar","ao_indeferir":"encerrar"}]',
 NULL, 5, NULL, 6)
ON CONFLICT (id) DO NOTHING;

-- ── Auxiliares ────────────────────────────────────────────────────────────
-- Data após n dias úteis (dias letivos do calendário acadêmico) contados a partir de d.
CREATE OR REPLACE FUNCTION public.dias_uteis_apos(d date, n int)
RETURNS date LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v date := d;
  c int := 0;
BEGIN
  WHILE c < n LOOP
    v := v + 1;
    IF public.is_dia_letivo(v) THEN c := c + 1; END IF;
  END LOOP;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public._nome_usuario(_uid uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(
    (SELECT nome FROM public.professores WHERE user_id = _uid LIMIT 1),
    (SELECT nome FROM public.alunos WHERE user_id = _uid LIMIT 1),
    (SELECT nullif(raw_user_meta_data->>'nome', '') FROM auth.users WHERE id = _uid),
    (SELECT email::text FROM auth.users WHERE id = _uid));
$$;

CREATE OR REPLACE FUNCTION public._protocolo_pode_ver(p public.protocolos)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.aluno_id = public.current_aluno_id()
      OR public.is_secretaria()
      OR public.pode_atuar_setor(p.setor_atual, p.curso_id)
      OR EXISTS (SELECT 1 FROM public.protocolo_tramites t
                  WHERE t.protocolo_id = p.id AND t.setor_id IS NOT NULL
                    AND public.pode_atuar_setor(t.setor_id, p.curso_id));
$$;

-- Anexos sensíveis (atestados/CID): só o próprio aluno, a coordenação do curso e a secretaria.
CREATE OR REPLACE FUNCTION public._protocolo_pode_ver_sensivel(p public.protocolos)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.aluno_id = public.current_aluno_id() OR public.is_secretaria() OR public.coordena_curso(p.curso_id);
$$;

CREATE OR REPLACE FUNCTION public.pode_ver_anexo(_name text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sensivel boolean;
  v_p public.protocolos;
BEGIN
  IF split_part(_name, '/', 1) = public.current_aluno_id()::text THEN
    RETURN true;
  END IF;
  SELECT a.sensivel INTO v_sensivel FROM public.protocolo_anexos a WHERE a.storage_path = _name;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT p.* INTO v_p FROM public.protocolos p JOIN public.protocolo_anexos a ON a.protocolo_id = p.id WHERE a.storage_path = _name;
  RETURN public._protocolo_pode_ver(v_p) AND (NOT v_sensivel OR public._protocolo_pode_ver_sensivel(v_p));
END;
$$;

CREATE OR REPLACE FUNCTION public._notificar_aluno(p public.protocolos, _titulo text, _mensagem text)
RETURNS void LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.notificacoes (destino_role, user_id, tipo, titulo, mensagem, link)
  SELECT 'aluno', a.user_id, 'protocolo', _titulo, _mensagem, '/central/protocolos/' || p.id
    FROM public.alunos a WHERE a.id = p.aluno_id AND a.user_id IS NOT NULL;
$$;

-- Notifica quem pode agir no setor atual do protocolo.
CREATE OR REPLACE FUNCTION public._notificar_setor(p public.protocolos, _titulo text, _mensagem text)
RETURNS void LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.notificacoes (destino_role, user_id, tipo, titulo, mensagem, link)
  SELECT DISTINCT 'equipe', u.uid, 'protocolo', _titulo, _mensagem, '/central/equipe/protocolos/' || p.id
    FROM (
      SELECT m.user_id AS uid FROM public.setor_membros m
       WHERE m.setor_id = p.setor_atual AND (m.curso_id IS NULL OR m.curso_id = p.curso_id)
      UNION
      SELECT pr.user_id FROM public.coordenadores c JOIN public.professores pr ON pr.id = c.professor_id
       WHERE p.setor_atual IN ('coordenacao','comissao_tcc') AND pr.user_id IS NOT NULL AND p.curso_id = ANY(c.cursos)
      UNION
      SELECT r.user_id FROM public.user_roles r WHERE p.setor_atual = 'secretaria' AND r.role = 'secretaria'
    ) u
   WHERE u.uid IS NOT NULL;
$$;

-- Valida e grava anexos já enviados ao bucket. Retorna a quantidade por tipo de anexo.
CREATE OR REPLACE FUNCTION public._protocolo_gravar_anexos(p public.protocolos, t public.protocolo_tipos, _anexos jsonb, _tramite uuid, _livre boolean)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  a jsonb;
  def jsonb;
  obj record;
  v_path text;
  v_tipo text;
  v_cont jsonb := '{}';
BEGIN
  FOR a IN SELECT * FROM jsonb_array_elements(coalesce(_anexos, '[]')) LOOP
    v_path := a->>'storage_path';
    v_tipo := coalesce(a->>'tipo_anexo', '');
    def := NULL;
    IF v_path IS NULL OR v_path NOT LIKE p.aluno_id::text || '/' || p.id::text || '/%' THEN
      RAISE EXCEPTION 'Anexo em local inválido' USING ERRCODE = '22023';
    END IF;
    SELECT d INTO def FROM jsonb_array_elements(t.anexos) d WHERE d->>'id' = v_tipo;
    IF def IS NULL AND NOT (_livre AND v_tipo = 'complemento') THEN
      RAISE EXCEPTION 'Tipo de anexo inválido: %', v_tipo USING ERRCODE = '22023';
    END IF;
    SELECT o.name, o.metadata INTO obj FROM storage.objects o WHERE o.bucket_id = 'protocolos' AND o.name = v_path;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Arquivo não encontrado: %', coalesce(a->>'nome_arquivo', v_path) USING ERRCODE = '22023';
    END IF;
    IF coalesce((obj.metadata->>'size')::bigint, 0) > coalesce((def->>'max_mb')::numeric, 10) * 1024 * 1024 THEN
      RAISE EXCEPTION 'Arquivo acima do tamanho permitido: %', a->>'nome_arquivo' USING ERRCODE = '22023';
    END IF;
    IF def IS NOT NULL AND NOT (def->'mimes' ? coalesce(obj.metadata->>'mimetype', '')) THEN
      RAISE EXCEPTION 'Formato não aceito para %: %', def->>'rotulo', a->>'nome_arquivo' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.protocolo_anexos (protocolo_id, tramite_id, tipo_anexo, nome_arquivo, storage_path, mime, tamanho, sha256, enviado_por, sensivel)
    VALUES (p.id, _tramite, v_tipo, coalesce(nullif(a->>'nome_arquivo', ''), 'arquivo'), v_path,
            obj.metadata->>'mimetype', (obj.metadata->>'size')::bigint, a->>'sha256', auth.uid(),
            coalesce((def->>'sensivel')::boolean, false));
    v_cont := jsonb_set(v_cont, ARRAY[v_tipo], to_jsonb(coalesce((v_cont->>v_tipo)::int, 0) + 1));
  END LOOP;
  RETURN v_cont;
END;
$$;

CREATE OR REPLACE FUNCTION public._valor_vazio(v jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT v IS NULL OR v = 'null'::jsonb OR v = '""'::jsonb OR v = '[]'::jsonb
      OR (jsonb_typeof(v) = 'string' AND trim(v #>> '{}') = '');
$$;

-- ── RPCs do aluno ─────────────────────────────────────────────────────────
-- p_id: uuid gerado no cliente, usado também no caminho dos anexos ({aluno}/{p_id}/...).
CREATE OR REPLACE FUNCTION public.protocolo_abrir(p_id uuid, p_tipo text, p_dados jsonb, p_anexos jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_aluno public.alunos;
  v_tipo public.protocolo_tipos;
  v_p public.protocolos;
  v_campo jsonb;
  v_def jsonb;
  v_item jsonb;
  v_cont jsonb;
  v_ano text := to_char(now() AT TIME ZONE 'America/Fortaleza', 'YYYY');
  v_numero text;
  v_prazo jsonb;
  v_data_ref date;
  v_tramite uuid;
  v_etapa jsonb;
BEGIN
  SELECT * INTO v_aluno FROM public.alunos WHERE user_id = auth.uid() AND auth.uid() IS NOT NULL;
  IF v_aluno.id IS NULL THEN
    RAISE EXCEPTION 'Somente alunos com conta vinculada podem abrir protocolos' USING ERRCODE = '42501';
  END IF;
  IF v_aluno.situacao <> 'ativo' THEN
    RAISE EXCEPTION 'Matrícula não está ativa. Procure a secretaria.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_tipo FROM public.protocolo_tipos WHERE id = p_tipo AND ativo;
  IF v_tipo.id IS NULL THEN
    RAISE EXCEPTION 'Tipo de protocolo indisponível' USING ERRCODE = '22023';
  END IF;
  IF p_id IS NULL OR EXISTS (SELECT 1 FROM public.protocolos WHERE id = p_id) THEN
    RAISE EXCEPTION 'Identificador inválido' USING ERRCODE = '22023';
  END IF;
  p_dados := coalesce(p_dados, '{}');

  FOR v_campo IN SELECT * FROM jsonb_array_elements(v_tipo.campos) LOOP
    IF coalesce((v_campo->>'obrigatorio')::boolean, false) AND public._valor_vazio(p_dados->(v_campo->>'id')) THEN
      RAISE EXCEPTION 'Campo obrigatório: %', v_campo->>'rotulo' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  IF p_tipo = 'atividades_complementares' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(p_dados->'itens', '[]')) LOOP
      IF public._valor_vazio(v_item->'descricao') OR coalesce((v_item->>'horas_declaradas')::numeric, 0) <= 0
         OR public._valor_vazio(v_item->'anexo_path') THEN
        RAISE EXCEPTION 'Cada atividade precisa de descrição, carga horária e certificado' USING ERRCODE = '22023';
      END IF;
    END LOOP;
  END IF;
  IF p_tipo = 'abono_faltas' AND (p_dados->>'data_fim')::date < (p_dados->>'data_inicio')::date THEN
    RAISE EXCEPTION 'A data final deve ser igual ou posterior à inicial' USING ERRCODE = '22023';
  END IF;
  IF NOT public._valor_vazio(p_dados->'materia_id') AND NOT EXISTS (
       SELECT 1 FROM public.turma_materias WHERE turma_id = v_aluno.turma_id AND materia_id::text = p_dados->>'materia_id') THEN
    RAISE EXCEPTION 'Disciplina não pertence à sua turma' USING ERRCODE = '22023';
  END IF;
  -- Guarda os nomes vigentes na abertura (exibição e registro histórico).
  p_dados := p_dados || jsonb_strip_nulls(jsonb_build_object(
    'materia_nome', (SELECT nome FROM public.materias WHERE id::text = p_dados->>'materia_id'),
    'professor_nome', (SELECT nome FROM public.professores WHERE id::text = p_dados->>'professor_id'),
    'orientador_nome', (SELECT nome FROM public.professores WHERE id::text = p_dados->>'orientador_id'),
    'disciplinas_nomes', (SELECT jsonb_agg(m.nome ORDER BY m.nome) FROM public.materias m
                           WHERE jsonb_typeof(p_dados->'disciplinas') = 'array'
                             AND m.id::text IN (SELECT jsonb_array_elements_text(p_dados->'disciplinas')))));

  PERFORM pg_advisory_xact_lock(hashtext('protocolo_numero_' || v_ano));
  SELECT v_ano || '.' || lpad((coalesce(max(split_part(numero, '.', 2)::int), 0) + 1)::text, 6, '0')
    INTO v_numero FROM public.protocolos WHERE numero LIKE v_ano || '.%';

  v_etapa := v_tipo.etapas->0;
  v_prazo := v_tipo.prazo_regimental;
  IF v_prazo IS NOT NULL AND NOT public._valor_vazio(p_dados->(v_prazo->>'campo')) THEN
    v_data_ref := (p_dados->>(v_prazo->>'campo'))::date;
  END IF;

  INSERT INTO public.protocolos (id, numero, tipo_id, aluno_id, curso_id, turma_id, dados, status, etapa_atual, setor_atual,
                                 fora_do_prazo, prazo_resposta_em)
  VALUES (p_id, v_numero, v_tipo.id, v_aluno.id, v_aluno.curso_id, v_aluno.turma_id, p_dados, 'aberto', 1, v_etapa->>'setor',
          v_data_ref IS NOT NULL AND current_date > public.dias_uteis_apos(v_data_ref, (v_prazo->>'dias_uteis')::int),
          public.dias_uteis_apos(current_date, v_tipo.prazo_resposta_dias_uteis))
  RETURNING * INTO v_p;

  INSERT INTO public.protocolo_tramites (protocolo_id, etapa, setor_id, acao, parecer, visivel_aluno, user_id)
  VALUES (v_p.id, 0, NULL, 'abertura', 'Protocolo aberto pelo aluno.', true, auth.uid())
  RETURNING id INTO v_tramite;

  v_cont := public._protocolo_gravar_anexos(v_p, v_tipo, p_anexos, v_tramite, false);
  FOR v_def IN SELECT * FROM jsonb_array_elements(v_tipo.anexos) LOOP
    IF coalesce((v_def->>'obrigatorio')::boolean, false) AND coalesce((v_cont->>(v_def->>'id'))::int, 0) = 0 THEN
      RAISE EXCEPTION 'Anexo obrigatório: %', v_def->>'rotulo' USING ERRCODE = '22023';
    END IF;
    IF NOT coalesce((v_def->>'multiplo')::boolean, false) AND coalesce((v_cont->>(v_def->>'id'))::int, 0) > 1 THEN
      RAISE EXCEPTION 'Envie apenas um arquivo em: %', v_def->>'rotulo' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  IF p_tipo = 'atividades_complementares' AND EXISTS (
       SELECT 1 FROM jsonb_array_elements(p_dados->'itens') i
        WHERE NOT EXISTS (SELECT 1 FROM public.protocolo_anexos a WHERE a.protocolo_id = v_p.id AND a.storage_path = i->>'anexo_path')) THEN
    RAISE EXCEPTION 'Certificado de uma atividade não foi enviado' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.academico_audit_logs (user_id, acao, entidade, entidade_id, new_data)
  VALUES (auth.uid(), 'abrir', 'protocolos', v_p.id::text, to_jsonb(v_p));

  PERFORM public._notificar_setor(v_p, 'Novo protocolo ' || v_numero, v_tipo.nome || ' — ' || v_aluno.nome);
  PERFORM public._documento_criar('comprovante_protocolo', v_p.id, '{}'::jsonb);

  RETURN jsonb_build_object('id', v_p.id, 'numero', v_numero, 'fora_do_prazo', v_p.fora_do_prazo);
END;
$$;

CREATE OR REPLACE FUNCTION public.protocolo_responder_pendencia(p_id uuid, p_texto text, p_anexos jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_p public.protocolos;
  v_tipo public.protocolo_tipos;
  v_tramite uuid;
BEGIN
  SELECT * INTO v_p FROM public.protocolos WHERE id = p_id FOR UPDATE;
  IF v_p.id IS NULL OR v_p.aluno_id IS DISTINCT FROM public.current_aluno_id() THEN
    RAISE EXCEPTION 'Protocolo não encontrado' USING ERRCODE = '42501';
  END IF;
  IF v_p.status <> 'aguardando_aluno' THEN
    RAISE EXCEPTION 'Este protocolo não está aguardando resposta' USING ERRCODE = '22023';
  END IF;
  IF coalesce(trim(p_texto), '') = '' AND jsonb_array_length(coalesce(p_anexos, '[]')) = 0 THEN
    RAISE EXCEPTION 'Escreva uma resposta ou envie um anexo' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_tipo FROM public.protocolo_tipos WHERE id = v_p.tipo_id;

  INSERT INTO public.protocolo_tramites (protocolo_id, etapa, setor_id, acao, parecer, visivel_aluno, user_id)
  VALUES (v_p.id, v_p.etapa_atual, v_p.setor_atual, 'resposta_aluno', nullif(trim(p_texto), ''), true, auth.uid())
  RETURNING id INTO v_tramite;
  PERFORM public._protocolo_gravar_anexos(v_p, v_tipo, p_anexos, v_tramite, true);

  UPDATE public.protocolos SET status = 'em_analise', updated_at = now() WHERE id = v_p.id RETURNING * INTO v_p;
  PERFORM public._notificar_setor(v_p, 'Pendência respondida — ' || v_p.numero, 'O aluno respondeu à solicitação de complementação.');
  RETURN jsonb_build_object('status', v_p.status);
END;
$$;

CREATE OR REPLACE FUNCTION public.protocolo_cancelar(p_id uuid, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_p public.protocolos;
BEGIN
  SELECT * INTO v_p FROM public.protocolos WHERE id = p_id FOR UPDATE;
  IF v_p.id IS NULL OR v_p.aluno_id IS DISTINCT FROM public.current_aluno_id() THEN
    RAISE EXCEPTION 'Protocolo não encontrado' USING ERRCODE = '42501';
  END IF;
  IF v_p.status <> 'aberto' THEN
    RAISE EXCEPTION 'Só é possível cancelar antes do início da análise' USING ERRCODE = '22023';
  END IF;
  UPDATE public.protocolos SET status = 'cancelado', cancelado_em = now(), updated_at = now() WHERE id = p_id;
  INSERT INTO public.protocolo_tramites (protocolo_id, etapa, setor_id, acao, parecer, visivel_aluno, user_id)
  VALUES (p_id, v_p.etapa_atual, v_p.setor_atual, 'cancelamento', nullif(trim(p_motivo), ''), true, auth.uid());
  INSERT INTO public.academico_audit_logs (user_id, acao, entidade, entidade_id, old_data)
  VALUES (auth.uid(), 'cancelar', 'protocolos', p_id::text, to_jsonb(v_p));
  RETURN jsonb_build_object('status', 'cancelado');
END;
$$;

-- Disciplinas da turma do aluno, com professor e dias da semana da grade.
CREATE OR REPLACE FUNCTION public.aluno_disciplinas()
RETURNS TABLE (materia_id uuid, nome text, professor_id uuid, professor_nome text, dias_semana int[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id, m.nome, h1.professor_id, pr.nome,
         coalesce((SELECT array_agg(DISTINCT h.dia_semana) FROM public.horarios_aula h
                    WHERE h.turma_id = a.turma_id AND h.materia_id = m.id), '{}')
    FROM public.alunos a
    JOIN public.turma_materias tm ON tm.turma_id = a.turma_id
    JOIN public.materias m ON m.id = tm.materia_id
    LEFT JOIN LATERAL (SELECT h.professor_id FROM public.horarios_aula h
                        WHERE h.turma_id = a.turma_id AND h.materia_id = m.id
                        ORDER BY h.dia_semana, h.horario_id LIMIT 1) h1 ON true
    LEFT JOIN public.professores pr ON pr.id = h1.professor_id
   WHERE a.user_id = auth.uid() AND auth.uid() IS NOT NULL
   ORDER BY m.nome;
$$;

-- Nomes dos professores ativos (sem PIN, CPF ou dados bancários) para orientador/banca.
CREATE OR REPLACE FUNCTION public.professores_nomes()
RETURNS TABLE (id uuid, nome text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.nome FROM public.professores p
   WHERE coalesce(p.status, 'ativo') = 'ativo'
     AND (public.current_aluno_id() IS NOT NULL OR public.is_equipe())
   ORDER BY p.nome;
$$;

-- ── RPCs da equipe ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.protocolo_tramitar(p_id uuid, p_acao text, p_parecer text, p_dados jsonb, p_setor_destino text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_p public.protocolos;
  v_old public.protocolos;
  v_tipo public.protocolo_tipos;
  v_aluno public.alunos;
  v_etapa jsonb;
  v_prox jsonb;
  v_regra text;
  v_campo jsonb;
  v_item jsonb;
  v_orig jsonb;
  v_cat public.ac_categorias;
  v_usado numeric;
  v_horas numeric;
  v_fim text; -- NULL | 'deferido' | 'indeferido'
  v_msg text;
  v_doc text;
BEGIN
  p_dados := coalesce(p_dados, '{}');
  SELECT * INTO v_p FROM public.protocolos WHERE id = p_id FOR UPDATE;
  IF v_p.id IS NULL THEN
    RAISE EXCEPTION 'Protocolo não encontrado' USING ERRCODE = '42501';
  END IF;
  v_old := v_p;
  IF NOT public.pode_atuar_setor(v_p.setor_atual, v_p.curso_id) THEN
    RAISE EXCEPTION 'Você não pode tramitar protocolos deste setor' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_tipo FROM public.protocolo_tipos WHERE id = v_p.tipo_id;
  SELECT * INTO v_aluno FROM public.alunos WHERE id = v_p.aluno_id;
  v_etapa := v_tipo.etapas->(v_p.etapa_atual - 1);

  IF p_acao = 'comentar' THEN
    IF coalesce(trim(p_parecer), '') = '' THEN
      RAISE EXCEPTION 'Escreva o comentário' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.protocolo_tramites (protocolo_id, etapa, setor_id, acao, parecer, visivel_aluno, user_id)
    VALUES (v_p.id, v_p.etapa_atual, v_p.setor_atual, 'comentar', trim(p_parecer),
            coalesce((p_dados->>'visivel_aluno')::boolean, false), auth.uid());
    IF coalesce((p_dados->>'visivel_aluno')::boolean, false) THEN
      PERFORM public._notificar_aluno(v_p, 'Novo comentário no protocolo ' || v_p.numero, trim(p_parecer));
    END IF;
    RETURN jsonb_build_object('status', v_p.status);
  END IF;

  IF v_p.status NOT IN ('aberto','em_analise') THEN
    RAISE EXCEPTION 'Protocolo não está em análise (situação: %)', v_p.status USING ERRCODE = '22023';
  END IF;
  IF v_etapa IS NULL OR NOT (v_etapa->'acoes' ? p_acao) THEN
    RAISE EXCEPTION 'Ação não permitida nesta etapa' USING ERRCODE = '22023';
  END IF;
  IF p_acao IN ('indeferir','solicitar_complementacao') AND coalesce(trim(p_parecer), '') = '' THEN
    RAISE EXCEPTION 'O parecer é obrigatório para esta ação' USING ERRCODE = '22023';
  END IF;
  FOR v_campo IN SELECT * FROM jsonb_array_elements(coalesce(v_etapa->'campos_acao', '[]')) LOOP
    IF v_campo->>'acao' = p_acao AND coalesce((v_campo->>'obrigatorio')::boolean, false)
       AND public._valor_vazio(p_dados->(v_campo->>'id')) THEN
      RAISE EXCEPTION 'Campo obrigatório: %', v_campo->>'rotulo' USING ERRCODE = '22023';
    END IF;
  END LOOP;

  -- Registra o trâmite na etapa/setor em que a ação foi tomada.
  INSERT INTO public.protocolo_tramites (protocolo_id, etapa, setor_id, acao, parecer, dados, visivel_aluno, user_id)
  VALUES (v_p.id, v_p.etapa_atual, v_p.setor_atual, p_acao, nullif(trim(p_parecer), ''), p_dados, true, auth.uid());

  IF p_acao = 'solicitar_complementacao' THEN
    UPDATE public.protocolos SET status = 'aguardando_aluno',
           prazo_resposta_em = public.dias_uteis_apos(current_date, v_tipo.prazo_resposta_dias_uteis), updated_at = now()
     WHERE id = v_p.id RETURNING * INTO v_p;
    PERFORM public._notificar_aluno(v_p, 'Complementação solicitada — ' || v_p.numero, trim(p_parecer));

  ELSIF p_acao = 'indeferir' THEN
    v_fim := 'indeferido';

  ELSIF p_acao = 'encaminhar' THEN
    IF p_setor_destino IS NULL OR p_setor_destino = v_p.setor_atual
       OR NOT EXISTS (SELECT 1 FROM public.setores WHERE id = p_setor_destino AND ativo) THEN
      RAISE EXCEPTION 'Escolha um setor de destino válido' USING ERRCODE = '22023';
    END IF;
    UPDATE public.protocolos SET etapa_atual = LEAST(etapa_atual + 1, jsonb_array_length(v_tipo.etapas)),
           setor_atual = p_setor_destino, status = 'em_analise', updated_at = now()
     WHERE id = v_p.id RETURNING * INTO v_p;
    PERFORM public._notificar_setor(v_p, 'Protocolo encaminhado — ' || v_p.numero, v_tipo.nome || ' — ' || v_aluno.nome);
    PERFORM public._notificar_aluno(v_p, 'Protocolo ' || v_p.numero || ' encaminhado',
      'Seu protocolo foi encaminhado para ' || (SELECT nome FROM public.setores WHERE id = p_setor_destino) || '.');

  ELSE -- deferir | concluir
    v_regra := coalesce(v_etapa->>CASE WHEN p_acao = 'concluir' THEN 'ao_concluir' ELSE 'ao_deferir' END, 'encerrar');

    -- Efeitos intermediários
    IF v_tipo.id = 'tcc_final' AND p_dados ? 'nota_homologada' THEN
      v_p.dados := v_p.dados || jsonb_build_object('nota_homologada', (p_dados->>'nota_homologada')::numeric);
    END IF;
    IF v_tipo.id = 'segunda_chamada' AND p_acao = 'concluir' THEN
      v_p.dados := v_p.dados || jsonb_build_object('agendamento', p_dados);
    END IF;
    IF v_tipo.id = 'atividades_complementares' THEN
      IF jsonb_array_length(coalesce(p_dados->'itens', '[]')) <> jsonb_array_length(coalesce(v_p.dados->'itens', '[]')) THEN
        RAISE EXCEPTION 'Avalie todas as atividades' USING ERRCODE = '22023';
      END IF;
      FOR v_item IN SELECT * FROM jsonb_array_elements(p_dados->'itens') LOOP
        v_orig := v_p.dados->'itens'->((v_item->>'indice')::int);
        v_horas := coalesce((v_item->>'horas_deferidas')::numeric, 0);
        IF v_orig IS NULL THEN
          RAISE EXCEPTION 'Atividade inexistente' USING ERRCODE = '22023';
        END IF;
        CONTINUE WHEN NOT coalesce((v_item->>'autentico')::boolean, false) OR v_horas <= 0;
        IF v_horas > (v_orig->>'horas_declaradas')::numeric THEN
          RAISE EXCEPTION 'Horas deferidas acima das declaradas em "%"', v_orig->>'descricao' USING ERRCODE = '22023';
        END IF;
        SELECT * INTO v_cat FROM public.ac_categorias WHERE id = v_item->>'categoria_id' AND ativo;
        IF v_cat.id IS NULL THEN
          RAISE EXCEPTION 'Escolha a categoria de "%"', v_orig->>'descricao' USING ERRCODE = '22023';
        END IF;
        SELECT coalesce(sum(horas_deferidas), 0) INTO v_usado FROM public.aluno_horas_complementares
         WHERE aluno_id = v_p.aluno_id AND categoria_id = v_cat.id;
        IF v_usado + v_horas > v_cat.limite_horas THEN
          RAISE EXCEPTION 'Limite da categoria "%" excedido: restam % h', v_cat.nome, greatest(v_cat.limite_horas - v_usado, 0) USING ERRCODE = '22023';
        END IF;
        INSERT INTO public.aluno_horas_complementares (aluno_id, protocolo_id, categoria_id, descricao, emissor, data_atividade, horas_declaradas, horas_deferidas)
        VALUES (v_p.aluno_id, v_p.id, v_cat.id, v_orig->>'descricao', v_orig->>'emissor',
                nullif(v_orig->>'data', '')::date, (v_orig->>'horas_declaradas')::numeric, v_horas);
      END LOOP;
    END IF;

    v_prox := v_tipo.etapas->(v_p.etapa_atual);
    IF v_regra = 'proxima' AND v_prox IS NOT NULL AND v_prox->>'setor' <> '*' THEN
      UPDATE public.protocolos SET etapa_atual = etapa_atual + 1, setor_atual = v_prox->>'setor',
             status = 'em_analise', dados = v_p.dados, updated_at = now()
       WHERE id = v_p.id RETURNING * INTO v_p;
      PERFORM public._notificar_setor(v_p, 'Protocolo para sua etapa — ' || v_p.numero, v_tipo.nome || ' — ' || v_aluno.nome);
      PERFORM public._notificar_aluno(v_p, 'Protocolo ' || v_p.numero || ' avançou', 'Etapa atual: ' || coalesce(v_prox->>'nome', v_prox->>'setor') || '.');
    ELSE
      v_fim := 'deferido';
    END IF;
  END IF;

  IF v_fim IS NOT NULL THEN
    UPDATE public.protocolos SET status = CASE WHEN v_fim = 'deferido' THEN 'concluido' ELSE 'indeferido' END,
           decisao = v_fim, parecer_final = nullif(trim(p_parecer), ''), concluido_em = now(),
           dados = v_p.dados, updated_at = now()
     WHERE id = v_p.id RETURNING * INTO v_p;

    IF v_fim = 'deferido' THEN
      IF v_tipo.id = 'tcc_projeto' THEN
        INSERT INTO public.aluno_tcc (aluno_id, titulo, orientador_id, situacao, protocolo_projeto_id)
        VALUES (v_p.aluno_id, v_p.dados->>'titulo', nullif(v_p.dados->>'orientador_id', '')::uuid, 'projeto_aceito', v_p.id)
        ON CONFLICT (aluno_id) DO UPDATE SET titulo = EXCLUDED.titulo, orientador_id = EXCLUDED.orientador_id,
          situacao = 'projeto_aceito', protocolo_projeto_id = EXCLUDED.protocolo_projeto_id, updated_at = now();
      ELSIF v_tipo.id = 'tcc_final' THEN
        INSERT INTO public.aluno_tcc (aluno_id, titulo, orientador_id, situacao, nota_final, protocolo_final_id, homologado_em)
        VALUES (v_p.aluno_id, v_p.dados->>'titulo_final', nullif(v_p.dados->>'orientador_id', '')::uuid, 'concluido',
                (v_p.dados->>'nota_homologada')::numeric, v_p.id, now())
        ON CONFLICT (aluno_id) DO UPDATE SET titulo = EXCLUDED.titulo, orientador_id = EXCLUDED.orientador_id,
          situacao = 'concluido', nota_final = EXCLUDED.nota_final, protocolo_final_id = EXCLUDED.protocolo_final_id,
          homologado_em = now(), updated_at = now();
      ELSIF v_tipo.id = 'segunda_chamada' THEN
        INSERT INTO public.notificacoes (destino_role, professor_id, tipo, titulo, mensagem)
        SELECT 'professor', pr.id, 'segunda_chamada', 'Segunda chamada agendada',
               v_aluno.nome || ' (' || v_aluno.matricula || ') — ' || coalesce(m.nome, 'disciplina') || ': '
               || to_char((v_p.dados#>>'{agendamento,data_prova}')::date, 'DD/MM/YYYY') || ' às '
               || coalesce(v_p.dados#>>'{agendamento,horario}', '') || ', ' || coalesce(v_p.dados#>>'{agendamento,local}', '') || '.'
          FROM public.professores pr
          LEFT JOIN public.materias m ON m.id = nullif(v_p.dados->>'materia_id', '')::uuid
         WHERE pr.id = nullif(v_p.dados->>'professor_id', '')::uuid;
      ELSIF v_tipo.id = 'abono_faltas' THEN
        -- O professor recebe só o período abonado, nunca o atestado.
        INSERT INTO public.notificacoes (destino_role, professor_id, tipo, titulo, mensagem)
        SELECT DISTINCT 'professor', h.professor_id, 'abono_faltas', 'Falta abonada',
               v_aluno.nome || ' (' || v_aluno.matricula || ') teve falta abonada de '
               || to_char((v_p.dados->>'data_inicio')::date, 'DD/MM/YYYY') || ' a '
               || to_char((v_p.dados->>'data_fim')::date, 'DD/MM/YYYY')
               || '. Registre o abono ou combine a compensação das atividades.'
          FROM public.horarios_aula h
         WHERE h.turma_id = v_p.turma_id
           AND h.materia_id::text IN (SELECT jsonb_array_elements_text(coalesce(v_p.dados->'disciplinas', '[]')));
      END IF;
    END IF;

    v_msg := CASE WHEN v_fim = 'deferido' THEN 'Seu protocolo foi deferido.' ELSE 'Seu protocolo foi indeferido.' END
             || coalesce(' Parecer: ' || nullif(trim(p_parecer), ''), '');
    PERFORM public._notificar_aluno(v_p, 'Protocolo ' || v_p.numero || ' ' || v_fim, v_msg);

    v_doc := CASE WHEN v_fim = 'deferido' THEN coalesce(v_tipo.gera_documento, 'parecer_protocolo') ELSE 'parecer_protocolo' END;
    PERFORM public._documento_criar(v_doc, v_p.id, '{}'::jsonb);
  END IF;

  INSERT INTO public.academico_audit_logs (user_id, acao, entidade, entidade_id, old_data, new_data)
  VALUES (auth.uid(), p_acao, 'protocolos', v_p.id::text, to_jsonb(v_old), to_jsonb(v_p));

  RETURN jsonb_build_object('status', v_p.status, 'etapa_atual', v_p.etapa_atual, 'setor_atual', v_p.setor_atual);
END;
$$;

-- shortcut: devolve toda a fila visível sem paginação; paginar quando passar de alguns milhares de protocolos.
CREATE OR REPLACE FUNCTION public.protocolos_fila(p_filtros jsonb DEFAULT '{}')
RETURNS TABLE (id uuid, numero text, tipo_id text, tipo_nome text, aluno_nome text, matricula text, curso_id text,
               status text, etapa_atual int, setor_atual text, fora_do_prazo boolean, prazo_resposta_em date,
               aberto_em timestamptz, updated_at timestamptz, minha_etapa boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_equipe() THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT p.id, p.numero, p.tipo_id, t.nome, a.nome, a.matricula, p.curso_id, p.status, p.etapa_atual, p.setor_atual,
         p.fora_do_prazo, p.prazo_resposta_em, p.aberto_em, p.updated_at,
         (p.status IN ('aberto','em_analise') AND public.pode_atuar_setor(p.setor_atual, p.curso_id))
    FROM public.protocolos p
    JOIN public.protocolo_tipos t ON t.id = p.tipo_id
    JOIN public.alunos a ON a.id = p.aluno_id
   WHERE public._protocolo_pode_ver(p)
     AND (coalesce(p_filtros->>'tipo_id', '') = '' OR p.tipo_id = p_filtros->>'tipo_id')
     AND (coalesce(p_filtros->>'curso_id', '') = '' OR p.curso_id = p_filtros->>'curso_id')
   ORDER BY p.aberto_em DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.protocolo_detalhe(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_p public.protocolos;
  v_eh_aluno boolean;
  v_sensivel boolean;
BEGIN
  SELECT * INTO v_p FROM public.protocolos WHERE id = p_id;
  IF v_p.id IS NULL OR NOT public._protocolo_pode_ver(v_p) THEN
    RAISE EXCEPTION 'Protocolo não encontrado' USING ERRCODE = '42501';
  END IF;
  v_eh_aluno := v_p.aluno_id = public.current_aluno_id();
  v_sensivel := public._protocolo_pode_ver_sensivel(v_p);

  RETURN jsonb_build_object(
    'protocolo', to_jsonb(v_p),
    'tipo', (SELECT to_jsonb(t) FROM public.protocolo_tipos t WHERE t.id = v_p.tipo_id),
    'aluno', (SELECT jsonb_build_object('id', a.id, 'nome', a.nome, 'matricula', a.matricula, 'curso_id', a.curso_id,
                                        'turma', (SELECT nome FROM public.turmas WHERE id = a.turma_id),
                                        'email', a.email, 'telefone', a.telefone)
                FROM public.alunos a WHERE a.id = v_p.aluno_id),
    'setor_nome', (SELECT nome FROM public.setores WHERE id = v_p.setor_atual),
    'tramites', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', t.id, 'etapa', t.etapa, 'setor_id', t.setor_id, 'setor_nome', s.nome, 'acao', t.acao,
               'parecer', t.parecer, 'dados', t.dados, 'visivel_aluno', t.visivel_aluno, 'created_at', t.created_at,
               'autor', CASE WHEN v_eh_aluno AND t.user_id IS DISTINCT FROM auth.uid() THEN NULL ELSE public._nome_usuario(t.user_id) END)
             ORDER BY t.created_at)
        FROM public.protocolo_tramites t LEFT JOIN public.setores s ON s.id = t.setor_id
       WHERE t.protocolo_id = v_p.id AND (NOT v_eh_aluno OR t.visivel_aluno)), '[]'::jsonb),
    'anexos', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', x.id, 'tramite_id', x.tramite_id, 'tipo_anexo', x.tipo_anexo,
               'nome_arquivo', x.nome_arquivo, 'storage_path', x.storage_path, 'mime', x.mime, 'tamanho', x.tamanho,
               'sensivel', x.sensivel, 'created_at', x.created_at) ORDER BY x.created_at)
        FROM public.protocolo_anexos x
       WHERE x.protocolo_id = v_p.id AND (NOT x.sensivel OR v_sensivel)), '[]'::jsonb),
    'anexos_ocultos', (SELECT count(*) FROM public.protocolo_anexos x WHERE x.protocolo_id = v_p.id AND x.sensivel AND NOT v_sensivel),
    'documentos', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', d.id, 'codigo', d.codigo, 'titulo', d.titulo, 'status', d.status,
               'storage_path', d.storage_path, 'emitido_em', d.emitido_em) ORDER BY d.emitido_em)
        FROM public.documentos d WHERE d.protocolo_id = v_p.id AND d.status <> 'cancelado'), '[]'::jsonb),
    'eh_aluno', v_eh_aluno,
    'pode_atuar', NOT v_eh_aluno AND v_p.status IN ('aberto','em_analise') AND public.pode_atuar_setor(v_p.setor_atual, v_p.curso_id),
    'pode_comentar', NOT v_eh_aluno AND public.pode_atuar_setor(v_p.setor_atual, v_p.curso_id)
  );
END;
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.protocolo_tipos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocolos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocolo_tramites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocolo_anexos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aluno_tcc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ac_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aluno_horas_complementares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leem tipos" ON public.protocolo_tipos;
CREATE POLICY "Autenticados leem tipos" ON public.protocolo_tipos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin edita tipos" ON public.protocolo_tipos;
CREATE POLICY "Admin edita tipos" ON public.protocolo_tipos FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Aluno le os proprios protocolos" ON public.protocolos;
CREATE POLICY "Aluno le os proprios protocolos" ON public.protocolos FOR SELECT TO authenticated
  USING (aluno_id = public.current_aluno_id());

DROP POLICY IF EXISTS "Aluno le tramites visiveis" ON public.protocolo_tramites;
CREATE POLICY "Aluno le tramites visiveis" ON public.protocolo_tramites FOR SELECT TO authenticated
  USING (visivel_aluno AND EXISTS (SELECT 1 FROM public.protocolos p WHERE p.id = protocolo_id AND p.aluno_id = public.current_aluno_id()));

DROP POLICY IF EXISTS "Aluno le os proprios anexos" ON public.protocolo_anexos;
CREATE POLICY "Aluno le os proprios anexos" ON public.protocolo_anexos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.protocolos p WHERE p.id = protocolo_id AND p.aluno_id = public.current_aluno_id()));

DROP POLICY IF EXISTS "Leitura do TCC" ON public.aluno_tcc;
CREATE POLICY "Leitura do TCC" ON public.aluno_tcc FOR SELECT TO authenticated
  USING (aluno_id = public.current_aluno_id() OR public.is_secretaria());

DROP POLICY IF EXISTS "Autenticados leem categorias AC" ON public.ac_categorias;
CREATE POLICY "Autenticados leem categorias AC" ON public.ac_categorias FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin gerencia categorias AC" ON public.ac_categorias;
CREATE POLICY "Admin gerencia categorias AC" ON public.ac_categorias FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Leitura das horas AC" ON public.aluno_horas_complementares;
CREATE POLICY "Leitura das horas AC" ON public.aluno_horas_complementares FOR SELECT TO authenticated
  USING (aluno_id = public.current_aluno_id() OR public.is_secretaria()
         OR EXISTS (SELECT 1 FROM public.alunos a WHERE a.id = aluno_id AND public.coordena_curso(a.curso_id)));

-- ── Storage: bucket privado "protocolos" ──────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('protocolos', 'protocolos', false, 10485760,
        ARRAY['application/pdf','image/jpeg','image/png','application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "protocolos: aluno envia na propria pasta" ON storage.objects;
CREATE POLICY "protocolos: aluno envia na propria pasta" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'protocolos' AND (storage.foldername(name))[1] = public.current_aluno_id()::text);
DROP POLICY IF EXISTS "protocolos: leitura autorizada" ON storage.objects;
CREATE POLICY "protocolos: leitura autorizada" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'protocolos' AND public.pode_ver_anexo(name));

-- ── Grants ────────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.dias_uteis_apos(date, int) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public._valor_vazio(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._valor_vazio(jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public._nome_usuario(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._protocolo_pode_ver(public.protocolos) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._protocolo_pode_ver_sensivel(public.protocolos) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._notificar_aluno(public.protocolos, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._notificar_setor(public.protocolos, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._protocolo_gravar_anexos(public.protocolos, public.protocolo_tipos, jsonb, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pode_ver_anexo(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.protocolo_abrir(uuid, text, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.protocolo_responder_pendencia(uuid, text, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.protocolo_cancelar(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.aluno_disciplinas() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.professores_nomes() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.protocolo_tramitar(uuid, text, text, jsonb, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.protocolos_fila(jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.protocolo_detalhe(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dias_uteis_apos(date, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_ver_anexo(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.protocolo_abrir(uuid, text, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.protocolo_responder_pendencia(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.protocolo_cancelar(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aluno_disciplinas() TO authenticated;
GRANT EXECUTE ON FUNCTION public.professores_nomes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.protocolo_tramitar(uuid, text, text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.protocolos_fila(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.protocolo_detalhe(uuid) TO authenticated;


-- ===== 20261105120300_documentos_assinatura.sql =====
-- F6/F7 — Migration D: documentos com assinatura eletrônica e validação pública (F6).
-- Aditiva e idempotente. Depende das Migrations A, B e C.

-- ── Tabelas ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.documento_modelos (
  id text PRIMARY KEY,
  nome text NOT NULL,
  tipo text NOT NULL,
  signatarios jsonb NOT NULL DEFAULT '[]',
  layout jsonb NOT NULL DEFAULT '{}',
  ativo boolean NOT NULL DEFAULT true
);

INSERT INTO public.documento_modelos (id, nome, tipo, signatarios) VALUES
  ('comprovante_protocolo', 'Comprovante de protocolo', 'protocolo',
   '[{"ordem":1,"papel":"aluno","cargo":"Requerente"}]'),
  ('parecer_protocolo', 'Parecer sobre protocolo', 'protocolo',
   '[{"ordem":1,"papel":"decisor","cargo":"Responsável pela decisão"}]'),
  ('deferimento_segunda_chamada', 'Deferimento de segunda chamada', 'protocolo',
   '[{"ordem":1,"papel":"coordenador","cargo":"Coordenação do curso"},{"ordem":2,"papel":"secretaria","cargo":"Secretaria Acadêmica"}]'),
  ('termo_aceite_tcc', 'Termo de aceite do projeto de TCC', 'protocolo',
   '[{"ordem":1,"papel":"coordenador","cargo":"Coordenação / Comissão de TCC"},{"ordem":2,"papel":"secretaria","cargo":"Secretaria Acadêmica"}]'),
  ('homologacao_tcc', 'Homologação do TCC', 'protocolo',
   '[{"ordem":1,"papel":"coordenador","cargo":"Coordenação do curso"},{"ordem":2,"papel":"secretaria","cargo":"Secretaria Acadêmica"}]'),
  ('extrato_horas', 'Extrato de horas complementares', 'protocolo',
   '[{"ordem":1,"papel":"coordenador","cargo":"Coordenação do curso"}]'),
  ('declaracao', 'Declaração', 'avulso',
   '[{"ordem":1,"papel":"secretaria","cargo":"Secretaria Acadêmica"},{"ordem":2,"papel":"diretor","cargo":"Direção"}]')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  modelo_id text NOT NULL REFERENCES public.documento_modelos(id),
  titulo text NOT NULL,
  aluno_id uuid REFERENCES public.alunos(id),
  protocolo_id uuid REFERENCES public.protocolos(id),
  snapshot jsonb NOT NULL,
  storage_path text,
  sha256 text,
  status text NOT NULL DEFAULT 'aguardando_assinatura' CHECK (status IN ('aguardando_assinatura','assinado','cancelado')),
  emitido_por uuid,
  emitido_em timestamptz NOT NULL DEFAULT now(),
  cancelado_por uuid,
  cancelado_motivo text,
  cancelado_em timestamptz
);
CREATE INDEX IF NOT EXISTS idx_documentos_aluno ON public.documentos(aluno_id);
CREATE INDEX IF NOT EXISTS idx_documentos_protocolo ON public.documentos(protocolo_id);

CREATE TABLE IF NOT EXISTS public.documento_assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id uuid NOT NULL REFERENCES public.documentos(id) ON DELETE CASCADE,
  ordem int NOT NULL,
  papel text NOT NULL,
  cargo text,
  signatario_user_id uuid,
  nome_signatario text,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','assinado','recusado')),
  assinado_em timestamptz,
  ip_informado text,
  user_agent text,
  sha256_snapshot text,
  motivo_recusa text
);
CREATE INDEX IF NOT EXISTS idx_assinaturas_doc ON public.documento_assinaturas(documento_id, ordem);
CREATE INDEX IF NOT EXISTS idx_assinaturas_user ON public.documento_assinaturas(signatario_user_id, status);

CREATE TABLE IF NOT EXISTS public.documento_consultas (
  id bigserial PRIMARY KEY,
  codigo text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_doc_consultas ON public.documento_consultas(codigo, created_at);

-- ── Auxiliares ────────────────────────────────────────────────────────────
-- Código IPD-XXXX-XXXX: 7 caracteres aleatórios + 1 dígito verificador (mesmo algoritmo de src/features/documentos/lib/codigo.ts).
CREATE OR REPLACE FUNCTION public._documento_codigo()
RETURNS text LANGUAGE plpgsql VOLATILE SET search_path = public AS $$
DECLARE
  alfa constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea;
  corpo text;
  soma int;
  i int;
  v text;
BEGIN
  LOOP
    b := uuid_send(gen_random_uuid());
    corpo := '';
    soma := 0;
    FOR i IN 0..6 LOOP
      corpo := corpo || substr(alfa, (get_byte(b, i) % 32) + 1, 1);
      soma := soma + (get_byte(b, i) % 32) * (2 * i + 1);
    END LOOP;
    corpo := corpo || substr(alfa, (soma % 32) + 1, 1);
    v := 'IPD-' || substr(corpo, 1, 4) || '-' || substr(corpo, 5, 4);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.documentos WHERE codigo = v);
  END LOOP;
  RETURN v;
END;
$$;

-- "Maria Silva de Oliveira" → "Maria S*** O***"
CREATE OR REPLACE FUNCTION public._mascarar_nome(_nome text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT string_agg(CASE WHEN t.n = 1 THEN t.w ELSE upper(left(t.w, 1)) || '***' END, ' ' ORDER BY t.n)
    FROM regexp_split_to_table(trim(coalesce(_nome, '')), '\s+') WITH ORDINALITY AS t(w, n)
   WHERE t.w <> '' AND (t.n = 1 OR lower(t.w) NOT IN ('de','da','do','das','dos','e'));
$$;

CREATE OR REPLACE FUNCTION public._curso_nome(_curso text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT c->>'nome' FROM public.app_settings s, jsonb_array_elements(s.data->'cursos') c
                    WHERE c->>'id' = _curso LIMIT 1), _curso);
$$;

CREATE OR REPLACE FUNCTION public._documento_pode_ver(d public.documentos)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (d.aluno_id IS NOT NULL AND d.aluno_id = public.current_aluno_id())
      OR public.is_secretaria()
      OR EXISTS (SELECT 1 FROM public.documento_assinaturas a WHERE a.documento_id = d.id AND a.signatario_user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.protocolos p WHERE p.id = d.protocolo_id AND public._protocolo_pode_ver(p));
$$;

CREATE OR REPLACE FUNCTION public._pode_assinar(a public.documento_assinaturas, d public.documentos)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.status = 'pendente' AND d.status = 'aguardando_assinatura' AND auth.uid() IS NOT NULL AND (
    a.signatario_user_id = auth.uid()
    OR (a.signatario_user_id IS NULL AND CASE a.papel
          WHEN 'coordenador' THEN public.coordena_curso(d.snapshot#>>'{aluno,curso_id}')
                                  OR public.pode_atuar_setor('comissao_tcc', d.snapshot#>>'{aluno,curso_id}')
          WHEN 'secretaria' THEN public.is_secretaria()
          WHEN 'diretor' THEN public.has_any_role(ARRAY['diretor','admin']::public.app_role[]) OR public.membro_setor('direcao')
          ELSE false END))
    -- só a primeira assinatura pendente (ordem) pode ser feita
    AND NOT EXISTS (SELECT 1 FROM public.documento_assinaturas o
                     WHERE o.documento_id = a.documento_id AND o.status = 'pendente' AND o.ordem < a.ordem);
$$;

-- Cria o documento com snapshot montado no servidor e as assinaturas pendentes do modelo.
CREATE OR REPLACE FUNCTION public._documento_criar(p_modelo text, p_protocolo uuid, p_dados jsonb)
RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_modelo public.documento_modelos;
  v_p public.protocolos;
  v_aluno public.alunos;
  v_tipo_nome text;
  v_snap jsonb;
  v_doc public.documentos;
  v_sig jsonb;
  v_uid uuid;
  v_titulo text;
  v_extra jsonb := '{}';
BEGIN
  SELECT * INTO v_modelo FROM public.documento_modelos WHERE id = p_modelo AND ativo;
  IF v_modelo.id IS NULL THEN
    RETURN NULL; -- modelo desativado: não emite
  END IF;
  p_dados := coalesce(p_dados, '{}');
  IF p_protocolo IS NOT NULL THEN
    SELECT * INTO v_p FROM public.protocolos WHERE id = p_protocolo;
    SELECT nome INTO v_tipo_nome FROM public.protocolo_tipos WHERE id = v_p.tipo_id;
    SELECT * INTO v_aluno FROM public.alunos WHERE id = v_p.aluno_id;
  ELSIF p_dados ? 'aluno_id' THEN
    SELECT * INTO v_aluno FROM public.alunos WHERE id = (p_dados->>'aluno_id')::uuid;
  END IF;

  IF p_modelo = 'extrato_horas' THEN
    v_extra := jsonb_build_object('horas', coalesce((
      SELECT jsonb_agg(jsonb_build_object('categoria', c.nome, 'descricao', h.descricao, 'emissor', h.emissor,
                                          'data', h.data_atividade, 'horas_declaradas', h.horas_declaradas,
                                          'horas_deferidas', h.horas_deferidas, 'deste_protocolo', h.protocolo_id = v_p.id)
                       ORDER BY h.data_atividade NULLS LAST, h.created_at)
        FROM public.aluno_horas_complementares h JOIN public.ac_categorias c ON c.id = h.categoria_id
       WHERE h.aluno_id = v_aluno.id), '[]'::jsonb),
      'total_horas', (SELECT coalesce(sum(horas_deferidas), 0) FROM public.aluno_horas_complementares WHERE aluno_id = v_aluno.id));
  ELSIF p_modelo IN ('termo_aceite_tcc', 'homologacao_tcc') THEN
    v_extra := jsonb_build_object('tcc', (
      SELECT jsonb_build_object('titulo', t.titulo, 'situacao', t.situacao, 'nota_final', t.nota_final,
                                'orientador', (SELECT nome FROM public.professores WHERE id = t.orientador_id),
                                'homologado_em', t.homologado_em)
        FROM public.aluno_tcc t WHERE t.aluno_id = v_aluno.id));
  ELSIF p_modelo = 'deferimento_segunda_chamada' THEN
    v_extra := jsonb_build_object(
      'disciplina', (SELECT nome FROM public.materias WHERE id = nullif(v_p.dados->>'materia_id', '')::uuid),
      'professor', (SELECT nome FROM public.professores WHERE id = nullif(v_p.dados->>'professor_id', '')::uuid));
  END IF;

  v_titulo := coalesce(nullif(p_dados->>'titulo', ''), v_modelo.nome || coalesce(' — ' || v_p.numero, ''));
  v_snap := jsonb_build_object(
    'modelo', v_modelo.id,
    'modelo_nome', v_modelo.nome,
    'titulo', v_titulo,
    'emitido_em', to_char(now() AT TIME ZONE 'America/Fortaleza', 'YYYY-MM-DD"T"HH24:MI:SS'),
    'aluno', CASE WHEN v_aluno.id IS NULL THEN NULL ELSE jsonb_build_object(
      'nome', v_aluno.nome, 'matricula', v_aluno.matricula, 'cpf', v_aluno.cpf,
      'curso_id', v_aluno.curso_id, 'curso_nome', public._curso_nome(v_aluno.curso_id),
      'turma', (SELECT nome FROM public.turmas WHERE id = v_aluno.turma_id)) END,
    'protocolo', CASE WHEN v_p.id IS NULL THEN NULL ELSE jsonb_build_object(
      'numero', v_p.numero, 'tipo_id', v_p.tipo_id, 'tipo_nome', v_tipo_nome,
      'aberto_em', to_char(v_p.aberto_em AT TIME ZONE 'America/Fortaleza', 'YYYY-MM-DD"T"HH24:MI:SS'),
      'status', v_p.status, 'decisao', v_p.decisao, 'parecer_final', v_p.parecer_final,
      'fora_do_prazo', v_p.fora_do_prazo, 'dados', v_p.dados) END,
    'texto', p_dados->>'texto'
  ) || v_extra;

  INSERT INTO public.documentos (codigo, modelo_id, titulo, aluno_id, protocolo_id, snapshot, emitido_por)
  VALUES (public._documento_codigo(), v_modelo.id, v_titulo, v_aluno.id, v_p.id, v_snap, auth.uid())
  RETURNING * INTO v_doc;

  FOR v_sig IN SELECT * FROM jsonb_array_elements(v_modelo.signatarios) ORDER BY (value->>'ordem')::int LOOP
    v_uid := CASE v_sig->>'papel'
      WHEN 'aluno' THEN v_aluno.user_id
      WHEN 'decisor' THEN auth.uid()
      WHEN 'coordenador' THEN (SELECT t.user_id FROM public.protocolo_tramites t
                                WHERE t.protocolo_id = v_p.id AND t.setor_id IN ('coordenacao','comissao_tcc')
                                  AND t.acao IN ('deferir','concluir') ORDER BY t.created_at DESC LIMIT 1)
      WHEN 'secretaria' THEN CASE WHEN public.is_secretaria() THEN auth.uid() END
      ELSE NULL END;
    INSERT INTO public.documento_assinaturas (documento_id, ordem, papel, cargo, signatario_user_id)
    VALUES (v_doc.id, (v_sig->>'ordem')::int, v_sig->>'papel', v_sig->>'cargo', v_uid);
  END LOOP;

  -- Comprovante: o aceite eletrônico do aluno foi dado ao protocolar.
  IF p_modelo = 'comprovante_protocolo' AND v_aluno.user_id = auth.uid() THEN
    UPDATE public.documento_assinaturas
       SET status = 'assinado', assinado_em = now(), nome_signatario = v_aluno.nome,
           sha256_snapshot = encode(sha256(convert_to(v_snap::text, 'UTF8')), 'hex'),
           ip_informado = split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1)
     WHERE documento_id = v_doc.id AND papel = 'aluno';
    UPDATE public.documentos SET status = 'assinado' WHERE id = v_doc.id;
  END IF;

  PERFORM public._notificar_signatario(v_doc.id);
  RETURN v_doc.id;
END;
$$;

-- Avisa quem deve assinar a próxima assinatura pendente (se já tiver usuário definido).
CREATE OR REPLACE FUNCTION public._notificar_signatario(_doc uuid)
RETURNS void LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.notificacoes (destino_role, user_id, tipo, titulo, mensagem, link)
  SELECT 'equipe', a.signatario_user_id, 'assinatura', 'Documento aguardando sua assinatura', d.titulo, '/central/assinaturas'
    FROM public.documento_assinaturas a JOIN public.documentos d ON d.id = a.documento_id
   WHERE a.documento_id = _doc AND a.status = 'pendente' AND d.status = 'aguardando_assinatura'
     AND a.signatario_user_id IS NOT NULL AND a.signatario_user_id IS DISTINCT FROM auth.uid()
     AND a.ordem = (SELECT min(ordem) FROM public.documento_assinaturas WHERE documento_id = _doc AND status = 'pendente');
$$;

-- ── RPCs ──────────────────────────────────────────────────────────────────
-- Emissão manual pela secretaria (ex.: declaração com texto livre).
CREATE OR REPLACE FUNCTION public.documento_criar(p_modelo text, p_protocolo uuid, p_dados jsonb)
RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.is_secretaria() THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  IF p_modelo = 'declaracao' AND coalesce(trim(p_dados->>'texto'), '') = '' THEN
    RAISE EXCEPTION 'Escreva o texto da declaração' USING ERRCODE = '22023';
  END IF;
  v_id := public._documento_criar(p_modelo, p_protocolo, p_dados);
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Modelo indisponível' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.academico_audit_logs (user_id, acao, entidade, entidade_id, new_data)
  VALUES (auth.uid(), 'emitir', 'documentos', v_id::text, jsonb_build_object('modelo', p_modelo));
  RETURN v_id;
END;
$$;

-- O cliente reautentica (signInWithPassword) antes de chamar.
CREATE OR REPLACE FUNCTION public.documento_assinar(p_id uuid, p_user_agent text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_doc public.documentos;
  v_a public.documento_assinaturas;
  v_restantes int;
BEGIN
  SELECT * INTO v_doc FROM public.documentos WHERE id = p_id FOR UPDATE;
  IF v_doc.id IS NULL THEN
    RAISE EXCEPTION 'Documento não encontrado' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_a FROM public.documento_assinaturas
   WHERE documento_id = p_id AND status = 'pendente' ORDER BY ordem LIMIT 1;
  IF v_a.id IS NULL OR NOT public._pode_assinar(v_a, v_doc) THEN
    RAISE EXCEPTION 'Não é a sua vez de assinar este documento' USING ERRCODE = '42501';
  END IF;

  UPDATE public.documento_assinaturas
     SET status = 'assinado', signatario_user_id = auth.uid(), nome_signatario = public._nome_usuario(auth.uid()),
         assinado_em = now(), user_agent = left(p_user_agent, 300),
         ip_informado = split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1),
         sha256_snapshot = encode(sha256(convert_to(v_doc.snapshot::text, 'UTF8')), 'hex')
   WHERE id = v_a.id;

  SELECT count(*) INTO v_restantes FROM public.documento_assinaturas WHERE documento_id = p_id AND status = 'pendente';
  IF v_restantes = 0 THEN
    UPDATE public.documentos SET status = 'assinado' WHERE id = p_id;
    INSERT INTO public.notificacoes (destino_role, user_id, tipo, titulo, mensagem, link)
    SELECT 'aluno', al.user_id, 'documento', 'Documento disponível', v_doc.titulo, '/central/documentos'
      FROM public.alunos al WHERE al.id = v_doc.aluno_id AND al.user_id IS NOT NULL;
  ELSE
    PERFORM public._notificar_signatario(p_id);
  END IF;
  INSERT INTO public.academico_audit_logs (user_id, acao, entidade, entidade_id, new_data)
  VALUES (auth.uid(), 'assinar', 'documentos', p_id::text, jsonb_build_object('ordem', v_a.ordem, 'papel', v_a.papel));
  RETURN jsonb_build_object('completo', v_restantes = 0);
END;
$$;

-- Registra o PDF final (uma única vez; depois é imutável). Só a equipe registra, para o titular não
-- poder fixar um PDF adulterado como oficial; o aluno baixa a renderização local, que é idêntica.
CREATE OR REPLACE FUNCTION public.documento_registrar_arquivo(p_id uuid, p_sha256 text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_doc public.documentos;
BEGIN
  SELECT * INTO v_doc FROM public.documentos WHERE id = p_id FOR UPDATE;
  IF v_doc.id IS NULL OR NOT public._documento_pode_ver(v_doc) OR NOT public.is_equipe() THEN
    RAISE EXCEPTION 'Documento não encontrado' USING ERRCODE = '42501';
  END IF;
  IF v_doc.storage_path IS NOT NULL THEN
    RETURN jsonb_build_object('storage_path', v_doc.storage_path, 'sha256', v_doc.sha256, 'ja_registrado', true);
  END IF;
  IF v_doc.status <> 'assinado' THEN
    RAISE EXCEPTION 'Documento ainda não foi assinado por todos' USING ERRCODE = '22023';
  END IF;
  IF p_sha256 !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Hash inválido' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'documentos' AND name = p_id::text || '.pdf') THEN
    RAISE EXCEPTION 'Arquivo não enviado' USING ERRCODE = '22023';
  END IF;
  UPDATE public.documentos SET storage_path = p_id::text || '.pdf', sha256 = p_sha256 WHERE id = p_id;
  RETURN jsonb_build_object('storage_path', p_id::text || '.pdf', 'sha256', p_sha256, 'ja_registrado', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.documento_cancelar(p_id uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_secretaria() THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  IF coalesce(trim(p_motivo), '') = '' THEN
    RAISE EXCEPTION 'Informe o motivo do cancelamento' USING ERRCODE = '22023';
  END IF;
  UPDATE public.documentos SET status = 'cancelado', cancelado_por = auth.uid(), cancelado_motivo = trim(p_motivo), cancelado_em = now()
   WHERE id = p_id AND status <> 'cancelado';
  INSERT INTO public.academico_audit_logs (user_id, acao, entidade, entidade_id, new_data)
  VALUES (auth.uid(), 'cancelar', 'documentos', p_id::text, jsonb_build_object('motivo', trim(p_motivo)));
END;
$$;

-- Documento + assinaturas para renderizar o PDF.
CREATE OR REPLACE FUNCTION public.documento_obter(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_doc public.documentos;
BEGIN
  SELECT * INTO v_doc FROM public.documentos WHERE id = p_id;
  IF v_doc.id IS NULL OR NOT (public._documento_pode_ver(v_doc)
       OR EXISTS (SELECT 1 FROM public.documento_assinaturas a WHERE a.documento_id = p_id AND public._pode_assinar(a, v_doc))) THEN
    RAISE EXCEPTION 'Documento não encontrado' USING ERRCODE = '42501';
  END IF;
  RETURN to_jsonb(v_doc) || jsonb_build_object(
    'pode_assinar', EXISTS (SELECT 1 FROM public.documento_assinaturas a WHERE a.documento_id = p_id AND public._pode_assinar(a, v_doc)),
    'assinaturas', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'ordem', a.ordem, 'papel', a.papel, 'cargo', a.cargo, 'nome_signatario', a.nome_signatario,
        'status', a.status, 'assinado_em', a.assinado_em, 'sha256_snapshot', a.sha256_snapshot) ORDER BY a.ordem)
      FROM public.documento_assinaturas a WHERE a.documento_id = p_id), '[]'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.documentos_para_assinar()
RETURNS TABLE (id uuid, codigo text, titulo text, modelo_id text, emitido_em timestamptz, aluno_nome text, papel text, cargo text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.id, d.codigo, d.titulo, d.modelo_id, d.emitido_em, d.snapshot#>>'{aluno,nome}', a.papel, a.cargo
    FROM public.documentos d
    JOIN public.documento_assinaturas a ON a.documento_id = d.id
   WHERE public._pode_assinar(a, d)
   ORDER BY d.emitido_em;
$$;

-- Validação pública por código (anon). Registra a consulta e limita 30 por código a cada 10 min.
CREATE OR REPLACE FUNCTION public.documento_validar(p_codigo text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cod text := upper(regexp_replace(coalesce(p_codigo, ''), '\s', '', 'g'));
  v_doc public.documentos;
  v_mat text;
BEGIN
  IF v_cod !~ '^IPD-[A-Z2-9]{4}-[A-Z2-9]{4}$' THEN
    RETURN jsonb_build_object('encontrado', false);
  END IF;
  IF (SELECT count(*) FROM public.documento_consultas WHERE codigo = v_cod AND created_at > now() - interval '10 minutes') >= 30 THEN
    RETURN jsonb_build_object('encontrado', false, 'erro', 'Muitas consultas para este código. Tente novamente em alguns minutos.');
  END IF;
  INSERT INTO public.documento_consultas (codigo) VALUES (v_cod);

  SELECT * INTO v_doc FROM public.documentos WHERE codigo = v_cod;
  IF v_doc.id IS NULL THEN
    RETURN jsonb_build_object('encontrado', false);
  END IF;
  v_mat := v_doc.snapshot#>>'{aluno,matricula}';
  RETURN jsonb_build_object(
    'encontrado', true,
    'codigo', v_doc.codigo,
    'tipo', (SELECT nome FROM public.documento_modelos WHERE id = v_doc.modelo_id),
    'titulo', v_doc.titulo,
    'status', v_doc.status,
    'titular', public._mascarar_nome(v_doc.snapshot#>>'{aluno,nome}'),
    'matricula', CASE WHEN v_mat IS NULL THEN NULL ELSE repeat('*', greatest(length(v_mat) - 3, 1)) || right(v_mat, 3) END,
    'emitido_em', v_doc.emitido_em,
    'cancelado_em', v_doc.cancelado_em,
    'sha256', v_doc.sha256,
    'signatarios', coalesce((SELECT jsonb_agg(jsonb_build_object('nome', a.nome_signatario, 'cargo', a.cargo,
                                                                 'status', a.status, 'assinado_em', a.assinado_em) ORDER BY a.ordem)
                               FROM public.documento_assinaturas a WHERE a.documento_id = v_doc.id), '[]'::jsonb));
END;
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.documento_modelos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documento_assinaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documento_consultas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leem modelos" ON public.documento_modelos;
CREATE POLICY "Autenticados leem modelos" ON public.documento_modelos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Leitura de documentos" ON public.documentos;
CREATE POLICY "Leitura de documentos" ON public.documentos FOR SELECT TO authenticated
  USING ((aluno_id IS NOT NULL AND aluno_id = public.current_aluno_id()) OR public.is_secretaria());

DROP POLICY IF EXISTS "Leitura de assinaturas" ON public.documento_assinaturas;
CREATE POLICY "Leitura de assinaturas" ON public.documento_assinaturas FOR SELECT TO authenticated
  USING (signatario_user_id = auth.uid() OR public.is_secretaria()
         OR EXISTS (SELECT 1 FROM public.documentos d WHERE d.id = documento_id AND d.aluno_id = public.current_aluno_id()));

-- ── Storage: bucket privado "documentos" ──────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documentos', 'documentos', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.pode_enviar_documento(_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.documentos d
                  WHERE d.id::text || '.pdf' = _name AND d.status = 'assinado' AND d.storage_path IS NULL
                    AND public.is_equipe() AND public._documento_pode_ver(d));
$$;

CREATE OR REPLACE FUNCTION public.pode_ver_documento_arquivo(_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.documentos d WHERE d.id::text || '.pdf' = _name AND public._documento_pode_ver(d));
$$;

DROP POLICY IF EXISTS "documentos: envio do PDF final" ON storage.objects;
CREATE POLICY "documentos: envio do PDF final" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos' AND public.pode_enviar_documento(name));
DROP POLICY IF EXISTS "documentos: leitura autorizada" ON storage.objects;
CREATE POLICY "documentos: leitura autorizada" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documentos' AND public.pode_ver_documento_arquivo(name));

-- ── Grants ────────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public._documento_codigo() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._mascarar_nome(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._curso_nome(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._documento_pode_ver(public.documentos) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._pode_assinar(public.documento_assinaturas, public.documentos) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._documento_criar(text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._notificar_signatario(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.documento_criar(text, uuid, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.documento_assinar(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.documento_registrar_arquivo(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.documento_cancelar(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.documento_obter(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.documentos_para_assinar() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pode_enviar_documento(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pode_ver_documento_arquivo(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.documento_validar(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.documento_criar(text, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.documento_assinar(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.documento_registrar_arquivo(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.documento_cancelar(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.documento_obter(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.documentos_para_assinar() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_enviar_documento(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_ver_documento_arquivo(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.documento_validar(text) TO anon, authenticated;


-- ===== 20261105130000_fecha_justificativas_e_coordenadores.sql =====
-- Endurecimento após abrir cadastro de alunos/equipe (F6/F7): qualquer pessoa pode criar conta.
-- 1) Anexos de justificativa passam a exigir URL assinada (o app já usa getAnexoSignedUrl).
UPDATE storage.buckets SET public = false WHERE id = 'justificativas';
-- 2) coordenadores tem valor_quinzenal; só o admin lê (policy "Admins manage coordenadores").
DROP POLICY IF EXISTS "Auth read coordenadores" ON public.coordenadores;


-- ===== 20261106120000_correcoes_central.sql =====
-- Correções da revisão de 06/11/2026 (Central de protocolos).
-- Aditiva e idempotente (só CREATE OR REPLACE / funções novas). Não altera dados existentes.
--  1) Notificações: quando nenhum membro responde pelo setor/curso, a administração é avisada,
--     e o admin passa a ver quais setores estão sem responsável (setores_sem_responsavel).
--  3) Primeiro acesso: aluno_pre_validar confere matrícula + CPF + nascimento ANTES de criar a conta
--     (mesmo limite de 5 tentativas / 15 min por matrícula do aluno_vincular_conta).
--  4) Validação pública: o nome do aluno também é mascarado na lista de assinaturas.
--  6) Prazos usam a data de Fortaleza (_hoje) em vez da data UTC do servidor; data de avaliação
--     futura é recusada. Extra: deferir atividades complementares com 0 h é recusado (use Indeferir).

-- ── Data local da instituição ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._hoje()
RETURNS date LANGUAGE sql STABLE AS $$
  SELECT (now() AT TIME ZONE 'America/Fortaleza')::date;
$$;

-- ── 1) Notificação com fallback para a administração ─────────────────────
CREATE OR REPLACE FUNCTION public._notificar_setor(p public.protocolos, _titulo text, _mensagem text)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_qtd int;
BEGIN
  INSERT INTO public.notificacoes (destino_role, user_id, tipo, titulo, mensagem, link)
  SELECT DISTINCT 'equipe', u.uid, 'protocolo', _titulo, _mensagem, '/central/equipe/protocolos/' || p.id
    FROM (
      SELECT m.user_id AS uid FROM public.setor_membros m
       WHERE m.setor_id = p.setor_atual AND (m.curso_id IS NULL OR m.curso_id = p.curso_id)
      UNION
      SELECT pr.user_id FROM public.coordenadores c JOIN public.professores pr ON pr.id = c.professor_id
       WHERE p.setor_atual IN ('coordenacao','comissao_tcc') AND pr.user_id IS NOT NULL AND p.curso_id = ANY(c.cursos)
      UNION
      SELECT r.user_id FROM public.user_roles r WHERE p.setor_atual = 'secretaria' AND r.role = 'secretaria'
    ) u
   WHERE u.uid IS NOT NULL;
  GET DIAGNOSTICS v_qtd = ROW_COUNT;

  -- Ninguém responde por este setor/curso: avisa a administração para não deixar o pedido parado.
  IF v_qtd = 0 THEN
    INSERT INTO public.notificacoes (destino_role, user_id, tipo, titulo, mensagem, link)
    SELECT DISTINCT 'admin', r.user_id, 'protocolo', _titulo,
           _mensagem || ' — Atenção: nenhum responsável cadastrado para ' ||
           coalesce((SELECT nome FROM public.setores WHERE id = p.setor_atual), p.setor_atual) ||
           ' (' || public._curso_nome(p.curso_id) || '). Configure em Admin › Equipe e setores.',
           '/admin/protocolos/' || p.id
      FROM public.user_roles r WHERE r.role = 'admin';
  END IF;
END;
$$;

-- Setores (e cursos, para coordenação/comissão) que hoje não têm ninguém para tramitar.
CREATE OR REPLACE FUNCTION public.setores_sem_responsavel()
RETURNS TABLE (setor_id text, setor_nome text, curso_id text, curso_nome text, protocolos_parados bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH cursos AS (
    SELECT c->>'id' AS id FROM public.app_settings s, jsonb_array_elements(s.data->'cursos') c
  ), alvo AS (
    SELECT s.id AS setor, s.nome, cu.id AS curso
      FROM public.setores s CROSS JOIN cursos cu
     WHERE s.ativo AND s.id IN ('coordenacao','comissao_tcc')
    UNION ALL
    SELECT s.id, s.nome, NULL FROM public.setores s WHERE s.ativo AND s.id NOT IN ('coordenacao','comissao_tcc')
  )
  SELECT a.setor, a.nome, a.curso, CASE WHEN a.curso IS NULL THEN NULL ELSE public._curso_nome(a.curso) END,
         (SELECT count(*) FROM public.protocolos p
           WHERE p.setor_atual = a.setor AND p.status IN ('aberto','em_analise')
             AND (a.curso IS NULL OR p.curso_id = a.curso))
    FROM alvo a
   WHERE NOT EXISTS (SELECT 1 FROM public.setor_membros m
                      WHERE m.setor_id = a.setor AND (a.curso IS NULL OR m.curso_id IS NULL OR m.curso_id = a.curso))
     AND NOT (a.setor IN ('coordenacao','comissao_tcc') AND EXISTS (
           SELECT 1 FROM public.coordenadores c JOIN public.professores pr ON pr.id = c.professor_id
            WHERE pr.user_id IS NOT NULL AND a.curso = ANY(c.cursos)))
     AND NOT (a.setor = 'secretaria' AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.role = 'secretaria'))
   ORDER BY a.nome, a.curso;
END;
$$;

-- ── 3) Pré-validação do primeiro acesso (antes de criar a conta) ──────────
-- Responde só ok/erro genérico; conta tentativa na mesma chave do vínculo (5 a cada 15 min).
CREATE OR REPLACE FUNCTION public.aluno_pre_validar(p_matricula text, p_cpf text, p_nascimento date)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_chave text := 'vinc:' || lower(trim(coalesce(p_matricula, '')));
  v_t public.acesso_tentativas;
  v_aluno public.alunos;
BEGIN
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
     AND situacao <> 'cancelado';

  IF v_aluno.id IS NULL THEN
    UPDATE public.acesso_tentativas
       SET tentativas = v_t.tentativas + 1,
           bloqueado_ate = CASE WHEN v_t.tentativas + 1 >= 5 THEN now() + interval '15 minutes' END
     WHERE chave = v_chave;
    RETURN jsonb_build_object('ok', false, 'erro', 'Não foi possível confirmar seus dados. Confira matrícula, CPF e data de nascimento ou procure a secretaria.');
  END IF;
  IF v_aluno.user_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Esta matrícula já tem conta. Entre pela tela inicial ou use "Esqueci minha senha".');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── 4) Validação pública: nome do aluno mascarado também nas assinaturas ──
CREATE OR REPLACE FUNCTION public.documento_validar(p_codigo text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cod text := upper(regexp_replace(coalesce(p_codigo, ''), '\s', '', 'g'));
  v_doc public.documentos;
  v_mat text;
BEGIN
  IF v_cod !~ '^IPD-[A-Z2-9]{4}-[A-Z2-9]{4}$' THEN
    RETURN jsonb_build_object('encontrado', false);
  END IF;
  IF (SELECT count(*) FROM public.documento_consultas WHERE codigo = v_cod AND created_at > now() - interval '10 minutes') >= 30 THEN
    RETURN jsonb_build_object('encontrado', false, 'erro', 'Muitas consultas para este código. Tente novamente em alguns minutos.');
  END IF;
  INSERT INTO public.documento_consultas (codigo) VALUES (v_cod);

  SELECT * INTO v_doc FROM public.documentos WHERE codigo = v_cod;
  IF v_doc.id IS NULL THEN
    RETURN jsonb_build_object('encontrado', false);
  END IF;
  v_mat := v_doc.snapshot#>>'{aluno,matricula}';
  RETURN jsonb_build_object(
    'encontrado', true,
    'codigo', v_doc.codigo,
    'tipo', (SELECT nome FROM public.documento_modelos WHERE id = v_doc.modelo_id),
    'titulo', v_doc.titulo,
    'status', v_doc.status,
    'titular', public._mascarar_nome(v_doc.snapshot#>>'{aluno,nome}'),
    'matricula', CASE WHEN v_mat IS NULL THEN NULL ELSE repeat('*', greatest(length(v_mat) - 3, 1)) || right(v_mat, 3) END,
    'emitido_em', v_doc.emitido_em,
    'cancelado_em', v_doc.cancelado_em,
    'sha256', v_doc.sha256,
    'signatarios', coalesce((SELECT jsonb_agg(jsonb_build_object(
                                 'nome', CASE WHEN a.papel = 'aluno' THEN public._mascarar_nome(a.nome_signatario) ELSE a.nome_signatario END,
                                 'cargo', a.cargo, 'status', a.status, 'assinado_em', a.assinado_em) ORDER BY a.ordem)
                               FROM public.documento_assinaturas a WHERE a.documento_id = v_doc.id), '[]'::jsonb));
END;
$$;

-- ── 6) Abertura e tramitação com data de Fortaleza ────────────────────────
CREATE OR REPLACE FUNCTION public.protocolo_abrir(p_id uuid, p_tipo text, p_dados jsonb, p_anexos jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_aluno public.alunos;
  v_tipo public.protocolo_tipos;
  v_p public.protocolos;
  v_campo jsonb;
  v_def jsonb;
  v_item jsonb;
  v_cont jsonb;
  v_ano text := to_char(now() AT TIME ZONE 'America/Fortaleza', 'YYYY');
  v_numero text;
  v_prazo jsonb;
  v_data_ref date;
  v_tramite uuid;
  v_etapa jsonb;
BEGIN
  SELECT * INTO v_aluno FROM public.alunos WHERE user_id = auth.uid() AND auth.uid() IS NOT NULL;
  IF v_aluno.id IS NULL THEN
    RAISE EXCEPTION 'Somente alunos com conta vinculada podem abrir protocolos' USING ERRCODE = '42501';
  END IF;
  IF v_aluno.situacao <> 'ativo' THEN
    RAISE EXCEPTION 'Matrícula não está ativa. Procure a secretaria.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_tipo FROM public.protocolo_tipos WHERE id = p_tipo AND ativo;
  IF v_tipo.id IS NULL THEN
    RAISE EXCEPTION 'Tipo de protocolo indisponível' USING ERRCODE = '22023';
  END IF;
  IF p_id IS NULL OR EXISTS (SELECT 1 FROM public.protocolos WHERE id = p_id) THEN
    RAISE EXCEPTION 'Identificador inválido' USING ERRCODE = '22023';
  END IF;
  p_dados := coalesce(p_dados, '{}');

  FOR v_campo IN SELECT * FROM jsonb_array_elements(v_tipo.campos) LOOP
    IF coalesce((v_campo->>'obrigatorio')::boolean, false) AND public._valor_vazio(p_dados->(v_campo->>'id')) THEN
      RAISE EXCEPTION 'Campo obrigatório: %', v_campo->>'rotulo' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  IF p_tipo = 'atividades_complementares' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(p_dados->'itens', '[]')) LOOP
      IF public._valor_vazio(v_item->'descricao') OR coalesce((v_item->>'horas_declaradas')::numeric, 0) <= 0
         OR public._valor_vazio(v_item->'anexo_path') THEN
        RAISE EXCEPTION 'Cada atividade precisa de descrição, carga horária e certificado' USING ERRCODE = '22023';
      END IF;
    END LOOP;
  END IF;
  IF p_tipo = 'segunda_chamada' AND NOT public._valor_vazio(p_dados->'data_avaliacao')
     AND (p_dados->>'data_avaliacao')::date > public._hoje() THEN
    RAISE EXCEPTION 'A data da avaliação perdida não pode ser futura' USING ERRCODE = '22023';
  END IF;
  IF p_tipo = 'abono_faltas' AND (p_dados->>'data_fim')::date < (p_dados->>'data_inicio')::date THEN
    RAISE EXCEPTION 'A data final deve ser igual ou posterior à inicial' USING ERRCODE = '22023';
  END IF;
  IF NOT public._valor_vazio(p_dados->'materia_id') AND NOT EXISTS (
       SELECT 1 FROM public.turma_materias WHERE turma_id = v_aluno.turma_id AND materia_id::text = p_dados->>'materia_id') THEN
    RAISE EXCEPTION 'Disciplina não pertence à sua turma' USING ERRCODE = '22023';
  END IF;
  -- Guarda os nomes vigentes na abertura (exibição e registro histórico).
  p_dados := p_dados || jsonb_strip_nulls(jsonb_build_object(
    'materia_nome', (SELECT nome FROM public.materias WHERE id::text = p_dados->>'materia_id'),
    'professor_nome', (SELECT nome FROM public.professores WHERE id::text = p_dados->>'professor_id'),
    'orientador_nome', (SELECT nome FROM public.professores WHERE id::text = p_dados->>'orientador_id'),
    'disciplinas_nomes', (SELECT jsonb_agg(m.nome ORDER BY m.nome) FROM public.materias m
                           WHERE jsonb_typeof(p_dados->'disciplinas') = 'array'
                             AND m.id::text IN (SELECT jsonb_array_elements_text(p_dados->'disciplinas')))));

  PERFORM pg_advisory_xact_lock(hashtext('protocolo_numero_' || v_ano));
  SELECT v_ano || '.' || lpad((coalesce(max(split_part(numero, '.', 2)::int), 0) + 1)::text, 6, '0')
    INTO v_numero FROM public.protocolos WHERE numero LIKE v_ano || '.%';

  v_etapa := v_tipo.etapas->0;
  v_prazo := v_tipo.prazo_regimental;
  IF v_prazo IS NOT NULL AND NOT public._valor_vazio(p_dados->(v_prazo->>'campo')) THEN
    v_data_ref := (p_dados->>(v_prazo->>'campo'))::date;
  END IF;

  INSERT INTO public.protocolos (id, numero, tipo_id, aluno_id, curso_id, turma_id, dados, status, etapa_atual, setor_atual,
                                 fora_do_prazo, prazo_resposta_em)
  VALUES (p_id, v_numero, v_tipo.id, v_aluno.id, v_aluno.curso_id, v_aluno.turma_id, p_dados, 'aberto', 1, v_etapa->>'setor',
          v_data_ref IS NOT NULL AND public._hoje() > public.dias_uteis_apos(v_data_ref, (v_prazo->>'dias_uteis')::int),
          public.dias_uteis_apos(public._hoje(), v_tipo.prazo_resposta_dias_uteis))
  RETURNING * INTO v_p;

  INSERT INTO public.protocolo_tramites (protocolo_id, etapa, setor_id, acao, parecer, visivel_aluno, user_id)
  VALUES (v_p.id, 0, NULL, 'abertura', 'Protocolo aberto pelo aluno.', true, auth.uid())
  RETURNING id INTO v_tramite;

  v_cont := public._protocolo_gravar_anexos(v_p, v_tipo, p_anexos, v_tramite, false);
  FOR v_def IN SELECT * FROM jsonb_array_elements(v_tipo.anexos) LOOP
    IF coalesce((v_def->>'obrigatorio')::boolean, false) AND coalesce((v_cont->>(v_def->>'id'))::int, 0) = 0 THEN
      RAISE EXCEPTION 'Anexo obrigatório: %', v_def->>'rotulo' USING ERRCODE = '22023';
    END IF;
    IF NOT coalesce((v_def->>'multiplo')::boolean, false) AND coalesce((v_cont->>(v_def->>'id'))::int, 0) > 1 THEN
      RAISE EXCEPTION 'Envie apenas um arquivo em: %', v_def->>'rotulo' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  IF p_tipo = 'atividades_complementares' AND EXISTS (
       SELECT 1 FROM jsonb_array_elements(p_dados->'itens') i
        WHERE NOT EXISTS (SELECT 1 FROM public.protocolo_anexos a WHERE a.protocolo_id = v_p.id AND a.storage_path = i->>'anexo_path')) THEN
    RAISE EXCEPTION 'Certificado de uma atividade não foi enviado' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.academico_audit_logs (user_id, acao, entidade, entidade_id, new_data)
  VALUES (auth.uid(), 'abrir', 'protocolos', v_p.id::text, to_jsonb(v_p));

  PERFORM public._notificar_setor(v_p, 'Novo protocolo ' || v_numero, v_tipo.nome || ' — ' || v_aluno.nome);
  PERFORM public._documento_criar('comprovante_protocolo', v_p.id, '{}'::jsonb);

  RETURN jsonb_build_object('id', v_p.id, 'numero', v_numero, 'fora_do_prazo', v_p.fora_do_prazo);
END;
$$;

CREATE OR REPLACE FUNCTION public.protocolo_tramitar(p_id uuid, p_acao text, p_parecer text, p_dados jsonb, p_setor_destino text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_p public.protocolos;
  v_old public.protocolos;
  v_tipo public.protocolo_tipos;
  v_aluno public.alunos;
  v_etapa jsonb;
  v_prox jsonb;
  v_regra text;
  v_campo jsonb;
  v_item jsonb;
  v_orig jsonb;
  v_cat public.ac_categorias;
  v_usado numeric;
  v_horas numeric;
  v_fim text; -- NULL | 'deferido' | 'indeferido'
  v_msg text;
  v_doc text;
BEGIN
  p_dados := coalesce(p_dados, '{}');
  SELECT * INTO v_p FROM public.protocolos WHERE id = p_id FOR UPDATE;
  IF v_p.id IS NULL THEN
    RAISE EXCEPTION 'Protocolo não encontrado' USING ERRCODE = '42501';
  END IF;
  v_old := v_p;
  IF NOT public.pode_atuar_setor(v_p.setor_atual, v_p.curso_id) THEN
    RAISE EXCEPTION 'Você não pode tramitar protocolos deste setor' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_tipo FROM public.protocolo_tipos WHERE id = v_p.tipo_id;
  SELECT * INTO v_aluno FROM public.alunos WHERE id = v_p.aluno_id;
  v_etapa := v_tipo.etapas->(v_p.etapa_atual - 1);

  IF p_acao = 'comentar' THEN
    IF coalesce(trim(p_parecer), '') = '' THEN
      RAISE EXCEPTION 'Escreva o comentário' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.protocolo_tramites (protocolo_id, etapa, setor_id, acao, parecer, visivel_aluno, user_id)
    VALUES (v_p.id, v_p.etapa_atual, v_p.setor_atual, 'comentar', trim(p_parecer),
            coalesce((p_dados->>'visivel_aluno')::boolean, false), auth.uid());
    IF coalesce((p_dados->>'visivel_aluno')::boolean, false) THEN
      PERFORM public._notificar_aluno(v_p, 'Novo comentário no protocolo ' || v_p.numero, trim(p_parecer));
    END IF;
    RETURN jsonb_build_object('status', v_p.status);
  END IF;

  IF v_p.status NOT IN ('aberto','em_analise') THEN
    RAISE EXCEPTION 'Protocolo não está em análise (situação: %)', v_p.status USING ERRCODE = '22023';
  END IF;
  IF v_etapa IS NULL OR NOT (v_etapa->'acoes' ? p_acao) THEN
    RAISE EXCEPTION 'Ação não permitida nesta etapa' USING ERRCODE = '22023';
  END IF;
  IF p_acao IN ('indeferir','solicitar_complementacao') AND coalesce(trim(p_parecer), '') = '' THEN
    RAISE EXCEPTION 'O parecer é obrigatório para esta ação' USING ERRCODE = '22023';
  END IF;
  FOR v_campo IN SELECT * FROM jsonb_array_elements(coalesce(v_etapa->'campos_acao', '[]')) LOOP
    IF v_campo->>'acao' = p_acao AND coalesce((v_campo->>'obrigatorio')::boolean, false)
       AND public._valor_vazio(p_dados->(v_campo->>'id')) THEN
      RAISE EXCEPTION 'Campo obrigatório: %', v_campo->>'rotulo' USING ERRCODE = '22023';
    END IF;
  END LOOP;

  -- Registra o trâmite na etapa/setor em que a ação foi tomada.
  INSERT INTO public.protocolo_tramites (protocolo_id, etapa, setor_id, acao, parecer, dados, visivel_aluno, user_id)
  VALUES (v_p.id, v_p.etapa_atual, v_p.setor_atual, p_acao, nullif(trim(p_parecer), ''), p_dados, true, auth.uid());

  IF p_acao = 'solicitar_complementacao' THEN
    UPDATE public.protocolos SET status = 'aguardando_aluno',
           prazo_resposta_em = public.dias_uteis_apos(public._hoje(), v_tipo.prazo_resposta_dias_uteis), updated_at = now()
     WHERE id = v_p.id RETURNING * INTO v_p;
    PERFORM public._notificar_aluno(v_p, 'Complementação solicitada — ' || v_p.numero, trim(p_parecer));

  ELSIF p_acao = 'indeferir' THEN
    v_fim := 'indeferido';

  ELSIF p_acao = 'encaminhar' THEN
    IF p_setor_destino IS NULL OR p_setor_destino = v_p.setor_atual
       OR NOT EXISTS (SELECT 1 FROM public.setores WHERE id = p_setor_destino AND ativo) THEN
      RAISE EXCEPTION 'Escolha um setor de destino válido' USING ERRCODE = '22023';
    END IF;
    UPDATE public.protocolos SET etapa_atual = LEAST(etapa_atual + 1, jsonb_array_length(v_tipo.etapas)),
           setor_atual = p_setor_destino, status = 'em_analise', updated_at = now()
     WHERE id = v_p.id RETURNING * INTO v_p;
    PERFORM public._notificar_setor(v_p, 'Protocolo encaminhado — ' || v_p.numero, v_tipo.nome || ' — ' || v_aluno.nome);
    PERFORM public._notificar_aluno(v_p, 'Protocolo ' || v_p.numero || ' encaminhado',
      'Seu protocolo foi encaminhado para ' || (SELECT nome FROM public.setores WHERE id = p_setor_destino) || '.');

  ELSE -- deferir | concluir
    v_regra := coalesce(v_etapa->>CASE WHEN p_acao = 'concluir' THEN 'ao_concluir' ELSE 'ao_deferir' END, 'encerrar');

    -- Efeitos intermediários
    IF v_tipo.id = 'tcc_final' AND p_dados ? 'nota_homologada' THEN
      v_p.dados := v_p.dados || jsonb_build_object('nota_homologada', (p_dados->>'nota_homologada')::numeric);
    END IF;
    IF v_tipo.id = 'segunda_chamada' AND p_acao = 'concluir' THEN
      v_p.dados := v_p.dados || jsonb_build_object('agendamento', p_dados);
    END IF;
    IF v_tipo.id = 'atividades_complementares' THEN
      IF jsonb_array_length(coalesce(p_dados->'itens', '[]')) <> jsonb_array_length(coalesce(v_p.dados->'itens', '[]')) THEN
        RAISE EXCEPTION 'Avalie todas as atividades' USING ERRCODE = '22023';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_dados->'itens') i
                      WHERE coalesce((i->>'autentico')::boolean, false) AND coalesce((i->>'horas_deferidas')::numeric, 0) > 0) THEN
        RAISE EXCEPTION 'Nenhuma hora foi deferida. Para recusar todas as atividades, use Indeferir.' USING ERRCODE = '22023';
      END IF;
      FOR v_item IN SELECT * FROM jsonb_array_elements(p_dados->'itens') LOOP
        v_orig := v_p.dados->'itens'->((v_item->>'indice')::int);
        v_horas := coalesce((v_item->>'horas_deferidas')::numeric, 0);
        IF v_orig IS NULL THEN
          RAISE EXCEPTION 'Atividade inexistente' USING ERRCODE = '22023';
        END IF;
        CONTINUE WHEN NOT coalesce((v_item->>'autentico')::boolean, false) OR v_horas <= 0;
        IF v_horas > (v_orig->>'horas_declaradas')::numeric THEN
          RAISE EXCEPTION 'Horas deferidas acima das declaradas em "%"', v_orig->>'descricao' USING ERRCODE = '22023';
        END IF;
        SELECT * INTO v_cat FROM public.ac_categorias WHERE id = v_item->>'categoria_id' AND ativo;
        IF v_cat.id IS NULL THEN
          RAISE EXCEPTION 'Escolha a categoria de "%"', v_orig->>'descricao' USING ERRCODE = '22023';
        END IF;
        SELECT coalesce(sum(horas_deferidas), 0) INTO v_usado FROM public.aluno_horas_complementares
         WHERE aluno_id = v_p.aluno_id AND categoria_id = v_cat.id;
        IF v_usado + v_horas > v_cat.limite_horas THEN
          RAISE EXCEPTION 'Limite da categoria "%" excedido: restam % h', v_cat.nome, greatest(v_cat.limite_horas - v_usado, 0) USING ERRCODE = '22023';
        END IF;
        INSERT INTO public.aluno_horas_complementares (aluno_id, protocolo_id, categoria_id, descricao, emissor, data_atividade, horas_declaradas, horas_deferidas)
        VALUES (v_p.aluno_id, v_p.id, v_cat.id, v_orig->>'descricao', v_orig->>'emissor',
                nullif(v_orig->>'data', '')::date, (v_orig->>'horas_declaradas')::numeric, v_horas);
      END LOOP;
    END IF;

    v_prox := v_tipo.etapas->(v_p.etapa_atual);
    IF v_regra = 'proxima' AND v_prox IS NOT NULL AND v_prox->>'setor' <> '*' THEN
      UPDATE public.protocolos SET etapa_atual = etapa_atual + 1, setor_atual = v_prox->>'setor',
             status = 'em_analise', dados = v_p.dados, updated_at = now()
       WHERE id = v_p.id RETURNING * INTO v_p;
      PERFORM public._notificar_setor(v_p, 'Protocolo para sua etapa — ' || v_p.numero, v_tipo.nome || ' — ' || v_aluno.nome);
      PERFORM public._notificar_aluno(v_p, 'Protocolo ' || v_p.numero || ' avançou', 'Etapa atual: ' || coalesce(v_prox->>'nome', v_prox->>'setor') || '.');
    ELSE
      v_fim := 'deferido';
    END IF;
  END IF;

  IF v_fim IS NOT NULL THEN
    UPDATE public.protocolos SET status = CASE WHEN v_fim = 'deferido' THEN 'concluido' ELSE 'indeferido' END,
           decisao = v_fim, parecer_final = nullif(trim(p_parecer), ''), concluido_em = now(),
           dados = v_p.dados, updated_at = now()
     WHERE id = v_p.id RETURNING * INTO v_p;

    IF v_fim = 'deferido' THEN
      IF v_tipo.id = 'tcc_projeto' THEN
        INSERT INTO public.aluno_tcc (aluno_id, titulo, orientador_id, situacao, protocolo_projeto_id)
        VALUES (v_p.aluno_id, v_p.dados->>'titulo', nullif(v_p.dados->>'orientador_id', '')::uuid, 'projeto_aceito', v_p.id)
        ON CONFLICT (aluno_id) DO UPDATE SET titulo = EXCLUDED.titulo, orientador_id = EXCLUDED.orientador_id,
          situacao = 'projeto_aceito', protocolo_projeto_id = EXCLUDED.protocolo_projeto_id, updated_at = now();
      ELSIF v_tipo.id = 'tcc_final' THEN
        INSERT INTO public.aluno_tcc (aluno_id, titulo, orientador_id, situacao, nota_final, protocolo_final_id, homologado_em)
        VALUES (v_p.aluno_id, v_p.dados->>'titulo_final', nullif(v_p.dados->>'orientador_id', '')::uuid, 'concluido',
                (v_p.dados->>'nota_homologada')::numeric, v_p.id, now())
        ON CONFLICT (aluno_id) DO UPDATE SET titulo = EXCLUDED.titulo, orientador_id = EXCLUDED.orientador_id,
          situacao = 'concluido', nota_final = EXCLUDED.nota_final, protocolo_final_id = EXCLUDED.protocolo_final_id,
          homologado_em = now(), updated_at = now();
      ELSIF v_tipo.id = 'segunda_chamada' THEN
        INSERT INTO public.notificacoes (destino_role, professor_id, tipo, titulo, mensagem)
        SELECT 'professor', pr.id, 'segunda_chamada', 'Segunda chamada agendada',
               v_aluno.nome || ' (' || v_aluno.matricula || ') — ' || coalesce(m.nome, 'disciplina') || ': '
               || to_char((v_p.dados#>>'{agendamento,data_prova}')::date, 'DD/MM/YYYY') || ' às '
               || coalesce(v_p.dados#>>'{agendamento,horario}', '') || ', ' || coalesce(v_p.dados#>>'{agendamento,local}', '') || '.'
          FROM public.professores pr
          LEFT JOIN public.materias m ON m.id = nullif(v_p.dados->>'materia_id', '')::uuid
         WHERE pr.id = nullif(v_p.dados->>'professor_id', '')::uuid;
      ELSIF v_tipo.id = 'abono_faltas' THEN
        -- O professor recebe só o período abonado, nunca o atestado.
        INSERT INTO public.notificacoes (destino_role, professor_id, tipo, titulo, mensagem)
        SELECT DISTINCT 'professor', h.professor_id, 'abono_faltas', 'Falta abonada',
               v_aluno.nome || ' (' || v_aluno.matricula || ') teve falta abonada de '
               || to_char((v_p.dados->>'data_inicio')::date, 'DD/MM/YYYY') || ' a '
               || to_char((v_p.dados->>'data_fim')::date, 'DD/MM/YYYY')
               || '. Registre o abono ou combine a compensação das atividades.'
          FROM public.horarios_aula h
         WHERE h.turma_id = v_p.turma_id
           AND h.materia_id::text IN (SELECT jsonb_array_elements_text(coalesce(v_p.dados->'disciplinas', '[]')));
      END IF;
    END IF;

    v_msg := CASE WHEN v_fim = 'deferido' THEN 'Seu protocolo foi deferido.' ELSE 'Seu protocolo foi indeferido.' END
             || coalesce(' Parecer: ' || nullif(trim(p_parecer), ''), '');
    PERFORM public._notificar_aluno(v_p, 'Protocolo ' || v_p.numero || ' ' || v_fim, v_msg);

    v_doc := CASE WHEN v_fim = 'deferido' THEN coalesce(v_tipo.gera_documento, 'parecer_protocolo') ELSE 'parecer_protocolo' END;
    PERFORM public._documento_criar(v_doc, v_p.id, '{}'::jsonb);
  END IF;

  INSERT INTO public.academico_audit_logs (user_id, acao, entidade, entidade_id, old_data, new_data)
  VALUES (auth.uid(), p_acao, 'protocolos', v_p.id::text, to_jsonb(v_old), to_jsonb(v_p));

  RETURN jsonb_build_object('status', v_p.status, 'etapa_atual', v_p.etapa_atual, 'setor_atual', v_p.setor_atual);
END;
$$;

-- ── Grants ────────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public._notificar_setor(public.protocolos, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.setores_sem_responsavel() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.setores_sem_responsavel() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.aluno_pre_validar(text, text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aluno_pre_validar(text, text, date) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.documento_validar(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.documento_validar(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public._hoje() TO authenticated;


-- ===== 20261107120000_dados_femaf_2026_2.sql =====
-- ════════════════════════════════════════════════════════════════════════
--  FEMAF — Faculdade de Educação Memorial Adelaide Franco (Pedreiras-MA)
--  Carga inicial do semestre letivo 2026.2
--  Fontes: Mapeamento de Disciplinas 2026.2 (Engenharia Civil),
--          Horário 2026.2 Pedagogia e Horário 2026.2 Psicologia.
--  Idempotente: pode ser executada mais de uma vez sem duplicar registros.
-- ════════════════════════════════════════════════════════════════════════

-- Cursos, cerca de GPS (Pedreiras-MA) e cor institucional nas configurações globais
INSERT INTO public.app_settings (id, data) VALUES ('global', '{}'::jsonb) ON CONFLICT (id) DO NOTHING;
UPDATE public.app_settings
   SET data = data || jsonb_build_object(
         'cursos', jsonb_build_array(
            jsonb_build_object('id','eng','nome','Engenharia Civil'),
            jsonb_build_object('id','ped','nome','Pedagogia'),
            jsonb_build_object('id','psi','nome','Psicologia')),
         'primary_hsl', '246 76% 28%',
         'geofence', COALESCE(data->'geofence', '{}'::jsonb) || jsonb_build_object('lat', -4.5635410, 'lng', -44.5994555, 'raio_m', 900)),
       updated_at = now()
 WHERE id = 'global';

-- Professores (nomes conforme os horários; completar CPF, PIX, e-mail e valor da hora-aula no painel)
INSERT INTO public.professores (nome, status, valor_hora_aula)
SELECT v.nome, 'ativo', 0 FROM (VALUES
  ('Andréia'),
  ('Claudielli'),
  ('Cleomar'),
  ('Cristhiane'),
  ('Diracy'),
  ('Débora'),
  ('Edma'),
  ('Ernesto'),
  ('Evaldo'),
  ('Fatiana'),
  ('Fernanda'),
  ('Glenda'),
  ('Isis'),
  ('José Lins'),
  ('Keila'),
  ('Magno'),
  ('Mayara'),
  ('Rayssa'),
  ('Tássia'),
  ('Valquíria'),
  ('Vanessa'),
  ('Waldirene')
) AS v(nome)
WHERE NOT EXISTS (SELECT 1 FROM public.professores p WHERE lower(p.nome) = lower(v.nome));

-- Turmas
INSERT INTO public.turmas (nome, curso_id, periodo, turno)
SELECT v.nome, v.curso, v.periodo, 'Noturno' FROM (VALUES
  ('ENG 2º Período', 'eng', '2º Período'),
  ('ENG 4º Período', 'eng', '4º Período'),
  ('ENG 6º Período', 'eng', '6º Período'),
  ('PED 2º Período', 'ped', '2º Período'),
  ('PED 4º Período', 'ped', '4º Período'),
  ('PED 6º Período', 'ped', '6º Período'),
  ('PED 8º Período', 'ped', '8º Período'),
  ('PSI 2º Período', 'psi', '2º Período'),
  ('PSI 4º Período', 'psi', '4º Período'),
  ('PSI 6º Período', 'psi', '6º Período'),
  ('PSI 8º Período', 'psi', '8º Período'),
  ('PSI 10º Período', 'psi', '10º Período')
) AS v(nome, curso, periodo)
WHERE NOT EXISTS (SELECT 1 FROM public.turmas t WHERE t.nome = v.nome);

-- Disciplinas (carga horária total do semestre)
INSERT INTO public.materias (nome, curso_id, carga_horaria_total)
SELECT v.nome, v.curso, v.ch FROM (VALUES
  ('Cálculo II', 'eng', 80),
  ('Álgebra Linear e Geometria Analítica', 'eng', 80),
  ('Química Geral e Tecnológica', 'eng', 80),
  ('Física: Eletricidade e Magnetismo', 'eng', 80),
  ('Metodologia da Pesquisa Científica', 'eng', 40),
  ('Materiais de Construção II', 'eng', 80),
  ('Teoria das Estruturas I', 'eng', 60),
  ('Desenho Técnico II', 'eng', 80),
  ('Resistência dos Materiais', 'eng', 80),
  ('Cálculo Avançado', 'eng', 60),
  ('Estruturas de Concreto Armado I', 'eng', 80),
  ('Instalações Prediais II', 'eng', 80),
  ('Economia Aplicada à Engenharia', 'eng', 60),
  ('Geologia', 'eng', 60),
  ('Avaliações e Perícias de Engenharia', 'eng', 80),
  ('Didática', 'ped', 80),
  ('Educação Infantil: Concepções e Práticas', 'ped', 60),
  ('Psicologia da Aprendizagem', 'ped', 60),
  ('História da Educação', 'ped', 60),
  ('Leitura e Produção Textual', 'ped', 60),
  ('Sociologia da Educação', 'ped', 60),
  ('Planejamento Educacional', 'ped', 60),
  ('Escola e Currículo', 'ped', 60),
  ('Didática para o Ensino de História e Geografia', 'ped', 80),
  ('Didática para o Ensino de Língua Portuguesa', 'ped', 80),
  ('Fundamentos Teórico-Metodológicos do Ensino da Arte', 'ped', 80),
  ('Seminário Temático II', 'ped', 30),
  ('Avaliação da Educação e da Aprendizagem', 'ped', 80),
  ('LIBRAS', 'ped', 60),
  ('Estágio Supervisionado na Educação Escolar e Não Escolar', 'ped', 100),
  ('Coordenação Pedagógica', 'ped', 60),
  ('Psicomotricidade e Educação', 'ped', 60),
  ('Optativa I', 'ped', 0),
  ('Cultura Brasileira e Diversidade Étnico-Racial', 'ped', 0),
  ('Seminário Temático IV', 'ped', 30),
  ('TCC II', 'ped', 60),
  ('Estágio Supervisionado na Educação de Jovens e Adultos', 'ped', 80),
  ('Pedagogia e Empreendedorismo', 'ped', 60),
  ('Optativa III – Educação Comparada', 'ped', 40),
  ('Direitos Humanos', 'ped', 60),
  ('Seminário Temático VI', 'ped', 0),
  ('Antropologia', 'psi', 80),
  ('Psicologia da Infância e Adolescência', 'psi', 80),
  ('Psicologia da Personalidade', 'psi', 80),
  ('Processos Psicológicos Básicos', 'psi', 80),
  ('Ética Profissional', 'psi', 80),
  ('Psicologia e Processos de Aprendizagem', 'psi', 80),
  ('Direitos Humanos e Relações Étnico-Raciais', 'psi', 80),
  ('Psicopatologia Geral', 'psi', 80),
  ('Psicologia e Inclusão', 'psi', 80),
  ('Psicologia Organizacional e do Trabalho', 'psi', 80),
  ('Estágio Básico II – Psicologia Escolar', 'psi', 120),
  ('Técnicas de Avaliação Psicológica', 'psi', 80),
  ('Psicologia Escolar', 'psi', 80),
  ('Psicologia Social', 'psi', 80),
  ('Intervenções em Terapia Familiar', 'psi', 80),
  ('Estudos Avançados em Psicologia da Saúde', 'psi', 100),
  ('Optativa I', 'psi', 80),
  ('Estudos Avançados em Processos Clínicos', 'psi', 100),
  ('Psicologia Jurídica', 'psi', 80),
  ('Trabalho de Conclusão de Curso I – TCC', 'psi', 80),
  ('Trabalho de Conclusão de Curso II', 'psi', 80),
  ('Estágio Supervisionado Específico II: Ênfase em Processos Clínicos', 'psi', 0),
  ('Supervisão Clínica – Terapia Cognitivo-Comportamental', 'psi', 0),
  ('Supervisão Clínica – Análise do Comportamento', 'psi', 0),
  ('Supervisão Clínica – Psicanálise', 'psi', 0),
  ('Supervisão Clínica – Teorias Humanistas', 'psi', 0)
) AS v(nome, curso, ch)
WHERE NOT EXISTS (SELECT 1 FROM public.materias m WHERE m.nome = v.nome AND m.curso_id = v.curso);

-- Disciplinas de cada turma
INSERT INTO public.turma_materias (turma_id, materia_id)
SELECT t.id, m.id FROM (VALUES
  ('ENG 2º Período', 'Cálculo II', 'eng'),
  ('ENG 2º Período', 'Álgebra Linear e Geometria Analítica', 'eng'),
  ('ENG 2º Período', 'Química Geral e Tecnológica', 'eng'),
  ('ENG 2º Período', 'Física: Eletricidade e Magnetismo', 'eng'),
  ('ENG 2º Período', 'Metodologia da Pesquisa Científica', 'eng'),
  ('ENG 4º Período', 'Materiais de Construção II', 'eng'),
  ('ENG 4º Período', 'Teoria das Estruturas I', 'eng'),
  ('ENG 4º Período', 'Desenho Técnico II', 'eng'),
  ('ENG 4º Período', 'Resistência dos Materiais', 'eng'),
  ('ENG 4º Período', 'Cálculo Avançado', 'eng'),
  ('ENG 6º Período', 'Estruturas de Concreto Armado I', 'eng'),
  ('ENG 6º Período', 'Instalações Prediais II', 'eng'),
  ('ENG 6º Período', 'Economia Aplicada à Engenharia', 'eng'),
  ('ENG 6º Período', 'Geologia', 'eng'),
  ('ENG 6º Período', 'Avaliações e Perícias de Engenharia', 'eng'),
  ('PED 2º Período', 'Didática', 'ped'),
  ('PED 2º Período', 'Educação Infantil: Concepções e Práticas', 'ped'),
  ('PED 2º Período', 'Psicologia da Aprendizagem', 'ped'),
  ('PED 2º Período', 'História da Educação', 'ped'),
  ('PED 2º Período', 'Leitura e Produção Textual', 'ped'),
  ('PED 2º Período', 'Sociologia da Educação', 'ped'),
  ('PED 4º Período', 'Planejamento Educacional', 'ped'),
  ('PED 4º Período', 'Escola e Currículo', 'ped'),
  ('PED 4º Período', 'Didática para o Ensino de História e Geografia', 'ped'),
  ('PED 4º Período', 'Didática para o Ensino de Língua Portuguesa', 'ped'),
  ('PED 4º Período', 'Fundamentos Teórico-Metodológicos do Ensino da Arte', 'ped'),
  ('PED 4º Período', 'Seminário Temático II', 'ped'),
  ('PED 6º Período', 'Avaliação da Educação e da Aprendizagem', 'ped'),
  ('PED 6º Período', 'LIBRAS', 'ped'),
  ('PED 6º Período', 'Estágio Supervisionado na Educação Escolar e Não Escolar', 'ped'),
  ('PED 6º Período', 'Coordenação Pedagógica', 'ped'),
  ('PED 6º Período', 'Psicomotricidade e Educação', 'ped'),
  ('PED 6º Período', 'Optativa I', 'ped'),
  ('PED 6º Período', 'Cultura Brasileira e Diversidade Étnico-Racial', 'ped'),
  ('PED 6º Período', 'Seminário Temático IV', 'ped'),
  ('PED 8º Período', 'TCC II', 'ped'),
  ('PED 8º Período', 'Estágio Supervisionado na Educação de Jovens e Adultos', 'ped'),
  ('PED 8º Período', 'Pedagogia e Empreendedorismo', 'ped'),
  ('PED 8º Período', 'Optativa III – Educação Comparada', 'ped'),
  ('PED 8º Período', 'Direitos Humanos', 'ped'),
  ('PED 8º Período', 'Seminário Temático VI', 'ped'),
  ('PSI 2º Período', 'Antropologia', 'psi'),
  ('PSI 2º Período', 'Psicologia da Infância e Adolescência', 'psi'),
  ('PSI 2º Período', 'Psicologia da Personalidade', 'psi'),
  ('PSI 2º Período', 'Processos Psicológicos Básicos', 'psi'),
  ('PSI 2º Período', 'Ética Profissional', 'psi'),
  ('PSI 4º Período', 'Psicologia e Processos de Aprendizagem', 'psi'),
  ('PSI 4º Período', 'Direitos Humanos e Relações Étnico-Raciais', 'psi'),
  ('PSI 4º Período', 'Psicopatologia Geral', 'psi'),
  ('PSI 4º Período', 'Psicologia e Inclusão', 'psi'),
  ('PSI 4º Período', 'Psicologia Organizacional e do Trabalho', 'psi'),
  ('PSI 6º Período', 'Estágio Básico II – Psicologia Escolar', 'psi'),
  ('PSI 6º Período', 'Técnicas de Avaliação Psicológica', 'psi'),
  ('PSI 6º Período', 'Psicologia Escolar', 'psi'),
  ('PSI 6º Período', 'Psicologia Social', 'psi'),
  ('PSI 6º Período', 'Intervenções em Terapia Familiar', 'psi'),
  ('PSI 8º Período', 'Estudos Avançados em Psicologia da Saúde', 'psi'),
  ('PSI 8º Período', 'Optativa I', 'psi'),
  ('PSI 8º Período', 'Estudos Avançados em Processos Clínicos', 'psi'),
  ('PSI 8º Período', 'Psicologia Jurídica', 'psi'),
  ('PSI 8º Período', 'Trabalho de Conclusão de Curso I – TCC', 'psi'),
  ('PSI 10º Período', 'Trabalho de Conclusão de Curso II', 'psi'),
  ('PSI 10º Período', 'Estágio Supervisionado Específico II: Ênfase em Processos Clínicos', 'psi'),
  ('PSI 10º Período', 'Supervisão Clínica – Terapia Cognitivo-Comportamental', 'psi'),
  ('PSI 10º Período', 'Supervisão Clínica – Análise do Comportamento', 'psi'),
  ('PSI 10º Período', 'Supervisão Clínica – Psicanálise', 'psi'),
  ('PSI 10º Período', 'Supervisão Clínica – Teorias Humanistas', 'psi')
) AS v(turma, materia, curso)
JOIN public.turmas t ON t.nome = v.turma
JOIN public.materias m ON m.nome = v.materia AND m.curso_id = v.curso
ON CONFLICT (turma_id, materia_id) DO NOTHING;

-- Professor responsável por cada disciplina
INSERT INTO public.professor_materias (professor_id, materia_id)
SELECT p.id, m.id FROM (VALUES
  ('Andréia', 'Coordenação Pedagógica', 'ped'),
  ('Andréia', 'Pedagogia e Empreendedorismo', 'ped'),
  ('Claudielli', 'Estudos Avançados em Psicologia da Saúde', 'psi'),
  ('Claudielli', 'Processos Psicológicos Básicos', 'psi'),
  ('Claudielli', 'Supervisão Clínica – Teorias Humanistas', 'psi'),
  ('Cleomar', 'Didática para o Ensino de Língua Portuguesa', 'ped'),
  ('Cleomar', 'Leitura e Produção Textual', 'ped'),
  ('Cristhiane', 'Escola e Currículo', 'ped'),
  ('Cristhiane', 'TCC II', 'ped'),
  ('Diracy', 'Avaliação da Educação e da Aprendizagem', 'ped'),
  ('Diracy', 'Educação Infantil: Concepções e Práticas', 'ped'),
  ('Diracy', 'Optativa III – Educação Comparada', 'ped'),
  ('Diracy', 'Seminário Temático II', 'ped'),
  ('Diracy', 'Seminário Temático IV', 'ped'),
  ('Diracy', 'Seminário Temático VI', 'ped'),
  ('Débora', 'Fundamentos Teórico-Metodológicos do Ensino da Arte', 'ped'),
  ('Débora', 'Optativa I', 'ped'),
  ('Débora', 'Planejamento Educacional', 'ped'),
  ('Débora', 'Sociologia da Educação', 'ped'),
  ('Edma', 'Optativa I', 'psi'),
  ('Edma', 'Trabalho de Conclusão de Curso I – TCC', 'psi'),
  ('Edma', 'Trabalho de Conclusão de Curso II', 'psi'),
  ('Ernesto', 'Antropologia', 'psi'),
  ('Ernesto', 'Direitos Humanos e Relações Étnico-Raciais', 'psi'),
  ('Evaldo', 'Estágio Supervisionado na Educação Escolar e Não Escolar', 'ped'),
  ('Fatiana', 'Psicologia da Aprendizagem', 'ped'),
  ('Fatiana', 'Psicomotricidade e Educação', 'ped'),
  ('Fernanda', 'Psicopatologia Geral', 'psi'),
  ('Fernanda', 'Supervisão Clínica – Análise do Comportamento', 'psi'),
  ('Glenda', 'Supervisão Clínica – Psicanálise', 'psi'),
  ('Isis', 'Estágio Básico II – Psicologia Escolar', 'psi'),
  ('Isis', 'Psicologia Escolar', 'psi'),
  ('Isis', 'Psicologia e Inclusão', 'psi'),
  ('José Lins', 'Psicologia da Personalidade', 'psi'),
  ('José Lins', 'Ética Profissional', 'psi'),
  ('Keila', 'Didática para o Ensino de História e Geografia', 'ped'),
  ('Keila', 'História da Educação', 'ped'),
  ('Magno', 'Cultura Brasileira e Diversidade Étnico-Racial', 'ped'),
  ('Magno', 'Direitos Humanos', 'ped'),
  ('Magno', 'LIBRAS', 'ped'),
  ('Mayara', 'Psicologia da Infância e Adolescência', 'psi'),
  ('Mayara', 'Psicologia e Processos de Aprendizagem', 'psi'),
  ('Rayssa', 'Psicologia Social', 'psi'),
  ('Rayssa', 'Técnicas de Avaliação Psicológica', 'psi'),
  ('Tássia', 'Intervenções em Terapia Familiar', 'psi'),
  ('Valquíria', 'Supervisão Clínica – Terapia Cognitivo-Comportamental', 'psi'),
  ('Vanessa', 'Estudos Avançados em Processos Clínicos', 'psi'),
  ('Vanessa', 'Psicologia Jurídica', 'psi'),
  ('Vanessa', 'Psicologia Organizacional e do Trabalho', 'psi'),
  ('Waldirene', 'Didática', 'ped'),
  ('Waldirene', 'Estágio Supervisionado na Educação de Jovens e Adultos', 'ped')
) AS v(professor, materia, curso)
JOIN public.professores p ON lower(p.nome) = lower(v.professor)
JOIN public.materias m ON m.nome = v.materia AND m.curso_id = v.curso
ON CONFLICT (professor_id, materia_id) DO NOTHING;

-- Grade fixa semanal (noturno, 1º ao 4º horário; dia_semana 1=Seg … 5=Sex).
-- Disciplinas sem dia fixo (sábados concentrados, seminários, optativas e supervisões) ficam sem grade e são lançadas pelo painel.
INSERT INTO public.horarios_aula (professor_id, materia_id, turma_id, dia_semana, horario_id)
SELECT p.id, m.id, t.id, v.dia, v.hor FROM (VALUES
  ('Waldirene', 'Didática', 'ped', 'PED 2º Período', 1, 1),
  ('Waldirene', 'Didática', 'ped', 'PED 2º Período', 1, 2),
  ('Waldirene', 'Didática', 'ped', 'PED 2º Período', 1, 3),
  ('Waldirene', 'Didática', 'ped', 'PED 2º Período', 1, 4),
  ('Diracy', 'Educação Infantil: Concepções e Práticas', 'ped', 'PED 2º Período', 2, 1),
  ('Diracy', 'Educação Infantil: Concepções e Práticas', 'ped', 'PED 2º Período', 2, 2),
  ('Diracy', 'Educação Infantil: Concepções e Práticas', 'ped', 'PED 2º Período', 2, 3),
  ('Diracy', 'Educação Infantil: Concepções e Práticas', 'ped', 'PED 2º Período', 2, 4),
  ('Fatiana', 'Psicologia da Aprendizagem', 'ped', 'PED 2º Período', 3, 1),
  ('Fatiana', 'Psicologia da Aprendizagem', 'ped', 'PED 2º Período', 3, 2),
  ('Fatiana', 'Psicologia da Aprendizagem', 'ped', 'PED 2º Período', 3, 3),
  ('Fatiana', 'Psicologia da Aprendizagem', 'ped', 'PED 2º Período', 3, 4),
  ('Keila', 'História da Educação', 'ped', 'PED 2º Período', 4, 1),
  ('Keila', 'História da Educação', 'ped', 'PED 2º Período', 4, 2),
  ('Keila', 'História da Educação', 'ped', 'PED 2º Período', 4, 3),
  ('Keila', 'História da Educação', 'ped', 'PED 2º Período', 4, 4),
  ('Cleomar', 'Leitura e Produção Textual', 'ped', 'PED 2º Período', 5, 1),
  ('Cleomar', 'Leitura e Produção Textual', 'ped', 'PED 2º Período', 5, 2),
  ('Cleomar', 'Leitura e Produção Textual', 'ped', 'PED 2º Período', 5, 3),
  ('Cleomar', 'Leitura e Produção Textual', 'ped', 'PED 2º Período', 5, 4),
  ('Débora', 'Planejamento Educacional', 'ped', 'PED 4º Período', 1, 1),
  ('Débora', 'Planejamento Educacional', 'ped', 'PED 4º Período', 1, 2),
  ('Débora', 'Planejamento Educacional', 'ped', 'PED 4º Período', 1, 3),
  ('Débora', 'Planejamento Educacional', 'ped', 'PED 4º Período', 1, 4),
  ('Cristhiane', 'Escola e Currículo', 'ped', 'PED 4º Período', 2, 1),
  ('Cristhiane', 'Escola e Currículo', 'ped', 'PED 4º Período', 2, 2),
  ('Cristhiane', 'Escola e Currículo', 'ped', 'PED 4º Período', 2, 3),
  ('Cristhiane', 'Escola e Currículo', 'ped', 'PED 4º Período', 2, 4),
  ('Keila', 'Didática para o Ensino de História e Geografia', 'ped', 'PED 4º Período', 3, 1),
  ('Keila', 'Didática para o Ensino de História e Geografia', 'ped', 'PED 4º Período', 3, 2),
  ('Keila', 'Didática para o Ensino de História e Geografia', 'ped', 'PED 4º Período', 3, 3),
  ('Keila', 'Didática para o Ensino de História e Geografia', 'ped', 'PED 4º Período', 3, 4),
  ('Cleomar', 'Didática para o Ensino de Língua Portuguesa', 'ped', 'PED 4º Período', 4, 1),
  ('Cleomar', 'Didática para o Ensino de Língua Portuguesa', 'ped', 'PED 4º Período', 4, 2),
  ('Cleomar', 'Didática para o Ensino de Língua Portuguesa', 'ped', 'PED 4º Período', 4, 3),
  ('Cleomar', 'Didática para o Ensino de Língua Portuguesa', 'ped', 'PED 4º Período', 4, 4),
  ('Débora', 'Fundamentos Teórico-Metodológicos do Ensino da Arte', 'ped', 'PED 4º Período', 5, 1),
  ('Débora', 'Fundamentos Teórico-Metodológicos do Ensino da Arte', 'ped', 'PED 4º Período', 5, 2),
  ('Débora', 'Fundamentos Teórico-Metodológicos do Ensino da Arte', 'ped', 'PED 4º Período', 5, 3),
  ('Débora', 'Fundamentos Teórico-Metodológicos do Ensino da Arte', 'ped', 'PED 4º Período', 5, 4),
  ('Diracy', 'Avaliação da Educação e da Aprendizagem', 'ped', 'PED 6º Período', 1, 1),
  ('Diracy', 'Avaliação da Educação e da Aprendizagem', 'ped', 'PED 6º Período', 1, 2),
  ('Diracy', 'Avaliação da Educação e da Aprendizagem', 'ped', 'PED 6º Período', 1, 3),
  ('Diracy', 'Avaliação da Educação e da Aprendizagem', 'ped', 'PED 6º Período', 1, 4),
  ('Magno', 'LIBRAS', 'ped', 'PED 6º Período', 2, 1),
  ('Magno', 'LIBRAS', 'ped', 'PED 6º Período', 2, 2),
  ('Magno', 'LIBRAS', 'ped', 'PED 6º Período', 2, 3),
  ('Magno', 'LIBRAS', 'ped', 'PED 6º Período', 2, 4),
  ('Evaldo', 'Estágio Supervisionado na Educação Escolar e Não Escolar', 'ped', 'PED 6º Período', 3, 1),
  ('Evaldo', 'Estágio Supervisionado na Educação Escolar e Não Escolar', 'ped', 'PED 6º Período', 3, 2),
  ('Evaldo', 'Estágio Supervisionado na Educação Escolar e Não Escolar', 'ped', 'PED 6º Período', 3, 3),
  ('Evaldo', 'Estágio Supervisionado na Educação Escolar e Não Escolar', 'ped', 'PED 6º Período', 3, 4),
  ('Andréia', 'Coordenação Pedagógica', 'ped', 'PED 6º Período', 4, 1),
  ('Andréia', 'Coordenação Pedagógica', 'ped', 'PED 6º Período', 4, 2),
  ('Andréia', 'Coordenação Pedagógica', 'ped', 'PED 6º Período', 4, 3),
  ('Andréia', 'Coordenação Pedagógica', 'ped', 'PED 6º Período', 4, 4),
  ('Fatiana', 'Psicomotricidade e Educação', 'ped', 'PED 6º Período', 5, 1),
  ('Fatiana', 'Psicomotricidade e Educação', 'ped', 'PED 6º Período', 5, 2),
  ('Fatiana', 'Psicomotricidade e Educação', 'ped', 'PED 6º Período', 5, 3),
  ('Fatiana', 'Psicomotricidade e Educação', 'ped', 'PED 6º Período', 5, 4),
  ('Cristhiane', 'TCC II', 'ped', 'PED 8º Período', 1, 1),
  ('Cristhiane', 'TCC II', 'ped', 'PED 8º Período', 1, 2),
  ('Cristhiane', 'TCC II', 'ped', 'PED 8º Período', 1, 3),
  ('Cristhiane', 'TCC II', 'ped', 'PED 8º Período', 1, 4),
  ('Waldirene', 'Estágio Supervisionado na Educação de Jovens e Adultos', 'ped', 'PED 8º Período', 2, 1),
  ('Waldirene', 'Estágio Supervisionado na Educação de Jovens e Adultos', 'ped', 'PED 8º Período', 2, 2),
  ('Waldirene', 'Estágio Supervisionado na Educação de Jovens e Adultos', 'ped', 'PED 8º Período', 2, 3),
  ('Waldirene', 'Estágio Supervisionado na Educação de Jovens e Adultos', 'ped', 'PED 8º Período', 2, 4),
  ('Andréia', 'Pedagogia e Empreendedorismo', 'ped', 'PED 8º Período', 3, 1),
  ('Andréia', 'Pedagogia e Empreendedorismo', 'ped', 'PED 8º Período', 3, 2),
  ('Andréia', 'Pedagogia e Empreendedorismo', 'ped', 'PED 8º Período', 3, 3),
  ('Andréia', 'Pedagogia e Empreendedorismo', 'ped', 'PED 8º Período', 3, 4),
  ('Diracy', 'Optativa III – Educação Comparada', 'ped', 'PED 8º Período', 4, 1),
  ('Diracy', 'Optativa III – Educação Comparada', 'ped', 'PED 8º Período', 4, 2),
  ('Diracy', 'Optativa III – Educação Comparada', 'ped', 'PED 8º Período', 4, 3),
  ('Diracy', 'Optativa III – Educação Comparada', 'ped', 'PED 8º Período', 4, 4),
  ('Magno', 'Direitos Humanos', 'ped', 'PED 8º Período', 5, 1),
  ('Magno', 'Direitos Humanos', 'ped', 'PED 8º Período', 5, 2),
  ('Magno', 'Direitos Humanos', 'ped', 'PED 8º Período', 5, 3),
  ('Magno', 'Direitos Humanos', 'ped', 'PED 8º Período', 5, 4),
  ('Ernesto', 'Antropologia', 'psi', 'PSI 2º Período', 1, 1),
  ('Ernesto', 'Antropologia', 'psi', 'PSI 2º Período', 1, 2),
  ('Ernesto', 'Antropologia', 'psi', 'PSI 2º Período', 1, 3),
  ('Ernesto', 'Antropologia', 'psi', 'PSI 2º Período', 1, 4),
  ('Mayara', 'Psicologia da Infância e Adolescência', 'psi', 'PSI 2º Período', 2, 1),
  ('Mayara', 'Psicologia da Infância e Adolescência', 'psi', 'PSI 2º Período', 2, 2),
  ('Mayara', 'Psicologia da Infância e Adolescência', 'psi', 'PSI 2º Período', 2, 3),
  ('Mayara', 'Psicologia da Infância e Adolescência', 'psi', 'PSI 2º Período', 2, 4),
  ('José Lins', 'Psicologia da Personalidade', 'psi', 'PSI 2º Período', 3, 1),
  ('José Lins', 'Psicologia da Personalidade', 'psi', 'PSI 2º Período', 3, 2),
  ('José Lins', 'Psicologia da Personalidade', 'psi', 'PSI 2º Período', 3, 3),
  ('José Lins', 'Psicologia da Personalidade', 'psi', 'PSI 2º Período', 3, 4),
  ('Claudielli', 'Processos Psicológicos Básicos', 'psi', 'PSI 2º Período', 4, 1),
  ('Claudielli', 'Processos Psicológicos Básicos', 'psi', 'PSI 2º Período', 4, 2),
  ('Claudielli', 'Processos Psicológicos Básicos', 'psi', 'PSI 2º Período', 4, 3),
  ('Claudielli', 'Processos Psicológicos Básicos', 'psi', 'PSI 2º Período', 4, 4),
  ('José Lins', 'Ética Profissional', 'psi', 'PSI 2º Período', 5, 1),
  ('José Lins', 'Ética Profissional', 'psi', 'PSI 2º Período', 5, 2),
  ('José Lins', 'Ética Profissional', 'psi', 'PSI 2º Período', 5, 3),
  ('José Lins', 'Ética Profissional', 'psi', 'PSI 2º Período', 5, 4),
  ('Mayara', 'Psicologia e Processos de Aprendizagem', 'psi', 'PSI 4º Período', 1, 1),
  ('Mayara', 'Psicologia e Processos de Aprendizagem', 'psi', 'PSI 4º Período', 1, 2),
  ('Mayara', 'Psicologia e Processos de Aprendizagem', 'psi', 'PSI 4º Período', 1, 3),
  ('Mayara', 'Psicologia e Processos de Aprendizagem', 'psi', 'PSI 4º Período', 1, 4),
  ('Ernesto', 'Direitos Humanos e Relações Étnico-Raciais', 'psi', 'PSI 4º Período', 2, 1),
  ('Ernesto', 'Direitos Humanos e Relações Étnico-Raciais', 'psi', 'PSI 4º Período', 2, 2),
  ('Ernesto', 'Direitos Humanos e Relações Étnico-Raciais', 'psi', 'PSI 4º Período', 2, 3),
  ('Ernesto', 'Direitos Humanos e Relações Étnico-Raciais', 'psi', 'PSI 4º Período', 2, 4),
  ('Fernanda', 'Psicopatologia Geral', 'psi', 'PSI 4º Período', 3, 1),
  ('Fernanda', 'Psicopatologia Geral', 'psi', 'PSI 4º Período', 3, 2),
  ('Fernanda', 'Psicopatologia Geral', 'psi', 'PSI 4º Período', 3, 3),
  ('Fernanda', 'Psicopatologia Geral', 'psi', 'PSI 4º Período', 3, 4),
  ('Isis', 'Psicologia e Inclusão', 'psi', 'PSI 4º Período', 4, 1),
  ('Isis', 'Psicologia e Inclusão', 'psi', 'PSI 4º Período', 4, 2),
  ('Isis', 'Psicologia e Inclusão', 'psi', 'PSI 4º Período', 4, 3),
  ('Isis', 'Psicologia e Inclusão', 'psi', 'PSI 4º Período', 4, 4),
  ('Vanessa', 'Psicologia Organizacional e do Trabalho', 'psi', 'PSI 4º Período', 5, 1),
  ('Vanessa', 'Psicologia Organizacional e do Trabalho', 'psi', 'PSI 4º Período', 5, 2),
  ('Vanessa', 'Psicologia Organizacional e do Trabalho', 'psi', 'PSI 4º Período', 5, 3),
  ('Vanessa', 'Psicologia Organizacional e do Trabalho', 'psi', 'PSI 4º Período', 5, 4),
  ('Isis', 'Estágio Básico II – Psicologia Escolar', 'psi', 'PSI 6º Período', 1, 1),
  ('Isis', 'Estágio Básico II – Psicologia Escolar', 'psi', 'PSI 6º Período', 1, 2),
  ('Isis', 'Estágio Básico II – Psicologia Escolar', 'psi', 'PSI 6º Período', 1, 3),
  ('Isis', 'Estágio Básico II – Psicologia Escolar', 'psi', 'PSI 6º Período', 1, 4),
  ('Rayssa', 'Técnicas de Avaliação Psicológica', 'psi', 'PSI 6º Período', 2, 1),
  ('Rayssa', 'Técnicas de Avaliação Psicológica', 'psi', 'PSI 6º Período', 2, 2),
  ('Rayssa', 'Técnicas de Avaliação Psicológica', 'psi', 'PSI 6º Período', 2, 3),
  ('Rayssa', 'Técnicas de Avaliação Psicológica', 'psi', 'PSI 6º Período', 2, 4),
  ('Isis', 'Psicologia Escolar', 'psi', 'PSI 6º Período', 3, 1),
  ('Isis', 'Psicologia Escolar', 'psi', 'PSI 6º Período', 3, 2),
  ('Isis', 'Psicologia Escolar', 'psi', 'PSI 6º Período', 3, 3),
  ('Isis', 'Psicologia Escolar', 'psi', 'PSI 6º Período', 3, 4),
  ('Rayssa', 'Psicologia Social', 'psi', 'PSI 6º Período', 4, 1),
  ('Rayssa', 'Psicologia Social', 'psi', 'PSI 6º Período', 4, 2),
  ('Rayssa', 'Psicologia Social', 'psi', 'PSI 6º Período', 4, 3),
  ('Rayssa', 'Psicologia Social', 'psi', 'PSI 6º Período', 4, 4),
  ('Tássia', 'Intervenções em Terapia Familiar', 'psi', 'PSI 6º Período', 5, 1),
  ('Tássia', 'Intervenções em Terapia Familiar', 'psi', 'PSI 6º Período', 5, 2),
  ('Tássia', 'Intervenções em Terapia Familiar', 'psi', 'PSI 6º Período', 5, 3),
  ('Tássia', 'Intervenções em Terapia Familiar', 'psi', 'PSI 6º Período', 5, 4),
  ('Claudielli', 'Estudos Avançados em Psicologia da Saúde', 'psi', 'PSI 8º Período', 1, 1),
  ('Claudielli', 'Estudos Avançados em Psicologia da Saúde', 'psi', 'PSI 8º Período', 1, 2),
  ('Claudielli', 'Estudos Avançados em Psicologia da Saúde', 'psi', 'PSI 8º Período', 1, 3),
  ('Claudielli', 'Estudos Avançados em Psicologia da Saúde', 'psi', 'PSI 8º Período', 1, 4),
  ('Edma', 'Optativa I', 'psi', 'PSI 8º Período', 2, 1),
  ('Edma', 'Optativa I', 'psi', 'PSI 8º Período', 2, 2),
  ('Edma', 'Optativa I', 'psi', 'PSI 8º Período', 2, 3),
  ('Edma', 'Optativa I', 'psi', 'PSI 8º Período', 2, 4),
  ('Vanessa', 'Estudos Avançados em Processos Clínicos', 'psi', 'PSI 8º Período', 3, 1),
  ('Vanessa', 'Estudos Avançados em Processos Clínicos', 'psi', 'PSI 8º Período', 3, 2),
  ('Vanessa', 'Estudos Avançados em Processos Clínicos', 'psi', 'PSI 8º Período', 3, 3),
  ('Vanessa', 'Estudos Avançados em Processos Clínicos', 'psi', 'PSI 8º Período', 3, 4),
  ('Vanessa', 'Psicologia Jurídica', 'psi', 'PSI 8º Período', 4, 1),
  ('Vanessa', 'Psicologia Jurídica', 'psi', 'PSI 8º Período', 4, 2),
  ('Vanessa', 'Psicologia Jurídica', 'psi', 'PSI 8º Período', 4, 3),
  ('Vanessa', 'Psicologia Jurídica', 'psi', 'PSI 8º Período', 4, 4),
  ('Edma', 'Trabalho de Conclusão de Curso I – TCC', 'psi', 'PSI 8º Período', 5, 1),
  ('Edma', 'Trabalho de Conclusão de Curso I – TCC', 'psi', 'PSI 8º Período', 5, 2),
  ('Edma', 'Trabalho de Conclusão de Curso I – TCC', 'psi', 'PSI 8º Período', 5, 3),
  ('Edma', 'Trabalho de Conclusão de Curso I – TCC', 'psi', 'PSI 8º Período', 5, 4),
  ('Edma', 'Trabalho de Conclusão de Curso II', 'psi', 'PSI 10º Período', 1, 1),
  ('Edma', 'Trabalho de Conclusão de Curso II', 'psi', 'PSI 10º Período', 1, 2),
  ('Edma', 'Trabalho de Conclusão de Curso II', 'psi', 'PSI 10º Período', 1, 3),
  ('Edma', 'Trabalho de Conclusão de Curso II', 'psi', 'PSI 10º Período', 1, 4)
) AS v(professor, materia, curso, turma, dia, hor)
JOIN public.professores p ON lower(p.nome) = lower(v.professor)
JOIN public.materias m ON m.nome = v.materia AND m.curso_id = v.curso
JOIN public.turmas t ON t.nome = v.turma
ON CONFLICT (professor_id, materia_id, turma_id, dia_semana, horario_id) DO NOTHING;

-- Feriados nacionais do semestre 2026.2 (feriados municipais de Pedreiras e o calendário de provas
-- devem ser cadastrados em Feriados & Ajustes conforme o calendário acadêmico da FEMAF)
INSERT INTO public.calendario_academico (data, tipo, descricao) VALUES
  ('2026-09-07','feriado','Independência do Brasil'),
  ('2026-10-12','feriado','Nossa Senhora Aparecida'),
  ('2026-11-02','feriado','Finados'),
  ('2026-11-15','feriado','Proclamação da República'),
  ('2026-11-20','feriado','Dia Nacional de Zumbi e da Consciência Negra'),
  ('2026-12-25','feriado','Natal')
ON CONFLICT (data) DO NOTHING;


-- ===== 20261107150000_localizacao_femaf.sql =====
-- Cerca de GPS do ponto: FEMAF – Av. Dr. João Alberto, 100, Residencial Maria Rita, Pedreiras-MA
-- (coordenada da Av. Dr. João Alberto no OpenStreetMap; raio de 900 m cobre toda a avenida)
UPDATE public.app_settings
   SET data = data || jsonb_build_object('geofence',
         COALESCE(data->'geofence', '{}'::jsonb)
         || jsonb_build_object('lat', -4.5635410, 'lng', -44.5994555, 'raio_m', 900,
                               'endereco', 'Av. Dr. João Alberto, 100 – Residencial Maria Rita, Pedreiras-MA, 65725-000')),
       updated_at = now()
 WHERE id = 'global';
