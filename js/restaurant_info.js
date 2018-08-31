'use strict';

let restaurant;
let reviews = [];
var newMap;

let pendingReview;

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
        return toggleOnlineMode();
      } else {
        return toggleOfflineMode();
      }
    })
    .catch(error => {
      console.log('SW registration failed with ' + error);
  });
}


navigator.serviceWorker.addEventListener('message', event => {
  if (event.data.type === 'UPDATED') {
    if (parseInt(getParameterByName('id')) === event.data.id) {
      self.restaurant = event.data.restaurant;
      fillRestaurantHTML();
      fillBreadcrumb();
      DBHelper.mapMarkerForRestaurant(self.restaurant, self.newMap);
    }
  } else if (event.data.type === 'NEW_REVIEWS') {
    if (!self.reviews || (self.reviews.length !== event.data.reviews.length)) {
      self.reviews = event.data.reviews;
      fillReviewsHTML();
    }
  } else if (event.data.type === 'PENDING_REVIEWS') {
    let pendings = event.data.reviews;
    self.pendingReview = pendings.find(obj => obj.restaurant_id === parseInt(getParameterByName('id')));
    fetchReviewsFromURL(() => {
      // Update reviews and reviewform!
      fillReviewFormHTML();
      fillReviewsHTML();
    });
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
  navigator.serviceWorker.controller.postMessage({ type: 'FETCH_PENDING_REVIEWS' });
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
      return fetchReviewsFromURL();
    }
  });
  
}

/**
 * Get current restaurant from page URL.
 */
let fetchRestaurantFromURL = callback => {
  if (self.restaurant) { // restaurant already fetched!
    return callback(null, self.restaurant)
  }
  const id = getParameterByName('id');
  if (!id) { // no id found in URL
    error = 'No restaurant id in URL'
    return callback(error, null);
  } else {
    DBHelper.fetchRestaurantById(id, (error, restaurant) => {
      self.restaurant = restaurant;
      if (!restaurant) {
        console.error(error);
        return;
      }
      fillRestaurantHTML();
      fillReviewFormHTML();

      return callback(null, restaurant)
    });
  }
}

/**
 * Get the reviews of current restaurant from URL.
 */
let fetchReviewsFromURL = callback => {
  DBHelper.fetchReviewsById(getParameterByName('id'), (err, reviews) => {
    if (err) {
      console.error(err);
      if (callback) return callback(err, null);
    } else {
      self.reviews = reviews;
      fillReviewsHTML();
      if (callback) return callback(null, reviews);
    }
  });
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
let fillReviewsHTML = (reviews = self.reviews) => {
  if (!reviews) reviews = [];
  let reviews2 = JSON.parse(JSON.stringify(reviews));

  const container = document.getElementById('reviews-container');
  container.innerHTML = '<ul id="reviews-list"></ul>'
  const title = document.createElement('h2');
  title.innerHTML = 'Reviews';
  container.appendChild(title);
  
  if (self.pendingReview) {
    if (!reviews2) reviews2 = [];
    reviews2.push(Object.assign({}, self.pendingReview, { pending: true }));
  }

  if (!reviews2) {
    const noReviews = document.createElement('p');
    noReviews.innerHTML = 'No reviews yet!';
    container.appendChild(noReviews);
    return;
  }

  const ul = document.getElementById('reviews-list');

  reviews2.forEach(review => ul.appendChild(createReviewHTML(review)));
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
  date.innerHTML = new Date(review.createdAt).toLocaleDateString();
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

  if (review.pending) {
    li.classList.add('pending');
    const pending = document.createElement('p');
    pending.classList.add('pending');
    pending.innerHTML = 'Your comment will be available when your browser gets back online';
    reviewBody.appendChild(pending);
  }

  return li;
}

/**
 * Initiate the review form with id and time
 */
let fillReviewFormHTML = () => {
  const reviewFormContainer = document.getElementById('review-form-container');
  const pendingReviewInfo = document.getElementById('pending-review-info');
  
  if (self.pendingReview) {
    pendingReviewInfo.classList.add("visible");
    reviewFormContainer.classList.add("hidden");
  } else {
    pendingReviewInfo.classList.remove("visible");
    reviewFormContainer.classList.remove("hidden");
  }

  const inputMessageId = document.getElementById('input-message-id');
  const inputId = document.getElementById('input-id');
  const inputDate = document.getElementById('input-date');
  const inputName = document.getElementById('input-name');
  const inputRating = document.getElementById('input-rating');
  const inputComments = document.getElementById('input-comments');
  
  inputMessageId.value = Math.floor(Math.random() * 10000000) + 1;
  inputId.value = parseInt(getParameterByName('id'));
  inputDate.value = Date.now();
  
  const reviewFormButton = document.getElementById('review-form-button');
  reviewFormButton.onclick = submitReview;
  
  function submitReview() {
    // Validate properties:    
    let errors = [];
    if (inputName.value.length === 0) errors.push('You forgot to provide a name');
    if (inputName.value.length > 30) errors.push('The name is too long');
    if (!/\b[0-5]\b/.test(inputRating.value)) errors.push('The rating has to be a number between 1 and 5')
    if (inputComments.value.length === 0) errors.push('Your must provide a review');
    if (inputComments.value.length > 1000) errors.push('Your review is too long');

    if (errors.length > 0) return window.alert('There is something wrong with your review. \n' + errors.join('\n'));

    // Let's get review values:
    let reviewData = {};
    reviewData.messageId = inputMessageId.value;
    reviewData.restaurant_id = parseInt(inputId.value);
    reviewData.date = Date.now(inputDate.value);
    reviewData.name = inputName.value;
    reviewData.rating = parseInt(inputRating.value);
    reviewData.comments = inputComments.value;

    DBHelper.saveRestaurantReview(reviewData, (err, results) =>{
      if (err) {
        console.log('Error while saving the review:');
        console.log(err);
        navigator.serviceWorker.controller.postMessage({ type: 'FETCH_PENDING_REVIEWS' });
        return;
      }
      fetchReviewsFromURL();

      if (results) {
        // Let's reset the form:
        inputMessageId.value = Math.floor(Math.random() * 10000000) + 1;
        inputId.value = parseInt(getParameterByName('id'));
        inputDate.value = Date.now();
        inputName.value = '';
        inputRating.value = '';
        inputComments.value = '';
      }
    });
  }
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
function getParameterByName (name, url) {
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
