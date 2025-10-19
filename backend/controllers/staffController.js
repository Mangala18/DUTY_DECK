const { buildAccessFilter, verifyStaffAccess } = require('../utils/accessHelper');
const { success, error } = require('../utils/response');

/**
 * Staff Controller
 * Contains business logic for staff management operations
 */

/**
 * Get all venues accessible to the user
 * GET /api/system-admin/staff/venues
 */
exports.getVenues = async (req, res) => {
  const db = require('../config/db');
  const cache = require('../utils/cache');
  const { userContext } = req;

  console.log(`[GET /staff/venues] 👤 User context:`, JSON.stringify(userContext, null, 2));

  // Build cache key based on user context
  const cacheKey = `venues:${userContext.business_code || 'all'}:${userContext.venue_code || 'all'}:${userContext.access_level}`;

  // Try cache first
  const cached = cache.get(cacheKey);
  if (cached) {
    console.log(`[GET /staff/venues] 💾 Cache HIT:`, cacheKey);
    return success(res, cached, { source: 'cache' });
  }

  console.log(`[GET /staff/venues] ❌ Cache MISS:`, cacheKey);

  let query = `
    SELECT
      venue_code,
      venue_name,
      venue_address,
      state,
      status
    FROM venues
    WHERE status = 'active'
  `;

  const params = [];

  // Filter by business
  if (userContext.business_code) {
    query += ' AND business_code = ?';
    params.push(userContext.business_code);
  }

  // Managers and supervisors can only see their own venue
  if (userContext.access_level !== 'system_admin' && userContext.venue_code) {
    query += ' AND venue_code = ?';
    params.push(userContext.venue_code);
  }

  query += ' ORDER BY venue_name ASC';

  console.log(`[GET /staff/venues] 🔍 Query:`, query.trim());
  console.log(`[GET /staff/venues] 📝 Params:`, params);

  try {
    const [results] = await db.execute(query, params);
    console.log(`[GET /staff/venues] ✅ Results count:`, results.length);

    // Cache for 6 hours (21600000 ms) - venues rarely change
    cache.set(cacheKey, results, 21600000);
    console.log(`[GET /staff/venues] 💾 Cached for 6 hours:`, cacheKey);

    return success(res, results, { source: 'database' });
  } catch (err) {
    console.error(`[GET /staff/venues] ❌ Error:`, err.message);
    return error(res, 500, "Failed to fetch venues");
  }
};

/**
 * Get all staff with role-based filtering
 * GET /api/system-admin/staff
 * Query params: page, limit, venue_code, status, sort, dir
 */
exports.getStaffList = async (req, res) => {
  const db = require('../config/db');
  const { buildPagination, formatPaginatedResponse, buildSort } = require('../utils/pagination');
  const { userContext } = req;
  const { venue_code, status } = req.query;

  console.log(`[GET /staff] 👤 User context:`, JSON.stringify(userContext, null, 2));
  console.log(`[GET /staff] 📥 Query params:`, JSON.stringify(req.query, null, 2));

  // Build pagination
  const { page, limit, offset } = buildPagination(req, 100, 1000); // Default 100, max 1000

  // Build sort
  const allowedSortFields = ['created_at', 'last_name', 'first_name', 'employment_status'];
  const sort = buildSort(req, allowedSortFields, 'created_at', 'desc');

  // Build access filter based on user role
  const { conditions, params } = buildAccessFilter(userContext, { venue_code, status });

  console.log(`[GET /staff] 🔐 Access conditions:`, conditions);
  console.log(`[GET /staff] 📄 Pagination: page=${page}, limit=${limit}, offset=${offset}`);
  console.log(`[GET /staff] 🔀 Sort: ${sort.sql}`);

  // Count query
  const countQuery = `
    SELECT COUNT(*) as total
    FROM staff s
    LEFT JOIN venues v ON s.venue_code = v.venue_code
    LEFT JOIN businesses b ON s.business_code = b.business_code
    LEFT JOIN users u ON s.staff_code = u.staff_code
    WHERE ${conditions.join(' AND ')}
  `;

  // Main query with pagination
  // Note: LIMIT and OFFSET cannot be placeholders in MySQL prepared statements
  // So we use safe integer interpolation instead
  const query = `
    SELECT
      s.staff_code,
      CONCAT(s.first_name, ' ', IFNULL(CONCAT(s.middle_name, ' '), ''), s.last_name) AS full_name,
      s.first_name,
      s.middle_name,
      s.last_name,
      s.phone_number,
      s.role_title,
      s.employment_status,
      s.employment_type,
      s.start_date,
      v.venue_name,
      v.venue_code,
      b.business_name,
      b.business_code,
      u.email,
      u.access_level,
      s.created_at
    FROM staff s
    LEFT JOIN venues v ON s.venue_code = v.venue_code
    LEFT JOIN businesses b ON s.business_code = b.business_code
    LEFT JOIN users u ON s.staff_code = u.staff_code
    WHERE ${conditions.join(' AND ')}
    ORDER BY ${sort.sql}
    LIMIT ${Number(limit)} OFFSET ${Number(offset)}
  `;

  console.log(`[GET /staff] 🔍 Query:`, query.trim());

  try {
    // Get total count
    const [[{ total }]] = await db.execute(countQuery, params);
    console.log(`[GET /staff] 📊 Total staff count: ${total}`);

    // Get paginated results (only pass params, not limit/offset since they're now in the SQL string)
    const [results] = await db.execute(query, params);
    console.log(`[GET /staff] ✅ Results count: ${results.length}`);
    console.log(`[GET /staff] ✅ First result sample:`, results[0] ? JSON.stringify(results[0], null, 2) : 'No results');

    return res.json(formatPaginatedResponse(results, total, page, limit));
  } catch (err) {
    console.error(`[GET /staff] ❌ Error:`, err.message);
    return error(res, 500, "Failed to fetch staff");
  }
};

