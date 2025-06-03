const CACHE_NAME = 'snake-game-cache-v4'; // Increment cache version
const urlsToCache = [
  './', // Cache the root directory
  './index.html', // Cache the main HTML file
  './tailwind.min.css', // Cache the local Tailwind CSS file
  './manifest.json',
  './icon-192.png', // Assuming icons are in the root directory
  './icon-512.png'  // Assuming icons are in the root directory
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
            try {
                // Ensure we fetch fresh copies during install
                return cache.add(new Request(urlToCache, {cache: 'reload'}));
            } catch (e) {
                console.error(`Service Worker: Failed to create request for ${urlToCache}`, e);
                return Promise.resolve(); // Don't break Promise.all
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
          // Delete caches that are not the current one and belong to this app
          if (cache !== CACHE_NAME && cache.startsWith('snake-game-cache-')) {
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
  // We only want to handle GET requests
  if (event.request.method !== 'GET') {
      return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Cache hit - return response from cache
        if (response) {
          return response;
        }

        // Not in cache - fetch from network
        return fetch(event.request).then(
          networkResponse => {
            // Check if we received a valid response
            if (!networkResponse || (networkResponse.status !== 200 && networkResponse.type !== 'opaque') || (networkResponse.type === 'basic' && networkResponse.status !== 200)) {
              // Don't cache invalid responses
              return networkResponse;
            }

            // Clone the response because it's a stream and can only be consumed once.
            const responseToCache = networkResponse.clone();

            // Cache the new response
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });

            // Return the network response
            return networkResponse;
          }
        ).catch(error => {
            console.error('Service Worker: Fetch failed:', error);
            // Fallback for navigation requests (e.g., loading the HTML page) when offline
            if (event.request.mode === 'navigate') {
                console.log('Service Worker: Fetch failed for navigation, returning cached index.html.');
                // Make sure './index.html' is in urlsToCache
                return caches.match('./index.html');
            }
            // Optional: You could provide a generic offline fallback for other assets like images
            // if (event.request.destination === 'image') {
            //   return caches.match('/offline-image.png'); // Requires caching this image
            // }
        });
      })
  );
});
