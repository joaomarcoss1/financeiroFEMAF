import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useAppSettings } from '@/hooks/useAppSettings';
import CentralLayout from '../layouts/CentralLayout';
import { academicoDb } from '../api/db';
import { Carregando, Erro } from '../components/Estados';
import { Campos, Secao } from '../components/Secao';

const SITUACAO: Record<string, string> = { ativo: 'Ativa', trancado: 'Trancada', formado: 'Concluída', cancelado: 'Cancelada' };

export default function Perfil() {
  const { user, alunoId } = useAuth();
  const settings = useAppSettings();
  const { data, isLoading, error } = useQuery({
    queryKey: ['meu_cadastro', alunoId],
    enabled: !!alunoId,
    queryFn: async () => {
      const { data, error } = await academicoDb.from('alunos').select('nome, matricula, curso_id, situacao, email, telefone, turmas(nome)').eq('id', alunoId).single();
      if (error) throw new Error(error.message);
      return data as unknown as { nome: string; matricula: string; curso_id: string; situacao: string; email: string | null; telefone: string | null; turmas: { nome: string } | null };
    },
  });
  const curso = settings.cursos.find((c) => c.id === data?.curso_id)?.nome ?? data?.curso_id;
  return (
    <CentralLayout titulo="Meus dados" subtitulo="Dados do cadastro acadêmico. Para corrigir, procure a Secretaria Acadêmica.">
      {isLoading ? <Carregando rows={1} /> : error ? <Erro erro={error} /> : data && (
        <div className="space-y-6">
          <Secao titulo="Vínculo acadêmico">
            <Campos colunas={3} itens={[['Nome', data.nome], ['Matrícula', data.matricula], ['Situação da matrícula', SITUACAO[data.situacao] ?? data.situacao],
              ['Curso', curso], ['Turma', data.turmas?.nome]]} />
          </Secao>
          <Secao titulo="Contato e acesso">
            <Campos colunas={3} itens={[['E-mail de acesso', user?.email], ['E-mail no cadastro', data.email], ['Telefone', data.telefone]]} />
          </Secao>
        </div>
      )}
    </CentralLayout>
  );
}
