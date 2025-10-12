/**
 * Kiosk Main Module (ES6)
 * Phase 3 Stage 2 - Integrated with break tracking
 */

import { clockIn as breakClockIn, startBreak, endBreak, clockOut as breakClockOut, getCurrentShift, syncQueuedBreaks, getQueuedBreakCount, attemptSync, isSyncInProgress } from './breaks.js';
import { showToast } from '../utils/ui.js';
import { logEvent } from '../utils/logger.js';

// Use global Luxon from CDN
const { DateTime} = luxon;

// State
let kioskContext = null;
let currentStaff = null;
let currentShiftId = null;

// ===== Global Interval Tracking (Step 6: Lifecycle Management) =====
// Keep interval/timer IDs globally accessible for cleanup
window.statusPollInterval = null;
window.healthInterval = null;
window.watchdogInterval = null;
window.idleTimer = null;
window.clockInterval = null;

// ===== System Status Indicator (Step 5) =====
/**
 * Update the visual system status indicator
 * @param {string} state - 'online', 'offline', 'syncing', or 'paused'
 */
function setSystemStatus(state) {
  const el = document.getElementById('systemStatus');
  if (!el) return;

  el.className = 'status-indicator ' + state;
  el.textContent =
    state === 'offline' ? 'Offline' :
    state === 'syncing' ? 'Syncing...' :
    state === 'paused' ? 'Paused' : 'Online';

  logEvent('systemStatus', { state });
}

// Expose to window for cross-module access (breaks.js)
window.setSystemStatus = setSystemStatus;

// ===== Backend Health Check =====
/**
 * Check if backend and database are healthy
 * Used by: All shift/break operations to determine online/offline mode
 * @returns {Promise<boolean>} True if backend and DB are healthy
 */
export async function isBackendHealthy() {
  try {
    const res = await fetch('/api/kiosk/health', {
      cache: 'no-store',
      signal: AbortSignal.timeout(5000) // 5 second timeout
    });

    if (!res.ok) {
      console.warn('❌ Backend health check failed: HTTP', res.status);
      return false;
    }

    const data = await res.json();
    const healthy = data.healthy && data.db;

    if (!healthy) {
      console.warn('❌ Backend unhealthy:', data);
    }

    return healthy;
  } catch (error) {
    console.warn('❌ Backend health check error:', error.message);
    return false;
  }
}

// ===== Timezone Helper =====
/**
 * Convert UTC timestamp to venue timezone and format
 * @param {string} utcTimestamp - ISO timestamp from database
 * @param {string} format - Luxon format string (default: "hh:mm:ss a")
 * @returns {string} Formatted time in venue timezone
 */
function formatVenueTime(utcTimestamp, format = "hh:mm a") {
  if (!utcTimestamp || !kioskContext?.timezone) {
    return new Date(utcTimestamp).toLocaleTimeString();
  }

  const dt = DateTime.fromISO(utcTimestamp, { zone: 'utc' })
    .setZone(kioskContext.timezone);

  return dt.toFormat(format);
}

// Initialize kiosk
document.addEventListener("DOMContentLoaded", initializeKiosk);

// ===== Step 5: Memory & Loop Watchdog =====
// Monitors memory usage and queue size every hour
window.watchdogInterval = setInterval(() => {
  const queueSize = getQueuedBreakCount();
  const memoryUsage = performance.memory ? performance.memory.usedJSHeapSize : null;

  logEvent('watchdog', {
    queue: queueSize,
    memory: memoryUsage,
    timestamp: new Date().toISOString()
  });

  // Warn if queue is growing unexpectedly
  if (queueSize > 50) {
    console.warn(`⚠️  Queue size is large: ${queueSize} events`);
    logEvent('watchdogAlert', { reason: 'large_queue', size: queueSize });
  }

  // Warn if memory usage is high (> 100MB)
  if (memoryUsage && memoryUsage > 100 * 1024 * 1024) {
    console.warn(`⚠️  Memory usage is high: ${(memoryUsage / (1024 * 1024)).toFixed(2)} MB`);
    logEvent('watchdogAlert', { reason: 'high_memory', mb: (memoryUsage / (1024 * 1024)).toFixed(2) });
  }
}, 3600000); // Every hour

function initializeKiosk() {
  // Check if kiosk is already logged in
  kioskContext = JSON.parse(localStorage.getItem("kioskContext") || "{}");

  if (kioskContext.venue_code && kioskContext.business_code) {
    showKioskPanel();
    loadStaffGrid();

    // Start periodic status polling
    startStatusPolling();

    // Setup idle detection
    setupIdleDetection();

    // Sync any queued breaks on startup
    if (navigator.onLine) {
      syncQueuedBreaks();
    }
  } else {
    showLoginForm();
  }

  // Setup network listeners
  setupNetworkListeners();

  // Setup event listeners
  setupEventListeners();
}

