import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AdminLayout from "@/components/AdminLayout";
import SplashScreen from "@/components/SplashScreen";
import BaterPonto from "./pages/BaterPonto";
import Login from "./pages/Login";

// Lazy-loaded para reduzir bundle inicial (BaterPonto é o entrypoint dos professores)
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Professores = lazy(() => import("./pages/Professores"));
const Materias = lazy(() => import("./pages/Materias"));
const Turmas = lazy(() => import("./pages/Turmas"));
const GradeHorarios = lazy(() => import("./pages/GradeHorarios"));
const JuncoesTurmas = lazy(() => import("./pages/JuncoesTurmas"));
const JuncoesDisciplinas = lazy(() => import("./pages/JuncoesDisciplinas"));
const Permutas = lazy(() => import("./pages/Permutas"));
const Permuta = lazy(() => import("./pages/Permuta"));
const Registros = lazy(() => import("./pages/Registros"));
const Relatorios = lazy(() => import("./pages/Relatorios"));
const FolhaPagamento = lazy(() => import("./pages/FolhaPagamento"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const FeriadosAjustes = lazy(() => import("./pages/FeriadosAjustes"));
const Administrativo = lazy(() => import("./pages/Administrativo"));
const Instalar = lazy(() => import("./pages/Instalar"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const CoordenadorLogin = lazy(() => import("./pages/CoordenadorLogin"));
const Coordenador = lazy(() => import("./pages/Coordenador"));
const EnviarProva = lazy(() => import("./pages/EnviarProva"));
const Provas = lazy(() => import("./pages/Provas"));
const NotFound = lazy(() => import("./pages/NotFound"));
// Central do Aluno / Equipe (F6/F7)
const CentralHome = lazy(() => import("./features/protocolos/pages/CentralHome"));
const PrimeiroAcesso = lazy(() => import("./features/protocolos/pages/PrimeiroAcesso"));
const MeusProtocolos = lazy(() => import("./features/protocolos/pages/MeusProtocolos"));
const NovoProtocolo = lazy(() => import("./features/protocolos/pages/NovoProtocolo"));
const ProtocoloAluno = lazy(() => import("./features/protocolos/pages/ProtocoloAluno"));
const PerfilAluno = lazy(() => import("./features/protocolos/pages/Perfil"));
const MeusDocumentos = lazy(() => import("./features/documentos/pages/MeusDocumentos"));
const EquipeCadastro = lazy(() => import("./features/protocolos/pages/EquipeCadastro"));
const FilaEquipe = lazy(() => import("./features/protocolos/pages/FilaEquipe"));
const ProtocoloEquipe = lazy(() => import("./features/protocolos/pages/ProtocoloEquipe"));
const Assinaturas = lazy(() => import("./features/documentos/pages/Assinaturas"));
const Validar = lazy(() => import("./features/documentos/pages/Validar"));
const AdminProtocolos = lazy(() => import("./features/protocolos/pages/AdminProtocolos"));
const AdminAlunos = lazy(() => import("./features/protocolos/pages/AdminAlunos"));
const AdminEquipe = lazy(() => import("./features/protocolos/pages/AdminEquipe"));
const AdminTipos = lazy(() => import("./features/protocolos/pages/AdminTipos"));
const AdminDocumentos = lazy(() => import("./features/documentos/pages/AdminDocumentos"));
const LinksCentral = lazy(() => import("./features/protocolos/pages/Links"));

const queryClient = new QueryClient();

function PageFallback() {
  return (
    <div className="min-h-[40vh] flex items-center justify-center">
      <div className="relative h-10 w-10" aria-label="Carregando" role="status">
        <div className="absolute inset-0 rounded-full border-2 border-primary/15" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary border-r-primary animate-spin" />
        <div className="absolute inset-2 rounded-full bg-primary/10 animate-pulse-soft" />
      </div>
    </div>
  );
}

function AlunoPage({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute roles={['aluno']} redirectTo="/central">{children}</ProtectedRoute>;
}

function EquipePage({ children }: { children: React.ReactNode }) {
  return <ProtectedRoute roles={['equipe']} redirectTo="/central">{children}</ProtectedRoute>;
}

function AdminPage({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AdminLayout>
        <Suspense fallback={<PageFallback />}>{children}</Suspense>
      </AdminLayout>
    </ProtectedRoute>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <AuthProvider>
        <SplashScreen>
          <BrowserRouter>
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/" element={<BaterPonto />} />
                <Route path="/login" element={<Login />} />
                <Route path="/conecte-se" element={<Login />} />
                <Route path="/instalar" element={<Instalar />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route path="/coordenador/login" element={<CoordenadorLogin />} />
                <Route path="/coordenador" element={<Coordenador />} />
                <Route path="/permuta" element={<Permuta />} />
                <Route path="/enviar-prova" element={<EnviarProva />} />

                <Route path="/central" element={<CentralHome />} />
                <Route path="/central/primeiro-acesso" element={<PrimeiroAcesso />} />
                <Route path="/central/protocolos" element={<AlunoPage><MeusProtocolos /></AlunoPage>} />
                <Route path="/central/protocolos/novo" element={<AlunoPage><NovoProtocolo /></AlunoPage>} />
                <Route path="/central/protocolos/:id" element={<AlunoPage><ProtocoloAluno /></AlunoPage>} />
                <Route path="/central/documentos" element={<AlunoPage><MeusDocumentos /></AlunoPage>} />
                <Route path="/central/perfil" element={<AlunoPage><PerfilAluno /></AlunoPage>} />
                <Route path="/central/equipe/cadastro" element={<EquipeCadastro />} />
                <Route path="/central/equipe" element={<EquipePage><FilaEquipe /></EquipePage>} />
                <Route path="/central/equipe/protocolos/:id" element={<EquipePage><ProtocoloEquipe /></EquipePage>} />
                <Route path="/central/assinaturas" element={<EquipePage><Assinaturas /></EquipePage>} />
                <Route path="/validar" element={<Validar />} />
                <Route path="/validar/:codigo" element={<Validar />} />

                <Route path="/admin" element={<AdminPage><Dashboard /></AdminPage>} />
                <Route path="/admin/professores" element={<AdminPage><Professores /></AdminPage>} />
                <Route path="/admin/materias" element={<AdminPage><Materias /></AdminPage>} />
                <Route path="/admin/turmas" element={<AdminPage><Turmas /></AdminPage>} />
                <Route path="/admin/grade-horarios" element={<AdminPage><GradeHorarios /></AdminPage>} />
                <Route path="/admin/juncoes-turmas" element={<AdminPage><JuncoesTurmas /></AdminPage>} />
                <Route path="/admin/juncoes-disciplinas" element={<AdminPage><JuncoesDisciplinas /></AdminPage>} />
                <Route path="/admin/permutas" element={<AdminPage><Permutas /></AdminPage>} />
                <Route path="/admin/registros" element={<AdminPage><Registros /></AdminPage>} />
                <Route path="/admin/relatorios" element={<AdminPage><Relatorios /></AdminPage>} />
                <Route path="/admin/folha-pagamento" element={<AdminPage><FolhaPagamento /></AdminPage>} />
                <Route path="/admin/feriados-ajustes" element={<AdminPage><FeriadosAjustes /></AdminPage>} />
                <Route path="/admin/administrativo" element={<AdminPage><Administrativo /></AdminPage>} />
                <Route path="/admin/provas" element={<AdminPage><Provas /></AdminPage>} />
                <Route path="/admin/protocolos" element={<AdminPage><AdminProtocolos /></AdminPage>} />
                <Route path="/admin/protocolos/:id" element={<AdminPage><AdminProtocolos /></AdminPage>} />
                <Route path="/admin/alunos" element={<AdminPage><AdminAlunos /></AdminPage>} />
                <Route path="/admin/equipe" element={<AdminPage><AdminEquipe /></AdminPage>} />
                <Route path="/admin/tipos-protocolo" element={<AdminPage><AdminTipos /></AdminPage>} />
                <Route path="/admin/documentos" element={<AdminPage><AdminDocumentos /></AdminPage>} />
                <Route path="/admin/links" element={<AdminPage><LinksCentral /></AdminPage>} />
                <Route path="/admin/configuracoes" element={<AdminPage><Configuracoes /></AdminPage>} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </SplashScreen>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
