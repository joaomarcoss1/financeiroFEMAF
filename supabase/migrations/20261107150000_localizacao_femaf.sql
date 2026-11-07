-- Cerca de GPS do ponto: FEMAF – Av. Dr. João Alberto, 100, Residencial Maria Rita, Pedreiras-MA
-- (coordenada da Av. Dr. João Alberto no OpenStreetMap; raio de 900 m cobre toda a avenida)
UPDATE public.app_settings
   SET data = data || jsonb_build_object('geofence',
         COALESCE(data->'geofence', '{}'::jsonb)
         || jsonb_build_object('lat', -4.5635410, 'lng', -44.5994555, 'raio_m', 900,
                               'endereco', 'Av. Dr. João Alberto, 100 – Residencial Maria Rita, Pedreiras-MA, 65725-000')),
       updated_at = now()
 WHERE id = 'global';
