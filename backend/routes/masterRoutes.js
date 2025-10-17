const express = require("express");
const crypto = require("crypto");
const db = require("../config/db");
const router = express.Router();

// Import consolidated validation schemas
const {
  businessSchema,
  businessUpdateSchema,
  venueSysAdminSchema,
  venueAdminUpdateSchema,
  staffSchema
} = require("../validation/masterValidation");

// ============================
// BUSINESSES
// ============================

// Get all businesses
router.get("/businesses", async (req, res) => {
  try {
    const [results] = await db.execute("SELECT * FROM businesses ORDER BY business_name");
    res.json({ success: true, data: results });
  } catch (err) {
    console.error("Error fetching businesses:", err);
    res.status(500).json({ success: false, error: "Failed to fetch businesses" });
  }
});

// Add new business
router.post("/business", async (req, res) => {
  try {
    // Validate request body with Joi
    const { error, value } = businessSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const { code, name } = value;

    const query = `
      INSERT INTO businesses (business_code, business_name, status)
      VALUES (?, ?, 'active')
    `;

    const [result] = await db.execute(query, [code, name]);
    res.json({ success: true, business_code: code, id: result.insertId });
  } catch (err) {
    console.error("Error adding business:", err);

    // Handle duplicate business_code error
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        error: "Business code already exists"
      });
    }

    res.status(500).json({ success: false, error: "Failed to create business" });
  }
});

// Update business
router.put("/business/:business_code", async (req, res) => {
  try {
    const { business_code } = req.params;

    // Validate request body with Joi
    const { error, value } = businessUpdateSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        error: error.details[0].message
      });
    }

    const { name } = value;

    // Check if business exists
    const [results] = await db.execute("SELECT * FROM businesses WHERE business_code = ?", [business_code]);

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Business not found"
      });
    }

    // Update business
    const query = "UPDATE businesses SET business_name = ? WHERE business_code = ?";
    await db.execute(query, [name, business_code]);

    res.json({
      success: true,
      message: "Business updated successfully",
      business_code: business_code
    });
  } catch (err) {
    console.error("Error updating business:", err);
    res.status(500).json({ success: false, error: "Failed to update business" });
  }
});

// Delete business
router.delete("/business/:business_code", async (req, res) => {
  try {
    const { business_code } = req.params;

    // First, check if business has any venues
    const [results] = await db.execute("SELECT COUNT(*) as venue_count FROM venues WHERE business_code = ?", [business_code]);

    const venueCount = results[0].venue_count;

    if (venueCount > 0) {
      return res.status(409).json({
        success: false,
        error: `Cannot delete business with ${venueCount} existing venue(s). Please delete venues first.`
      });
    }

    // No venues, safe to delete business
    const [result] = await db.execute("DELETE FROM businesses WHERE business_code = ?", [business_code]);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: "Business not found"
      });
    }

    res.json({
      success: true,
      message: "Business deleted successfully"
    });
  } catch (err) {
    console.error("Error deleting business:", err);
    res.status(500).json({ success: false, error: "Failed to delete business" });
  }
});

// ============================
// VENUES
// ============================

// Get all venues with business info
router.get("/venues", async (req, res) => {
  try {
    const query = `
      SELECT v.venue_code,
             v.venue_name,
             v.state,
             v.venue_address AS location,
             v.contact_email,
             v.status,
             v.created_at,
             b.business_name
      FROM venues v
      JOIN businesses b ON v.business_code = b.business_code
      ORDER BY v.venue_name
    `;

    const [results] = await db.execute(query);
    res.json({ success: true, data: results });
  } catch (err) {
    console.error("Error fetching venues:", err);
    res.status(500).json({ success: false, error: "Failed to fetch venues" });
  }
});

// Get single venue with admin details for editing
router.get("/venue/:venue_code", async (req, res) => {
  try {
    const { venue_code } = req.params;

    const query = `
      SELECT
        v.venue_code,
        v.venue_name AS venue_name,
        v.venue_address,
        v.state,
        v.timezone,
        v.week_start,
        v.contact_email,
        s.first_name,
        s.middle_name,
        s.last_name,
        u.email AS admin_email
      FROM venues v
      LEFT JOIN staff s ON v.business_code = s.business_code AND s.role_title = 'System Admin' AND s.venue_code IS NULL
      LEFT JOIN users u ON s.staff_code = u.staff_code
      WHERE v.venue_code = ?
      LIMIT 1
    `;

    console.log(`[GET /venue/${venue_code}] Query:`, query.trim());
    console.log(`[GET /venue/${venue_code}] Params:`, [venue_code]);

    const [results] = await db.execute(query, [venue_code]);

    console.log(`[GET /venue/${venue_code}] ✅ Results:`, JSON.stringify(results, null, 2));

    if (results.length === 0) {
      console.log(`[GET /venue/${venue_code}] ⚠️  No venue found`);
      return res.status(404).json({ success: false, error: "Venue not found" });
    }

    console.log(`[GET /venue/${venue_code}] ✅ Sending response:`, JSON.stringify(results[0], null, 2));
    res.json({ success: true, data: results[0] });
  } catch (err) {
    console.error(`[GET /venue/${req.params.venue_code}] ❌ Error:`, err.message);
    res.status(500).json({ success: false, error: "Failed to fetch venue details" });
  }
});

