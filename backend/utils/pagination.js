/**
 * Pagination Utility
 *
 * Provides standardized pagination logic for all list endpoints
 * Prevents unbounded result sets and provides consistent API responses
 *
 * @example
 * const { buildPagination, formatPaginatedResponse } = require('../utils/pagination');
 *
 * // In controller
 * const { page, limit, offset } = buildPagination(req);
 * const [rows] = await db.execute(`SELECT * FROM staff LIMIT ? OFFSET ?`, [limit, offset]);
 * const [[{ total }]] = await db.execute(`SELECT COUNT(*) as total FROM staff`);
 * res.json(formatPaginatedResponse(rows, total, page, limit));
 */

/**
 * Extract and validate pagination parameters from request
 *
 * @param {Object} req - Express request object
 * @param {number} defaultLimit - Default rows per page (default: 50)
 * @param {number} maxLimit - Maximum allowed rows per page (default: 1000)
 * @returns {Object} { page, limit, offset }
 */
function buildPagination(req, defaultLimit = 50, maxLimit = 1000) {
  // Parse query parameters
  let page = parseInt(req.query.page) || 1;
  let limit = parseInt(req.query.limit) || defaultLimit;

  // Validate and constrain values
  page = Math.max(1, page); // page must be at least 1
  limit = Math.min(maxLimit, Math.max(1, limit)); // limit between 1 and maxLimit

  // Calculate offset
  const offset = (page - 1) * limit;

  return {
    page,
    limit,
    offset
  };
}

/**
 * Format paginated response with metadata
 *
 * @param {Array} rows - Result rows from database
 * @param {number} total - Total count of all matching records
 * @param {number} page - Current page number
 * @param {number} limit - Rows per page
 * @returns {Object} Standardized paginated response
 */
function formatPaginatedResponse(rows, total, page, limit) {
  const totalPages = Math.ceil(total / limit);

  return {
    success: true,
    data: {
      rows,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNextPage: page < totalPages,
        hasPreviousPage: page > 1
      }
    }
  };
}

/**
 * Build SQL LIMIT and OFFSET clause
 *
 * @param {Object} pagination - Pagination object from buildPagination
 * @returns {string} SQL LIMIT OFFSET clause
 */
function buildLimitClause({ limit, offset }) {
  return `LIMIT ${limit} OFFSET ${offset}`;
}

/**
 * Calculate pagination metadata from total count
 * Useful when you already have rows and total
 *
 * @param {number} total - Total count
 * @param {number} page - Current page
 * @param {number} limit - Rows per page
 * @returns {Object} Pagination metadata
 */
function getPaginationMeta(total, page, limit) {
  const totalPages = Math.ceil(total / limit);

  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
    from: (page - 1) * limit + 1,
    to: Math.min(page * limit, total)
  };
}

/**
 * Validate pagination parameters and return errors if invalid
 *
 * @param {number} page - Page number
 * @param {number} limit - Rows per page
 * @param {number} maxLimit - Maximum allowed limit
 * @returns {string|null} Error message or null if valid
 */
function validatePaginationParams(page, limit, maxLimit = 1000) {
  if (page < 1) {
    return 'Page number must be at least 1';
  }

  if (limit < 1) {
    return 'Limit must be at least 1';
  }

  if (limit > maxLimit) {
    return `Limit cannot exceed ${maxLimit}`;
  }

  return null;
}

/**
 * Parse sort parameters from request
 *
 * @param {Object} req - Express request object
 * @param {Array<string>} allowedFields - List of allowed sort fields
 * @param {string} defaultField - Default sort field
 * @param {string} defaultDir - Default sort direction ('asc' or 'desc')
 * @returns {Object} { field, direction, sql }
 */
function buildSort(req, allowedFields = [], defaultField = 'id', defaultDir = 'desc') {
  let field = req.query.sort || defaultField;
  let direction = (req.query.dir || defaultDir).toLowerCase();

  // Validate field is in allowed list
  if (allowedFields.length > 0 && !allowedFields.includes(field)) {
    field = defaultField;
  }

  // Validate direction
  if (!['asc', 'desc'].includes(direction)) {
    direction = defaultDir;
  }

  return {
    field,
    direction,
    sql: `${field} ${direction.toUpperCase()}`
  };
}

// Export all functions
module.exports = {
  buildPagination,
  formatPaginatedResponse,
  buildLimitClause,
  getPaginationMeta,
  validatePaginationParams,
  buildSort
};
