/**
 * Timesheet Management Module
 * Handles timesheet listing, filtering, and approval workflow
 */

import { apiRequest } from '../utils/api.js';
import { showToast } from '../utils/ui.js';
import { Storage } from '../utils/storage.js';

// Module-level state for filters
let currentFilter = 'ALL';
let currentFrom = '';
let currentTo = '';
let currentStaffCode = null;

/**
 * Load staff list with timesheet summaries
 */
export async function loadTimesheetStaff() {
  const list = document.getElementById('timesheetStaffList');

  if (!list) {
    console.warn('Timesheet staff list container not found');
    return;
  }

  // Show loading state
  list.innerHTML = '<p class="text-muted text-center py-4">Loading staff...</p>';

  try {
    console.log('Loading timesheet staff with filters:', { currentFilter, currentFrom, currentTo });

    // Get business code from storage
    const businessCode = Storage.getUserBusinessCode();
    if (!businessCode) {
      showToast('Missing business context. Please log in again.', 'error');
      list.innerHTML = '<p class="text-danger text-center py-4">Missing business context. Please log in again.</p>';
      return;
    }

    // Build query parameters
    const query = new URLSearchParams({
      business_code: businessCode,
      filter: currentFilter,
      from: currentFrom || '',
      to: currentTo || ''
    });

    const res = await apiRequest(`/system-admin/timesheets/staff?${query}`);

    console.log('Timesheet staff response:', res);

    if (!res.success || !res.data?.length) {
      list.innerHTML = '<p class="text-muted text-center py-4">No staff with timesheets</p>';
      return;
    }

    let html = '<ul class="list-group list-group-flush">';
    res.data.forEach(staff => {
      const statusClass =
        staff.approval_status === 'APPROVED' ? 'success' :
        staff.approval_status === 'PENDING' ? 'warning' :
        'secondary';

      html += `
        <li class="list-group-item d-flex justify-content-between align-items-center staff-item"
            data-staff="${staff.staff_code}"
            style="cursor: pointer;">
          <div>
            <strong>${staff.name}</strong><br>
            <small>${staff.total_shifts || 0} shifts • ${staff.total_hours || 0}h • $${staff.total_pay || 0}</small>
            ${staff.total_break_minutes ? `<br><small class="text-muted">Break: ${staff.total_break_minutes}min</small>` : ''}
          </div>
          <span class="badge bg-${statusClass}">
            ${staff.approval_status || 'PENDING'}
          </span>
        </li>`;
    });
    html += '</ul>';

    list.innerHTML = html;

    // Add click handlers to staff items
    document.querySelectorAll('.staff-item').forEach(item =>
      item.addEventListener('click', () => loadStaffTimesheets(item.dataset.staff))
    );

    showToast(`Loaded ${res.data.length} staff members`, 'success');

  } catch (error) {
    console.error('Error loading staff:', error);
    showToast('Error loading staff list: ' + error.message, 'error');
    list.innerHTML = `
      <div class="alert alert-danger m-3" role="alert">
        <i class="fas fa-exclamation-triangle me-2"></i>
        <strong>Error:</strong> ${error.message}
      </div>`;
  }
}

/**
 * Load timesheets for a specific staff member
 * @param {string} staffCode - Staff code to load timesheets for
 */
