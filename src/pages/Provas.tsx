import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ClipboardCheck } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getAppSettings, DEFAULT_SETTINGS, type AppSettings } from '@/lib/appSettings';
import ConfigTab from '@/components/provas/ConfigTab';
import ModeloTab from '@/components/provas/ModeloTab';
import AlunosTab from '@/components/provas/AlunosTab';
import EnviosTab from '@/components/provas/EnviosTab';

export default function Provas() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAppSettings()
      .then((s) => setSettings(s))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center">
          <ClipboardCheck size={20} className="text-primary" />
        </div>
        <div>
          <h1 className="text-3xl sm:text-4xl font-display font-bold tracking-tight">Provas</h1>
          <p className="text-muted-foreground text-sm">Envio, checklist e geração personalizada de provas para impressão</p>
        </div>
      </motion.div>

      <Tabs defaultValue="envios" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="envios">Envios</TabsTrigger>
          <TabsTrigger value="alunos">Alunos</TabsTrigger>
          <TabsTrigger value="modelo">Modelo</TabsTrigger>
          <TabsTrigger value="config">Configuração</TabsTrigger>
        </TabsList>
        <TabsContent value="envios"><EnviosTab /></TabsContent>
        <TabsContent value="alunos"><AlunosTab /></TabsContent>
        <TabsContent value="modelo"><ModeloTab /></TabsContent>
        <TabsContent value="config">
          {!loading && <ConfigTab settings={settings} onChange={setSettings} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
