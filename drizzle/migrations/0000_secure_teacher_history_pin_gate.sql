CREATE OR REPLACE FUNCTION public.get_historico_professor_seguro(p_prof_id uuid, p_pin text, p_limite integer DEFAULT 5)
RETURNS TABLE(id uuid, professor_id uuid, materia_id uuid, turma_id uuid, data date, horarios integer[], quantidade_horarios integer, carga_horaria integer, valor_total numeric, observacao text, status_aprovacao text, retroativo boolean, substituicao boolean, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public._prof_validate(p_prof_id, p_pin) THEN RAISE EXCEPTION 'PIN inválido'; END IF;
  RETURN QUERY SELECT r.id, r.professor_id, r.materia_id, r.turma_id, r.data, r.horarios, r.quantidade_horarios, r.carga_horaria, r.valor_total, r.observacao, r.status_aprovacao, r.retroativo, r.substituicao, r.created_at FROM public.registros_ponto r WHERE r.professor_id = p_prof_id ORDER BY r.created_at DESC LIMIT GREATEST(LEAST(p_limite, 100), 1);
END;
$$;
REVOKE ALL ON FUNCTION public.get_historico_professor_seguro(uuid,text,integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_historico_professor_seguro(uuid,text,integer) TO anon, authenticated;
REVOKE ALL ON FUNCTION public.get_historico_professor(uuid,integer) FROM PUBLIC, anon, authenticated;