export async function loadStaffTimesheets(staffCode) {
  const container = document.getElementById('timesheetDetails');

  if (!container) {
    console.warn('Timesheet details container not found');
    return;
  }

  // Show loading state
  container.innerHTML = `
    <div class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="text-muted mt-3">Loading timesheets...</p>
    </div>`;

  try {
    console.log('Loading timesheets for staff:', staffCode, 'with filters:', { currentFilter, currentFrom, currentTo });

    // Get business code from storage
    const businessCode = Storage.getUserBusinessCode();
    if (!businessCode) {
      showToast('Missing business context. Please log in again.', 'error');
      container.innerHTML = '<p class="text-danger text-center py-4">Missing business context. Please log in again.</p>';
      return;
    }

    // Store current staff code for bulk operations
    currentStaffCode = staffCode;

    // Build query parameters
    const query = new URLSearchParams({
      staff_code: staffCode,
      business_code: businessCode,
      filter: currentFilter,
      from: currentFrom || '',
      to: currentTo || ''
    });

    const res = await apiRequest(`/system-admin/timesheets?${query}`);

    console.log('Staff timesheets response:', res);

    if (!res.success || !res.data?.length) {
      container.innerHTML = '<p class="text-muted text-center py-4">No timesheets found</p>';
      return;
    }

    let html = `
      <div class="d-flex justify-content-between align-items-center mb-3">
        <h5>Timesheets</h5>
        <div class="d-flex gap-2">
          <button class="btn btn-success btn-sm" id="bulkApproveBtn">
            <i class="fas fa-check me-1"></i>Approve Selected
          </button>
          <button class="btn btn-danger btn-sm" id="bulkDiscardBtn">
            <i class="fas fa-times me-1"></i>Discard Selected
          </button>
          <button class="btn btn-outline-secondary btn-sm" id="exportTimesheetBtn">
            <i class="fas fa-file-export me-1"></i>Export CSV
          </button>
          <span class="ms-2">${res.data.length} entries</span>
        </div>
      </div>
      <ul class="list-group">`;

    res.data.forEach(t => {
      const statusClass =
        t.status === 'APPROVED' ? 'success' :
        t.status === 'PENDING' ? 'warning' :
        'secondary';

      html += `
        <li class="list-group-item d-flex justify-content-between align-items-center">
          <div class="form-check">
            <input class="form-check-input timesheet-select" type="checkbox" data-id="${t.id}" data-status="${t.status}">
          </div>
          <div class="flex-grow-1 ms-2">
            <div><strong>${formatDate(t.clock_in)}</strong> • ${formatTime(t.clock_in)} – ${formatTime(t.clock_out)}</div>
            <small>${t.venue_name} ${t.role_title ? `(${t.role_title})` : ''}</small>
            ${t.break_minutes ? `<br><small class="text-muted">Break: ${t.break_minutes}min</small>` : ''}
          </div>
          <div class="text-end d-flex flex-column align-items-end gap-1">
            <div>
              <span class="badge bg-${statusClass}">${t.status}</span>
              <button class="btn btn-outline-secondary btn-sm ms-2 js-edit" data-id="${t.id}">
                <i class="fas fa-pen"></i>
              </button>
            </div>
            <small>${t.hours_worked}h • $${t.total_pay}</small>
          </div>
        </li>`;
    });
    html += '</ul>';

    container.innerHTML = html;

    // Attach event handlers for bulk actions
    const bulkApproveBtn = document.getElementById('bulkApproveBtn');
    const bulkDiscardBtn = document.getElementById('bulkDiscardBtn');
    const exportBtn = document.getElementById('exportTimesheetBtn');

    if (bulkApproveBtn) {
      bulkApproveBtn.addEventListener('click', () => bulkUpdateTimesheets('APPROVED'));
    }

    if (bulkDiscardBtn) {
      bulkDiscardBtn.addEventListener('click', () => bulkUpdateTimesheets('DISCARDED'));
    }

    if (exportBtn) {
      exportBtn.addEventListener('click', exportTimesheetsCSV);
    }

  } catch (error) {
    console.error('Error loading timesheets:', error);
    showToast('Error loading timesheets: ' + error.message, 'error');
    container.innerHTML = `
      <div class="alert alert-danger m-3" role="alert">
        <i class="fas fa-exclamation-triangle me-2"></i>
        <strong>Error:</strong> ${error.message}
      </div>`;
  }
}

/**
 * Bulk update timesheet approval status
 * @param {string} newStatus - New status (APPROVED or DISCARDED)
 */
async function bulkUpdateTimesheets(newStatus) {
  // Get all selected checkboxes
  const checkboxes = document.querySelectorAll('.timesheet-select:checked');

  if (checkboxes.length === 0) {
    showToast('Please select at least one timesheet', 'warning');
    return;
  }

  // Extract timesheet IDs
  const ids = Array.from(checkboxes).map(cb => cb.dataset.id);

  // Confirm action
  const action = newStatus === 'APPROVED' ? 'approve' : 'discard';
  if (!confirm(`Are you sure you want to ${action} ${ids.length} timesheet(s)?`)) {
    return;
  }

  try {
    const res = await apiRequest('/system-admin/timesheets/bulk-update', {
      method: 'PUT',
      body: JSON.stringify({
        ids: ids,
        status: newStatus
      })
    });

    if (res.success) {
      showToast(`Successfully ${action}ed ${ids.length} timesheet(s)`, 'success');
      // Reload timesheets for current staff
      if (currentStaffCode) {
        await loadStaffTimesheets(currentStaffCode);
      }
      // Also reload staff list to update totals
      await loadTimesheetStaff();
    } else {
      throw new Error(res.message || 'Failed to update timesheets');
    }
  } catch (error) {
    console.error('Error updating timesheets:', error);
    showToast('Error updating timesheets: ' + error.message, 'error');
  }
}

/**
 * Export timesheets to CSV
 */
