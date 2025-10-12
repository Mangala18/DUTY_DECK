/**
 * Staff List Module
 * Handles fetching and displaying venues and staff lists
 */

import { apiRequest } from '../../utils/api.js';
import { Storage } from '../../utils/storage.js';
import { showLoading, renderError, showEmptyState, showToast } from '../../utils/ui.js';

// Module state
let staffData = [];
let venuesData = [];
let currentVenueFilter = 'all';
let currentStatusFilter = 'all';

/**
 * Load venues for the business
 * @returns {Promise<Array>} Array of venues
 */
export async function loadVenues() {
    try {
        const businessCode = Storage.getUserBusinessCode();

        if (!businessCode) {
            console.error('Unable to determine business context');
            showToast('Unable to determine business context', 'error');
            return [];
        }

        const response = await apiRequest(`/system-admin/staff/venues?business_code=${businessCode}`);

        if (response.success) {
            venuesData = response.data || [];
            console.log('Venues loaded:', venuesData.length);
            return venuesData;
        } else {
            console.error('Failed to load venues:', response.error);
            return [];
        }
    } catch (error) {
        console.error('Error loading venues:', error);
        showToast('Failed to load venues: ' + error.message, 'error');
        return [];
    }
}

/**
 * Populate venue dropdown in Add Staff modal
 */
export function populateVenueDropdown() {
    const venueSelect = document.getElementById('venueSelect');
    if (!venueSelect) return;

    // Clear existing options except the first one
    venueSelect.innerHTML = '<option value="">Select Venue</option>';

    // Add venue options
    venuesData.forEach(venue => {
        const option = document.createElement('option');
        option.value = venue.venue_code;
        option.textContent = `${venue.venue_name}${venue.venue_address ? ' - ' + venue.venue_address : ''}`;
        venueSelect.appendChild(option);
    });

    // If only one venue, auto-select it
    if (venuesData.length === 1) {
        venueSelect.value = venuesData[0].venue_code;
    }

    // Also populate the filter dropdown
    populateVenueFilter();
}

/**
 * Populate venue filter dropdown in staff list
 */
export function populateVenueFilter() {
    const filterSelect = document.getElementById('staffVenueFilter');
    if (!filterSelect) return;

    // Clear and add "All Venues" option
    filterSelect.innerHTML = '<option value="all">All Venues</option>';

    // Add venue options
    venuesData.forEach(venue => {
        const option = document.createElement('option');
        option.value = venue.venue_code;
        option.textContent = venue.venue_name;
        filterSelect.appendChild(option);
    });
}

/**
 * Load staff list with filters
 * @returns {Promise<void>}
 */
export async function loadStaffList() {
    const staffListContainer = document.getElementById('staffList');
    if (!staffListContainer) return;

    try {
        showLoading('staffList', 'Loading staff...');

        const businessCode = Storage.getUserBusinessCode();
        if (!businessCode) {
            renderError('staffList', 'Unable to determine business context');
            return;
        }

        // Build query parameters
        const params = new URLSearchParams();
        if (currentVenueFilter && currentVenueFilter !== 'all') {
            params.append('venue_code', currentVenueFilter);
        }
        if (currentStatusFilter && currentStatusFilter !== 'all') {
            params.append('status', currentStatusFilter);
        }

        const response = await apiRequest(`/system-admin/staff?${params.toString()}`);

        if (response.success) {
            staffData = response.data || [];
            renderStaffList(staffData);
            updateStaffCount(staffData.length);
        } else {
            renderError('staffList', response.error || 'Failed to fetch staff');
        }
    } catch (error) {
        console.error('Error loading staff:', error);
        renderError('staffList', 'Failed to load staff: ' + error.message);
    }
}

/**
 * Render staff list table
 * @param {Array} staff - Array of staff objects
 */
function renderStaffList(staff) {
    const container = document.getElementById('staffList');
    if (!container) return;

    if (staff.length === 0) {
        showEmptyState('staffList', 'No staff found', 'bi-people');
        return;
    }

    let html = `
        <table class="table table-hover">
            <thead>
                <tr>
                    <th>Staff Code</th>
                    <th>Name</th>
                    <th>Venue</th>
                    <th>Role</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Access Level</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;

    staff.forEach(s => {
        const statusBadge = s.employment_status === 'active'
            ? '<span class="badge bg-success">Active</span>'
            : '<span class="badge bg-secondary">Inactive</span>';

        html += `
            <tr>
                <td>${s.staff_code}</td>
                <td>${s.full_name || ''}</td>
                <td>${s.venue_name || ''}</td>
                <td>${s.role_title || '-'}</td>
                <td>${s.employment_type || '-'}</td>
                <td>${statusBadge}</td>
                <td><span class="badge bg-info">${s.access_level || '-'}</span></td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="editStaff('${s.staff_code}')">
                        <i class="bi bi-pencil"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteStaff('${s.staff_code}', '${s.full_name}')">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

/**
 * Update staff count display
 * @param {number} count - Number of staff
 */
function updateStaffCount(count) {
    const countEl = document.getElementById('staffCount');
    if (countEl) {
        countEl.textContent = count;
    }
}

/**
 * Apply filters and reload staff list
 */
export function applyStaffFilters() {
    const venueFilter = document.getElementById('staffVenueFilter');
    const statusFilter = document.getElementById('staffStatusFilter');

    if (venueFilter) currentVenueFilter = venueFilter.value;
    if (statusFilter) currentStatusFilter = statusFilter.value;

    loadStaffList();
}

/**
 * Get current staff data
 * @returns {Array} Current staff data
 */
export function getStaffData() {
    return staffData;
}

/**
 * Get current venues data
 * @returns {Array} Current venues data
 */
export function getVenuesData() {
    return venuesData;
}