// ===== Network Detection =====
function setupNetworkListeners() {
  // Use named functions for proper cleanup (Step 6)
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);

  // Show queue status if any
  const queuedCount = getQueuedBreakCount();
  if (queuedCount > 0) {
    showToast(`${queuedCount} break event(s) pending sync`, 'info');
  }
}

// ===== UI State Functions =====
function showLoginForm() {
  document.getElementById("kioskLogin").style.display = "block";
  document.getElementById("kioskPanel").style.display = "none";
  document.getElementById("venueName").textContent = "Kiosk Login Required";
}

function showKioskPanel() {
  document.getElementById("kioskLogin").style.display = "none";
  document.getElementById("kioskPanel").style.display = "block";
  document.getElementById("logoutBtn").style.display = "block";

  // Start the venue clock
  startVenueClock();
}

// ===== Venue Clock =====
function startVenueClock() {
  if (!kioskContext || !kioskContext.timezone) return;

  const tz = kioskContext.timezone;

  function updateClock() {
    const now = DateTime.utc().setZone(tz);
    const clockElement = document.getElementById("venueClock");
    if (clockElement) {
      clockElement.textContent = now.toFormat("hh:mm:ss a") + " " + now.offsetNameShort;
    }
  }

  // Update immediately and then every second
  updateClock();
  if (window.clockInterval) {
    clearInterval(window.clockInterval);
  }
  window.clockInterval = setInterval(updateClock, 1000);
}

function stopVenueClock() {
  if (window.clockInterval) {
    clearInterval(window.clockInterval);
    window.clockInterval = null;
  }
}

// ===== Kiosk Login =====
async function kioskLogin() {
  const username = document.getElementById("kioskUsername").value.trim();
  const password = document.getElementById("kioskPassword").value.trim();
  const errorBox = document.getElementById("kioskLoginError");
  const passwordField = document.getElementById("kioskPassword");

  errorBox.innerHTML = "";

  if (!username || !password) {
    errorBox.innerHTML = `<div class="alert alert-warning">⚠️ Please enter both venue code and password</div>`;
    passwordField.focus();
    return;
  }

  try {
    const res = await fetch("/api/kiosk/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      errorBox.innerHTML = `<div class="alert alert-danger">❌ ${data.error || "Invalid login. Please try again."}</div>`;
      passwordField.value = "";
      passwordField.focus();
      return;
    }

    // Save kiosk context with timezone
    kioskContext = {
      venue_code: data.venue_code,
      business_code: data.business_code,
      venue_name: data.venue_name,
      contact_email: data.contact_email,
      timezone: data.timezone || 'Australia/Sydney'
    };
    localStorage.setItem("kioskContext", JSON.stringify(kioskContext));

    // Clear form
    document.getElementById("kioskUsername").value = "";
    passwordField.value = "";
    errorBox.innerHTML = "";

    showKioskPanel();
    loadStaffGrid();

  } catch (err) {
    console.error("Error during kiosk login:", err);
    errorBox.innerHTML = `<div class="alert alert-danger">⚠️ Server error, please try again later.</div>`;
    passwordField.value = "";
    passwordField.focus();
  }
}

// ===== Staff Grid =====
async function loadStaffGrid() {
  if (!kioskContext.venue_code || !kioskContext.business_code) {
    console.warn("No kiosk context found");
    showLoginForm();
    return;
  }

  document.getElementById("venueName").textContent = `Venue: ${kioskContext.venue_name || kioskContext.venue_code}`;

  try {
    const response = await fetch(`/api/kiosk/staff?business_code=${kioskContext.business_code}&venue_code=${kioskContext.venue_code}`);
    const result = await response.json();

    if (!result.success || !result.data) {
      throw new Error("Failed to load staff");
    }

    // Cache staff data with PINs for offline use (testing phase)
    localStorage.setItem('cachedStaff', JSON.stringify(result.data));
    console.log(`📦 Cached ${result.data.length} staff records for offline use`);

    const grid = document.getElementById("staffGrid");
    grid.innerHTML = result.data.map(s => `
      <div class="staff-card bg-white rounded-xl shadow-lg p-6 cursor-pointer transition-all duration-200 hover:shadow-2xl hover:-translate-y-1 hover:scale-105 flex flex-col items-center justify-center min-h-[160px] relative overflow-hidden status-idle"
           data-staff-code="${s.staff_code}"
           data-staff-name="${s.first_name} ${s.last_name}">
        <div class="status-badge idle"></div>
        <i class="bi bi-person-circle text-6xl text-blue-600 mb-2"></i>
        <div class="font-semibold text-lg text-slate-800 text-center">${s.first_name} ${s.last_name}</div>
        <div class="time-overlay hidden"></div>
      </div>
    `).join("");

    // Fetch status for all staff and update tiles
    await updateAllStaffStatus();
  } catch (err) {
    console.error("Error loading staff:", err);
    document.getElementById("staffGrid").innerHTML = "<p class='text-danger'>Failed to load staff</p>";
  }
}