async function exportTimesheetsCSV() {
  if (!currentStaffCode) {
    showToast('Please select a staff member first', 'warning');
    return;
  }

  try {
    // Get business code from storage
    const businessCode = Storage.getUserBusinessCode();
    if (!businessCode) {
      showToast('Missing business context. Please log in again.', 'error');
      return;
    }

    // Build query parameters
    const query = new URLSearchParams({
      staff_code: currentStaffCode,
      business_code: businessCode,
      filter: currentFilter,
      from: currentFrom || '',
      to: currentTo || ''
    });

    const res = await apiRequest(`/system-admin/timesheets/export?${query}`);

    if (res.success && res.csv) {
      // Create a Blob from the CSV string
      const blob = new Blob([res.csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);

      // Create a temporary link and trigger download
      const a = document.createElement('a');
      a.href = url;
      a.download = `timesheets_${currentStaffCode}_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();

      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      showToast('Timesheets exported successfully', 'success');
    } else {
      throw new Error(res.message || 'Failed to export timesheets');
    }
  } catch (error) {
    console.error('Error exporting timesheets:', error);
    showToast('Error exporting timesheets: ' + error.message, 'error');
  }
}

/**
 * Format date to readable string
 * @param {string} dateStr - Date string
 * @returns {string} Formatted date
 */
function formatDate(dateStr) {
  if (!dateStr) return '';

  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-AU', {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  } catch (error) {
    return dateStr;
  }
}

/**
 * Format timestamp to time string
 * @param {string} timestamp - Timestamp
 * @returns {string} Formatted time
 */
function formatTime(timestamp) {
  if (!timestamp) return '';

  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-AU', {
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    return timestamp;
  }
}

/**
 * Initialize timesheet module - setup event listeners
 */
export function initTimesheetModule() {
  console.log('Initializing timesheet module...');

  // Date range filter button
  const filterBtn = document.getElementById('filterTimesheetsBtn');
  if (filterBtn) {
    filterBtn.addEventListener('click', () => {
      const fromDate = document.getElementById('fromDate');
      const toDate = document.getElementById('toDate');

      currentFrom = fromDate?.value || '';
      currentTo = toDate?.value || '';

      console.log('Applying date filter:', { currentFrom, currentTo });
      loadTimesheetStaff();
    });
  }

  // Status filter buttons (All, Pending, Approved, Discarded)
  const filterButtons = document.querySelectorAll('#timesheetFilters button');
  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      // Remove active class from all buttons
      filterButtons.forEach(b => b.classList.remove('active'));
      // Add active class to clicked button
      btn.classList.add('active');

      // Update current filter and reload
      const filter = btn.dataset.filter;
      currentFilter = filter.toUpperCase(); // Convert to match ENUM values
      console.log('Filter selected:', currentFilter);
      loadTimesheetStaff();
    });
  });
}

/**
 * Open edit timesheet modal
 * @param {number} id - Timesheet ID
 */
async function openEditTimesheetModal(id) {
  try {
    const res = await apiRequest(`/system-admin/timesheets/${id}`);
    if (!res.success) {
      showToast('Failed to load timesheet', 'error');
      return;
    }

    const t = res.data;
    document.getElementById('editClockIn').value = t.clock_in.slice(0, 16);
    document.getElementById('editClockOut').value = t.clock_out.slice(0, 16);
    document.getElementById('editPay').value = t.total_pay;

    const modal = new bootstrap.Modal(document.getElementById('editTimesheetModal'));
    modal.show();

    document.getElementById('saveTimesheetEdit').onclick = async () => {
      const clock_in = document.getElementById('editClockIn').value;
      const clock_out = document.getElementById('editClockOut').value;
      const total_pay = document.getElementById('editPay').value;

      const updateRes = await apiRequest(`/system-admin/timesheets/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ clock_in, clock_out, total_pay })
      });

      if (updateRes.success) {
        showToast('Timesheet updated successfully', 'success');
        modal.hide();
        // Reload both the staff list and timesheets
        await loadTimesheetStaff();
        if (currentStaffCode) {
          await loadStaffTimesheets(currentStaffCode);
        }
      } else {
        showToast(updateRes.error || 'Update failed', 'error');
      }
    };
  } catch (err) {
    console.error('Edit modal error:', err);
    showToast('Error opening edit modal', 'error');
  }
}

// Global event delegation for edit buttons
document.addEventListener('click', e => {
  if (e.target.closest('.js-edit')) {
    const id = e.target.closest('.js-edit').dataset.id;
    openEditTimesheetModal(id);
  }
});

// Export functions to window for onclick handlers if needed
window.loadTimesheetStaff = loadTimesheetStaff;
window.loadStaffTimesheets = loadStaffTimesheets;
