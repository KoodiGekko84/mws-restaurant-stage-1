'use strict';

self.addEventListener('fetch', (event) => {
  // Let's not cache google maps or fonts:
  if (event.request.url.startsWith('https://maps.') || event.request.url.startsWith('https://fonts.')) {
    fetch(event.request).then((response) => {
      return response;
    });
    /*
    return new Response('<p>Hello. Google maps here!</p>', {
      headers: { 'Content-Type': 'text/html' }
    });
    */
  } else {
    event.respondWith(
      caches.open('mws-restaurant-stage-1').then((cache) => {
        return cache.match(event.request).then((response) => {
          if (response) return response;
          return fetch(event.request).then((response) => {
            console.log('Saving... ' + event.request.url);
            cache.put(event.request, response.clone());
            return response;
          });
        });
      })
    )
  }
});
