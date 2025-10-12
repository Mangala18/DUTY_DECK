// ============================
// UTILITY FUNCTIONS
// ============================

/**
 * Safe HTML helper to prevent XSS attacks
 * Converts plain text to HTML-safe text by escaping special characters
 * Use this function when inserting user-generated content into the DOM
 *
 * @param {string} str - The string to sanitize
 * @returns {string} - HTML-safe string
 *
 * @example
 * element.innerHTML = safeHTML(userInput);
 */
function safeHTML(str) {
  if (str === null || str === undefined) {
    return '';
  }

  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Safely insert HTML content into an element
 * Only use this when you need to insert actual HTML (not user content)
 * For user content, always use safeHTML() instead
 *
 * @param {HTMLElement} element - The element to insert into
 * @param {string} htmlString - The HTML string to insert
 */
function setInnerHTML(element, htmlString) {
  element.innerHTML = htmlString;
}

/**
 * Create a text node safely (alternative to safeHTML)
 *
 * @param {string} text - The text content
 * @returns {Text} - A text node
 */
function createTextNode(text) {
  return document.createTextNode(text || '');
}

/**
 * Escape HTML special characters
 * Alternative implementation of safeHTML
 *
 * @param {string} str - String to escape
 * @returns {string} - Escaped string
 */
function escapeHTML(str) {
  if (str === null || str === undefined) {
    return '';
  }

  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;'
  };

  return String(str).replace(/[&<>"'/]/g, (char) => map[char]);
}

/**
 * Validate email format
 *
 * @param {string} email - Email to validate
 * @returns {boolean} - True if valid email format
 */
function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone number format (Australian)
 *
 * @param {string} phone - Phone number to validate
 * @returns {boolean} - True if valid phone format
 */
function isValidPhone(phone) {
  // Australian phone format: +61 or 04xx xxx xxx
  const phoneRegex = /^(\+61|0)[2-478](\d{8}|\s?\d{4}\s?\d{4})$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
}

/**
 * Show Bootstrap toast notification
 *
 * @param {string} message - Message to display
 * @param {string} type - Type of toast: 'success', 'error', 'info', 'warning'
 */
function showToast(message, type = 'info') {
  // Create toast container if it doesn't exist
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'position-fixed top-0 end-0 p-3';
    container.style.zIndex = '9999';
    document.body.appendChild(container);
  }

  // Map type to Bootstrap color classes
  const typeMap = {
    success: 'bg-success text-white',
    error: 'bg-danger text-white',
    info: 'bg-info text-white',
    warning: 'bg-warning text-dark'
  };

  const bgClass = typeMap[type] || typeMap.info;

  // Create toast element
  const toastId = `toast-${Date.now()}`;
  const toastHTML = `
    <div id="${toastId}" class="toast ${bgClass}" role="alert" aria-live="assertive" aria-atomic="true">
      <div class="toast-header ${bgClass}">
        <strong class="me-auto">${type.charAt(0).toUpperCase() + type.slice(1)}</strong>
        <button type="button" class="btn-close ${type === 'warning' ? '' : 'btn-close-white'}" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
      <div class="toast-body">
        ${escapeHTML(message)}
      </div>
    </div>
  `;

  container.insertAdjacentHTML('beforeend', toastHTML);

  // Initialize and show toast
  const toastElement = document.getElementById(toastId);
  const toast = new bootstrap.Toast(toastElement, { autohide: true, delay: 4000 });
  toast.show();

  // Remove from DOM after hidden
  toastElement.addEventListener('hidden.bs.toast', () => {
    toastElement.remove();
  });
}

/**
 * Format date to locale string
 *
 * @param {string|Date} date - Date to format
 * @returns {string} - Formatted date string
 */
function formatDate(date) {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-AU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Format datetime to locale string
 *
 * @param {string|Date} datetime - Datetime to format
 * @returns {string} - Formatted datetime string
 */
function formatDateTime(datetime) {
  if (!datetime) return 'N/A';
  return new Date(datetime).toLocaleString('en-AU', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// ============================
// FORM VALIDATION
// ============================

/**
 * Validate a single form field and show Bootstrap validation feedback
 *
 * @param {HTMLInputElement} field - The input field to validate
 * @param {Function} validatorFn - Validation function that returns boolean
 * @param {string} errorMessage - Error message to display
 * @returns {boolean} - True if valid
 */
function validateField(field, validatorFn, errorMessage) {
  const value = field.value.trim();
  const isValid = validatorFn(value);

  if (isValid) {
    field.classList.remove('is-invalid');
    field.classList.add('is-valid');

    // Remove existing error message
    const feedback = field.parentElement.querySelector('.invalid-feedback');
    if (feedback) feedback.remove();
  } else {
    field.classList.remove('is-valid');
    field.classList.add('is-invalid');

    // Add or update error message
    let feedback = field.parentElement.querySelector('.invalid-feedback');
    if (!feedback) {
      feedback = document.createElement('div');
      feedback.className = 'invalid-feedback';
      field.parentElement.appendChild(feedback);
    }
    feedback.textContent = errorMessage;
  }

  return isValid;
}

/**
 * Validate required field (not empty)
 *
 * @param {string} value - Value to check
 * @returns {boolean} - True if not empty
 */
function isRequired(value) {
  return value !== null && value !== undefined && value.trim().length > 0;
}

/**
 * Validate minimum length
 *
 * @param {string} value - Value to check
 * @param {number} minLength - Minimum length
 * @returns {boolean} - True if meets minimum
 */
function minLength(value, minLength) {
  return value.trim().length >= minLength;
}

/**
 * Validate maximum length
 *
 * @param {string} value - Value to check
 * @param {number} maxLength - Maximum length
 * @returns {boolean} - True if within maximum
 */
function maxLength(value, maxLength) {
  return value.trim().length <= maxLength;
}

/**
 * Validate numeric input
 *
 * @param {string} value - Value to check
 * @returns {boolean} - True if numeric
 */
function isNumeric(value) {
  return !isNaN(value) && !isNaN(parseFloat(value));
}

/**
 * Validate positive number
 *
 * @param {string} value - Value to check
 * @returns {boolean} - True if positive number
 */
function isPositive(value) {
  return isNumeric(value) && parseFloat(value) > 0;
}

/**
 * Validate BSB format (6 digits, XXX-XXX)
 *
 * @param {string} bsb - BSB to validate
 * @returns {boolean} - True if valid BSB format
 */
function isValidBSB(bsb) {
  const bsbRegex = /^\d{3}-?\d{3}$/;
  return bsbRegex.test(bsb);
}

/**
 * Validate Australian account number (6-9 digits)
 *
 * @param {string} accountNumber - Account number to validate
 * @returns {boolean} - True if valid account number
 */
function isValidAccountNumber(accountNumber) {
  const accountRegex = /^\d{6,9}$/;
  return accountRegex.test(accountNumber);
}

/**
 * Validate password strength (min 8 chars, 1 uppercase, 1 lowercase, 1 number)
 *
 * @param {string} password - Password to validate
 * @returns {boolean} - True if meets requirements
 */
function isStrongPassword(password) {
  return password.length >= 8 &&
         /[A-Z]/.test(password) &&
         /[a-z]/.test(password) &&
         /[0-9]/.test(password);
}

/**
 * Generic form validator
 * Validates all fields in a form based on validation rules
 *
 * @param {HTMLFormElement} form - The form to validate
 * @param {Object} rules - Validation rules object
 * @returns {boolean} - True if all fields are valid
 *
 * @example
 * const rules = {
 *   email: { validator: isValidEmail, message: 'Invalid email' },
 *   phone: { validator: isValidPhone, message: 'Invalid phone number' }
 * };
 * if (validateForm(form, rules)) { submitForm(); }
 */
function validateForm(form, rules) {
  let isValid = true;

  Object.keys(rules).forEach(fieldName => {
    const field = form.elements[fieldName];
    if (!field) return;

    const rule = rules[fieldName];
    const fieldValid = validateField(field, rule.validator, rule.message);

    if (!fieldValid) {
      isValid = false;
    }
  });

  return isValid;
}

/**
 * Clear all validation states from a form
 *
 * @param {HTMLFormElement} form - The form to clear
 */
function clearValidation(form) {
  const fields = form.querySelectorAll('.is-valid, .is-invalid');
  fields.forEach(field => {
    field.classList.remove('is-valid', 'is-invalid');
  });

  const feedbacks = form.querySelectorAll('.invalid-feedback');
  feedbacks.forEach(feedback => feedback.remove());
}

/**
 * Set up real-time validation for a form field
 *
 * @param {HTMLInputElement} field - The field to validate
 * @param {Function} validatorFn - Validation function
 * @param {string} errorMessage - Error message
 */
function setupFieldValidation(field, validatorFn, errorMessage) {
  field.addEventListener('blur', () => {
    validateField(field, validatorFn, errorMessage);
  });

  field.addEventListener('input', () => {
    // Clear invalid state on input
    if (field.classList.contains('is-invalid')) {
      field.classList.remove('is-invalid');
      const feedback = field.parentElement.querySelector('.invalid-feedback');
      if (feedback) feedback.remove();
    }
  });
}
