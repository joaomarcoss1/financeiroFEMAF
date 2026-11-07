-- F6/F7 — Migration C: protocolos acadêmicos (F7).
-- Aditiva e idempotente. Depende das Migrations A e B.
-- Escrita somente pelas RPCs SECURITY DEFINER abaixo; nenhuma policy de INSERT/UPDATE para authenticated.
-- As funções referenciam public.documentos/documento_criar (Migration D); o plpgsql resolve na execução.

-- ── Tabelas ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.protocolo_tipos (
  id text PRIMARY KEY,
  nome text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  instrucoes_aluno text NOT NULL DEFAULT '',
  campos jsonb NOT NULL DEFAULT '[]',
  anexos jsonb NOT NULL DEFAULT '[]',
  etapas jsonb NOT NULL DEFAULT '[]',
  prazo_regimental jsonb,
  prazo_resposta_dias_uteis int NOT NULL DEFAULT 5,
  gera_documento text,
  ativo boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.protocolos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero text NOT NULL UNIQUE,
  tipo_id text NOT NULL REFERENCES public.protocolo_tipos(id),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id),
  curso_id text NOT NULL,
  turma_id uuid REFERENCES public.turmas(id) ON DELETE SET NULL,
  dados jsonb NOT NULL DEFAULT '{}',
  status text NOT NULL DEFAULT 'aberto'
    CHECK (status IN ('aberto','em_analise','aguardando_aluno','deferido','indeferido','concluido','cancelado')),
  etapa_atual int NOT NULL DEFAULT 1,
  setor_atual text REFERENCES public.setores(id),
  fora_do_prazo boolean NOT NULL DEFAULT false,
  prazo_resposta_em date,
  aberto_em timestamptz NOT NULL DEFAULT now(),
  concluido_em timestamptz,
  decisao text CHECK (decisao IN ('deferido','indeferido')),
  parecer_final text,
  cancelado_em timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_protocolos_aluno ON public.protocolos(aluno_id);
CREATE INDEX IF NOT EXISTS idx_protocolos_setor ON public.protocolos(setor_atual, status);

CREATE TABLE IF NOT EXISTS public.protocolo_tramites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo_id uuid NOT NULL REFERENCES public.protocolos(id) ON DELETE CASCADE,
  etapa int NOT NULL,
  setor_id text,
  acao text NOT NULL,
  parecer text,
  dados jsonb NOT NULL DEFAULT '{}',
  visivel_aluno boolean NOT NULL DEFAULT true,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tramites_protocolo ON public.protocolo_tramites(protocolo_id, created_at);

CREATE TABLE IF NOT EXISTS public.protocolo_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  protocolo_id uuid NOT NULL REFERENCES public.protocolos(id) ON DELETE CASCADE,
  tramite_id uuid REFERENCES public.protocolo_tramites(id) ON DELETE SET NULL,
  tipo_anexo text NOT NULL,
  nome_arquivo text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  mime text,
  tamanho bigint,
  sha256 text,
  enviado_por uuid,
  sensivel boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_anexos_protocolo ON public.protocolo_anexos(protocolo_id);

