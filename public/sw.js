
// Basic Service Worker for Qur'an Meezan

const CACHE_NAME = 'quran-meezan-cache-v1.2'; // Incremented version
const API_CACHE_NAME = 'quran-meezan-api-cache-v1.2'; // Incremented version

// App Shell: Files to cache on install
const APP_SHELL_URLS = [
  '/',
  '/reader',
  '/conversation',
  '/manifest.json',
  // Add paths to critical JS/CSS bundles if known and stable.
  // Next.js often hashes these, so dynamic caching or specific build output analysis is better.
  // For now, we'll cache pages and let Next.js handle its bundles.
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

// API endpoints to cache (text data primarily)
const API_URLS_TO_CACHE = [
  'https://api.alquran.cloud/v1/meta',
  'https://api.alquran.cloud/v1/edition?format=audio&type=versebyverse', // Reciters
  'https://api.alquran.cloud/v1/edition?format=text&language=en&type=translation', // Translations
  // Surah data will be cached dynamically: https://api.alquran.cloud/v1/surah/...
];

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    Promise.all([
      caches.open(CACHE_NAME).then((cache) => {
        console.log('[Service Worker] Caching App Shell');
        return cache.addAll(APP_SHELL_URLS);
      }),
      caches.open(API_CACHE_NAME).then((cache) => {
        console.log('[Service Worker] Pre-caching some API endpoints');
        // Pre-cache non-Surah specific API endpoints if desired, though dynamic caching is often better
        // return cache.addAll(API_URLS_TO_CACHE.filter(url => !url.includes('/surah/')));
        return Promise.resolve(); // Let dynamic caching handle API_URLS_TO_CACHE
      })
    ]).then(() => {
      console.log('[Service Worker] Installation complete, activating...');
      return self.skipWaiting(); // Activate worker immediately
    })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    Promise.all([
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME && cacheName !== API_CACHE_NAME) {
              console.log('[Service Worker] Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
    ]).then(() => {
      console.log('[Service Worker] Activation complete, claiming clients...');
      return self.clients.claim(); // Take control of all open clients
    })
  );
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Strategy for API calls (Network first, then cache, for Quran data)
  if (requestUrl.origin === 'https://api.alquran.cloud') {
    event.respondWith(
      caches.open(API_CACHE_NAME).then(async (cache) => {
        try {
          const networkResponse = await fetch(event.request);
          if (networkResponse.ok) {
            // Cache successful GET requests for Quran data
            if (event.request.method === 'GET') {
                 console.log(`[Service Worker] Caching API response for: ${event.request.url}`);
                 cache.put(event.request, networkResponse.clone());
            }
          }
          return networkResponse;
        } catch (error) {
          console.log(`[Service Worker] Network request failed for ${event.request.url}, trying cache...`);
          const cachedResponse = await cache.match(event.request);
          if (cachedResponse) {
            console.log(`[Service Worker] Serving from API cache: ${event.request.url}`);
            return cachedResponse;
          }
          console.log(`[Service Worker] Not in API cache: ${event.request.url}`);
          // If not in cache and network failed, error will propagate
          return new Response(JSON.stringify({ error: "Offline and not in cache" }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        }
      })
    );
    return;
  }

  // Strategy for App Shell and other assets (Cache first, then network)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // console.log(`[Service Worker] Serving from App cache: ${event.request.url}`);
        return cachedResponse;
      }
      // console.log(`[Service Worker] Not in App cache, fetching: ${event.request.url}`);
      return fetch(event.request).then(networkResponse => {
         // Optionally cache other GET requests if needed, but be careful with dynamic content
         return networkResponse;
      });
    })
  );
});


// Basic Push Notification Listener
self.addEventListener('push', function(event) {
  console.log('[Service Worker] Push Received.');
  console.log(`[Service Worker] Push had this data: "${event.data ? event.data.text() : 'No data'}"`);

  const title = 'Qur\'an Meezan Reminder';
  const options = {
    body: event.data ? event.data.text() : 'Time for reflection.',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png'
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', function(event) {
  console.log('[Service Worker] Notification click Received.');
  event.notification.close();
  event.waitUntil(
    clients.openWindow('/') // Open the app on notification click
  );
});
