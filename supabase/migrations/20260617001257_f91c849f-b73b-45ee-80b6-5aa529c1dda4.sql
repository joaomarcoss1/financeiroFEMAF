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