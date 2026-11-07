import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { getAppSettings } from "./lib/appSettings";

// Pré-carrega settings e aplica cor primária ASAP (não bloqueia o render)
getAppSettings().catch(() => {});


// Initialize theme
const savedTheme = localStorage.getItem('theme');
if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
  document.documentElement.classList.add('dark');
}

if ("serviceWorker" in navigator) {
  // Mantém só os workers que o app realmente usa hoje: sw-push.js (notificações)
  // e pwa-shell.js (torna o app instalável, sem cachear nada). Qualquer outro —
  // como os antigos sw.js/service-worker.js que cacheavam conteúdo e chegaram a
  // servir coordenadas/JS desatualizados — é removido.
  const KEEP = ["/sw-push.js", "/pwa-shell.js"];
  navigator.serviceWorker.getRegistrations().then((regs) => {
    regs.forEach((registration) => {
      const workerUrl = registration.active?.scriptURL || registration.waiting?.scriptURL || registration.installing?.scriptURL || "";
      if (!KEEP.some((keep) => workerUrl.endsWith(keep))) registration.unregister();
    });
  }).catch(() => {});

  // Limpa qualquer cache deixado por versões antigas do service worker.
  if ("caches" in window) {
    caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))).catch(() => {});
  }

  // Registra o worker "casca" de PWA assim que a página carrega, para qualquer
  // visitante (não só quem já ativou notificações) — é o que faz o navegador
  // oferecer "Instalar app" / "Adicionar à tela inicial".
  navigator.serviceWorker.register("/pwa-shell.js").catch(() => {});
}

createRoot(document.getElementById("root")!).render(<App />);
