'use strict';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('mws-restaurant-stage-1').then((cache) => {
      return cache.addAll([
        '/'
      ]);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.open('mws-restaurant-stage-1').then(function(cache) {
      return cache.match(event.request).then(function (response) {
        return response || fetch(event.request).then(function(response) {
          cache.put(event.request, response.clone());
          return response;
        });
      });
    })
  );
});