CREATE TABLE IF NOT EXISTS public.aluno_tcc (
  aluno_id uuid PRIMARY KEY REFERENCES public.alunos(id) ON DELETE CASCADE,
  titulo text,
  orientador_id uuid REFERENCES public.professores(id) ON DELETE SET NULL,
  situacao text NOT NULL DEFAULT 'projeto_aceito' CHECK (situacao IN ('projeto_aceito','concluido')),
  nota_final numeric(5,2),
  protocolo_projeto_id uuid REFERENCES public.protocolos(id),
  protocolo_final_id uuid REFERENCES public.protocolos(id),
  homologado_em timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.ac_categorias (
  id text PRIMARY KEY,
  nome text NOT NULL,
  limite_horas numeric(6,1) NOT NULL CHECK (limite_horas >= 0),
  ativo boolean NOT NULL DEFAULT true
);
-- Valores iniciais: a secretaria ajusta os limites conforme o regulamento de cada curso.
INSERT INTO public.ac_categorias (id, nome, limite_horas) VALUES
  ('ensino','Ensino (monitoria, cursos, disciplinas extras)', 60),
  ('pesquisa','Pesquisa (iniciação científica, publicações)', 60),
  ('extensao','Extensão (projetos, ações comunitárias)', 60),
  ('eventos','Eventos científicos (congressos, seminários, palestras)', 40),
  ('cultural','Atividades culturais e sociais', 30),
  ('outras','Outras atividades', 20)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.aluno_horas_complementares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  aluno_id uuid NOT NULL REFERENCES public.alunos(id) ON DELETE CASCADE,
  protocolo_id uuid REFERENCES public.protocolos(id),
  categoria_id text NOT NULL REFERENCES public.ac_categorias(id),
  descricao text NOT NULL,
  emissor text,
  data_atividade date,
  horas_declaradas numeric(6,1) NOT NULL,
  horas_deferidas numeric(6,1) NOT NULL CHECK (horas_deferidas >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_horas_ac_aluno ON public.aluno_horas_complementares(aluno_id, categoria_id);

-- ── Seed dos 6 tipos (seção 2 da especificação) ─────────────────────────────
INSERT INTO public.protocolo_tipos (id, nome, descricao, instrucoes_aluno, campos, anexos, etapas, prazo_regimental, prazo_resposta_dias_uteis, gera_documento, ordem) VALUES
('segunda_chamada', 'Segunda chamada de avaliação',
 'Pedido de nova data para avaliação perdida por impedimento justificado.',
 'Abra o pedido em até 3 dias úteis após a data da prova e anexe o comprovante do impedimento (atestado, declaração de trabalho, certidão).',
 '[{"id":"materia_id","rotulo":"Disciplina","tipo":"materia","obrigatorio":true},
   {"id":"professor_id","rotulo":"Professor","tipo":"professor","obrigatorio":false,"ajuda":"Preenchido pela grade da turma."},
   {"id":"data_avaliacao","rotulo":"Data da avaliação perdida","tipo":"date","obrigatorio":true},
   {"id":"avaliacao","rotulo":"Avaliação","tipo":"select","obrigatorio":true,"opcoes":["AV1","AV2","Final"]},
   {"id":"motivo","rotulo":"Motivo","tipo":"textarea","obrigatorio":true}]',
 '[{"id":"comprovante","rotulo":"Comprovante do impedimento","obrigatorio":true,"mimes":["application/pdf","image/jpeg","image/png"],"max_mb":10,"multiplo":true,"sensivel":true}]',
 '[{"ordem":1,"setor":"coordenacao","nome":"Análise da coordenação","acoes":["deferir","indeferir","solicitar_complementacao"],"ao_deferir":"proxima","ao_indeferir":"encerrar"},
   {"ordem":2,"setor":"secretaria","nome":"Agendamento pela secretaria","acoes":["concluir","solicitar_complementacao"],
    "campos_acao":[{"id":"taxa_valor","rotulo":"Taxa (R$)","tipo":"number","obrigatorio":false,"acao":"concluir"},
                   {"id":"boleto_link","rotulo":"Link do boleto","tipo":"text","obrigatorio":false,"acao":"concluir"},
                   {"id":"data_prova","rotulo":"Data da 2ª chamada","tipo":"date","obrigatorio":true,"acao":"concluir"},
                   {"id":"horario","rotulo":"Horário","tipo":"text","obrigatorio":true,"acao":"concluir"},
                   {"id":"local","rotulo":"Local","tipo":"text","obrigatorio":true,"acao":"concluir"}],
    "ao_concluir":"encerrar","notificar":["aluno","professor_disciplina"]}]',
 '{"campo":"data_avaliacao","dias_uteis":3}', 5, 'deferimento_segunda_chamada', 1),

('tcc_projeto', 'Depósito de projeto de TCC',
 'Entrega do projeto de TCC com o aceite do orientador.',
 'Anexe o projeto (PDF, DOC ou DOCX) e o termo de aceite assinado pelo orientador (PDF).',
 '[{"id":"titulo","rotulo":"Título do projeto","tipo":"text","obrigatorio":true},
   {"id":"orientador_id","rotulo":"Orientador","tipo":"professor","obrigatorio":true},
   {"id":"coorientador","rotulo":"Coorientador (opcional)","tipo":"text","obrigatorio":false},
   {"id":"linha_pesquisa","rotulo":"Linha de pesquisa","tipo":"text","obrigatorio":true}]',
 '[{"id":"projeto","rotulo":"Projeto","obrigatorio":true,"mimes":["application/pdf","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document"],"max_mb":10,"multiplo":false},
   {"id":"termo_aceite","rotulo":"Termo de aceite do orientador","obrigatorio":true,"mimes":["application/pdf"],"max_mb":10,"multiplo":false}]',
 '[{"ordem":1,"setor":"comissao_tcc","nome":"Coordenação / Comissão de TCC","acoes":["deferir","indeferir","solicitar_complementacao"],"ao_deferir":"proxima","ao_indeferir":"encerrar"},
   {"ordem":2,"setor":"secretaria","nome":"Registro no prontuário","acoes":["concluir","solicitar_complementacao"],"ao_concluir":"encerrar"}]',
 NULL, 5, 'termo_aceite_tcc', 2),

