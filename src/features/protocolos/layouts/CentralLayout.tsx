import { ReactNode, useEffect, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { motion, MotionConfig } from 'framer-motion';
import { FileText, FilePlus2, FolderOpen, User, Inbox, PenLine, LogOut, LayoutDashboard } from 'lucide-react';
import ThemeToggle from '@/components/ThemeToggle';
import MarcaFemaf from '@/components/MarcaFemaf';
import MarcaAnimada from '../components/identidade/MarcaAnimada';
import Guilloche from '../components/identidade/Guilloche';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';

export const EASE = [0.16, 1, 0.3, 1] as const;

const NAV_ALUNO = [
  { to: '/central/protocolos', label: 'Protocolos', icon: FileText, end: true },
  { to: '/central/protocolos/novo', label: 'Novo pedido', icon: FilePlus2, end: true },
  { to: '/central/documentos', label: 'Documentos', icon: FolderOpen, end: false },
  { to: '/central/perfil', label: 'Meus dados', icon: User, end: false },
];
const NAV_EQUIPE = [
  { to: '/central/equipe', label: 'Fila', icon: Inbox, end: true },
  { to: '/central/assinaturas', label: 'Assinaturas', icon: PenLine, end: false },
];

// O leque se abre só na primeira tela da sessão; nas navegações seguintes fica parado.
let lequeAberto = false;

/** Assinatura institucional: símbolo + nome da instituição em serifa. */
export function Assinatura({ compacta = false }: { compacta?: boolean }) {
  const [animar] = useState(() => !lequeAberto);
  useEffect(() => { lequeAberto = true; }, []);
  return (
    <Link to="/central" className="group flex min-w-0 items-center gap-3 text-white" aria-label="FEMAF — Central Acadêmica">
      <MarcaAnimada animar={animar} className={cn('shrink-0 transition-transform duration-500 group-hover:rotate-[-6deg] group-hover:scale-105', compacta ? 'h-8 w-11' : 'h-10 w-14')} />
      <span className="h-8 w-px bg-white/20" aria-hidden="true" />
      <span className="min-w-0 leading-tight">
        <span className="block truncate font-['Source_Serif_4',Georgia,serif] text-[17px] font-semibold tracking-wide">FEMAF</span>
        <span className="block truncate text-[11px] uppercase tracking-[0.18em] text-white/60">Central Acadêmica</span>
      </span>
    </Link>
  );
}

/** Fundo do papel: rosácea guilhochê no canto e o livro FEMAF como marca d'água. */
export function FundoInstitucional() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <Guilloche className="absolute -right-[22rem] -top-[20rem] h-[56rem] w-[56rem] sm:-right-[16rem] sm:-top-[18rem]" />
      <MarcaFemaf mono className="absolute -bottom-40 -left-24 h-[34rem] text-[hsl(246_45%_25%)] opacity-[0.035] dark:text-white dark:opacity-[0.025]" />
    </div>
  );
}

