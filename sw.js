'use strict';

// This application is not using a bundler so we are importing 
// the idb script from local directory for better browser compatibility.
// Jake Archibald - https://github.com/jakearchibald/idb
// Downloaded: 30 August 2018
importScripts('js/3rdparty/idb.js');

createIDB();

const that = this;
const dbServerPort = '1337';
var dbPromise;

const staticCacheName = 'restaurant-reviews-static-v1';
const indexedDBName = 'restaurant-reviews-db';

// ------------------------------------------
//        Static assets & cache storage
// ------------------------------------------
// Let's cache the static assets while installing the service worker:
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(staticCacheName).then(cache => {
      return cache.addAll([
        '/index.html',
        '/restaurant.html',
        '/favicon.ico',
        '/manifest.json',
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

// Let's serve other assets from cache (or cache them if they are not found):
function fetchStatic(request) {
  const requestUrl = new URL(request.url);
  
  if (requestUrl.hostname === location.hostname && requestUrl.pathname.startsWith('/restaurant.html')) {
    return caches.match('/restaurant.html');
  }
  
  return caches.open(staticCacheName).then(cache => {
    return cache.match(request).then(response => {
      return response || fetch(request).then(response => {
        cache.put(request, response.clone());
        return response;
      });
    });
  })
}

// ------------------------------------------
//        Dynamic assets & Indexed DB
// ------------------------------------------
function createIDB () {
  self.dbPromise = idb.open(self.indexedDBName, 1, upgradeDb => {
    // Let's use the switch from the beginning for easier maintenance:
    switch (upgradeDb.oldVersion) {
      case 0:
        let restaurantStore = upgradeDb.createObjectStore('restaurants', { keyPath: 'id' });
    }
    // console.log('Indexed database', upgradeDb.name,'created/upgraded to version:', upgradeDb.version);
  });
}

// Fetches dynamic data (ie restaurants & reviews)
// 1. First it will fetch restaurants from the IndexedDB and respond to the client
// 2. Then it will fetch them from the external database (port 1337) and store to indexedDB
// 3. If there are relevant changes (eg. new restaurants for index.html or changed data 
//    for restaurant.html), it will postMessage to the browser so that it can update the pages.
function fetchDynamic(event) {
  const request = event.request;
  const requestUrl = new URL(request.url);
  const path = '/restaurants/'
  const id = requestUrl.pathname.split('/')[2];
  
  // 1. First it will fetch restaurants from the IndexedDB and respond to the client
  return dbPromise.then(db => db.transaction('restaurants').objectStore('restaurants').getAll()).then(idbRestaurants => {
    // 2. Then it will fetch them from the external database (port 1337) and store to indexedDB
    let fetchedRestaurantsPromise = fetch(requestUrl.origin + path).then(response => {
      
      response.clone().json().then(fetchedRestaurants => {
        dbPromise.then(db => {
          if (fetchedRestaurants && fetchedRestaurants[0]) {
            const setTx = db.transaction('restaurants', 'readwrite').objectStore('restaurants');
            
            // Let's first clear the database (in case there are restaurants that have been removed):
            setTx.clear();

            // Let's then save each one of the new restaurants:
            fetchedRestaurants.forEach(restaurant => {
              setTx.put(restaurant);
            });
            return setTx.complete;
          }
        });
        if (id) {
          let idbRestaurant = idbRestaurants.find(obj => obj.id === parseInt(id));
          let fetchedRestaurant = fetchedRestaurants.find(obj => obj.id === parseInt(id));
          if (idbRestaurant && fetchedRestaurant && JSON.stringify(idbRestaurant) !== JSON.stringify(fetchedRestaurant)) {
            // Let's send the client a message about changed information:
            that.clients.get(event.clientId).then(client => {
              client.postMessage({type: 'UPDATED', id: parseInt(id), restaurant: fetchedRestaurant});
            });
          }
        } else {
          if (idbRestaurants && idbRestaurants[0] && fetchedRestaurants && fetchedRestaurants[0] 
            && fetchedRestaurants.length !== idbRestaurants.length) {
              that.clients.get(event.clientId).then(client => {
              client.postMessage({type: 'NEW_RESTAURANTS', restaurants: fetchedRestaurants});
            });
          }
        }
      });
      return response;
    })
    if (idbRestaurants && idbRestaurants[0]) return new Response(JSON.stringify(idbRestaurants), { headers: { 'Content-Type': 'application/json' } });
    return fetchedRestaurantsPromise;
  }).catch(err => {
    console.log('Error while fetching the restaurant with id', id);
    console.log(err);
    return new Response({ status: 404, statusText: 'Restaurant ' + id + ' not found' });
  });
}

// --------------------------------------
//         RESPONDING TO FETCH
// --------------------------------------
self.addEventListener('fetch', event => {
  // Let's skip browser extensions etc:
  if (!event.request.url.startsWith('http')) return;
  // Let's not cache maps:
  if (event.request.url.startsWith('https://api.tiles.mapbox.com')) return;

  const requestUrl = new URL(event.request.url);

  // Let's find out if the assets are dynamic (port: 1337) or from static (post: 8000)
  if (requestUrl.hostname === location.hostname && requestUrl.port === dbServerPort) {
    // Dynamic assets:
    event.respondWith(fetchDynamic(event));
  } else {
    // Static assets:
    event.respondWith(fetchStatic(event.request));
  }
});