('tcc_final', 'Depósito final do TCC',
 'Entrega da versão final do TCC para homologação da nota.',
 'Anexe a versão final (PDF), o parecer da banca ou aprovação do orientador e a declaração de antiplágio / nada consta.',
 '[{"id":"titulo_final","rotulo":"Título final","tipo":"text","obrigatorio":true},
   {"id":"orientador_id","rotulo":"Orientador","tipo":"professor","obrigatorio":true},
   {"id":"data_defesa","rotulo":"Data da defesa","tipo":"date","obrigatorio":true},
   {"id":"banca","rotulo":"Membros da banca","tipo":"textarea","obrigatorio":true},
   {"id":"nota_final","rotulo":"Nota final","tipo":"number","obrigatorio":true}]',
 '[{"id":"versao_final","rotulo":"Versão final","obrigatorio":true,"mimes":["application/pdf"],"max_mb":10,"multiplo":false},
   {"id":"parecer_banca","rotulo":"Parecer da banca / aprovação do orientador","obrigatorio":true,"mimes":["application/pdf"],"max_mb":10,"multiplo":false},
   {"id":"antiplagio","rotulo":"Declaração de antiplágio / nada consta","obrigatorio":true,"mimes":["application/pdf"],"max_mb":10,"multiplo":false}]',
 '[{"ordem":1,"setor":"coordenacao","nome":"Homologação da coordenação","acoes":["deferir","indeferir","solicitar_complementacao"],
    "campos_acao":[{"id":"nota_homologada","rotulo":"Nota homologada","tipo":"number","obrigatorio":true,"acao":"deferir"}],
    "ao_deferir":"proxima","ao_indeferir":"encerrar"},
   {"ordem":2,"setor":"secretaria","nome":"Registro no histórico","acoes":["concluir","solicitar_complementacao"],"ao_concluir":"encerrar"}]',
 NULL, 5, 'homologacao_tcc', 3),

('abono_faltas', 'Abono ou justificativa de faltas',
 'Justificativa de faltas com documento oficial.',
 'Anexe o documento oficial (atestado, declaração das Forças Armadas, convocação judicial etc.). O atestado fica visível só para a coordenação e a secretaria.',
 '[{"id":"tipo_documento","rotulo":"Tipo de documento","tipo":"select","obrigatorio":true,"opcoes":["Atestado médico","Declaração das Forças Armadas","Convocação judicial","Outro documento oficial"]},
   {"id":"data_inicio","rotulo":"Data inicial","tipo":"date","obrigatorio":true},
   {"id":"data_fim","rotulo":"Data final","tipo":"date","obrigatorio":true},
   {"id":"disciplinas","rotulo":"Disciplinas afetadas","tipo":"materias","obrigatorio":true},
   {"id":"observacao","rotulo":"Observação","tipo":"textarea","obrigatorio":false}]',
 '[{"id":"documento_oficial","rotulo":"Documento oficial","obrigatorio":true,"mimes":["application/pdf","image/jpeg","image/png"],"max_mb":10,"multiplo":true,"sensivel":true}]',
 '[{"ordem":1,"setor":"coordenacao","nome":"Análise da coordenação","acoes":["deferir","indeferir","solicitar_complementacao"],"ao_deferir":"encerrar","ao_indeferir":"encerrar","notificar":["aluno","professores_disciplinas"]}]',
 NULL, 5, NULL, 4),

('atividades_complementares', 'Atividades complementares',
 'Aproveitamento de horas de atividades complementares.',
 'Cadastre cada atividade e anexe o certificado correspondente, com carga horária, data e emissor/CNPJ visíveis.',
 '[{"id":"itens","rotulo":"Atividades","tipo":"itens_ac","obrigatorio":true}]',
 '[{"id":"certificado","rotulo":"Certificado","obrigatorio":true,"mimes":["application/pdf","image/jpeg","image/png"],"max_mb":10,"multiplo":true}]',
 '[{"ordem":1,"setor":"coordenacao","nome":"Avaliação dos certificados","acoes":["deferir","indeferir","solicitar_complementacao"],
    "campos_acao":[{"id":"itens","rotulo":"Horas por atividade","tipo":"itens_ac_avaliacao","obrigatorio":true,"acao":"deferir"}],
    "ao_deferir":"encerrar","ao_indeferir":"encerrar"}]',
 NULL, 5, 'extrato_horas', 5),

