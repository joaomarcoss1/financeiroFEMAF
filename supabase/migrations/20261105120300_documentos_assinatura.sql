-- F6/F7 — Migration D: documentos com assinatura eletrônica e validação pública (F6).
-- Aditiva e idempotente. Depende das Migrations A, B e C.

-- ── Tabelas ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.documento_modelos (
  id text PRIMARY KEY,
  nome text NOT NULL,
  tipo text NOT NULL,
  signatarios jsonb NOT NULL DEFAULT '[]',
  layout jsonb NOT NULL DEFAULT '{}',
  ativo boolean NOT NULL DEFAULT true
);

INSERT INTO public.documento_modelos (id, nome, tipo, signatarios) VALUES
  ('comprovante_protocolo', 'Comprovante de protocolo', 'protocolo',
   '[{"ordem":1,"papel":"aluno","cargo":"Requerente"}]'),
  ('parecer_protocolo', 'Parecer sobre protocolo', 'protocolo',
   '[{"ordem":1,"papel":"decisor","cargo":"Responsável pela decisão"}]'),
  ('deferimento_segunda_chamada', 'Deferimento de segunda chamada', 'protocolo',
   '[{"ordem":1,"papel":"coordenador","cargo":"Coordenação do curso"},{"ordem":2,"papel":"secretaria","cargo":"Secretaria Acadêmica"}]'),
  ('termo_aceite_tcc', 'Termo de aceite do projeto de TCC', 'protocolo',
   '[{"ordem":1,"papel":"coordenador","cargo":"Coordenação / Comissão de TCC"},{"ordem":2,"papel":"secretaria","cargo":"Secretaria Acadêmica"}]'),
  ('homologacao_tcc', 'Homologação do TCC', 'protocolo',
   '[{"ordem":1,"papel":"coordenador","cargo":"Coordenação do curso"},{"ordem":2,"papel":"secretaria","cargo":"Secretaria Acadêmica"}]'),
  ('extrato_horas', 'Extrato de horas complementares', 'protocolo',
   '[{"ordem":1,"papel":"coordenador","cargo":"Coordenação do curso"}]'),
  ('declaracao', 'Declaração', 'avulso',
   '[{"ordem":1,"papel":"secretaria","cargo":"Secretaria Acadêmica"},{"ordem":2,"papel":"diretor","cargo":"Direção"}]')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  modelo_id text NOT NULL REFERENCES public.documento_modelos(id),
  titulo text NOT NULL,
  aluno_id uuid REFERENCES public.alunos(id),
  protocolo_id uuid REFERENCES public.protocolos(id),
  snapshot jsonb NOT NULL,
  storage_path text,
  sha256 text,
  status text NOT NULL DEFAULT 'aguardando_assinatura' CHECK (status IN ('aguardando_assinatura','assinado','cancelado')),
  emitido_por uuid,
  emitido_em timestamptz NOT NULL DEFAULT now(),
  cancelado_por uuid,
  cancelado_motivo text,
  cancelado_em timestamptz
);
CREATE INDEX IF NOT EXISTS idx_documentos_aluno ON public.documentos(aluno_id);
CREATE INDEX IF NOT EXISTS idx_documentos_protocolo ON public.documentos(protocolo_id);

CREATE TABLE IF NOT EXISTS public.documento_assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento_id uuid NOT NULL REFERENCES public.documentos(id) ON DELETE CASCADE,
  ordem int NOT NULL,
  papel text NOT NULL,
  cargo text,
  signatario_user_id uuid,
  nome_signatario text,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','assinado','recusado')),
  assinado_em timestamptz,
  ip_informado text,
  user_agent text,
  sha256_snapshot text,
  motivo_recusa text
);
CREATE INDEX IF NOT EXISTS idx_assinaturas_doc ON public.documento_assinaturas(documento_id, ordem);
CREATE INDEX IF NOT EXISTS idx_assinaturas_user ON public.documento_assinaturas(signatario_user_id, status);