// Add new venue and system admin
router.post("/venue-with-admin", async (req, res) => {
  // Validate request body with Joi
  const { error, value } = venueSysAdminSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: error.details[0].message
    });
  }

  const {
    // Venue Details
    business_code, venue_code, venue_name, venue_address, state, timezone, week_start,
    // Kiosk Details
    contact_email, kiosk_password,
    // System Admin
    staff_code, first_name, middle_name, last_name, email, password
  } = value;

  // Hash the passwords (in production, use bcrypt)
  const kiosk_password_hash = kiosk_password; // Should be hashed
  const password_hash = password; // Should be hashed
  const username = email; // Use email as username

  // Auto-generate secure 6-digit kiosk PIN using crypto
  const generateKioskPin = () => crypto.randomInt(100000, 999999).toString();

  let connection;
  try {
    // Get connection and start transaction
    connection = await db.getConnection();
    await connection.beginTransaction();

    // 1. Insert venue
    const venueQuery = `
      INSERT INTO venues (venue_code, business_code, venue_name, state, venue_address, contact_email, kiosk_password, timezone, week_start, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
    `;

    await connection.execute(
      venueQuery,
      [venue_code, business_code, venue_name, state, venue_address, contact_email, kiosk_password_hash, timezone, week_start]
    );

    // 2. Insert staff record (venue_code is NULL for system admins - they belong to business, not specific venue)
    const staffQuery = `
      INSERT INTO staff (staff_code, business_code, venue_code, first_name, middle_name, last_name, employment_status, role_title, staff_type)
      VALUES (?, ?, NULL, ?, ?, ?, 'active', 'System Admin', 'system_admin')
    `;

    await connection.execute(
      staffQuery,
      [staff_code, business_code, first_name, middle_name, last_name]
    );

    // 3. Insert user record with unique kiosk PIN (retry up to 5 times on PIN collision)
    let attemptCount = 0;
    let userInserted = false;
    let kiosk_pin;
    let userResult;

    while (!userInserted && attemptCount <= 5) {
      try {
        kiosk_pin = generateKioskPin();

        const userQuery = `
          INSERT INTO users (email, password_hash, kiosk_pin, access_level, status, staff_code)
          VALUES (?, ?, ?, 'system_admin', 'active', ?)
        `;

        [userResult] = await connection.execute(
          userQuery,
          [username, password_hash, kiosk_pin, staff_code]
        );

        userInserted = true;
      } catch (err) {
        // If duplicate PIN, retry with new PIN
        if (err.code === 'ER_DUP_ENTRY' && err.message.includes('kiosk_pin')) {
          console.log(`Kiosk PIN collision detected, regenerating... (attempt ${attemptCount + 1})`);
          attemptCount++;
        } else {
          throw err; // Re-throw other errors
        }
      }
    }

    if (!userInserted) {
      throw new Error("Failed to generate unique kiosk PIN after multiple attempts");
    }

    // Commit transaction
    await connection.commit();
    connection.release();

    res.json({
      success: true,
      venue: { venue_code, venue_name },
      sysAdmin: { user_id: userResult.insertId, email, kiosk_pin }
    });

  } catch (err) {
    // Rollback on error
    if (connection) {
      await connection.rollback();
      connection.release();
    }

    console.error("Error creating venue and admin:", err);

    // Handle duplicate errors
    if (err.code === 'ER_DUP_ENTRY') {
      if (err.message.includes('venue_code') || err.message.includes('contact_email')) {
        return res.status(409).json({
          success: false,
          error: "Venue code or contact email already exists"
        });
      }
      if (err.message.includes('staff_code')) {
        return res.status(409).json({
          success: false,
          error: "Staff code already exists"
        });
      }
      if (err.message.includes('email')) {
        return res.status(409).json({
          success: false,
          error: "Username/email already exists"
        });
      }
    }

    res.status(500).json({ success: false, error: "Failed to create venue and admin" });
  }
});

