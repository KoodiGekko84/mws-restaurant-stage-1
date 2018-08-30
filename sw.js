'use strict';

const staticCacheName = 'restaurant-reviews-static-v1';

// Let's cache the static assets while installing the service worker:
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(staticCacheName).then(cache => {
      return cache.addAll([
        '/index.html',
        '/restaurant.html',
        '/favicon.ico',
        '/css/styles.css',
        '/js/dbhelper.js',
        '/js/main.js',
        '/js/restaurant_info.js',
        '/data/restaurants.json'
      ]).catch((error) => {
        console.log('Failed to add skeleton to the caches with the error: ' + error);
      });
    })
  );
});


// Let's serve assets from our cache:
self.addEventListener('fetch', (event) => {
  // Let's skip browser extensions etc:
  if (!event.request.url.startsWith('http')) return;

  // Let's not cache maps:
  if (event.request.url.startsWith('https://api.tiles.mapbox.com')) return;

  // Let's serve other assets from cache (or cache them if not found):
  event.respondWith(
    caches.open(staticCacheName).then((cache) => {
      return cache.match(event.request).then((response) => {
        return response || fetch(event.request).then((response) => {
          cache.put(event.request, response.clone());
          return response;
        });
      });
    })
  );
});
