-- Migration: Add break tracking to shifts table
-- Phase 3 Stage 2 - Kiosk Break In/Out feature

USE clockin_mysql;

-- Add columns for break tracking after clock_out
ALTER TABLE shifts
  ADD COLUMN shift_state ENUM('NONE','ACTIVE','ON_BREAK','COMPLETED') DEFAULT 'NONE' AFTER clock_out,
  ADD COLUMN last_action_time TIMESTAMP NULL AFTER shift_state,
  ADD COLUMN break_minutes INT DEFAULT 0 AFTER last_action_time;

-- Add index for faster queries on shift_state
CREATE INDEX idx_shift_state ON shifts(shift_state);

-- Add index for staff_code + shift_state combination (for finding active breaks)
CREATE INDEX idx_staff_shift_state ON shifts(staff_code, shift_state);
