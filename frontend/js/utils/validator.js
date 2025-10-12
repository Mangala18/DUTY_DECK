/**
 * Validator Utility Module
 * Robust validators and form validation helpers
 */

export const Validator = {
  /**
   * Validate email format
   * @param {string} v - Email to validate
   * @returns {boolean} True if valid email
   */
  isEmail(v) {
    return /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/.test((v || '').trim());
  },

  /**
   * Validate Australian BSB format (XXX-XXX)
   * @param {string} v - BSB to validate
   * @returns {boolean} True if valid BSB
   */
  isBSB(v) {
    return /^\d{3}-?\d{3}$/.test((v || '').trim());
  },

  /**
   * Validate staff code format (3-25 alphanumeric characters)
   * @param {string} v - Staff code to validate
   * @returns {boolean} True if valid staff code
   */
  isStaffCode(v) {
    return /^[A-Z0-9]{3,25}$/.test((v || '').trim());
  },

  /**
   * Validate positive number
   * @param {string|number} v - Value to validate
   * @returns {boolean} True if positive number
   */
  isPositiveNumber(v) {
    const n = parseFloat(v);
    return !Number.isNaN(n) && n > 0;
  },

  /**
   * Validate minimum length
   * @param {string} v - Value to validate
   * @param {number} min - Minimum length
   * @returns {boolean} True if meets minimum length
   */
  minLength(v, min) {
    return (v || '').trim().length >= min;
  },

  /**
   * Validate maximum length
   * @param {string} v - Value to validate
   * @param {number} max - Maximum length
   * @returns {boolean} True if within maximum length
   */
  maxLength(v, max) {
    return (v || '').trim().length <= max;
  },

  /**
   * Validate phone number (6-15 digits, optional + prefix)
   * @param {string} v - Phone number to validate
   * @returns {boolean} True if valid phone
   */
  isPhone(v) {
    return /^\+?\d{6,15}$/.test((v || '').trim().replace(/[\s()-]/g, ''));
  },

  /**
   * Check if value is required (not empty)
   * @param {string} v - Value to check
   * @returns {boolean} True if not empty
   */
  required(v) {
    return v != null && (v + '').trim() !== '';
  },

  /**
   * Validate generic form fields
   * @param {Object} fields - Object with fieldId as key and array of rules as value
   * @returns {Object} Object with fieldId as key and error message as value
   *
   * @example
   * const errors = Validator.validateForm({
   *   email: [
   *     { check: v => Validator.required(v), message: 'Email is required' },
   *     { check: v => Validator.isEmail(v), message: 'Invalid email format' }
   *   ],
   *   staff_code: [
   *     { check: v => Validator.isStaffCode(v), message: 'Invalid staff code' }
   *   ]
   * });
   */
  validateForm(fields) {
    const errors = {};
    for (const [name, rules] of Object.entries(fields)) {
      const field = document.getElementById(name);
      const val = field ? field.value : '';

      for (const rule of rules) {
        if (!rule.check(val)) {
          errors[name] = rule.message;
          break; // Stop at first error for this field
        }
      }
    }
    return errors; // {} if no errors
  }
};

export default Validator;
