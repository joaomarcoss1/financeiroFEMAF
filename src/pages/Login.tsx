import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeft, ArrowRight, MailCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import AcessoLayout from '@/features/protocolos/layouts/AcessoLayout';

const EASE = [0.16, 1, 0.3, 1] as const;


export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) {
      toast({ title: 'Preencha todos os campos', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { error, roles } = await signIn(email, password);
    setLoading(false);
    if (error) {
      toast({ title: 'Não foi possível entrar', description: error.message, variant: 'destructive' });
    } else {
      // quem não é admin (aluno, equipe) segue para a Central
      navigate(roles.includes('admin') ? '/admin' : '/central');
    }
  }

  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!email) {
      toast({ title: 'Digite seu e-mail', variant: 'destructive' });
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      toast({ title: 'Erro ao enviar e-mail', description: error.message, variant: 'destructive' });
    } else {
      setResetSent(true);
    }
  }

  if (resetSent) {
    return (
      <AcessoLayout painelTitulo="Plataforma de Gestão Financeira FEMAF" titulo="Verifique seu e-mail" descricao="Se houver uma conta para este e-mail, enviamos um link para criar uma nova senha."
        rodape={<button type="button" className="inst-link" onClick={() => { setResetSent(false); setForgotMode(false); }}>Voltar para o login</button>}>
        <MailCheck className="h-10 w-10 text-primary" />
      </AcessoLayout>
    );
  }

  const atalhos = (
    <ul className="divide-y divide-border">
      {[['/central', 'Central Acadêmica (alunos e equipe)'], ['/', 'Bater ponto (professores)']].map(([to, rotulo]) => (
        <li key={to}>
          <button type="button" onClick={() => navigate(to)}
            className="inst-row group -mx-3 w-[calc(100%+1.5rem)] justify-between rounded-sm px-3 py-3 text-left text-foreground/85 hover:text-[hsl(var(--inst-verde))] dark:hover:text-primary">
            {rotulo}<ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <AcessoLayout
      painelTitulo="Plataforma de Gestão Financeira FEMAF"
      painelTexto="Gestão acadêmica, ponto docente, folha de pagamento e Secretaria da FEMAF."
      titulo={forgotMode ? 'Esqueci minha senha' : 'Administração'}
      descricao={forgotMode ? 'Informe o e-mail da sua conta para receber o link de redefinição.' : 'Acesso restrito à gestão acadêmica e financeira.'}
      rodape={forgotMode
        ? <button type="button" className="inst-link inline-flex items-center gap-1" onClick={() => setForgotMode(false)}><ArrowLeft size={14} /> Voltar para o login</button>
        : atalhos}
    >
      <AnimatePresence mode="wait">
        {forgotMode ? (
          <motion.form key="forgot" onSubmit={handleForgotPassword} className="space-y-5"
            initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.25, ease: EASE }}>
            <div className="space-y-1.5">
              <Label htmlFor="adm-email-r">E-mail</Label>
              <Input id="adm-email-r" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="inst-field" />
            </div>
            <Button type="submit" className="h-11 w-full rounded-md" disabled={loading}>{loading ? 'Enviando…' : 'Enviar link'}</Button>
          </motion.form>
        ) : (
          <motion.form key="login" onSubmit={handleLogin} className="space-y-5"
            initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.25, ease: EASE }}>
            <div className="space-y-1.5">
              <Label htmlFor="adm-email">E-mail</Label>
              <Input id="adm-email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className="inst-field" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-baseline justify-between">
                <Label htmlFor="adm-senha">Senha</Label>
                <button type="button" className="text-xs text-muted-foreground hover:text-primary" onClick={() => setForgotMode(true)}>Esqueci minha senha</button>
              </div>
              <Input id="adm-senha" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} className="inst-field" />
            </div>
            <Button type="submit" className="h-11 w-full rounded-md text-[15px]" disabled={loading}>{loading ? 'Entrando…' : 'Entrar'}</Button>
          </motion.form>
        )}
      </AnimatePresence>
    </AcessoLayout>
  );
}
