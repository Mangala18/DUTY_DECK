/**
 * Schedule Controller
 * Handles schedule-related operations for staff members
 */

const db = require('../config/db');

/**
 * Get user's schedule/shifts
 * @route GET /api/system-admin/schedules
 * @query {string} staff_code - Staff code to fetch schedule for
 */
exports.getUserSchedule = async (req, res) => {
  try {
    const { staff_code } = req.query;

    if (!staff_code) {
      return res.status(400).json({
        success: false,
        error: 'Missing staff_code parameter'
      });
    }

    console.log('Fetching schedule for staff_code:', staff_code);

    // Query to get upcoming scheduled shifts (from rosters table)
    const [rows] = await db.execute(
      `SELECT
        r.id as roster_id,
        r.shift_date,
        r.start_time,
        r.end_time,
        v.venue_name,
        v.venue_code,
        v.state,
        v.venue_address,
        v.status
       FROM rosters r
       INNER JOIN venues v ON r.venue_code = v.venue_code
       WHERE r.staff_code = ?
         AND r.shift_date >= CURDATE()
       ORDER BY r.shift_date ASC, r.start_time ASC
       LIMIT 50`,
      [staff_code]
    );

    console.log(`Found ${rows.length} upcoming scheduled shifts for ${staff_code}`);

    res.json({
      success: true,
      data: rows,
      count: rows.length
    });

  } catch (error) {
    console.error('Error fetching schedule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch schedule',
      message: error.message
    });
  }
};

/**
 * Get schedule for a specific date range
 * @route GET /api/system-admin/schedules/range
 * @query {string} staff_code - Staff code
 * @query {string} start_date - Start date (YYYY-MM-DD)
 * @query {string} end_date - End date (YYYY-MM-DD)
 */
exports.getScheduleByDateRange = async (req, res) => {
  try {
    const { staff_code, start_date, end_date } = req.query;

    if (!staff_code || !start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: staff_code, start_date, end_date'
      });
    }

    console.log('Fetching schedule range:', { staff_code, start_date, end_date });

    const [rows] = await db.execute(
      `SELECT
        r.id as roster_id,
        r.shift_date,
        r.start_time,
        r.end_time,
        v.venue_name,
        v.venue_code,
        v.state,
        v.venue_address,
        v.status
       FROM rosters r
       INNER JOIN venues v ON r.venue_code = v.venue_code
       WHERE r.staff_code = ?
         AND r.shift_date BETWEEN ? AND ?
       ORDER BY r.shift_date ASC, r.start_time ASC`,
      [staff_code, start_date, end_date]
    );

    res.json({
      success: true,
      data: rows,
      count: rows.length,
      range: { start_date, end_date }
    });

  } catch (error) {
    console.error('Error fetching schedule range:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch schedule range',
      message: error.message
    });
  }
};
