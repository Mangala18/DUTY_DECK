const Joi = require('joi');

/**
 * Consolidated Validation Schemas for Master Admin Panel
 * All schemas for master.html and masterRoutes.js endpoints
 */

// ============================
// BUSINESS SCHEMAS
// ============================

/**
 * Schema for creating a new business
 * Used in: POST /api/master/business
 */
const businessSchema = Joi.object({
  code: Joi.string().pattern(/^[0-9]+$/).max(10).required()
    .messages({
      'string.pattern.base': 'Business code must contain only numbers',
      'string.max': 'Business code cannot exceed 10 characters',
      'any.required': 'Business code is required'
    }),

  name: Joi.string().max(100).required()
    .messages({
      'any.required': 'Business name is required'
    })
});

/**
 * Schema for updating a business
 * Note: business_code is NOT editable (immutable primary key)
 * Used in: PUT /api/master/business/:business_code
 */
const businessUpdateSchema = Joi.object({
  name: Joi.string().max(100).required()
    .messages({
      'any.required': 'Business name is required'
    })
});

// ============================
// VENUE + SYSTEM ADMIN SCHEMAS
// ============================

/**
 * Schema for creating a new venue with system admin
 * Used in: POST /api/master/venue-with-admin
 */
const venueSysAdminSchema = Joi.object({
  // Venue Details
  business_code: Joi.string().pattern(/^[0-9]+$/).max(10).required()
    .messages({
      'string.pattern.base': 'Business code must contain only numbers',
      'string.max': 'Business code cannot exceed 10 characters',
      'any.required': 'Business code is required'
    }),

  venue_code: Joi.string().pattern(/^[0-9]+$/).max(8).required()
    .messages({
      'string.pattern.base': 'Venue code must contain only numbers',
      'string.max': 'Venue code cannot exceed 8 characters',
      'any.required': 'Venue code is required'
    }),

  venue_name: Joi.string().max(150).required()
    .messages({
      'any.required': 'Venue name is required'
    }),

  venue_address: Joi.string().max(150).required()
    .messages({
      'any.required': 'Venue address is required'
    }),

  state: Joi.string().valid('TAS','NSW','VIC','QLD','WA','SA','ACT','NT').required()
    .messages({
      'any.only': 'Invalid state',
      'any.required': 'State is required'
    }),

  timezone: Joi.string().max(150).required()
    .messages({
      'any.required': 'Timezone is required'
    }),

  week_start: Joi.string().valid('Mon','Tue','Wed','Thu','Fri','Sat','Sun').default('Mon'),

  // Kiosk Details
  contact_email: Joi.string().email().required()
    .messages({
      'string.email': 'Contact email must be valid',
      'any.required': 'Contact email is required'
    }),

  kiosk_password: Joi.string().min(8).required()
    .messages({
      'string.min': 'Kiosk password must be at least 8 characters',
      'any.required': 'Kiosk password is required'
    }),

  // System Admin
  staff_code: Joi.string().pattern(/^[0-9]+$/).max(8).required()
    .messages({
      'string.pattern.base': 'Staff code must contain only numbers',
      'string.max': 'Staff code cannot exceed 8 characters',
      'any.required': 'Staff code is required'
    }),

  first_name: Joi.string().max(50).required(),
  middle_name: Joi.string().max(50).allow('').optional(),
  last_name: Joi.string().max(50).required(),

  email: Joi.string().email().required()
    .messages({
      'string.email': 'System admin email must be valid',
      'any.required': 'System admin email is required'
    }),

  password: Joi.string().min(8).required()
    .messages({
      'string.min': 'System admin password must be at least 8 characters',
      'any.required': 'System admin password is required'
    })
});

/**
 * Schema for updating a venue with system admin
 * Note: venue_code, business_code, staff_code are NOT editable (immutable)
 * Note: passwords are NOT editable via this endpoint
 * Used in: PUT /api/master/venue-with-admin/:venue_code
 */
const venueAdminUpdateSchema = Joi.object({
  // Venue Details (editable fields only)
  venue_name: Joi.string().max(150).required()
    .messages({
      'any.required': 'Venue name is required'
    }),

  venue_address: Joi.string().max(150).required()
    .messages({
      'any.required': 'Venue address is required'
    }),

  state: Joi.string().valid('TAS','NSW','VIC','QLD','WA','SA','ACT','NT').required()
    .messages({
      'any.only': 'Invalid state',
      'any.required': 'State is required'
    }),

  timezone: Joi.string().max(150).required()
    .messages({
      'any.required': 'Timezone is required'
    }),

  week_start: Joi.string().valid('Mon','Tue','Wed','Thu','Fri','Sat','Sun').default('Mon'),

  // Kiosk Details
  contact_email: Joi.string().email().required()
    .messages({
      'string.email': 'Contact email must be valid',
      'any.required': 'Contact email is required'
    }),

  // System Admin (editable fields only - no password)
  first_name: Joi.string().max(50).required(),
  middle_name: Joi.string().max(50).allow('').optional(),
  last_name: Joi.string().max(50).required(),

  email: Joi.string().email().required()
    .messages({
      'string.email': 'System admin email must be valid',
      'any.required': 'System admin email is required'
    })
});

// ============================
// STAFF SCHEMAS
// ============================

/**
 * Schema for general staff (non-admin employees)
 * Used for future staff management endpoints
 */
const staffSchema = Joi.object({
  staff_code: Joi.string().pattern(/^[0-9]+$/).max(8).required()
    .messages({
      'string.pattern.base': 'Staff code must contain only numbers',
      'string.max': 'Staff code cannot exceed 8 characters',
      'any.required': 'Staff code is required'
    }),

  business_code: Joi.string().pattern(/^[0-9]+$/).max(10).required()
    .messages({
      'string.pattern.base': 'Business code must contain only numbers',
      'any.required': 'Business code is required'
    }),

  venue_code: Joi.string().pattern(/^[0-9]+$/).max(8).required()
    .messages({
      'string.pattern.base': 'Venue code must contain only numbers',
      'any.required': 'Venue code is required'
    }),

  first_name: Joi.string().max(50).required(),
  middle_name: Joi.string().max(50).allow('').optional(),
  last_name: Joi.string().max(50).required(),

  email: Joi.string().email().allow(null, '').optional(),
  phone_number: Joi.string().pattern(/^[0-9+\-\s]+$/).max(30).allow(null, '').optional()
    .messages({
      'string.pattern.base': 'Phone number must contain only numbers, +, -, and spaces'
    }),

  employment_status: Joi.string().valid('active','inactive','terminated').default('active'),
  employment_type: Joi.string().valid('full_time','part_time','casual','contract').default('full_time'),
  role_title: Joi.string().max(50).allow(null, '').optional(),
  start_date: Joi.date().allow(null, '').optional()
});

// ============================
// EXPORTS
// ============================

module.exports = {
  businessSchema,
  businessUpdateSchema,
  venueSysAdminSchema,
  venueAdminUpdateSchema,
  staffSchema
};