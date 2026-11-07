import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { motion, MotionConfig } from 'framer-motion';
import ThemeToggle from '@/components/ThemeToggle';
import MarcaAnimada from '../components/identidade/MarcaAnimada';
import Guilloche from '../components/identidade/Guilloche';
import { Assinatura, EASE } from './CentralLayout';

/**
 * Telas de acesso (entrar, primeiro acesso, cadastro da equipe, senha): painel institucional verde
 * à esquerda — o livro FEMAF se abre sobre uma rosácea guilhochê — e o formulário à direita, sobre
 * papel claro. No celular o painel vira uma faixa curta.
 */
export default function AcessoLayout({ titulo, descricao, children, rodape,
  painelTitulo = 'Central Acadêmica',
  painelTexto = 'Protocolos, documentos e validação da Secretaria Acadêmica da FEMAF.',
}: {
  titulo: string; descricao?: string; children: ReactNode; rodape?: ReactNode; painelTitulo?: string; painelTexto?: string;
}) {
  return (
    <MotionConfig reducedMotion="user">
      <div className="inst-page relative isolate grid min-h-screen lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <aside className="inst-bar relative flex flex-col overflow-hidden text-white">
          <div className="relative z-10 flex items-center justify-between px-5 py-4 sm:px-8 lg:px-12 lg:py-10">
            <Assinatura />
            <ThemeToggle className="text-white/70 hover:bg-white/10 hover:text-white lg:hidden" />
          </div>

          {/* Emblema: rosácea + leque que se abre */}
          <div aria-hidden="true" className="relative hidden flex-1 items-center justify-center lg:flex">
            <Guilloche aneis={11} raio={320} className="absolute h-[40rem] w-[40rem] max-w-none" />
            <div className="absolute h-72 w-72 rounded-full bg-[radial-gradient(circle,hsl(201_80%_55%/0.16),transparent_65%)]" />
            <MarcaAnimada atraso={250} className="relative h-56 w-auto drop-shadow-[0_18px_40px_rgba(0,0,0,0.35)]" />
          </div>

          <motion.div className="relative z-10 hidden px-12 pb-14 lg:block"
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.7, ease: EASE }}>
            <p className="max-w-sm font-['Source_Serif_4',Georgia,serif] text-[34px] font-semibold leading-tight">{painelTitulo}</p>
            <motion.span aria-hidden="true" className="mt-4 block h-0.5 w-14 origin-left bg-[hsl(201_78%_52%)]"
              initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.8, delay: 1, ease: EASE }} />
            <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-white/70">{painelTexto}</p>
          </motion.div>
          <div className="inst-rule absolute inset-x-0 bottom-0 lg:inset-y-0 lg:left-auto lg:right-0 lg:h-auto lg:w-[3px]" />
        </aside>

        <main className="relative flex flex-col overflow-hidden">
          <Guilloche aneis={7} raio={260} className="pointer-events-none absolute -right-60 -top-60 -z-10 h-[34rem] w-[34rem]" />
          <div className="hidden justify-end px-8 pt-6 lg:flex"><ThemeToggle className="text-muted-foreground hover:bg-muted hover:text-foreground" /></div>
          <div className="flex flex-1 items-start justify-center px-5 py-10 sm:px-8 lg:items-center lg:py-6">
            <motion.div className="w-full max-w-[26rem]"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15, ease: EASE }}>
              <h1 className="inst-title text-[30px] leading-tight">{titulo}</h1>
              <motion.span aria-hidden="true" className="mt-3 block h-0.5 w-10 origin-left bg-[hsl(201_78%_52%)]"
                initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.7, delay: 0.35, ease: EASE }} />
              {descricao && <p className="mt-3 text-sm text-muted-foreground">{descricao}</p>}
              <div className="mt-8">{children}</div>
              {rodape && <div className="mt-10 border-t border-border pt-6 text-sm">{rodape}</div>}
            </motion.div>
          </div>
          <footer className="px-5 py-5 text-xs text-muted-foreground sm:px-8">
            © {new Date().getFullYear()} FEMAF · <Link to="/validar" className="hover:text-foreground">Validar documento</Link>
          </footer>
        </main>
      </div>
    </MotionConfig>
  );
}
