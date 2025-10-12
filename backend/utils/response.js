/**
 * Response Helper Utilities
 * Standardized response formatting for API endpoints
 */

/**
 * Send success response
 *
 * @param {Object} res - Express response object
 * @param {*} data - Data to send in response
 */
exports.success = (res, data) => {
  res.json({ success: true, data });
};

/**
 * Send error response
 *
 * @param {Object} res - Express response object
 * @param {Number} code - HTTP status code
 * @param {String} message - Error message
 */
exports.error = (res, code, message) => {
  res.status(code).json({ success: false, error: message });
};

/**
 * Helper to rollback transaction and send error response
 *
 * @param {Object} connection - MySQL connection object
 * @param {Error} error - Error object (can be null)
 * @param {Number} errorCode - HTTP status code
 * @param {String} errorMessage - Error message to send
 * @param {Object} res - Express response object
 */
exports.rollbackAndRespond = (connection, error, errorCode, errorMessage, res) => {
  connection.rollback(() => {
    connection.release();
    if (error) console.error(errorMessage, error);
    res.status(errorCode).json({ success: false, error: errorMessage });
  });
};