// Update venue and system admin
router.put("/venue-with-admin/:venue_code", async (req, res) => {
  const { venue_code } = req.params;

  console.log(`[PUT /venue-with-admin/${venue_code}] 📥 Request body:`, JSON.stringify(req.body, null, 2));

  // Validate request body with Joi
  const { error, value } = venueAdminUpdateSchema.validate(req.body);
  if (error) {
    console.log(`[PUT /venue-with-admin/${venue_code}] ❌ Validation error:`, error.details[0].message);
    return res.status(400).json({
      success: false,
      error: error.details[0].message
    });
  }

  const {
    venue_name, venue_address, state, timezone, week_start,
    contact_email,
    first_name, middle_name, last_name, email
  } = value;

  console.log(`[PUT /venue-with-admin/${venue_code}] ✅ Validation passed`);

  let connection;
  try {
    // Get connection and start transaction
    connection = await db.getConnection();
    await connection.beginTransaction();

    // 1. Update venue
    const venueQuery = `
      UPDATE venues
      SET venue_name = ?, venue_address = ?, state = ?, timezone = ?, week_start = ?, contact_email = ?
      WHERE venue_code = ?
    `;

    const [venueResult] = await connection.execute(
      venueQuery,
      [venue_name, venue_address, state, timezone, week_start, contact_email, venue_code]
    );

    if (venueResult.affectedRows === 0) {
      await connection.rollback();
      connection.release();
      return res.status(404).json({ success: false, error: "Venue not found" });
    }

    // 2. Get staff_code for this venue's business system admin
    const getStaffQuery = `
      SELECT s.staff_code FROM staff s
      JOIN venues v ON s.business_code = v.business_code
      WHERE v.venue_code = ? AND s.role_title = 'System Admin' AND s.venue_code IS NULL
      LIMIT 1
    `;

    const [staffResults] = await connection.execute(getStaffQuery, [venue_code]);

    if (staffResults.length === 0) {
      await connection.rollback();
      connection.release();
      return res.status(500).json({ success: false, error: "Failed to find system admin" });
    }

    const staff_code = staffResults[0].staff_code;

    // 3. Update staff record
    const staffQuery = `
      UPDATE staff
      SET first_name = ?, middle_name = ?, last_name = ?
      WHERE staff_code = ?
    `;

    await connection.execute(staffQuery, [first_name, middle_name, last_name, staff_code]);

    // 4. Update user record (email)
    const userQuery = `
      UPDATE users
      SET email = ?
      WHERE staff_code = ?
    `;

    await connection.execute(userQuery, [email, staff_code]);

    // Commit transaction
    await connection.commit();
    connection.release();

    console.log(`[PUT /venue-with-admin/${venue_code}] ✅ Transaction committed successfully`);

    const response = {
      success: true,
      message: "Venue and system admin updated successfully",
      venue_code: venue_code
    };
    console.log(`[PUT /venue-with-admin/${venue_code}] ✅ Sending response:`, JSON.stringify(response, null, 2));
    res.json(response);

  } catch (err) {
    // Rollback on error
    if (connection) {
      await connection.rollback();
      connection.release();
    }

    console.error(`[PUT /venue-with-admin/${venue_code}] ❌ Error:`, err);
    res.status(500).json({ success: false, error: "Failed to update venue and admin" });
  }
});

// Delete venue and associated records
router.delete("/venue/:venue_code", async (req, res) => {
  try {
    const { venue_code } = req.params;

    // First, check if venue has any staff (besides system admin)
    const checkQuery = "SELECT COUNT(*) as staff_count FROM staff WHERE venue_code = ?";
    const [results] = await db.execute(checkQuery, [venue_code]);

    const staff_count = results[0].staff_count;

    // Allow deletion if only 1 staff (the system admin) or none
    if (staff_count > 1) {
      return res.status(409).json({
        success: false,
        error: `Cannot delete venue with ${staff_count} staff member(s). Please remove other staff first (System Admin will be deleted automatically).`
      });
    }

    // Safe to delete - start transaction
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      // 1. Get staff_code for business system admin (who has venue_code = NULL)
      const [staffResults] = await connection.execute(
        "SELECT s.staff_code FROM staff s JOIN venues v ON s.business_code = v.business_code WHERE v.venue_code = ? AND s.role_title = 'System Admin' AND s.venue_code IS NULL LIMIT 1",
        [venue_code]
      );

      const staff_code = staffResults.length > 0 ? staffResults[0].staff_code : null;

      // 2. Delete user record (if exists)
      if (staff_code) {
        await connection.execute("DELETE FROM users WHERE staff_code = ?", [staff_code]);
      }

      // 3. Delete staff record
      await connection.execute("DELETE FROM staff WHERE venue_code = ?", [venue_code]);

      // 4. Delete venue
      const [result] = await connection.execute("DELETE FROM venues WHERE venue_code = ?", [venue_code]);

      if (result.affectedRows === 0) {
        await connection.rollback();
        connection.release();
        return res.status(404).json({ success: false, error: "Venue not found" });
      }

      // Commit transaction
      await connection.commit();
      connection.release();

      res.json({
        success: true,
        message: "Venue and associated records deleted successfully"
      });

    } catch (err) {
      await connection.rollback();
      connection.release();
      throw err;
    }

  } catch (err) {
    console.error("Error deleting venue:", err);
    res.status(500).json({ success: false, error: "Failed to delete venue" });
  }
});

