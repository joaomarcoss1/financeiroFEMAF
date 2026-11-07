import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AcessoLayout from '@/features/protocolos/layouts/AcessoLayout';
import { SENHA_MINIMA } from '@/features/protocolos/lib/senha';

/**
 * Recuperação de senha em duas etapas:
 * - sem sessão: pede o e-mail e envia o link (resetPasswordForEmail → volta para esta página);
 * - com sessão (aberta pelo link do e-mail): define a nova senha.
 */
export default function ResetPassword() {
  const { session, loading, isAdmin } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [senha2, setSenha2] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [linkEnviado, setLinkEnviado] = useState(false);
  const [concluido, setConcluido] = useState(false);
  const entrada = params.get('origem') === 'admin' ? '/login' : '/central';

  async function pedirLink(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: `${window.location.origin}/reset-password` });
    setEnviando(false);
    // Mesma resposta exista ou não a conta, para não revelar quais e-mails estão cadastrados.
    if (error && /rate|seconds/i.test(error.message)) return setErro('Aguarde um minuto antes de pedir outro link.');
    setLinkEnviado(true);
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senha.length < SENHA_MINIMA) return setErro(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`);
    if (senha !== senha2) return setErro('As senhas não conferem.');
    setEnviando(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setEnviando(false);
    if (error) return setErro(/different|same/i.test(error.message) ? 'A nova senha precisa ser diferente da atual.' : 'Não foi possível salvar a senha. Peça um novo link e tente de novo.');
    setConcluido(true);
  }

  if (loading) return <AcessoLayout titulo="Redefinir senha"><div className="h-24" /></AcessoLayout>;

  if (concluido) {
    return (
      <AcessoLayout titulo="Senha redefinida" descricao="Sua senha foi alterada.">
        <CheckCircle2 className="mb-6 h-10 w-10 text-primary" />
        <Button className="h-11 w-full rounded-md" onClick={() => navigate(isAdmin ? '/admin' : '/central')}>Continuar</Button>
      </AcessoLayout>
    );
  }

  if (session) {
    return (
      <AcessoLayout titulo="Nova senha" descricao={`Conta ${session.user.email ?? ''}`}>
        <form onSubmit={salvar} className="space-y-4">
          <div className="space-y-1.5"><Label htmlFor="rp-senha">Nova senha</Label><Input id="rp-senha" type="password" autoComplete="new-password" className="inst-field" value={senha} onChange={(e) => setSenha(e.target.value)} required /></div>
          <div className="space-y-1.5"><Label htmlFor="rp-senha2">Repita a nova senha</Label><Input id="rp-senha2" type="password" autoComplete="new-password" className="inst-field" value={senha2} onChange={(e) => setSenha2(e.target.value)} required /></div>
          <p className="text-xs text-muted-foreground">Mínimo de {SENHA_MINIMA} caracteres.</p>
          {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
          <Button type="submit" className="h-11 w-full rounded-md" disabled={enviando}>{enviando ? 'Salvando…' : 'Salvar nova senha'}</Button>
        </form>
      </AcessoLayout>
    );
  }

  if (linkEnviado) {
    return (
      <AcessoLayout titulo="Verifique seu e-mail" descricao={`Se houver uma conta para ${email.trim()}, enviamos um link para criar uma nova senha. O link vale por tempo limitado.`}
        rodape={<Link to={entrada} className="inst-link">Voltar à entrada</Link>}>
        <MailCheck className="h-10 w-10 text-primary" />
      </AcessoLayout>
    );
  }

  return (
    <AcessoLayout titulo="Esqueci minha senha" descricao="Informe o e-mail da sua conta. Enviaremos um link para criar uma nova senha."
      rodape={<Link to={entrada} className="inst-link">Voltar à entrada</Link>}>
      <form onSubmit={pedirLink} className="space-y-4">
        <div className="space-y-1.5"><Label htmlFor="rp-email">E-mail</Label><Input id="rp-email" type="email" autoComplete="email" className="inst-field" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <Button type="submit" className="h-11 w-full rounded-md" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar link'}</Button>
      </form>
    </AcessoLayout>
  );
}
