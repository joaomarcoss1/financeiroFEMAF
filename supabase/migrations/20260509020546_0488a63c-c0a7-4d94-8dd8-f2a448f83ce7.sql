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