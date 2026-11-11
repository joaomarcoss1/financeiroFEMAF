-- ════════════════════════════════════════════════════════════════════════
--  FEMAF — Engenharia Civil 2026.2: professores, valor da hora-aula e grade
--  Fonte: MAPEAMENTO_DISCIPLINAS_-_2026.2.docx (Especialista R$ 33,85 · Mestre R$ 40,65 · Doutor R$ 47,00)
--  Instalações Prediais II e Economia Aplicada à Engenharia ainda sem professor.
--  Idempotente.
-- ════════════════════════════════════════════════════════════════════════

-- Professores e valor da hora-aula (Carlos Rodrigues: 40,65 em Física e 33,85 em Química no documento; o sistema guarda um valor por professor)
INSERT INTO public.professores (nome, status, valor_hora_aula)
SELECT v.nome, 'ativo', v.valor FROM (VALUES
  ('Carlos Rodrigues', 40.65),
  ('Anny', 33.85),
  ('Maria Bulhão', 40.65),
  ('Tays Elói', 33.85),
  ('Icaro Guida', 33.85),
  ('Arthur Leite', 33.85),
  ('Hiago de Lira', 33.85),
  ('Welligton Barbosa', 33.85),
  ('Daniel Victor', 33.85)
) AS v(nome, valor)
WHERE NOT EXISTS (SELECT 1 FROM public.professores p WHERE lower(p.nome) = lower(v.nome));

UPDATE public.professores p SET valor_hora_aula = v.valor FROM (VALUES
  ('Carlos Rodrigues', 40.65),
  ('Anny', 33.85),
  ('Maria Bulhão', 40.65),
  ('Tays Elói', 33.85),
  ('Icaro Guida', 33.85),
  ('Arthur Leite', 33.85),
  ('Hiago de Lira', 33.85),
  ('Welligton Barbosa', 33.85),
  ('Daniel Victor', 33.85)
) AS v(nome, valor)
WHERE lower(p.nome) = lower(v.nome) AND COALESCE(p.valor_hora_aula, 0) = 0;

INSERT INTO public.professor_materias (professor_id, materia_id)
SELECT p.id, m.id FROM (VALUES
  ('Carlos Rodrigues', 'Física: Eletricidade e Magnetismo'),
  ('Anny', 'Metodologia da Pesquisa Científica'),
  ('Maria Bulhão', 'Cálculo II'),
  ('Tays Elói', 'Álgebra Linear e Geometria Analítica'),
  ('Carlos Rodrigues', 'Química Geral e Tecnológica'),
  ('Icaro Guida', 'Resistência dos Materiais'),
  ('Arthur Leite', 'Desenho Técnico II'),
  ('Hiago de Lira', 'Cálculo Avançado'),
  ('Arthur Leite', 'Materiais de Construção II'),
  ('Icaro Guida', 'Teoria das Estruturas I'),
  ('Welligton Barbosa', 'Avaliações e Perícias de Engenharia'),
  ('Icaro Guida', 'Estruturas de Concreto Armado I'),
  ('Daniel Victor', 'Geologia')
) AS v(professor, materia)
JOIN public.professores p ON lower(p.nome) = lower(v.professor)
JOIN public.materias m ON m.nome = v.materia AND m.curso_id = 'eng'
ON CONFLICT (professor_id, materia_id) DO NOTHING;

-- Grade fixa (noturno, 1º ao 4º horário; 1=Seg … 5=Sex)
INSERT INTO public.horarios_aula (professor_id, materia_id, turma_id, dia_semana, horario_id)
SELECT p.id, m.id, t.id, v.dia, h.h FROM (VALUES
  ('Carlos Rodrigues', 'Física: Eletricidade e Magnetismo', 'ENG 2º Período', 1),
  ('Anny', 'Metodologia da Pesquisa Científica', 'ENG 2º Período', 2),
  ('Maria Bulhão', 'Cálculo II', 'ENG 2º Período', 3),
  ('Tays Elói', 'Álgebra Linear e Geometria Analítica', 'ENG 2º Período', 4),
  ('Carlos Rodrigues', 'Química Geral e Tecnológica', 'ENG 2º Período', 5),
  ('Icaro Guida', 'Resistência dos Materiais', 'ENG 4º Período', 1),
  ('Arthur Leite', 'Desenho Técnico II', 'ENG 4º Período', 2),
  ('Hiago de Lira', 'Cálculo Avançado', 'ENG 4º Período', 3),
  ('Arthur Leite', 'Materiais de Construção II', 'ENG 4º Período', 4),
  ('Icaro Guida', 'Teoria das Estruturas I', 'ENG 4º Período', 5),
  ('Welligton Barbosa', 'Avaliações e Perícias de Engenharia', 'ENG 6º Período', 2),
  ('Icaro Guida', 'Estruturas de Concreto Armado I', 'ENG 6º Período', 3),
  ('Daniel Victor', 'Geologia', 'ENG 6º Período', 4)
) AS v(professor, materia, turma, dia)
CROSS JOIN (VALUES (1),(2),(3),(4)) AS h(h)
JOIN public.professores p ON lower(p.nome) = lower(v.professor)
JOIN public.materias m ON m.nome = v.materia AND m.curso_id = 'eng'
JOIN public.turmas t ON t.nome = v.turma
ON CONFLICT (professor_id, materia_id, turma_id, dia_semana, horario_id) DO NOTHING;
