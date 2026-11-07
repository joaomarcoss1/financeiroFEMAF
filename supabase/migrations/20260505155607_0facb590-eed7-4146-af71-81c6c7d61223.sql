
-- 1. registros_ponto: aprovação + substituição
ALTER TABLE public.registros_ponto
  ADD COLUMN IF NOT EXISTS status_aprovacao text NOT NULL DEFAULT 'aprovado',
  ADD COLUMN IF NOT EXISTS aprovado_por uuid,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS motivo_rejeicao text,
  ADD COLUMN IF NOT EXISTS substituicao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS professor_substituido_id uuid;

ALTER TABLE public.registros_ponto
  DROP CONSTRAINT IF EXISTS registros_ponto_status_aprovacao_check;
ALTER TABLE public.registros_ponto
  ADD CONSTRAINT registros_ponto_status_aprovacao_check
  CHECK (status_aprovacao IN ('pendente','aprovado','rejeitado'));

CREATE INDEX IF NOT EXISTS idx_registros_status ON public.registros_ponto(status_aprovacao);
CREATE INDEX IF NOT EXISTS idx_registros_data ON public.registros_ponto(data);

-- Atualiza trigger de duplicidade para ignorar rejeitados
CREATE OR REPLACE FUNCTION public.check_horario_duplicado()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  h INTEGER;
  conflito RECORD;
BEGIN
  IF NEW.status_aprovacao = 'rejeitado' THEN
    RETURN NEW;
  END IF;
  FOREACH h IN ARRAY NEW.horarios LOOP
    SELECT id INTO conflito
    FROM public.registros_ponto
    WHERE professor_id = NEW.professor_id
      AND data = NEW.data
      AND h = ANY(horarios)
      AND status_aprovacao <> 'rejeitado'
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    LIMIT 1;

    IF FOUND THEN
      RAISE EXCEPTION 'Horário % já registrado para este professor nesta data', h
        USING ERRCODE = 'unique_violation';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_check_horario_duplicado ON public.registros_ponto;
CREATE TRIGGER trg_check_horario_duplicado
BEFORE INSERT OR UPDATE ON public.registros_ponto
FOR EACH ROW EXECUTE FUNCTION public.check_horario_duplicado();

-- 2. push_subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  professor_id uuid,
  user_id uuid,
  role text NOT NULL DEFAULT 'professor',
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage push_subscriptions" ON public.push_subscriptions
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Anon insert push_subscriptions" ON public.push_subscriptions
  FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon read push_subscriptions" ON public.push_subscriptions
  FOR SELECT TO anon USING (true);
CREATE POLICY "Auth read push_subscriptions" ON public.push_subscriptions
  FOR SELECT TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_push_prof ON public.push_subscriptions(professor_id);
CREATE INDEX IF NOT EXISTS idx_push_role ON public.push_subscriptions(role);

-- 3. notificacoes (sino in-app)
CREATE TABLE IF NOT EXISTS public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destino_role text NOT NULL DEFAULT 'professor',
  professor_id uuid,
  user_id uuid,
  tipo text NOT NULL,
  titulo text NOT NULL,
  mensagem text NOT NULL,
  link text,
  lida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage notificacoes" ON public.notificacoes
  FOR ALL TO authenticated USING (has_role(auth.uid(),'admin'::app_role)) WITH CHECK (has_role(auth.uid(),'admin'::app_role));
CREATE POLICY "Anon read notificacoes" ON public.notificacoes
  FOR SELECT TO anon USING (true);
CREATE POLICY "Auth read notificacoes" ON public.notificacoes
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anon update lida" ON public.notificacoes
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_notif_prof ON public.notificacoes(professor_id, lida);
CREATE INDEX IF NOT EXISTS idx_notif_role ON public.notificacoes(destino_role, lida);

ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.registros_ponto;

-- Garante pg_cron e pg_net para cron de notificações
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;
