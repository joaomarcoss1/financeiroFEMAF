
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
