import { Link, useParams } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { FilaProtocolos } from '../components/FilaProtocolos';
import { AnaliseProtocolo } from '../components/AnaliseProtocolo';

/** Visão total da secretaria/admin, dentro do layout do admin. */
export default function AdminProtocolos() {
  const { id } = useParams();
  if (!id) return <FilaProtocolos base="/admin/protocolos" />;
  return (
    <div>
      <Link to="/admin/protocolos" className="mb-3 inline-flex items-center text-sm text-muted-foreground"><ChevronLeft className="h-4 w-4" /> Protocolos</Link>
      <AnaliseProtocolo id={id} />
    </div>
  );
}