('geral', 'Protocolo geral',
 'Requerimentos diversos encaminhados ao setor responsável.',
 'Descreva o pedido e anexe o requerimento fundamentado e/ou comprovantes.',
 '[{"id":"assunto","rotulo":"Assunto","tipo":"text","obrigatorio":true},
   {"id":"descricao","rotulo":"Descrição","tipo":"textarea","obrigatorio":true}]',
 '[{"id":"documentos","rotulo":"Requerimento e comprovantes","obrigatorio":true,"mimes":["application/pdf","image/jpeg","image/png","application/msword","application/vnd.openxmlformats-officedocument.wordprocessingml.document"],"max_mb":10,"multiplo":true}]',
 '[{"ordem":1,"setor":"secretaria","nome":"Triagem da secretaria","acoes":["encaminhar","deferir","indeferir","solicitar_complementacao"],"ao_deferir":"encerrar","ao_indeferir":"encerrar"},
   {"ordem":2,"setor":"*","nome":"Setor de destino","acoes":["deferir","indeferir","solicitar_complementacao"],"ao_deferir":"encerrar","ao_indeferir":"encerrar"}]',
 NULL, 5, NULL, 6)
ON CONFLICT (id) DO NOTHING;

-- ── Auxiliares ────────────────────────────────────────────────────────────
-- Data após n dias úteis (dias letivos do calendário acadêmico) contados a partir de d.
CREATE OR REPLACE FUNCTION public.dias_uteis_apos(d date, n int)
RETURNS date LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v date := d;
  c int := 0;
