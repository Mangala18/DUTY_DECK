/**
 * Simple In-Memory TTL Cache
 *
 * Purpose: Reduce redundant database queries for read-heavy, infrequently-changing data
 * Scope: Per Node.js process (not shared across instances)
 * Use cases: Venues, businesses, public holidays, role configs, pay rates
 *
 * @example
 * const cache = require('./utils/cache');
 *
 * // Set with 5-minute TTL
 * cache.set('venues:BUS001', venuesData, 300);
 *
 * // Get (returns null if expired or not found)
 * const data = cache.get('venues:BUS001');
 *
 * // Invalidate by pattern
 * cache.invalidate('venues:');
 *
 * // Get stats
 * const stats = cache.getStats();
 */

const store = new Map();
let stats = {
  hits: 0,
  misses: 0,
  sets: 0,
  invalidations: 0,
  deletes: 0
};

/**
 * Get cached value
 * @param {string} key - Cache key
 * @returns {any|null} Cached value or null if not found/expired
 */
function get(key) {
  const item = store.get(key);

  if (!item) {
    stats.misses++;
    return null;
  }

  // Check if expired
  if (Date.now() > item.exp) {
    store.delete(key);
    stats.misses++;
    stats.deletes++;
    return null;
  }

  stats.hits++;
  return item.val;
}

/**
 * Set cached value with TTL
 * @param {string} key - Cache key
 * @param {any} val - Value to cache
 * @param {number} ttlMs - Time to live in milliseconds (default: 5 minutes)
 */
function set(key, val, ttlMs = 300000) {
  store.set(key, {
    val,
    exp: Date.now() + ttlMs,
    createdAt: Date.now()
  });
  stats.sets++;
}

/**
 * Delete specific key
 * @param {string} key - Cache key to delete
 * @returns {boolean} True if key existed and was deleted
 */
function del(key) {
  const existed = store.delete(key);
  if (existed) {
    stats.deletes++;
  }
  return existed;
}

/**
 * Invalidate all keys matching a pattern
 * @param {string} pattern - Pattern to match (e.g., 'venues:' matches all venue keys)
 * @returns {number} Number of keys invalidated
 */
function invalidate(pattern) {
  let count = 0;
  for (const key of store.keys()) {
    if (key.includes(pattern)) {
      store.delete(key);
      count++;
    }
  }
  stats.invalidations += count;
  stats.deletes += count;
  return count;
}

/**
 * Clear all cached data
 */
function clear() {
  const size = store.size;
  store.clear();
  stats.deletes += size;
}

/**
 * Get cache statistics
 * @returns {object} Cache stats including hit rate
 */
function getStats() {
  const total = stats.hits + stats.misses;
  const hitRate = total > 0 ? ((stats.hits / total) * 100).toFixed(2) : 0;

  return {
    ...stats,
    size: store.size,
    hitRate: `${hitRate}%`,
    totalRequests: total
  };
}

/**
 * Reset statistics (useful for testing)
 */
function resetStats() {
  stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    invalidations: 0,
    deletes: 0
  };
}

/**
 * Get all cache keys (for debugging)
 * @returns {string[]} Array of cache keys
 */
function getKeys() {
  return Array.from(store.keys());
}

/**
 * Get cache size in bytes (approximate)
 * @returns {number} Approximate memory usage in bytes
 */
function getSize() {
  let bytes = 0;
  for (const [key, item] of store.entries()) {
    bytes += key.length * 2; // String chars are 2 bytes
    bytes += JSON.stringify(item.val).length; // Approximate value size
    bytes += 16; // Overhead for exp and createdAt timestamps
  }
  return bytes;
}

/**
 * Cleanup expired entries (run periodically)
 * @returns {number} Number of expired entries removed
 */
function cleanup() {
  let removed = 0;
  const now = Date.now();

  for (const [key, item] of store.entries()) {
    if (now > item.exp) {
      store.delete(key);
      removed++;
    }
  }

  if (removed > 0) {
    stats.deletes += removed;
  }

  return removed;
}

// Auto-cleanup expired entries every 10 minutes
setInterval(() => {
  const removed = cleanup();
  if (removed > 0) {
    console.log(`[CACHE] Auto-cleanup removed ${removed} expired entries`);
  }
}, 600000); // 10 minutes

// Export all functions
module.exports = {
  get,
  set,
  del,
  invalidate,
  clear,
  getStats,
  resetStats,
  getKeys,
  getSize,
  cleanup
};
