-- ════════════════════════════════════════════════════════════════════════
--  Funções que conferem PIN precisam poder gravar: a validação zera ou
--  incrementa o contador de tentativas (pin_tentativas). Declaradas como
--  STABLE, a API as executa em transação somente leitura e elas falham com
--  "cannot execute UPDATE in a read-only transaction" — histórico do
--  professor no Bater Ponto, painel da coordenação, permutas, notificações
--  do professor e histórico do ponto administrativo. Idempotente.
-- ════════════════════════════════════════════════════════════════════════
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS fn
      FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.provolatile <> 'v'
       AND p.proname IN ('get_historico_professor_seguro', 'coord_grade', 'coord_pendentes', 'coord_professores',
                         'coord_registros_periodo', 'historico_ponto_admin', 'notificacoes_professor_listar', 'permuta_listar')
  LOOP
    EXECUTE format('ALTER FUNCTION %s VOLATILE', r.fn);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
