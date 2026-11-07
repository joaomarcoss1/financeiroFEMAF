CREATE OR REPLACE FUNCTION public.push_subscribe_professor(
  p_prof_id uuid,
  p_pin text,
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
BEGIN
  PERFORM public._prof_validate(p_prof_id, p_pin);
  IF p_endpoint IS NULL OR length(trim(p_endpoint)) < 10 THEN
    RAISE EXCEPTION 'endpoint inválido';
  END IF;
  IF p_p256dh IS NULL OR p_auth IS NULL THEN
    RAISE EXCEPTION 'chaves push obrigatórias';
  END IF;

  INSERT INTO public.push_subscriptions(endpoint, p256dh, auth, professor_id, user_id, role, user_agent)
  VALUES (p_endpoint, p_p256dh, p_auth, p_prof_id, NULL, 'professor', p_user_agent)
  ON CONFLICT (endpoint) DO UPDATE SET
    p256dh = EXCLUDED.p256dh,
    auth = EXCLUDED.auth,
    professor_id = EXCLUDED.professor_id,
    user_id = NULL,
    role = 'professor',
    user_agent = EXCLUDED.user_agent
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('ok', true, 'id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.push_subscribe_professor(uuid,text,text,text,text,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.push_subscribe_professor(uuid,text,text,text,text,text) TO anon, authenticated;