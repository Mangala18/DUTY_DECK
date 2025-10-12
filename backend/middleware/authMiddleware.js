/**
 * Authentication and Authorization Middleware
 * Handles role-based access control for staff management endpoints
 */

/**
 * Middleware to verify user has permission to manage staff
 * Allowed roles: system_admin, manager, supervisor
 *
 * Sets req.userContext with user's access level, business code, and venue code
 */
function requireStaffManagementAccess(req, res, next) {
  // In a real application, you would get this from session/JWT token
  // For now, we'll expect it to be passed in headers or body
  const { user_access_level, user_business_code, user_venue_code } = req.headers;

  if (!user_access_level) {
    return res.status(401).json({
      success: false,
      error: "Unauthorized: Access level required"
    });
  }

  // Check if user has staff management permissions
  const allowedRoles = ['system_admin', 'manager', 'supervisor'];
  if (!allowedRoles.includes(user_access_level)) {
    return res.status(403).json({
      success: false,
      error: "Forbidden: Insufficient permissions to manage staff"
    });
  }

  // Attach user context to request for use in route handlers
  req.userContext = {
    access_level: user_access_level,
    business_code: user_business_code,
    venue_code: user_venue_code
  };

  next();
}

module.exports = {
  requireStaffManagementAccess
};
