-- Endurecimento após abrir cadastro de alunos/equipe (F6/F7): qualquer pessoa pode criar conta.
-- 1) Anexos de justificativa passam a exigir URL assinada (o app já usa getAnexoSignedUrl).
UPDATE storage.buckets SET public = false WHERE id = 'justificativas';
-- 2) coordenadores tem valor_quinzenal; só o admin lê (policy "Admins manage coordenadores").
DROP POLICY IF EXISTS "Auth read coordenadores" ON public.coordenadores;