// ============================
// KIOSK PINS
// ============================

// Get all kiosk PINs for system admins (secure endpoint - should require admin auth in production)
router.get("/users/kiosk-pins", async (req, res) => {
  try {
    const query = `
      SELECT
        u.email,
        s.staff_code,
        s.first_name,
        s.last_name,
        u.kiosk_pin,
        v.venue_name AS venue_name,
        b.business_name,
        u.created_at
      FROM users u
      JOIN staff s ON u.staff_code = s.staff_code
      LEFT JOIN venues v ON s.venue_code = v.venue_code
      LEFT JOIN businesses b ON s.business_code = b.business_code
      WHERE u.access_level = 'system_admin' AND u.kiosk_pin IS NOT NULL
      ORDER BY u.created_at DESC
    `;

    const [results] = await db.execute(query);
    res.json({ success: true, data: results });
  } catch (err) {
    console.error("Error fetching kiosk pins:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ============================
// DASHBOARD STATS
// ============================

// Get comprehensive dashboard stats
router.get("/stats", async (req, res) => {
  try {
    const stats = {};

    // Get monthly date strings for growth calculations
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
    const lastMonth = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7);

    // Run all queries in parallel for better performance
    const [
      [businessResult],
      [venueResult],
      [staffResult],
      [businessMonthResult],
      [businessLastMonthResult],
      [venueMonthResult],
      [venueLastMonthResult],
      [staffMonthResult],
      [staffLastMonthResult],
      [stateResults]
    ] = await Promise.all([
      db.execute("SELECT COUNT(*) as total_businesses FROM businesses"),
      db.execute("SELECT COUNT(*) as total_venues FROM venues"),
      db.execute("SELECT COUNT(*) as total_staff FROM staff WHERE employment_status='active'"),
      db.execute("SELECT COUNT(*) as count FROM businesses WHERE DATE_FORMAT(created_at, '%Y-%m') = ?", [currentMonth]),
      db.execute("SELECT COUNT(*) as count FROM businesses WHERE DATE_FORMAT(created_at, '%Y-%m') = ?", [lastMonth]),
      db.execute("SELECT COUNT(*) as count FROM venues WHERE DATE_FORMAT(created_at, '%Y-%m') = ?", [currentMonth]),
      db.execute("SELECT COUNT(*) as count FROM venues WHERE DATE_FORMAT(created_at, '%Y-%m') = ?", [lastMonth]),
      db.execute("SELECT COUNT(*) as count FROM staff WHERE employment_status='active' AND DATE_FORMAT(created_at, '%Y-%m') = ?", [currentMonth]),
      db.execute("SELECT COUNT(*) as count FROM staff WHERE employment_status='active' AND DATE_FORMAT(created_at, '%Y-%m') = ?", [lastMonth]),
      db.execute("SELECT state, COUNT(*) as venues_per_state FROM venues GROUP BY state ORDER BY venues_per_state DESC")
    ]);

    // Build stats object
    stats.total_businesses = businessResult[0].total_businesses;
    stats.total_venues = venueResult[0].total_venues;
    stats.total_staff = staffResult[0].total_staff;
    stats.businesses_this_month = businessMonthResult[0].count;
    stats.businesses_last_month = businessLastMonthResult[0].count;
    stats.venues_this_month = venueMonthResult[0].count;
    stats.venues_last_month = venueLastMonthResult[0].count;
    stats.staff_this_month = staffMonthResult[0].count;
    stats.staff_last_month = staffLastMonthResult[0].count;
    stats.venues_by_state = stateResults;

    // For now, set hours to 0 (would need time tracking implementation)
    stats.hours_this_month = 0;
    stats.hours_last_month = 0;

    res.json({ success: true, data: stats });

  } catch (err) {
    console.error("Error fetching dashboard statistics:", err);
    res.status(500).json({ success: false, error: "Failed to fetch dashboard statistics" });
  }
});

module.exports = router;