function useRolado() {
  const [rolado, setRolado] = useState(false);
  useEffect(() => {
    const f = () => setRolado(window.scrollY > 4);
    f();
    window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);
  return rolado;
}

/**
 * Layout da Central (aluno e equipe), no padrão de portais acadêmicos institucionais:
 * barra superior azul FEMAF com fio azul-céu, navegação em texto, área de leitura clara e rodapé.
 * `hero` = tela de entrada (o conteúdo ocupa a página toda). `semFolha` mantido por compatibilidade.
 */
export default function CentralLayout({ children, titulo, subtitulo, hero = false }: {
  children: ReactNode; titulo?: string; subtitulo?: string; hero?: boolean; semFolha?: boolean;
}) {
  const { user, alunoId, isEquipe, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const nav = [
    ...(user ? [...(alunoId ? NAV_ALUNO : []), ...(isEquipe ? NAV_EQUIPE : [])] : []),
    ...(isAdmin ? [{ to: '/admin', label: 'Administração', icon: LayoutDashboard, end: false }] : []),
  ];
  const nome = (user?.user_metadata?.nome as string | undefined) ?? user?.email;
  const { pathname } = useLocation();
  const rolado = useRolado();

  if (hero) return <div className="inst-page flex min-h-screen flex-col">{children}<Rodape /></div>;

  return (
    <MotionConfig reducedMotion="user">
    <div className="inst-page relative isolate flex min-h-screen flex-col">
      <FundoInstitucional />
      <header className="inst-bar sticky top-0 z-30 text-white transition-shadow duration-300" data-rolado={rolado}>
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Assinatura compacta />
          <div className="ml-auto flex items-center gap-1">
            {nome && <span className="hidden max-w-[16rem] truncate pr-2 text-sm text-white/70 lg:inline">{nome}</span>}
            <ThemeToggle className="text-white/70 hover:bg-white/10 hover:text-white" />
            {user && (
              <button type="button" onClick={async () => { await signOut(); navigate('/central'); }}
                className="inline-flex h-9 items-center gap-2 rounded-md px-3 text-sm text-white/80 transition-colors hover:bg-white/10 hover:text-white">
                <LogOut className="h-4 w-4" /><span className="hidden sm:inline">Sair</span>
              </button>
            )}
          </div>
        </div>
        {nav.length > 0 && (
          <nav className="hidden border-t border-white/10 md:block" aria-label="Seções">
            <div className="mx-auto flex max-w-6xl gap-6 px-6">
              {nav.map((n) => (
                <NavLink key={n.to} to={n.to} end={n.end}
                  className={({ isActive }) => cn('relative py-3 text-sm transition-colors duration-200',
                    isActive ? 'font-semibold text-white' : 'text-white/65 hover:text-white')}>
                  {({ isActive }) => (
                    <>
                      {n.label}
                      {isActive && <motion.span layoutId="inst-nav-fio" className="absolute inset-x-0 -bottom-px h-0.5 bg-[hsl(201_78%_52%)]" transition={{ type: 'spring', stiffness: 520, damping: 40 }} />}
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </nav>
        )}
        <div className="inst-rule" />
      </header>

      <main className={cn('mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6', nav.length > 0 && 'pb-28 md:pb-12')}>
        <motion.div key={pathname} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: EASE }}>
          {titulo && (
            <div className="mb-6 border-b border-border pb-4">
              <h1 className="inst-title text-[28px] leading-tight sm:text-[32px]">{titulo}</h1>
              {subtitulo && <p className="mt-1 text-sm text-muted-foreground">{subtitulo}</p>}
              <motion.span aria-hidden="true" className="mt-4 block h-0.5 w-12 origin-left bg-[hsl(201_78%_52%)]" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.7, delay: 0.15, ease: EASE }} />
            </div>
          )}
          {children}
        </motion.div>
      </main>

      <Rodape />

      {nav.length > 0 && (
        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Seções">
          <div className="grid" style={{ gridTemplateColumns: `repeat(${nav.length}, minmax(0, 1fr))` }}>
            {nav.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end}
                className={({ isActive }) => cn('relative flex flex-col items-center gap-1 py-2.5 text-[11px] transition-colors active:scale-95',
                  isActive ? 'font-semibold text-[hsl(var(--inst-verde))] dark:text-primary' : 'text-muted-foreground')}>
                {({ isActive }) => (
                  <>
                    {isActive && <motion.span layoutId="inst-tab-fio" className="absolute inset-x-4 top-0 h-0.5 bg-[hsl(201_78%_52%)]" transition={{ type: 'spring', stiffness: 520, damping: 40 }} />}
                    <n.icon className="h-5 w-5" />{n.label}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </nav>
      )}
    </div>
    </MotionConfig>
  );
}

function Rodape() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>© {new Date().getFullYear()} FEMAF · Secretaria Acadêmica</p>
        <nav className="flex gap-4">
          <Link to="/validar" className="hover:text-foreground">Validar documento</Link>
          <Link to="/central" className="hover:text-foreground">Central Acadêmica</Link>
        </nav>
      </div>
    </footer>
  );
}
