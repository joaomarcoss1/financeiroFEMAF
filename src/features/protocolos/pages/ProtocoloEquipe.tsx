import { Link, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import CentralLayout from '../layouts/CentralLayout';
import { AnaliseProtocolo } from '../components/AnaliseProtocolo';

export default function ProtocoloEquipe() {
  const { id = '' } = useParams();
  return (
    <CentralLayout>
      <Link to="/central/equipe" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ChevronLeft className="h-4 w-4" /> Fila de protocolos</Link>
      <AnaliseProtocolo id={id} />
    </CentralLayout>
  );
}
