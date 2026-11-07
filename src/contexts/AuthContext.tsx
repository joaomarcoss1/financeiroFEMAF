import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { academicoDb } from '@/features/protocolos/api/db';
import type { User, Session } from '@supabase/supabase-js';

export type AppRole = 'admin' | 'aluno' | 'secretaria' | 'coordenador' | 'diretor' | 'setor';
export const ROLES_EQUIPE: AppRole[] = ['admin', 'secretaria', 'coordenador', 'diretor', 'setor'];

export interface SetorMembro { setor_id: string; curso_id: string | null }

interface AuthContextType {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  setores: SetorMembro[];
  alunoId: string | null;
  isAdmin: boolean;
  isEquipe: boolean;
  hasRole: (...r: AppRole[]) => boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: { message: string } | null; roles: AppRole[] }>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface Perfil { roles: AppRole[]; setores: SetorMembro[]; alunoId: string | null }
const VAZIO: Perfil = { roles: [], setores: [], alunoId: null };

async function carregarPerfil(userId: string): Promise<Perfil> {
  const [r, s, a] = await Promise.all([
    supabase.from('user_roles').select('role').eq('user_id', userId),
    academicoDb.from('setor_membros').select('setor_id, curso_id').eq('user_id', userId),
    academicoDb.from('alunos').select('id').eq('user_id', userId).maybeSingle(),
  ]);
  return {
    roles: ((r.data ?? []) as { role: string }[]).map((x) => x.role as AppRole),
    setores: (s.error ? [] : s.data ?? []) as SetorMembro[],
    alunoId: (a.error ? null : a.data?.id) ?? null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [perfil, setPerfil] = useState<Perfil>(VAZIO);
  const [loading, setLoading] = useState(true);

  async function syncAuthState(nextSession: Session | null): Promise<Perfil> {
    setSession(nextSession);
    setUser(nextSession?.user ?? null);
    const p = nextSession?.user ? await carregarPerfil(nextSession.user.id) : VAZIO;
    setPerfil(p);
    return p;
  }

  useEffect(() => {
    let mounted = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;

      setLoading(true);
      void syncAuthState(nextSession).finally(() => {
        if (mounted) setLoading(false);
      });
    });

    void supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      if (!mounted) return;

      setLoading(true);
      void syncAuthState(currentSession).finally(() => {
        if (mounted) setLoading(false);
      });
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  // A checagem de papel fica nas rotas (ProtectedRoute); o login não derruba quem não é admin.
  async function signIn(email: string, password: string) {
    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      return { error, roles: [] as AppRole[] };
    }
    const p = await syncAuthState(data.session ?? null);
    setLoading(false);
    return { error: null, roles: p.roles };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setPerfil(VAZIO);
  }

  const refresh = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    await syncAuthState(data.session);
  }, []);

  const hasRole = (...r: AppRole[]) => perfil.roles.some((x) => r.includes(x));
  const isAdmin = perfil.roles.includes('admin');
  const isEquipe = hasRole(...ROLES_EQUIPE) || perfil.setores.length > 0;

  return (
    <AuthContext.Provider value={{ user, session, roles: perfil.roles, setores: perfil.setores, alunoId: perfil.alunoId, isAdmin, isEquipe, hasRole, loading, signIn, signOut, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
