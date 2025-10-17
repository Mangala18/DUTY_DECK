/**
 * Timesheet Controller
 * Handles timesheet-related operations (based on shifts table)
 */

const db = require('../config/db');

/**
 * Get staff list with timesheet summaries
 * @route GET /api/system-admin/timesheets/staff
 * @query {string} filter - Status filter (ALL, PENDING, APPROVED, DISCARDED)
 * @query {string} from - Start date filter (YYYY-MM-DD)
 * @query {string} to - End date filter (YYYY-MM-DD)
 */
exports.getTimesheetStaff = async (req, res) => {
  try {
    const { filter = 'ALL', from, to } = req.query;
    const { userContext } = req;

    console.log('Fetching timesheet staff summary with filters:', { filter, from, to });

    // Get business_code from query params (GET request) or authenticated user context
    const business_code = req.query.business_code || userContext?.business_code;

    if (!business_code) {
      return res.status(400).json({
        success: false,
        error: 'Missing business context. Please log in again.'
      });
    }

    const params = [business_code];
    let where = 't.clock_out IS NOT NULL AND v.business_code = ?';

    // Apply status filter
    if (filter && filter !== 'ALL') {
      where += ' AND t.approval_status = ?';
      params.push(filter);
    }

    // Apply date range filter (skip empty strings)
    if (from && from.trim() !== '') {
      where += ' AND DATE(t.clock_in) >= ?';
      params.push(from);
    }

    if (to && to.trim() !== '') {
      where += ' AND DATE(t.clock_out) <= ?';
      params.push(to);
    }

    const sql = `
      SELECT
        s.staff_code,
        CONCAT(s.first_name, ' ', s.last_name) AS name,
        COUNT(t.id) AS total_shifts,
        SUM(t.hours_worked) AS total_hours,
        SUM(t.total_pay) AS total_pay,
        SUM(IFNULL(t.break_minutes, 0)) AS total_break_minutes,
        MAX(t.approval_status) AS approval_status
      FROM shifts t
      JOIN staff s ON s.staff_code = t.staff_code
      JOIN venues v ON v.venue_code = t.venue_code
      WHERE ${where}
      GROUP BY s.staff_code, s.first_name, s.last_name
      ORDER BY s.first_name ASC
    `;

    const [rows] = await db.execute(sql, params);

    console.log(`Found ${rows.length} staff with timesheets`);

    res.json({
      success: true,
      data: rows,
      count: rows.length
    });

  } catch (error) {
    console.error('Error fetching timesheet staff:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch timesheet staff',
      message: error.message
    });
  }
};

/**
 * Get timesheets for a specific staff member
 * @route GET /api/system-admin/timesheets
 * @query {string} staff_code - Staff code to fetch timesheets for
 * @query {string} filter - Status filter (ALL, PENDING, APPROVED, DISCARDED)
 * @query {string} from - Start date filter (YYYY-MM-DD)
 * @query {string} to - End date filter (YYYY-MM-DD)
 */
exports.getStaffTimesheets = async (req, res) => {
  try {
    const { staff_code, filter = 'ALL', from, to } = req.query;
    const { userContext } = req;

    if (!staff_code) {
      return res.status(400).json({
        success: false,
        error: 'Missing staff_code parameter'
      });
    }

    // Get business_code from query params (GET request) or authenticated user context
    const business_code = req.query.business_code || userContext?.business_code;

    if (!business_code) {
      return res.status(400).json({
        success: false,
        error: 'Missing business context. Please log in again.'
      });
    }

    console.log('Fetching timesheets for staff_code:', staff_code, 'with filters:', { filter, from, to });

    const params = [staff_code, business_code];
    let where = 't.staff_code = ? AND t.clock_out IS NOT NULL AND v.business_code = ?';

    // Apply status filter
    if (filter && filter !== 'ALL') {
      where += ' AND t.approval_status = ?';
      params.push(filter);
    }

    // Apply date range filter (skip empty strings)
    if (from && from.trim() !== '') {
      where += ' AND DATE(t.clock_in) >= ?';
      params.push(from);
    }

    if (to && to.trim() !== '') {
      where += ' AND DATE(t.clock_out) <= ?';
      params.push(to);
    }

    const sql = `
      SELECT
        t.id,
        t.clock_in,
        t.clock_out,
        t.hours_worked,
        t.break_minutes,
        t.total_pay,
        t.approval_status AS status,
        t.payday_type,
        v.venue_name,
        st.role_title
      FROM shifts t
      JOIN venues v ON v.venue_code = t.venue_code
      JOIN staff st ON st.staff_code = t.staff_code
      WHERE ${where}
      ORDER BY t.clock_in DESC
      LIMIT 100
    `;

    const [rows] = await db.execute(sql, params);

    console.log(`Found ${rows.length} timesheets for ${staff_code}`);

    res.json({
      success: true,
      data: rows,
      count: rows.length
    });

  } catch (error) {
    console.error('Error fetching timesheets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch timesheets',
      message: error.message
    });
  }
};

