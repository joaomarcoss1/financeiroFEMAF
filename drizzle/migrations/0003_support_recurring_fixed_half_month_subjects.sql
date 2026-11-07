ALTER TABLE public.materias ADD COLUMN horas_fixas_quinzenais numeric NOT NULL DEFAULT 0;
ALTER TABLE public.materias DROP CONSTRAINT materias_pagamento_tipo_valido;
ALTER TABLE public.materias ADD CONSTRAINT materias_pagamento_tipo_valido CHECK (pagamento_tipo IN ('hora_aula','fixo_semestral','fixo_quinzenal'));
ALTER TABLE public.materias DROP CONSTRAINT materias_pagamento_periodo_valido;
ALTER TABLE public.materias ADD CONSTRAINT materias_pagamento_periodo_valido CHECK (pagamento_tipo = 'hora_aula' OR (valor_fixo_semestral > 0 AND pagamento_inicio IS NOT NULL AND ((pagamento_tipo = 'fixo_semestral' AND pagamento_fim IS NOT NULL AND pagamento_fim >= pagamento_inicio) OR (pagamento_tipo = 'fixo_quinzenal' AND horas_fixas_quinzenais > 0 AND (pagamento_fim IS NULL OR pagamento_fim >= pagamento_inicio)))));
COMMENT ON COLUMN public.materias.horas_fixas_quinzenais IS 'Fixed hours credited per half-month for recurring fixed contracts';
COMMENT ON COLUMN public.materias.valor_fixo_semestral IS 'Semester total for fixo_semestral; recurring half-month amount for fixo_quinzenal';