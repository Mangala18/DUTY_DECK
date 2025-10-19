const express = require("express");
const router = express.Router();
const db = require("../config/db");
const cache = require("../utils/cache");
const { determinePaydayType, calculateShiftPay } = require("../utils/payCalculator");

// ===== Step 5: DB Connection Keepalive Monitor =====
// Prevents MySQL idle disconnects with periodic health checks
setInterval(async () => {
  try {
    await db.execute('SELECT 1');
    console.log('✅ DB keepalive ping successful');
  } catch (err) {
    console.error('❌ DB keepalive failed:', err.message);
  }
}, 300000); // 5 minutes

// ===== Auto-Close Long Shifts Monitor =====
// Automatically closes shifts that have been open for more than 10 hours
// Runs every 15 minutes to catch and close any abandoned shifts
setInterval(async () => {
  try {
    const maxHours = 10;

    // Find all shifts that have been active for more than 10 hours
    const [longShifts] = await db.execute(`
      SELECT s.id, s.staff_code, s.clock_in, s.venue_code,
             TIMESTAMPDIFF(HOUR, s.clock_in, NOW()) as hours_open
      FROM shifts s
      WHERE s.shift_state IN ('ACTIVE', 'ON_BREAK')
        AND TIMESTAMPDIFF(HOUR, s.clock_in, NOW()) >= ?
    `, [maxHours]);

    if (longShifts.length === 0) {
      console.log('✅ Auto-close monitor: No long shifts found');
      return;
    }

    console.log(`⚠️  Found ${longShifts.length} shift(s) open for ${maxHours}+ hours - auto-closing...`);

    // Auto-close each long shift
    for (const shift of longShifts) {
      const autoClockOut = new Date(new Date(shift.clock_in).getTime() + maxHours * 60 * 60 * 1000);

      try {
        // Get venue details for business_code
        const [venueRows] = await db.execute(
          'SELECT business_code FROM venues WHERE venue_code = ? LIMIT 1',
          [shift.venue_code]
        );

        if (!venueRows.length) {
          console.error(`❌ Failed to auto-close shift ${shift.id}: venue not found`);
          continue;
        }

        const businessCode = venueRows[0].business_code;

        // Get pay rates for calculation
        const [rates] = await db.execute(`
          SELECT weekday_rate, saturday_rate, sunday_rate, public_holiday_rate
          FROM pay_rates
          WHERE staff_code = ?
          LIMIT 1
        `, [shift.staff_code]);

        // Determine payday_type based on date and holidays
        const paydayType = await determinePaydayType(new Date(shift.clock_in), businessCode);

        // Calculate pay using the utility (will use base rate if no rates found)
        const rate = rates.length > 0 ? rates[0] : null;

        if (!rate) {
          console.warn(`[AUTO-CLOSE] ⚠️  No pay rates found for staff ${shift.staff_code} - using base rate $25/hr`);
        }

        const payResult = calculateShiftPay({
          hoursWorked: maxHours,
          paydayType,
          rates: rate
        });

        const appliedRate = payResult.appliedRate;
        const totalPay = payResult.totalPay;

        // Close the shift
        await db.execute(`
          UPDATE shifts
          SET clock_out = ?,
              hours_worked = ?,
              applied_rate = ?,
              total_pay = ?,
              payday_type = ?,
              shift_state = 'COMPLETED'
          WHERE id = ?
        `, [autoClockOut, maxHours, appliedRate, totalPay, paydayType, shift.id]);

        console.log(`✅ Auto-closed shift ${shift.id} for ${shift.staff_code}: ${shift.hours_open}h → ${maxHours}h [${paydayType}]`);

      } catch (err) {
        console.error(`❌ Failed to auto-close shift ${shift.id}:`, err.message);
      }
    }

  } catch (err) {
    console.error('❌ Auto-close monitor failed:', err.message);
  }
}, 900000); // 15 minutes

