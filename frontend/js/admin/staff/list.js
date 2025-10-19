/**
 * Staff List Module
 * Handles fetching and displaying venues and staff lists
 */

import { apiRequest } from '../../utils/api.js';
import { Storage } from '../../utils/storage.js';
import { showToast, debounce } from '../../utils/ui.js';

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

        // Check if businessCode is valid (not null, undefined, or "null" string)
        if (!businessCode || businessCode === 'null') {
            console.error('Unable to determine business context - business_code is missing or invalid:', businessCode);
            showToast('Unable to determine business context. Please contact your administrator.', 'error');
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

    const tableContent = staffListContainer.querySelector('.table-content');
    if (!tableContent) return;

    try {
        // Show loading state
        tableContent.innerHTML = `
            <div class="text-center py-5">
                <i class="fas fa-spinner fa-spin fa-2x text-primary mb-3"></i>
                <p class="text-muted">Loading staff...</p>
            </div>
        `;

        const businessCode = Storage.getUserBusinessCode();
        if (!businessCode) {
            tableContent.innerHTML = `
                <div class="text-center text-danger py-5">
                    <i class="fas fa-exclamation-circle fa-2x mb-3"></i>
                    <h5>Unable to determine business context</h5>
                </div>
            `;
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

        console.log('📊 Staff API Response:', response);
        console.log('📊 Response success:', response.success);
        console.log('📊 Response data:', response.data);

        if (response.success) {
            // Handle paginated response format: { rows: [...], pagination: {...} }
            staffData = response.data?.rows || response.data || [];
            const pagination = response.data?.pagination;

            console.log('📊 Staff data loaded:', staffData.length, 'staff members');
            console.log('📊 Pagination:', pagination);
            console.log('📊 First staff member sample:', staffData[0]);

            renderStaffList(staffData);
            updateStaffCount(pagination?.total || staffData.length);
        } else {
            tableContent.innerHTML = `
                <div class="text-center text-danger py-5">
                    <i class="fas fa-exclamation-circle fa-2x mb-3"></i>
                    <h5>Failed to load staff</h5>
                    <p>${response.error || 'Unknown error occurred'}</p>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error loading staff:', error);
        tableContent.innerHTML = `
            <div class="text-center text-danger py-5">
                <i class="fas fa-exclamation-circle fa-2x mb-3"></i>
                <h5>Failed to load staff</h5>
                <p>${error.message || 'Network error occurred'}</p>
            </div>
        `;
    }
}

/**
 * Render staff list table
 * @param {Array} staff - Array of staff objects
 */
function renderStaffList(staff) {
    console.log('🎨 renderStaffList called with', staff.length, 'staff members');

    const container = document.getElementById('staffList');
    if (!container) {
        console.error('❌ #staffList container not found');
        return;
    }

    // Get the table-content div inside staffList
    const tableContent = container.querySelector('.table-content');
    if (!tableContent) {
        console.error('❌ .table-content not found inside #staffList');
        return;
    }

    console.log('✅ Found container and tableContent elements');

    if (staff.length === 0) {
        console.log('ℹ️ No staff to display, showing empty state');

        tableContent.innerHTML = `
            <div class="text-center text-muted py-5">
                <i class="fas fa-users display-1 mb-3"></i>
                <h5>No staff found</h5>
                <p>Try adjusting your filters or add new staff members</p>
            </div>
        `;
        return;
    }

    let html = `
        <table class="data-grid">
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

        const fullName = `${s.first_name || ''} ${s.middle_name ? s.middle_name + ' ' : ''}${s.last_name || ''}`.trim();

        html += `
            <tr>
                <td><strong>${s.staff_code}</strong></td>
                <td>${fullName || s.full_name || '-'}</td>
                <td>${s.venue_name || '-'}</td>
                <td>${s.role_title || '-'}</td>
                <td>${formatEmploymentType(s.employment_type)}</td>
                <td>${statusBadge}</td>
                <td><span class="badge bg-info">${formatAccessLevel(s.access_level)}</span></td>
                <td>
                    <button class="btn btn-sm btn-primary" onclick="window.editStaff('${s.staff_code}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="window.deleteStaff('${s.staff_code}', '${(fullName || s.full_name || '').replace(/'/g, "\\'")}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    html += '</tbody></table>';

    console.log('✅ Rendering table with', staff.length, 'rows');
    console.log('📝 HTML length:', html.length, 'characters');
    tableContent.innerHTML = html;
    console.log('✅ Table rendered successfully');
}

/**
 * Format employment type for display
 */
function formatEmploymentType(type) {
    const map = {
        'full_time': 'Full Time',
        'part_time': 'Part Time',
        'casual': 'Casual',
        'contract': 'Contract'
    };
    return map[type] || type || '-';
}

/**
 * Format access level for display
 */
function formatAccessLevel(level) {
    const map = {
        'system_admin': 'System Admin',
        'manager': 'Manager',
        'supervisor': 'Supervisor',
        'employee': 'Employee'
    };
    return map[level] || level || '-';
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

/**
 * Filter staff list by search term (client-side)
 * @param {string} searchTerm - Search term to filter by
 */
export function filterStaffList(searchTerm) {
    const rows = document.querySelectorAll('#staffList tbody tr');
    const term = searchTerm.toLowerCase();

    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(term) ? '' : 'none';
    });
}

/**
 * Setup staff search with debounce
 */
export function setupStaffSearch() {
    const staffSearchInput = document.getElementById('staffSearchInput');
    if (staffSearchInput) {
        const debouncedFilter = debounce((value) => {
            filterStaffList(value);
        }, 300);

        staffSearchInput.addEventListener('input', (e) => {
            debouncedFilter(e.target.value);
        });
    }
}