// ===== Staff Status Updates =====

/**
 * Update all staff statuses using batch endpoint (Step 4: Performance Optimization)
 * Step 5: Added retry/back-off for resilience
 * Replaces N× individual API calls with single batch request
 */
async function updateAllStaffStatus(retry = 0) {
  if (!kioskContext?.venue_code || !kioskContext?.business_code) {
    console.warn('No venue/business context available for batch status update');
    return false;
  }

  logEvent('pollStart', { venue: kioskContext.venue_code, retry });

  try {
    const response = await fetch(`/api/kiosk/status/venue/${kioskContext.venue_code}?business_code=${kioskContext.business_code}`, {
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    if (!result.success || !Array.isArray(result.data)) {
      throw new Error('Invalid batch status response');
    }

    logEvent('pollEnd', { count: result.data.length, success: true });
    console.log(`✅ Batch status: ${result.data.length} staff records loaded`);

    // Update each staff card from batch data
    result.data.forEach(updateStaffCardFromBatch);

    return true;

  } catch (error) {
    logEvent('pollFailed', { error: error.message, retry });
    console.error(`❌ Batch status update failed (attempt ${retry + 1}):`, error.message);

    // Retry with exponential back-off (max 3 retries)
    if (retry < 3) {
      const delay = Math.pow(2, retry) * 2000; // 2s, 4s, 8s
      console.log(`⏳ Retrying batch status in ${delay / 1000}s...`);

      setTimeout(() => updateAllStaffStatus(retry + 1), delay);
    } else {
      // Max retries reached
      logEvent('pollExhausted', { retries: retry });
      showToast('⚠️ Status polling temporarily failed', 'warning', 3000);
    }

    return false;
  }
}

/**
 * Update single staff card from batch status data
 * @param {Object} record - Staff status record from batch endpoint
 */
function updateStaffCardFromBatch(record) {
  const card = document.querySelector(`[data-staff-code="${record.staff_code}"]`);
  if (!card) return;

  const badge = card.querySelector('.status-badge');
  const overlay = card.querySelector('.time-overlay');

  // Remove all status classes
  card.classList.remove('status-idle', 'status-active', 'status-break');

  const state = record.shift_state;

  if (state === 'ACTIVE') {
    card.classList.add('status-active');
    badge.className = 'status-badge active';

    if (record.clock_in) {
      const duration = calculateDuration(record.clock_in);
      overlay.textContent = `🕒 ${duration} working`;
      overlay.classList.remove('hidden');
    }
  } else if (state === 'ON_BREAK') {
    card.classList.add('status-break');
    badge.className = 'status-badge break';

    if (record.last_action_time) {
      const breakDuration = calculateDuration(record.last_action_time);
      overlay.textContent = `☕ ${breakDuration} on break`;
      overlay.classList.remove('hidden');
    }
  } else {
    // state === 'NONE' or null (idle)
    card.classList.add('status-idle');
    badge.className = 'status-badge idle';
    overlay.classList.add('hidden');
  }
}

async function updateStaffCardStatus(staffCode) {
  try {
    const response = await fetch(`/api/kiosk/status/${staffCode}?venue_code=${kioskContext.venue_code}`);
    const data = await response.json();

    const card = document.querySelector(`[data-staff-code="${staffCode}"]`);
    if (!card) return;

    const badge = card.querySelector('.status-badge');
    const overlay = card.querySelector('.time-overlay');

    // Remove all status classes
    card.classList.remove('status-idle', 'status-active', 'status-break');

    if (data.active && data.shift_state) {
      const state = data.shift_state;
      const clockInTime = data.clock_in;

      if (state === 'ACTIVE') {
        card.classList.add('status-active');
        badge.className = 'status-badge active';

        if (clockInTime) {
          const duration = calculateDuration(clockInTime);
          overlay.textContent = `🕒 ${duration} working`;
          overlay.classList.remove('hidden');
        }
      } else if (state === 'ON_BREAK') {
        card.classList.add('status-break');
        badge.className = 'status-badge break';

        if (data.last_action_time) {
          const breakDuration = calculateDuration(data.last_action_time);
          overlay.textContent = `☕ ${breakDuration} on break`;
          overlay.classList.remove('hidden');
        }
      }
    } else {
      // Idle state
      card.classList.add('status-idle');
      badge.className = 'status-badge idle';
      overlay.classList.add('hidden');
    }
  } catch (error) {
    console.error(`Error fetching status for ${staffCode}:`, error);
  }
}

function calculateDuration(startTime) {
  if (!startTime || !kioskContext?.timezone) {
    return '0m';
  }

  const start = DateTime.fromISO(startTime, { zone: 'utc' }).setZone(kioskContext.timezone);
  const now = DateTime.utc().setZone(kioskContext.timezone);
  const diff = now.diff(start, ['hours', 'minutes']);

  const hours = Math.floor(diff.hours);
  const minutes = Math.floor(diff.minutes);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// ===== Periodic Status Poll =====
/**
 * Start polling staff status with batch endpoint
 * Step 4: Reduced from 10min to 1min since batch is efficient
 */
function startStatusPolling() {
  // Clear any existing interval
  if (window.statusPollInterval) {
    clearInterval(window.statusPollInterval);
  }

  // Immediate first run
  updateAllStaffStatus();

  // Poll every 60 seconds (efficient with batch endpoint)
  window.statusPollInterval = setInterval(() => {
    if (!document.hidden && kioskContext?.venue_code) {
      updateAllStaffStatus();
    }
  }, 60000); // 1 minute (safe with batch optimization)

  console.log('✅ Status polling started (60s interval, batch mode)');
}

function stopStatusPolling() {
  if (window.statusPollInterval) {
    clearInterval(window.statusPollInterval);
    window.statusPollInterval = null;
    console.log('⏹️ Status polling stopped');
  }
}

// ===== Idle Screen Management =====
let lastActivityTime = Date.now();
const IDLE_TIMEOUT = 30 * 60 * 1000; // 30 minutes

function resetIdleTimer() {
  lastActivityTime = Date.now();
  hideIdleScreen();
}

function checkIdleStatus() {
  const now = Date.now();
  if (now - lastActivityTime >= IDLE_TIMEOUT) {
    showIdleScreen();
  }
}

function showIdleScreen() {
  const overlay = document.getElementById('idleOverlay');
  if (overlay) {
    overlay.classList.remove('hidden');
    stopStatusPolling();
  }
}

function hideIdleScreen() {
  const overlay = document.getElementById('idleOverlay');
  if (overlay && !overlay.classList.contains('hidden')) {
    overlay.classList.add('hidden');
    startStatusPolling();
  }
}

function setupIdleDetection() {
  // Check idle status every minute
  window.idleTimer = setInterval(checkIdleStatus, 60000);

  // Reset on any activity
  const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
  activityEvents.forEach(event => {
    document.addEventListener(event, resetIdleTimer, true);
  });

  // Wake from idle screen
  const overlay = document.getElementById('idleOverlay');
  if (overlay) {
    overlay.addEventListener('click', resetIdleTimer);
  }
}

// ===== Staff Selection & PIN Validation =====
async function selectStaff(staffCode, staffName) {
  localStorage.setItem("tempStaffCode", staffCode);
  localStorage.setItem("tempStaffName", staffName);
  showPinModal(staffName);
}

function showPinModal(staffName) {
  const pinModal = document.getElementById("pinModal");
  const pinInput = document.getElementById("pinInput");
  const pinError = document.getElementById("pinError");
  const pinStaffName = document.getElementById("pinStaffName");

  pinStaffName.textContent = staffName;
  pinInput.value = "";
  pinError.classList.add("hidden");
  pinError.textContent = "";

  pinModal.classList.remove("hidden");
  setTimeout(() => pinInput.focus(), 100);
}

function hidePinModal() {
  document.getElementById("pinModal").classList.add("hidden");
  document.getElementById("pinInput").value = "";
  document.getElementById("pinError").classList.add("hidden");
}

/**
 * Validate PIN offline using cached staff data
 * Testing phase only - uses plain text PIN comparison
 * TODO: Replace with hashed PIN verification before production
 */
async function validatePinOffline(staffCode, enteredPin) {
  try {
    const cached = JSON.parse(localStorage.getItem('cachedStaff') || '[]');
    const staff = cached.find(s => s.staff_code === staffCode);

    if (!staff) {
      console.warn(`❌ Staff ${staffCode} not found in offline cache`);
      return false;
    }

    if (!staff.kiosk_pin) {
      console.warn(`❌ No PIN stored for staff ${staffCode}`);
      return false;
    }

    return staff.kiosk_pin === enteredPin;
  } catch (error) {
    console.error('Error validating PIN offline:', error);
    return false;
  }
}

async function validatePinAndProceed() {
  const pin = document.getElementById("pinInput").value.trim();
  const pinError = document.getElementById("pinError");
  const staffCode = localStorage.getItem("tempStaffCode");
  const staffName = localStorage.getItem("tempStaffName");

  if (!/^\d{6}$/.test(pin)) {
    pinError.textContent = "❌ Please enter a valid 6-digit PIN";
    pinError.classList.remove("hidden");
    document.getElementById("pinInput").value = "";
    document.getElementById("pinInput").focus();
    return;
  }

  // Check if offline first
  if (!navigator.onLine) {
    console.log('📴 Offline mode - using cached PIN validation');
    const valid = await validatePinOffline(staffCode, pin);

    if (!valid) {
      pinError.textContent = "❌ Invalid PIN (offline mode)";
      pinError.classList.remove("hidden");
      document.getElementById("pinInput").value = "";
      document.getElementById("pinInput").focus();
      return;
    }

    console.log('✅ Offline PIN validated successfully');
    hidePinModal();
    proceedToClockSection(staffCode, staffName);
    return;
  }

  // Online mode - validate with server
  try {
    const response = await fetch("/api/kiosk/validate-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        staff_code: staffCode,
        pin: pin,
        venue_code: kioskContext.venue_code
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      pinError.textContent = "❌ " + (data.error || "Invalid PIN. Please try again.");
      pinError.classList.remove("hidden");
      document.getElementById("pinInput").value = "";
      document.getElementById("pinInput").focus();
      return;
    }

    hidePinModal();
    proceedToClockSection(staffCode, staffName);

  } catch (err) {
    console.error("Error validating PIN:", err);

    // Fallback to offline validation if server unreachable
    console.log('⚠️ Server unreachable - attempting offline PIN validation');
    const valid = await validatePinOffline(staffCode, pin);

    if (!valid) {
      pinError.textContent = "⚠️ Connection error and offline validation failed";
      pinError.classList.remove("hidden");
      document.getElementById("pinInput").value = "";
      document.getElementById("pinInput").focus();
      return;
    }

    console.log('✅ Offline PIN validated successfully (fallback)');
    hidePinModal();
    proceedToClockSection(staffCode, staffName);
  }
}

async function proceedToClockSection(staffCode, staffName) {
  currentStaff = { staff_code: staffCode, name: staffName };

  document.getElementById("staffGrid").classList.add("hidden");
  document.getElementById("clockSection").classList.remove("hidden");
  document.getElementById("selectedStaffName").textContent = staffName;

  await refreshStatus(staffCode);
}

function backToStaffList() {
  currentStaff = null;
  currentShiftId = null;
  document.getElementById("staffGrid").classList.remove("hidden");
  document.getElementById("clockSection").classList.add("hidden");
}

// ===== Shift Status & Break Tracking =====
async function refreshStatus(staffCode) {
  // Check localStorage for current shift first
  const localShift = getCurrentShift();

  if (localShift && localShift.staff_code === staffCode) {
    currentShiftId = localShift.shift_id;
    updateUIForShiftState(localShift.shift_state, localShift.clock_in);
    return;
  }

  // Otherwise, fetch from server
  try {
    const res = await fetch(`/api/kiosk/status/${staffCode}?venue_code=${kioskContext.venue_code}`);
    const data = await res.json();

    if (data.active) {
      // Use the actual shift_state from server, not hardcoded 'ACTIVE'
      currentShiftId = data.shift_id;
      updateUIForShiftState(data.shift_state || 'ACTIVE', data.clock_in);
    } else if (data.activeAtOtherVenue) {
      // Staff has active shift at different venue
      currentShiftId = null;
      updateUIForShiftState('OTHER_VENUE', null, data.otherVenue);
    } else {
      currentShiftId = null;
      updateUIForShiftState('NONE');
    }
  } catch (err) {
    console.error("Error fetching shift status:", err);
    updateUIForShiftState('NONE');
  }
}

function updateUIForShiftState(state, clockInTime, otherVenueData) {
  const statusEl = document.getElementById("statusDisplay");
  const clockInBtn = document.getElementById("clockInBtn");
  const clockOutBtn = document.getElementById("clockOutBtn");
  const breakInBtn = document.getElementById("breakInBtn");
  const breakOutBtn = document.getElementById("breakOutBtn");

  // Reset all buttons
  clockInBtn.disabled = false;
  clockOutBtn.disabled = true;
  breakInBtn.disabled = true;
  breakInBtn.classList.add("d-none");
  breakOutBtn.disabled = true;
  breakOutBtn.classList.add("d-none");

  switch (state) {
    case 'ACTIVE':
      statusEl.className = "alert alert-success text-center";
      statusEl.textContent = clockInTime
        ? `✅ Currently clocked in since ${formatVenueTime(clockInTime)}`
        : '✅ Shift active';
      clockInBtn.disabled = true;
      clockOutBtn.disabled = false;
      breakInBtn.disabled = false;
      breakInBtn.classList.remove("d-none");
      break;

    case 'ON_BREAK':
      statusEl.className = "alert alert-warning text-center";
      statusEl.textContent = '⏸️ Currently on break';
      clockInBtn.disabled = true;
      clockOutBtn.disabled = false;
      breakOutBtn.disabled = false;
      breakOutBtn.classList.remove("d-none");
      break;

    case 'OTHER_VENUE':
      statusEl.className = "alert alert-danger text-center";
      statusEl.innerHTML = `
        ⚠️ Cannot clock in<br>
        <small>Active shift at: <strong>${otherVenueData?.venue_name || 'another venue'}</strong><br>
        Please clock out there first</small>
      `;
      clockInBtn.disabled = true;
      break;

    case 'NONE':
    default:
      statusEl.className = "alert alert-info text-center";
      statusEl.textContent = "Not clocked in";
      break;
  }
}

// ===== Clock In/Out & Break Functions =====
async function clockIn() {
  if (!currentStaff) return;

  try {
    const shiftData = await breakClockIn(currentStaff.staff_code, kioskContext.venue_code);
    currentShiftId = shiftData.shift_id;
    await refreshStatus(currentStaff.staff_code);
    // Update staff grid tile
    await updateStaffCardStatus(currentStaff.staff_code);
  } catch (err) {
    // Error already shown by breaks.js
  }
}

async function handleBreakIn() {
  if (!currentShiftId || !currentStaff) return;

  try {
    await startBreak(currentShiftId, currentStaff.staff_code, kioskContext?.venue_code);
    await refreshStatus(currentStaff.staff_code);
    // Update staff grid tile
    await updateStaffCardStatus(currentStaff.staff_code);
  } catch (err) {
    // Error already shown by breaks.js
  }
}

async function handleBreakOut() {
  if (!currentShiftId || !currentStaff) return;

  try {
    await endBreak(currentShiftId, currentStaff.staff_code, kioskContext?.venue_code);
    await refreshStatus(currentStaff.staff_code);
    // Update staff grid tile
    await updateStaffCardStatus(currentStaff.staff_code);
  } catch (err) {
    // Error already shown by breaks.js
  }
}

async function clockOut() {
  if (!currentShiftId || !currentStaff) return;

  try {
    const result = await breakClockOut(currentShiftId, currentStaff.staff_code, kioskContext?.venue_code);

    // Show shift summary if available
    if (result.shift) {
      showShiftSummary(result.shift);
    }

    currentShiftId = null;
    await refreshStatus(currentStaff.staff_code);
    // Update staff grid tile
    await updateStaffCardStatus(currentStaff.staff_code);
  } catch (err) {
    // Error already shown by breaks.js
  }
}

function showShiftSummary(shift) {
  const startTime = formatVenueTime(shift.clock_in);
  const endTime = formatVenueTime(shift.clock_out);

  let shiftDetails = `
    <div class="text-center">
      <h4>✅ Shift Ended</h4>
      <p><strong>Started:</strong> ${startTime}</p>
      <p><strong>Ended:</strong> ${endTime}</p>
      <p><strong>Hours Worked:</strong> ${shift.hours_worked}h</p>
      <p><strong>Break Time:</strong> ${shift.break_minutes} min</p>
  `;

  if (shift.total_pay && shift.applied_rate) {
    shiftDetails += `
      <p><strong>Rate:</strong> $${shift.applied_rate}/hour</p>
      <p><strong>Total Pay:</strong> $${shift.total_pay}</p>
    `;
  }

  shiftDetails += `</div>`;

  const msgEl = document.getElementById("message");
  msgEl.innerHTML = shiftDetails;
  msgEl.className = "alert mt-3 alert-success";
  msgEl.classList.remove("hidden");

  // Auto-return to staff list after 7 seconds
  setTimeout(() => {
    backToStaffList();
    msgEl.classList.add("hidden");
  }, 7000);
}

// ===== Named Event Handlers for Cleanup (Step 6) =====

/**
 * Named function for visibility change handler
 * Defined here so it can be removed during cleanup
 */
function handleVisibilityChange() {
  if (document.hidden) {
    console.log('🕶️ Kiosk hidden — pausing polling & health checks');
    if (window.statusPollInterval) clearInterval(window.statusPollInterval);
    if (window.healthInterval) clearInterval(window.healthInterval);
    window.statusPollInterval = null;
    window.healthInterval = null;
    setSystemStatus('paused');
  } else {
    console.log('👁️ Kiosk visible — resuming polling');
    // Restart status polling
    startStatusPolling();
    // Restart health monitoring
    startHealthMonitoring();
    setSystemStatus('online');
  }
}

/**
 * Named function for online event handler
 */
function handleOnline() {
  showToast('Connection restored', 'success');

  // Hide offline banner
  const banner = document.getElementById('offlineBanner');
  if (banner) {
    banner.style.display = 'none';
    console.log('🌐 Network online - banner hidden');
  }

  // Refresh status after a short delay to let sync complete (handled by breaks.js)
  setTimeout(async () => {
    const queuedCount = getQueuedBreakCount();
    if (queuedCount === 0 && currentStaff) {
      // Only refresh if queue is cleared
      await refreshStatus(currentStaff.staff_code);
    }
  }, 2000);
}

/**
 * Named function for offline event handler
 */
function handleOffline() {
  showToast('You are offline. Break events will be queued for sync.', 'warning', 5000);

  // Show offline banner
  const banner = document.getElementById('offlineBanner');
  if (banner) {
    banner.style.display = 'block';
    console.log('📴 Network offline - banner shown');
  }
}

/**
 * Named function for beforeunload handler
 */
function handleBeforeUnload(e) {
  console.log('🚪 Window closing — running cleanup');

  // Check if there are pending events
  const queuedCount = getQueuedBreakCount();
  if (queuedCount > 0) {
    // Show warning if there are unsyncedked events
    const message = `You have ${queuedCount} unsynced break event(s). They will be synced on next login.`;
    e.preventDefault();
    e.returnValue = message;
    return message;
  }

  // Run cleanup
  cleanupKiosk('beforeunload');
}

// ===== Kiosk Cleanup & Logout (Step 6) =====

/**
 * Unified cleanup function for logout and beforeunload
 * Stops all intervals, removes event listeners, clears caches
 * @param {string} reason - 'logout' or 'beforeunload'
 */
function cleanupKiosk(reason = 'logout') {
  console.log(`🧹 Cleaning up kiosk (${reason})`);
  logEvent('cleanupStart', { reason });

  // 1. Clear all intervals
  const intervals = [
    window.statusPollInterval,
    window.healthInterval,
    window.watchdogInterval,
    window.idleTimer,
    window.clockInterval
  ];

  intervals.forEach((id, index) => {
    if (id) {
      clearInterval(id);
      console.log(`✅ Cleared interval ${index + 1}/5`);
    }
  });

  // Reset interval globals
  window.statusPollInterval = null;
  window.healthInterval = null;
  window.watchdogInterval = null;
  window.idleTimer = null;
  window.clockInterval = null;

  // 2. Remove event listeners (using named functions)
  window.removeEventListener('visibilitychange', handleVisibilityChange);
  window.removeEventListener('online', handleOnline);
  window.removeEventListener('offline', handleOffline);

  // 3. Clear localStorage caches (except logs)
  if (reason === 'logout') {
    localStorage.removeItem('kioskContext');
    localStorage.removeItem('cachedStaff');
    localStorage.removeItem('pendingBreakEvents');
    sessionStorage.clear();
    console.log('✅ Local storage cleared');
  }

  // 4. Reset UI state
  setSystemStatus('offline');
  const banner = document.getElementById('offlineBanner');
  if (banner) banner.style.display = 'none';

  // Disable all controls
  document.querySelectorAll('button').forEach(btn => {
    if (btn.id !== 'logoutBtn' && btn.id !== 'kioskLoginButton') {
      btn.disabled = true;
    }
  });

  logEvent('cleanupEnd', { reason, success: true });
  console.log('✅ Kiosk cleanup complete');
}

// ===== Kiosk Logout =====
function kioskLogout() {
  console.log('🚪 Logging out — running full cleanup');

  // Run unified cleanup
  cleanupKiosk('logout');

  // Reset state variables
  kioskContext = null;
  currentStaff = null;
  currentShiftId = null;

  // Reset UI to login screen
  document.getElementById("logoutBtn").style.display = "none";
  document.getElementById("kioskPanel").style.display = "none";
  document.getElementById("kioskLogin").style.display = "block";

  const passwordField = document.getElementById("kioskPassword");
  passwordField.value = "";
  passwordField.focus();

  document.getElementById("kioskLoginError").innerHTML = "";
  document.getElementById("venueName").textContent = "Kiosk Login Required";

  console.log('✅ Logout complete');
}

// ===== Event Listeners =====
function setupEventListeners() {
  // Kiosk login
  document.getElementById("kioskLoginButton")?.addEventListener("click", kioskLogin);

  // Logout
  document.getElementById("logoutBtn")?.addEventListener("click", kioskLogout);

  // Back to staff list
  document.getElementById("backToStaffListBtn")?.addEventListener("click", backToStaffList);

  // Clock In/Out
  document.getElementById("clockInBtn")?.addEventListener("click", clockIn);
  document.getElementById("clockOutBtn")?.addEventListener("click", clockOut);

  // Break In/Out
  document.getElementById("breakInBtn")?.addEventListener("click", handleBreakIn);
  document.getElementById("breakOutBtn")?.addEventListener("click", handleBreakOut);

  // PIN modal
  document.getElementById("pinSubmitBtn")?.addEventListener("click", validatePinAndProceed);
  document.getElementById("pinCancelBtn")?.addEventListener("click", hidePinModal);

  // PIN input
  const pinInput = document.getElementById("pinInput");
  if (pinInput) {
    pinInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") validatePinAndProceed();
    });
    pinInput.addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/[^0-9]/g, "");
    });
  }

  // Staff card selection (event delegation)
  document.body.addEventListener("click", (e) => {
    const staffCard = e.target.closest(".staff-card");
    if (staffCard) {
      const staffCode = staffCard.dataset.staffCode;
      const staffName = staffCard.dataset.staffName;
      if (staffCode && staffName) {
        selectStaff(staffCode, staffName);
      }
    }
  });

  // ======================================================
  // Step 6: Lifecycle Management Listeners
  // ======================================================

  // Visibility change handler - pause/resume polling when tab hidden/visible
  window.addEventListener('visibilitychange', handleVisibilityChange);

  // Beforeunload handler - cleanup on window close
  window.addEventListener('beforeunload', handleBeforeUnload);

  // Start health monitoring on kiosk startup
  startHealthMonitoring();

  console.log('✅ Lifecycle listeners registered (visibility, beforeunload, health)');
}

