/**
 * AdminContext - Lightweight Session Cache for Admin Panel
 *
 * Purpose: Reduce redundant API calls within a single admin session
 * Scope: In-memory, cleared on page reload
 * Use cases: Venues, businesses, staff lists, user context, permissions
 *
 * @example
 * import { AdminContext } from './context.js';
 *
 * // Set data
 * AdminContext.set('venues', venuesData);
 *
 * // Get data (returns null if not found)
 * const venues = AdminContext.get('venues');
 *
 * // Check if exists
 * if (AdminContext.has('venues')) { ... }
 *
 * // Remove specific key
 * AdminContext.remove('venues');
 *
 * // Clear all
 * AdminContext.clear();
 */

export const AdminContext = {
  /**
   * Internal storage object
   * Format: { key: { val, exp, createdAt } }
   */
  _data: {},

  /**
   * Get cached value
   * @param {string} key - Cache key
   * @returns {any|null} Cached value or null if not found/expired
   */
  get(key) {
    const entry = this._data[key];

    if (!entry) {
      return null;
    }

    // Check if expired (TTL support)
    if (entry.exp && Date.now() > entry.exp) {
      console.log(`[AdminContext] ${key} expired, removing`);
      delete this._data[key];
      return null;
    }

    console.log(`[AdminContext] ✓ Cache HIT: ${key}`);
    return entry.val;
  },

  /**
   * Set cached value with optional TTL
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttlMs - Time to live in milliseconds (0 = no expiry)
   */
  set(key, value, ttlMs = 0) {
    this._data[key] = {
      val: value,
      exp: ttlMs ? Date.now() + ttlMs : 0,
      createdAt: Date.now()
    };
    console.log(`[AdminContext] ✓ Set: ${key}${ttlMs ? ` (TTL: ${ttlMs}ms)` : ''}`);
  },

  /**
   * Check if key exists in cache
   * @param {string} key - Cache key
   * @returns {boolean} True if key exists and not expired
   */
  has(key) {
    const entry = this._data[key];

    if (!entry) {
      return false;
    }

    // Check if expired
    if (entry.exp && Date.now() > entry.exp) {
      delete this._data[key];
      return false;
    }

    return true;
  },

  /**
   * Remove specific key from cache
   * @param {string} key - Cache key to remove
   */
  remove(key) {
    if (this._data[key]) {
      delete this._data[key];
      console.log(`[AdminContext] ✓ Removed: ${key}`);
    }
  },

  /**
   * Clear all cached data
   */
  clear() {
    const keyCount = Object.keys(this._data).length;
    this._data = {};
    console.log(`[AdminContext] ✓ Cleared all cache (${keyCount} keys)`);
  },

  /**
   * Get all cache keys
   * @returns {string[]} Array of cache keys
   */
  keys() {
    return Object.keys(this._data);
  },

  /**
   * Get cache statistics
   * @returns {Object} Cache stats
   */
  getStats() {
    const now = Date.now();
    const entries = Object.entries(this._data);

    return {
      total: entries.length,
      active: entries.filter(([k, v]) => !v.exp || now <= v.exp).length,
      expired: entries.filter(([k, v]) => v.exp && now > v.exp).length,
      keys: this.keys()
    };
  },

  /**
   * Clean up expired entries
   * @returns {number} Number of expired entries removed
   */
  cleanup() {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of Object.entries(this._data)) {
      if (entry.exp && now > entry.exp) {
        delete this._data[key];
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`[AdminContext] ✓ Cleanup removed ${removed} expired entries`);
    }

    return removed;
  },

  /**
   * Invalidate all keys matching a pattern
   * @param {string} pattern - Pattern to match
   * @returns {number} Number of keys removed
   */
  invalidate(pattern) {
    let removed = 0;

    for (const key of Object.keys(this._data)) {
      if (key.includes(pattern)) {
        delete this._data[key];
        removed++;
      }
    }

    if (removed > 0) {
      console.log(`[AdminContext] ✓ Invalidated ${removed} keys matching '${pattern}'`);
    }

    return removed;
  },

  /**
   * Get or fetch pattern (convenience method)
   * @param {string} key - Cache key
   * @param {Function} fetchFn - Async function to fetch data if not cached
   * @param {number} ttlMs - Time to live in milliseconds
   * @returns {Promise<any>} Cached or fetched data
   */
  async getOrFetch(key, fetchFn, ttlMs = 0) {
    // Check cache first
    if (this.has(key)) {
      return this.get(key);
    }

    // Fetch and cache
    console.log(`[AdminContext] ✗ Cache MISS: ${key}, fetching...`);
    try {
      const data = await fetchFn();
      this.set(key, data, ttlMs);
      return data;
    } catch (error) {
      console.error(`[AdminContext] ✗ Fetch failed for ${key}:`, error);
      throw error;
    }
  }
};

// Auto-cleanup expired entries every 5 minutes
setInterval(() => {
  AdminContext.cleanup();
}, 300000);

// Expose globally for debugging
if (typeof window !== 'undefined') {
  window.AdminContext = AdminContext;
  console.log('[AdminContext] ✓ Initialized and exposed globally');
}

export default AdminContext;
