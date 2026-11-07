
CREATE TABLE IF NOT EXISTS public.app_settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read app_settings" ON public.app_settings;
CREATE POLICY "Anyone can read app_settings" ON public.app_settings FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Admins manage app_settings" ON public.app_settings;
CREATE POLICY "Admins manage app_settings" ON public.app_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.app_settings (id, data) VALUES (
  'global',
  jsonb_build_object(
    'geofence', jsonb_build_object('lat', -4.5694, 'lng', -44.5996, 'raio_m', 900),
    'minutos_por_horario', 50,
    'valor_hora_padrao', 0,
    'primary_hsl', '246 76% 28%',
    'horarios', jsonb_build_array(
      jsonb_build_object('id',1,'label','1º Horário','inicio','18:30','fim','19:20','turno','noturno'),
      jsonb_build_object('id',2,'label','2º Horário','inicio','19:20','fim','20:10','turno','noturno'),
      jsonb_build_object('id',3,'label','3º Horário','inicio','20:20','fim','21:10','turno','noturno'),
      jsonb_build_object('id',4,'label','4º Horário','inicio','21:10','fim','22:00','turno','noturno'),
      jsonb_build_object('id',5,'label','1º Horário','inicio','14:00','fim','15:00','turno','vespertino'),
      jsonb_build_object('id',6,'label','2º Horário','inicio','15:00','fim','16:00','turno','vespertino'),
      jsonb_build_object('id',7,'label','3º Horário','inicio','16:00','fim','17:00','turno','vespertino'),
      jsonb_build_object('id',8,'label','4º Horário','inicio','17:00','fim','18:00','turno','vespertino')
    ),
    'cursos', jsonb_build_array(
      jsonb_build_object('id','eng','nome','Engenharia Civil'),
      jsonb_build_object('id','ped','nome','Pedagogia'),
      jsonb_build_object('id','psi','nome','Psicologia')
    )
  )
) ON CONFLICT (id) DO NOTHING;
