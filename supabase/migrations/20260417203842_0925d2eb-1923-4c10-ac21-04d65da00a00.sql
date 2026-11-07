-- Remove insert permissivo para authenticated (agora só via edge function service role)
DROP POLICY IF EXISTS "Auth insert registros" ON public.registros_ponto;