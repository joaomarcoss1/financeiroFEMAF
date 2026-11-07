import { Button } from '@/components/ui/button';
import { MapPin } from 'lucide-react';
import { motion } from 'framer-motion';

export type GpsState = 'checking' | 'ok' | 'far' | 'error' | 'denied';

interface Props {
  status: GpsState;
  distancia: number | null;
  raioMax: number;
  onRetry: () => void;
}

export default function GpsStatus({ status, distancia, raioMax, onRetry }: Props) {
  const iconBg =
    status === 'ok' ? 'bg-success/15' : status === 'checking' ? 'bg-warning/15' : 'bg-destructive/15';

  const iconColor =
    status === 'ok' ? 'text-success' : status === 'checking' ? 'text-warning' : 'text-destructive';

  const textColor =
    status === 'ok' ? 'text-success' : status === 'checking' ? 'text-foreground' : 'text-destructive';

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="flex items-center gap-3 px-1"
      role="status"
      aria-live="polite"
    >
      <div className={`relative w-8 h-8 shrink-0 rounded-full flex items-center justify-center ${iconBg}`}>
        {status === 'ok' && (
          <span className="absolute inset-0 rounded-full animate-glow-pulse" aria-hidden />
        )}
        <MapPin size={15} className={`relative ${iconColor}`} aria-hidden />
      </div>
      <div className="flex-1 min-w-0">
        {status === 'checking' && (
          <p className={`text-sm font-medium status-pulse ${textColor}`}>Verificando localização...</p>
        )}
        {status === 'ok' && (
          <p className={`text-sm font-medium ${textColor}`}>Localização verificada · {distancia}m</p>
        )}
        {status === 'far' && (
          <div>
            <p className={`text-sm font-medium ${textColor}`}>Fora da área permitida</p>
            <p className="text-xs text-muted-foreground">Você está a {distancia}m. Máximo: {raioMax}m</p>
          </div>
        )}
        {status === 'denied' && (
          <p className={`text-sm font-medium ${textColor}`}>Permissão de localização negada</p>
        )}
        {status === 'error' && (
          <p className={`text-sm font-medium ${textColor}`}>Erro ao obter localização</p>
        )}
      </div>
      {status !== 'ok' && status !== 'checking' && (
        <Button variant="outline" size="sm" onClick={onRetry} aria-label="Tentar obter localização novamente" className="shrink-0">
          Tentar
        </Button>
      )}
    </motion.div>
  );
}
