import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { MailCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AcessoLayout from '../layouts/AcessoLayout';
import { SENHA_MINIMA } from '../lib/senha';

/** Cadastro da equipe: cria a conta; o admin libera papel e setor em /admin/equipe. */
export default function EquipeCadastro() {
  const { user } = useAuth();
  const [f, setF] = useState({ nome: '', email: '', senha: '' });
  const [erro, setErro] = useState<string | null>(null);
  const [feito, setFeito] = useState(false);
  const [enviando, setEnviando] = useState(false);
  if (user && !feito) return <Navigate to="/central" replace />;

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (f.senha.length < SENHA_MINIMA) return setErro(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`);
    setEnviando(true);
    setErro(null);
    const { error } = await supabase.auth.signUp({
      email: f.email.trim(), password: f.senha,
      options: { emailRedirectTo: `${window.location.origin}/central`, data: { tipo: 'equipe', nome: f.nome.trim() } },
    });
    setEnviando(false);
    if (error) return setErro(/registered|already/i.test(error.message) ? 'Este e-mail já tem conta.' : 'Não foi possível criar a conta. Tente novamente.');
    setFeito(true);
  }

  if (feito) {
    return (
      <AcessoLayout titulo="Cadastro enviado" descricao="Confirme o e-mail, se solicitado. A administração vai liberar seu acesso e setor.">
        <MailCheck className="mb-6 h-10 w-10 text-primary" />
        <Button asChild className="h-11 w-full rounded-md"><Link to="/central">Voltar à entrada</Link></Button>
      </AcessoLayout>
    );
  }

  return (
    <AcessoLayout
      titulo="Cadastro da equipe"
      descricao="Coordenação, Secretaria, Direção e demais setores."
      rodape={<Link to="/central" className="inst-link">Já tenho conta</Link>}
    >
      <form onSubmit={enviar} className="space-y-4">
        <div className="space-y-1.5"><Label htmlFor="eq-nome">Nome completo</Label><Input className="inst-field" id="eq-nome" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} required /></div>
        <div className="space-y-1.5"><Label htmlFor="eq-email">E-mail institucional</Label><Input className="inst-field" id="eq-email" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} required /></div>
        <div className="space-y-1.5"><Label htmlFor="eq-senha">Senha</Label><Input className="inst-field" id="eq-senha" type="password" autoComplete="new-password" value={f.senha} onChange={(e) => setF({ ...f, senha: e.target.value })} required /></div>
        <p className="text-xs text-muted-foreground">Mínimo de {SENHA_MINIMA} caracteres.</p>
        {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
        <Button type="submit" className="h-11 w-full rounded-md" disabled={enviando}>{enviando ? 'Enviando…' : 'Criar conta'}</Button>
      </form>
    </AcessoLayout>
  );
}
