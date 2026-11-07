import CentralLayout from '@/features/protocolos/layouts/CentralLayout';
import { Carregando, Erro, Vazio } from '@/features/protocolos/components/Estados';
import { Secao } from '@/features/protocolos/components/Secao';
import { useAuth } from '@/contexts/AuthContext';
import { useDocumentos } from '../api/documentos';
import { LinhaDocumento } from '../components/BotaoDocumento';

/** Pasta digital do aluno: comprovantes, pareceres, termos e extratos. */
export default function MeusDocumentos() {
  const { alunoId } = useAuth();
  const { data, isLoading, error } = useDocumentos({ alunoId: alunoId ?? undefined });
  return (
    <CentralLayout titulo="Meus documentos" subtitulo="Comprovantes, pareceres e declarações emitidos pela Central, com código de validação.">
      {isLoading ? <Carregando /> : error ? <Erro erro={error} /> : !data?.length ? (
        <Vazio texto="Nenhum documento emitido até o momento." />
      ) : (
        <Secao titulo={`${data.length} documento(s)`} semCorpo>
          <div className="inst-list px-4 sm:px-5">{data.map((d) => <LinhaDocumento key={d.id} doc={d} />)}</div>
        </Secao>
      )}
    </CentralLayout>
  );
}
