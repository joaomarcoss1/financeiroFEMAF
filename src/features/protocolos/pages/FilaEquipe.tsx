import CentralLayout from '../layouts/CentralLayout';
import { FilaProtocolos } from '../components/FilaProtocolos';

export default function FilaEquipe() {
  return (
    <CentralLayout titulo="Fila de protocolos" subtitulo="Pedidos do seu setor e curso, por etapa.">
      <FilaProtocolos />
    </CentralLayout>
  );
}
