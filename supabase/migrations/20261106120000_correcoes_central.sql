-- Correções da revisão de 06/11/2026 (Central de protocolos).
-- Aditiva e idempotente (só CREATE OR REPLACE / funções novas). Não altera dados existentes.
--  1) Notificações: quando nenhum membro responde pelo setor/curso, a administração é avisada,
--     e o admin passa a ver quais setores estão sem responsável (setores_sem_responsavel).
--  3) Primeiro acesso: aluno_pre_validar confere matrícula + CPF + nascimento ANTES de criar a conta
--     (mesmo limite de 5 tentativas / 15 min por matrícula do aluno_vincular_conta).
--  4) Validação pública: o nome do aluno também é mascarado na lista de assinaturas.
--  6) Prazos usam a data de Fortaleza (_hoje) em vez da data UTC do servidor; data de avaliação
--     futura é recusada. Extra: deferir atividades complementares com 0 h é recusado (use Indeferir).

-- ── Data local da instituição ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public._hoje()
RETURNS date LANGUAGE sql STABLE AS $$
  SELECT (now() AT TIME ZONE 'America/Fortaleza')::date;
$$;

-- ── 1) Notificação com fallback para a administração ─────────────────────
CREATE OR REPLACE FUNCTION public._notificar_setor(p public.protocolos, _titulo text, _mensagem text)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_qtd int;
BEGIN
  INSERT INTO public.notificacoes (destino_role, user_id, tipo, titulo, mensagem, link)
  SELECT DISTINCT 'equipe', u.uid, 'protocolo', _titulo, _mensagem, '/central/equipe/protocolos/' || p.id
    FROM (
      SELECT m.user_id AS uid FROM public.setor_membros m
       WHERE m.setor_id = p.setor_atual AND (m.curso_id IS NULL OR m.curso_id = p.curso_id)
      UNION
      SELECT pr.user_id FROM public.coordenadores c JOIN public.professores pr ON pr.id = c.professor_id
       WHERE p.setor_atual IN ('coordenacao','comissao_tcc') AND pr.user_id IS NOT NULL AND p.curso_id = ANY(c.cursos)
      UNION
      SELECT r.user_id FROM public.user_roles r WHERE p.setor_atual = 'secretaria' AND r.role = 'secretaria'
    ) u
   WHERE u.uid IS NOT NULL;
  GET DIAGNOSTICS v_qtd = ROW_COUNT;

  -- Ninguém responde por este setor/curso: avisa a administração para não deixar o pedido parado.
  IF v_qtd = 0 THEN
    INSERT INTO public.notificacoes (destino_role, user_id, tipo, titulo, mensagem, link)
    SELECT DISTINCT 'admin', r.user_id, 'protocolo', _titulo,
           _mensagem || ' — Atenção: nenhum responsável cadastrado para ' ||
           coalesce((SELECT nome FROM public.setores WHERE id = p.setor_atual), p.setor_atual) ||
           ' (' || public._curso_nome(p.curso_id) || '). Configure em Admin › Equipe e setores.',
           '/admin/protocolos/' || p.id
      FROM public.user_roles r WHERE r.role = 'admin';
  END IF;
END;
$$;

