import { Navigate } from 'react-router-dom';
import { useAuth, type AppRole } from '@/contexts/AuthContext';

interface Props {
  children: React.ReactNode;
  /** Papéis aceitos; padrão: só admin. 'equipe' aceita qualquer papel/setor da equipe. */
  roles?: (AppRole | 'equipe')[];
  redirectTo?: string;
}

export default function ProtectedRoute({ children, roles = ['admin'], redirectTo = '/login' }: Props) {
  const { user, loading, hasRole, isEquipe } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const permitido = roles.some((r) => (r === 'equipe' ? isEquipe : hasRole(r)));
  if (!user || !permitido) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
