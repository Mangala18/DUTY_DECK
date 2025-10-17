const express = require('express');
const router = express.Router();
const db = require('../config/db');
const { requireStaffManagementAccess } = require('../middleware/authMiddleware');

// Dashboard metrics for System Admin/Manager/Supervisor
router.get('/', requireStaffManagementAccess, async (req, res) => {
  try {
    // Get user context from auth middleware
    const { userContext } = req;
    const businessCode = userContext?.business_code;
    const venueCode = userContext?.venue_code;
    const accessLevel = userContext?.access_level;

    console.log('📊 Dashboard request:', { businessCode, venueCode, accessLevel });

    if (!businessCode) {
      return res.status(400).json({
        success: false,
        error: 'Business context required'
      });
    }

    // Build WHERE clause based on access level
    let staffWhere = `business_code = ? AND employment_status != 'terminated'`;
    let shiftsWhere = `s.staff_code IN (SELECT staff_code FROM staff WHERE business_code = ?)`;
    const params = [businessCode];

    // For managers/supervisors, filter by their venue
    if (accessLevel !== 'system_admin' && venueCode) {
      staffWhere += ` AND venue_code = ?`;
      shiftsWhere += ` AND s.venue_code = ?`;
      params.push(venueCode);
    }

    console.log('📊 Staff WHERE:', staffWhere);
    console.log('📊 Shifts WHERE:', shiftsWhere);
    console.log('📊 Params:', params);

    // Count total staff in business/venue
    const [staffCount] = await db.execute(
      `SELECT COUNT(*) AS totalStaff FROM staff WHERE ${staffWhere}`,
      params
    );

    // Count active shifts
    const shiftsParams = accessLevel !== 'system_admin' && venueCode
      ? [businessCode, venueCode]
      : [businessCode];

    const [activeShifts] = await db.execute(
      `SELECT COUNT(*) AS activeShifts
       FROM shifts s
       WHERE ${shiftsWhere}
         AND s.shift_state IN ('ACTIVE', 'ON_BREAK')`,
      shiftsParams
    );

    // Calculate today's hours
    const [todayHours] = await db.execute(
      `SELECT IFNULL(ROUND(SUM(s.hours_worked), 2), 0) AS todayHours
       FROM shifts s
       WHERE ${shiftsWhere}
         AND DATE(s.clock_in) = CURDATE()
         AND s.shift_state = 'COMPLETED'`,
      shiftsParams
    );

    // Calculate week total hours
    const [weekTotal] = await db.execute(
      `SELECT IFNULL(ROUND(SUM(s.hours_worked), 2), 0) AS weekTotal
       FROM shifts s
       WHERE ${shiftsWhere}
         AND YEARWEEK(s.clock_in, 1) = YEARWEEK(CURDATE(), 1)
         AND s.shift_state = 'COMPLETED'`,
      shiftsParams
    );

    const result = {
      totalStaff: staffCount[0].totalStaff,
      activeShifts: activeShifts[0].activeShifts,
      todayHours: todayHours[0].todayHours,
      weekTotal: weekTotal[0].weekTotal,
      businessCode,
      venueCode: venueCode || null,
      accessLevel
    };

    console.log('📊 Dashboard metrics:', result);

    res.json(result);
  } catch (error) {
    console.error('❌ Dashboard error:', error);
    res.status(500).json({ success: false, error: 'Failed to load dashboard metrics' });
  }
});

module.exports = router;