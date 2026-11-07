import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDateBR } from '@/lib/datetime';

interface Props {
  registros: any[];
}

export default function HistoricoList({ registros }: Props) {
  const [open, setOpen] = useState(false);
  if (!registros.length) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="historico-lista"
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full justify-center py-2"
      >
        <History size={16} aria-hidden />
        {open ? 'Ocultar histórico' : `Ver últimos ${registros.length} registro(s)`}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id="historico-lista"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            {registros.map((r, i) => (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <Card className="glass-card">
                  <CardContent className="p-3">
                    <div className="flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium">{formatDateBR(r.data)}</p>
                        <div className="flex gap-1 mt-1">
                          {(r.horarios || []).map((h: number) => (
                            <Badge key={h} variant="outline" className="text-[10px] px-1.5 py-0">
                              {h}º
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold text-primary">
                          R$ {Number(r.valor_total).toFixed(2)}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {r.quantidade_horarios}h/a
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
