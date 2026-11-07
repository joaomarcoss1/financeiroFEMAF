-- CPF para o cadastro de administrativo/apoio, para aparecer na folha de
-- pagamento do mesmo jeito que já aparece para professores/coordenadores.
ALTER TABLE public.funcionarios_administrativos ADD COLUMN IF NOT EXISTS cpf text;

-- Registra em migration as colunas de pagamento fixo por disciplina que já
-- existiam no banco (aplicadas fora do histórico de migrations) e que agora
-- ganham UI em Matérias: pagamento_tipo ('hora_aula' | 'fixo_semestral'),
-- valor_fixo_semestral e a janela pagamento_inicio/pagamento_fim em que o
-- valor fixo é dividido igualmente pelas quinzenas do período.
ALTER TABLE public.materias ADD COLUMN IF NOT EXISTS pagamento_tipo text NOT NULL DEFAULT 'hora_aula';
ALTER TABLE public.materias ADD COLUMN IF NOT EXISTS valor_fixo_semestral numeric NOT NULL DEFAULT 0;
ALTER TABLE public.materias ADD COLUMN IF NOT EXISTS pagamento_inicio date;
ALTER TABLE public.materias ADD COLUMN IF NOT EXISTS pagamento_fim date;
