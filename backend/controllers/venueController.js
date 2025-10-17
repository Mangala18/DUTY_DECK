const bcrypt = require('bcryptjs');
const db = require('../config/db');

/**
 * Add a new venue
 * POST /api/system-admin/venues
 */
const addVenue = async (req, res) => {
  try {
    const {
      business_code,
      venue_code,
      venue_name,
      contact_email,
      kiosk_password,
      state,
      venue_address,
      timezone,
      week_start
    } = req.body;

    // Validation
    if (!business_code || !venue_code || !venue_name || !contact_email || !kiosk_password) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: business_code, venue_code, venue_name, contact_email, kiosk_password'
      });
    }

    // Validate venue_code length (max 8 characters)
    if (venue_code.length > 8) {
      return res.status(400).json({
        success: false,
        error: 'Venue code must be 8 characters or less'
      });
    }

    // Check if venue_code already exists
    const [existingVenue] = await db.execute(
      'SELECT venue_code FROM venues WHERE venue_code = ? AND business_code = ?',
      [venue_code, business_code]
    );

    if (existingVenue.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Venue code already exists'
      });
    }

    // Hash the kiosk password before insert
    const hashedPassword = await bcrypt.hash(kiosk_password, 10);

    // Insert venue into database
    const [result] = await db.execute(
      `INSERT INTO venues
        (business_code, venue_code, venue_name, contact_email, kiosk_password, state, venue_address, timezone, week_start, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [business_code, venue_code, venue_name, contact_email, hashedPassword, state, venue_address, timezone, week_start]
    );

    console.log(`✅ Venue created: ${venue_code} (ID: ${result.insertId})`);

    res.json({
      success: true,
      id: result.insertId,
      message: 'Venue added successfully'
    });

  } catch (error) {
    console.error('❌ Error adding venue:', error);

    // Handle duplicate key error
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        error: 'Venue code already exists'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Database insert failed: ' + error.message
    });
  }
};

/**
 * Update an existing venue
 * PUT /api/system-admin/venues/:venue_code
 */
const updateVenue = async (req, res) => {
  try {
    const { venue_code } = req.params;
    const {
      venue_name,
      contact_email,
      kiosk_password,
      state,
      venue_address,
      timezone,
      week_start,
      status
    } = req.body;

    // Build dynamic update query
    const updates = [];
    const values = [];

    if (venue_name !== undefined) {
      updates.push('venue_name = ?');
      values.push(venue_name);
    }
    if (contact_email !== undefined) {
      updates.push('contact_email = ?');
      values.push(contact_email);
    }
    if (kiosk_password !== undefined && kiosk_password !== '') {
      const hashedPassword = await bcrypt.hash(kiosk_password, 10);
      updates.push('kiosk_password = ?');
      values.push(hashedPassword);
    }
    if (state !== undefined) {
      updates.push('state = ?');
      values.push(state);
    }
    if (venue_address !== undefined) {
      updates.push('venue_address = ?');
      values.push(venue_address);
    }
    if (timezone !== undefined) {
      updates.push('timezone = ?');
      values.push(timezone);
    }
    if (week_start !== undefined) {
      updates.push('week_start = ?');
      values.push(week_start);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update'
      });
    }

    values.push(venue_code);

    const [result] = await db.execute(
      `UPDATE venues SET ${updates.join(', ')} WHERE venue_code = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Venue not found'
      });
    }

    console.log(`✅ Venue updated: ${venue_code}`);

    res.json({
      success: true,
      message: 'Venue updated successfully'
    });

  } catch (error) {
    console.error('❌ Error updating venue:', error);
    res.status(500).json({
      success: false,
      error: 'Database update failed: ' + error.message
    });
  }
};

/**
 * Delete a venue
 * DELETE /api/system-admin/venues/:venue_code
 */
const deleteVenue = async (req, res) => {
  try {
    const { venue_code } = req.params;

    // Check if venue has staff assigned
    const [staff] = await db.execute(
      'SELECT COUNT(*) as count FROM staff WHERE venue_code = ?',
      [venue_code]
    );

    if (staff[0].count > 0) {
      return res.status(400).json({
        success: false,
        error: `Cannot delete venue: ${staff[0].count} staff member(s) are assigned to this venue. Please reassign them first.`
      });
    }

    // Delete venue
    const [result] = await db.execute(
      'DELETE FROM venues WHERE venue_code = ?',
      [venue_code]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        error: 'Venue not found'
      });
    }

    console.log(`✅ Venue deleted: ${venue_code}`);

    res.json({
      success: true,
      message: 'Venue deleted successfully'
    });

  } catch (error) {
    console.error('❌ Error deleting venue:', error);
    res.status(500).json({
      success: false,
      error: 'Database delete failed: ' + error.message
    });
  }
};

/**
 * Get a single venue by venue_code
 * GET /api/system-admin/venues/:venue_code
 */
const getVenueByCode = async (req, res) => {
  try {
    const { venue_code } = req.params;

    const [rows] = await db.execute(
      'SELECT * FROM venues WHERE venue_code = ?',
      [venue_code]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Venue not found'
      });
    }

    console.log(`✅ Venue fetched: ${venue_code}`);

    res.json({
      success: true,
      data: rows[0]
    });

  } catch (error) {
    console.error('❌ Error fetching venue:', error);
    res.status(500).json({
      success: false,
      error: 'Database fetch failed: ' + error.message
    });
  }
};

module.exports = {
  addVenue,
  updateVenue,
  deleteVenue,
  getVenueByCode
};