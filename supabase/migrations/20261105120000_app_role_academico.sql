-- F6/F7 — Migration A: novos papéis.
-- Fica sozinha porque ADD VALUE não pode ser usado na mesma transação em que o valor é referenciado.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'aluno';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'secretaria';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'coordenador';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'diretor';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'setor';
