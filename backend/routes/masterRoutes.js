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
router.get("/businesses", (req, res) => {
  db.query("SELECT * FROM businesses ORDER BY business_name", (err, results) => {
    if (err) {
      console.error("Error fetching businesses:", err);
      return res.status(500).json({ success: false, error: "Failed to fetch businesses" });
    }
    res.json({ success: true, data: results });
  });
});

// Add new business
router.post("/business", (req, res) => {
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

  db.query(query, [code, name], (err, result) => {
    if (err) {
      console.error("Error adding business:", err);

      // Handle duplicate business_code error
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          success: false,
          error: "Business code already exists"
        });
      }

      return res.status(500).json({ success: false, error: "Failed to create business" });
    }
    res.json({ success: true, business_code: code, id: result.insertId });
  });
});

// Update business
router.put("/business/:business_code", (req, res) => {
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
  db.query("SELECT * FROM businesses WHERE business_code = ?", [business_code], (err, results) => {
    if (err) {
      console.error("Error checking business:", err);
      return res.status(500).json({ success: false, error: "Database error" });
    }

    if (results.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Business not found"
      });
    }

    // Update business
    const query = "UPDATE businesses SET business_name = ? WHERE business_code = ?";
    db.query(query, [name, business_code], (err, result) => {
      if (err) {
        console.error("Error updating business:", err);
        return res.status(500).json({ success: false, error: "Failed to update business" });
      }

      res.json({
        success: true,
        message: "Business updated successfully",
        business_code: business_code
      });
    });
  });
});

// Delete business
router.delete("/business/:business_code", (req, res) => {
  const { business_code } = req.params;

  // First, check if business has any venues
  db.query("SELECT COUNT(*) as venue_count FROM venues WHERE business_code = ?", [business_code], (err, results) => {
    if (err) {
      console.error("Error checking venues:", err);
      return res.status(500).json({ success: false, error: "Database error" });
    }

    const venueCount = results[0].venue_count;

    if (venueCount > 0) {
      return res.status(409).json({
        success: false,
        error: `Cannot delete business with ${venueCount} existing venue(s). Please delete venues first.`
      });
    }

    // No venues, safe to delete business
    db.query("DELETE FROM businesses WHERE business_code = ?", [business_code], (err, result) => {
      if (err) {
        console.error("Error deleting business:", err);
        return res.status(500).json({ success: false, error: "Failed to delete business" });
      }

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
    });
  });
});

// ============================
// VENUES
// ============================

// Get all venues with business info
router.get("/venues", (req, res) => {
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

  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching venues:", err);
      return res.status(500).json({ success: false, error: "Failed to fetch venues" });
    }
    res.json({ success: true, data: results });
  });
});

// Get single venue with admin details for editing
router.get("/venue/:venue_code", (req, res) => {
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

  db.query(query, [venue_code], (err, results) => {
    if (err) {
      console.error(`[GET /venue/${venue_code}] ❌ Error:`, err.message);
      return res.status(500).json({ success: false, error: "Failed to fetch venue details" });
    }

    console.log(`[GET /venue/${venue_code}] ✅ Results:`, JSON.stringify(results, null, 2));

    if (results.length === 0) {
      console.log(`[GET /venue/${venue_code}] ⚠️  No venue found`);
      return res.status(404).json({ success: false, error: "Venue not found" });
    }

    console.log(`[GET /venue/${venue_code}] ✅ Sending response:`, JSON.stringify(results[0], null, 2));
    res.json({ success: true, data: results[0] });
  });
});

