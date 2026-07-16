const CACHE_NAME = 'prompt-facil-v20';
const FILES_TO_CACHE = [
  './index.html',
  './styles.css',
  './app.js',
  './prompt-builder.js',
  './firebase-config.js',
  './politica-privacidade.html',
  './acao.html',
  './app-action-handler.js',
  './manifest.json',
  './icon-192-v2.png',
  './icon-512-v2.png'
];

// Instala a nova versão em segundo plano, mas espera o usuário confirmar
// (via botão "Atualizar" no app) antes de assumir o controle.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
});

// Escuta o pedido de atualização vindo da tela do app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Remove caches antigos quando a nova versão é ativada
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Estratégia "network-first": tenta buscar a versão mais nova na internet primeiro.
// Se não houver internet, usa a cópia salva localmente (cache) para funcionar offline.
// Quick win: se for uma navegação (abrir o app) e nada estiver em cache para essa URL
// específica, cai de volta para o index.html em cache em vez de mostrar o erro do navegador.
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Só intercepta pedidos do próprio site (HTML/CSS/JS/ícones/manifest).
  // Chamadas para fora (Firebase Auth, Firestore, fontes do Google etc.)
  // passam direto pelo navegador — evita quebrar autenticação/streaming.
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  // A Cache API só sabe guardar requisições GET. Deixa POST/PUT/etc. passarem
  // direto (não faz sentido cachear mesmo, e cache.put() lançaria erro nelas).
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        const responseClone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return networkResponse;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return Response.error();
      })
  );
});
