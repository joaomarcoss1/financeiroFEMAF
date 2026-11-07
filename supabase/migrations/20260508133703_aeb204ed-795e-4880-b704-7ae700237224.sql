
ALTER TABLE public.horarios_aula DROP CONSTRAINT IF EXISTS horarios_aula_horario_id_check;
ALTER TABLE public.horarios_aula ADD CONSTRAINT horarios_aula_horario_id_check CHECK (horario_id BETWEEN 1 AND 8);
