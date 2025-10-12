/**
 * Structured Logging System for Kiosk
 * Step 5: Production Readiness
 *
 * Logs events to console and localStorage for diagnostics
 */

const LOG_KEY = 'kioskLogs';
const MAX_LOGS = 500; // Cap to prevent memory issues

/**
 * Log an event with structured data
 * @param {string} event - Event name (e.g., 'pollStart', 'syncEnd')
 * @param {Object} detail - Additional event details
 */
export function logEvent(event, detail = {}) {
  const time = new Date().toISOString();
  const entry = { time, event, detail };

  // Console output with timestamp
  console.log(`[${time}] ${event}`, detail);

  try {
    // Persist to localStorage
    const logs = JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
    logs.push(entry);

    // Cap at MAX_LOGS to prevent memory bloat
    if (logs.length > MAX_LOGS) {
      logs.shift(); // Remove oldest
    }

    localStorage.setItem(LOG_KEY, JSON.stringify(logs));
  } catch (error) {
    console.error('Failed to persist log:', error);
  }
}

/**
 * Get all stored logs
 * @returns {Array} Array of log entries
 */
export function getLogs() {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) || '[]');
  } catch (error) {
    console.error('Failed to retrieve logs:', error);
    return [];
  }
}

/**
 * Clear all stored logs
 */
export function clearLogs() {
  try {
    localStorage.removeItem(LOG_KEY);
    console.log('✅ Logs cleared');
  } catch (error) {
    console.error('Failed to clear logs:', error);
  }
}

/**
 * Export logs as downloadable JSON
 * @returns {string} Blob URL for download
 */
export function exportLogs() {
  const logs = getLogs();
  const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  // Create temporary download link
  const a = document.createElement('a');
  a.href = url;
  a.download = `kiosk-logs-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log('✅ Logs exported');
  return url;
}

/**
 * Get log statistics
 * @returns {Object} Log statistics
 */
export function getLogStats() {
  const logs = getLogs();
  const eventCounts = {};

  logs.forEach(log => {
    eventCounts[log.event] = (eventCounts[log.event] || 0) + 1;
  });

  return {
    total: logs.length,
    oldestEntry: logs[0]?.time || null,
    newestEntry: logs[logs.length - 1]?.time || null,
    eventCounts
  };
}
