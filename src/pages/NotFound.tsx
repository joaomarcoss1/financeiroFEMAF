import { useLocation, Link } from "react-router-dom";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { Compass } from "lucide-react";
import logoFemaf from "@/assets/logo-femaf.png";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: rota inexistente:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden mesh-hero noise-overlay p-4">
      <motion.div
        className="orb w-80 h-80 bg-secondary/30 top-10 -left-10"
        animate={{ y: [0, -20, 0], x: [0, 15, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="orb w-96 h-96 bg-primary-foreground/10 -bottom-20 -right-16"
        animate={{ y: [0, 20, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 text-center max-w-md"
      >
        <img src={logoFemaf} alt="FEMAF" className="h-12 mx-auto mb-8 rounded-xl bg-primary-foreground p-1.5 shadow-lg" />
        <motion.p
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, type: 'spring', damping: 14 }}
          className="font-display text-7xl font-bold text-shimmer-gold leading-none"
        >
          404
        </motion.p>
        <h1 className="font-display text-2xl font-semibold text-primary-foreground mt-4">Página não encontrada</h1>
        <p className="text-primary-foreground/60 text-sm mt-2 leading-relaxed">
          O endereço <code className="text-primary-foreground/80">{location.pathname}</code> não existe ou foi movido.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 mt-8 px-5 py-2.5 rounded-xl bg-primary-foreground/10 hover:bg-primary-foreground/15 text-primary-foreground text-sm font-semibold transition-all border border-primary-foreground/15"
        >
          <Compass size={16} /> Voltar para o início
        </Link>
      </motion.div>
    </div>
  );
};

export default NotFound;
