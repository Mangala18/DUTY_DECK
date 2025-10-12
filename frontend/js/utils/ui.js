/**
 * UI Utility Module
 * Provides user feedback mechanisms (toasts, loading states, error displays)
 */

/**
 * Show a Bootstrap toast notification
 * @param {string} message - Message to display
 * @param {string} type - Toast type: 'success', 'error', 'warning', 'info'
 * @param {number} duration - Duration in milliseconds (default: 3000)
 */
export function showToast(message, type = 'info', duration = 3000) {
  // Create toast container if it doesn't exist
  let toastContainer = document.getElementById('toastContainer');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'toastContainer';
    toastContainer.className = 'toast-container position-fixed top-0 end-0 p-3';
    toastContainer.style.zIndex = '9999';
    document.body.appendChild(toastContainer);
  }

  // Map type to Bootstrap classes
  const typeClasses = {
    success: 'bg-success text-white',
    error: 'bg-danger text-white',
    warning: 'bg-warning text-dark',
    info: 'bg-info text-white'
  };

  const typeIcons = {
    success: 'bi-check-circle-fill',
    error: 'bi-exclamation-circle-fill',
    warning: 'bi-exclamation-triangle-fill',
    info: 'bi-info-circle-fill'
  };

  const bgClass = typeClasses[type] || typeClasses.info;
  const icon = typeIcons[type] || typeIcons.info;

  // Create toast element
  const toastEl = document.createElement('div');
  toastEl.className = 'toast';
  toastEl.setAttribute('role', 'alert');
  toastEl.setAttribute('aria-live', 'assertive');
  toastEl.setAttribute('aria-atomic', 'true');

  toastEl.innerHTML = `
    <div class="toast-header ${bgClass}">
      <i class="bi ${icon} me-2"></i>
      <strong class="me-auto">${type.charAt(0).toUpperCase() + type.slice(1)}</strong>
      <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast" aria-label="Close"></button>
    </div>
    <div class="toast-body">
      ${message}
    </div>
  `;

  toastContainer.appendChild(toastEl);

  // Initialize and show toast
  const bsToast = new bootstrap.Toast(toastEl, { delay: duration });
  bsToast.show();

  // Remove toast element after it's hidden
  toastEl.addEventListener('hidden.bs.toast', () => {
    toastEl.remove();
  });
}

/**
 * Show loading spinner in a specific element
 * @param {string} targetId - ID of target element
 * @param {string} message - Loading message (optional)
 */
export function showLoading(targetId, message = 'Loading...') {
  const el = document.getElementById(targetId);
  if (el) {
    el.innerHTML = `
      <div class="text-center py-4">
        <div class="spinner-border text-primary" role="status">
          <span class="visually-hidden">Loading...</span>
        </div>
        <p class="text-muted mt-2">${message}</p>
      </div>
    `;
  }
}

/**
 * Render error message in a specific element
 * @param {string} targetId - ID of target element
 * @param {string} message - Error message
 */
export function renderError(targetId, message) {
  const el = document.getElementById(targetId);
  if (el) {
    el.innerHTML = `
      <div class="alert alert-danger d-flex align-items-center" role="alert">
        <i class="bi bi-exclamation-triangle-fill me-2"></i>
        <div>${message}</div>
      </div>
    `;
  }
}

/**
 * Clear content of an element
 * @param {string} targetId - ID of target element
 */
export function clearElement(targetId) {
  const el = document.getElementById(targetId);
  if (el) {
    el.innerHTML = '';
  }
}

/**
 * Global loading overlay manager
 */
export const Loading = {
  _timeoutId: null,

  /**
   * Show global loading overlay
   * @param {string} message - Loading message (optional)
   * @param {number} autoHideAfter - Auto-hide after milliseconds (0 = manual hide only)
   */
  show(message = 'Loading...', autoHideAfter = 0) {
    // Clear any existing auto-hide timeout
    if (this._timeoutId) {
      clearTimeout(this._timeoutId);
      this._timeoutId = null;
    }

    let overlay = document.getElementById('globalLoadingOverlay');

    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'globalLoadingOverlay';
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
      `;

      overlay.innerHTML = `
        <div class="text-center">
          <div class="spinner-border text-light" style="width: 3rem; height: 3rem;" role="status">
            <span class="visually-hidden">Loading...</span>
          </div>
          <p class="text-light mt-3 fw-bold">${message}</p>
        </div>
      `;

      document.body.appendChild(overlay);
    } else {
      overlay.style.display = 'flex';
      const messageEl = overlay.querySelector('p');
      if (messageEl) messageEl.textContent = message;
    }

    // Auto-hide after specified time
    if (autoHideAfter > 0) {
      this._timeoutId = setTimeout(() => {
        this.hide();
      }, autoHideAfter);
    }
  },

  /**
   * Hide global loading overlay
   */
  hide() {
    // Clear auto-hide timeout if exists
    if (this._timeoutId) {
      clearTimeout(this._timeoutId);
      this._timeoutId = null;
    }

    const overlay = document.getElementById('globalLoadingOverlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
  }
};

/**
 * Confirmation dialog
 * @param {string} message - Confirmation message
 * @param {string} title - Dialog title (optional)
 * @returns {boolean} True if confirmed
 */
export function confirm(message, title = 'Confirm') {
  return window.confirm(`${title}\n\n${message}`);
}

/**
 * Show empty state message
 * @param {string} targetId - ID of target element
 * @param {string} message - Empty state message
 * @param {string} icon - Bootstrap icon class (optional)
 */
export function showEmptyState(targetId, message, icon = 'bi-inbox') {
  const el = document.getElementById(targetId);
  if (el) {
    el.innerHTML = `
      <div class="text-center text-muted py-5">
        <i class="bi ${icon} display-1 mb-3"></i>
        <h5>${message}</h5>
      </div>
    `;
  }
}

/**
 * Show field-level validation error
 * @param {string} fieldId - ID of form field
 * @param {string} message - Error message to display
 */
export function showFieldError(fieldId, message) {
  const field = document.getElementById(fieldId);
  if (!field) return;

  // Add Bootstrap invalid class
  field.classList.add('is-invalid');

  // Find or create feedback element
  let feedback = field.nextElementSibling;
  if (!feedback || !feedback.classList.contains('invalid-feedback')) {
    feedback = document.createElement('div');
    feedback.className = 'invalid-feedback';
    field.parentNode.insertBefore(feedback, field.nextSibling);
  }
  feedback.textContent = message;
  feedback.style.display = 'block';
}

/**
 * Clear all field errors in a form
 * @param {HTMLFormElement|string} formEl - Form element or form ID
 */
export function clearFieldErrors(formEl) {
  const form = typeof formEl === 'string' ? document.getElementById(formEl) : formEl;
  if (!form) return;

  // Remove invalid classes
  form.querySelectorAll('.is-invalid').forEach(el => {
    el.classList.remove('is-invalid');
  });

  // Remove error messages
  form.querySelectorAll('.invalid-feedback').forEach(el => {
    el.remove();
  });
}

/**
 * Debounce function - delays execution until after wait period of inactivity
 * @param {Function} fn - Function to debounce
 * @param {number} wait - Wait time in milliseconds (default: 300)
 * @returns {Function} Debounced function
 *
 * @example
 * const debouncedSearch = debounce((query) => {
 *   searchAPI(query);
 * }, 500);
 */
export function debounce(fn, wait = 300) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), wait);
  };
}

// Export all functions as default object
export default {
  showToast,
  showLoading,
  renderError,
  clearElement,
  Loading,
  confirm,
  showEmptyState,
  showFieldError,
  clearFieldErrors,
  debounce
};
