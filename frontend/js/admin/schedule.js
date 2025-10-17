/**
 * Schedule Management Module
 * Handles displaying and managing user schedules/shifts
 */

import { apiRequest } from '../utils/api.js';
import { Storage } from '../utils/storage.js';
import { showToast } from '../utils/ui.js';

/**
 * Load and display user's schedule
 */
export async function loadSchedule() {
  const scheduleTable = document.getElementById('scheduleTable');

  if (!scheduleTable) {
    console.warn('Schedule table container not found');
    return;
  }

  // Show loading state
  scheduleTable.innerHTML = `
    <div class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="text-muted mt-3">Loading schedule...</p>
    </div>`;

  try {
    const staffCode = Storage.getUserStaffCode();

    if (!staffCode) {
      throw new Error('Staff code not found. Please log in again.');
    }

    console.log('Loading schedule for staff_code:', staffCode);

    const response = await apiRequest(`/system-admin/schedules?staff_code=${staffCode}`);

    console.log('Schedule response:', response);

    if (!response.success) {
      throw new Error(response.error || 'Failed to load schedule');
    }

    const shifts = response.data || [];

    // Display the schedule
    renderSchedule(shifts);

    if (shifts.length > 0) {
      showToast(`Loaded ${shifts.length} upcoming shift(s)`, 'success');
    }

  } catch (error) {
    console.error('Error loading schedule:', error);
    showToast('Failed to load schedule: ' + error.message, 'error');
    scheduleTable.innerHTML = `
      <div class="alert alert-danger m-4" role="alert">
        <i class="fas fa-exclamation-triangle me-2"></i>
        <strong>Error loading schedule:</strong> ${error.message}
      </div>`;
  }
}

/**
 * Render schedule in table format
 * @param {Array} shifts - Array of shift objects
 */
function renderSchedule(shifts) {
  const scheduleTable = document.getElementById('scheduleTable');

  if (!shifts || shifts.length === 0) {
    scheduleTable.innerHTML = `
      <div class="text-center py-5">
        <i class="fas fa-calendar-times fa-4x mb-3 text-muted"></i>
        <h5>No Upcoming Shifts</h5>
        <p class="text-muted">You don't have any scheduled shifts at the moment.</p>
      </div>`;
    return;
  }

  // Group shifts by date
  const shiftsByDate = groupShiftsByDate(shifts);

  // Build the calendar-style view
  let html = '<div class="schedule-calendar">';

  Object.keys(shiftsByDate).forEach(date => {
    const dateShifts = shiftsByDate[date];
    const dateObj = new Date(date);
    const dayName = dateObj.toLocaleDateString('en-AU', { weekday: 'long' });
    const formattedDate = dateObj.toLocaleDateString('en-AU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });

    html += `
      <div class="schedule-day-card mb-3">
        <div class="schedule-day-header">
          <div>
            <h5 class="mb-0">${dayName}</h5>
            <small class="text-muted">${formattedDate}</small>
          </div>
          <span class="badge bg-primary">${dateShifts.length} shift${dateShifts.length > 1 ? 's' : ''}</span>
        </div>
        <div class="schedule-day-shifts">`;

    dateShifts.forEach(shift => {
      const statusBadge = getStatusBadge(shift.status);

      html += `
        <div class="schedule-shift-item">
          <div class="shift-time">
            <i class="fas fa-clock me-2"></i>
            <strong>${formatTime(shift.start_time)} - ${formatTime(shift.end_time)}</strong>
          </div>
          <div class="shift-venue">
            <i class="fas fa-building me-2"></i>
            ${shift.venue_name}
            ${shift.state ? `<span class="badge bg-secondary ms-2">${shift.state}</span>` : ''}
          </div>
          ${shift.venue_address ? `
            <div class="shift-address text-muted small">
              <i class="fas fa-map-marker-alt me-2"></i>
              ${shift.venue_address}
            </div>
          ` : ''}
          <div class="shift-status">
            ${statusBadge}
          </div>
        </div>`;
    });

    html += `
        </div>
      </div>`;
  });

  html += '</div>';

  scheduleTable.innerHTML = html;
}

/**
 * Group shifts by date
 * @param {Array} shifts - Array of shift objects
 * @returns {Object} Shifts grouped by date
 */
function groupShiftsByDate(shifts) {
  const grouped = {};

  shifts.forEach(shift => {
    const date = shift.shift_date;
    if (!grouped[date]) {
      grouped[date] = [];
    }
    grouped[date].push(shift);
  });

  // Sort dates
  const sortedDates = Object.keys(grouped).sort((a, b) => new Date(a) - new Date(b));

  const sortedGrouped = {};
  sortedDates.forEach(date => {
    sortedGrouped[date] = grouped[date];
  });

  return sortedGrouped;
}

/**
 * Format time to 12-hour format
 * @param {string} time - Time in HH:MM:SS format
 * @returns {string} Formatted time
 */
function formatTime(time) {
  if (!time) return '';

  try {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 || 12;

    return `${hour12}:${minutes} ${ampm}`;
  } catch (error) {
    return time;
  }
}

/**
 * Get status badge HTML
 * @param {string} status - Shift status
 * @returns {string} Badge HTML
 */
function getStatusBadge(status) {
  const statusMap = {
    'scheduled': '<span class="badge bg-info">Scheduled</span>',
    'confirmed': '<span class="badge bg-success">Confirmed</span>',
    'pending': '<span class="badge bg-warning">Pending</span>',
    'cancelled': '<span class="badge bg-danger">Cancelled</span>',
    'completed': '<span class="badge bg-secondary">Completed</span>'
  };

  return statusMap[status] || `<span class="badge bg-secondary">${status || 'N/A'}</span>`;
}

/**
 * Initialize schedule module - setup event listeners
 */
export function initScheduleModule() {
  console.log('Initializing schedule module...');

  // Refresh button
  const refreshBtn = document.getElementById('refreshScheduleBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      loadSchedule();
    });
  }
}

// Export functions to window for onclick handlers if needed
window.loadSchedule = loadSchedule;