// Add new venue and system admin
router.post("/venue-with-admin", (req, res) => {
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

  // Start transaction
  db.getConnection((err, connection) => {
    if (err) {
      console.error("Error getting connection:", err);
      return res.status(500).json({ success: false, error: "Database connection failed" });
    }

    connection.beginTransaction((err) => {
      if (err) {
        connection.release();
        console.error("Error starting transaction:", err);
        return res.status(500).json({ success: false, error: "Failed to start transaction" });
      }

      // 1. Insert venue
      const venueQuery = `
        INSERT INTO venues (venue_code, business_code, venue_name, state, venue_address, contact_email, kiosk_password, timezone, week_start, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
      `;

      connection.query(
        venueQuery,
        [venue_code, business_code, venue_name, state, venue_address, contact_email, kiosk_password_hash, timezone, week_start],
        (err, venueResult) => {
          if (err) {
            return connection.rollback(() => {
              connection.release();
              console.error("Error adding venue:", err);

              // Handle duplicate errors
              if (err.code === 'ER_DUP_ENTRY') {
                return res.status(409).json({
                  success: false,
                  error: "Venue code or contact email already exists"
                });
              }

              res.status(500).json({ success: false, error: "Failed to create venue" });
            });
          }

          // 2. Insert staff record (venue_code is NULL for system admins - they belong to business, not specific venue)
          const staffQuery = `
            INSERT INTO staff (staff_code, business_code, venue_code, first_name, middle_name, last_name, employment_status, role_title, staff_type)
            VALUES (?, ?, NULL, ?, ?, ?, 'active', 'System Admin', 'system_admin')
          `;

          connection.query(
            staffQuery,
            [staff_code, business_code, first_name, middle_name, last_name],
            (err, staffResult) => {
              if (err) {
                return connection.rollback(() => {
                  connection.release();
                  console.error("Error adding staff:", err);

                  // Handle duplicate staff_code
                  if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(409).json({
                      success: false,
                      error: "Staff code already exists"
                    });
                  }

                  res.status(500).json({ success: false, error: "Failed to create staff record" });
                });
              }

              // 3. Insert user record (for login credentials) with auto-generated kiosk PIN
              // Note: venue_code is NULL for system admins (they're tied to business, not specific venue)

              // Function to attempt user insertion with unique PIN
              const insertUserWithUniquePin = (attemptCount = 0) => {
                if (attemptCount > 5) {
                  return connection.rollback(() => {
                    connection.release();
                    res.status(500).json({ success: false, error: "Failed to generate unique kiosk PIN after multiple attempts" });
                  });
                }

                const kiosk_pin = generateKioskPin();

                const userQuery = `
                  INSERT INTO users (email, password_hash, kiosk_pin, access_level, status, staff_code)
                  VALUES (?, ?, ?, 'system_admin', 'active', ?)
                `;

                connection.query(
                  userQuery,
                  [username, password_hash, kiosk_pin, staff_code],
                  (err, userResult) => {
                    if (err) {
                      // If duplicate PIN, retry with new PIN
                      if (err.code === 'ER_DUP_ENTRY' && err.message.includes('kiosk_pin')) {
                        console.log(`Kiosk PIN collision detected, regenerating... (attempt ${attemptCount + 1})`);
                        return insertUserWithUniquePin(attemptCount + 1);
                      }

                      return connection.rollback(() => {
                        connection.release();
                        console.error("Error adding user:", err);

                        // Handle duplicate username
                        if (err.code === 'ER_DUP_ENTRY') {
                          return res.status(409).json({
                            success: false,
                            error: "Username/email already exists"
                          });
                        }

                        res.status(500).json({ success: false, error: "Failed to create user account" });
                      });
                    }

                    connection.commit((err) => {
                      if (err) {
                        return connection.rollback(() => {
                          connection.release();
                          console.error("Error committing transaction:", err);
                          res.status(500).json({ success: false, error: "Failed to save venue and admin" });
                        });
                      }

                      connection.release();
                      res.json({
                        success: true,
                        venue: { venue_code, venue_name },
                        sysAdmin: { user_id: userResult.insertId, email, kiosk_pin }
                      });
                    });
                  }
                );
              };

              // Start the insertion process
              insertUserWithUniquePin();
            }
          );
        }
      );
    });
  });
});

