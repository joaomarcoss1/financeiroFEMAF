import { useEffect, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import AcessoLayout from '../layouts/AcessoLayout';
import MarcaAnimada from '../components/identidade/MarcaAnimada';
import { VincularMatricula } from '../components/VincularMatricula';
import { vincularConta, type VinculoPendente } from '../api/conta';

const ATALHOS = [
  { to: '/central/primeiro-acesso', titulo: 'Primeiro acesso do aluno' },
  { to: '/central/equipe/cadastro', titulo: 'Cadastro da equipe acadêmica' },
  { to: '/validar', titulo: 'Validar um documento' },
];

function Carregando() {
  return (
    <div className="flex justify-center py-16" role="status" aria-label="Carregando">
      <MarcaAnimada tom="claro" className="h-14 w-auto animate-pulse" />
    </div>
  );
}

export default function CentralHome() {
  const { user, alunoId, isEquipe, loading, signIn, refresh, signOut } = useAuth();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [entrando, setEntrando] = useState(false);
  const [vinculando, setVinculando] = useState(false);
  const tentouAuto = useRef(false);

  // Vínculo automático no primeiro login após confirmar o e-mail.
  const pendente = user?.user_metadata?.vinculo_pendente as VinculoPendente | null | undefined;
  useEffect(() => {
    if (loading || !user || alunoId || isEquipe || !pendente || tentouAuto.current) return;
    tentouAuto.current = true;
    setVinculando(true);
    vincularConta(pendente).then((f) => (f ? setErro(f) : refresh())).catch(() => undefined).finally(() => setVinculando(false));
  }, [loading, user, alunoId, isEquipe, pendente, refresh]);

  if (loading || vinculando) return <AcessoLayout titulo="Central Acadêmica"><Carregando /></AcessoLayout>;
  if (user && alunoId) return <Navigate to="/central/protocolos" replace />;
  if (user && isEquipe) return <Navigate to="/central/equipe" replace />;

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setEntrando(true);
    setErro(null);
    const { error } = await signIn(email.trim(), senha);
    setEntrando(false);
    if (error) setErro(error.message === 'Email not confirmed' ? 'Confirme seu e-mail pelo link que enviamos antes de entrar.' : 'E-mail ou senha incorretos.');
  }

  if (user) {
    const equipe = user.user_metadata?.tipo === 'equipe';
    return (
      <AcessoLayout
        titulo={equipe ? 'Cadastro em análise' : 'Confirme sua matrícula'}
        descricao={equipe
          ? 'Sua conta foi criada. A administração precisa liberar seu acesso e setor.'
          : 'Informe os dados do seu cadastro na Secretaria Acadêmica para liberar a Central.'}
        rodape={<button type="button" className="inst-link" onClick={() => void signOut()}>Sair e usar outra conta</button>}
      >
        {erro && <p role="alert" className="mb-4 text-sm text-destructive">{erro}</p>}
        {equipe ? <Button variant="outline" className="h-11 w-full" onClick={() => refresh()}>Verificar novamente</Button> : <VincularMatricula />}
      </AcessoLayout>
    );
  }

  return (
    <AcessoLayout
      titulo="Acesso à Central"
      descricao="Alunos e equipe acadêmica entram com e-mail e senha."
      rodape={
        <ul className="divide-y divide-border">
          {ATALHOS.map((a) => (
            <li key={a.to}>
              <Link to={a.to} className="inst-row group -mx-3 justify-between rounded-sm px-3 py-3 text-foreground/85 hover:text-[hsl(var(--inst-verde))] sm:-mx-3 sm:px-3 dark:hover:text-primary">
                {a.titulo}<ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </Link>
            </li>
          ))}
        </ul>
      }
    >
      <form onSubmit={entrar} className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="c-email">E-mail</Label>
          <Input id="c-email" type="email" autoComplete="email" className="inst-field" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <Label htmlFor="c-senha">Senha</Label>
            <Link to="/reset-password?origem=central" className="text-xs text-muted-foreground hover:text-primary">Esqueci minha senha</Link>
          </div>
          <div className="relative">
            <Input id="c-senha" type={verSenha ? 'text' : 'password'} autoComplete="current-password" className="inst-field pr-11" value={senha} onChange={(e) => setSenha(e.target.value)} required />
            <button type="button" onClick={() => setVerSenha((v) => !v)} aria-label={verSenha ? 'Ocultar senha' : 'Mostrar senha'}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-2 text-muted-foreground hover:text-foreground">
              {verSenha ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <Button type="submit" className="h-11 w-full rounded-md text-[15px]" disabled={entrando}>
          {entrando ? 'Entrando…' : 'Entrar'}
        </Button>
      </form>
    </AcessoLayout>
  );
}