BEGIN
  WHILE c < n LOOP
    v := v + 1;
    IF public.is_dia_letivo(v) THEN c := c + 1; END IF;
  END LOOP;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public._nome_usuario(_uid uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(
    (SELECT nome FROM public.professores WHERE user_id = _uid LIMIT 1),
    (SELECT nome FROM public.alunos WHERE user_id = _uid LIMIT 1),
    (SELECT nullif(raw_user_meta_data->>'nome', '') FROM auth.users WHERE id = _uid),
    (SELECT email::text FROM auth.users WHERE id = _uid));
$$;

CREATE OR REPLACE FUNCTION public._protocolo_pode_ver(p public.protocolos)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.aluno_id = public.current_aluno_id()
      OR public.is_secretaria()
      OR public.pode_atuar_setor(p.setor_atual, p.curso_id)
      OR EXISTS (SELECT 1 FROM public.protocolo_tramites t
                  WHERE t.protocolo_id = p.id AND t.setor_id IS NOT NULL
                    AND public.pode_atuar_setor(t.setor_id, p.curso_id));
$$;

-- Anexos sensíveis (atestados/CID): só o próprio aluno, a coordenação do curso e a secretaria.
CREATE OR REPLACE FUNCTION public._protocolo_pode_ver_sensivel(p public.protocolos)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.aluno_id = public.current_aluno_id() OR public.is_secretaria() OR public.coordena_curso(p.curso_id);
$$;

CREATE OR REPLACE FUNCTION public.pode_ver_anexo(_name text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sensivel boolean;
  v_p public.protocolos;
BEGIN
  IF split_part(_name, '/', 1) = public.current_aluno_id()::text THEN
    RETURN true;
  END IF;
  SELECT a.sensivel INTO v_sensivel FROM public.protocolo_anexos a WHERE a.storage_path = _name;
  IF NOT FOUND THEN RETURN false; END IF;
  SELECT p.* INTO v_p FROM public.protocolos p JOIN public.protocolo_anexos a ON a.protocolo_id = p.id WHERE a.storage_path = _name;
  RETURN public._protocolo_pode_ver(v_p) AND (NOT v_sensivel OR public._protocolo_pode_ver_sensivel(v_p));
END;
$$;

CREATE OR REPLACE FUNCTION public._notificar_aluno(p public.protocolos, _titulo text, _mensagem text)
RETURNS void LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.notificacoes (destino_role, user_id, tipo, titulo, mensagem, link)
  SELECT 'aluno', a.user_id, 'protocolo', _titulo, _mensagem, '/central/protocolos/' || p.id
    FROM public.alunos a WHERE a.id = p.aluno_id AND a.user_id IS NOT NULL;
$$;

-- Notifica quem pode agir no setor atual do protocolo.
CREATE OR REPLACE FUNCTION public._notificar_setor(p public.protocolos, _titulo text, _mensagem text)
RETURNS void LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
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
$$;

-- Valida e grava anexos já enviados ao bucket. Retorna a quantidade por tipo de anexo.
CREATE OR REPLACE FUNCTION public._protocolo_gravar_anexos(p public.protocolos, t public.protocolo_tipos, _anexos jsonb, _tramite uuid, _livre boolean)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  a jsonb;
  def jsonb;
  obj record;
  v_path text;
  v_tipo text;
  v_cont jsonb := '{}';
BEGIN
  FOR a IN SELECT * FROM jsonb_array_elements(coalesce(_anexos, '[]')) LOOP
    v_path := a->>'storage_path';
    v_tipo := coalesce(a->>'tipo_anexo', '');
    def := NULL;
    IF v_path IS NULL OR v_path NOT LIKE p.aluno_id::text || '/' || p.id::text || '/%' THEN
      RAISE EXCEPTION 'Anexo em local inválido' USING ERRCODE = '22023';
    END IF;
    SELECT d INTO def FROM jsonb_array_elements(t.anexos) d WHERE d->>'id' = v_tipo;
    IF def IS NULL AND NOT (_livre AND v_tipo = 'complemento') THEN
      RAISE EXCEPTION 'Tipo de anexo inválido: %', v_tipo USING ERRCODE = '22023';
    END IF;
    SELECT o.name, o.metadata INTO obj FROM storage.objects o WHERE o.bucket_id = 'protocolos' AND o.name = v_path;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Arquivo não encontrado: %', coalesce(a->>'nome_arquivo', v_path) USING ERRCODE = '22023';
    END IF;
    IF coalesce((obj.metadata->>'size')::bigint, 0) > coalesce((def->>'max_mb')::numeric, 10) * 1024 * 1024 THEN
      RAISE EXCEPTION 'Arquivo acima do tamanho permitido: %', a->>'nome_arquivo' USING ERRCODE = '22023';
    END IF;
    IF def IS NOT NULL AND NOT (def->'mimes' ? coalesce(obj.metadata->>'mimetype', '')) THEN
      RAISE EXCEPTION 'Formato não aceito para %: %', def->>'rotulo', a->>'nome_arquivo' USING ERRCODE = '22023';
    END IF;
    INSERT INTO public.protocolo_anexos (protocolo_id, tramite_id, tipo_anexo, nome_arquivo, storage_path, mime, tamanho, sha256, enviado_por, sensivel)
    VALUES (p.id, _tramite, v_tipo, coalesce(nullif(a->>'nome_arquivo', ''), 'arquivo'), v_path,
            obj.metadata->>'mimetype', (obj.metadata->>'size')::bigint, a->>'sha256', auth.uid(),
            coalesce((def->>'sensivel')::boolean, false));
    v_cont := jsonb_set(v_cont, ARRAY[v_tipo], to_jsonb(coalesce((v_cont->>v_tipo)::int, 0) + 1));
  END LOOP;
  RETURN v_cont;
END;
$$;

CREATE OR REPLACE FUNCTION public._valor_vazio(v jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE AS $$
  SELECT v IS NULL OR v = 'null'::jsonb OR v = '""'::jsonb OR v = '[]'::jsonb
      OR (jsonb_typeof(v) = 'string' AND trim(v #>> '{}') = '');
$$;

-- ── RPCs do aluno ─────────────────────────────────────────────────────────
-- p_id: uuid gerado no cliente, usado também no caminho dos anexos ({aluno}/{p_id}/...).
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
          v_data_ref IS NOT NULL AND current_date > public.dias_uteis_apos(v_data_ref, (v_prazo->>'dias_uteis')::int),
          public.dias_uteis_apos(current_date, v_tipo.prazo_resposta_dias_uteis))
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

CREATE OR REPLACE FUNCTION public.protocolo_responder_pendencia(p_id uuid, p_texto text, p_anexos jsonb)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_p public.protocolos;
  v_tipo public.protocolo_tipos;
  v_tramite uuid;
BEGIN
  SELECT * INTO v_p FROM public.protocolos WHERE id = p_id FOR UPDATE;
  IF v_p.id IS NULL OR v_p.aluno_id IS DISTINCT FROM public.current_aluno_id() THEN
    RAISE EXCEPTION 'Protocolo não encontrado' USING ERRCODE = '42501';
  END IF;
  IF v_p.status <> 'aguardando_aluno' THEN
    RAISE EXCEPTION 'Este protocolo não está aguardando resposta' USING ERRCODE = '22023';
  END IF;
  IF coalesce(trim(p_texto), '') = '' AND jsonb_array_length(coalesce(p_anexos, '[]')) = 0 THEN
    RAISE EXCEPTION 'Escreva uma resposta ou envie um anexo' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_tipo FROM public.protocolo_tipos WHERE id = v_p.tipo_id;

  INSERT INTO public.protocolo_tramites (protocolo_id, etapa, setor_id, acao, parecer, visivel_aluno, user_id)
  VALUES (v_p.id, v_p.etapa_atual, v_p.setor_atual, 'resposta_aluno', nullif(trim(p_texto), ''), true, auth.uid())
  RETURNING id INTO v_tramite;
  PERFORM public._protocolo_gravar_anexos(v_p, v_tipo, p_anexos, v_tramite, true);

  UPDATE public.protocolos SET status = 'em_analise', updated_at = now() WHERE id = v_p.id RETURNING * INTO v_p;
  PERFORM public._notificar_setor(v_p, 'Pendência respondida — ' || v_p.numero, 'O aluno respondeu à solicitação de complementação.');
  RETURN jsonb_build_object('status', v_p.status);
END;
$$;

CREATE OR REPLACE FUNCTION public.protocolo_cancelar(p_id uuid, p_motivo text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_p public.protocolos;
BEGIN
  SELECT * INTO v_p FROM public.protocolos WHERE id = p_id FOR UPDATE;
  IF v_p.id IS NULL OR v_p.aluno_id IS DISTINCT FROM public.current_aluno_id() THEN
    RAISE EXCEPTION 'Protocolo não encontrado' USING ERRCODE = '42501';
  END IF;
  IF v_p.status <> 'aberto' THEN
    RAISE EXCEPTION 'Só é possível cancelar antes do início da análise' USING ERRCODE = '22023';
  END IF;
  UPDATE public.protocolos SET status = 'cancelado', cancelado_em = now(), updated_at = now() WHERE id = p_id;
  INSERT INTO public.protocolo_tramites (protocolo_id, etapa, setor_id, acao, parecer, visivel_aluno, user_id)
  VALUES (p_id, v_p.etapa_atual, v_p.setor_atual, 'cancelamento', nullif(trim(p_motivo), ''), true, auth.uid());
  INSERT INTO public.academico_audit_logs (user_id, acao, entidade, entidade_id, old_data)
  VALUES (auth.uid(), 'cancelar', 'protocolos', p_id::text, to_jsonb(v_p));
  RETURN jsonb_build_object('status', 'cancelado');
END;
$$;

-- Disciplinas da turma do aluno, com professor e dias da semana da grade.
CREATE OR REPLACE FUNCTION public.aluno_disciplinas()
RETURNS TABLE (materia_id uuid, nome text, professor_id uuid, professor_nome text, dias_semana int[])
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.id, m.nome, h1.professor_id, pr.nome,
         coalesce((SELECT array_agg(DISTINCT h.dia_semana) FROM public.horarios_aula h
                    WHERE h.turma_id = a.turma_id AND h.materia_id = m.id), '{}')
    FROM public.alunos a
    JOIN public.turma_materias tm ON tm.turma_id = a.turma_id
    JOIN public.materias m ON m.id = tm.materia_id
    LEFT JOIN LATERAL (SELECT h.professor_id FROM public.horarios_aula h
                        WHERE h.turma_id = a.turma_id AND h.materia_id = m.id
                        ORDER BY h.dia_semana, h.horario_id LIMIT 1) h1 ON true
    LEFT JOIN public.professores pr ON pr.id = h1.professor_id
   WHERE a.user_id = auth.uid() AND auth.uid() IS NOT NULL
   ORDER BY m.nome;
$$;

-- Nomes dos professores ativos (sem PIN, CPF ou dados bancários) para orientador/banca.
CREATE OR REPLACE FUNCTION public.professores_nomes()
RETURNS TABLE (id uuid, nome text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id, p.nome FROM public.professores p
   WHERE coalesce(p.status, 'ativo') = 'ativo'
     AND (public.current_aluno_id() IS NOT NULL OR public.is_equipe())
   ORDER BY p.nome;
$$;

-- ── RPCs da equipe ────────────────────────────────────────────────────────
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
           prazo_resposta_em = public.dias_uteis_apos(current_date, v_tipo.prazo_resposta_dias_uteis), updated_at = now()
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

-- shortcut: devolve toda a fila visível sem paginação; paginar quando passar de alguns milhares de protocolos.
CREATE OR REPLACE FUNCTION public.protocolos_fila(p_filtros jsonb DEFAULT '{}')
RETURNS TABLE (id uuid, numero text, tipo_id text, tipo_nome text, aluno_nome text, matricula text, curso_id text,
               status text, etapa_atual int, setor_atual text, fora_do_prazo boolean, prazo_resposta_em date,
               aberto_em timestamptz, updated_at timestamptz, minha_etapa boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_equipe() THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT p.id, p.numero, p.tipo_id, t.nome, a.nome, a.matricula, p.curso_id, p.status, p.etapa_atual, p.setor_atual,
         p.fora_do_prazo, p.prazo_resposta_em, p.aberto_em, p.updated_at,
         (p.status IN ('aberto','em_analise') AND public.pode_atuar_setor(p.setor_atual, p.curso_id))
    FROM public.protocolos p
    JOIN public.protocolo_tipos t ON t.id = p.tipo_id
    JOIN public.alunos a ON a.id = p.aluno_id
   WHERE public._protocolo_pode_ver(p)
     AND (coalesce(p_filtros->>'tipo_id', '') = '' OR p.tipo_id = p_filtros->>'tipo_id')
     AND (coalesce(p_filtros->>'curso_id', '') = '' OR p.curso_id = p_filtros->>'curso_id')
   ORDER BY p.aberto_em DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.protocolo_detalhe(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_p public.protocolos;
  v_eh_aluno boolean;
  v_sensivel boolean;
BEGIN
  SELECT * INTO v_p FROM public.protocolos WHERE id = p_id;
  IF v_p.id IS NULL OR NOT public._protocolo_pode_ver(v_p) THEN
    RAISE EXCEPTION 'Protocolo não encontrado' USING ERRCODE = '42501';
  END IF;
  v_eh_aluno := v_p.aluno_id = public.current_aluno_id();
  v_sensivel := public._protocolo_pode_ver_sensivel(v_p);

  RETURN jsonb_build_object(
    'protocolo', to_jsonb(v_p),
    'tipo', (SELECT to_jsonb(t) FROM public.protocolo_tipos t WHERE t.id = v_p.tipo_id),
    'aluno', (SELECT jsonb_build_object('id', a.id, 'nome', a.nome, 'matricula', a.matricula, 'curso_id', a.curso_id,
                                        'turma', (SELECT nome FROM public.turmas WHERE id = a.turma_id),
                                        'email', a.email, 'telefone', a.telefone)
                FROM public.alunos a WHERE a.id = v_p.aluno_id),
    'setor_nome', (SELECT nome FROM public.setores WHERE id = v_p.setor_atual),
    'tramites', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'id', t.id, 'etapa', t.etapa, 'setor_id', t.setor_id, 'setor_nome', s.nome, 'acao', t.acao,
               'parecer', t.parecer, 'dados', t.dados, 'visivel_aluno', t.visivel_aluno, 'created_at', t.created_at,
               'autor', CASE WHEN v_eh_aluno AND t.user_id IS DISTINCT FROM auth.uid() THEN NULL ELSE public._nome_usuario(t.user_id) END)
             ORDER BY t.created_at)
        FROM public.protocolo_tramites t LEFT JOIN public.setores s ON s.id = t.setor_id
       WHERE t.protocolo_id = v_p.id AND (NOT v_eh_aluno OR t.visivel_aluno)), '[]'::jsonb),
    'anexos', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', x.id, 'tramite_id', x.tramite_id, 'tipo_anexo', x.tipo_anexo,
               'nome_arquivo', x.nome_arquivo, 'storage_path', x.storage_path, 'mime', x.mime, 'tamanho', x.tamanho,
               'sensivel', x.sensivel, 'created_at', x.created_at) ORDER BY x.created_at)
        FROM public.protocolo_anexos x
       WHERE x.protocolo_id = v_p.id AND (NOT x.sensivel OR v_sensivel)), '[]'::jsonb),
    'anexos_ocultos', (SELECT count(*) FROM public.protocolo_anexos x WHERE x.protocolo_id = v_p.id AND x.sensivel AND NOT v_sensivel),
    'documentos', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', d.id, 'codigo', d.codigo, 'titulo', d.titulo, 'status', d.status,
               'storage_path', d.storage_path, 'emitido_em', d.emitido_em) ORDER BY d.emitido_em)
        FROM public.documentos d WHERE d.protocolo_id = v_p.id AND d.status <> 'cancelado'), '[]'::jsonb),
    'eh_aluno', v_eh_aluno,
    'pode_atuar', NOT v_eh_aluno AND v_p.status IN ('aberto','em_analise') AND public.pode_atuar_setor(v_p.setor_atual, v_p.curso_id),
    'pode_comentar', NOT v_eh_aluno AND public.pode_atuar_setor(v_p.setor_atual, v_p.curso_id)
  );
