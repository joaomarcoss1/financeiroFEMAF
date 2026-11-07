DROP POLICY IF EXISTS "Auth read notificacoes" ON public.notificacoes;
DROP POLICY IF EXISTS "Auth read permutas" ON public.permutas;
DROP POLICY IF EXISTS "Auth read professores" ON public.professores;
DROP POLICY IF EXISTS "Auth read registros" ON public.registros_ponto;

CREATE POLICY "Admins read notificacoes"
ON public.notificacoes
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins read permutas"
ON public.permutas
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins read professores"
ON public.professores
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins read registros"
ON public.registros_ponto
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.notificacoes_professor_listar(p_prof_id uuid, p_pin text, p_limite integer DEFAULT 30)
RETURNS TABLE(
  id uuid,
  destino_role text,
  professor_id uuid,
  tipo text,
  titulo text,
  mensagem text,
  link text,
  lida boolean,
  created_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public._prof_validate(p_prof_id, p_pin);
  RETURN QUERY
    SELECT n.id, n.destino_role, n.professor_id, n.tipo, n.titulo, n.mensagem, n.link, n.lida, n.created_at
    FROM public.notificacoes n
    WHERE n.professor_id = p_prof_id OR n.destino_role = 'broadcast'
    ORDER BY n.created_at DESC
    LIMIT GREATEST(LEAST(COALESCE(p_limite, 30), 100), 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.notificacao_professor_marcar_lida(p_prof_id uuid, p_pin text, p_notificacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public._prof_validate(p_prof_id, p_pin);
  UPDATE public.notificacoes
  SET lida = true
  WHERE id = p_notificacao_id
    AND (professor_id = p_prof_id OR destino_role = 'broadcast');
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.notificacoes_professor_marcar_todas_lidas(p_prof_id uuid, p_pin text, p_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public._prof_validate(p_prof_id, p_pin);
  UPDATE public.notificacoes
  SET lida = true
  WHERE id = ANY(COALESCE(p_ids, '{}'::uuid[]))
    AND (professor_id = p_prof_id OR destino_role = 'broadcast');
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.notificacao_professor_excluir(p_prof_id uuid, p_pin text, p_notificacao_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public._prof_validate(p_prof_id, p_pin);
  DELETE FROM public.notificacoes
  WHERE id = p_notificacao_id
    AND professor_id = p_prof_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.notificacoes_professor_excluir_todas(p_prof_id uuid, p_pin text, p_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public._prof_validate(p_prof_id, p_pin);
  DELETE FROM public.notificacoes
  WHERE id = ANY(COALESCE(p_ids, '{}'::uuid[]))
    AND professor_id = p_prof_id;
  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE ALL ON FUNCTION public.notificacoes_professor_listar(uuid,text,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notificacao_professor_marcar_lida(uuid,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notificacoes_professor_marcar_todas_lidas(uuid,text,uuid[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notificacao_professor_excluir(uuid,text,uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.notificacoes_professor_excluir_todas(uuid,text,uuid[]) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.notificacoes_professor_listar(uuid,text,integer) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notificacao_professor_marcar_lida(uuid,text,uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notificacoes_professor_marcar_todas_lidas(uuid,text,uuid[]) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notificacao_professor_excluir(uuid,text,uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notificacoes_professor_excluir_todas(uuid,text,uuid[]) TO anon, authenticated;