CREATE TABLE IF NOT EXISTS public.documento_consultas (
  id bigserial PRIMARY KEY,
  codigo text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_doc_consultas ON public.documento_consultas(codigo, created_at);

-- ── Auxiliares ────────────────────────────────────────────────────────────
-- Código IPD-XXXX-XXXX: 7 caracteres aleatórios + 1 dígito verificador (mesmo algoritmo de src/features/documentos/lib/codigo.ts).
CREATE OR REPLACE FUNCTION public._documento_codigo()
RETURNS text LANGUAGE plpgsql VOLATILE SET search_path = public AS $$
DECLARE
  alfa constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  b bytea;
  corpo text;
  soma int;
  i int;
  v text;
BEGIN
  LOOP
    b := uuid_send(gen_random_uuid());
    corpo := '';
    soma := 0;
    FOR i IN 0..6 LOOP
      corpo := corpo || substr(alfa, (get_byte(b, i) % 32) + 1, 1);
      soma := soma + (get_byte(b, i) % 32) * (2 * i + 1);
    END LOOP;
    corpo := corpo || substr(alfa, (soma % 32) + 1, 1);
    v := 'IPD-' || substr(corpo, 1, 4) || '-' || substr(corpo, 5, 4);
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.documentos WHERE codigo = v);
  END LOOP;
  RETURN v;
END;
$$;

-- "Maria Silva de Oliveira" → "Maria S*** O***"
CREATE OR REPLACE FUNCTION public._mascarar_nome(_nome text)
RETURNS text LANGUAGE sql IMMUTABLE AS $$
  SELECT string_agg(CASE WHEN t.n = 1 THEN t.w ELSE upper(left(t.w, 1)) || '***' END, ' ' ORDER BY t.n)
    FROM regexp_split_to_table(trim(coalesce(_nome, '')), '\s+') WITH ORDINALITY AS t(w, n)
   WHERE t.w <> '' AND (t.n = 1 OR lower(t.w) NOT IN ('de','da','do','das','dos','e'));
$$;

CREATE OR REPLACE FUNCTION public._curso_nome(_curso text)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT c->>'nome' FROM public.app_settings s, jsonb_array_elements(s.data->'cursos') c
                    WHERE c->>'id' = _curso LIMIT 1), _curso);
$$;

CREATE OR REPLACE FUNCTION public._documento_pode_ver(d public.documentos)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (d.aluno_id IS NOT NULL AND d.aluno_id = public.current_aluno_id())
      OR public.is_secretaria()
      OR EXISTS (SELECT 1 FROM public.documento_assinaturas a WHERE a.documento_id = d.id AND a.signatario_user_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.protocolos p WHERE p.id = d.protocolo_id AND public._protocolo_pode_ver(p));
$$;

