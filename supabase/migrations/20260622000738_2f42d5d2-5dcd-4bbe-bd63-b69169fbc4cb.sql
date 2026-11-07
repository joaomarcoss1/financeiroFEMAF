DROP POLICY IF EXISTS "Anyone can upload justificativas" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view justificativas" ON storage.objects;

CREATE POLICY "Admins manage justificativas"
ON storage.objects FOR ALL
TO authenticated
USING (bucket_id = 'justificativas' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'justificativas' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Restricted uploads to justificativas"
ON storage.objects FOR INSERT
TO anon, authenticated
WITH CHECK (
  bucket_id = 'justificativas'
  AND name ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/[A-Za-z0-9._-]+\.[A-Za-z0-9]{2,5}$'
  AND COALESCE((metadata->>'size')::bigint, 0) <= 10485760
  AND COALESCE(metadata->>'mimetype','') IN (
    'application/pdf','image/png','image/jpeg','image/jpg','image/webp','image/heic'
  )
);