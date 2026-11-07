import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AcessoLayout from '../layouts/AcessoLayout';
import { rpc } from '../api/db';
import { cpfValido, formatarCpf, somenteDigitos } from '../lib/cpf';
import { SENHA_MINIMA } from '../lib/senha';

/**
 * Primeiro acesso sem Edge Function:
 * 1) aluno_pre_validar confere matrícula + CPF + nascimento ANTES de criar a conta (com limite de tentativas);
 * 2) signUp guarda os dados em user_metadata.vinculo_pendente;
 * 3) a CentralHome chama aluno_vincular_conta assim que houver sessão (logo após o signUp ou após confirmar o e-mail).
 */
export default function PrimeiroAcesso() {
  const { user } = useAuth();
  const [f, setF] = useState({ matricula: '', cpf: '', nascimento: '', email: '', senha: '', senha2: '' });
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [confirmarEmail, setConfirmarEmail] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: k === 'cpf' ? formatarCpf(e.target.value) : e.target.value });

  if (user && !confirmarEmail) return <Navigate to="/central" replace />;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!f.matricula.trim() || !f.nascimento) return setErro('Informe matrícula e data de nascimento.');
    if (!cpfValido(f.cpf)) return setErro('CPF inválido.');
    if (f.senha.length < SENHA_MINIMA) return setErro(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`);
    if (f.senha !== f.senha2) return setErro('As senhas não conferem.');
    setEnviando(true);
    const vinculo = { matricula: f.matricula.trim(), cpf: somenteDigitos(f.cpf), nascimento: f.nascimento };
    try {
      const pre = await rpc<{ ok: boolean; erro?: string }>('aluno_pre_validar', {
        p_matricula: vinculo.matricula, p_cpf: vinculo.cpf, p_nascimento: vinculo.nascimento,
      });
      if (!pre.ok) return setErro(pre.erro ?? 'Não foi possível confirmar seus dados.');
      const { data, error } = await supabase.auth.signUp({
        email: f.email.trim(),
        password: f.senha,
        options: { emailRedirectTo: `${window.location.origin}/central`, data: { tipo: 'aluno', vinculo_pendente: vinculo } },
      });
      if (error) return setErro(/registered|already/i.test(error.message) ? 'Este e-mail já tem conta. Entre pela tela inicial.' : 'Não foi possível criar a conta. Tente novamente.');
      // Sem sessão = confirmação de e-mail ligada. Com sessão, a CentralHome faz o vínculo (vinculo_pendente).
      if (!data.session) setConfirmarEmail(true);
    } catch (x) {
      setErro((x as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  if (confirmarEmail) {
    return (
      <AcessoLayout titulo="Confirme seu e-mail" descricao={`Enviamos um link para ${f.email}. Depois de confirmar, entre na Central; a matrícula será vinculada automaticamente.`}>
        <MailCheck className="mb-6 h-10 w-10 text-primary" />
        <Button asChild className="h-11 w-full rounded-md"><Link to="/central">Ir para a entrada</Link></Button>
      </AcessoLayout>
    );
  }

  return (
    <AcessoLayout
      titulo="Primeiro acesso"
      descricao="Use os dados do seu cadastro na Secretaria Acadêmica."
      rodape={<Link to="/central" className="inst-link">Já tenho conta</Link>}
    >
      <form onSubmit={enviar} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="pa-mat">Matrícula</Label><Input className="inst-field" id="pa-mat" value={f.matricula} onChange={set('matricula')} autoComplete="off" required /></div>
          <div className="space-y-1.5"><Label htmlFor="pa-nasc">Data de nascimento</Label><Input className="inst-field" id="pa-nasc" type="date" value={f.nascimento} onChange={set('nascimento')} required /></div>
        </div>
        <div className="space-y-1.5"><Label htmlFor="pa-cpf">CPF</Label><Input className="inst-field" id="pa-cpf" inputMode="numeric" value={f.cpf} onChange={set('cpf')} required /></div>
        <div className="space-y-1.5"><Label htmlFor="pa-email">E-mail</Label><Input className="inst-field" id="pa-email" type="email" autoComplete="email" value={f.email} onChange={set('email')} required /></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="pa-senha">Senha</Label><Input className="inst-field" id="pa-senha" type="password" autoComplete="new-password" value={f.senha} onChange={set('senha')} required /></div>
          <div className="space-y-1.5"><Label htmlFor="pa-senha2">Repita a senha</Label><Input className="inst-field" id="pa-senha2" type="password" autoComplete="new-password" value={f.senha2} onChange={set('senha2')} required /></div>
        </div>
        <p className="text-xs text-muted-foreground">Mínimo de {SENHA_MINIMA} caracteres.</p>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <Button type="submit" className="h-11 w-full rounded-md" disabled={enviando}>{enviando ? 'Conferindo dados…' : 'Criar conta'}</Button>
      </form>
    </AcessoLayout>
  );
}
