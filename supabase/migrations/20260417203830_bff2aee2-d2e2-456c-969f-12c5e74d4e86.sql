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