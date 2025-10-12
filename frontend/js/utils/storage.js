/**
 * Storage Utility Module
 * Manages localStorage operations for user authentication and session management
 */

/**
 * Storage object with methods for user session management
 */
export const Storage = {
  /**
   * Get current logged-in user from localStorage
   * @returns {Object|null} User object or null if not found/invalid
   */
  getUser() {
    try {
      const userStr = localStorage.getItem('currentUser');
      if (!userStr) return null;

      const user = JSON.parse(userStr);

      // Validate user object has required fields
      if (!user || typeof user !== 'object') {
        console.warn('Invalid user data in localStorage');
        return null;
      }

      return user;
    } catch (err) {
      console.error('Error parsing user from localStorage:', err);
      return null;
    }
  },

  /**
   * Save user to localStorage
   * @param {Object} user - User object to store
   */
  setUser(user) {
    try {
      if (!user || typeof user !== 'object') {
        throw new Error('Invalid user object');
      }
      localStorage.setItem('currentUser', JSON.stringify(user));
    } catch (err) {
      console.error('Error saving user to localStorage:', err);
      throw err;
    }
  },

  /**
   * Remove user from localStorage (logout)
   */
  clearUser() {
    try {
      localStorage.removeItem('currentUser');
    } catch (err) {
      console.error('Error clearing user from localStorage:', err);
    }
  },

  /**
   * Check if user is logged in
   * @returns {boolean} True if user is logged in
   */
  isLoggedIn() {
    const user = this.getUser();
    return user !== null && user.id !== undefined;
  },

  /**
   * Require authentication - redirect to login if not authenticated
   * @param {string} redirectTo - URL to redirect to after login (optional)
   */
  requireAuth(redirectTo = null) {
    if (!this.isLoggedIn()) {
      // Store intended destination for redirect after login
      if (redirectTo) {
        sessionStorage.setItem('redirectAfterLogin', redirectTo);
      }

      // Redirect to login page
      window.location.href = '/index.html';
      return false;
    }
    return true;
  },

  /**
   * Get redirect URL after successful login
   * @returns {string|null} Redirect URL or null
   */
  getRedirectAfterLogin() {
    const redirect = sessionStorage.getItem('redirectAfterLogin');
    if (redirect) {
      sessionStorage.removeItem('redirectAfterLogin');
      return redirect;
    }
    return null;
  },

  /**
   * Get user's access level
   * @returns {string|null} Access level (system_admin, manager, supervisor, employee) or null
   */
  getUserAccessLevel() {
    const user = this.getUser();
    return user?.access_level || null;
  },

  /**
   * Get user's business code
   * @returns {string|null} Business code or null
   */
  getUserBusinessCode() {
    const user = this.getUser();
    return user?.business_code || null;
  },

  /**
   * Get user's venue code
   * @returns {string|null} Venue code or null
   */
  getUserVenueCode() {
    const user = this.getUser();
    return user?.venue_code || null;
  },

  /**
   * Check if user has specific access level
   * @param {string} requiredLevel - Required access level
   * @returns {boolean} True if user has required access level
   */
  hasAccessLevel(requiredLevel) {
    const userLevel = this.getUserAccessLevel();
    if (!userLevel) return false;

    const levels = ['employee', 'supervisor', 'manager', 'system_admin', 'master'];
    const userIndex = levels.indexOf(userLevel);
    const requiredIndex = levels.indexOf(requiredLevel);

    return userIndex >= requiredIndex;
  },

  /**
   * Get user's full name
   * @returns {string} User's full name or 'User'
   */
  getUserFullName() {
    const user = this.getUser();
    if (!user) return 'User';

    const parts = [user.first_name, user.middle_name, user.last_name].filter(Boolean);
    return parts.join(' ') || user.username || 'User';
  }
};

// Export as default for convenience
export default Storage;
