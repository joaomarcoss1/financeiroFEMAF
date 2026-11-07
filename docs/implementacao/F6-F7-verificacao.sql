-- Roteiro de verificação F6/F7 (seção 7 da especificação).
-- Seguro para produção: só SELECT e uma transação encerrada com ROLLBACK (nada é gravado).
-- Rode depois de aplicar as migrations 20261105120000..120300.

-- 1) Migrations, papéis, buckets e tipos
SELECT version, name FROM supabase_migrations.schema_migrations WHERE version >= '20261105120000' ORDER BY version;
SELECT string_agg(enumlabel, ', ' ORDER BY enumsortorder) AS app_role FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid WHERE t.typname = 'app_role';
SELECT id, public, file_size_limit FROM storage.buckets WHERE id IN ('protocolos', 'documentos', 'justificativas');
SELECT id, ativo, jsonb_array_length(etapas) AS etapas FROM public.protocolo_tipos ORDER BY ordem;

-- 2) anon só executa documento_validar entre as funções novas (esperado: uma linha, documento_validar)
SELECT p.proname
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND has_function_privilege('anon', p.oid, 'EXECUTE')
   AND p.proname IN ('has_any_role','current_aluno_id','membro_setor','is_secretaria','coordena_curso','pode_atuar_setor','is_equipe',
                     'aluno_vincular_conta','equipe_usuarios','notificacoes_minhas_marcar_lidas','dias_uteis_apos','pode_ver_anexo',
                     'protocolo_abrir','protocolo_responder_pendencia','protocolo_cancelar','aluno_disciplinas','professores_nomes',
                     'protocolo_tramitar','protocolos_fila','protocolo_detalhe','documento_criar','documento_assinar',
                     'documento_registrar_arquivo','documento_cancelar','documento_obter','documentos_para_assinar',
                     'pode_enviar_documento','pode_ver_documento_arquivo','documento_validar',
                     '_documento_criar','_protocolo_gravar_anexos','_notificar_aluno','_notificar_setor');

-- 3) RLS: aluno A não lê protocolo do aluno B; coordenador de ped não vê protocolo de dir.
--    Dados temporários dentro da transação; ROLLBACK no final desfaz tudo.
BEGIN;
INSERT INTO auth.users (id, email) VALUES
  ('f6f70000-0000-0000-0000-0000000000a1', 'teste-a@f6f7.invalid'),
  ('f6f70000-0000-0000-0000-0000000000b1', 'teste-b@f6f7.invalid'),
  ('f6f70000-0000-0000-0000-0000000000c1', 'teste-coord@f6f7.invalid');
INSERT INTO public.alunos (id, user_id, matricula, nome, cpf, data_nascimento, curso_id) VALUES
  ('f6f70000-0000-0000-0000-00000000aaaa', 'f6f70000-0000-0000-0000-0000000000a1', 'TESTE-A', 'Aluno A', '52998224725', '2000-01-01', 'ped'),
  ('f6f70000-0000-0000-0000-00000000bbbb', 'f6f70000-0000-0000-0000-0000000000b1', 'TESTE-B', 'Aluno B', '11144477735', '2000-01-01', 'dir');
INSERT INTO public.setor_membros (setor_id, user_id, curso_id) VALUES ('coordenacao', 'f6f70000-0000-0000-0000-0000000000c1', 'ped');
INSERT INTO public.protocolos (id, numero, tipo_id, aluno_id, curso_id, setor_atual) VALUES
  ('f6f70000-0000-0000-0000-0000000000f1', 'TESTE.000001', 'geral', 'f6f70000-0000-0000-0000-00000000aaaa', 'ped', 'coordenacao'),
  ('f6f70000-0000-0000-0000-0000000000f2', 'TESTE.000002', 'geral', 'f6f70000-0000-0000-0000-00000000bbbb', 'dir', 'coordenacao');

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', 'f6f70000-0000-0000-0000-0000000000a1', true);
SELECT 'aluno A vê (esperado TESTE.000001)' AS teste, string_agg(numero, ', ') FROM public.protocolos;
SELECT set_config('request.jwt.claim.sub', 'f6f70000-0000-0000-0000-0000000000c1', true);
SELECT 'coord ped vê na fila (esperado TESTE.000001)' AS teste, string_agg(numero, ', ') FROM public.protocolos_fila('{}');
SELECT 'coord ped lê direto (esperado vazio)' AS teste, string_agg(numero, ', ') FROM public.protocolos;
ROLLBACK;
