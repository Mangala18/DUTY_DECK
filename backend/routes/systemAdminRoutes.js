const express = require("express");
const staffRoutes = require("./staffRoutes");
const { addVenue, updateVenue, deleteVenue, getVenueByCode } = require("../controllers/venueController");
const { getUserSchedule, getScheduleByDateRange } = require("../controllers/scheduleController");
const { getTimesheetStaff, getStaffTimesheets, getTimesheetsByDateRange, bulkUpdateTimesheets, exportTimesheetsCSV, getTimesheetById, updateTimesheet } = require("../controllers/timesheetController");
const { getPayrollStaffSummary, getPayrollBreakdown } = require("../controllers/payrollController");
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
  let business_code = req.query.business_code || req.body.business_code || req.headers['user_business_code'];
  let venue_code = req.query.venue_code || req.body.venue_code || req.headers['user_venue_code'];

  // Sanitize: treat "null", "undefined" strings as actual null/undefined
  if (business_code === 'null' || business_code === 'undefined') {
    business_code = null;
  }
  if (venue_code === 'null' || venue_code === 'undefined') {
    venue_code = null;
  }

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

// ============================
// VENUE MANAGEMENT ROUTES
// ============================

/**
 * Venue Management Endpoints
 * - POST   /api/system-admin/venues              Create a new venue
 * - GET    /api/system-admin/venues/:code        Get single venue details
 * - PUT    /api/system-admin/venues/:code        Update an existing venue
 * - DELETE /api/system-admin/venues/:code        Delete a venue
 * - GET    /api/system-admin/staff/venues        List all venues (handled by staffRoutes)
 */

router.post("/venues", addVenue);
router.get("/venues/:venue_code", getVenueByCode);
router.put("/venues/:venue_code", updateVenue);
router.delete("/venues/:venue_code", deleteVenue);

// ============================
// SCHEDULE MANAGEMENT ROUTES
// ============================

/**
 * Schedule Management Endpoints
 * - GET /api/system-admin/schedules              Get user's upcoming shifts
 * - GET /api/system-admin/schedules/range        Get shifts for a date range
 */

router.get("/schedules", getUserSchedule);
router.get("/schedules/range", getScheduleByDateRange);

// ============================
// TIMESHEET MANAGEMENT ROUTES
// ============================

/**
 * Timesheet Management Endpoints
 * - GET   /api/system-admin/timesheets/staff         Get staff list with timesheet summaries
 * - GET   /api/system-admin/timesheets               Get timesheets for a specific staff member
 * - GET   /api/system-admin/timesheets/range         Get timesheets by date range
 * - GET   /api/system-admin/timesheets/:id           Get single timesheet by ID
 * - PUT   /api/system-admin/timesheets/bulk-update   Bulk update timesheet approval status
 * - PATCH /api/system-admin/timesheets/:id           Update single timesheet
 * - GET   /api/system-admin/timesheets/export        Export timesheets to CSV
 */

router.get("/timesheets/staff", getTimesheetStaff);
router.get("/timesheets/range", getTimesheetsByDateRange);
router.get("/timesheets/export", exportTimesheetsCSV);
router.put("/timesheets/bulk-update", bulkUpdateTimesheets);
router.get("/timesheets/:id", getTimesheetById);
router.patch("/timesheets/:id", updateTimesheet);
router.get("/timesheets", getStaffTimesheets);

// ============================
// PAYROLL MANAGEMENT ROUTES
// ============================

/**
 * Payroll Management Endpoints
 * - GET /api/system-admin/payroll/staff         Get staff payroll summary (approved shifts)
 * - GET /api/system-admin/payroll/breakdown     Get detailed payroll breakdown for one staff
 */

router.get("/payroll/staff", getPayrollStaffSummary);
router.get("/payroll/breakdown", getPayrollBreakdown);

module.exports = router;
