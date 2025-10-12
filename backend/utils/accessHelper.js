const db = require('../config/db');

/**
 * Helper function to build WHERE clause based on user role
 *
 * @param {Object} userContext - User's access context (access_level, business_code, venue_code)
 * @param {Object} filters - Additional filters (venue_code, status)
 * @returns {Object} - { conditions: Array, params: Array }
 */
function buildAccessFilter(userContext, filters = {}) {
  const conditions = [];
  const params = [];

  // System admins can see all venue staff in their business
  // Managers can only see staff in their venue
  // Supervisors can only see staff in their venue

  if (userContext.access_level === 'system_admin') {
    // System admin: filter by business, all venues
    if (userContext.business_code) {
      conditions.push('s.business_code = ?');
      params.push(userContext.business_code);
    }
  } else if (userContext.access_level === 'manager' || userContext.access_level === 'supervisor') {
    // Manager/Supervisor: filter by their specific venue
    if (userContext.venue_code) {
      conditions.push('s.venue_code = ?');
      params.push(userContext.venue_code);
    }
    if (userContext.business_code) {
      conditions.push('s.business_code = ?');
      params.push(userContext.business_code);
    }
  }

  // Always exclude system admins from the list (only show venue_staff)
  conditions.push("s.staff_type = 'venue_staff'");

  // Apply additional filters
  if (filters.venue_code && filters.venue_code !== 'all') {
    conditions.push('s.venue_code = ?');
    params.push(filters.venue_code);
  }

  if (filters.status && filters.status !== 'all') {
    conditions.push('s.employment_status = ?');
    params.push(filters.status);
  }

  return { conditions, params };
}

/**
 * Helper to verify user has access to a staff member
 *
 * @param {String} staff_code - Staff code to check access for
 * @param {Object} userContext - User's access context
 * @param {Function} callback - Callback(err, result)
 */
function verifyStaffAccess(staff_code, userContext, callback) {
  const { conditions, params } = buildAccessFilter(userContext);
  const checkQuery = `SELECT venue_code FROM staff WHERE staff_code = ? AND ${conditions.join(' AND ')}`;
  params.unshift(staff_code);

  db.query(checkQuery, params, (err, results) => {
    if (err) {
      return callback(err, null);
    }
    if (results.length === 0) {
      return callback(new Error('Access denied'), null);
    }
    callback(null, results[0]);
  });
}

module.exports = {
  buildAccessFilter,
  verifyStaffAccess
};