/**
 * Start backend health monitoring (Step 6)
 */
function startHealthMonitoring() {
  if (window.healthInterval) {
    clearInterval(window.healthInterval);
  }

  // Immediate check
  monitorBackendHealth();

  // Poll every 30 seconds
  window.healthInterval = setInterval(monitorBackendHealth, 30000);
  console.log('✅ Health monitoring started (30s interval)');
}

/**
 * Stop backend health monitoring (Step 6)
 */
function stopHealthMonitoring() {
  if (window.healthInterval) {
    clearInterval(window.healthInterval);
    window.healthInterval = null;
    console.log('⏹️ Health monitoring stopped');
  }
}

/**
 * Monitor backend health and update UI accordingly
 * Step 4: Integrated with status polling start/stop
 * Step 5: Updates system status indicator
 * Step 6: Can be stopped/started independently
 */
async function monitorBackendHealth() {
  // Don't interfere if sync is in progress
  if (isSyncInProgress()) {
    console.log('⏭️ Skipping health check - sync in progress');
    setSystemStatus('syncing');
    return;
  }

  const banner = document.getElementById('offlineBanner');
  const healthy = await isBackendHealthy();

  if (!healthy) {
    if (banner) banner.style.display = 'block';
    disableKioskControls(true);
    stopStatusPolling(); // Stop polling when backend is down
    setSystemStatus('offline');
    console.warn('⚠️ Backend unhealthy - controls disabled, polling stopped');
  } else {
    if (banner) banner.style.display = 'none';
    disableKioskControls(false);
    setSystemStatus('online');

    // Start/restart polling when backend is healthy
    if (!window.statusPollInterval) {
      startStatusPolling();
    }

    // Trigger sync if backend just recovered and queue has events
    const queuedCount = getQueuedBreakCount();
    if (queuedCount > 0) {
      console.log(`🔄 Backend recovered - attempting to sync ${queuedCount} events`);
      setSystemStatus('syncing');
      attemptSync();
    }
  }
}

/**
 * Disable/enable all kiosk control buttons
 * @param {boolean} disabled - True to disable, false to enable
 */
function disableKioskControls(disabled) {
  // Disable all buttons except logout
  const buttons = document.querySelectorAll('button:not(#logoutBtn)');
  buttons.forEach(btn => {
    btn.disabled = disabled;
    if (disabled) {
      btn.style.opacity = '0.5';
      btn.style.cursor = 'not-allowed';
    } else {
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
    }
  });
}
