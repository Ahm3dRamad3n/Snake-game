const CACHE_NAME = 'snake-game-cache-v2'; // Increment cache version
const urlsToCache = [
  './', // Cache the root directory (important for relative paths)
  './index.html', // Assuming the main HTML file is index.html
  './manifest.json',
  './icon-192.png', // Assuming icons are in the root
  './icon-512.png'
];

// Install event: Cache the app shell
self.addEventListener('install', event => {
  console.log('Service Worker: Installing Snake Game Cache...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Service Worker: Caching app shell');
        // Use { cache: 'reload' } to bypass HTTP cache when fetching during install
        const cachePromises = urlsToCache.map(urlToCache => {
            // Check if urlToCache is a valid URL or path before creating Request
            try {
                return cache.add(new Request(urlToCache, {cache: 'reload'}));
            } catch (e) {
                console.error(`Service Worker: Failed to create request for ${urlToCache}`, e);
                // Skip this URL if it's invalid, or handle appropriately
                return Promise.resolve(); // Resolve promise to not break Promise.all
            }
        });
        return Promise.all(cachePromises);
      })
      .then(() => self.skipWaiting()) // Activate worker immediately
      .catch(error => {
          console.error('Service Worker: Failed to cache app shell:', error);
      })
  );
});

// Activate event: Clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating Snake Game Cache...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME && cache.startsWith('snake-game-cache-')) { // Check prefix for safety
            console.log('Service Worker: Clearing old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim()) // Take control of pages immediately
  );
});

// Fetch event: Serve from cache or network (Cache-first, update cache on network fetch)
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
      return;
  }
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Not in cache - fetch from network
        return fetch(event.request).then(
          networkResponse => {
            // Check if we received a valid response
            // Allow caching for opaque responses (e.g., from no-cors requests) if needed, but be cautious
            if (!networkResponse || (networkResponse.status !== 200 && networkResponse.type !== 'opaque') || (networkResponse.type === 'basic' && networkResponse.status !== 200) ) {
              return networkResponse;
            }

            // IMPORTANT: Clone the response. A response is a stream
            // and because we want the browser to consume the response
            // as well as the cache consuming the response, we need
            // to clone it so we have two streams.
            const responseToCache = networkResponse.clone();

            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            return networkResponse;
          }
        ).catch(error => {
            console.error('Service Worker: Fetch failed:', error);
            // Fallback for navigation requests if fetch fails (e.g., offline)
            // This ensures the user sees the app shell instead of a browser error page.
            if (event.request.mode === 'navigate') {
                console.log('Service Worker: Fetch failed, returning offline page.');
                return caches.match('./index.html'); // Fallback to the main app page
            }
            // Optional: Return a generic offline fallback for other types of requests (e.g., images)
            // if (!event.request.url.includes('/api/')) { // Example: Don't fallback for API calls
            //     return caches.match('/offline.html'); // Needs an offline.html file cached
            // }
        });
      })
  );
});
