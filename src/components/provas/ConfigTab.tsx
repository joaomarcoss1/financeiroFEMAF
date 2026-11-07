import { useState } from 'react';
import { motion } from 'framer-motion';
import { CalendarClock, Save, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { saveAppSettings, isProvasAtivo, type AppSettings } from '@/lib/appSettings';

interface Props {
  settings: AppSettings;
  onChange: (s: AppSettings) => void;
}

export default function ConfigTab({ settings, onChange }: Props) {
  const [saving, setSaving] = useState(false);
  const cfg = settings.provas || { ativo: false, data_inicio: null, data_fim: null };

  function set(patch: Partial<typeof cfg>) {
    onChange({ ...settings, provas: { ...cfg, ...patch } });
  }

  async function handleSave() {
    if (cfg.ativo && cfg.data_inicio && cfg.data_fim && cfg.data_inicio > cfg.data_fim) {
      toast({ title: 'Período inválido', description: 'A data de início deve ser anterior à data de fim.', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await saveAppSettings(settings);
      toast({ title: 'Configuração salva!' });
    } catch (e: any) {
      toast({ title: 'Erro ao salvar', description: e.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  const ativoAgora = isProvasAtivo(cfg);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4 max-w-xl">
      <Card className="premium-card">
        <CardContent className="p-5 sm:p-6 space-y-5">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <CalendarClock size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="font-display font-bold text-lg">Período de envio de provas</h2>
              <p className="text-sm text-muted-foreground">
                Fora da janela abaixo, a tela de envio fica fechada para os professores.
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border p-3.5">
            <div>
              <p className="text-sm font-medium">Função ativa</p>
              <p className="text-xs text-muted-foreground">Liga/desliga o envio de provas independentemente das datas.</p>
            </div>
            <Switch checked={!!cfg.ativo} onCheckedChange={(v) => set({ ativo: v })} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Início</Label>
              <Input type="date" value={cfg.data_inicio || ''} onChange={(e) => set({ data_inicio: e.target.value || null })} className="input-premium" />
            </div>
            <div>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Fim</Label>
              <Input type="date" value={cfg.data_fim || ''} onChange={(e) => set({ data_fim: e.target.value || null })} className="input-premium" />
            </div>
          </div>

          <div className={`rounded-xl px-3.5 py-2.5 text-sm font-medium text-center ${ativoAgora ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}`}>
            {ativoAgora ? '● Envio de provas está ABERTO agora' : '○ Envio de provas está FECHADO agora'}
          </div>

          <Button onClick={handleSave} disabled={saving} className="btn-premium w-full gap-2">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar configuração
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
