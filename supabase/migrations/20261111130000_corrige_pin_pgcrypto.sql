-- ════════════════════════════════════════════════════════════════════════
--  Corrige PINs: no Supabase a extensão pgcrypto (crypt/gen_salt) fica no
--  esquema "extensions", mas as funções de PIN rodavam só com
--  search_path = public. Com isso nenhum PIN podia ser salvo (erro
--  "function gen_salt(unknown) does not exist") nem conferido no ponto,
--  na coordenação ou no ponto administrativo. Idempotente.
-- ════════════════════════════════════════════════════════════════════════
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public._hash_pin_trigger()',
    'public._prof_validate(uuid, text)',
    'public._func_adm_validate(uuid, text)',
    'public._coord_validate(uuid, text)',
    'public.coordenador_login(text, text)'
  ] LOOP
    IF to_regprocedure(f) IS NOT NULL THEN
      EXECUTE format('ALTER FUNCTION %s SET search_path = public, extensions', f);
    END IF;
  END LOOP;
END $$;
