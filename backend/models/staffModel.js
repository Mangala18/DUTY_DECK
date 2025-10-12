const db = require('../config/db');

/**
 * Staff Model
 * Handles all database operations for staff management
 * This layer is thin - no business logic, just SQL queries
 */

/**
 * Execute a generic query
 * @param {String} query - SQL query
 * @param {Array} params - Query parameters
 * @param {Function} callback - Callback(err, results)
 */
exports.query = (query, params, callback) => {
  db.query(query, params, callback);
};

/**
 * Get venues
 * @param {String} query - SQL query
 * @param {Array} params - Query parameters
 * @param {Function} callback - Callback(err, results)
 */
exports.getVenues = (query, params, callback) => {
  db.query(query, params, callback);
};

/**
 * Get all staff
 * @param {String} query - SQL query
 * @param {Array} params - Query parameters
 * @param {Function} callback - Callback(err, results)
 */
exports.getAllStaff = (query, params, callback) => {
  db.query(query, params, callback);
};

/**
 * Get single staff member
 * @param {String} query - SQL query
 * @param {Array} params - Query parameters
 * @param {Function} callback - Callback(err, results)
 */
exports.getStaffByCode = (query, params, callback) => {
  db.query(query, params, callback);
};

/**
 * Add new staff member
 * @param {String} query - SQL query
 * @param {Array} params - Query parameters
 * @param {Function} callback - Callback(err, result)
 */
exports.addStaff = (query, params, callback) => {
  db.query(query, params, callback);
};

/**
 * Update staff member
 * @param {String} query - SQL query
 * @param {Array} params - Query parameters
 * @param {Function} callback - Callback(err, result)
 */
exports.updateStaff = (query, params, callback) => {
  db.query(query, params, callback);
};

/**
 * Delete staff member (soft delete)
 * @param {String} query - SQL query
 * @param {Array} params - Query parameters
 * @param {Function} callback - Callback(err, result)
 */
exports.deleteStaff = (query, params, callback) => {
  db.query(query, params, callback);
};

/**
 * Get a database connection for transactions
 * @param {Function} callback - Callback(err, connection)
 */
exports.getConnection = (callback) => {
  db.getConnection(callback);
};