/**
 * Get timesheets filtered by date range
 * @route GET /api/system-admin/timesheets/range
 * @query {string} staff_code - Staff code (optional, for specific staff)
 * @query {string} start_date - Start date (YYYY-MM-DD)
 * @query {string} end_date - End date (YYYY-MM-DD)
 */
exports.getTimesheetsByDateRange = async (req, res) => {
  try {
    const { staff_code, start_date, end_date } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters: start_date, end_date'
      });
    }

    console.log('Fetching timesheets for range:', { staff_code, start_date, end_date });

    let query = `
      SELECT
        s.id,
        s.staff_code,
        CONCAT(st.first_name, ' ', st.last_name) AS staff_name,
        s.clock_in,
        s.clock_out,
        DATE(s.clock_in) AS shift_date,
        s.hours_worked,
        s.total_pay,
        s.approval_status AS status,
        s.payday_type,
        v.venue_name,
        st.role_title
      FROM shifts s
      INNER JOIN venues v ON s.venue_code = v.venue_code
      INNER JOIN staff st ON s.staff_code = st.staff_code
      WHERE s.clock_out IS NOT NULL
        AND DATE(s.clock_in) BETWEEN ? AND ?
    `;

    const params = [start_date, end_date];

    if (staff_code) {
      query += ' AND s.staff_code = ?';
      params.push(staff_code);
    }

    query += ' ORDER BY s.clock_in DESC LIMIT 500';

    const [rows] = await db.execute(query, params);

    console.log(`Found ${rows.length} timesheets in range`);

    res.json({
      success: true,
      data: rows,
      count: rows.length,
      range: { start_date, end_date }
    });

  } catch (error) {
    console.error('Error fetching timesheets by range:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch timesheets',
      message: error.message
    });
  }
};

/**
 * Bulk update timesheet approval status
 * @route PUT /api/system-admin/timesheets/bulk-update
 * @body {array} ids - Array of shift IDs to update
 * @body {string} status - New status (APPROVED or DISCARDED)
 */
exports.bulkUpdateTimesheets = async (req, res) => {
  try {
    const { ids, status } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing or invalid ids array'
      });
    }

    if (!status || !['APPROVED', 'DISCARDED'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be APPROVED or DISCARDED'
      });
    }

    console.log(`Bulk updating ${ids.length} timesheets to ${status}`);

    // Create placeholders for the IN clause
    const placeholders = ids.map(() => '?').join(',');

    const query = `
      UPDATE shifts
      SET approval_status = ?
      WHERE id IN (${placeholders})
    `;

    const params = [status, ...ids];

    const [result] = await db.execute(query, params);

    console.log(`Updated ${result.affectedRows} timesheets`);

    res.json({
      success: true,
      message: `Successfully updated ${result.affectedRows} timesheet(s)`,
      updated: result.affectedRows
    });

  } catch (error) {
    console.error('Error bulk updating timesheets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update timesheets',
      message: error.message
    });
  }
};

/**
 * Export timesheets to CSV format
 * @route GET /api/system-admin/timesheets/export
 * @query {string} staff_code - Staff code to export
 * @query {string} filter - Status filter (ALL, PENDING, APPROVED, DISCARDED)
 * @query {string} from - Start date filter (YYYY-MM-DD)
 * @query {string} to - End date filter (YYYY-MM-DD)
 */
