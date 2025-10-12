/**
 * Kiosk Break Tracking Module
 * Phase 3 Stage 2 - Break In/Out with offline queue support
 * Enhanced with resilient offline queue and bulk sync
 */

import { api } from '../utils/api.js';
import { showToast, Loading } from '../utils/ui.js';
import { isBackendHealthy } from './index.js';
import { logEvent } from '../utils/logger.js';

// ======================================================
// OFFLINE QUEUE MANAGER (Resilient + Sync-Aware)
// ======================================================

const QUEUE_KEY = 'pendingBreakEvents';
const CURRENT_SHIFT_KEY = 'currentShift';
const MAX_RETRIES = 3;

// Helper to get queue safely
function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY)) || [];
  } catch {
    console.warn('⚠️  Queue corrupted, resetting');
    return [];
  }
}

// Helper to save queue
function saveQueue(queue) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

// Push a new event
export function queueEvent(type, shift_id, staff_code, venue_code) {
  const queue = getQueue();

  // Generate unique ID using crypto API or fallback
  const offline_id = crypto.randomUUID ? crypto.randomUUID() :
    `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

  const event = {
    offline_id,
    type, // 'breakin' | 'breakout' | 'clockin' | 'clockout'
    data: { shift_id, staff_code, venue_code },
    timestamp: new Date().toISOString(),
    retries: 0,
    status: 'pending',
  };

  queue.push(event);
  saveQueue(queue);
  console.log(`📥 Queued event [${type}] for shift ${shift_id} (${offline_id})`);
  return event;
}

// Clean up old failed/discarded events (7-day retention)
export function cleanupOldEvents() {
  const queue = getQueue();
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000; // 7 days
  const filtered = queue.filter(
    e => e.status !== 'discarded' && new Date(e.timestamp).getTime() > cutoff
  );

  if (filtered.length !== queue.length) {
    console.log(`🧹 Cleaned up ${queue.length - filtered.length} old events`);
    saveQueue(filtered);
  }
}

// ======================================================
// SYNC QUEUED EVENTS
// ======================================================

export async function syncQueuedEvents() {
  const queue = getQueue();
  if (!queue.length) {
    console.log('✅ No queued events to sync.');
    return 0;
  }

  // Step 6: Smart sync pause - skip if tab hidden AND queue is small
  if (document.hidden && queue.length < 5) {
    console.log('⏸️ Tab hidden and queue small — delaying sync');
    logEvent('syncPaused', { reason: 'tab_hidden', queueSize: queue.length });
    return 0;
  }

  // Allow sync if queue is large (≥5 events) even when hidden
  if (document.hidden && queue.length >= 5) {
    console.log('⚠️ Tab hidden but queue large — syncing anyway');
    logEvent('syncForced', { reason: 'large_queue', queueSize: queue.length });
  }

  console.log(`🔁 Attempting to sync ${queue.length} queued events...`);
  showToast(`Syncing ${queue.length} pending events...`, 'info');

  const pending = [];
  let syncedCount = 0;
  let failedCount = 0;
  let duplicateCount = 0;
  let conflictCount = 0;

  try {
    // Try bulk sync endpoint first with timeout protection
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s max

    let response;
    try {
      response = await api.post('/kiosk/sync', queue, { signal: controller.signal });
      clearTimeout(timeout);
    } catch (fetchError) {
      clearTimeout(timeout);
      throw fetchError;
    }

    if (response.success && Array.isArray(response.results)) {
      // Process bulk sync response
      for (const result of response.results) {
        const original = queue.find(e => e.offline_id === result.offline_id);
        if (!original) continue;

        if (result.status === 'synced') {
          syncedCount++;
          console.log(`✅ Synced: ${original.type} (${result.offline_id})`);
        } else if (result.status === 'duplicate') {
          duplicateCount++;
          console.log(`⚠️  Duplicate: ${original.type} (${result.offline_id})`);
        } else if (result.status === 'conflict') {
          // Step 3: Handle conflict detection
          conflictCount++;
          console.warn(`⚠️  Conflict: ${original.type} - ${result.error} (${result.offline_id})`);

          // Mark as conflict and keep in queue for manual review
          original.status = 'conflict';
          original.conflict_message = result.error;
          original.existing_shift_id = result.existing_shift_id;
          pending.push(original);
        } else if (result.status === 'failed') {
          failedCount++;
          console.error(`❌ Failed: ${original.type} - ${result.error}`);

          // Retry logic
          original.retries = (original.retries || 0) + 1;
          if (original.retries < MAX_RETRIES) {
            pending.push(original);
          } else {
            original.status = 'failed';
            pending.push(original);
            console.error(`💀 Max retries reached for event ${original.offline_id}`);
          }
        }
      }
    } else {
      throw new Error('Bulk sync endpoint not available, using fallback');
    }
  } catch (err) {
    console.warn('⚠️  Bulk sync failed, falling back to individual endpoints:', err.message);

    // Fallback: sync each event individually with timeout protection
    for (const event of queue) {
      try {
        let endpoint;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 5000); // 5s per event

        try {
          switch (event.type) {
            case 'clockin':
              endpoint = `/kiosk/shift/${event.data.staff_code}/clockin`;
              await api.post(endpoint, { venue_code: event.data.venue_code }, { signal: controller.signal });
              break;
            case 'clockout':
              endpoint = `/kiosk/shift/${event.data.shift_id}/clockout`;
              await api.post(endpoint, {}, { signal: controller.signal });
              break;
            case 'breakin':
              endpoint = `/kiosk/shift/${event.data.shift_id}/breakin`;
              await api.post(endpoint, {}, { signal: controller.signal });
              break;
            case 'breakout':
              endpoint = `/kiosk/shift/${event.data.shift_id}/breakout`;
              await api.post(endpoint, {}, { signal: controller.signal });
              break;
            default:
              throw new Error(`Unknown event type: ${event.type}`);
          }
          clearTimeout(timeout);
        } catch (fetchErr) {
          clearTimeout(timeout);
          throw fetchErr;
        }

        syncedCount++;
        console.log(`✅ Synced (fallback): ${event.type} (${event.offline_id})`);
      } catch (syncErr) {
        console.error(`❌ Sync failed for event ${event.offline_id}:`, syncErr.message);

        // Retry logic
        event.retries = (event.retries || 0) + 1;
        if (event.retries < MAX_RETRIES) {
          pending.push(event);
        } else {
          event.status = 'failed';
          pending.push(event);
          failedCount++;
        }
      }
    }
  } finally {
    // CRITICAL: Always save queue and update UI, even on errors/timeouts
    saveQueue(pending);

    // Build message with conflict info
    let message;
    if (pending.length > 0) {
      const parts = [];
      if (syncedCount > 0) parts.push(`${syncedCount} synced`);
      if (failedCount > 0) parts.push(`${failedCount} failed`);
      if (conflictCount > 0) parts.push(`${conflictCount} conflicts`);
      message = `${parts.join(', ')}. ${pending.length} events need attention.`;
    } else {
      message = `✅ All events synced! (${syncedCount} synced, ${duplicateCount} duplicates)`;
    }

    console.log(message);
    showToast(message, pending.length > 0 ? 'warning' : 'success', 4000);

    // Show additional warning if conflicts exist
    if (conflictCount > 0) {
      showToast(`⚠️ ${conflictCount} event(s) conflicted - staff may already have active shifts`, 'warning', 6000);
    }
  }

  return syncedCount;
}

// ======================================================
// SHIFT OPERATIONS (Clock In/Out with Offline Support)
// ======================================================

/**
 * Start a new shift (Clock In)
 * @param {string} staff_code - Staff code
 * @param {string} venue_code - Venue code
 * @returns {Promise<Object>} Shift data with shift_id
 */
export async function clockIn(staff_code, venue_code) {
  try {
    Loading.show('Clocking in...', 5000);

    // Check backend health (replaces navigator.onLine)
    const healthy = await isBackendHealthy();
    if (!healthy) {
      throw new Error('Backend unavailable');
    }

    const response = await api.post(`/kiosk/shift/${staff_code}/clockin`, {
      venue_code
    });

    if (response.success) {
      // Store current shift info
      const shiftData = {
        shift_id: response.shift_id,
        staff_code,
        venue_code,
        shift_state: response.shift_state,
        clock_in: new Date().toISOString()
      };
      localStorage.setItem(CURRENT_SHIFT_KEY, JSON.stringify(shiftData));

      showToast(response.message || 'Clocked in successfully', 'success');
      Loading.hide();
      return shiftData;
    } else {
      throw new Error(response.error || 'Failed to clock in');
    }
  } catch (error) {
    // Handle 409 conflict (staff already has active shift)
    if (error.status === 409) {
      console.warn(`⚠️  Clock-in conflict: ${error.message}`);
      Loading.hide();
      showToast('⚠️ Already clocked in - you have an active shift', 'warning', 5000);
      throw error;
    }

    // If backend unavailable, queue the event
    if (error.message === 'Backend unavailable' || error.message.includes('Failed to fetch')) {
      console.warn('📴 Backend unavailable — queueing clock in');
      queueEvent('clockin', null, staff_code, venue_code);

      // Optimistic UI: store shift locally
      const shiftData = {
        shift_id: 'pending',
        staff_code,
        venue_code,
        shift_state: 'ACTIVE',
        clock_in: new Date().toISOString(),
        queued: true
      };
      localStorage.setItem(CURRENT_SHIFT_KEY, JSON.stringify(shiftData));

      showToast('⚠️ Backend unavailable: Clock in queued', 'warning');
      Loading.hide();
      return { queued: true, ...shiftData };
    }

    Loading.hide();
    showToast(`Clock in failed: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * Start break
 * @param {number} shift_id - Shift ID
 * @param {string} staff_code - Staff code
 * @param {string} venue_code - Venue code
 * @returns {Promise<Object>} Break response
 */
export async function startBreak(shift_id, staff_code, venue_code) {
  try {
    Loading.show('Starting break...');

    // Check backend health (replaces navigator.onLine)
    const healthy = await isBackendHealthy();
    if (!healthy) {
      throw new Error('Backend unavailable');
    }

    const response = await api.post(`/kiosk/shift/${shift_id}/breakin`);

    if (response.success) {
      // Update local shift state
      updateLocalShiftState('ON_BREAK');

      showToast(response.message || '☕ Break started', 'success');
      Loading.hide();
      return response;
    } else {
      throw new Error(response.error || 'Failed to start break');
    }
  } catch (error) {
    // If backend unavailable, queue the break event
    if (error.message === 'Backend unavailable' || error.message.includes('Failed to fetch')) {
      console.warn('📴 Backend unavailable — queueing break start');
      queueEvent('breakin', shift_id, staff_code, venue_code);
      updateLocalShiftState('ON_BREAK');
      showToast('⚠️ Backend unavailable: Break queued', 'warning');
      Loading.hide();
      return { success: true, queued: true };
    }

    Loading.hide();
    showToast(`Break start failed: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * End break
 * @param {number} shift_id - Shift ID
 * @param {string} staff_code - Staff code
 * @param {string} venue_code - Venue code
 * @returns {Promise<Object>} Break response with total_break_minutes
 */
export async function endBreak(shift_id, staff_code, venue_code) {
  try {
    Loading.show('Ending break...');

    // Check backend health (replaces navigator.onLine)
    const healthy = await isBackendHealthy();
    if (!healthy) {
      throw new Error('Backend unavailable');
    }

    const response = await api.post(`/kiosk/shift/${shift_id}/breakout`);

    if (response.success) {
      // Update local shift state
      updateLocalShiftState('ACTIVE');

      const breakMinutes = response.total_break_minutes || 0;
      showToast(`✅ Break ended. Total: ${breakMinutes} min`, 'success');
      Loading.hide();
      return response;
    } else {
      throw new Error(response.error || 'Failed to end break');
    }
  } catch (error) {
    // If backend unavailable, queue the break event
    if (error.message === 'Backend unavailable' || error.message.includes('Failed to fetch')) {
      console.warn('📴 Backend unavailable — queueing break end');
      queueEvent('breakout', shift_id, staff_code, venue_code);
      updateLocalShiftState('ACTIVE');
      showToast('⚠️ Backend unavailable: Break end queued', 'warning');
      Loading.hide();
      return { success: true, queued: true };
    }

    Loading.hide();
    showToast(`Break end failed: ${error.message}`, 'error');
    throw error;
  }
}

/**
 * End shift (Clock Out)
 * @param {number} shift_id - Shift ID
 * @param {string} staff_code - Staff code
 * @param {string} venue_code - Venue code
 * @returns {Promise<Object>} Shift summary with hours_worked, total_pay, etc.
 */
export async function clockOut(shift_id, staff_code, venue_code) {
  try {
    Loading.show('Clocking out...');

    // Check backend health (replaces navigator.onLine)
    const healthy = await isBackendHealthy();
    if (!healthy) {
      throw new Error('Backend unavailable');
    }

    const response = await api.post(`/kiosk/shift/${shift_id}/clockout`);

    if (response.success) {
      // Clear current shift from localStorage
      localStorage.removeItem(CURRENT_SHIFT_KEY);

      const shift = response.shift || {};
      const summary = `
        Shift completed!
        Hours: ${shift.hours_worked || 0}h
        Break: ${shift.break_minutes || 0} min
        Pay: $${shift.total_pay || 0}
      `.trim().replace(/\s+/g, ' ');

      showToast(summary, 'success', 5000);
      Loading.hide();
      return response;
    } else {
      throw new Error(response.error || 'Failed to clock out');
    }
  } catch (error) {
    // If backend unavailable, queue the event
    if (error.message === 'Backend unavailable' || error.message.includes('Failed to fetch')) {
      console.warn('📴 Backend unavailable — queueing clock out');
      queueEvent('clockout', shift_id, staff_code, venue_code);

      // Clear local shift optimistically
      localStorage.removeItem(CURRENT_SHIFT_KEY);

      showToast('⚠️ Backend unavailable: Clock out queued', 'warning');
      Loading.hide();
      return { success: true, queued: true };
    }

    Loading.hide();
    showToast(`Clock out failed: ${error.message}`, 'error');
    throw error;
  }
}

// ======================================================
// HELPER FUNCTIONS
// ======================================================

/**
 * Get current shift from localStorage
 * @returns {Object|null} Current shift data or null
 */
export function getCurrentShift() {
  try {
    const data = localStorage.getItem(CURRENT_SHIFT_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error reading current shift:', error);
    return null;
  }
}

/**
 * Update local shift state
 * @param {string} state - New state ('ACTIVE', 'ON_BREAK', 'COMPLETED')
 */
function updateLocalShiftState(state) {
  const shift = getCurrentShift();
  if (shift) {
    shift.shift_state = state;
    shift.last_update = new Date().toISOString();
    localStorage.setItem(CURRENT_SHIFT_KEY, JSON.stringify(shift));
  }
}

/**
 * Get queued events count
 * @returns {number} Number of queued events
 */
export function getQueuedBreakCount() {
  try {
    const queue = getQueue();
    return queue.length;
  } catch (error) {
    return 0;
  }
}

// ======================================================
// SYNC COORDINATION & DEBOUNCING
// ======================================================

let syncInProgress = false;
let syncScheduled = false;

/**
 * Safely trigger sync with debouncing
 * Prevents multiple concurrent sync attempts
 * Step 5: Added structured logging
 * @returns {Promise<number>} Number of events synced
 */
export async function attemptSync() {
  // If already syncing, schedule for later
  if (syncInProgress) {
    console.log('⏳ Sync already in progress, will retry after completion');
    logEvent('syncDeferred', { reason: 'already_in_progress' });
    syncScheduled = true;
    return 0;
  }

  const queue = getQueue();
  syncInProgress = true;
  syncScheduled = false;

  logEvent('syncStart', { queued: queue.length });

  // Update system status indicator (if function available)
  if (typeof window.setSystemStatus === 'function') {
    window.setSystemStatus('syncing');
  }

  try {
    const count = await syncQueuedEvents();
    logEvent('syncEnd', { synced: count, success: true });

    // Reset status to online after successful sync
    if (typeof window.setSystemStatus === 'function') {
      window.setSystemStatus('online');
    }

    return count;
  } catch (error) {
    console.error('Sync error:', error);
    logEvent('syncError', { error: error.message });

    // Keep online status even if sync fails (backend is reachable)
    if (typeof window.setSystemStatus === 'function') {
      window.setSystemStatus('online');
    }

    return 0;
  } finally {
    syncInProgress = false;

    // If another sync was requested during execution, run it now
    if (syncScheduled) {
      console.log('🔄 Running scheduled sync...');
      logEvent('syncScheduledRetry');
      setTimeout(() => attemptSync(), 500);
    }
  }
}

/**
 * Check if sync is currently in progress
 * @returns {boolean} True if sync is running
 */
export function isSyncInProgress() {
  return syncInProgress;
}

// ======================================================
// AUTO-SYNC TRIGGERS
// ======================================================

// Attempt sync whenever network reconnects
window.addEventListener('online', () => {
  console.log('🌐 Connection restored — syncing queue...');
  attemptSync();
});

// Run sync and cleanup on kiosk startup
window.addEventListener('DOMContentLoaded', () => {
  cleanupOldEvents();
  attemptSync();
});

// Backward compatibility aliases (deprecated)
export const syncQueuedBreaks = syncQueuedEvents;
