const express = require("express");
const router = express.Router();
const db = require("../config/db");

/**
 * Admin/Staff Login Endpoint
 * POST /api/login
 * Authenticates users based on username and password
 */
router.post("/login", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      error: "Username and password are required"
    });
  }

  // Query to get user with staff details
  // Note: business_code and venue_code now come from staff table via JOIN
  const sql = `
    SELECT
      u.id,
      u.email as username,
      u.password_hash,
      u.access_level,
      u.staff_code,
      u.kiosk_pin,
      u.status,
      s.business_code,
      s.venue_code,
      s.staff_type,
      s.first_name,
      s.middle_name,
      s.last_name,
      v.venue_name,
      b.business_name
    FROM users u
    LEFT JOIN staff s ON u.staff_code = s.staff_code
    LEFT JOIN venues v ON s.venue_code = v.venue_code
    LEFT JOIN businesses b ON s.business_code = b.business_code
    WHERE u.email = ? AND u.status = 'active'
  `;

  db.query(sql, [username], (err, results) => {
    if (err) {
      console.error("Database error during login:", err);
      return res.status(500).json({
        success: false,
        error: "An error occurred during login"
      });
    }

    if (!results || results.length === 0) {
      return res.status(401).json({
        success: false,
        error: "Invalid username or password"
      });
    }

    const user = results[0];

    // TODO: In production, use bcrypt to compare hashed passwords
    // For now, comparing plain text (NOT SECURE - must implement bcrypt)
    if (user.password_hash !== password) {
      return res.status(401).json({
        success: false,
        error: "Invalid username or password"
      });
    }

    // Login successful - return user data (excluding sensitive info)
    res.json({
      success: true,
      id: user.id,
      username: user.username,
      access_level: user.access_level,
      staff_code: user.staff_code,
      business_code: user.business_code,
      venue_code: user.venue_code,
      first_name: user.first_name,
      middle_name: user.middle_name,
      last_name: user.last_name,
      venue_name: user.venue_name,
      business_name: user.business_name,
      full_name: `${user.first_name} ${user.last_name}`.trim()
    });
  });
});

/**
 * Logout Endpoint (placeholder for future session management)
 * POST /api/logout
 */
router.post("/logout", (req, res) => {
  // For now, just return success
  // In production, clear session/token here
  res.json({ success: true, message: "Logged out successfully" });
});

module.exports = router;