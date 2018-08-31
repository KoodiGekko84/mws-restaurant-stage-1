'use strict';

// This application is not using a bundler so we are importing 
// the idb script from local directory for better browser compatibility.
// Jake Archibald - https://github.com/jakearchibald/idb
// Downloaded: 30 August 2018
importScripts('js/3rdparty/idb.js');

const dbServerPort = '1337';
var dbPromise;

const staticCacheName = 'restaurant-reviews-static-v1';
const indexedDBName = 'restaurant-reviews-db';

createIDB(indexedDBName);

var that = this;

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
function createIDB (dbName) {
  dbPromise = idb.open(dbName, 1, upgradeDb => {
    // Let's use the switch from the beginning for easier maintenance:
    switch (upgradeDb.oldVersion) {
      case 0:
        let restaurantStore = upgradeDb.createObjectStore('restaurants', { keyPath: 'id' });
      case 1:
        let reviewsStore = upgradeDb.createObjectStore('reviews', { keyPath: 'id' });
        // Restaurant_id is unique, because only one pending review submission per restaurant. 
        let pendingReviewsStore = upgradeDb.createObjectStore('pending-reviews', { keyPath: 'restaurant_id' })
    }
    console.log('Indexed database', upgradeDb.name,'created/upgraded to version:', upgradeDb.version);
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
        // ---------------------------------------------------------------------------------------------
        // 3. If there are relevant changes (eg. new restaurants for index.html or changed data 
        //    for restaurant.html), it will postMessage to the browser so that it can update the pages.
        // ---------------------------------------------------------------------------------------------
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
    }).catch(err => {
      console.log(err);
      return err;
    });

    if (idbRestaurants && idbRestaurants[0]) return new Response(JSON.stringify(idbRestaurants), { headers: { 'Content-Type': 'application/json' } });
    return fetchedRestaurantsPromise;
  }).catch(err => {
    console.log('Error while fetching the restaurant with id', id);
    console.log(err);
    return new Response({ status: 404, statusText: 'Restaurant ' + id + ' not found' });
  });
}

function getReviews(event) {
  let _idbReviews;
  let _fetchedReviews;
  let id = event.request.url.split('=').pop();
  // 1. First it will fetch reviews from the IndexedDB and respond to the client
  return dbPromise.then(db => db.transaction('reviews').objectStore('reviews').getAll()).then(idbReviews => {
    idbReviews = idbReviews.filter(obj => obj.restaurant_id === parseInt(id));
    // 2. Then it will fetch them from the external database (port 1337) and store to indexedDB
    let fetchedReviewsPromise = fetch(event.request).then(response => {
      response.clone().json().then(fetchedReviews => {
        dbPromise.then(db => {
          if (fetchedReviews && fetchedReviews[0]) {
            const setTx = db.transaction('reviews', 'readwrite').objectStore('reviews');
            // Let's then save each one of the new reviews:
            fetchedReviews.forEach((review, i) => {
              setTx.put(review);
            });
            _fetchedReviews = fetchedReviews.filter(obj => obj.restaurant_id === parseInt(id));
            return setTx.complete;
          }
        });
        // -------------------------------------------------------------------------------------
        // 3. POST FETCHED REVIEWS TO BROWSER SO THAT BROWSER CAN COMPARE IF NEEDS TO BE UPDATED
        // -------------------------------------------------------------------------------------
        that.clients.get(event.clientId).then(client => {
          client.postMessage({type: 'NEW_REVIEWS', reviews: _fetchedReviews});
        });
      });
      return response;
    }).catch(err => {
      console.log(err);
      return err;
    });
    if (idbReviews && idbReviews[0]) return new Response(JSON.stringify(idbReviews), { headers: { 'Content-Type': 'application/json' } });
    return fetchedReviewsPromise;
  }).catch(err => {
    console.log('Error while fetching the reviews');
    console.log(err);
    return new Response({ status: 404, statusText: 'Reviews not found' });
  });
}

function postReviews(event) {
  return fetch(event.request.clone())
    .then(response => response)
    .catch(error => {
      console.log('error', error);
      // Let's save the review to submittedReviewsStore:
      event.request.clone().json().then(data => {
        dbPromise.then(db => {
          const tx = db.transaction('pending-reviews', 'readwrite').objectStore('pending-reviews');
          tx.put(data);
          return tx.complete;
        });
        return that.clients.get(event.clientId).then(client => {
          return self.postPendingReviews(client);
        });
      })
      return new Response(JSON.stringify({ error: "Network error happened" }), {"status" : 408, "headers" : {"Content-Type" : "application/json"}});
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
    if (requestUrl.pathname.startsWith('/restaurants')) {
      event.respondWith(fetchDynamic(event));
    } else if (requestUrl.pathname.startsWith('/reviews')) {
      if (event.request.method === 'GET') {
        event.respondWith(getReviews(event));
      } else if (event.request.method === 'POST'){
        event.respondWith(postReviews(event));
      }
    } else {
      return;
    }
  } else {
    // Static assets:
    event.respondWith(fetchStatic(event.request));
  }
});

// ------------------------------------
//           PENDING REVIEWS
// ------------------------------------
self.addEventListener('message', event => {
  if (event.data.type === 'FETCH_PENDING_REVIEWS') {
    return this.clients.get(event.source.id).then(client => self.postPendingReviews(client));
  } else if (event.data.type === 'UPLOAD_PENDING_REVIEWS') {
    dbPromise.then(db => db.transaction('pending-reviews', 'readwrite').objectStore('pending-reviews').getAll()).then(pendingReviews => {
      // Lets upload the pending reviews to the database server:
      let total = pendingReviews.length;
      function counter (total, callback) {
        let count = 0;
        let total2 = total;
        let cb = callback;
        return {
          add: function () {
            count = count + 1;
            if (count === total2) return cb();
          },
        }
      }
      
      let countAsync = counter(total, () => dbPromise.then(db => {
        return db.transaction('pending-reviews', 'readwrite').objectStore('pending-reviews').clear().then(() => {
          return this.clients.get(event.source.id).then(client => self.postPendingReviews(client));
        })
      }));

      pendingReviews.forEach(review => {
        fetch('http://localhost:1337/reviews/', {
          method: 'POST',
          body: JSON.stringify(review),
          headers: { 'Content-Type': 'application/json' }
        }).then(res => res.json().then(() => countAsync.add()));
      });
    });
  }
})

// Sends new pending reviews to the browser via postMessage
function postPendingReviews(client) {
  dbPromise.then(db => db.transaction('pending-reviews').objectStore('pending-reviews').getAll()).then(pendingReviews => {
    client.postMessage({type: 'PENDING_REVIEWS', reviews: pendingReviews });
  });
}
