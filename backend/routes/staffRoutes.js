const express = require("express");
const router = express.Router();
const { requireStaffManagementAccess } = require('../middleware/authMiddleware');
const staffController = require('../controllers/staffController');

/**
 * Staff Routes
 * All routes require staff management access (system_admin, manager, supervisor)
 */

// Get all venues accessible to the user
router.get('/venues', requireStaffManagementAccess, staffController.getVenues);

// Get all staff with role-based filtering
router.get('/', requireStaffManagementAccess, staffController.getStaffList);

// Get single staff member details
router.get('/:staff_code', requireStaffManagementAccess, staffController.getStaffDetails);

// Add new staff member (TODO: implement in controller)
router.post('/', requireStaffManagementAccess, staffController.addStaff);

// Update staff member (TODO: implement in controller)
router.put('/:staff_code', requireStaffManagementAccess, staffController.updateStaff);

// Delete staff member (TODO: implement in controller)
router.delete('/:staff_code', requireStaffManagementAccess, staffController.deleteStaff);

module.exports = router;
