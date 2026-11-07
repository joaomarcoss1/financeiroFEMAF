import { motion } from 'framer-motion';

// Fundo de sistema compartilhado pelas telas públicas (Bater Ponto, Login,
// Coordenação, Permuta, Enviar Prova): substitui o antigo painel "hero" ao
// lado do formulário — o mesmo índigo/azul-céu institucional da FEMAF e os orbes
// flutuantes agora vivem aqui, como uma camada fixa atrás de todo o
// conteúdo, em vez de ocupar metade da tela com um banner separado.
export default function PageBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
      {/* .noise-overlay define position:relative para seu ::after — isolada
          num filho, em vez de dividir o elemento com .fixed (mesma camada de
          utilitários, o último definido no CSS venceria o position). */}
      <div className="relative w-full h-full app-mesh-bg noise-overlay">
      <motion.div
        className="orb w-[30rem] h-[30rem] bg-secondary/30 dark:bg-secondary/25 -top-16 -right-20"
        animate={{ y: [0, -24, 0], x: [0, 14, 0] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="orb w-[34rem] h-[34rem] bg-primary/25 dark:bg-primary-foreground/10 -bottom-28 -left-24"
        animate={{ y: [0, 20, 0], x: [0, -16, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="orb w-80 h-80 bg-accent/20 dark:bg-accent/15 top-1/3 left-1/2"
        animate={{ y: [0, 16, 0], x: [0, -10, 0] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      </div>
    </div>
  );
}