END;
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.protocolo_tipos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocolos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocolo_tramites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.protocolo_anexos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aluno_tcc ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ac_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aluno_horas_complementares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leem tipos" ON public.protocolo_tipos;
CREATE POLICY "Autenticados leem tipos" ON public.protocolo_tipos FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin edita tipos" ON public.protocolo_tipos;
CREATE POLICY "Admin edita tipos" ON public.protocolo_tipos FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Aluno le os proprios protocolos" ON public.protocolos;
CREATE POLICY "Aluno le os proprios protocolos" ON public.protocolos FOR SELECT TO authenticated
  USING (aluno_id = public.current_aluno_id());

DROP POLICY IF EXISTS "Aluno le tramites visiveis" ON public.protocolo_tramites;
CREATE POLICY "Aluno le tramites visiveis" ON public.protocolo_tramites FOR SELECT TO authenticated
  USING (visivel_aluno AND EXISTS (SELECT 1 FROM public.protocolos p WHERE p.id = protocolo_id AND p.aluno_id = public.current_aluno_id()));

DROP POLICY IF EXISTS "Aluno le os proprios anexos" ON public.protocolo_anexos;
CREATE POLICY "Aluno le os proprios anexos" ON public.protocolo_anexos FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.protocolos p WHERE p.id = protocolo_id AND p.aluno_id = public.current_aluno_id()));

