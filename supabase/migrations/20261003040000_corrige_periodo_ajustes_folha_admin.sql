-- ============================================================
-- Corrige bug real: um ajuste administrativo (adicional/desconto/hora
-- extra) lançado hoje para um período JÁ FECHADO não tinha nenhum efeito
-- na folha daquele período — gerar_folha_admin somava os ajustes pela
-- data em que foram DIGITADOS (created_at), não pelo período a que se
-- referem. A tabela já tinha uma coluna folha_id para isso, mas nada no
-- app a preenchia.
--
-- Em vez do FK para folha_administrativo_apoio (que exigiria a folha já
-- existir antes do ajuste, uma ordem de operações frágil), usa-se duas
-- colunas de data simples — o mesmo formato de período usado em toda
-- parte do sistema (ex.: gerar_folha_admin(p_periodo_inicio, p_periodo_fim)).
-- ============================================================

ALTER TABLE public.ajustes_folha_administrativo
  ADD COLUMN IF NOT EXISTS periodo_inicio date,
  ADD COLUMN IF NOT EXISTS periodo_fim date;

-- Backfill: ajustes já lançados presumem o período da quinzena em que
-- foram digitados — o mesmo comportamento (implícito) que o sistema já
-- tinha antes desta correção, preservado para não alterar o resultado de
-- folhas já geradas no passado.
UPDATE public.ajustes_folha_administrativo
SET
  periodo_inicio = CASE WHEN EXTRACT(DAY FROM created_at) <= 15
    THEN date_trunc('month', created_at)::date
    ELSE (date_trunc('month', created_at) + interval '15 days')::date END,
  periodo_fim = CASE WHEN EXTRACT(DAY FROM created_at) <= 15
    THEN (date_trunc('month', created_at) + interval '14 days')::date
    ELSE (date_trunc('month', created_at) + interval '1 month' - interval '1 day')::date END
WHERE periodo_inicio IS NULL;

ALTER TABLE public.ajustes_folha_administrativo
  ALTER COLUMN periodo_inicio SET NOT NULL,
  ALTER COLUMN periodo_fim SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ajustes_folha_admin_periodo
  ON public.ajustes_folha_administrativo (funcionario_id, periodo_inicio, periodo_fim);

-- Recria gerar_folha_admin filtrando os ajustes pelo período A QUE SE
-- REFEREM (periodo_inicio/periodo_fim), não pela data em que foram
-- digitados — corpo idêntico ao original (migration 20260621233219), só
-- trocando essas 3 condições.
CREATE OR REPLACE FUNCTION public.gerar_folha_admin(
  p_periodo_inicio date, p_periodo_fim date, p_funcionario_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  f RECORD; d date; dow int; v_dias_prev int; v_dias_pres int;
  v_faltas int; v_atrasos int; v_saidas int; v_extras numeric;
  v_adic numeric; v_desc numeric; v_final numeric;
  v_count int := 0; v_escala RECORD;
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'sem permissão'; END IF;
  IF p_periodo_fim < p_periodo_inicio THEN RAISE EXCEPTION 'período inválido'; END IF;

  FOR f IN SELECT * FROM public.funcionarios_administrativos
           WHERE ativo = true AND (p_funcionario_id IS NULL OR id = p_funcionario_id)
  LOOP
    SELECT * INTO v_escala FROM public.escalas_administrativas WHERE id = f.escala_id;
    v_dias_prev := 0;
    d := p_periodo_inicio;
    WHILE d <= p_periodo_fim LOOP
      dow := EXTRACT(DOW FROM d);
      IF v_escala.dias_semana IS NULL THEN
        IF dow BETWEEN 1 AND 5 THEN v_dias_prev := v_dias_prev + 1; END IF;
      ELSIF dow = ANY(v_escala.dias_semana) THEN
        v_dias_prev := v_dias_prev + 1;
      END IF;
      d := d + 1;
    END LOOP;

    SELECT COUNT(DISTINCT data) INTO v_dias_pres
    FROM public.registros_ponto_administrativo
    WHERE funcionario_id = f.id AND data BETWEEN p_periodo_inicio AND p_periodo_fim
      AND tipo_marcacao = 'entrada_expediente';

    v_faltas := GREATEST(v_dias_prev - v_dias_pres, 0);

    SELECT COUNT(*) INTO v_atrasos FROM public.registros_ponto_administrativo
    WHERE funcionario_id = f.id AND data BETWEEN p_periodo_inicio AND p_periodo_fim
      AND status = 'atraso';

    SELECT COUNT(*) INTO v_saidas FROM public.registros_ponto_administrativo
    WHERE funcionario_id = f.id AND data BETWEEN p_periodo_inicio AND p_periodo_fim
      AND status = 'saida_antecipada';

    SELECT COALESCE(SUM(quantidade_horas),0) INTO v_extras
    FROM public.ajustes_folha_administrativo
    WHERE funcionario_id = f.id AND tipo='hora_extra'
      AND periodo_inicio = p_periodo_inicio AND periodo_fim = p_periodo_fim;

    SELECT COALESCE(SUM(valor),0) INTO v_adic
    FROM public.ajustes_folha_administrativo
    WHERE funcionario_id = f.id AND tipo IN ('adicional','hora_extra')
      AND periodo_inicio = p_periodo_inicio AND periodo_fim = p_periodo_fim;

    SELECT COALESCE(SUM(valor),0) INTO v_desc
    FROM public.ajustes_folha_administrativo
    WHERE funcionario_id = f.id AND tipo='desconto'
      AND periodo_inicio = p_periodo_inicio AND periodo_fim = p_periodo_fim;
    -- (correção: antes filtrava por created_at::date BETWEEN ...)

    v_final := f.salario_quinzenal + v_adic - v_desc;

    INSERT INTO public.folha_administrativo_apoio(
      funcionario_id, periodo_inicio, periodo_fim, salario_quinzenal,
      dias_previstos, dias_presentes, faltas, atrasos, saidas_antecipadas,
      horas_extras, adicionais, descontos, valor_final
    ) VALUES (
      f.id, p_periodo_inicio, p_periodo_fim, f.salario_quinzenal,
      v_dias_prev, v_dias_pres, v_faltas, v_atrasos, v_saidas,
      v_extras, v_adic, v_desc, v_final
    )
    ON CONFLICT (funcionario_id, periodo_inicio, periodo_fim) DO UPDATE SET
      salario_quinzenal = EXCLUDED.salario_quinzenal,
      dias_previstos = EXCLUDED.dias_previstos,
      dias_presentes = EXCLUDED.dias_presentes,
      faltas = EXCLUDED.faltas,
      atrasos = EXCLUDED.atrasos,
      saidas_antecipadas = EXCLUDED.saidas_antecipadas,
      horas_extras = EXCLUDED.horas_extras,
      adicionais = EXCLUDED.adicionais,
      descontos = EXCLUDED.descontos,
      valor_final = EXCLUDED.valor_final,
      updated_at = now();

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object('ok',true,'processados',v_count);
END $$;