CREATE OR REPLACE FUNCTION public._pode_assinar(a public.documento_assinaturas, d public.documentos)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT a.status = 'pendente' AND d.status = 'aguardando_assinatura' AND auth.uid() IS NOT NULL AND (
    a.signatario_user_id = auth.uid()
    OR (a.signatario_user_id IS NULL AND CASE a.papel
          WHEN 'coordenador' THEN public.coordena_curso(d.snapshot#>>'{aluno,curso_id}')
                                  OR public.pode_atuar_setor('comissao_tcc', d.snapshot#>>'{aluno,curso_id}')
          WHEN 'secretaria' THEN public.is_secretaria()
          WHEN 'diretor' THEN public.has_any_role(ARRAY['diretor','admin']::public.app_role[]) OR public.membro_setor('direcao')
          ELSE false END))
    -- só a primeira assinatura pendente (ordem) pode ser feita
    AND NOT EXISTS (SELECT 1 FROM public.documento_assinaturas o
                     WHERE o.documento_id = a.documento_id AND o.status = 'pendente' AND o.ordem < a.ordem);
$$;

-- Cria o documento com snapshot montado no servidor e as assinaturas pendentes do modelo.
CREATE OR REPLACE FUNCTION public._documento_criar(p_modelo text, p_protocolo uuid, p_dados jsonb)
RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_modelo public.documento_modelos;
  v_p public.protocolos;
  v_aluno public.alunos;
  v_tipo_nome text;
  v_snap jsonb;
  v_doc public.documentos;
  v_sig jsonb;
  v_uid uuid;
  v_titulo text;
  v_extra jsonb := '{}';
BEGIN
  SELECT * INTO v_modelo FROM public.documento_modelos WHERE id = p_modelo AND ativo;
  IF v_modelo.id IS NULL THEN
    RETURN NULL; -- modelo desativado: não emite
  END IF;
  p_dados := coalesce(p_dados, '{}');
  IF p_protocolo IS NOT NULL THEN
    SELECT * INTO v_p FROM public.protocolos WHERE id = p_protocolo;
    SELECT nome INTO v_tipo_nome FROM public.protocolo_tipos WHERE id = v_p.tipo_id;
    SELECT * INTO v_aluno FROM public.alunos WHERE id = v_p.aluno_id;
  ELSIF p_dados ? 'aluno_id' THEN
    SELECT * INTO v_aluno FROM public.alunos WHERE id = (p_dados->>'aluno_id')::uuid;
  END IF;

  IF p_modelo = 'extrato_horas' THEN
    v_extra := jsonb_build_object('horas', coalesce((
      SELECT jsonb_agg(jsonb_build_object('categoria', c.nome, 'descricao', h.descricao, 'emissor', h.emissor,
                                          'data', h.data_atividade, 'horas_declaradas', h.horas_declaradas,
                                          'horas_deferidas', h.horas_deferidas, 'deste_protocolo', h.protocolo_id = v_p.id)
                       ORDER BY h.data_atividade NULLS LAST, h.created_at)
        FROM public.aluno_horas_complementares h JOIN public.ac_categorias c ON c.id = h.categoria_id
       WHERE h.aluno_id = v_aluno.id), '[]'::jsonb),
      'total_horas', (SELECT coalesce(sum(horas_deferidas), 0) FROM public.aluno_horas_complementares WHERE aluno_id = v_aluno.id));
  ELSIF p_modelo IN ('termo_aceite_tcc', 'homologacao_tcc') THEN
    v_extra := jsonb_build_object('tcc', (
      SELECT jsonb_build_object('titulo', t.titulo, 'situacao', t.situacao, 'nota_final', t.nota_final,
                                'orientador', (SELECT nome FROM public.professores WHERE id = t.orientador_id),
                                'homologado_em', t.homologado_em)
        FROM public.aluno_tcc t WHERE t.aluno_id = v_aluno.id));
  ELSIF p_modelo = 'deferimento_segunda_chamada' THEN
    v_extra := jsonb_build_object(
      'disciplina', (SELECT nome FROM public.materias WHERE id = nullif(v_p.dados->>'materia_id', '')::uuid),
      'professor', (SELECT nome FROM public.professores WHERE id = nullif(v_p.dados->>'professor_id', '')::uuid));
  END IF;

  v_titulo := coalesce(nullif(p_dados->>'titulo', ''), v_modelo.nome || coalesce(' — ' || v_p.numero, ''));
  v_snap := jsonb_build_object(
    'modelo', v_modelo.id,
    'modelo_nome', v_modelo.nome,
    'titulo', v_titulo,
    'emitido_em', to_char(now() AT TIME ZONE 'America/Fortaleza', 'YYYY-MM-DD"T"HH24:MI:SS'),
    'aluno', CASE WHEN v_aluno.id IS NULL THEN NULL ELSE jsonb_build_object(
      'nome', v_aluno.nome, 'matricula', v_aluno.matricula, 'cpf', v_aluno.cpf,
      'curso_id', v_aluno.curso_id, 'curso_nome', public._curso_nome(v_aluno.curso_id),
      'turma', (SELECT nome FROM public.turmas WHERE id = v_aluno.turma_id)) END,
    'protocolo', CASE WHEN v_p.id IS NULL THEN NULL ELSE jsonb_build_object(
      'numero', v_p.numero, 'tipo_id', v_p.tipo_id, 'tipo_nome', v_tipo_nome,
      'aberto_em', to_char(v_p.aberto_em AT TIME ZONE 'America/Fortaleza', 'YYYY-MM-DD"T"HH24:MI:SS'),
      'status', v_p.status, 'decisao', v_p.decisao, 'parecer_final', v_p.parecer_final,
      'fora_do_prazo', v_p.fora_do_prazo, 'dados', v_p.dados) END,
    'texto', p_dados->>'texto'
  ) || v_extra;

  INSERT INTO public.documentos (codigo, modelo_id, titulo, aluno_id, protocolo_id, snapshot, emitido_por)
  VALUES (public._documento_codigo(), v_modelo.id, v_titulo, v_aluno.id, v_p.id, v_snap, auth.uid())
  RETURNING * INTO v_doc;

  FOR v_sig IN SELECT * FROM jsonb_array_elements(v_modelo.signatarios) ORDER BY (value->>'ordem')::int LOOP
    v_uid := CASE v_sig->>'papel'
      WHEN 'aluno' THEN v_aluno.user_id
      WHEN 'decisor' THEN auth.uid()
      WHEN 'coordenador' THEN (SELECT t.user_id FROM public.protocolo_tramites t
                                WHERE t.protocolo_id = v_p.id AND t.setor_id IN ('coordenacao','comissao_tcc')
                                  AND t.acao IN ('deferir','concluir') ORDER BY t.created_at DESC LIMIT 1)
      WHEN 'secretaria' THEN CASE WHEN public.is_secretaria() THEN auth.uid() END
      ELSE NULL END;
    INSERT INTO public.documento_assinaturas (documento_id, ordem, papel, cargo, signatario_user_id)
    VALUES (v_doc.id, (v_sig->>'ordem')::int, v_sig->>'papel', v_sig->>'cargo', v_uid);
  END LOOP;

  -- Comprovante: o aceite eletrônico do aluno foi dado ao protocolar.
  IF p_modelo = 'comprovante_protocolo' AND v_aluno.user_id = auth.uid() THEN
    UPDATE public.documento_assinaturas
       SET status = 'assinado', assinado_em = now(), nome_signatario = v_aluno.nome,
           sha256_snapshot = encode(sha256(convert_to(v_snap::text, 'UTF8')), 'hex'),
           ip_informado = split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1)
     WHERE documento_id = v_doc.id AND papel = 'aluno';
    UPDATE public.documentos SET status = 'assinado' WHERE id = v_doc.id;
  END IF;

  PERFORM public._notificar_signatario(v_doc.id);
  RETURN v_doc.id;
END;
$$;

-- Avisa quem deve assinar a próxima assinatura pendente (se já tiver usuário definido).
CREATE OR REPLACE FUNCTION public._notificar_signatario(_doc uuid)
RETURNS void LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.notificacoes (destino_role, user_id, tipo, titulo, mensagem, link)
  SELECT 'equipe', a.signatario_user_id, 'assinatura', 'Documento aguardando sua assinatura', d.titulo, '/central/assinaturas'
    FROM public.documento_assinaturas a JOIN public.documentos d ON d.id = a.documento_id
   WHERE a.documento_id = _doc AND a.status = 'pendente' AND d.status = 'aguardando_assinatura'
     AND a.signatario_user_id IS NOT NULL AND a.signatario_user_id IS DISTINCT FROM auth.uid()
     AND a.ordem = (SELECT min(ordem) FROM public.documento_assinaturas WHERE documento_id = _doc AND status = 'pendente');
$$;

-- ── RPCs ──────────────────────────────────────────────────────────────────
-- Emissão manual pela secretaria (ex.: declaração com texto livre).
CREATE OR REPLACE FUNCTION public.documento_criar(p_modelo text, p_protocolo uuid, p_dados jsonb)
RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
BEGIN
  IF NOT public.is_secretaria() THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  IF p_modelo = 'declaracao' AND coalesce(trim(p_dados->>'texto'), '') = '' THEN
    RAISE EXCEPTION 'Escreva o texto da declaração' USING ERRCODE = '22023';
  END IF;
  v_id := public._documento_criar(p_modelo, p_protocolo, p_dados);
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Modelo indisponível' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.academico_audit_logs (user_id, acao, entidade, entidade_id, new_data)
  VALUES (auth.uid(), 'emitir', 'documentos', v_id::text, jsonb_build_object('modelo', p_modelo));
  RETURN v_id;
END;
$$;

-- O cliente reautentica (signInWithPassword) antes de chamar.
CREATE OR REPLACE FUNCTION public.documento_assinar(p_id uuid, p_user_agent text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_doc public.documentos;
  v_a public.documento_assinaturas;
  v_restantes int;
BEGIN
  SELECT * INTO v_doc FROM public.documentos WHERE id = p_id FOR UPDATE;
  IF v_doc.id IS NULL THEN
    RAISE EXCEPTION 'Documento não encontrado' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_a FROM public.documento_assinaturas
   WHERE documento_id = p_id AND status = 'pendente' ORDER BY ordem LIMIT 1;
  IF v_a.id IS NULL OR NOT public._pode_assinar(v_a, v_doc) THEN
    RAISE EXCEPTION 'Não é a sua vez de assinar este documento' USING ERRCODE = '42501';
  END IF;

  UPDATE public.documento_assinaturas
     SET status = 'assinado', signatario_user_id = auth.uid(), nome_signatario = public._nome_usuario(auth.uid()),
         assinado_em = now(), user_agent = left(p_user_agent, 300),
         ip_informado = split_part(coalesce(current_setting('request.headers', true)::json->>'x-forwarded-for', ''), ',', 1),
         sha256_snapshot = encode(sha256(convert_to(v_doc.snapshot::text, 'UTF8')), 'hex')
   WHERE id = v_a.id;

  SELECT count(*) INTO v_restantes FROM public.documento_assinaturas WHERE documento_id = p_id AND status = 'pendente';
  IF v_restantes = 0 THEN
    UPDATE public.documentos SET status = 'assinado' WHERE id = p_id;
    INSERT INTO public.notificacoes (destino_role, user_id, tipo, titulo, mensagem, link)
    SELECT 'aluno', al.user_id, 'documento', 'Documento disponível', v_doc.titulo, '/central/documentos'
      FROM public.alunos al WHERE al.id = v_doc.aluno_id AND al.user_id IS NOT NULL;
  ELSE
    PERFORM public._notificar_signatario(p_id);
  END IF;
  INSERT INTO public.academico_audit_logs (user_id, acao, entidade, entidade_id, new_data)
  VALUES (auth.uid(), 'assinar', 'documentos', p_id::text, jsonb_build_object('ordem', v_a.ordem, 'papel', v_a.papel));
  RETURN jsonb_build_object('completo', v_restantes = 0);
END;
$$;

-- Registra o PDF final (uma única vez; depois é imutável). Só a equipe registra, para o titular não
-- poder fixar um PDF adulterado como oficial; o aluno baixa a renderização local, que é idêntica.
CREATE OR REPLACE FUNCTION public.documento_registrar_arquivo(p_id uuid, p_sha256 text)
RETURNS jsonb LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_doc public.documentos;
BEGIN
  SELECT * INTO v_doc FROM public.documentos WHERE id = p_id FOR UPDATE;
  IF v_doc.id IS NULL OR NOT public._documento_pode_ver(v_doc) OR NOT public.is_equipe() THEN
    RAISE EXCEPTION 'Documento não encontrado' USING ERRCODE = '42501';
  END IF;
  IF v_doc.storage_path IS NOT NULL THEN
    RETURN jsonb_build_object('storage_path', v_doc.storage_path, 'sha256', v_doc.sha256, 'ja_registrado', true);
  END IF;
  IF v_doc.status <> 'assinado' THEN
    RAISE EXCEPTION 'Documento ainda não foi assinado por todos' USING ERRCODE = '22023';
  END IF;
  IF p_sha256 !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION 'Hash inválido' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM storage.objects WHERE bucket_id = 'documentos' AND name = p_id::text || '.pdf') THEN
    RAISE EXCEPTION 'Arquivo não enviado' USING ERRCODE = '22023';
  END IF;
  UPDATE public.documentos SET storage_path = p_id::text || '.pdf', sha256 = p_sha256 WHERE id = p_id;
  RETURN jsonb_build_object('storage_path', p_id::text || '.pdf', 'sha256', p_sha256, 'ja_registrado', false);
END;
$$;

CREATE OR REPLACE FUNCTION public.documento_cancelar(p_id uuid, p_motivo text)
RETURNS void LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_secretaria() THEN
    RAISE EXCEPTION 'Acesso negado' USING ERRCODE = '42501';
  END IF;
  IF coalesce(trim(p_motivo), '') = '' THEN
    RAISE EXCEPTION 'Informe o motivo do cancelamento' USING ERRCODE = '22023';
  END IF;
  UPDATE public.documentos SET status = 'cancelado', cancelado_por = auth.uid(), cancelado_motivo = trim(p_motivo), cancelado_em = now()
   WHERE id = p_id AND status <> 'cancelado';
  INSERT INTO public.academico_audit_logs (user_id, acao, entidade, entidade_id, new_data)
  VALUES (auth.uid(), 'cancelar', 'documentos', p_id::text, jsonb_build_object('motivo', trim(p_motivo)));
END;
$$;

-- Documento + assinaturas para renderizar o PDF.
CREATE OR REPLACE FUNCTION public.documento_obter(p_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_doc public.documentos;
BEGIN
  SELECT * INTO v_doc FROM public.documentos WHERE id = p_id;
  IF v_doc.id IS NULL OR NOT (public._documento_pode_ver(v_doc)
       OR EXISTS (SELECT 1 FROM public.documento_assinaturas a WHERE a.documento_id = p_id AND public._pode_assinar(a, v_doc))) THEN
    RAISE EXCEPTION 'Documento não encontrado' USING ERRCODE = '42501';
  END IF;
  RETURN to_jsonb(v_doc) || jsonb_build_object(
    'pode_assinar', EXISTS (SELECT 1 FROM public.documento_assinaturas a WHERE a.documento_id = p_id AND public._pode_assinar(a, v_doc)),
    'assinaturas', coalesce((SELECT jsonb_agg(jsonb_build_object(
        'id', a.id, 'ordem', a.ordem, 'papel', a.papel, 'cargo', a.cargo, 'nome_signatario', a.nome_signatario,
        'status', a.status, 'assinado_em', a.assinado_em, 'sha256_snapshot', a.sha256_snapshot) ORDER BY a.ordem)
      FROM public.documento_assinaturas a WHERE a.documento_id = p_id), '[]'::jsonb));
END;
$$;

CREATE OR REPLACE FUNCTION public.documentos_para_assinar()
RETURNS TABLE (id uuid, codigo text, titulo text, modelo_id text, emitido_em timestamptz, aluno_nome text, papel text, cargo text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT d.id, d.codigo, d.titulo, d.modelo_id, d.emitido_em, d.snapshot#>>'{aluno,nome}', a.papel, a.cargo
    FROM public.documentos d
    JOIN public.documento_assinaturas a ON a.documento_id = d.id
   WHERE public._pode_assinar(a, d)
   ORDER BY d.emitido_em;
$$;

-- Validação pública por código (anon). Registra a consulta e limita 30 por código a cada 10 min.
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
    'signatarios', coalesce((SELECT jsonb_agg(jsonb_build_object('nome', a.nome_signatario, 'cargo', a.cargo,
                                                                 'status', a.status, 'assinado_em', a.assinado_em) ORDER BY a.ordem)
                               FROM public.documento_assinaturas a WHERE a.documento_id = v_doc.id), '[]'::jsonb));
END;
$$;

-- ── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.documento_modelos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documento_assinaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documento_consultas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Autenticados leem modelos" ON public.documento_modelos;
CREATE POLICY "Autenticados leem modelos" ON public.documento_modelos FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Leitura de documentos" ON public.documentos;
CREATE POLICY "Leitura de documentos" ON public.documentos FOR SELECT TO authenticated
  USING ((aluno_id IS NOT NULL AND aluno_id = public.current_aluno_id()) OR public.is_secretaria());

DROP POLICY IF EXISTS "Leitura de assinaturas" ON public.documento_assinaturas;
CREATE POLICY "Leitura de assinaturas" ON public.documento_assinaturas FOR SELECT TO authenticated
  USING (signatario_user_id = auth.uid() OR public.is_secretaria()
         OR EXISTS (SELECT 1 FROM public.documentos d WHERE d.id = documento_id AND d.aluno_id = public.current_aluno_id()));

-- ── Storage: bucket privado "documentos" ──────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('documentos', 'documentos', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE OR REPLACE FUNCTION public.pode_enviar_documento(_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.documentos d
                  WHERE d.id::text || '.pdf' = _name AND d.status = 'assinado' AND d.storage_path IS NULL
                    AND public.is_equipe() AND public._documento_pode_ver(d));
$$;

CREATE OR REPLACE FUNCTION public.pode_ver_documento_arquivo(_name text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.documentos d WHERE d.id::text || '.pdf' = _name AND public._documento_pode_ver(d));
$$;

DROP POLICY IF EXISTS "documentos: envio do PDF final" ON storage.objects;
CREATE POLICY "documentos: envio do PDF final" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'documentos' AND public.pode_enviar_documento(name));
DROP POLICY IF EXISTS "documentos: leitura autorizada" ON storage.objects;
CREATE POLICY "documentos: leitura autorizada" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'documentos' AND public.pode_ver_documento_arquivo(name));

-- ── Grants ────────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public._documento_codigo() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._mascarar_nome(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._curso_nome(text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._documento_pode_ver(public.documentos) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._pode_assinar(public.documento_assinaturas, public.documentos) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._documento_criar(text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public._notificar_signatario(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.documento_criar(text, uuid, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.documento_assinar(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.documento_registrar_arquivo(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.documento_cancelar(uuid, text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.documento_obter(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.documentos_para_assinar() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pode_enviar_documento(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.pode_ver_documento_arquivo(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.documento_validar(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.documento_criar(text, uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.documento_assinar(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.documento_registrar_arquivo(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.documento_cancelar(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.documento_obter(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.documentos_para_assinar() TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_enviar_documento(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pode_ver_documento_arquivo(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.documento_validar(text) TO anon, authenticated;