/**
 * Get single staff member details
 * GET /api/system-admin/staff/:staff_code
 */
exports.getStaffDetails = async (req, res) => {
  const db = require('../config/db');
  const { staff_code } = req.params;
  const { userContext } = req;

  // Build access filter to ensure user can only access staff they have permission for
  const { conditions, params } = buildAccessFilter(userContext);

  const query = `
    SELECT
      s.*,
      v.venue_name,
      b.business_name,
      u.email,
      u.access_level,
      u.kiosk_pin,
      pr.weekday_rate,
      pr.saturday_rate,
      pr.sunday_rate,
      pr.public_holiday_rate,
      pr.overtime_rate,
      pr.default_hours,
      sc.account_holder_name,
      sc.bank_name,
      sc.bank_bsb,
      sc.bank_account_number
    FROM staff s
    LEFT JOIN venues v ON s.venue_code = v.venue_code
    LEFT JOIN businesses b ON s.business_code = b.business_code
    LEFT JOIN users u ON s.staff_code = u.staff_code
    LEFT JOIN pay_rates pr ON s.staff_code = pr.staff_code
    LEFT JOIN staff_compliance sc ON s.staff_code = sc.staff_code
    WHERE s.staff_code = ? AND ${conditions.join(' AND ')}
  `;

  params.unshift(staff_code);

  try {
    const [results] = await db.execute(query, params);

    if (results.length === 0) {
      return error(res, 404, "Staff not found or access denied");
    }

    return success(res, results[0]);
  } catch (err) {
    console.error("Error fetching staff:", err);
    return error(res, 500, "Failed to fetch staff");
  }
};

/**
 * Add new staff member
 * POST /api/system-admin/staff
 */
