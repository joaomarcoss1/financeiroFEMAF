
-- Exemplo: atualizar/reatribuir coordenação de curso(s)
-- [dados reais de cadastro removidos nesta versão pública/limpa do repositório]
-- UPDATE public.coordenadores SET cursos = ARRAY['dir']::text[] WHERE professor_id = '<uuid-do-professor>';
-- INSERT INTO public.coordenadores (professor_id, cursos)
-- VALUES ('<uuid-do-professor>', ARRAY['adm']::text[])
-- ON CONFLICT (professor_id) DO UPDATE SET cursos = EXCLUDED.cursos;