-- Setores (e cursos, para coordenação/comissão) que hoje não têm ninguém para tramitar.
CREATE OR REPLACE FUNCTION public.setores_sem_responsavel()
RETURNS TABLE (setor_id text, setor_nome text, curso_id text, curso_nome text, protocolos_parados bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  WITH cursos AS (
    SELECT c->>'id' AS id FROM public.app_settings s, jsonb_array_elements(s.data->'cursos') c
  ), alvo AS (
    SELECT s.id AS setor, s.nome, cu.id AS curso
      FROM public.setores s CROSS JOIN cursos cu
     WHERE s.ativo AND s.id IN ('coordenacao','comissao_tcc')
    UNION ALL
    SELECT s.id, s.nome, NULL FROM public.setores s WHERE s.ativo AND s.id NOT IN ('coordenacao','comissao_tcc')
  )
  SELECT a.setor, a.nome, a.curso, CASE WHEN a.curso IS NULL THEN NULL ELSE public._curso_nome(a.curso) END,
         (SELECT count(*) FROM public.protocolos p
           WHERE p.setor_atual = a.setor AND p.status IN ('aberto','em_analise')
             AND (a.curso IS NULL OR p.curso_id = a.curso))
    FROM alvo a
   WHERE NOT EXISTS (SELECT 1 FROM public.setor_membros m
                      WHERE m.setor_id = a.setor AND (a.curso IS NULL OR m.curso_id IS NULL OR m.curso_id = a.curso))
     AND NOT (a.setor IN ('coordenacao','comissao_tcc') AND EXISTS (
           SELECT 1 FROM public.coordenadores c JOIN public.professores pr ON pr.id = c.professor_id
            WHERE pr.user_id IS NOT NULL AND a.curso = ANY(c.cursos)))
     AND NOT (a.setor = 'secretaria' AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.role = 'secretaria'))
   ORDER BY a.nome, a.curso;
END;
$$;

-- ── 3) Pré-validação do primeiro acesso (antes de criar a conta) ──────────
-- Responde só ok/erro genérico; conta tentativa na mesma chave do vínculo (5 a cada 15 min).
CREATE OR REPLACE FUNCTION public.aluno_pre_validar(p_matricula text, p_cpf text, p_nascimento date)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_chave text := 'vinc:' || lower(trim(coalesce(p_matricula, '')));
  v_t public.acesso_tentativas;
  v_aluno public.alunos;
BEGIN
  INSERT INTO public.acesso_tentativas (chave) VALUES (v_chave) ON CONFLICT (chave) DO NOTHING;
  SELECT * INTO v_t FROM public.acesso_tentativas WHERE chave = v_chave FOR UPDATE;
  IF v_t.bloqueado_ate IS NOT NULL AND v_t.bloqueado_ate > now() THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Muitas tentativas. Aguarde 15 minutos e tente de novo.');
  END IF;
  IF v_t.janela_inicio < now() - interval '15 minutes' THEN
    UPDATE public.acesso_tentativas SET tentativas = 0, janela_inicio = now(), bloqueado_ate = NULL WHERE chave = v_chave;
    v_t.tentativas := 0;
  END IF;

  SELECT * INTO v_aluno FROM public.alunos
   WHERE lower(matricula) = lower(trim(p_matricula))
     AND cpf = regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g')
     AND data_nascimento = p_nascimento
     AND situacao <> 'cancelado';

  IF v_aluno.id IS NULL THEN
    UPDATE public.acesso_tentativas
       SET tentativas = v_t.tentativas + 1,
           bloqueado_ate = CASE WHEN v_t.tentativas + 1 >= 5 THEN now() + interval '15 minutes' END
     WHERE chave = v_chave;
    RETURN jsonb_build_object('ok', false, 'erro', 'Não foi possível confirmar seus dados. Confira matrícula, CPF e data de nascimento ou procure a secretaria.');
  END IF;
  IF v_aluno.user_id IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'erro', 'Esta matrícula já tem conta. Entre pela tela inicial ou use "Esqueci minha senha".');
  END IF;
  RETURN jsonb_build_object('ok', true);
END;
$$;

