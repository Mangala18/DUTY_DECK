const express = require('express');
const router = express.Router();

/**
 * Central Route Index
 * All API routes are mounted here
 */

// Import route modules
const authRoutes = require('./auth');
const masterRoutes = require('./masterRoutes');
const systemAdminRoutes = require('./systemAdminRoutes');
const staffRoutes = require('./staffRoutes');
const kioskRoutes = require('./kiosk');
const dashboardRoutes = require('./dashboardRoutes');

// Mount routes
router.use('/', authRoutes);                        // POST /api/login, /api/logout (at root level)
router.use('/master', masterRoutes);                // Master admin routes
router.use('/system-admin', systemAdminRoutes);     // System admin routes (legacy)
router.use('/system-admin/dashboard', dashboardRoutes); // Dashboard metrics
router.use('/staff', staffRoutes);                  // Shared staff management routes
router.use('/kiosk', kioskRoutes);                  // Kiosk clock-in/out routes

module.exports = router;
