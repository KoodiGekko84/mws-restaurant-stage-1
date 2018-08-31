/**
 * Common database helper functions.
 */
class DBHelper {

  /**
   * Database URL.
   * Change this to restaurants.json file location on your server.
   */
  static get DATABASE_URL() {
    const port = 1337 // Change this to your server port
    return `http://localhost:${port}`;
  }

  /**
   * Fetch all restaurants.
   */
  static fetchRestaurants(callback) {
    fetch(DBHelper.DATABASE_URL + '/restaurants/')
      .then(response => {
        if (response.status !== 200) throw Error('Request failed. Returned status of:', response.status);
        return response.json();
      })
      .then(restaurants => {
        return callback(null, restaurants);
      })
      .catch(err => {
        console.log('Fetching the restaurant didn\'t work:', err);
        return callback(err, null);
      });
  }

  /**
   * Fetch a restaurant by its ID.
   */
  static fetchRestaurantById(id, callback) {
    fetch(DBHelper.DATABASE_URL + '/restaurants/' + id)
      .then(response => {
        if (response.status !== 200) throw Error('Request failed. Returned status of:', response.status);
        return response.json();
      })
      .then(restaurants => {
        const restaurant = restaurants.find(obj => obj.id === parseInt(id));
        if (!restaurant) return callback('Restaurant does not exist', null);
        return callback(null, restaurant);
      })
      .catch(err => {
        console.log('Fetching the restaurant didn\'t work:', err);
        return callback(err, null);
      });
  }
  
  /**
   * Fetch reviews by restaurant ID.
   */
  static fetchReviewsById(id, callback) {
    if (!id) return callback (new Error('No Restaurant Id'), null);
    fetch(DBHelper.DATABASE_URL + '/reviews/?restaurant_id=' + id)
      .then(response => {
        if (response.status !== 200) throw Error('Request failed. Returned status of:', response.status);
        return response.json();
      })
      .then(reviews => {
        return callback(null, reviews);
      })
      .catch(err => {
        console.log('Fetching the reviews didn\'t work:', err);
        return callback(err, null);
      });
  }

  /**
   * Fetch restaurants by a cuisine type with proper error handling.
   */
  static fetchRestaurantByCuisine(cuisine, callback) {
    // Fetch all restaurants  with proper error handling
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        return callback(error, null);
      } else {
        // Filter restaurants to have only given cuisine type
        const results = restaurants.filter(r => r.cuisine_type == cuisine);
        return callback(null, results);
      }
    });
  }

  /**
   * Fetch restaurants by a neighborhood with proper error handling.
   */
  static fetchRestaurantByNeighborhood(neighborhood, callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        return callback(error, null);
      } else {
        // Filter restaurants to have only given neighborhood
        const results = restaurants.filter(r => r.neighborhood == neighborhood);
        return callback(null, results);
      }
    });
  }

  /**
   * Fetch restaurants (by a cuisine and a neighborhood) and unique neighbourhoods and cuisines
   * with proper error handling.
   */
  static fetchRestaurantByCuisineAndNeighborhood(cuisine, neighborhood, callback) {
    // Fetch all restaurants
    DBHelper.fetchRestaurants((error, restaurants) => {
      if (error) {
        return callback(error, null);
      } else {
        // Get all unique neighborhoods from all restaurants
        const neighborhoods = restaurants.map(v => v.neighborhood);
        const uniqueNeighborhoods = neighborhoods.filter((v, i) => neighborhoods.indexOf(v) == i)

        // Get all unique cuisines from all restaurants
        const cuisines = restaurants.map(v => v.cuisine_type)
        const uniqueCuisines = cuisines.filter((v, i) => cuisines.indexOf(v) == i)

        // Get the wanted restaurants
        if (cuisine != 'all') restaurants = restaurants.filter(r => r.cuisine_type == cuisine);
        if (neighborhood != 'all') restaurants = restaurants.filter(r => r.neighborhood == neighborhood);

        return callback(null, { restaurants: restaurants, cuisines: uniqueCuisines, neighborhoods: uniqueNeighborhoods });
      }
    });
  }

  /**
   * Restaurant page URL.
   */
  static urlForRestaurant(restaurant) {
    return (`./restaurant.html?id=${restaurant.id}`);
  }

  /**
   * Restaurant image URL.
   */
  static imageUrlForRestaurant(restaurant) {
    if (!restaurant.photograph) restaurant.photograph = 'no_picture';
    return (`/img/${restaurant.photograph}`);
  }
  
  /**
   * Restaurant image alt text.
   */
  static imageAltTextForRestaurant(restaurant) {
    return restaurant.name + ' restaurant';
  }

  /**
   * Map marker for a restaurant.
   */
  static mapMarkerForRestaurant(restaurant, map) {
    // https://leafletjs.com/reference-1.3.0.html#marker  
    const marker = new L.marker([restaurant.latlng.lat, restaurant.latlng.lng],
      {title: restaurant.name,
      alt: restaurant.name,
      url: DBHelper.urlForRestaurant(restaurant)
      })
      marker.addTo(newMap);
    return marker;
  }

  static saveRestaurantReview(reviewData, callback) {
    fetch(DBHelper.DATABASE_URL + '/reviews/', {
      method: 'POST',
      body: JSON.stringify(reviewData),
      headers: { 'Content-Type': 'application/json' }
    }).then(res => res.json()
      .then(response => {
        console.log('Success:', JSON.stringify(response));
        return callback(null, response);
      })).catch(error => {
        // console.error('Error:', erro);
        return callback(error, null);
      });
  }

}
