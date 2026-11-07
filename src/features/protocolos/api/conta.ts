import { supabase } from '@/integrations/supabase/client';
import { rpc } from './db';
import { somenteDigitos } from '../lib/cpf';

export interface VinculoPendente { matricula: string; cpf: string; nascimento: string }

/** Liga a conta logada ao cadastro do aluno. Devolve mensagem de erro genérica ou null. */
export async function vincularConta(v: VinculoPendente): Promise<string | null> {
  const r = await rpc<{ ok: boolean; erro?: string }>('aluno_vincular_conta', {
    p_matricula: v.matricula.trim(), p_cpf: somenteDigitos(v.cpf), p_nascimento: v.nascimento,
  });
  if (!r.ok) return r.erro ?? 'Não foi possível confirmar seus dados.';
  // Remove os dados de identificação guardados no cadastro para o vínculo pós-confirmação de e-mail.
  await supabase.auth.updateUser({ data: { vinculo_pendente: null } });
  return null;
}
