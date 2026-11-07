ALTER TABLE public.professores
  ADD COLUMN IF NOT EXISTS agencia_bb TEXT,
  ADD COLUMN IF NOT EXISTS conta_bb TEXT;