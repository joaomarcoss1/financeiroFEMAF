import { ReactNode, useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, MotionConfig } from 'framer-motion';
import {
  LayoutDashboard, Users, BookOpen, GraduationCap,
  FileText, Settings, Menu, X, LogOut, Clock, Download, FileSpreadsheet, CalendarDays, Layers, ArrowLeftRight, CalendarCheck, Briefcase, ClipboardCheck,
  Inbox, Contact, UsersRound, ListChecks, FileSignature, QrCode, ExternalLink,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import ThemeToggle from '@/components/ThemeToggle';
import SinoNotificacoes from '@/components/SinoNotificacoes';
import { subscribePush } from '@/lib/push';
import { useAppSettings } from '@/hooks/useAppSettings';
import { cn } from '@/lib/utils';
import MarcaAnimada from '@/features/protocolos/components/identidade/MarcaAnimada';
import { FundoInstitucional } from '@/features/protocolos/layouts/CentralLayout';

type NavItem = { key: string; to: string; label: string; icon: typeof Inbox; grupo: string };

const ALL_NAV_ITEMS: NavItem[] = [
  { key: 'dashboard',     to: '/admin',                     label: 'Visão geral',           icon: LayoutDashboard, grupo: 'Início' },
  { key: 'professores',   to: '/admin/professores',         label: 'Professores',           icon: Users,           grupo: 'Acadêmico' },
  { key: 'materias',      to: '/admin/materias',            label: 'Matérias',              icon: BookOpen,        grupo: 'Acadêmico' },
  { key: 'turmas',        to: '/admin/turmas',              label: 'Turmas',                icon: GraduationCap,   grupo: 'Acadêmico' },
  { key: 'grade',         to: '/admin/grade-horarios',      label: 'Grade de horários',     icon: CalendarDays,    grupo: 'Acadêmico' },
  { key: 'juncoes',       to: '/admin/juncoes-turmas',      label: 'Junção de turmas',      icon: Layers,          grupo: 'Acadêmico' },
  { key: 'juncoes_disc',  to: '/admin/juncoes-disciplinas', label: 'Junção de disciplinas', icon: BookOpen,        grupo: 'Acadêmico' },
  { key: 'provas',        to: '/admin/provas',              label: 'Provas',                icon: ClipboardCheck,  grupo: 'Acadêmico' },
  { key: 'registros',     to: '/admin/registros',           label: 'Registros de ponto',    icon: FileText,        grupo: 'Ponto e folha' },
  { key: 'permutas',      to: '/admin/permutas',            label: 'Permutas',              icon: ArrowLeftRight,  grupo: 'Ponto e folha' },
  { key: 'relatorios',    to: '/admin/relatorios',          label: 'Relatórios',            icon: FileText,        grupo: 'Ponto e folha' },
  { key: 'folha',         to: '/admin/folha-pagamento',     label: 'Folha de pagamento',    icon: FileSpreadsheet, grupo: 'Ponto e folha' },
  { key: 'feriados',      to: '/admin/feriados-ajustes',    label: 'Feriados e ajustes',    icon: CalendarCheck,   grupo: 'Ponto e folha' },
  { key: 'administrativo',to: '/admin/administrativo',      label: 'Administrativo e apoio',icon: Briefcase,       grupo: 'Ponto e folha' },
  { key: 'secretaria',    to: '/admin/protocolos',          label: 'Protocolos',            icon: Inbox,           grupo: 'Secretaria' },
  { key: 'secretaria',    to: '/admin/alunos',              label: 'Alunos',                icon: Contact,         grupo: 'Secretaria' },
  { key: 'secretaria',    to: '/admin/equipe',              label: 'Equipe e setores',      icon: UsersRound,      grupo: 'Secretaria' },
  { key: 'secretaria',    to: '/admin/tipos-protocolo',     label: 'Tipos de protocolo',    icon: ListChecks,      grupo: 'Secretaria' },
  { key: 'secretaria',    to: '/admin/documentos',          label: 'Documentos emitidos',   icon: FileSignature,   grupo: 'Secretaria' },
  { key: 'secretaria',    to: '/admin/links',               label: 'Links da Central',      icon: QrCode,          grupo: 'Secretaria' },
  { key: 'configuracoes', to: '/admin/configuracoes',       label: 'Configurações',         icon: Settings,        grupo: 'Sistema' },
  { key: 'instalar',      to: '/instalar',                  label: 'Instalar aplicativo',   icon: Download,        grupo: 'Sistema' },
];

const ativo = (to: string, pathname: string) => (to === '/admin' ? pathname === '/admin' : pathname === to || pathname.startsWith(`${to}/`));

/** O leque do símbolo se abre só na primeira carga do painel na sessão. */
let lequeAberto = false;

function Marca({ claro = true }: { claro?: boolean }) {
  const [animar] = useState(() => !lequeAberto);
  useEffect(() => { lequeAberto = true; }, []);
  return (
    <Link to="/admin" className={cn('group flex min-w-0 items-center gap-3', claro ? 'text-white' : 'text-foreground')} aria-label="FEMAF — Administração">
      <MarcaAnimada animar={animar} className="h-9 w-12 shrink-0 transition-transform duration-500 group-hover:rotate-[-6deg] group-hover:scale-105" />
      <span className={cn('h-8 w-px', claro ? 'bg-white/20' : 'bg-border')} aria-hidden="true" />
      <span className="min-w-0 leading-tight">
        <span className="block truncate font-['Source_Serif_4',Georgia,serif] text-[16px] font-semibold tracking-wide">FEMAF</span>
        <span className={cn('block truncate text-[10.5px] uppercase tracking-[0.18em]', claro ? 'text-white/55' : 'text-muted-foreground')}>Gestão Financeira</span>
      </span>
    </Link>
  );
}

function ListaNav({ itens, pathname, layoutId, onNavigate }: { itens: NavItem[]; pathname: string; layoutId: string; onNavigate?: () => void }) {
  return (
    <>
      {itens.map((item, i) => {
        const Icon = item.icon;
        const on = ativo(item.to, pathname);
        return (
          <div key={item.to}>
            {item.grupo !== itens[i - 1]?.grupo && (
              <p className={cn('px-3 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.16em] text-white/35', i === 0 ? 'pt-1' : 'pt-5')}>{item.grupo}</p>
            )}
            <Link to={item.to} onClick={onNavigate} aria-current={on ? 'page' : undefined}
              className={cn('group relative flex items-center gap-3 rounded-md px-3 py-2 text-[13.5px] transition-colors duration-200',
                on ? 'bg-white/[0.08] font-semibold text-white' : 'text-white/60 hover:bg-white/[0.04] hover:text-white')}>
              {on && <motion.span layoutId={layoutId} className="absolute inset-y-1.5 left-0 w-0.5 bg-[hsl(201_78%_52%)]" transition={{ type: 'spring', stiffness: 520, damping: 40 }} />}
              <Icon size={16} className={cn('shrink-0 transition-colors', on ? 'text-[hsl(201_80%_60%)]' : 'text-white/45 group-hover:text-white/80')} />
              <span className="truncate">{item.label}</span>
            </Link>
          </div>
        );
      })}
    </>
  );
}

/**
 * Painel administrativo no padrão institucional da Central: barra lateral azul FEMAF com fio azul-céu,
 * menu agrupado, cabeçalho claro com o título da página em serifa e o papel com guilhochê ao fundo.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [rolado, setRolado] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const settings = useAppSettings();

  const navItems = useMemo(() => {
    const enabledKeys = new Set((settings.menu_items || []).filter(m => m.enabled).map(m => m.key));
    // se config ainda não carregou, mostra tudo
    if (!settings.menu_items || settings.menu_items.length === 0) return ALL_NAV_ITEMS;
    return ALL_NAV_ITEMS.filter(i => enabledKeys.has(i.key));
  }, [settings.menu_items]);

  const atual = useMemo(
    () => [...navItems].sort((a, b) => b.to.length - a.to.length).find(i => ativo(i.to, location.pathname)),
    [navItems, location.pathname],
  );

  useEffect(() => {
    // Inscreve admin para Web Push (silencioso se já decidido / não suportado)
    subscribePush({ role: 'admin' }).catch(() => {});
  }, []);

  useEffect(() => {
    const f = () => setRolado(window.scrollY > 4);
    f();
    window.addEventListener('scroll', f, { passive: true });
    return () => window.removeEventListener('scroll', f);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [location.pathname]);

  async function handleLogout() {
    await signOut();
    navigate('/login');
  }

  return (
    <MotionConfig reducedMotion="user">
    <div className="inst-page inst-admin relative isolate min-h-screen lg:flex">
      <FundoInstitucional />

      {/* ===== Barra lateral (lg+) ===== */}
      <aside className="inst-bar relative hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-[17rem] lg:shrink-0 lg:flex-col">
        <div className="flex h-14 shrink-0 items-center border-b border-white/10 px-5"><Marca /></div>
        <nav className="scrollbar-thin flex-1 overflow-y-auto overscroll-contain px-3 py-4" aria-label="Menu administrativo">
          <ListaNav itens={navItems} pathname={location.pathname} layoutId="admin-nav-fio" />
        </nav>
        <div className="space-y-0.5 border-t border-white/10 p-3">
          <Link to="/central" className="flex items-center gap-3 rounded-md px-3 py-2 text-[13px] text-white/60 transition-colors hover:bg-white/[0.04] hover:text-white">
            <ExternalLink size={15} /> Central Acadêmica
          </Link>
          <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-[13px] text-white/60 transition-colors hover:bg-white/[0.04] hover:text-white">
            <LogOut size={15} /> Sair
          </button>
        </div>
        <div className="inst-rule absolute inset-y-0 right-0 h-auto w-[3px]" aria-hidden="true" />
      </aside>

      {/* ===== Coluna principal ===== */}
      <div className="min-w-0 flex-1">
        {/* Cabeçalho móvel (verde) */}
        <header className="inst-bar sticky top-0 z-50 text-white lg:hidden" data-rolado={rolado}>
          <div className="flex h-16 items-center justify-between gap-2 px-4">
            <Marca />
            <div className="flex items-center gap-0.5">
              <ThemeToggle className="text-white/70 hover:bg-white/10 hover:text-white" />
              <SinoNotificacoes role="admin" className="text-white/80" />
              <button onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
                className="rounded-md p-2 text-white transition-colors hover:bg-white/10">
                {menuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
          <div className="inst-rule" />
        </header>

        {/* Cabeçalho da página (desktop, claro) */}
        <header className={cn('sticky top-0 z-40 hidden border-b border-border bg-[hsl(201_22%_97.5%/0.88)] backdrop-blur-md transition-shadow duration-300 dark:bg-background/85 lg:block',
          rolado && 'shadow-[0_8px_24px_-16px_hsl(246_40%_15%/0.35)]')}>
          <div className="flex h-14 items-center justify-between gap-4 px-8">
            <nav aria-label="Você está em" className="flex min-w-0 items-center gap-2 text-sm">
              <Link to="/admin" className="text-muted-foreground transition-colors hover:text-foreground">Administração</Link>
              {atual && atual.to !== '/admin' && (
                <>
                  <span className="text-muted-foreground/50">/</span>
                  <span className="text-muted-foreground">{atual.grupo}</span>
                  <span className="text-muted-foreground/50">/</span>
                  <AnimatePresence mode="wait">
                    <motion.span key={atual.to} className="truncate font-semibold text-foreground"
                      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2 }}>
                      {atual.label}
                    </motion.span>
                  </AnimatePresence>
                </>
              )}
            </nav>
            <div className="flex items-center gap-1">
              {user?.email && <span className="mr-2 hidden max-w-[16rem] truncate text-sm text-muted-foreground xl:inline">{user.email}</span>}
              <ThemeToggle className="text-muted-foreground hover:bg-muted hover:text-foreground" />
              <SinoNotificacoes role="admin" className="text-muted-foreground hover:text-foreground" />
              <Link to="/" title="Bater ponto" className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <Clock size={19} />
              </Link>
            </div>
          </div>
        </header>

        {/* Menu móvel */}
        <AnimatePresence>
          {menuOpen && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-[hsl(246_60%_6%/0.45)] backdrop-blur-[2px] lg:hidden" onClick={() => setMenuOpen(false)} />
              <motion.nav initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 260 }}
                className="inst-bar fixed bottom-0 right-0 top-0 z-50 flex w-[18rem] flex-col shadow-2xl lg:hidden" aria-label="Menu administrativo">
                <div className="flex h-16 shrink-0 items-center justify-end px-4">
                  <button onClick={() => setMenuOpen(false)} aria-label="Fechar menu" className="rounded-md p-2 text-white hover:bg-white/10"><X size={22} /></button>
                </div>
                <div className="scrollbar-thin flex-1 overflow-y-auto overscroll-contain px-3 pb-4">
                  <ListaNav itens={navItems} pathname={location.pathname} layoutId="admin-nav-fio-movel" onNavigate={() => setMenuOpen(false)} />
                </div>
                <div className="space-y-0.5 border-t border-white/10 p-3">
                  <Link to="/" className="flex items-center gap-3 rounded-md px-3 py-2 text-[13px] text-white/60 hover:bg-white/[0.04] hover:text-white"><Clock size={15} /> Bater ponto</Link>
                  <button onClick={handleLogout} className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-[13px] text-white/60 hover:bg-white/[0.04] hover:text-white"><LogOut size={15} /> Sair</button>
                </div>
              </motion.nav>
            </>
          )}
        </AnimatePresence>

        <main className="px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pt-8">
          <AnimatePresence mode="wait">
            <motion.div key={location.pathname}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}>
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
    </MotionConfig>
  );
}
