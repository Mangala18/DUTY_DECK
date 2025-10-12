-- ============================================
-- Guard Active Shift Constraint
-- ============================================
-- Purpose: Prevent multiple active/on-break shifts per staff member
-- Layer: Database-level integrity enforcement (Step 3)
-- Created: 2025-10-10

-- ===== Performance Index =====
-- Speeds up trigger checks and FOR UPDATE queries
-- Note: If index already exists, this will error - that's OK, just means it's already there
CREATE INDEX idx_shifts_staff_state ON shifts(staff_code, shift_state);

-- ===== Database Trigger (Last Line of Defense) =====
-- Blocks ANY attempt to insert duplicate active/on-break shifts
-- This catches manual inserts, app bugs, or edge cases

-- Note: This trigger requires either:
-- 1. SET GLOBAL log_bin_trust_function_creators = 1; (run as mysql root)
-- 2. GRANT SUPER ON *.* TO 'appuser'@'localhost';
-- For now, we'll skip the trigger and rely on application-level transaction guards

-- DROP TRIGGER IF EXISTS trg_no_multiple_active_shifts;
--
-- DELIMITER $$
--
-- CREATE DEFINER=`appuser`@`localhost` TRIGGER trg_no_multiple_active_shifts
-- BEFORE INSERT ON shifts
-- FOR EACH ROW
-- BEGIN
--   DECLARE existing_count INT;
--
--   -- Check if staff already has an active or on-break shift
--   SELECT COUNT(*) INTO existing_count
--   FROM shifts
--   WHERE staff_code = NEW.staff_code
--     AND shift_state IN ('ACTIVE', 'ON_BREAK');
--
--   -- Block insert if duplicate found
--   IF existing_count > 0 THEN
--     SIGNAL SQLSTATE '45000'
--       SET MESSAGE_TEXT = 'Staff already has an active shift';
--   END IF;
-- END$$
--
-- DELIMITER ;

-- ===== Verification Queries =====
-- Run these after applying migration:

-- 1. Verify index exists:
-- SHOW INDEX FROM shifts WHERE Key_name = 'idx_shifts_staff_state';

-- 2. Test transaction guard (from application):
-- The transaction + FOR UPDATE pattern in the application layer
-- provides the primary protection against duplicate shifts
