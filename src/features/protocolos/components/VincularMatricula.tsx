import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { cpfValido, formatarCpf } from '../lib/cpf';
import { vincularConta } from '../api/conta';

/** Para quem já tem login mas ainda não ligou a conta à matrícula. */
export function VincularMatricula() {
  const { refresh } = useAuth();
  const [m, setM] = useState('');
  const [cpf, setCpf] = useState('');
  const [nasc, setNasc] = useState('');
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!m || !nasc || !cpfValido(cpf)) { setErro('Preencha matrícula, CPF válido e data de nascimento.'); return; }
    setEnviando(true);
    setErro(null);
    try {
      const falha = await vincularConta({ matricula: m, cpf, nascimento: nasc });
      if (falha) setErro(falha); else await refresh();
    } catch (x) {
      setErro((x as Error).message);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="v-mat">Matrícula</Label><Input className="inst-field" id="v-mat" value={m} onChange={(e) => setM(e.target.value)} autoComplete="off" /></div>
        <div className="space-y-1.5"><Label htmlFor="v-nasc">Data de nascimento</Label><Input className="inst-field" id="v-nasc" type="date" value={nasc} onChange={(e) => setNasc(e.target.value)} /></div>
      </div>
      <div className="space-y-1.5"><Label htmlFor="v-cpf">CPF</Label><Input className="inst-field" id="v-cpf" inputMode="numeric" value={cpf} onChange={(e) => setCpf(formatarCpf(e.target.value))} /></div>
      {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
      <Button type="submit" className="h-11 w-full rounded-md" disabled={enviando}>{enviando ? 'Confirmando…' : 'Confirmar matrícula'}</Button>
    </form>
  );
}
