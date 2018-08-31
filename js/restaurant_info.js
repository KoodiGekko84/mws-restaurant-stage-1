'use strict';

let restaurant;
var newMap;

/**
 * Register Service Worker:
 */
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', {scope: '/'})
    .then(reg => {
      console.log('SW registration succeeded. Scope is ' + reg.scope);
    }).catch(error => {
      console.log('SW registration failed with ' + error);
    });
}

navigator.serviceWorker.addEventListener('message', event => {
  if (event.data.type === 'UPDATED') {
    if (restaurant.id === event.data.id) {
      self.restaurant = event.data.restaurant;
      fillRestaurantHTML();
      fillBreadcrumb();
      DBHelper.mapMarkerForRestaurant(self.restaurant, self.newMap);
    }
  }
});

/**
 * Initialize map as soon as the page is loaded.
 */
document.addEventListener('DOMContentLoaded', (event) => {  
  initMap();
});
 /**
 * Initialize leaflet map
 */
let initMap = () => {
  fetchRestaurantFromURL((error, restaurant) => {
    if (error) { // Got an error!
      console.error(error);
    } else {      
      self.newMap = L.map('map', {
        center: [restaurant.latlng.lat, restaurant.latlng.lng],
        zoom: 16,
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
      fillBreadcrumb();
      DBHelper.mapMarkerForRestaurant(self.restaurant, self.newMap);
    }
  });
}

/**
 * Get current restaurant from page URL.
 */
let fetchRestaurantFromURL = (callback) => {
  if (self.restaurant) { // restaurant already fetched!
    callback(null, self.restaurant)
    return;
  }
  const id = getParameterByName('id');
  if (!id) { // no id found in URL
    error = 'No restaurant id in URL'
    callback(error, null);
  } else {
    DBHelper.fetchRestaurantById(id, (error, restaurant) => {
      self.restaurant = restaurant;
      if (!restaurant) {
        console.error(error);
        return;
      }
      fillRestaurantHTML();
      callback(null, restaurant)
    });
  }
}

/**
 * Create restaurant HTML and add it to the webpage
 */
let fillRestaurantHTML = (restaurant = self.restaurant) => {
  const name = document.getElementById('restaurant-name');
  name.innerHTML = restaurant.name;

  const address = document.getElementById('restaurant-address');
  address.innerHTML = restaurant.address;

  // Images:
  let imageSrc = DBHelper.imageUrlForRestaurant(restaurant).split('.', 1)[0];
  
  // Image alt text:
  let imageAltText = DBHelper.imageAltTextForRestaurant(restaurant);
    
  // Responsive images:
  const pictureLarge  = document.getElementById('restaurant-picture-large');
  const pictureMedium  = document.getElementById('restaurant-picture-medium');
  pictureLarge.srcset = `${imageSrc}-800_large_1x.jpg 1x`;
  pictureMedium.srcset = `${imageSrc}-400_medium_1x.jpg 1x, ${imageSrc}-800_medium_2x.jpg 2x`;
  
  // Fallback image:
  const image = document.getElementById('restaurant-img');
  image.src = `${imageSrc}-300_small_1x.jpg`;
  image.srcset = `${imageSrc}-300_small_1x.jpg 1x, ${imageSrc}-600_small_2x.jpg 2x`;

  // Alt text and title
  image.alt = imageAltText;
  image.title = imageAltText;

  const cuisine = document.getElementById('restaurant-cuisine');
  cuisine.innerHTML = restaurant.cuisine_type;

  // fill operating hours
  if (restaurant.operating_hours) {
    fillRestaurantHoursHTML();
  }
  // fill reviews
  fillReviewsHTML();
}

/**
 * Create restaurant operating hours HTML table and add it to the webpage.
 */
let fillRestaurantHoursHTML = (operatingHours = self.restaurant.operating_hours) => {
  const hours = document.getElementById('restaurant-hours');
  hours. innerHTML = '';
  for (let key in operatingHours) {
    const row = document.createElement('tr');

    const day = document.createElement('td');
    day.innerHTML = key;
    row.appendChild(day);

    const time = document.createElement('td');
    let opHours = operatingHours[key];
    time.innerHTML = opHours.split(',').join('<br>');
    row.appendChild(time);

    hours.appendChild(row);
  }
}

/**
 * Create all reviews HTML and add them to the webpage.
 */
let fillReviewsHTML = (reviews = self.restaurant.reviews) => {
  const container = document.getElementById('reviews-container');
  container.innerHTML = '<ul id="reviews-list"></ul>'
  const title = document.createElement('h2');
  title.innerHTML = 'Reviews';
  container.appendChild(title);

  if (!reviews) {
    const noReviews = document.createElement('p');
    noReviews.innerHTML = 'No reviews yet!';
    container.appendChild(noReviews);
    return;
  }
  const ul = document.getElementById('reviews-list');
  reviews.forEach(review => {
    ul.appendChild(createReviewHTML(review));
  });
  container.appendChild(ul);
}

/**
 * Create review HTML and add it to the webpage.
 */
let createReviewHTML = (review) => {
  const li = document.createElement('li');

  // Let's create a review header:
  const reviewHeader = document.createElement('div');
  reviewHeader.classList.add("review-header");
  li.appendChild(reviewHeader);

  // Let's add name and date fields to the reviewHeader
  const name = document.createElement('p');
  name.classList.add("name");
  name.innerHTML = review.name;
  reviewHeader.appendChild(name);
  
  const date = document.createElement('p');
  date.classList.add("date");
  date.innerHTML = review.date;
  reviewHeader.appendChild(date);

  // Let's create a review body:
  const reviewBody = document.createElement('div');
  reviewBody.classList.add("review-body");
  li.appendChild(reviewBody);
  
  const rating = document.createElement('p');
  rating.classList.add("rating");
  rating.innerHTML = `RATING: ${review.rating}`;
  reviewBody.appendChild(rating);
  
  const comments = document.createElement('p');
  comments.classList.add("comments");
  comments.innerHTML = review.comments;
  reviewBody.appendChild(comments);

  return li;
}

/**
 * Add restaurant name to the breadcrumb navigation menu
 */
let fillBreadcrumb = (restaurant=self.restaurant) => {
  const breadcrumb = document.getElementById('breadcrumb');
  breadcrumb.innerHTML = '<li><a href="/">Home</a></li>';
  const li = document.createElement('li');
  li.innerHTML = restaurant.name;
  breadcrumb.appendChild(li);
}

/**
 * Get a parameter by name from page URL.
 */
let getParameterByName = (name, url) => {
  if (!url)
    url = window.location.href;
  name = name.replace(/[\[\]]/g, '\\$&');
  const regex = new RegExp(`[?&]${name}(=([^&#]*)|&|#|$)`),
    results = regex.exec(url);
  if (!results)
    return null;
  if (!results[2])
    return '';
  return decodeURIComponent(results[2].replace(/\+/g, ' '));
}