// ===== Health Check Endpoint =====
// Purpose: Verify backend and database connectivity
// Used by: Frontend isBackendHealthy() function
router.get('/health', async (_req, res) => {
  try {
    // Test database connectivity with simple query
    await db.execute('SELECT 1');

    res.json({
      healthy: true,
      db: true,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error('❌ Health check failed:', err.message);
    res.status(503).json({
      healthy: false,
      db: false,
      error: err.message
    });
  }
});

// Kiosk login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Missing username or password' });
    }

    const sql = `
      SELECT venue_code, business_code, venue_name, contact_email, kiosk_password, timezone
      FROM venues
      WHERE contact_email = ? AND kiosk_password = ? AND status = 'active'
    `;

    const [results] = await db.execute(sql, [username, password]);

    if (!results || results.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const venue = results[0];

    // Success - return venue + business context with timezone
    res.json({
      success: true,
      venue_code: venue.venue_code,
      business_code: venue.business_code,
      venue_name: venue.venue_name,
      contact_email: venue.contact_email,
      timezone: venue.timezone || 'Australia/Sydney' // Fallback to AEST if NULL
    });
  } catch (err) {
    console.error('Error during kiosk login:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Validate staff PIN (for kiosk access - all active staff at venue)
router.post("/validate-pin", async (req, res) => {
  try {
    const { staff_code, pin, venue_code } = req.body;

    if (!staff_code || !pin || !venue_code) {
      return res.status(400).json({ success: false, error: "Missing staff_code, PIN, or venue_code" });
    }

    // Validate PIN format (6 digits)
    if (!/^\d{6}$/.test(pin)) {
      return res.status(400).json({ success: false, error: "PIN must be 6 digits" });
    }

    // Allow staff who are:
    // 1. Assigned to this specific venue (venue_code matches)
    // 2. System admins (venue_code IS NULL) who can work at any venue
    const sql = `
      SELECT u.id, u.kiosk_pin, u.staff_code, u.access_level,
             s.first_name, s.last_name, s.venue_code, s.business_code
      FROM users u
      JOIN staff s ON u.staff_code = s.staff_code
      WHERE u.staff_code = ?
        AND (s.venue_code = ? OR s.venue_code IS NULL)
        AND s.employment_status = 'active'
    `;

    const [results] = await db.execute(sql, [staff_code, venue_code]);

    if (!results || results.length === 0) {
      return res.status(404).json({ success: false, error: "Staff not found or not authorized for this venue" });
    }

    const user = results[0];

    // Check if PIN matches
    if (user.kiosk_pin !== pin) {
      return res.status(401).json({ success: false, error: "Invalid PIN" });
    }

    // PIN is valid - staff can use kiosk at this venue
    res.json({
      success: true,
      staff_code: user.staff_code,
      name: `${user.first_name} ${user.last_name}`,
      venue_code: user.venue_code,
      business_code: user.business_code,
      access_level: user.access_level
    });
  } catch (err) {
    console.error("Error validating PIN:", err);
    res.status(500).json({ success: false, error: "Database error" });
  }
});

// Get staff for kiosk display (venue-specific + system admins)
router.get("/staff", async (req, res) => {
  try {
    const { business_code, venue_code } = req.query;

    if (!business_code || !venue_code) {
      return res.status(400).json({ error: "business_code and venue_code are required" });
    }

    // Build cache key
    const cacheKey = `kiosk:staff:${business_code}:${venue_code}`;

    // Try cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log(`[GET /kiosk/staff] 💾 Cache HIT: ${cacheKey}`);
      return res.json({ success: true, data: cached, source: 'cache' });
    }

    console.log(`[GET /kiosk/staff] ❌ Cache MISS: ${cacheKey}`);

    // Include both:
    // 1. Staff assigned to this specific venue
    // 2. System admins (venue_code = NULL) who can work at any venue in the business
    // Note: Includes kiosk_pin for offline caching (testing phase)
    const sql = `
      SELECT s.staff_code, s.first_name, s.middle_name, s.last_name,
             s.venue_code, s.business_code, s.employment_status, s.role_title,
             u.kiosk_pin
      FROM staff s
      LEFT JOIN users u ON s.staff_code = u.staff_code
      WHERE s.business_code = ?
        AND (s.venue_code = ? OR s.venue_code IS NULL)
        AND s.employment_status = 'active'
      ORDER BY
        CASE WHEN s.venue_code IS NULL THEN 0 ELSE 1 END,
        s.first_name,
        s.last_name
    `;

    const [results] = await db.execute(sql, [business_code, venue_code]);

    // Cache for 30 minutes (1800000 ms) - staff list changes infrequently
    cache.set(cacheKey, results, 1800000);
    console.log(`[GET /kiosk/staff] 💾 Cached for 30 minutes: ${cacheKey}`);

    res.json({ success: true, data: results, source: 'database' });
  } catch (err) {
    console.error("Error fetching kiosk staff:", err);
    res.status(500).json({ error: "Failed to fetch staff" });
  }
});

// ===== LEGACY ENDPOINTS REMOVED =====
// The following endpoints have been removed and replaced:
// - POST /clock-in → Use POST /shift/:staff_code/clockin
// - POST /clock-out → Use POST /shift/:id/clockout
// These unified endpoints use server-side NOW() timestamps for accuracy

// ===== Batch Status Endpoint (Step 4: Performance Optimization) =====

/**
 * Get all staff statuses for a venue in one query
 * Replaces N× individual /status/:staff_code calls
 * @route GET /api/kiosk/status/venue/:venue_code
 */
router.get("/status/venue/:venue_code", async (req, res) => {
  const { venue_code } = req.params;
  const { business_code } = req.query;

  if (!venue_code) {
    return res.status(400).json({ success: false, error: "venue_code is required" });
  }

  if (!business_code) {
    return res.status(400).json({ success: false, error: "business_code is required" });
  }

  try {
    const query = `
      SELECT
        s.staff_code,
        s.first_name,
        s.last_name,
        COALESCE(sh.shift_state, 'NONE') AS shift_state,
        sh.id AS shift_id,
        sh.clock_in,
        sh.clock_out,
        sh.last_action_time,
        sh.approval_status,
        sh.payday_type
      FROM staff s
      LEFT JOIN shifts sh
        ON s.staff_code = sh.staff_code
        AND sh.venue_code = ?
        AND sh.shift_state IN ('ACTIVE', 'ON_BREAK')
      WHERE s.business_code = ?
        AND (s.venue_code = ? OR s.venue_code IS NULL)
        AND s.employment_status = 'active'
      ORDER BY
        CASE WHEN s.venue_code IS NULL THEN 0 ELSE 1 END,
        s.first_name,
        s.last_name
    `;

    const [rows] = await db.execute(query, [venue_code, business_code, venue_code]);

    console.log(`✅ Batch status: ${rows.length} staff records (venue + system admins) for venue ${venue_code}`);
    res.json({ success: true, data: rows });

  } catch (err) {
    console.error('❌ Batch status error:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get active shift status for a staff member (with auto-close)
router.get("/status/:staff_code", async (req, res) => {
  try {
    const { staff_code } = req.params;
    const { venue_code } = req.query;

    if (!venue_code) {
      return res.status(400).json({ error: "venue_code is required" });
    }

    // First check for ANY active shift (any venue)
    const anyShiftQuery = `
      SELECT s.*, v.venue_name
      FROM shifts s
      LEFT JOIN venues v ON s.venue_code = v.venue_code
      WHERE s.staff_code = ?
      AND s.shift_state IN ('ACTIVE', 'ON_BREAK')
      ORDER BY s.clock_in DESC
      LIMIT 1
    `;

    const [anyShifts] = await db.execute(anyShiftQuery, [staff_code]);

    if (!anyShifts || anyShifts.length === 0) {
      return res.json({ active: false });
    }

    const shift = anyShifts[0];

    // Check if the active shift is at a different venue
    if (shift.venue_code !== venue_code) {
      return res.json({
        active: false,
        activeAtOtherVenue: true,
        otherVenue: {
          venue_code: shift.venue_code,
          venue_name: shift.venue_name,
          clock_in: shift.clock_in,
          shift_state: shift.shift_state
        }
      });
    }

    // Shift is at current venue - proceed with normal logic
    // Note: Auto-close logic moved to interval monitor at top of file
    // Just return current state
    res.json({
      active: true,
      clock_in: shift.clock_in,
      venue_code: shift.venue_code,
      staff_code: shift.staff_code,
      shift_state: shift.shift_state,
      last_action_time: shift.last_action_time,
      shift_id: shift.id
    });
  } catch (err) {
    console.error("Error fetching shift status:", err);
    res.status(500).json({ error: err.message });
  }
});

// ===== Phase 3 Stage 2: Break Tracking Endpoints =====

// Clock In (with shift_state support)
// Clock In - Start new shift with transaction guard (Step 3)
router.post("/shift/:staff_code/clockin", async (req, res) => {
  const { staff_code } = req.params;
  const { venue_code } = req.body;

  if (!staff_code || !venue_code) {
    return res.status(400).json({ success: false, error: "Missing staff_code or venue_code" });
  }

  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    // Lock any existing open shifts for this staff (FOR UPDATE prevents race conditions)
    const [openShifts] = await connection.execute(`
      SELECT id, shift_state FROM shifts
      WHERE staff_code = ? AND shift_state IN ('ACTIVE', 'ON_BREAK')
      FOR UPDATE
    `, [staff_code]);

    // Conflict detected - staff already has an active shift
    if (openShifts.length > 0) {
      await connection.rollback();
      console.warn(`⚠️  Clock-in conflict: Staff ${staff_code} already has active shift ${openShifts[0].id}`);

      return res.status(409).json({
        success: false,
        status: 'conflict',
        error: 'Staff member already has an active shift',
        shift_id: openShifts[0].id,
        shift_state: openShifts[0].shift_state
      });
    }

    // Safe to insert new shift - no active shift exists
    const [result] = await connection.execute(`
      INSERT INTO shifts (staff_code, venue_code, clock_in, shift_state, last_action_time)
      VALUES (?, ?, NOW(), 'ACTIVE', NOW())
    `, [staff_code, venue_code]);

    await connection.commit();

    console.log(`✅ Clock-in: Staff ${staff_code} → Shift ID ${result.insertId}`);
    res.json({
      success: true,
      message: "Shift started",
      shift_id: result.insertId,
      shift_state: "ACTIVE"
    });

  } catch (err) {
    await connection.rollback();
    console.error('❌ Clock-in transaction failed:', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    connection.release();
  }
});

// Break In (start break)
router.post("/shift/:id/breakin", async (req, res) => {
  try {
    const { id } = req.params;

    const updateQuery = `
      UPDATE shifts
      SET shift_state = 'ON_BREAK',
          last_action_time = NOW()
      WHERE id = ? AND shift_state = 'ACTIVE'
    `;

    const [result] = await db.execute(updateQuery, [id]);

    if (result.affectedRows === 0) {
      return res.status(400).json({
        success: false,
        error: "Cannot start break - shift not in ACTIVE state"
      });
    }

    console.log(`✅ Break started: Shift ID ${id}`);
    res.json({
      success: true,
      message: "Break started",
      shift_state: "ON_BREAK"
    });
  } catch (err) {
    console.error("Error starting break:", err);
    res.status(500).json({ success: false, error: "Failed to start break" });
  }
});

// Break Out (end break)
router.post("/shift/:id/breakout", async (req, res) => {
  try {
    const { id } = req.params;

    const updateQuery = `
      UPDATE shifts
      SET break_minutes = break_minutes + TIMESTAMPDIFF(MINUTE, last_action_time, NOW()),
          last_action_time = NOW(),
          shift_state = 'ACTIVE'
      WHERE id = ? AND shift_state = 'ON_BREAK'
    `;

    const [result] = await db.execute(updateQuery, [id]);

    if (result.affectedRows === 0) {
      return res.status(400).json({
        success: false,
        error: "Cannot end break - shift not in ON_BREAK state"
      });
    }

    // Get updated break_minutes
    const selectQuery = `SELECT break_minutes FROM shifts WHERE id = ?`;
    const [shifts] = await db.execute(selectQuery, [id]);

    if (!shifts || shifts.length === 0) {
      return res.json({
        success: true,
        message: "Break ended",
        shift_state: "ACTIVE"
      });
    }

    console.log(`✅ Break ended: Shift ID ${id} → Total break: ${shifts[0].break_minutes} minutes`);
    res.json({
      success: true,
      message: "Break ended",
      shift_state: "ACTIVE",
      total_break_minutes: shifts[0].break_minutes
    });
  } catch (err) {
    console.error("Error ending break:", err);
    res.status(500).json({ success: false, error: "Failed to end break" });
  }
});

// Clock Out (with break-adjusted hours_worked calculation)
router.post("/shift/:id/clockout", async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`[KIOSK CLOCKOUT] 🔍 Shift ID: ${id}`);

    // Get shift details first including venue business_code
    const selectQuery = `
      SELECT s.*, v.business_code,
             pr.weekday_rate, pr.saturday_rate, pr.sunday_rate, pr.public_holiday_rate, pr.overtime_rate
      FROM shifts s
      LEFT JOIN pay_rates pr ON s.staff_code = pr.staff_code
      LEFT JOIN venues v ON s.venue_code = v.venue_code
      WHERE s.id = ? AND s.shift_state IN ('ACTIVE', 'ON_BREAK')
      LIMIT 1
    `;

    const [shifts] = await db.execute(selectQuery, [id]);

    if (!shifts || shifts.length === 0) {
      console.error(`[KIOSK CLOCKOUT] ❌ No active shift found with ID ${id}`);
      return res.status(400).json({
        success: false,
        error: "No active shift found or shift already completed"
      });
    }

    const shift = shifts[0];
    console.log(`[KIOSK CLOCKOUT] 📋 Shift data: staff=${shift.staff_code}, venue=${shift.venue_code}, business=${shift.business_code}`);

    // Check if pay rates exist (warn but don't fail - will use base rate $25/hr)
    if (!shift.weekday_rate && shift.weekday_rate !== 0) {
      console.warn(`[KIOSK CLOCKOUT] ⚠️  No pay rates found for staff ${shift.staff_code} - using base rate $25/hr`);
    }

    // Check if business_code exists
    if (!shift.business_code) {
      console.error(`[KIOSK CLOCKOUT] ❌ No business_code found for venue ${shift.venue_code}`);
      return res.status(400).json({
        success: false,
        error: `Venue ${shift.venue_code} is missing business_code`
      });
    }

    const clockIn = new Date(shift.clock_in);
    const clockOut = new Date();

    // Calculate total shift duration in hours
    const totalSeconds = (clockOut - clockIn) / 1000;
    const totalHours = totalSeconds / 3600;

    // Subtract break time from total hours
    const breakHours = (shift.break_minutes || 0) / 60;
    const hoursWorked = Math.round((totalHours - breakHours) * 100) / 100;

    console.log(`[KIOSK CLOCKOUT] ⏱ Calculated hours: ${hoursWorked}h (break: ${shift.break_minutes || 0} min)`);

    // Determine payday_type based on date and holidays
    const paydayType = await determinePaydayType(clockIn, shift.business_code);
    console.log(`[KIOSK CLOCKOUT] 📅 Payday type: ${paydayType}`);

    // Calculate pay using the utility
    const rates = {
      weekday_rate: shift.weekday_rate,
      saturday_rate: shift.saturday_rate,
      sunday_rate: shift.sunday_rate,
      public_holiday_rate: shift.public_holiday_rate,
      overtime_rate: shift.overtime_rate
    };

    const { appliedRate, totalPay } = calculateShiftPay({
      hoursWorked,
      paydayType,
      rates
    });

    console.log(`[KIOSK CLOCKOUT] 💰 Applied rate: $${appliedRate}, Total pay: $${totalPay}`);

    // Update shift with clock_out, hours_worked, payday_type, and payment info
    const updateQuery = `
      UPDATE shifts
      SET clock_out = NOW(),
          hours_worked = ?,
          payday_type = ?,
          applied_rate = ?,
          total_pay = ?,
          shift_state = 'COMPLETED'
      WHERE id = ?
    `;

    await db.execute(updateQuery, [hoursWorked, paydayType, appliedRate, totalPay, id]);

    console.log(`[KIOSK CLOCKOUT] ✅ Shift ${id} clocked out successfully`);
    res.json({
      success: true,
      message: "Shift completed",
      shift: {
        shift_id: id,
        clock_in: shift.clock_in,
        clock_out: clockOut.toISOString(),
        break_minutes: shift.break_minutes || 0,
        hours_worked: hoursWorked,
        payday_type: paydayType,
        applied_rate: appliedRate,
        total_pay: totalPay,
        shift_state: "COMPLETED"
      }
    });
  } catch (err) {
    console.error(`[KIOSK CLOCKOUT] ❌ Error:`, err.message);
    console.error(`[KIOSK CLOCKOUT] ❌ Stack:`, err.stack);
    res.status(500).json({ success: false, error: err.message || "Failed to clock out" });
  }
});

// ===== Offline Queue Sync Endpoint =====

/**
 * Bulk sync endpoint for offline event queue
 * Handles multiple queued events (clockin/out, breakin/out) in a single transaction
 * Provides idempotency via sync_log table
 */
router.post('/sync', async (req, res) => {
  const events = req.body;

  // Validate input
  if (!Array.isArray(events) || events.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'No events to sync - expected array of events'
    });
  }

  console.log(`🔄 Sync request received: ${events.length} events`);

  const results = [];
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();
    console.log('📦 Transaction started');

    for (const event of events) {
      const { offline_id, type, data, timestamp } = event;

      // Validate event structure
      if (!offline_id || !type || !data || !timestamp) {
        results.push({
          offline_id: offline_id || 'unknown',
          status: 'failed',
          error: 'Missing required fields (offline_id, type, data, timestamp)'
        });
        continue;
      }

      const { shift_id, staff_code, venue_code } = data;

      try {
        // Check if event already processed (idempotency check)
        const [dupes] = await connection.execute(
          'SELECT id, status FROM sync_log WHERE offline_id = ?',
          [offline_id]
        );

        if (dupes.length > 0) {
          console.log(`⚠️  Duplicate event detected: ${offline_id} (already ${dupes[0].status})`);
          results.push({ offline_id, status: 'duplicate' });
          continue;
        }

        // Process event based on type
        switch (type) {
          case 'clockin':
            // Validate required fields
            if (!staff_code || !venue_code) {
              throw new Error('Missing staff_code or venue_code for clockin');
            }

            // Check for existing active shift (Step 3: Conflict Detection)
            const [existingShifts] = await connection.execute(
              'SELECT id, shift_state FROM shifts WHERE staff_code = ? AND shift_state IN ("ACTIVE", "ON_BREAK") LIMIT 1',
              [staff_code]
            );

            if (existingShifts.length > 0) {
              // Return conflict status instead of error
              console.warn(`⚠️  Sync conflict: Staff ${staff_code} already has active shift ${existingShifts[0].id}`);

              // Log conflict to sync_log
              await connection.execute(`
                INSERT INTO sync_log (offline_id, staff_code, type, timestamp, status, error_message)
                VALUES (?, ?, ?, ?, 'conflict', ?)
              `, [offline_id, staff_code, type, timestamp, `Staff already has active shift: ${existingShifts[0].id}`]);

              results.push({
                offline_id,
                status: 'conflict',
                error: 'Staff already has an active shift',
                existing_shift_id: existingShifts[0].id
              });
              continue; // Skip to next event
            }

            // Create new shift
            await connection.execute(`
              INSERT INTO shifts (staff_code, venue_code, clock_in, shift_state, last_action_time)
              VALUES (?, ?, ?, 'ACTIVE', ?)
            `, [staff_code, venue_code, timestamp, timestamp]);

            console.log(`✅ Synced clockin: ${staff_code} @ ${venue_code}`);
            break;

          case 'clockout':
            // Validate required fields
            if (!shift_id) {
              throw new Error('Missing shift_id for clockout');
            }

            // Get shift details for pay calculation including business_code
            const [shifts] = await connection.execute(`
              SELECT s.*, v.business_code,
                     pr.weekday_rate, pr.saturday_rate, pr.sunday_rate, pr.public_holiday_rate
              FROM shifts s
              LEFT JOIN pay_rates pr ON s.staff_code = pr.staff_code
              LEFT JOIN venues v ON s.venue_code = v.venue_code
              WHERE s.id = ? AND s.shift_state IN ('ACTIVE', 'ON_BREAK')
              LIMIT 1
            `, [shift_id]);

            if (shifts.length === 0) {
              throw new Error('Shift not found or already completed');
            }

            const shift = shifts[0];
            const clockIn = new Date(shift.clock_in);
            const clockOut = new Date(timestamp);

            // Calculate hours worked (minus breaks)
            const totalHours = (clockOut - clockIn) / (1000 * 60 * 60);
            const breakHours = (shift.break_minutes || 0) / 60;
            const hoursWorked = Math.round((totalHours - breakHours) * 100) / 100;

            // Determine payday_type based on date and holidays
            const paydayType = await determinePaydayType(clockIn, shift.business_code);

            // Calculate pay using the utility
            const syncRates = {
              weekday_rate: shift.weekday_rate,
              saturday_rate: shift.saturday_rate,
              sunday_rate: shift.sunday_rate,
              public_holiday_rate: shift.public_holiday_rate
            };

            const { appliedRate, totalPay } = calculateShiftPay({
              hoursWorked,
              paydayType,
              rates: syncRates
            });

            // Update shift
            await connection.execute(`
              UPDATE shifts
              SET clock_out = ?, hours_worked = ?, payday_type = ?, applied_rate = ?, total_pay = ?, shift_state = 'COMPLETED'
              WHERE id = ?
            `, [timestamp, hoursWorked, paydayType, appliedRate, totalPay, shift_id]);

            console.log(`✅ Synced clockout: Shift ${shift_id} → ${hoursWorked}h @ $${appliedRate} = $${totalPay} [${paydayType}]`);
            break;

          case 'breakin':
            // Validate required fields
            if (!shift_id) {
              throw new Error('Missing shift_id for breakin');
            }

            const [breakinResult] = await connection.execute(`
              UPDATE shifts
              SET shift_state = 'ON_BREAK', last_action_time = ?
              WHERE id = ? AND shift_state = 'ACTIVE'
            `, [timestamp, shift_id]);

            if (breakinResult.affectedRows === 0) {
              throw new Error('Shift not in ACTIVE state or not found');
            }

            console.log(`✅ Synced breakin: Shift ${shift_id}`);
            break;

          case 'breakout':
            // Validate required fields
            if (!shift_id) {
              throw new Error('Missing shift_id for breakout');
            }

            const [breakoutResult] = await connection.execute(`
              UPDATE shifts
              SET break_minutes = break_minutes + TIMESTAMPDIFF(MINUTE, last_action_time, ?),
                  shift_state = 'ACTIVE',
                  last_action_time = ?
              WHERE id = ? AND shift_state = 'ON_BREAK'
            `, [timestamp, timestamp, shift_id]);

            if (breakoutResult.affectedRows === 0) {
              throw new Error('Shift not in ON_BREAK state or not found');
            }

            console.log(`✅ Synced breakout: Shift ${shift_id}`);
            break;

          default:
            throw new Error(`Unknown event type: ${type}`);
        }

        // Log successful sync to sync_log
        await connection.execute(`
          INSERT INTO sync_log (offline_id, staff_code, type, timestamp, status)
          VALUES (?, ?, ?, ?, 'synced')
        `, [offline_id, staff_code || 'unknown', type, timestamp]);

        results.push({ offline_id, status: 'synced' });

      } catch (eventError) {
        console.error(`❌ Event processing failed: ${offline_id}`, eventError.message);

        // Log failed event to sync_log
        try {
          await connection.execute(`
            INSERT INTO sync_log (offline_id, staff_code, type, timestamp, status, error_message)
            VALUES (?, ?, ?, ?, 'failed', ?)
          `, [offline_id, staff_code || 'unknown', type, timestamp, eventError.message]);
        } catch (logError) {
          console.error('Failed to log error to sync_log:', logError);
        }

        results.push({
          offline_id,
          status: 'failed',
          error: eventError.message
        });
      }
    }

    await connection.commit();
    const syncedCount = results.filter(r => r.status === 'synced').length;
    const failedCount = results.filter(r => r.status === 'failed').length;
    const duplicateCount = results.filter(r => r.status === 'duplicate').length;
    const conflictCount = results.filter(r => r.status === 'conflict').length;

    console.log(`✅ Transaction committed: ${syncedCount} synced, ${failedCount} failed, ${duplicateCount} duplicate, ${conflictCount} conflict`);

    res.json({
      success: true,
      results,
      summary: {
        total: events.length,
        synced: syncedCount,
        failed: failedCount,
        duplicate: duplicateCount,
        conflict: conflictCount
      }
    });

  } catch (err) {
    await connection.rollback();
    console.error('❌ Transaction rollback - global sync error:', err);
    res.status(500).json({
      success: false,
      error: 'Sync transaction failed',
      details: err.message
    });
  } finally {
    connection.release();
  }
});

module.exports = router;
