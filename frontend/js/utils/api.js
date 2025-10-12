/**
 * API Utility Module
 * Unified API layer with automatic authentication headers, retry logic, and error handling
 */

import { Storage } from './storage.js';
import { showToast } from './ui.js';

/**
 * Sleep utility for retry delays
 * @param {number} ms - Milliseconds to sleep
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Check if error is retryable (network errors, 5xx errors)
 * @param {Error} error - Error object
 * @param {Response} response - Fetch response (optional)
 */
function isRetryableError(error, response = null) {
  // Network errors (no response)
  if (!response) return true;

  // Server errors (5xx)
  if (response && response.status >= 500) return true;

  // Rate limiting (429)
  if (response && response.status === 429) return true;

  return false;
}

/**
 * Get authentication headers from current user session
 * @returns {Object} Headers object with auth credentials
 */
function getAuthHeaders() {
  try {
    const user = JSON.parse(localStorage.getItem('currentUser') || '{}');
    return {
      'user_access_level': user.access_level || 'system_admin',
      'user_business_code': user.business_code || '',
      'user_venue_code': user.venue_code || ''
    };
  } catch (err) {
    console.warn('Failed to parse user from localStorage:', err);
    return {
      'user_access_level': 'system_admin',
      'user_business_code': '',
      'user_venue_code': ''
    };
  }
}

/**
 * Main API request function with retry logic
 *
 * @param {string} path - API endpoint path (e.g., '/system-admin/staff')
 * @param {Object} options - Fetch options (method, body, headers, etc.)
 * @param {number} retries - Number of retry attempts (default: 3)
 * @returns {Promise<Object>} Parsed JSON response
 * @throws {Error} When request fails after all retries
 *
 * @example
 * const staff = await apiRequest('/system-admin/staff');
 * const newStaff = await apiRequest('/system-admin/staff', {
 *   method: 'POST',
 *   body: JSON.stringify(staffData)
 * });
 */
export async function apiRequest(path, options = {}, retries = 3) {
  // Merge default headers with provided headers
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeaders(),
    ...options.headers
  };

  const fetchOptions = {
    ...options,
    headers
  };

  try {
    const response = await fetch(`/api${path}`, fetchOptions);
    const contentType = response.headers.get('content-type') || '';

    // Handle non-OK responses
    if (!response.ok) {
      // Handle 401 Unauthorized - auto logout with user notification
      if (response.status === 401) {
        Storage.clearUser();
        showToast('Session expired. Redirecting to login...', 'warning');
        await new Promise(r => setTimeout(r, 1500));
        window.location.href = '/index.html';
        throw new Error('Session expired');
      }

      let errorMessage = `HTTP ${response.status}`;

      // Try to extract error message from response body
      try {
        if (contentType.includes('application/json')) {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } else {
          const errorText = await response.text();
          if (errorText && !errorText.includes('<!DOCTYPE')) {
            errorMessage = errorText;
          }
        }
      } catch (parseErr) {
        // If parsing fails, use default message
      }

      const error = new Error(errorMessage);
      error.status = response.status;
      error.response = response;

      // Retry logic for retryable errors
      if (retries > 0 && isRetryableError(error, response)) {
        const delay = (4 - retries) * 1000; // Exponential backoff: 1s, 2s, 3s
        console.warn(`Request failed, retrying in ${delay}ms... (${retries} attempts left)`);
        await sleep(delay);
        return apiRequest(path, options, retries - 1);
      }

      throw error;
    }

    // Parse successful response
    if (contentType.includes('application/json')) {
      return await response.json();
    } else {
      throw new Error('Invalid response format: Expected JSON');
    }

  } catch (err) {
    // Network errors (no response received)
    if (!err.response && retries > 0) {
      const delay = (4 - retries) * 1000;
      console.warn(`Network error, retrying in ${delay}ms... (${retries} attempts left)`);
      await sleep(delay);
      return apiRequest(path, options, retries - 1);
    }

    // Re-throw error after all retries exhausted
    throw err;
  }
}

/**
 * Convenience methods for common HTTP verbs
 */
export const api = {
  /**
   * GET request
   * @param {string} path - API endpoint path
   * @param {Object} options - Additional fetch options
   */
  get(path, options = {}) {
    return apiRequest(path, { ...options, method: 'GET' });
  },

  /**
   * POST request
   * @param {string} path - API endpoint path
   * @param {Object} data - Data to send in request body
   * @param {Object} options - Additional fetch options
   */
  post(path, data, options = {}) {
    return apiRequest(path, {
      ...options,
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  /**
   * PUT request
   * @param {string} path - API endpoint path
   * @param {Object} data - Data to send in request body
   * @param {Object} options - Additional fetch options
   */
  put(path, data, options = {}) {
    return apiRequest(path, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  /**
   * DELETE request
   * @param {string} path - API endpoint path
   * @param {Object} options - Additional fetch options
   */
  delete(path, options = {}) {
    return apiRequest(path, { ...options, method: 'DELETE' });
  }
};

export default apiRequest;
