// Service worker mínimo para instalabilidade do PWA (Instalar App / Adicionar
// à tela inicial). Propositalmente NÃO armazena nada em cache: toda
// requisição vai direto pra rede. O app já teve bugs sérios de coordenadas/JS
// desatualizados por causa de um service worker com cache no passado — este
// aqui existe só para o navegador reconhecer o app como instalável, sem
// nenhum risco de servir conteúdo obsoleto.
self.addEventListener('install', (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
