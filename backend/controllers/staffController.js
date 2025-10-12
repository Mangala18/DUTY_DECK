const staffModel = require('../models/staffModel');
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
exports.getVenues = (req, res) => {
  const { userContext } = req;

  console.log(`[GET /staff/venues] 👤 User context:`, JSON.stringify(userContext, null, 2));

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

  staffModel.getVenues(query, params, (err, results) => {
    if (err) {
      console.error(`[GET /staff/venues] ❌ Error:`, err.message);
      return error(res, 500, "Failed to fetch venues");
    }
    console.log(`[GET /staff/venues] ✅ Results count:`, results.length);
    return success(res, results);
  });
};

/**
 * Get all staff with role-based filtering
 * GET /api/system-admin/staff
 */
exports.getStaffList = (req, res) => {
  const { userContext } = req;
  const { venue_code, status } = req.query;

  console.log(`[GET /staff] 👤 User context:`, JSON.stringify(userContext, null, 2));
  console.log(`[GET /staff] 📥 Query params:`, JSON.stringify({ venue_code, status }, null, 2));

  // Build access filter based on user role
  const { conditions, params } = buildAccessFilter(userContext, { venue_code, status });

  console.log(`[GET /staff] 🔐 Access conditions:`, conditions);
  console.log(`[GET /staff] 📝 Params:`, params);

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
    ORDER BY s.created_at DESC
  `;

  console.log(`[GET /staff] 🔍 Query:`, query.trim());

  staffModel.getAllStaff(query, params, (err, results) => {
    if (err) {
      console.error(`[GET /staff] ❌ Error:`, err.message);
      return error(res, 500, "Failed to fetch staff");
    }
    console.log(`[GET /staff] ✅ Results count:`, results.length);
    console.log(`[GET /staff] ✅ First result sample:`, results[0] ? JSON.stringify(results[0], null, 2) : 'No results');
    return success(res, results);
  });
};

/**
 * Get single staff member details
 * GET /api/system-admin/staff/:staff_code
 */
exports.getStaffDetails = (req, res) => {
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

  staffModel.getStaffByCode(query, params, (err, results) => {
    if (err) {
      console.error("Error fetching staff:", err);
      return error(res, 500, "Failed to fetch staff");
    }

    if (results.length === 0) {
      return error(res, 404, "Staff not found or access denied");
    }

    return success(res, results[0]);
  });
};

/**
 * Add new staff member
 * POST /api/system-admin/staff
 */
exports.addStaff = (req, res) => {
  const crypto = require('crypto');
  const db = require('../config/db');

  console.log(`[POST /staff] 📥 Request body:`, JSON.stringify(req.body, null, 2));

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

  // Start transaction
  db.getConnection((err, connection) => {
    if (err) {
      console.error(`[POST /staff] ❌ DB connection error:`, err);
      return error(res, 500, 'Database connection failed');
    }

    connection.beginTransaction((err) => {
      if (err) {
        connection.release();
        console.error(`[POST /staff] ❌ Transaction start error:`, err);
        return error(res, 500, 'Failed to start transaction');
      }

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

      // Staff added via /system-admin/staff are venue staff (not system admins)
      const staffType = 'venue_staff';

      const staffValues = [
        staff_code, business_code, venue_code,
        first_name, middle_name || null, last_name,
        phone_number || null, role_title || 'Staff',
        'active', employment_type || 'full_time',
        staffType, start_date || null
      ];

      console.log(`[POST /staff] 🔍 Staff values:`, staffValues);
      console.log(`[POST /staff] 🔍 employment_type value:`, employment_type);

      connection.query(
        staffQuery,
        staffValues,
        (err, staffResult) => {
          if (err) {
            return connection.rollback(() => {
              connection.release();
              console.error(`[POST /staff] ❌ Staff insert error:`, err.message);
              if (err.code === 'ER_DUP_ENTRY') {
                return error(res, 409, 'Staff code already exists');
              }
              return error(res, 500, 'Failed to create staff record');
            });
          }

          console.log(`[POST /staff] ✅ Staff record created`);

          // 2. Insert into pay_rates table
          const payRatesQuery = `
            INSERT INTO pay_rates (
              staff_code, weekday_rate, saturday_rate, sunday_rate,
              public_holiday_rate, overtime_rate, default_hours
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
          `;

          connection.query(
            payRatesQuery,
            [staff_code, weekday_rate || 0, saturday_rate || 0, sunday_rate || 0,
             public_holiday_rate || 0, overtime_rate || 0, default_hours || 38],
            (err) => {
              if (err) {
                return connection.rollback(() => {
                  connection.release();
                  console.error(`[POST /staff] ❌ Pay rates insert error:`, err.message);
                  return error(res, 500, 'Failed to create pay rates');
                });
              }

              console.log(`[POST /staff] ✅ Pay rates created`);

              // 3. Insert into staff_compliance (banking details)
              if (account_holder_name && bank_name && bank_bsb && bank_account_number) {
                const complianceQuery = `
                  INSERT INTO staff_compliance (
                    staff_code, account_holder_name, bank_name, bank_bsb, bank_account_number
                  ) VALUES (?, ?, ?, ?, ?)
                `;

                connection.query(
                  complianceQuery,
                  [staff_code, account_holder_name, bank_name, bank_bsb, bank_account_number],
                  (err) => {
                    if (err) {
                      console.log(`[POST /staff] ⚠️  Banking details not saved:`, err.message);
                      // Don't fail the whole transaction for banking details
                    } else {
                      console.log(`[POST /staff] ✅ Banking details saved`);
                    }
                  }
                );
              }

              // 4. Insert into users table with unique PIN retry
              const insertUserWithUniquePin = (attemptCount = 0) => {
                if (attemptCount > 5) {
                  return connection.rollback(() => {
                    connection.release();
                    console.error(`[POST /staff] ❌ Failed to generate unique PIN after 5 attempts`);
                    return error(res, 500, 'Failed to generate unique kiosk PIN');
                  });
                }

                const kiosk_pin = generateKioskPin();

                const userQuery = `
                  INSERT INTO users (
                    staff_code, email, password_hash, access_level, kiosk_pin, status
                  ) VALUES (?, ?, ?, ?, ?, 'active')
                `;

                connection.query(
                  userQuery,
                  [staff_code, email, password, access_level, kiosk_pin],
                  (err, userResult) => {
                    if (err) {
                      if (err.code === 'ER_DUP_ENTRY' && err.message.includes('kiosk_pin')) {
                        console.log(`[POST /staff] ⚠️  PIN collision, retrying... (attempt ${attemptCount + 1})`);
                        return insertUserWithUniquePin(attemptCount + 1);
                      }

                      return connection.rollback(() => {
                        connection.release();
                        console.error(`[POST /staff] ❌ User insert error:`, err.message);
                        if (err.code === 'ER_DUP_ENTRY') {
                          return error(res, 409, 'Email already exists');
                        }
                        return error(res, 500, 'Failed to create user account');
                      });
                    }

                    console.log(`[POST /staff] ✅ User account created with PIN: ${kiosk_pin}`);

                    // Commit transaction
                    connection.commit((err) => {
                      if (err) {
                        return connection.rollback(() => {
                          connection.release();
                          console.error(`[POST /staff] ❌ Transaction commit error:`, err);
                          return error(res, 500, 'Failed to save staff member');
                        });
                      }

                      console.log(`[POST /staff] ✅ Transaction committed successfully`);
                      connection.release();

                      const response = {
                        success: true,
                        message: 'Staff member created successfully',
                        staff: { staff_code, full_name: `${first_name} ${last_name}` },
                        user: { user_id: userResult.insertId, email, kiosk_pin }
                      };

                      console.log(`[POST /staff] ✅ Sending response:`, JSON.stringify(response, null, 2));
                      return success(res, response);
                    });
                  }
                );
              };

              // Start user insertion with PIN retry logic
              insertUserWithUniquePin();
            }
          );
        }
      );
    });
  });
};

exports.updateStaff = (req, res) => {
  // TODO: Implement full update staff logic with transactions
  error(res, 501, "Update staff not yet implemented in controller");
};

exports.deleteStaff = (req, res) => {
  // TODO: Implement full delete staff logic
  error(res, 501, "Delete staff not yet implemented in controller");
};
