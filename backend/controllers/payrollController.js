const db = require('../config/db');

/**
 * Get payroll summary for all staff with approved shifts
 * Groups by staff and shows total hours, pay, and shifts
 *
 * @route GET /api/system-admin/payroll/staff
 * @query {string} from - Start date (YYYY-MM-DD)
 * @query {string} to - End date (YYYY-MM-DD)
 */
const getPayrollStaffSummary = async (req, res) => {
  try {
    console.log('Fetching payroll summary with filters:', req.query);

    const { from, to } = req.query;
    const { userContext } = req;

    // Get business_code from query params (GET request) or authenticated user context
    const business_code = req.query.business_code || userContext?.business_code;

    if (!business_code || business_code.trim() === '') {
      console.warn('[Payroll] Missing business_code in request. userContext:', userContext);
      return res.status(400).json({
        success: false,
        error: 'Missing business_code parameter'
      });
    }

    // Validate business_code exists in database
    const [checkBusiness] = await db.execute(
      'SELECT business_code FROM businesses WHERE business_code = ? LIMIT 1',
      [business_code]
    );

    if (!checkBusiness.length) {
      console.warn('[Payroll] Invalid business_code value:', business_code);
      return res.status(400).json({
        success: false,
        error: `Invalid business_code: ${business_code}`
      });
    }

    console.log('[Payroll] ✅ Business validated:', business_code);

    const params = [business_code];
    let where = "t.clock_out IS NOT NULL AND t.approval_status = 'APPROVED' AND v.business_code = ?";

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
        SUM(IFNULL(t.break_minutes, 0)) AS total_break_minutes
      FROM shifts t
      JOIN staff s ON s.staff_code = t.staff_code
      JOIN venues v ON v.venue_code = t.venue_code
      WHERE ${where}
      GROUP BY s.staff_code, s.first_name, s.last_name
      ORDER BY s.first_name ASC
    `;

    console.log('Executing SQL:', sql);
    console.log('With params:', params);

    const [rows] = await db.execute(sql, params);
    console.log('Query successful, returning', rows.length, 'rows');
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching payroll summary:', error.message);
    console.error('Full error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

/**
 * Get detailed payroll breakdown for a single staff member
 * Shows individual shift details for approved shifts
 *
 * @route GET /api/system-admin/payroll/breakdown
 * @query {string} staff_code - Staff code to get breakdown for
 * @query {string} from - Start date (YYYY-MM-DD)
 * @query {string} to - End date (YYYY-MM-DD)
 */
const getPayrollBreakdown = async (req, res) => {
  try {
    console.log('Fetching payroll breakdown with filters:', req.query);

    const { staff_code, from, to } = req.query;
    const { userContext } = req;

    if (!staff_code) {
      return res.status(400).json({ success: false, error: 'staff_code is required' });
    }

    // Get business_code from query params (GET request) or authenticated user context
    const business_code = req.query.business_code || userContext?.business_code;

    if (!business_code || business_code.trim() === '') {
      console.warn('[Payroll Breakdown] Missing business_code in request. userContext:', userContext);
      return res.status(400).json({
        success: false,
        error: 'Missing business_code parameter'
      });
    }

    // Validate business_code exists in database
    const [checkBusiness] = await db.execute(
      'SELECT business_code FROM businesses WHERE business_code = ? LIMIT 1',
      [business_code]
    );

    if (!checkBusiness.length) {
      console.warn('[Payroll Breakdown] Invalid business_code value:', business_code);
      return res.status(400).json({
        success: false,
        error: `Invalid business_code: ${business_code}`
      });
    }

    console.log('[Payroll Breakdown] ✅ Business validated:', business_code);

    const params = [staff_code, business_code];
    let where = "t.staff_code = ? AND t.clock_out IS NOT NULL AND t.approval_status = 'APPROVED' AND v.business_code = ?";

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
        DATE(t.clock_in) AS shift_date,
        TIME(t.clock_in) AS start_time,
        TIME(t.clock_out) AS end_time,
        t.break_minutes,
        t.hours_worked,
        t.total_pay,
        v.venue_name
      FROM shifts t
      JOIN venues v ON v.venue_code = t.venue_code
      WHERE ${where}
      ORDER BY t.clock_in ASC
    `;

    console.log('Executing SQL:', sql);
    console.log('With params:', params);

    const [rows] = await db.execute(sql, params);
    console.log('Query successful, returning', rows.length, 'rows');
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching payroll breakdown:', error.message);
    console.error('Full error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
};

module.exports = {
  getPayrollStaffSummary,
  getPayrollBreakdown
};