-- ── 4) Validação pública: nome do aluno mascarado também nas assinaturas ──
CREATE OR REPLACE FUNCTION public.documento_validar(p_codigo text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cod text := upper(regexp_replace(coalesce(p_codigo, ''), '\s', '', 'g'));
  v_doc public.documentos;
  v_mat text;
BEGIN
  IF v_cod !~ '^IPD-[A-Z2-9]{4}-[A-Z2-9]{4}$' THEN
    RETURN jsonb_build_object('encontrado', false);
  END IF;
  IF (SELECT count(*) FROM public.documento_consultas WHERE codigo = v_cod AND created_at > now() - interval '10 minutes') >= 30 THEN
    RETURN jsonb_build_object('encontrado', false, 'erro', 'Muitas consultas para este código. Tente novamente em alguns minutos.');
  END IF;
  INSERT INTO public.documento_consultas (codigo) VALUES (v_cod);

  SELECT * INTO v_doc FROM public.documentos WHERE codigo = v_cod;
  IF v_doc.id IS NULL THEN
    RETURN jsonb_build_object('encontrado', false);
  END IF;
  v_mat := v_doc.snapshot#>>'{aluno,matricula}';
  RETURN jsonb_build_object(
    'encontrado', true,
    'codigo', v_doc.codigo,
    'tipo', (SELECT nome FROM public.documento_modelos WHERE id = v_doc.modelo_id),
    'titulo', v_doc.titulo,
    'status', v_doc.status,
    'titular', public._mascarar_nome(v_doc.snapshot#>>'{aluno,nome}'),
    'matricula', CASE WHEN v_mat IS NULL THEN NULL ELSE repeat('*', greatest(length(v_mat) - 3, 1)) || right(v_mat, 3) END,
    'emitido_em', v_doc.emitido_em,
    'cancelado_em', v_doc.cancelado_em,
    'sha256', v_doc.sha256,
    'signatarios', coalesce((SELECT jsonb_agg(jsonb_build_object(
                                 'nome', CASE WHEN a.papel = 'aluno' THEN public._mascarar_nome(a.nome_signatario) ELSE a.nome_signatario END,
                                 'cargo', a.cargo, 'status', a.status, 'assinado_em', a.assinado_em) ORDER BY a.ordem)
                               FROM public.documento_assinaturas a WHERE a.documento_id = v_doc.id), '[]'::jsonb));
END;
$$;

-- ── 6) Abertura e tramitação com data de Fortaleza ────────────────────────
CREATE OR REPLACE FUNCTION public.protocolo_abrir(p_id uuid, p_tipo text, p_dados jsonb, p_anexos jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_aluno public.alunos;
  v_tipo public.protocolo_tipos;
  v_p public.protocolos;
  v_campo jsonb;
  v_def jsonb;
  v_item jsonb;
  v_cont jsonb;
  v_ano text := to_char(now() AT TIME ZONE 'America/Fortaleza', 'YYYY');
  v_numero text;
  v_prazo jsonb;
  v_data_ref date;
  v_tramite uuid;
  v_etapa jsonb;
BEGIN
  SELECT * INTO v_aluno FROM public.alunos WHERE user_id = auth.uid() AND auth.uid() IS NOT NULL;
  IF v_aluno.id IS NULL THEN
    RAISE EXCEPTION 'Somente alunos com conta vinculada podem abrir protocolos' USING ERRCODE = '42501';
  END IF;
  IF v_aluno.situacao <> 'ativo' THEN
    RAISE EXCEPTION 'Matrícula não está ativa. Procure a secretaria.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_tipo FROM public.protocolo_tipos WHERE id = p_tipo AND ativo;
  IF v_tipo.id IS NULL THEN
    RAISE EXCEPTION 'Tipo de protocolo indisponível' USING ERRCODE = '22023';
  END IF;
  IF p_id IS NULL OR EXISTS (SELECT 1 FROM public.protocolos WHERE id = p_id) THEN
    RAISE EXCEPTION 'Identificador inválido' USING ERRCODE = '22023';
  END IF;
  p_dados := coalesce(p_dados, '{}');

  FOR v_campo IN SELECT * FROM jsonb_array_elements(v_tipo.campos) LOOP
    IF coalesce((v_campo->>'obrigatorio')::boolean, false) AND public._valor_vazio(p_dados->(v_campo->>'id')) THEN
      RAISE EXCEPTION 'Campo obrigatório: %', v_campo->>'rotulo' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  IF p_tipo = 'atividades_complementares' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(coalesce(p_dados->'itens', '[]')) LOOP
      IF public._valor_vazio(v_item->'descricao') OR coalesce((v_item->>'horas_declaradas')::numeric, 0) <= 0
         OR public._valor_vazio(v_item->'anexo_path') THEN
        RAISE EXCEPTION 'Cada atividade precisa de descrição, carga horária e certificado' USING ERRCODE = '22023';
      END IF;
    END LOOP;
  END IF;
  IF p_tipo = 'segunda_chamada' AND NOT public._valor_vazio(p_dados->'data_avaliacao')
     AND (p_dados->>'data_avaliacao')::date > public._hoje() THEN
    RAISE EXCEPTION 'A data da avaliação perdida não pode ser futura' USING ERRCODE = '22023';
  END IF;
  IF p_tipo = 'abono_faltas' AND (p_dados->>'data_fim')::date < (p_dados->>'data_inicio')::date THEN
    RAISE EXCEPTION 'A data final deve ser igual ou posterior à inicial' USING ERRCODE = '22023';
  END IF;
  IF NOT public._valor_vazio(p_dados->'materia_id') AND NOT EXISTS (
       SELECT 1 FROM public.turma_materias WHERE turma_id = v_aluno.turma_id AND materia_id::text = p_dados->>'materia_id') THEN
    RAISE EXCEPTION 'Disciplina não pertence à sua turma' USING ERRCODE = '22023';
  END IF;
  -- Guarda os nomes vigentes na abertura (exibição e registro histórico).
  p_dados := p_dados || jsonb_strip_nulls(jsonb_build_object(
    'materia_nome', (SELECT nome FROM public.materias WHERE id::text = p_dados->>'materia_id'),
    'professor_nome', (SELECT nome FROM public.professores WHERE id::text = p_dados->>'professor_id'),
    'orientador_nome', (SELECT nome FROM public.professores WHERE id::text = p_dados->>'orientador_id'),
    'disciplinas_nomes', (SELECT jsonb_agg(m.nome ORDER BY m.nome) FROM public.materias m
                           WHERE jsonb_typeof(p_dados->'disciplinas') = 'array'
                             AND m.id::text IN (SELECT jsonb_array_elements_text(p_dados->'disciplinas')))));

  PERFORM pg_advisory_xact_lock(hashtext('protocolo_numero_' || v_ano));
  SELECT v_ano || '.' || lpad((coalesce(max(split_part(numero, '.', 2)::int), 0) + 1)::text, 6, '0')
    INTO v_numero FROM public.protocolos WHERE numero LIKE v_ano || '.%';

  v_etapa := v_tipo.etapas->0;
  v_prazo := v_tipo.prazo_regimental;
  IF v_prazo IS NOT NULL AND NOT public._valor_vazio(p_dados->(v_prazo->>'campo')) THEN
    v_data_ref := (p_dados->>(v_prazo->>'campo'))::date;
  END IF;

  INSERT INTO public.protocolos (id, numero, tipo_id, aluno_id, curso_id, turma_id, dados, status, etapa_atual, setor_atual,
                                 fora_do_prazo, prazo_resposta_em)
  VALUES (p_id, v_numero, v_tipo.id, v_aluno.id, v_aluno.curso_id, v_aluno.turma_id, p_dados, 'aberto', 1, v_etapa->>'setor',
          v_data_ref IS NOT NULL AND public._hoje() > public.dias_uteis_apos(v_data_ref, (v_prazo->>'dias_uteis')::int),
          public.dias_uteis_apos(public._hoje(), v_tipo.prazo_resposta_dias_uteis))
  RETURNING * INTO v_p;

  INSERT INTO public.protocolo_tramites (protocolo_id, etapa, setor_id, acao, parecer, visivel_aluno, user_id)
  VALUES (v_p.id, 0, NULL, 'abertura', 'Protocolo aberto pelo aluno.', true, auth.uid())
  RETURNING id INTO v_tramite;

  v_cont := public._protocolo_gravar_anexos(v_p, v_tipo, p_anexos, v_tramite, false);
  FOR v_def IN SELECT * FROM jsonb_array_elements(v_tipo.anexos) LOOP
    IF coalesce((v_def->>'obrigatorio')::boolean, false) AND coalesce((v_cont->>(v_def->>'id'))::int, 0) = 0 THEN
      RAISE EXCEPTION 'Anexo obrigatório: %', v_def->>'rotulo' USING ERRCODE = '22023';
    END IF;
    IF NOT coalesce((v_def->>'multiplo')::boolean, false) AND coalesce((v_cont->>(v_def->>'id'))::int, 0) > 1 THEN
      RAISE EXCEPTION 'Envie apenas um arquivo em: %', v_def->>'rotulo' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  IF p_tipo = 'atividades_complementares' AND EXISTS (
       SELECT 1 FROM jsonb_array_elements(p_dados->'itens') i
        WHERE NOT EXISTS (SELECT 1 FROM public.protocolo_anexos a WHERE a.protocolo_id = v_p.id AND a.storage_path = i->>'anexo_path')) THEN
    RAISE EXCEPTION 'Certificado de uma atividade não foi enviado' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.academico_audit_logs (user_id, acao, entidade, entidade_id, new_data)
  VALUES (auth.uid(), 'abrir', 'protocolos', v_p.id::text, to_jsonb(v_p));

  PERFORM public._notificar_setor(v_p, 'Novo protocolo ' || v_numero, v_tipo.nome || ' — ' || v_aluno.nome);
  PERFORM public._documento_criar('comprovante_protocolo', v_p.id, '{}'::jsonb);

  RETURN jsonb_build_object('id', v_p.id, 'numero', v_numero, 'fora_do_prazo', v_p.fora_do_prazo);
END;
$$;

CREATE OR REPLACE FUNCTION public.protocolo_tramitar(p_id uuid, p_acao text, p_parecer text, p_dados jsonb, p_setor_destino text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_p public.protocolos;
  v_old public.protocolos;
  v_tipo public.protocolo_tipos;
  v_aluno public.alunos;
  v_etapa jsonb;
  v_prox jsonb;
  v_regra text;
  v_campo jsonb;
  v_item jsonb;
  v_orig jsonb;
  v_cat public.ac_categorias;
  v_usado numeric;
  v_horas numeric;
  v_fim text; -- NULL | 'deferido' | 'indeferido'
  v_msg text;
  v_doc text;
BEGIN
  p_dados := coalesce(p_dados, '{}');
  SELECT * INTO v_p FROM public.protocolos WHERE id = p_id FOR UPDATE;
  IF v_p.id IS NULL THEN
    RAISE EXCEPTION 'Protocolo não encontrado' USING ERRCODE = '42501';
  END IF;
  v_old := v_p;
  IF NOT public.pode_atuar_setor(v_p.setor_atual, v_p.curso_id) THEN
    RAISE EXCEPTION 'Você não pode tramitar protocolos deste setor' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_tipo FROM public.protocolo_tipos WHERE id = v_p.tipo_id;
  SELECT * INTO v_aluno FROM public.alunos WHERE id = v_p.aluno_id;
  v_etapa := v_tipo.etapas->(v_p.etapa_atual - 1);

  IF p_acao = 'comentar' THEN
    IF coalesce(trim(p_parecer), '') = '' THEN
      RAISE EXCEPTION 'Escreva o comentário' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.protocolo_tramites (protocolo_id, etapa, setor_id, acao, parecer, visivel_aluno, user_id)
    VALUES (v_p.id, v_p.etapa_atual, v_p.setor_atual, 'comentar', trim(p_parecer),
            coalesce((p_dados->>'visivel_aluno')::boolean, false), auth.uid());
    IF coalesce((p_dados->>'visivel_aluno')::boolean, false) THEN
      PERFORM public._notificar_aluno(v_p, 'Novo comentário no protocolo ' || v_p.numero, trim(p_parecer));
    END IF;
    RETURN jsonb_build_object('status', v_p.status);
  END IF;

  IF v_p.status NOT IN ('aberto','em_analise') THEN
    RAISE EXCEPTION 'Protocolo não está em análise (situação: %)', v_p.status USING ERRCODE = '22023';
  END IF;
  IF v_etapa IS NULL OR NOT (v_etapa->'acoes' ? p_acao) THEN
    RAISE EXCEPTION 'Ação não permitida nesta etapa' USING ERRCODE = '22023';
  END IF;
  IF p_acao IN ('indeferir','solicitar_complementacao') AND coalesce(trim(p_parecer), '') = '' THEN
    RAISE EXCEPTION 'O parecer é obrigatório para esta ação' USING ERRCODE = '22023';
  END IF;
  FOR v_campo IN SELECT * FROM jsonb_array_elements(coalesce(v_etapa->'campos_acao', '[]')) LOOP
    IF v_campo->>'acao' = p_acao AND coalesce((v_campo->>'obrigatorio')::boolean, false)
       AND public._valor_vazio(p_dados->(v_campo->>'id')) THEN
      RAISE EXCEPTION 'Campo obrigatório: %', v_campo->>'rotulo' USING ERRCODE = '22023';
    END IF;
  END LOOP;

  -- Registra o trâmite na etapa/setor em que a ação foi tomada.
  INSERT INTO public.protocolo_tramites (protocolo_id, etapa, setor_id, acao, parecer, dados, visivel_aluno, user_id)
  VALUES (v_p.id, v_p.etapa_atual, v_p.setor_atual, p_acao, nullif(trim(p_parecer), ''), p_dados, true, auth.uid());

  IF p_acao = 'solicitar_complementacao' THEN
    UPDATE public.protocolos SET status = 'aguardando_aluno',
           prazo_resposta_em = public.dias_uteis_apos(public._hoje(), v_tipo.prazo_resposta_dias_uteis), updated_at = now()
     WHERE id = v_p.id RETURNING * INTO v_p;
    PERFORM public._notificar_aluno(v_p, 'Complementação solicitada — ' || v_p.numero, trim(p_parecer));

  ELSIF p_acao = 'indeferir' THEN
    v_fim := 'indeferido';

  ELSIF p_acao = 'encaminhar' THEN
    IF p_setor_destino IS NULL OR p_setor_destino = v_p.setor_atual
       OR NOT EXISTS (SELECT 1 FROM public.setores WHERE id = p_setor_destino AND ativo) THEN
      RAISE EXCEPTION 'Escolha um setor de destino válido' USING ERRCODE = '22023';
    END IF;
    UPDATE public.protocolos SET etapa_atual = LEAST(etapa_atual + 1, jsonb_array_length(v_tipo.etapas)),
           setor_atual = p_setor_destino, status = 'em_analise', updated_at = now()
     WHERE id = v_p.id RETURNING * INTO v_p;
    PERFORM public._notificar_setor(v_p, 'Protocolo encaminhado — ' || v_p.numero, v_tipo.nome || ' — ' || v_aluno.nome);
    PERFORM public._notificar_aluno(v_p, 'Protocolo ' || v_p.numero || ' encaminhado',
      'Seu protocolo foi encaminhado para ' || (SELECT nome FROM public.setores WHERE id = p_setor_destino) || '.');

  ELSE -- deferir | concluir
    v_regra := coalesce(v_etapa->>CASE WHEN p_acao = 'concluir' THEN 'ao_concluir' ELSE 'ao_deferir' END, 'encerrar');

    -- Efeitos intermediários
    IF v_tipo.id = 'tcc_final' AND p_dados ? 'nota_homologada' THEN
      v_p.dados := v_p.dados || jsonb_build_object('nota_homologada', (p_dados->>'nota_homologada')::numeric);
    END IF;
    IF v_tipo.id = 'segunda_chamada' AND p_acao = 'concluir' THEN
      v_p.dados := v_p.dados || jsonb_build_object('agendamento', p_dados);
    END IF;
    IF v_tipo.id = 'atividades_complementares' THEN
      IF jsonb_array_length(coalesce(p_dados->'itens', '[]')) <> jsonb_array_length(coalesce(v_p.dados->'itens', '[]')) THEN
        RAISE EXCEPTION 'Avalie todas as atividades' USING ERRCODE = '22023';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(p_dados->'itens') i
                      WHERE coalesce((i->>'autentico')::boolean, false) AND coalesce((i->>'horas_deferidas')::numeric, 0) > 0) THEN
        RAISE EXCEPTION 'Nenhuma hora foi deferida. Para recusar todas as atividades, use Indeferir.' USING ERRCODE = '22023';
      END IF;
      FOR v_item IN SELECT * FROM jsonb_array_elements(p_dados->'itens') LOOP
        v_orig := v_p.dados->'itens'->((v_item->>'indice')::int);
        v_horas := coalesce((v_item->>'horas_deferidas')::numeric, 0);
        IF v_orig IS NULL THEN
          RAISE EXCEPTION 'Atividade inexistente' USING ERRCODE = '22023';
        END IF;
        CONTINUE WHEN NOT coalesce((v_item->>'autentico')::boolean, false) OR v_horas <= 0;
        IF v_horas > (v_orig->>'horas_declaradas')::numeric THEN
          RAISE EXCEPTION 'Horas deferidas acima das declaradas em "%"', v_orig->>'descricao' USING ERRCODE = '22023';
        END IF;
        SELECT * INTO v_cat FROM public.ac_categorias WHERE id = v_item->>'categoria_id' AND ativo;
        IF v_cat.id IS NULL THEN
          RAISE EXCEPTION 'Escolha a categoria de "%"', v_orig->>'descricao' USING ERRCODE = '22023';
        END IF;
        SELECT coalesce(sum(horas_deferidas), 0) INTO v_usado FROM public.aluno_horas_complementares
         WHERE aluno_id = v_p.aluno_id AND categoria_id = v_cat.id;
        IF v_usado + v_horas > v_cat.limite_horas THEN
          RAISE EXCEPTION 'Limite da categoria "%" excedido: restam % h', v_cat.nome, greatest(v_cat.limite_horas - v_usado, 0) USING ERRCODE = '22023';
        END IF;
        INSERT INTO public.aluno_horas_complementares (aluno_id, protocolo_id, categoria_id, descricao, emissor, data_atividade, horas_declaradas, horas_deferidas)
        VALUES (v_p.aluno_id, v_p.id, v_cat.id, v_orig->>'descricao', v_orig->>'emissor',
                nullif(v_orig->>'data', '')::date, (v_orig->>'horas_declaradas')::numeric, v_horas);
      END LOOP;
    END IF;

    v_prox := v_tipo.etapas->(v_p.etapa_atual);
    IF v_regra = 'proxima' AND v_prox IS NOT NULL AND v_prox->>'setor' <> '*' THEN
      UPDATE public.protocolos SET etapa_atual = etapa_atual + 1, setor_atual = v_prox->>'setor',
             status = 'em_analise', dados = v_p.dados, updated_at = now()
       WHERE id = v_p.id RETURNING * INTO v_p;
      PERFORM public._notificar_setor(v_p, 'Protocolo para sua etapa — ' || v_p.numero, v_tipo.nome || ' — ' || v_aluno.nome);
      PERFORM public._notificar_aluno(v_p, 'Protocolo ' || v_p.numero || ' avançou', 'Etapa atual: ' || coalesce(v_prox->>'nome', v_prox->>'setor') || '.');
    ELSE
      v_fim := 'deferido';
    END IF;
  END IF;

  IF v_fim IS NOT NULL THEN
    UPDATE public.protocolos SET status = CASE WHEN v_fim = 'deferido' THEN 'concluido' ELSE 'indeferido' END,
           decisao = v_fim, parecer_final = nullif(trim(p_parecer), ''), concluido_em = now(),
           dados = v_p.dados, updated_at = now()
     WHERE id = v_p.id RETURNING * INTO v_p;

    IF v_fim = 'deferido' THEN
      IF v_tipo.id = 'tcc_projeto' THEN
        INSERT INTO public.aluno_tcc (aluno_id, titulo, orientador_id, situacao, protocolo_projeto_id)
        VALUES (v_p.aluno_id, v_p.dados->>'titulo', nullif(v_p.dados->>'orientador_id', '')::uuid, 'projeto_aceito', v_p.id)
        ON CONFLICT (aluno_id) DO UPDATE SET titulo = EXCLUDED.titulo, orientador_id = EXCLUDED.orientador_id,
          situacao = 'projeto_aceito', protocolo_projeto_id = EXCLUDED.protocolo_projeto_id, updated_at = now();
      ELSIF v_tipo.id = 'tcc_final' THEN
        INSERT INTO public.aluno_tcc (aluno_id, titulo, orientador_id, situacao, nota_final, protocolo_final_id, homologado_em)
        VALUES (v_p.aluno_id, v_p.dados->>'titulo_final', nullif(v_p.dados->>'orientador_id', '')::uuid, 'concluido',
                (v_p.dados->>'nota_homologada')::numeric, v_p.id, now())
        ON CONFLICT (aluno_id) DO UPDATE SET titulo = EXCLUDED.titulo, orientador_id = EXCLUDED.orientador_id,
          situacao = 'concluido', nota_final = EXCLUDED.nota_final, protocolo_final_id = EXCLUDED.protocolo_final_id,
          homologado_em = now(), updated_at = now();
      ELSIF v_tipo.id = 'segunda_chamada' THEN
        INSERT INTO public.notificacoes (destino_role, professor_id, tipo, titulo, mensagem)
        SELECT 'professor', pr.id, 'segunda_chamada', 'Segunda chamada agendada',
               v_aluno.nome || ' (' || v_aluno.matricula || ') — ' || coalesce(m.nome, 'disciplina') || ': '
               || to_char((v_p.dados#>>'{agendamento,data_prova}')::date, 'DD/MM/YYYY') || ' às '
               || coalesce(v_p.dados#>>'{agendamento,horario}', '') || ', ' || coalesce(v_p.dados#>>'{agendamento,local}', '') || '.'
          FROM public.professores pr
          LEFT JOIN public.materias m ON m.id = nullif(v_p.dados->>'materia_id', '')::uuid
         WHERE pr.id = nullif(v_p.dados->>'professor_id', '')::uuid;
      ELSIF v_tipo.id = 'abono_faltas' THEN
        -- O professor recebe só o período abonado, nunca o atestado.
        INSERT INTO public.notificacoes (destino_role, professor_id, tipo, titulo, mensagem)
        SELECT DISTINCT 'professor', h.professor_id, 'abono_faltas', 'Falta abonada',
               v_aluno.nome || ' (' || v_aluno.matricula || ') teve falta abonada de '
               || to_char((v_p.dados->>'data_inicio')::date, 'DD/MM/YYYY') || ' a '
               || to_char((v_p.dados->>'data_fim')::date, 'DD/MM/YYYY')
               || '. Registre o abono ou combine a compensação das atividades.'
          FROM public.horarios_aula h
         WHERE h.turma_id = v_p.turma_id
           AND h.materia_id::text IN (SELECT jsonb_array_elements_text(coalesce(v_p.dados->'disciplinas', '[]')));
      END IF;
    END IF;

    v_msg := CASE WHEN v_fim = 'deferido' THEN 'Seu protocolo foi deferido.' ELSE 'Seu protocolo foi indeferido.' END
             || coalesce(' Parecer: ' || nullif(trim(p_parecer), ''), '');
    PERFORM public._notificar_aluno(v_p, 'Protocolo ' || v_p.numero || ' ' || v_fim, v_msg);

    v_doc := CASE WHEN v_fim = 'deferido' THEN coalesce(v_tipo.gera_documento, 'parecer_protocolo') ELSE 'parecer_protocolo' END;
    PERFORM public._documento_criar(v_doc, v_p.id, '{}'::jsonb);
  END IF;

  INSERT INTO public.academico_audit_logs (user_id, acao, entidade, entidade_id, old_data, new_data)
  VALUES (auth.uid(), p_acao, 'protocolos', v_p.id::text, to_jsonb(v_old), to_jsonb(v_p));

  RETURN jsonb_build_object('status', v_p.status, 'etapa_atual', v_p.etapa_atual, 'setor_atual', v_p.setor_atual);
END;
$$;

-- ── Grants ────────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public._notificar_setor(public.protocolos, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.setores_sem_responsavel() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.setores_sem_responsavel() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.aluno_pre_validar(text, text, date) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.aluno_pre_validar(text, text, date) TO anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.documento_validar(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.documento_validar(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public._hoje() TO authenticated;
