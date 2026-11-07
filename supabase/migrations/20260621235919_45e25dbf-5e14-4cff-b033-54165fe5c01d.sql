
-- Paridade do Ponto Administrativo: geofence, retroativo, aprovação

ALTER TABLE public.registros_ponto_administrativo
  ADD COLUMN IF NOT EXISTS status_aprovacao text NOT NULL DEFAULT 'aprovado',
  ADD COLUMN IF NOT EXISTS retroativo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS motivo_rejeicao text,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS aprovado_por uuid,
  ADD COLUMN IF NOT EXISTS justificativa_retroativa text;

-- Função utilitária de distância (Haversine)
CREATE OR REPLACE FUNCTION public._haversine_m(lat1 double precision, lon1 double precision, lat2 double precision, lon2 double precision)
RETURNS double precision LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE r constant double precision := 6371000;
        dlat double precision; dlon double precision; a double precision;
BEGIN
  dlat := radians(lat2 - lat1); dlon := radians(lon2 - lon1);
  a := sin(dlat/2)^2 + cos(radians(lat1))*cos(radians(lat2))*sin(dlon/2)^2;
  RETURN r * 2 * atan2(sqrt(a), sqrt(1-a));
END $$;

-- Substitui bater_ponto_admin para validar geofence (igual ao do professor)
CREATE OR REPLACE FUNCTION public.bater_ponto_admin(
  p_func_id uuid, p_pin text, p_tipo text,
  p_justificativa text DEFAULT NULL,
  p_lat double precision DEFAULT NULL, p_lng double precision DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_escala RECORD; v_previsto time; v_real timestamptz := now();
  v_diff int; v_status text; v_id uuid; v_dup boolean;
  v_hora_real time; v_cfg jsonb; v_lat double precision; v_lng double precision; v_raio int;
  v_dist double precision;
BEGIN
  PERFORM public._func_adm_validate(p_func_id, p_pin);
  IF p_tipo NOT IN ('entrada_expediente','saida_intervalo','retorno_intervalo','saida_expediente') THEN
    RAISE EXCEPTION 'tipo de marcação inválido';
  END IF;

  -- Geofence
  SELECT data INTO v_cfg FROM public.app_settings WHERE id='global';
  v_lat := COALESCE((v_cfg->'geofence'->>'lat')::double precision, -4.5694);
  v_lng := COALESCE((v_cfg->'geofence'->>'lng')::double precision, -44.5996);
  v_raio := COALESCE((v_cfg->'geofence'->>'raio_m')::int, 900);
  IF p_lat IS NULL OR p_lng IS NULL THEN
    RAISE EXCEPTION 'GPS_OBRIGATORIO';
  END IF;
  v_dist := public._haversine_m(p_lat, p_lng, v_lat, v_lng);
  IF v_dist > v_raio THEN
    RAISE EXCEPTION 'FORA_DA_AREA: % m (máx %)', round(v_dist)::int, v_raio;
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
  ELSE v_diff := 0; END IF;

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

  SELECT EXISTS(
    SELECT 1 FROM public.registros_ponto_administrativo
    WHERE funcionario_id = p_func_id AND tipo_marcacao = p_tipo
      AND horario_real > now() - interval '5 minutes'
  ) INTO v_dup;
  IF v_dup THEN RAISE EXCEPTION 'Marcação duplicada recente'; END IF;

  INSERT INTO public.registros_ponto_administrativo(
    funcionario_id, data, tipo_marcacao, horario_previsto, horario_real,
    diferenca_minutos, status, justificativa, latitude, longitude,
    status_aprovacao, retroativo
  ) VALUES (
    p_func_id, (v_real AT TIME ZONE 'America/Fortaleza')::date,
    p_tipo, v_previsto, v_real, v_diff, v_status, p_justificativa, p_lat, p_lng,
    'aprovado', false
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok',true,'id',v_id,'status',v_status,'diferenca_minutos',v_diff);
END $$;

-- Bater ponto retroativo administrativo (vai para aprovação)
CREATE OR REPLACE FUNCTION public.bater_ponto_admin_retroativo(
  p_func_id uuid, p_pin text, p_data date, p_tipo text,
  p_hora time, p_justificativa text,
  p_lat double precision DEFAULT NULL, p_lng double precision DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_escala RECORD; v_previsto time; v_id uuid; v_diff int; v_status text;
  v_real timestamptz;
BEGIN
  PERFORM public._func_adm_validate(p_func_id, p_pin);
  IF p_tipo NOT IN ('entrada_expediente','saida_intervalo','retorno_intervalo','saida_expediente') THEN
    RAISE EXCEPTION 'tipo inválido';
  END IF;
  IF p_data >= (now() AT TIME ZONE 'America/Fortaleza')::date THEN
    RAISE EXCEPTION 'use ponto normal para hoje';
  END IF;
  IF p_justificativa IS NULL OR length(trim(p_justificativa)) < 5 THEN
    RAISE EXCEPTION 'JUSTIFICATIVA_OBRIGATORIA';
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

  v_real := (p_data + p_hora) AT TIME ZONE 'America/Fortaleza';
  v_diff := CASE WHEN v_previsto IS NULL THEN 0 ELSE EXTRACT(EPOCH FROM (p_hora - v_previsto))/60 END;
  v_status := 'pendente';

  INSERT INTO public.registros_ponto_administrativo(
    funcionario_id, data, tipo_marcacao, horario_previsto, horario_real,
    diferenca_minutos, status, justificativa, latitude, longitude,
    status_aprovacao, retroativo, justificativa_retroativa
  ) VALUES (
    p_func_id, p_data, p_tipo, v_previsto, v_real, v_diff,
    v_status, p_justificativa, p_lat, p_lng,
    'pendente', true, p_justificativa
  ) RETURNING id INTO v_id;

  INSERT INTO public.notificacoes(destino_role, tipo, titulo, mensagem, link)
  VALUES ('admin','retroativo_admin_pendente',
          'Ponto retroativo administrativo',
          'Há um ponto retroativo aguardando aprovação.',
          '/admin/registros');

  RETURN jsonb_build_object('ok',true,'id',v_id);
END $$;

-- Aprovar/rejeitar registro administrativo
CREATE OR REPLACE FUNCTION public.aprovar_ponto_admin(
  p_id uuid, p_acao text, p_motivo text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_user uuid := auth.uid();
BEGIN
  IF NOT public.has_role(v_user,'admin') THEN RAISE EXCEPTION 'sem permissão'; END IF;
  IF p_acao NOT IN ('aprovar','rejeitar') THEN RAISE EXCEPTION 'ação inválida'; END IF;
  IF p_acao = 'rejeitar' AND (p_motivo IS NULL OR length(trim(p_motivo)) < 3) THEN
    RAISE EXCEPTION 'motivo obrigatório';
  END IF;

  UPDATE public.registros_ponto_administrativo SET
    status_aprovacao = CASE p_acao WHEN 'aprovar' THEN 'aprovado' ELSE 'rejeitado' END,
    aprovado_em = now(), aprovado_por = v_user,
    motivo_rejeicao = CASE WHEN p_acao='rejeitar' THEN p_motivo ELSE NULL END
  WHERE id = p_id;

  RETURN jsonb_build_object('ok', true);
END $$;

-- Lista completa de registros administrativos para admin (com nomes)
CREATE OR REPLACE FUNCTION public.listar_registros_admin_full(
  p_inicio date DEFAULT NULL, p_fim date DEFAULT NULL
) RETURNS TABLE(
  id uuid, funcionario_id uuid, funcionario_nome text, funcao_nome text,
  data date, tipo_marcacao text, horario_previsto time, horario_real timestamptz,
  diferenca_minutos int, status text, justificativa text,
  latitude double precision, longitude double precision,
  status_aprovacao text, retroativo boolean, motivo_rejeicao text, created_at timestamptz
) LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'sem permissão'; END IF;
  RETURN QUERY
    SELECT r.id, r.funcionario_id, f.nome_completo, fn.nome,
           r.data, r.tipo_marcacao, r.horario_previsto, r.horario_real,
           r.diferenca_minutos, r.status, r.justificativa,
           r.latitude, r.longitude,
           r.status_aprovacao, r.retroativo, r.motivo_rejeicao, r.created_at
    FROM public.registros_ponto_administrativo r
    JOIN public.funcionarios_administrativos f ON f.id = r.funcionario_id
    LEFT JOIN public.funcoes_administrativas fn ON fn.id = f.funcao_id
    WHERE (p_inicio IS NULL OR r.data >= p_inicio)
      AND (p_fim IS NULL OR r.data <= p_fim)
    ORDER BY r.horario_real DESC;
END $$;

GRANT EXECUTE ON FUNCTION public.bater_ponto_admin_retroativo TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.aprovar_ponto_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.listar_registros_admin_full TO authenticated;
