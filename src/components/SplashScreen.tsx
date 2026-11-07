import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import logoFemaf from '@/assets/logo-femaf.png';

export default function SplashScreen({ children }: { children: React.ReactNode }) {
  const [show, setShow] = useState(() => {
    if (typeof window === 'undefined') return false;
    // A abertura da plataforma é do app dos professores; a Central e a validação abrem direto.
    if (/^\/(central|validar|reset-password)/.test(window.location.pathname)) return false;
    const shown = sessionStorage.getItem('splash-shown');
    return !shown;
  });

  useEffect(() => {
    if (show) {
      const timer = setTimeout(() => {
        setShow(false);
        sessionStorage.setItem('splash-shown', '1');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [show]);

  return (
    <>
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="fixed inset-0 z-[100] gradient-primary flex flex-col items-center justify-center gap-6"
          >
            <motion.img
              src={logoFemaf}
              alt="FEMAF"
              className="w-36 h-auto rounded-2xl bg-white p-3 shadow-2xl"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', damping: 15, delay: 0.2 }}
            />
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="text-center"
            >
              <h1 className="text-2xl font-bold text-primary-foreground">Plataforma de Gestão Financeira</h1>
              <p className="text-primary-foreground/70 text-sm mt-1">FEMAF – Faculdade de Educação Memorial Adelaide Franco</p>
            </motion.div>
            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.8, duration: 1 }}
              className="w-32 h-1 bg-primary-foreground/30 rounded-full origin-left"
            />
          </motion.div>
        )}
      </AnimatePresence>
      {children}
    </>
  );
}