// Update venue and system admin
router.put("/venue-with-admin/:venue_code", (req, res) => {
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

  // Start transaction
  db.getConnection((err, connection) => {
    if (err) {
      console.error("Error getting connection:", err);
      return res.status(500).json({ success: false, error: "Database connection failed" });
    }

    connection.beginTransaction((err) => {
      if (err) {
        connection.release();
        console.error("Error starting transaction:", err);
        return res.status(500).json({ success: false, error: "Failed to start transaction" });
      }

      // 1. Update venue
      const venueQuery = `
        UPDATE venues
        SET venue_name = ?, venue_address = ?, state = ?, timezone = ?, week_start = ?, contact_email = ?
        WHERE venue_code = ?
      `;

      connection.query(
        venueQuery,
        [venue_name, venue_address, state, timezone, week_start, contact_email, venue_code],
        (err, venueResult) => {
          if (err) {
            return connection.rollback(() => {
              connection.release();
              console.error("Error updating venue:", err);
              res.status(500).json({ success: false, error: "Failed to update venue" });
            });
          }

          if (venueResult.affectedRows === 0) {
            return connection.rollback(() => {
              connection.release();
              res.status(404).json({ success: false, error: "Venue not found" });
            });
          }

          // 2. Get staff_code for this venue's business system admin
          const getStaffQuery = `
            SELECT s.staff_code FROM staff s
            JOIN venues v ON s.business_code = v.business_code
            WHERE v.venue_code = ? AND s.role_title = 'System Admin' AND s.venue_code IS NULL
            LIMIT 1
          `;

          connection.query(getStaffQuery, [venue_code], (err, staffResults) => {
            if (err || staffResults.length === 0) {
              return connection.rollback(() => {
                connection.release();
                console.error("Error finding staff:", err);
                res.status(500).json({ success: false, error: "Failed to find system admin" });
              });
            }

            const staff_code = staffResults[0].staff_code;

            // 3. Update staff record
            const staffQuery = `
              UPDATE staff
              SET first_name = ?, middle_name = ?, last_name = ?
              WHERE staff_code = ?
            `;

            connection.query(
              staffQuery,
              [first_name, middle_name, last_name, staff_code],
              (err, staffResult) => {
                if (err) {
                  return connection.rollback(() => {
                    connection.release();
                    console.error("Error updating staff:", err);
                    res.status(500).json({ success: false, error: "Failed to update staff record" });
                  });
                }

                // 4. Update user record (email)
                const userQuery = `
                  UPDATE users
                  SET email = ?
                  WHERE staff_code = ?
                `;

                connection.query(
                  userQuery,
                  [email, staff_code],
                  (err, userResult) => {
                    if (err) {
                      return connection.rollback(() => {
                        connection.release();
                        console.error("Error updating user:", err);
                        res.status(500).json({ success: false, error: "Failed to update user account" });
                      });
                    }

                    connection.commit((err) => {
                      if (err) {
                        return connection.rollback(() => {
                          connection.release();
                          console.error(`[PUT /venue-with-admin/${venue_code}] ❌ Transaction commit error:`, err);
                          res.status(500).json({ success: false, error: "Failed to save updates" });
                        });
                      }

                      console.log(`[PUT /venue-with-admin/${venue_code}] ✅ Transaction committed successfully`);
                      connection.release();

                      const response = {
                        success: true,
                        message: "Venue and system admin updated successfully",
                        venue_code: venue_code
                      };
                      console.log(`[PUT /venue-with-admin/${venue_code}] ✅ Sending response:`, JSON.stringify(response, null, 2));
                      res.json(response);
                    });
                  }
                );
              }
            );
          });
        }
      );
    });
  });
});

// Delete venue and associated records
router.delete("/venue/:venue_code", (req, res) => {
  const { venue_code } = req.params;

  // First, check if venue has any staff (besides system admin)
  const checkQuery = "SELECT COUNT(*) as staff_count FROM staff WHERE venue_code = ?";

  db.query(checkQuery, [venue_code], (err, results) => {
    if (err) {
      console.error("Error checking venue dependencies:", err);
      return res.status(500).json({ success: false, error: "Database error" });
    }

    const staff_count = results[0].staff_count;

    // Allow deletion if only 1 staff (the system admin) or none
    if (staff_count > 1) {
      return res.status(409).json({
        success: false,
        error: `Cannot delete venue with ${staff_count} staff member(s). Please remove other staff first (System Admin will be deleted automatically).`
      });
    }

    // Safe to delete - start transaction
    db.getConnection((err, connection) => {
      if (err) {
        console.error("Error getting connection:", err);
        return res.status(500).json({ success: false, error: "Database connection failed" });
      }

      connection.beginTransaction((err) => {
        if (err) {
          connection.release();
          console.error("Error starting transaction:", err);
          return res.status(500).json({ success: false, error: "Failed to start transaction" });
        }

        // 1. Get staff_code for business system admin (who has venue_code = NULL)
        connection.query(
          "SELECT s.staff_code FROM staff s JOIN venues v ON s.business_code = v.business_code WHERE v.venue_code = ? AND s.role_title = 'System Admin' AND s.venue_code IS NULL LIMIT 1",
          [venue_code],
          (err, staffResults) => {
            if (err) {
              return connection.rollback(() => {
                connection.release();
                console.error("Error finding staff:", err);
                res.status(500).json({ success: false, error: "Failed to find system admin" });
              });
            }

            const staff_code = staffResults.length > 0 ? staffResults[0].staff_code : null;

            // 2. Delete user record
            const deleteUserQuery = staff_code ? "DELETE FROM users WHERE staff_code = ?" : "SELECT 1";
            const deleteUserParams = staff_code ? [staff_code] : [];

            connection.query(deleteUserQuery, deleteUserParams, (err) => {
              if (err) {
                return connection.rollback(() => {
                  connection.release();
                  console.error("Error deleting user:", err);
                  res.status(500).json({ success: false, error: "Failed to delete user" });
                });
              }

              // 3. Delete staff record
              connection.query("DELETE FROM staff WHERE venue_code = ?", [venue_code], (err) => {
                if (err) {
                  return connection.rollback(() => {
                    connection.release();
                    console.error("Error deleting staff:", err);
                    res.status(500).json({ success: false, error: "Failed to delete staff" });
                  });
                }

                // 4. Delete venue
                connection.query("DELETE FROM venues WHERE venue_code = ?", [venue_code], (err, result) => {
                  if (err) {
                    return connection.rollback(() => {
                      connection.release();
                      console.error("Error deleting venue:", err);
                      res.status(500).json({ success: false, error: "Failed to delete venue" });
                    });
                  }

                  if (result.affectedRows === 0) {
                    return connection.rollback(() => {
                      connection.release();
                      res.status(404).json({ success: false, error: "Venue not found" });
                    });
                  }

                  connection.commit((err) => {
                    if (err) {
                      return connection.rollback(() => {
                        connection.release();
                        console.error("Error committing transaction:", err);
                        res.status(500).json({ success: false, error: "Failed to complete deletion" });
                      });
                    }

                    connection.release();
                    res.json({
                      success: true,
                      message: "Venue and associated records deleted successfully"
                    });
                  });
                });
              });
            });
          }
        );
      });
    });
  });
});