exports.addStaff = async (req, res) => {
  const crypto = require('crypto');
  const db = require('../config/db');
  let connection;

  console.log(`[POST /staff] 📥 Request body:`, JSON.stringify(req.body, null, 2));

  try {
    const {
      business_code, venue_code, staff_code,
      first_name, middle_name, last_name,
      email, phone_number, password,
      access_level, role_title, employment_type,
      start_date,
      weekday_rate, saturday_rate, sunday_rate,
      public_holiday_rate, overtime_rate, default_hours,
      account_holder_name, bank_name, bank_bsb, bank_account_number
    } = req.body;

    // Validate required fields
    if (!business_code || !venue_code || !staff_code || !first_name || !last_name || !email || !password) {
      console.log(`[POST /staff] ❌ Missing required fields`);
      return error(res, 400, 'Missing required fields');
    }

    // Generate kiosk PIN
    const generateKioskPin = () => crypto.randomInt(100000, 999999).toString();

    // Verify venue belongs to the specified business
    console.log(`[POST /staff] 🔍 Validating venue ${venue_code} belongs to business ${business_code}`);
    const [venueCheck] = await db.execute(
      'SELECT 1 FROM venues WHERE venue_code = ? AND business_code = ? LIMIT 1',
      [venue_code, business_code]
    );

    if (!venueCheck || venueCheck.length === 0) {
      console.log(`[POST /staff] ❌ Venue ${venue_code} does not belong to business ${business_code}`);
      return error(res, 400, 'Venue does not belong to the specified business');
    }

    console.log(`[POST /staff] ✅ Venue validated: ${venue_code} belongs to business ${business_code}`);

    // Get database connection for transaction
    console.log(`[POST /staff] 🚀 Attempting to get DB connection for transaction...`);
    connection = await db.getConnection();
    console.log(`[POST /staff] ✅ DB connection acquired`);

    // Begin transaction
    await connection.beginTransaction();
    console.log(`[POST /staff] ✅ Transaction started`);

    // 1. Insert into staff table
    const staffQuery = `
      INSERT INTO staff (
        staff_code, business_code, venue_code,
        first_name, middle_name, last_name,
        phone_number, role_title, employment_status, employment_type,
        staff_type, start_date
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const staffType = 'venue_staff';
    const staffValues = [
      staff_code, business_code, venue_code,
      first_name, middle_name || null, last_name,
      phone_number || null, role_title || 'Staff',
      'active', employment_type || 'full_time',
      staffType, start_date || null
    ];

    console.log(`[POST /staff] 🧾 Executing staff insert with values:`, staffValues);
    const [staffResult] = await connection.execute(staffQuery, staffValues);
    console.log(`[POST /staff] ✅ Staff record inserted:`, staffResult);

    // 2. Insert into pay_rates table
    const payRatesQuery = `
      INSERT INTO pay_rates (
        staff_code, weekday_rate, saturday_rate, sunday_rate,
        public_holiday_rate, overtime_rate, default_hours
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const payRatesValues = [
      staff_code,
      weekday_rate || 0,
      saturday_rate || 0,
      sunday_rate || 0,
      public_holiday_rate || 0,
      overtime_rate || 0,
      default_hours || 38
    ];

    console.log(`[POST /staff] 🧾 Executing pay rates insert:`, payRatesValues);
    const [payRatesResult] = await connection.execute(payRatesQuery, payRatesValues);
    console.log(`[POST /staff] ✅ Pay rates record inserted:`, payRatesResult);

    // 3. Insert into staff_compliance (banking details) if provided
    if (account_holder_name && bank_name && bank_bsb && bank_account_number) {
      const complianceQuery = `
        INSERT INTO staff_compliance (
          staff_code, account_holder_name, bank_name, bank_bsb, bank_account_number
        ) VALUES (?, ?, ?, ?, ?)
      `;

      console.log(`[POST /staff] 🧾 Executing banking details insert`);
      const [complianceResult] = await connection.execute(complianceQuery, [
        staff_code, account_holder_name, bank_name, bank_bsb, bank_account_number
      ]);
      console.log(`[POST /staff] ✅ Banking details record inserted:`, complianceResult);
    } else {
      console.log(`[POST /staff] ⚠️  No banking details provided, skipping`);
    }

    // 4. Insert into users table with unique PIN retry
    let userInserted = false;
    let kiosk_pin;
    let userResult;
    let attemptCount = 0;

    while (!userInserted && attemptCount < 5) {
      try {
        kiosk_pin = generateKioskPin();
        console.log(`[POST /staff] 🧾 Attempting user insert with PIN: ${kiosk_pin} (attempt ${attemptCount + 1})`);

        const userQuery = `
          INSERT INTO users (
            staff_code, email, password_hash, access_level, kiosk_pin, status
          ) VALUES (?, ?, ?, ?, ?, 'active')
        `;

        [userResult] = await connection.execute(userQuery, [
          staff_code, email, password, access_level, kiosk_pin
        ]);

        console.log(`[POST /staff] ✅ User record inserted:`, userResult);
        console.log(`[POST /staff] ✅ User account created with PIN: ${kiosk_pin}`);
        userInserted = true;

      } catch (userErr) {
        if (userErr.code === 'ER_DUP_ENTRY' && userErr.message.includes('kiosk_pin')) {
          console.log(`[POST /staff] ⚠️  PIN collision, retrying... (attempt ${attemptCount + 1})`);
          attemptCount++;
        } else {
          throw userErr; // Re-throw other errors
        }
      }
    }

    if (!userInserted) {
      throw new Error('Failed to generate unique kiosk PIN after 5 attempts');
    }

    // Commit transaction
    console.log(`[POST /staff] 🔄 Committing transaction...`);
    await connection.commit();
    console.log(`[POST /staff] ✅ Transaction committed successfully`);

    // Invalidate staff and kiosk caches
    const cache = require('../utils/cache');
    cache.invalidate('staff:');
    cache.invalidate('kiosk:staff:');
    console.log(`[POST /staff] 💾 Invalidated staff caches`);

    const response = {
      success: true,
      message: 'Staff member created successfully',
      staff: { staff_code, full_name: `${first_name} ${last_name}` },
      user: { user_id: userResult.insertId, email, kiosk_pin }
    };

    console.log(`[POST /staff] ✅ Sending response:`, JSON.stringify(response, null, 2));
    return success(res, response);

  } catch (err) {
    console.error(`[POST /staff] ❌ Error in addStaff transaction:`, err.message);
    console.error(`[POST /staff] ❌ Error stack:`, err.stack);

    if (connection) {
      console.log(`[POST /staff] 🔄 Rolling back transaction...`);
      await connection.rollback();
      console.log(`[POST /staff] ✅ Transaction rolled back`);
    }

    // Handle specific error codes
    if (err.code === 'ER_DUP_ENTRY') {
      if (err.message.includes('staff_code')) {
        return error(res, 409, 'Staff code already exists');
      } else if (err.message.includes('email')) {
        return error(res, 409, 'Email already exists');
      }
      return error(res, 409, 'Duplicate entry');
    }

    if (err.code === 'ER_NO_DEFAULT_FOR_FIELD') {
      return error(res, 500, `Database schema error: ${err.message}`);
    }

    return error(res, 500, err.message || 'Failed to create staff member');

  } finally {
    if (connection) {
      connection.release();
      console.log(`[POST /staff] 🔌 Connection released`);
    }
  }
};

exports.updateStaff = (req, res) => {
  // TODO: Implement full update staff logic with transactions
  error(res, 501, "Update staff not yet implemented in controller");
};

exports.deleteStaff = (req, res) => {
  // TODO: Implement full delete staff logic
  error(res, 501, "Delete staff not yet implemented in controller");
};
