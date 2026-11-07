
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
