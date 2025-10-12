-- Migration: Add indexes for break tracking
-- Phase 3 Stage 2 - Kiosk Break In/Out feature
-- NOTE: Columns already exist, only adding indexes

USE clockin_mysql;

-- Add index for faster queries on shift_state
-- This improves performance when filtering by shift state (e.g., finding all active shifts)
CREATE INDEX idx_shift_state ON shifts(shift_state);

-- Add composite index for staff_code + shift_state combination
-- This optimizes queries like: finding active/on-break shifts for a specific staff member
CREATE INDEX idx_staff_shift_state ON shifts(staff_code, shift_state);
