-- Role enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Professores
CREATE TABLE public.professores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cpf text,
  email text,
  telefone text,
  valor_hora_aula numeric(10,2) DEFAULT 0,
  chave_pix text,
  status text DEFAULT 'ativo' CHECK (status IN ('ativo', 'inativo')),
  pin text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.professores ENABLE ROW LEVEL SECURITY;

-- Materias
CREATE TABLE public.materias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  carga_horaria_total int DEFAULT 0,
  curso_id text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.materias ENABLE ROW LEVEL SECURITY;

-- Professor-Materia link
CREATE TABLE public.professor_materias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id uuid REFERENCES public.professores(id) ON DELETE CASCADE NOT NULL,
  materia_id uuid REFERENCES public.materias(id) ON DELETE CASCADE NOT NULL,
  UNIQUE (professor_id, materia_id)
);
ALTER TABLE public.professor_materias ENABLE ROW LEVEL SECURITY;

-- Turmas
CREATE TABLE public.turmas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  curso_id text NOT NULL,
  periodo text,
  turno text DEFAULT 'Noturno',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.turmas ENABLE ROW LEVEL SECURITY;

-- Turma-Materia link
CREATE TABLE public.turma_materias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  turma_id uuid REFERENCES public.turmas(id) ON DELETE CASCADE NOT NULL,
  materia_id uuid REFERENCES public.materias(id) ON DELETE CASCADE NOT NULL,
  UNIQUE (turma_id, materia_id)
);
ALTER TABLE public.turma_materias ENABLE ROW LEVEL SECURITY;

-- Registros de Ponto
CREATE TABLE public.registros_ponto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  professor_id uuid REFERENCES public.professores(id) ON DELETE CASCADE NOT NULL,
  materia_id uuid REFERENCES public.materias(id) NOT NULL,
  turma_id uuid REFERENCES public.turmas(id) NOT NULL,
  data date NOT NULL,
  horarios int[] NOT NULL,
  quantidade_horarios int NOT NULL,
  carga_horaria int NOT NULL,
  valor_total numeric(10,2) NOT NULL,
  observacao text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz
);
ALTER TABLE public.registros_ponto ENABLE ROW LEVEL SECURITY;

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_registros_ponto_updated_at
  BEFORE UPDATE ON public.registros_ponto
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS: Admin full access
CREATE POLICY "Admins full access professores" ON public.professores FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins full access materias" ON public.materias FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins full access turmas" ON public.turmas FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins full access professor_materias" ON public.professor_materias FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins full access turma_materias" ON public.turma_materias FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins full access registros" ON public.registros_ponto FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS: Anon read access for professor clock-in
CREATE POLICY "Anon read professores" ON public.professores FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read materias" ON public.materias FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read turmas" ON public.turmas FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read professor_materias" ON public.professor_materias FOR SELECT TO anon USING (true);
CREATE POLICY "Anon read turma_materias" ON public.turma_materias FOR SELECT TO anon USING (true);
CREATE POLICY "Anon insert registros" ON public.registros_ponto FOR INSERT TO anon WITH CHECK (true);
CREATE POLICY "Anon read registros" ON public.registros_ponto FOR SELECT TO anon USING (true);

-- RLS: Auth read for non-admin authenticated users  
CREATE POLICY "Auth read professores" ON public.professores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth read materias" ON public.materias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth read turmas" ON public.turmas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth read professor_materias" ON public.professor_materias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth read turma_materias" ON public.turma_materias FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth read registros" ON public.registros_ponto FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth read own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- Auth insert registros for authenticated too
CREATE POLICY "Auth insert registros" ON public.registros_ponto FOR INSERT TO authenticated WITH CHECK (true);