import { CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

interface Props {
  qtdHorarios: number;
  cargaHoraria: number;
  valorTotal: number;
  onClose: () => void;
}

export default function SuccessScreen({ qtdHorarios, cargaHoraria, valorTotal, onClose }: Props) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', damping: 12 }}
        className="flex flex-col items-center gap-6"
      >
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ repeat: 2, duration: 0.5 }}
          className="w-24 h-24 rounded-full gradient-primary flex items-center justify-center shadow-xl"
        >
          <CheckCircle size={48} className="text-primary-foreground" aria-hidden />
        </motion.div>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground">Ponto Registrado!</h2>
          <p className="text-muted-foreground text-sm mt-2">
            {qtdHorarios} horário(s) • {(cargaHoraria / 60).toFixed(1)}h • R$ {valorTotal.toFixed(2)}
          </p>
        </div>
        <Button onClick={onClose} variant="outline" aria-label="Voltar para a tela de bater ponto">
          Registrar outro ponto
        </Button>
      </motion.div>
    </div>
  );
}
