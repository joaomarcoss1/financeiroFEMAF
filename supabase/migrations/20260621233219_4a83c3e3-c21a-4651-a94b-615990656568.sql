
-- ============ FUNÇÕES / CARGOS ============
CREATE TABLE public.funcoes_administrativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  tipo text NOT NULL CHECK (tipo IN ('administrativo','apoio')),
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.funcoes_administrativas TO authenticated;
GRANT ALL ON public.funcoes_administrativas TO service_role;
ALTER TABLE public.funcoes_administrativas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage funcoes" ON public.funcoes_administrativas
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_funcoes_adm_upd BEFORE UPDATE ON public.funcoes_administrativas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ ESCALAS ============
CREATE TABLE public.escalas_administrativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  dias_semana int[] NOT NULL DEFAULT '{1,2,3,4,5}',
  entrada_prevista time,
  saida_intervalo_prevista time,
  retorno_intervalo_previsto time,
  saida_prevista time,
  intervalo_minutos int NOT NULL DEFAULT 60,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.escalas_administrativas TO authenticated;
GRANT ALL ON public.escalas_administrativas TO service_role;
ALTER TABLE public.escalas_administrativas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage escalas" ON public.escalas_administrativas
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_escalas_adm_upd BEFORE UPDATE ON public.escalas_administrativas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ FUNCIONÁRIOS ============
CREATE TABLE public.funcionarios_administrativos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_completo text NOT NULL,
  funcao_id uuid REFERENCES public.funcoes_administrativas(id),
  tipo_funcionario text NOT NULL DEFAULT 'administrativo' CHECK (tipo_funcionario IN ('administrativo','apoio')),
  salario_quinzenal numeric(12,2) NOT NULL DEFAULT 0,
  pin text,
  pix text,
  banco text,
  agencia text,
  conta text,
  tipo_conta text,
  escala_id uuid REFERENCES public.escalas_administrativas(id),
  ativo boolean NOT NULL DEFAULT true,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.funcionarios_administrativos TO authenticated;
GRANT ALL ON public.funcionarios_administrativos TO service_role;
ALTER TABLE public.funcionarios_administrativos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage funcionarios" ON public.funcionarios_administrativos
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_funcs_adm_upd BEFORE UPDATE ON public.funcionarios_administrativos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ REGISTROS DE PONTO ============
CREATE TABLE public.registros_ponto_administrativo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios_administrativos(id) ON DELETE CASCADE,
  data date NOT NULL,
  tipo_marcacao text NOT NULL CHECK (tipo_marcacao IN ('entrada_expediente','saida_intervalo','retorno_intervalo','saida_expediente')),
  horario_previsto time,
  horario_real timestamptz NOT NULL DEFAULT now(),
  diferenca_minutos int,
  status text,
  justificativa text,
  latitude double precision,
  longitude double precision,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_reg_adm_func_data ON public.registros_ponto_administrativo(funcionario_id, data);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.registros_ponto_administrativo TO authenticated;
