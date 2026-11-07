import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, Smartphone, Share, Wifi, Zap, BellRing, CheckCircle2 } from 'lucide-react';
import logoFemaf from '@/assets/logo-femaf.png';
import PageBackground from '@/components/PageBackground';

const EASE = [0.16, 1, 0.3, 1] as const;

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 py-10 lg:p-8">
      <PageBackground />
      <div className="w-full max-w-sm mx-auto">{children}</div>
    </div>
  );
}

const BENEFICIOS = [
  { icon: Zap, label: 'Acesso instantâneo' },
  { icon: Wifi, label: 'Leve e rápido' },
  { icon: BellRing, label: 'Notificações' },
];

export default function Instalar() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setIsIOS(/iPad|iPhone|iPod/.test(navigator.userAgent));
    setIsStandalone(window.matchMedia('(display-mode: standalone)').matches);

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => setInstalled(true));
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setInstalled(true);
    setDeferredPrompt(null);
  }

  if (isStandalone || installed) {
    return (
      <Shell>
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, ease: EASE }} className="space-y-6 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', damping: 12, delay: 0.1 }}
            className="w-16 h-16 rounded-2xl gradient-primary mx-auto flex items-center justify-center"
            style={{ boxShadow: 'var(--shadow-glow-primary)' }}
          >
            <CheckCircle2 className="h-8 w-8 text-primary-foreground" />
          </motion.div>
          <div>
            <h1 className="font-display text-2xl font-semibold text-foreground">App já instalado!</h1>
            <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
              Você está usando o Plataforma de Gestão Financeira FEMAF instalado no seu dispositivo.
            </p>
          </div>
          <Button variant="ghost" className="w-full gap-2" asChild>
            <Link to="/"><ArrowLeft size={16} /> Voltar para Bater Ponto</Link>
          </Button>
        </motion.div>
      </Shell>
    );
  }

  return (
    <Shell>
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }} className="text-center space-y-3 mb-6">
        <img src={logoFemaf} alt="FEMAF" className="h-14 mx-auto rounded-xl shadow-md" />
        <span className="eyebrow justify-center">
          <Download size={12} /> App instalável
        </span>
        <h1 className="font-display text-3xl font-bold text-foreground tracking-tight">Instalar o App</h1>
        <p className="text-muted-foreground text-sm max-w-xs mx-auto leading-relaxed">
          Leve o Plataforma de Gestão Financeira FEMAF para a tela inicial do seu celular ou computador.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1, ease: EASE }}
        className="grid grid-cols-3 gap-2 mb-6"
      >
        {BENEFICIOS.map((b, i) => (
          <motion.div
            key={b.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.07, duration: 0.3, ease: EASE }}
            className="glass-card-hover flex flex-col items-center gap-2 rounded-2xl p-3 text-center"
          >
            <div className="icon-badge w-9 h-9 rounded-xl gradient-primary">
              <b.icon size={16} className="text-primary-foreground" />
            </div>
            <p className="text-[11px] font-semibold leading-tight">{b.label}</p>
          </motion.div>
        ))}
      </motion.div>

      <AnimatePresence mode="wait">
        {deferredPrompt && (
          <motion.div key="install-btn" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.3, ease: EASE }}>
            <motion.div whileTap={{ scale: 0.98 }}>
              <Button onClick={handleInstall} className="w-full h-14 text-base gap-3 btn-glow btn-premium" size="lg">
                <Download size={22} /> Instalar Agora
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {isIOS && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2, ease: EASE }}>
          <Card className="premium-card mt-4">
            <CardContent className="p-6 space-y-4">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <Smartphone size={20} className="text-primary" /> Como instalar no iPhone
              </h2>
              <div className="space-y-3">
                {[
                  <>Toque no ícone <Share size={14} className="inline text-info" /> <strong>Compartilhar</strong> na barra do Safari</>,
                  <>Role para baixo e toque em <strong>&quot;Adicionar à Tela de Início&quot;</strong></>,
                  <>Toque em <strong>&quot;Adicionar&quot;</strong> no canto superior direito</>,
                ].map((text, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.08 }} className="flex items-start gap-3">
                    <span className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-sm font-bold shrink-0">{i + 1}</span>
                    <p className="text-sm leading-relaxed">{text}</p>
                  </motion.div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {!isIOS && !deferredPrompt && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2, ease: EASE }}>
          <Card className="premium-card mt-4">
            <CardContent className="p-6 space-y-4">
              <h2 className="font-semibold text-lg flex items-center gap-2">
                <Smartphone size={20} className="text-primary" /> Como instalar
              </h2>
              <div className="space-y-3">
                {[
                  'Abra o menu do navegador (3 pontinhos ⋮ ou o ícone de instalação na barra de endereço)',
                  <>Toque em <strong>&quot;Instalar app&quot;</strong> ou <strong>&quot;Adicionar à tela inicial&quot;</strong></>,
                  <>Confirme tocando em <strong>&quot;Instalar&quot;</strong></>,
                ].map((text, i) => (
                  <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.08 }} className="flex items-start gap-3">
                    <span className="w-7 h-7 rounded-full gradient-primary flex items-center justify-center text-primary-foreground text-sm font-bold shrink-0">{i + 1}</span>
                    <p className="text-sm leading-relaxed">{text}</p>
                  </motion.div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground pt-3 mt-1 border-t border-border/60">
                O botão &quot;Instalar Agora&quot; aparece automaticamente aqui assim que o navegador detectar que o app já pode ser instalado.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <Button variant="ghost" className="w-full gap-2 mt-6" asChild>
        <Link to="/"><ArrowLeft size={16} /> Voltar para Bater Ponto</Link>
      </Button>
    </Shell>
  );
}