DROP POLICY IF EXISTS "Leitura do TCC" ON public.aluno_tcc;
CREATE POLICY "Leitura do TCC" ON public.aluno_tcc FOR SELECT TO authenticated
  USING (aluno_id = public.current_aluno_id() OR public.is_secretaria());

DROP POLICY IF EXISTS "Autenticados leem categorias AC" ON public.ac_categorias;
CREATE POLICY "Autenticados leem categorias AC" ON public.ac_categorias FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin gerencia categorias AC" ON public.ac_categorias;
CREATE POLICY "Admin gerencia categorias AC" ON public.ac_categorias FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Leitura das horas AC" ON public.aluno_horas_complementares;
CREATE POLICY "Leitura das horas AC" ON public.aluno_horas_complementares FOR SELECT TO authenticated
  USING (aluno_id = public.current_aluno_id() OR public.is_secretaria()
         OR EXISTS (SELECT 1 FROM public.alunos a WHERE a.id = aluno_id AND public.coordena_curso(a.curso_id)));

-- ── Storage: bucket privado "protocolos" ──────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('protocolos', 'protocolos', false, 10485760,
        ARRAY['application/pdf','image/jpeg','image/png','application/msword',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "protocolos: aluno envia na propria pasta" ON storage.objects;
CREATE POLICY "protocolos: aluno envia na propria pasta" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'protocolos' AND (storage.foldername(name))[1] = public.current_aluno_id()::text);
DROP POLICY IF EXISTS "protocolos: leitura autorizada" ON storage.objects;
CREATE POLICY "protocolos: leitura autorizada" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'protocolos' AND public.pode_ver_anexo(name));

