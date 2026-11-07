
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
