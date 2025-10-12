-- ============================================
-- Sync Log Table for Offline Event Tracking
-- ============================================
-- Purpose: Track synced offline events for deduplication and audit trail
-- Used by: /api/kiosk/sync endpoint
-- Created: 2025-10-10

CREATE TABLE IF NOT EXISTS sync_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  offline_id VARCHAR(64) UNIQUE NOT NULL COMMENT 'UUID from frontend queue for idempotency',
  staff_code VARCHAR(50) NOT NULL COMMENT 'Staff who performed the action',
  type ENUM('clockin', 'clockout', 'breakin', 'breakout') NOT NULL COMMENT 'Type of action',
  timestamp TIMESTAMP NOT NULL COMMENT 'When the action occurred (UTC)',
  status ENUM('synced', 'duplicate', 'failed') DEFAULT 'synced' COMMENT 'Sync result status',
  error_message TEXT NULL COMMENT 'Error details if status = failed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT 'When record was created on server',
  INDEX idx_offline_id (offline_id),
  INDEX idx_staff_code (staff_code),
  INDEX idx_timestamp (timestamp),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Audit log for offline kiosk event synchronization';
