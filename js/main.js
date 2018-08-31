'use strict';

let restaurants = [];
let neighborhoods = [];
let cuisines = [];
var newMap;
var markers = []

/**
 * A Set of functions that take care of switching in between the online mode and offlien mode.
 */
function toggleOnlineMode() {
  const onlineStatusContainer = document.getElementById('online-status-container');
  onlineStatusContainer.classList.remove('offline');
  onlineStatusContainer.removeAttribute('aria-label');
  onlineStatusContainer.removeAttribute('role');

  // Let's process the pending reviews:
  if (navigator.serviceWorker && navigator.serviceWorker.controller) {
    navigator.serviceWorker.controller.postMessage({ type: 'UPLOAD_PENDING_REVIEWS'});
  }
}

function toggleOfflineMode() {
  const onlineStatusContainer = document.getElementById('online-status-container');
  onlineStatusContainer.classList.add('offline');
  onlineStatusContainer.setAttribute('aria-label', 'The browser is disconnected.')
  onlineStatusContainer.role = 'alert';

  // Let's make sure that the offline mode doesn't stay if went online unnoticed.
  var refreshIntervalId = setInterval(() => {
    if (navigator.onLine) {
      toggleOnlineMode();
      clearInterval(refreshIntervalId);
    }
  }, 10000);
}

/**
 * Register Service Worker:
 */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('/sw.js', {scope: '/'})
    .then(reg => {
      console.log('SW registration succeeded. Scope is ' + reg.scope);
      window.addEventListener('online', toggleOnlineMode);    
      window.addEventListener('offline', toggleOfflineMode);
      if (window.navigator.onLine) {
        toggleOnlineMode();
      } else {
        toggleOfflineMode();
      }
    })
    .catch(error => {
      console.log('SW registration failed with ' + error);
  });
}


navigator.serviceWorker.addEventListener('message', event => {
  if (event.data.type === 'NEW_RESTAURANTS') {
    // Get all unique neighborhoods from all restaurants
    const neighborhoods = event.data.restaurants.map(v => v.neighborhood);
    const uniqueNeighborhoods = neighborhoods.filter((v, i) => neighborhoods.indexOf(v) == i)
    
    // Get all unique cuisines from all restaurants
    const cuisines = event.data.restaurants.map(v => v.cuisine_type)
    const uniqueCuisines = cuisines.filter((v, i) => cuisines.indexOf(v) == i)

    self.restaurants = event.data.restaurants;
    self.cuisines = uniqueCuisines;
    self.neighborhoods = uniqueNeighborhoods;
 
    resetRestaurants();

    fillCuisinesHTML();
    fillNeighborhoodsHTML();
    fillRestaurantsHTML();
  }
});

/**
 * Fetch neighborhoods and cuisines as soon as the page is loaded.
 */
document.addEventListener('DOMContentLoaded', (event) => {
  initMap();
});

/**
 * Set neighborhoods HTML.
 */
let fillNeighborhoodsHTML = (neighborhoods = self.neighborhoods) => {
  const select = document.getElementById('neighborhoods-select');
  neighborhoods.forEach(neighborhood => {
    const option = document.createElement('option');
    option.innerHTML = neighborhood;
    option.value = neighborhood;
    select.append(option);
  });
}

/**
 * Set cuisines HTML.
 */
let fillCuisinesHTML = (cuisines = self.cuisines) => {
  const select = document.getElementById('cuisines-select');

  cuisines.forEach(cuisine => {
    const option = document.createElement('option');
    option.innerHTML = cuisine;
    option.value = cuisine;
    select.append(option);
  });
}

/**
 * Initialize leaflet map, called from HTML.
 */
let initMap = () => {
  self.newMap = L.map('map', {
        center: [40.722216, -73.987501],
        zoom: 12,
        scrollWheelZoom: false
      });
  L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.jpg70?access_token={mapboxToken}', {
    mapboxToken: 'pk.eyJ1IjoiYXJ0b3BhcnRvODQiLCJhIjoiY2psOXRpemZyMGlvaTN3bzB5eHprOGE3eiJ9.PHrUfbUeXCbZeF0GhfTKVw',
    maxZoom: 18,
    attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, ' +
      '<a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, ' +
      'Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
    id: 'mapbox.streets'
  }).addTo(self.newMap);
  updateRestaurantsAndFilters();
}

/**
 * Update page and map for current restaurants.
 */
let updateRestaurantsAndFilters = () => {
  const cSelect = document.getElementById('cuisines-select');
  const nSelect = document.getElementById('neighborhoods-select');

  const cIndex = cSelect.selectedIndex;
  const nIndex = nSelect.selectedIndex;

  const cuisine = cSelect[cIndex].value;
  const neighborhood = nSelect[nIndex].value;

  DBHelper.fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, (error, results) => {
    if (error) { // Got an error!
      console.error(error);
    } else {
      self.restaurants = results.restaurants;
      self.cuisines = results.cuisines;
      self.neighborhoods = results.neighborhoods;

      resetRestaurants();

      fillCuisinesHTML();
      fillNeighborhoodsHTML();
      fillRestaurantsHTML();
    }
  })
}

/**
 * Clear current restaurants, their HTML and remove their map markers.
 */
let resetRestaurants = () => {
  // Remove all restaurants
  const ul = document.getElementById('restaurants-list');
  ul.innerHTML = '';

  // Remove all map markers
  self.markers.forEach(m => m.setMap(null));
  self.markers = [];
}

/**
 * Create all restaurants HTML and add them to the webpage.
 */
let fillRestaurantsHTML = () => {
  const ul = document.getElementById('restaurants-list');
  self.restaurants.forEach(restaurant => {
    ul.append(createRestaurantHTML(restaurant));
  });
  addMarkersToMap();
}

/**
 * Create restaurant HTML.
 */
let createRestaurantHTML = (restaurant) => {
  const li = document.createElement('li');

  // Images:
  let imageSrc = DBHelper.imageUrlForRestaurant(restaurant).split('.', 1)[0];
  
  // Image alt text:
  let imageAltText = DBHelper.imageAltTextForRestaurant(restaurant);

  const image = document.createElement('img');
  image.className = 'restaurant-img';
  image.src = `${imageSrc}-300_small_1x.jpg`
  image.srcset = `${imageSrc}-300_small_1x.jpg 1x, ${imageSrc}-600_small_2x.jpg 2x`;
  image.alt = imageAltText;
  image.title = imageAltText;

  li.append(image);

  const name = document.createElement('h1');
  name.innerHTML = restaurant.name;
  li.append(name);

  const neighborhood = document.createElement('p');
  neighborhood.innerHTML = restaurant.neighborhood;
  li.append(neighborhood);

  const address = document.createElement('p');
  address.className = 'restaurant-address';
  address.innerHTML = restaurant.address;
  li.append(address);
  
  const more = document.createElement('a');
  more.innerHTML = 'View Details';
  more.setAttribute('aria-label', 'View Details of ' + restaurant.name + ' Restaurant');
  more.href = DBHelper.urlForRestaurant(restaurant);
  li.append(more);
  
  return li
}

/**
 * Add markers for current restaurants to the map.
 */
let addMarkersToMap = (restaurants = self.restaurants) => {
  restaurants.forEach(restaurant => {
    // Add marker to the map
    const marker = DBHelper.mapMarkerForRestaurant(restaurant, self.newMap);
    marker.on("click", onClick);
    function onClick() {
      window.location.href = marker.options.url;
    }
  });
} 