exports.exportTimesheetsCSV = async (req, res) => {
  try {
    const { staff_code, filter = 'ALL', from, to } = req.query;
    const { userContext } = req;

    if (!staff_code) {
      return res.status(400).json({
        success: false,
        error: 'Missing staff_code parameter'
      });
    }

    // Get business_code from query params (GET request) or authenticated user context
    const business_code = req.query.business_code || userContext?.business_code;

    if (!business_code) {
      return res.status(400).json({
        success: false,
        error: 'Missing business context. Please log in again.'
      });
    }

    console.log('Exporting timesheets for staff_code:', staff_code, 'with filters:', { filter, from, to });

    let query = `
      SELECT
        s.id,
        s.staff_code,
        CONCAT(st.first_name, ' ', st.last_name) AS staff_name,
        s.clock_in,
        s.clock_out,
        DATE(s.clock_in) AS shift_date,
        s.hours_worked,
        s.total_pay,
        s.approval_status,
        s.payday_type,
        v.venue_name,
        v.venue_code,
        st.role_title
      FROM shifts s
      INNER JOIN venues v ON s.venue_code = v.venue_code
      INNER JOIN staff st ON s.staff_code = st.staff_code
      WHERE s.staff_code = ?
        AND s.clock_out IS NOT NULL
        AND v.business_code = ?
    `;

    const params = [staff_code, business_code];

    // Apply status filter
    if (filter && filter !== 'ALL') {
      query += ' AND s.approval_status = ?';
      params.push(filter);
    }

    // Apply date range filter
    if (from) {
      query += ' AND DATE(s.clock_in) >= ?';
      params.push(from);
    }

    if (to) {
      query += ' AND DATE(s.clock_in) <= ?';
      params.push(to);
    }

    query += ' ORDER BY s.clock_in DESC';

    const [rows] = await db.execute(query, params);

    console.log(`Exporting ${rows.length} timesheets to CSV`);

    // Generate CSV
    const headers = [
      'ID',
      'Staff Code',
      'Staff Name',
      'Shift Date',
      'Clock In',
      'Clock Out',
      'Hours Worked',
      'Total Pay',
      'Status',
      'Payday Type',
      'Venue Name',
      'Venue Code',
      'Role'
    ];

    let csv = headers.join(',') + '\n';

    rows.forEach(row => {
      const line = [
        row.id,
        row.staff_code,
        `"${row.staff_name}"`,
        row.shift_date,
        row.clock_in,
        row.clock_out,
        row.hours_worked,
        row.total_pay,
        row.approval_status,
        row.payday_type,
        `"${row.venue_name}"`,
        row.venue_code,
        row.role_title ? `"${row.role_title}"` : '""'
      ];
      csv += line.join(',') + '\n';
    });

    res.json({
      success: true,
      csv: csv,
      count: rows.length
    });

  } catch (error) {
    console.error('Error exporting timesheets:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export timesheets',
      message: error.message
    });
  }
};

/**
 * Get a single timesheet by ID
 * @route GET /api/system-admin/timesheets/:id
 * @param {number} id - Timesheet (shift) ID
 */
exports.getTimesheetById = async (req, res) => {
  try {
    const { id } = req.params;

    console.log('Fetching timesheet by ID:', id);

    const sql = `
      SELECT
        t.id,
        t.staff_code,
        CONCAT(s.first_name, ' ', s.last_name) AS staff_name,
        v.venue_name,
        t.clock_in,
        t.clock_out,
        t.break_minutes,
        t.hours_worked,
        t.total_pay,
        t.approval_status,
        t.payday_type
      FROM shifts t
      JOIN staff s ON s.staff_code = t.staff_code
      JOIN venues v ON v.venue_code = t.venue_code
      WHERE t.id = ?
    `;

    const [rows] = await db.execute(sql, [id]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Timesheet not found'
      });
    }

    res.json({
      success: true,
      data: rows[0]
    });

  } catch (error) {
    console.error('getTimesheetById error:', error);
    res.status(500).json({
      success: false,
      error: 'Fetch failed',
      message: error.message
    });
  }
};

/**
 * Update a single timesheet
 * @route PATCH /api/system-admin/timesheets/:id
 * @param {number} id - Timesheet (shift) ID
 * @body {string} clock_in - Clock in datetime
 * @body {string} clock_out - Clock out datetime
 * @body {number} total_pay - Total pay amount
 */
exports.updateTimesheet = async (req, res) => {
  try {
    const { id } = req.params;
    const { clock_in, clock_out, total_pay } = req.body;

    console.log('Updating timesheet:', { id, clock_in, clock_out, total_pay });

    // Update the shift with new values and recalculate hours_worked
    await db.execute(
      `UPDATE shifts
       SET clock_in = ?,
           clock_out = ?,
           total_pay = ?,
           hours_worked = TIMESTAMPDIFF(MINUTE, ?, ?) / 60
       WHERE id = ?`,
      [clock_in, clock_out, total_pay, clock_in, clock_out, id]
    );

    console.log(`Timesheet ${id} updated successfully`);

    res.json({
      success: true,
      message: 'Timesheet updated successfully'
    });

  } catch (error) {
    console.error('updateTimesheet error:', error);
    res.status(500).json({
      success: false,
      error: 'Update failed',
      message: error.message
    });
  }
};
