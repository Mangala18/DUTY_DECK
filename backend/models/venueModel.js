const db = require('../config/db');

/**
 * Venue Model
 * Handles all database operations for venue management
 */

/**
 * Get all venues
 * @param {String} query - SQL query
 * @param {Array} params - Query parameters
 * @param {Function} callback - Callback(err, results)
 */
exports.getVenues = (query, params, callback) => {
  db.query(query, params, callback);
};

/**
 * Get venue by code
 * @param {String} query - SQL query
 * @param {Array} params - Query parameters
 * @param {Function} callback - Callback(err, results)
 */
exports.getVenueByCode = (query, params, callback) => {
  db.query(query, params, callback);
};
