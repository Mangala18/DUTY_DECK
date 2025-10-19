const express = require('express');
const router = express.Router();
const cache = require('../utils/cache');

/**
 * Cache Management Routes
 * Provides endpoints for monitoring and managing the in-memory cache
 */

// Get cache statistics
router.get('/stats', (req, res) => {
  try {
    const stats = cache.getStats();
    const sizeBytes = cache.getSize();
    const sizeMB = (sizeBytes / (1024 * 1024)).toFixed(2);

    res.json({
      success: true,
      stats: {
        ...stats,
        sizeBytes,
        sizeMB: `${sizeMB} MB`
      }
    });
  } catch (err) {
    console.error('Error fetching cache stats:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cache statistics'
    });
  }
});

// Get all cache keys
router.get('/keys', (req, res) => {
  try {
    const keys = cache.getKeys();
    res.json({
      success: true,
      count: keys.length,
      keys
    });
  } catch (err) {
    console.error('Error fetching cache keys:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cache keys'
    });
  }
});

// Clear all cache
router.delete('/clear', (req, res) => {
  try {
    cache.clear();
    console.log('[CACHE] All cache cleared by admin');
    res.json({
      success: true,
      message: 'All cache cleared'
    });
  } catch (err) {
    console.error('Error clearing cache:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache'
    });
  }
});

// Invalidate cache by pattern
router.delete('/invalidate/:pattern', (req, res) => {
  try {
    const { pattern } = req.params;
    const count = cache.invalidate(pattern);
    console.log(`[CACHE] Invalidated ${count} keys matching pattern: ${pattern}`);
    res.json({
      success: true,
      message: `Invalidated ${count} cache entries`,
      pattern,
      count
    });
  } catch (err) {
    console.error('Error invalidating cache:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to invalidate cache'
    });
  }
});

// Run manual cleanup
router.post('/cleanup', (req, res) => {
  try {
    const removed = cache.cleanup();
    console.log(`[CACHE] Manual cleanup removed ${removed} expired entries`);
    res.json({
      success: true,
      message: `Removed ${removed} expired entries`,
      removed
    });
  } catch (err) {
    console.error('Error cleaning up cache:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to cleanup cache'
    });
  }
});

// Reset cache statistics
router.post('/reset-stats', (req, res) => {
  try {
    cache.resetStats();
    console.log('[CACHE] Cache statistics reset');
    res.json({
      success: true,
      message: 'Cache statistics reset'
    });
  } catch (err) {
    console.error('Error resetting cache stats:', err);
    res.status(500).json({
      success: false,
      error: 'Failed to reset cache statistics'
    });
  }
});

module.exports = router;
