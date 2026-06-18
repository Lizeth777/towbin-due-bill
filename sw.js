/* ============================================================
   Towbin Kia Due Bill Tracker — Service Worker
   Enables offline mode and PWA installability
   ============================================================ */

const CACHE_NAME = 'towbin-duebill-v3';
const ASSETS = [
  '/towbin-due-bill/',
  '/towbin-due-bill/index.html',
  '/towbin-due-bill/styles.css',
  '/towbin-due-bill/app.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap'
];

// Install — cache all core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS).catch(err => {
        console.log('Cache addAll partial failure (ok):', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network first, fall back to cache
// Google Apps Script calls always go to network (no cache)
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Never cache Apps Script or API calls
  if (url.includes('script.google.com') ||
      url.includes('api.anthropic.com') ||
      url.includes('openai.com') ||
      url.includes('fonts.gstatic.com')) {
    event.respondWith(fetch(event.request).catch(() => new Response('')));
    return;
  }

  // Network first for everything else
  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Cache successful GET responses
        if (event.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Fall back to cache when offline
        return caches.match(event.request).then(cached => {
          return cached || new Response(
            '<div style="font-family:sans-serif;padding:40px;background:#080810;color:white;text-align:center;height:100vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;">' +
            '<div style="font-style:italic;font-weight:900;font-size:48px;color:#C8102E;">KIA</div>' +
            '<div style="font-size:16px;font-weight:700;">You\'re offline</div>' +
            '<div style="font-size:13px;opacity:0.5;">Data saved locally — reconnect to sync with Google Sheets</div>' +
            '</div>',
            { headers: { 'Content-Type': 'text/html' } }
          );
        });
      })
  );
});

// Allow immediate activation when update is found
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
