const express = require("express");
const staffRoutes = require("./staffRoutes");
const router = express.Router();

// ============================
// MIDDLEWARE - Auto-inject System Admin Context
// ============================

/**
 * Middleware to automatically set system admin context from query params/body
 * This allows legacy /api/system-admin/ routes to work seamlessly with shared staffRoutes
 *
 * The middleware extracts business_code and venue_code from the request and injects them
 * as headers so the shared staffRoutes can process them with system_admin privileges
 */
function injectSystemAdminContext(req, res, next) {
  // Extract business_code and venue_code from query params, body, or headers
  const business_code = req.query.business_code || req.body.business_code || req.headers['user_business_code'];
  const venue_code = req.query.venue_code || req.body.venue_code || req.headers['user_venue_code'];

  // Set headers for staffRoutes middleware to consume
  req.headers['user_access_level'] = req.headers['user_access_level'] || 'system_admin';

  // Fallback: if business_code is not provided, use a default or log a warning
  if (business_code) {
    req.headers['user_business_code'] = business_code;
  } else {
    console.warn('⚠️  No business_code provided in system admin context. Some operations may fail.');
  }

  if (venue_code) {
    req.headers['user_venue_code'] = venue_code;
  }

  next();
}

// Apply middleware to all system admin routes
router.use(injectSystemAdminContext);

// ============================
// DELEGATE TO SHARED STAFF ROUTES
// ============================

/**
 * All staff management routes are now handled by the shared staffRoutes module
 * This eliminates code duplication and ensures consistency across all user roles
 *
 * Benefits:
 * - Single source of truth for staff management logic
 * - Easier to maintain and update
 * - Consistent behavior across system admin, manager, and supervisor roles
 * - Automatic role-based access control
 */

// Use the shared staff router for all staff-related endpoints
router.use("/staff", staffRoutes);

// ============================
// SYSTEM ADMIN SPECIFIC ENDPOINTS
// ============================

// Add any system-admin-specific endpoints here that don't fit the shared staff model
// Example: System-wide reports, bulk operations, etc.

module.exports = router;
