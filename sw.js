'use strict';

self.addEventListener('fetch', (event) => {
  // Let's not cache google maps or fonts:
  if (event.request.url.startsWith('https://maps.') || event.request.url.startsWith('https://fonts.') || event.request.url.startsWith('chrome-')) {
    console.log('requestURL:', event.request.url);
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // console.log('response')
          // console.log(response)
          return response;
        })
        .catch(error => {
          console.log('NO GOOGLE MAPS!')
          return new Response('<p>Hello. Google maps here!</p>', {
            headers: { 'Content-Type': 'text/html' }
          });
        })
    );
    /*
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
