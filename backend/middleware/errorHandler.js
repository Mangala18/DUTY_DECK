/**
 * Global Error Handler Middleware
 * Catches unhandled errors and sends appropriate responses
 */

module.exports = (err, req, res, next) => {
  console.error('Unhandled Error:', err);

  // Determine error status code
  const statusCode = err.statusCode || 500;

  // Send error response
  res.status(statusCode).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
};
