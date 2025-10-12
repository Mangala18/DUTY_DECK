-- ============================================================================
-- 09_idx_shifts_venue_state.sql
-- Performance Index for Batch Status Endpoint (Step 4)
-- ============================================================================
-- Purpose: Optimize LEFT JOIN in /api/kiosk/status/venue/:venue_code
-- Impact: Reduces query time from O(n) to O(log n) for shift lookups
-- Expected: < 10ms query time even with thousands of shifts
-- ============================================================================

-- Composite index for efficient venue + state filtering
-- Used by: SELECT ... FROM staff LEFT JOIN shifts ON ... WHERE shifts.venue_code = ? AND shifts.shift_state IN (...)
CREATE INDEX IF NOT EXISTS idx_shifts_venue_state
  ON shifts(venue_code, shift_state, clock_in);

-- Explanation:
-- 1. venue_code: First column allows quick filtering by venue
-- 2. shift_state: Second column filters for ACTIVE/ON_BREAK states
-- 3. clock_in: Third column (covering index) avoids table lookups
--
-- Query plan verification:
-- EXPLAIN SELECT ... FROM shifts WHERE venue_code = 'V001' AND shift_state IN ('ACTIVE', 'ON_BREAK');
-- Expected: type=range, key=idx_shifts_venue_state, rows=1-10

-- ============================================================================
-- Migration Notes:
-- - Safe to run on existing data
-- - Index builds in background (non-blocking)
-- - Estimated size: ~100KB per 10,000 shifts
-- - Rollback: DROP INDEX idx_shifts_venue_state ON shifts;
-- ============================================================================
