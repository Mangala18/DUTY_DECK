const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Dashboard metrics for System Admin
router.get('/', async (req, res) => {
  try {
    const [staffCount] = await db.promise().query(`
      SELECT COUNT(*) AS totalStaff
      FROM staff
      WHERE employment_status != 'terminated'
    `);

    const [activeShifts] = await db.promise().query(`
      SELECT COUNT(*) AS activeShifts
      FROM shifts
      WHERE shift_state = 'ACTIVE'
    `);

    const [todayHours] = await db.promise().query(`
      SELECT IFNULL(ROUND(SUM(hours_worked), 2), 0) AS todayHours
      FROM shifts
      WHERE DATE(clock_in) = CURDATE()
        AND shift_state = 'COMPLETED'
    `);

    const [weekTotal] = await db.promise().query(`
      SELECT IFNULL(ROUND(SUM(hours_worked), 2), 0) AS weekTotal
      FROM shifts
      WHERE YEARWEEK(clock_in, 1) = YEARWEEK(CURDATE(), 1)
        AND shift_state = 'COMPLETED'
    `);

    res.json({
      totalStaff: staffCount[0].totalStaff,
      activeShifts: activeShifts[0].activeShifts,
      todayHours: todayHours[0].todayHours,
      weekTotal: weekTotal[0].weekTotal
    });
  } catch (error) {
    console.error('❌ Dashboard error:', error);
    res.status(500).json({ success: false, error: 'Failed to load dashboard metrics' });
  }
});

module.exports = router;