GRANT ALL ON public.registros_ponto_administrativo TO service_role;
ALTER TABLE public.registros_ponto_administrativo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage reg adm" ON public.registros_ponto_administrativo
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ FOLHA ============
CREATE TABLE public.folha_administrativo_apoio (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios_administrativos(id) ON DELETE CASCADE,
  periodo_inicio date NOT NULL,
  periodo_fim date NOT NULL,
  salario_quinzenal numeric(12,2) NOT NULL DEFAULT 0,
  dias_previstos int NOT NULL DEFAULT 0,
  dias_presentes int NOT NULL DEFAULT 0,
  faltas int NOT NULL DEFAULT 0,
  atrasos int NOT NULL DEFAULT 0,
  saidas_antecipadas int NOT NULL DEFAULT 0,
  horas_extras numeric(8,2) NOT NULL DEFAULT 0,
  adicionais numeric(12,2) NOT NULL DEFAULT 0,
  descontos numeric(12,2) NOT NULL DEFAULT 0,
  valor_final numeric(12,2) NOT NULL DEFAULT 0,
  observacoes text,
  status text NOT NULL DEFAULT 'aberta',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(funcionario_id, periodo_inicio, periodo_fim)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.folha_administrativo_apoio TO authenticated;
GRANT ALL ON public.folha_administrativo_apoio TO service_role;
ALTER TABLE public.folha_administrativo_apoio ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage folha adm" ON public.folha_administrativo_apoio
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_folha_adm_upd BEFORE UPDATE ON public.folha_administrativo_apoio
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ajustes_folha_administrativo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id uuid NOT NULL REFERENCES public.funcionarios_administrativos(id) ON DELETE CASCADE,
  folha_id uuid REFERENCES public.folha_administrativo_apoio(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('adicional','desconto','hora_extra')),
  valor numeric(12,2) NOT NULL DEFAULT 0,
  quantidade_horas numeric(8,2),
  motivo text,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ajustes_folha_administrativo TO authenticated;
GRANT ALL ON public.ajustes_folha_administrativo TO service_role;
ALTER TABLE public.ajustes_folha_administrativo ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin manage ajustes folha adm" ON public.ajustes_folha_administrativo
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

-- ============ SEEDS ============
INSERT INTO public.funcoes_administrativas (nome, tipo, descricao) VALUES
  ('Secretário Acadêmico/Financeiro','administrativo','Atendimento, secretaria acadêmica e financeira'),
  ('Vigia','apoio','Vigilância e segurança patrimonial'),
  ('Serviços Gerais','apoio','Limpeza, manutenção e apoio operacional')
ON CONFLICT (nome) DO NOTHING;

INSERT INTO public.escalas_administrativas (nome, dias_semana, entrada_prevista, saida_intervalo_prevista, retorno_intervalo_previsto, saida_prevista, intervalo_minutos) VALUES
  ('Expediente 08h-12h / 14h-18h', '{1,2,3,4,5}', '08:00','12:00','14:00','18:00', 120),
  ('Expediente 14h-22h (1h intervalo)', '{1,2,3,4,5}', '14:00','18:00','19:00','22:00', 60);

-- ============ FUNÇÕES SEGURAS ============

-- Lista pública (sem PIN/salário) para tela inicial
CREATE OR REPLACE FUNCTION public.list_funcionarios_admin_ativos()
RETURNS TABLE(id uuid, nome_completo text, tipo_funcionario text, funcao_nome text, escala_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT f.id, f.nome_completo, f.tipo_funcionario, fn.nome, f.escala_id
  FROM public.funcionarios_administrativos f
  LEFT JOIN public.funcoes_administrativas fn ON fn.id = f.funcao_id
  WHERE f.ativo = true
  ORDER BY f.nome_completo;
$$;
GRANT EXECUTE ON FUNCTION public.list_funcionarios_admin_ativos() TO anon, authenticated;

-- Valida PIN funcionário
CREATE OR REPLACE FUNCTION public._func_adm_validate(p_id uuid, p_pin text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE v_ok boolean;
BEGIN
  SELECT EXISTS(SELECT 1 FROM public.funcionarios_administrativos
    WHERE id=p_id AND ativo=true AND pin IS NOT NULL AND pin=p_pin) INTO v_ok;
  IF NOT v_ok THEN RAISE EXCEPTION 'Credenciais inválidas' USING ERRCODE='28000'; END IF;
  RETURN true;
END $$;

-- Detalhes da escala (para mostrar ao funcionário sem expor outros dados)
CREATE OR REPLACE FUNCTION public.escala_admin_detalhe(p_escala_id uuid)
RETURNS TABLE(id uuid, nome text, dias_semana int[], entrada_prevista time,
              saida_intervalo_prevista time, retorno_intervalo_previsto time,
              saida_prevista time, intervalo_minutos int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
  SELECT id, nome, dias_semana, entrada_prevista, saida_intervalo_prevista,
         retorno_intervalo_previsto, saida_prevista, intervalo_minutos
  FROM public.escalas_administrativas WHERE id = p_escala_id AND ativo = true;
$$;
GRANT EXECUTE ON FUNCTION public.escala_admin_detalhe(uuid) TO anon, authenticated;

-- Bater ponto
CREATE OR REPLACE FUNCTION public.bater_ponto_admin(
  p_func_id uuid, p_pin text, p_tipo text,
  p_justificativa text DEFAULT NULL,
  p_lat double precision DEFAULT NULL,
  p_lng double precision DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  v_escala RECORD; v_previsto time; v_real timestamptz := now();
  v_diff int; v_status text; v_id uuid; v_dup boolean;
  v_hora_real time;
BEGIN
  PERFORM public._func_adm_validate(p_func_id, p_pin);
  IF p_tipo NOT IN ('entrada_expediente','saida_intervalo','retorno_intervalo','saida_expediente') THEN
    RAISE EXCEPTION 'tipo de marcação inválido';
  END IF;

  SELECT e.* INTO v_escala
  FROM public.escalas_administrativas e
  JOIN public.funcionarios_administrativos f ON f.escala_id = e.id
  WHERE f.id = p_func_id;

  v_previsto := CASE p_tipo
    WHEN 'entrada_expediente' THEN v_escala.entrada_prevista
    WHEN 'saida_intervalo'    THEN v_escala.saida_intervalo_prevista
    WHEN 'retorno_intervalo'  THEN v_escala.retorno_intervalo_previsto
    WHEN 'saida_expediente'   THEN v_escala.saida_prevista
  END;

  v_hora_real := (v_real AT TIME ZONE 'America/Fortaleza')::time;

  IF v_previsto IS NOT NULL THEN
    v_diff := EXTRACT(EPOCH FROM (v_hora_real - v_previsto))/60;
  ELSE
    v_diff := 0;
  END IF;

  v_status := CASE
    WHEN v_previsto IS NULL THEN 'extra'
    WHEN abs(v_diff) <= 5 THEN 'no_horario'
    WHEN abs(v_diff) < 30 THEN 'tolerancia'
    WHEN v_diff >= 30 AND p_tipo IN ('entrada_expediente','retorno_intervalo') THEN 'atraso'
    WHEN v_diff <= -30 AND p_tipo IN ('saida_expediente','saida_intervalo') THEN 'saida_antecipada'
    WHEN v_diff > 0 AND p_tipo IN ('saida_expediente','saida_intervalo') THEN 'extra'
    ELSE 'tolerancia'
  END;

  IF v_status IN ('atraso','saida_antecipada') AND (p_justificativa IS NULL OR length(trim(p_justificativa)) < 3) THEN
    RAISE EXCEPTION 'JUSTIFICATIVA_OBRIGATORIA';
  END IF;

  -- Evita duplicidade absurda: mesmo tipo nos últimos 5 minutos
  SELECT EXISTS(
    SELECT 1 FROM public.registros_ponto_administrativo
    WHERE funcionario_id = p_func_id AND tipo_marcacao = p_tipo
      AND horario_real > now() - interval '5 minutes'
  ) INTO v_dup;
  IF v_dup THEN RAISE EXCEPTION 'Marcação duplicada recente'; END IF;

  INSERT INTO public.registros_ponto_administrativo(
    funcionario_id, data, tipo_marcacao, horario_previsto, horario_real,
    diferenca_minutos, status, justificativa, latitude, longitude
  ) VALUES (
    p_func_id, (v_real AT TIME ZONE 'America/Fortaleza')::date,
    p_tipo, v_previsto, v_real, v_diff, v_status, p_justificativa, p_lat, p_lng
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok',true,'id',v_id,'status',v_status,'diferenca_minutos',v_diff);
END $$;
GRANT EXECUTE ON FUNCTION public.bater_ponto_admin(uuid,text,text,text,double precision,double precision) TO anon, authenticated;

-- Histórico próprio
CREATE OR REPLACE FUNCTION public.historico_ponto_admin(p_func_id uuid, p_pin text, p_limite int DEFAULT 10)
RETURNS TABLE(id uuid, data date, tipo_marcacao text, horario_previsto time,
              horario_real timestamptz, diferenca_minutos int, status text, justificativa text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
BEGIN
  PERFORM public._func_adm_validate(p_func_id, p_pin);
  RETURN QUERY
  SELECT r.id, r.data, r.tipo_marcacao, r.horario_previsto, r.horario_real,
         r.diferenca_minutos, r.status, r.justificativa
  FROM public.registros_ponto_administrativo r
  WHERE r.funcionario_id = p_func_id
  ORDER BY r.horario_real DESC
  LIMIT GREATEST(LEAST(p_limite,50),1);
END $$;
GRANT EXECUTE ON FUNCTION public.historico_ponto_admin(uuid,text,int) TO anon, authenticated;

-- Gera/recalcula folha
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
      AND created_at::date BETWEEN p_periodo_inicio AND p_periodo_fim;

    SELECT COALESCE(SUM(valor),0) INTO v_adic
    FROM public.ajustes_folha_administrativo
    WHERE funcionario_id = f.id AND tipo IN ('adicional','hora_extra')
      AND created_at::date BETWEEN p_periodo_inicio AND p_periodo_fim;

    SELECT COALESCE(SUM(valor),0) INTO v_desc
    FROM public.ajustes_folha_administrativo
    WHERE funcionario_id = f.id AND tipo='desconto'
      AND created_at::date BETWEEN p_periodo_inicio AND p_periodo_fim;

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