// ============================
// KIOSK PINS
// ============================

// Get all kiosk PINs for system admins (secure endpoint - should require admin auth in production)
router.get("/users/kiosk-pins", (req, res) => {
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

  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching kiosk pins:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
    res.json({ success: true, data: results });
  });
});

// ============================
// DASHBOARD STATS
// ============================

// Get comprehensive dashboard stats
router.get("/stats", (req, res) => {
  const stats = {};

  // Get total business count
  db.query("SELECT COUNT(*) as total_businesses FROM businesses", (err, businessResult) => {
    if (err) {
      console.error("Error getting business count:", err);
      return res.status(500).json({ success: false, error: "Failed to fetch dashboard statistics" });
    }
    stats.total_businesses = businessResult[0].total_businesses;

    // Get total venue count
    db.query("SELECT COUNT(*) as total_venues FROM venues", (err, venueResult) => {
      if (err) {
        console.error("Error getting venue count:", err);
        return res.status(500).json({ success: false, error: "Failed to fetch dashboard statistics" });
      }
      stats.total_venues = venueResult[0].total_venues;

      // Get total staff count (from staff table)
      db.query("SELECT COUNT(*) as total_staff FROM staff WHERE employment_status='active'", (err, staffResult) => {
        if (err) {
          console.error("Error getting staff count:", err);
          return res.status(500).json({ success: false, error: "Failed to fetch dashboard statistics" });
        }
        stats.total_staff = staffResult[0].total_staff;

        // Get monthly counts for growth calculations
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM format
        const lastMonth = new Date(new Date().setMonth(new Date().getMonth() - 1)).toISOString().slice(0, 7);

        // Get businesses this month
        db.query("SELECT COUNT(*) as count FROM businesses WHERE DATE_FORMAT(created_at, '%Y-%m') = ?", [currentMonth], (err, businessMonthResult) => {
          stats.businesses_this_month = err ? 0 : businessMonthResult[0].count;

          // Get businesses last month
          db.query("SELECT COUNT(*) as count FROM businesses WHERE DATE_FORMAT(created_at, '%Y-%m') = ?", [lastMonth], (err, businessLastMonthResult) => {
            stats.businesses_last_month = err ? 0 : businessLastMonthResult[0].count;

            // Get venues this month
            db.query("SELECT COUNT(*) as count FROM venues WHERE DATE_FORMAT(created_at, '%Y-%m') = ?", [currentMonth], (err, venueMonthResult) => {
              stats.venues_this_month = err ? 0 : venueMonthResult[0].count;

              // Get venues last month
              db.query("SELECT COUNT(*) as count FROM venues WHERE DATE_FORMAT(created_at, '%Y-%m') = ?", [lastMonth], (err, venueLastMonthResult) => {
                stats.venues_last_month = err ? 0 : venueLastMonthResult[0].count;

                // Get staff this month
                db.query("SELECT COUNT(*) as count FROM staff WHERE employment_status='active' AND DATE_FORMAT(created_at, '%Y-%m') = ?", [currentMonth], (err, staffMonthResult) => {
                  stats.staff_this_month = err ? 0 : staffMonthResult[0].count;

                  // Get staff last month
                  db.query("SELECT COUNT(*) as count FROM staff WHERE employment_status='active' AND DATE_FORMAT(created_at, '%Y-%m') = ?", [lastMonth], (err, staffLastMonthResult) => {
                    stats.staff_last_month = err ? 0 : staffLastMonthResult[0].count;

                    // Get venues by state
                    db.query("SELECT state, COUNT(*) as venues_per_state FROM venues GROUP BY state ORDER BY venues_per_state DESC", (err, stateResults) => {
                      stats.venues_by_state = err ? [] : stateResults;

                      // For now, set hours to 0 (would need time tracking implementation)
                      stats.hours_this_month = 0;
                      stats.hours_last_month = 0;

                      res.json({ success: true, data: stats });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
});

module.exports = router;