-- ── Grants ────────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.dias_uteis_apos(date, int) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public._valor_vazio(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public._valor_vazio(jsonb) TO authenticated;
REVOKE EXECUTE ON FUNCTION public._nome_usuario(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._protocolo_pode_ver(public.protocolos) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._protocolo_pode_ver_sensivel(public.protocolos) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._notificar_aluno(public.protocolos, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._notificar_setor(public.protocolos, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._protocolo_gravar_anexos(public.protocolos, public.protocolo_tipos, jsonb, uuid, boolean) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pode_ver_anexo(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.protocolo_abrir(uuid, text, jsonb, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.protocolo_responder_pendencia(uuid, text, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.protocolo_cancelar(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.aluno_disciplinas() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.professores_nomes() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.protocolo_tramitar(uuid, text, text, jsonb, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.protocolos_fila(jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.protocolo_detalhe(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.dias_uteis_apos(date, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_ver_anexo(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.protocolo_abrir(uuid, text, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.protocolo_responder_pendencia(uuid, text, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.protocolo_cancelar(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.aluno_disciplinas() TO authenticated;
GRANT EXECUTE ON FUNCTION public.professores_nomes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.protocolo_tramitar(uuid, text, text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.protocolos_fila(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.protocolo_detalhe(uuid) TO authenticated;
