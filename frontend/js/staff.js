// Staff Management Module
let staffData = [];
let venuesData = [];
let currentVenueFilter = 'all';
let currentStatusFilter = 'all';

// Helper function to get auth headers
function getAuthHeaders() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
    return {
        'Content-Type': 'application/json',
        'user_access_level': currentUser.access_level || 'system_admin',
        'user_business_code': currentUser.business_code || '',
        'user_venue_code': currentUser.venue_code || ''
    };
}

// Initialize staff module when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
    setupStaffEventListeners();
    loadVenues();
});

function setupStaffEventListeners() {
    // Add Staff Form Submission
    const addStaffForm = document.getElementById('addStaffForm');
    if (addStaffForm) {
        addStaffForm.addEventListener('submit', handleAddStaff);
    }

    // Edit Staff Form Submission
    const editStaffForm = document.getElementById('editStaffForm');
    if (editStaffForm) {
        editStaffForm.addEventListener('submit', handleEditStaff);
    }


    // Load venues when Add Staff modal is opened
    const addStaffModal = document.getElementById('addStaffModal');
    if (addStaffModal) {
        addStaffModal.addEventListener('show.bs.modal', function() {
            populateVenueDropdown();
        });
    }
}

// Load venues for the business
async function loadVenues() {
    try {
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const businessCode = currentUser.business_code;

        if (!businessCode) {
            console.error('Unable to determine business context');
            return;
        }

        const response = await fetch(`/api/system-admin/venues?business_code=${businessCode}`, {
            headers: getAuthHeaders()
        });
        const data = await response.json();

        if (data.success) {
            venuesData = data.data || [];
            console.log('Venues loaded:', venuesData.length);
        } else {
            console.error('Failed to load venues:', data.error);
        }
    } catch (error) {
        console.error('Error loading venues:', error);
    }
}

// Populate venue dropdown in Add Staff modal
function populateVenueDropdown() {
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

// Populate venue filter dropdown in staff list
function populateVenueFilter() {
    const venueFilter = document.getElementById('staffVenueFilter');
    if (!venueFilter) return;

    // Clear existing options except "All Venues"
    venueFilter.innerHTML = '<option value="all">All Venues</option>';

    // Add venue options
    venuesData.forEach(venue => {
        const option = document.createElement('option');
        option.value = venue.venue_code;
        option.textContent = venue.venue_name;
        venueFilter.appendChild(option);
    });
}

// Apply staff filters
function applyStaffFilters() {
    const venueFilter = document.getElementById('staffVenueFilter');
    const statusFilter = document.getElementById('staffStatusFilter');

    if (venueFilter) {
        currentVenueFilter = venueFilter.value;
    }
    if (statusFilter) {
        currentStatusFilter = statusFilter.value;
    }

    loadStaffList();
}


// Load staff list
async function loadStaffList() {
    try {
        // Get current user to determine business_code
        const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const businessCode = currentUser.business_code;

        if (!businessCode) {
            showStaffError('Unable to determine business context');
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

        const response = await fetch(`/api/system-admin/staff?${params.toString()}`, {
            headers: getAuthHeaders()
        });

        const data = await response.json();

        if (data.success) {
            staffData = data.data || [];
            renderStaffList(staffData);
            updateStaffCount(staffData.length);
        } else {
            showStaffError(data.error || 'Failed to load staff');
        }
    } catch (error) {
        console.error('Error loading staff:', error);
        showStaffError('Network error loading staff');
    }
}

// Render staff list table
function renderStaffList(staff) {
    const staffListContainer = document.getElementById('staffList');

    if (!staff || staff.length === 0) {
        staffListContainer.innerHTML = `
            <div class="text-center text-muted py-5">
                <i class="bi bi-people display-1 mb-3"></i>
                <h5>No staff members found</h5>
                <p>Click "Add Staff" to create your first team member</p>
            </div>
        `;
        return;
    }

    const tableHTML = `
        <table class="table table-hover">
            <thead class="table-light">
                <tr>
                    <th>Staff Code</th>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Venue</th>
                    <th>Employment Type</th>
                    <th>Status</th>
                    <th>Access Level</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${staff.map(member => `
                    <tr>
                        <td><code>${member.staff_code}</code></td>
                        <td>
                            <div class="d-flex align-items-center">
                                <div class="avatar-circle me-2">
                                    ${getInitials(member.first_name, member.last_name)}
                                </div>
                                <div>
                                    <div class="fw-semibold">${member.full_name}</div>
                                    <small class="text-muted">${member.phone_number || 'No phone'}</small>
                                </div>
                            </div>
                        </td>
                        <td>${member.email || '-'}</td>
                        <td>${member.role_title || '-'}</td>
                        <td>
                            <span class="badge bg-info">
                                ${member.venue_name || 'Unassigned'}
                            </span>
                        </td>
                        <td>
                            <span class="badge bg-secondary">
                                ${formatEmploymentType(member.employment_type)}
                            </span>
                        </td>
                        <td>
                            <span class="badge bg-${getStatusColor(member.employment_status)}">
                                ${member.employment_status}
                            </span>
                        </td>
                        <td>
                            <span class="badge bg-primary">
                                ${member.access_level || 'employee'}
                            </span>
                        </td>
                        <td>
                            <div class="btn-group btn-group-sm" role="group">
                                <button class="btn btn-outline-primary" onclick="viewStaff('${member.staff_code}')" title="View">
                                    <i class="bi bi-eye"></i>
                                </button>
                                <button class="btn btn-outline-success" onclick="editStaff('${member.staff_code}')" title="Edit">
                                    <i class="bi bi-pencil"></i>
                                </button>
                                <button class="btn btn-outline-danger" onclick="deleteStaff('${member.staff_code}', '${member.full_name}')" title="Delete">
                                    <i class="bi bi-trash"></i>
                                </button>
                            </div>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;

    staffListContainer.innerHTML = tableHTML;
}

// Get initials for avatar
function getInitials(firstName, lastName) {
    const first = firstName ? firstName.charAt(0).toUpperCase() : '';
    const last = lastName ? lastName.charAt(0).toUpperCase() : '';
    return first + last;
}

// Format employment type for display
function formatEmploymentType(type) {
    const types = {
        'full_time': 'Full Time',
        'part_time': 'Part Time',
        'casual': 'Casual',
        'contract': 'Contract'
    };
    return types[type] || type;
}

// Get status badge color
function getStatusColor(status) {
    const colors = {
        'active': 'success',
        'inactive': 'warning',
        'terminated': 'danger'
    };
    return colors[status] || 'secondary';
}

// Handle Add Staff Form Submission
async function handleAddStaff(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');

    // Get selected venue code
    const selectedVenueCode = formData.get('venue_code');
    if (!selectedVenueCode) {
        showErrorMessage('Please select a venue');
        return;
    }

    // Get staff code from form
    const staffCode = formData.get('staff_code').trim();
    if (!staffCode) {
        showErrorMessage('Please enter a staff code');
        return;
    }

    const staffData = {
        business_code: currentUser.business_code,
        venue_code: selectedVenueCode, // Use selected venue from dropdown
        staff_code: staffCode,
        first_name: formData.get('first_name'),
        middle_name: formData.get('middle_name') || null,
        last_name: formData.get('last_name'),
        email: formData.get('email'), // Email for login
        phone_number: formData.get('phone_number') || null,
        password: formData.get('password_hash'),
        access_level: formData.get('access_level'),
        role_title: formData.get('role_title') || null,
        employment_type: formData.get('employment_type') || 'full_time',
        start_date: formData.get('start_date') || null,
        weekday_rate: parseFloat(formData.get('weekday_rate')) || 0,
        saturday_rate: parseFloat(formData.get('saturday_rate')) || 0,
        sunday_rate: parseFloat(formData.get('sunday_rate')) || 0,
        public_holiday_rate: parseFloat(formData.get('public_holiday_rate')) || 0,
        overtime_rate: parseFloat(formData.get('overtime_rate')) || 0,
        default_hours: parseFloat(formData.get('default_hours')) || 38,
        // Banking Details (Compliance)
        account_holder_name: formData.get('account_holder_name') || null,
        bank_name: formData.get('bank_name') || null,
        bank_bsb: formData.get('bank_bsb') || null,
        bank_account_number: formData.get('bank_account_number') || null
    };

    try {
        const response = await fetch('/api/system-admin/staff', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(staffData)
        });

        const result = await response.json();

        if (result.success) {
            // Show success message
            showSuccessMessage(`Staff member added successfully! Kiosk PIN: ${result.user.kiosk_pin}`);

            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('addStaffModal'));
            modal.hide();

            // Reset form
            e.target.reset();

            // Reload staff list
            loadStaffList();
        } else {
            showErrorMessage(result.error || 'Failed to add staff member');
        }
    } catch (error) {
        console.error('Error adding staff:', error);
        showErrorMessage('Network error adding staff member');
    }
}


// View staff details
function viewStaff(staffCode) {
    const staff = staffData.find(s => s.staff_code === staffCode);
    if (!staff) return;

    // Create and show view modal
    const modalHTML = `
        <div class="modal fade" id="viewStaffModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Staff Details</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row g-3">
                            <div class="col-12 text-center mb-3">
                                <div class="avatar-circle-lg mx-auto mb-2">
                                    ${getInitials(staff.first_name, staff.last_name)}
                                </div>
                                <h4>${staff.full_name}</h4>
                                <p class="text-muted">${staff.role_title || 'No role assigned'}</p>
                            </div>
                            <div class="col-md-6">
                                <strong>Staff Code:</strong><br>
                                <code>${staff.staff_code}</code>
                            </div>
                            <div class="col-md-6">
                                <strong>Email:</strong><br>
                                ${staff.email || '-'}
                            </div>
                            <div class="col-md-6">
                                <strong>Phone:</strong><br>
                                ${staff.phone_number || '-'}
                            </div>
                            <div class="col-md-6">
                                <strong>Venue:</strong><br>
                                ${staff.venue_name || 'Unassigned'}
                            </div>
                            <div class="col-md-6">
                                <strong>Employment Type:</strong><br>
                                ${formatEmploymentType(staff.employment_type)}
                            </div>
                            <div class="col-md-6">
                                <strong>Status:</strong><br>
                                <span class="badge bg-${getStatusColor(staff.employment_status)}">
                                    ${staff.employment_status}
                                </span>
                            </div>
                            <div class="col-md-6">
                                <strong>Access Level:</strong><br>
                                ${staff.access_level || 'employee'}
                            </div>
                            <div class="col-md-6">
                                <strong>Start Date:</strong><br>
                                ${staff.start_date ? new Date(staff.start_date).toLocaleDateString() : '-'}
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        <button type="button" class="btn btn-primary" onclick="editStaff('${staff.staff_code}')" data-bs-dismiss="modal">
                            <i class="bi bi-pencil me-1"></i>Edit
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Remove existing modal if present
    const existingModal = document.getElementById('viewStaffModal');
    if (existingModal) existingModal.remove();

    // Add modal to DOM and show
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    const modal = new bootstrap.Modal(document.getElementById('viewStaffModal'));
    modal.show();
}

// Edit staff - fetch full details first
async function editStaff(staffCode) {
    try {
        // Fetch full staff details including pay rates
        const response = await fetch(`/api/system-admin/staff/${staffCode}`, {
            headers: getAuthHeaders()
        });
        const result = await response.json();

        if (!result.success) {
            showErrorMessage(result.error || 'Failed to load staff details');
            return;
        }

        const staff = result.data;

        // Populate edit form - Personal Information
        document.getElementById('editStaffId').value = staff.staff_code;
        document.getElementById('editFirstName').value = staff.first_name || '';
        document.getElementById('editMiddleName').value = staff.middle_name || '';
        document.getElementById('editLastName').value = staff.last_name || '';
        document.getElementById('editPhoneNumber').value = staff.phone_number || '';

        // Employment Information
        document.getElementById('editRoleTitle').value = staff.role_title || '';
        document.getElementById('editEmploymentType').value = staff.employment_type || 'full_time';
        document.getElementById('editStartDate').value = staff.start_date || '';
        document.getElementById('editAccessLevel').value = staff.access_level || 'employee';
        document.getElementById('editEmploymentStatus').value = staff.employment_status || 'active';

        // Login & Security
        document.getElementById('editEmail').value = staff.email || '';
        document.getElementById('editKioskPin').value = staff.kiosk_pin || '';
        document.getElementById('editPassword').value = ''; // Always empty for security

        // Pay Settings
        document.getElementById('editDefaultHours').value = staff.default_hours || 38;

        // Banking Details
        document.getElementById('editAccountHolderName').value = staff.account_holder_name || '';
        document.getElementById('editBankName').value = staff.bank_name || '';
        document.getElementById('editBankBSB').value = staff.bank_bsb || '';
        document.getElementById('editBankAccountNumber').value = staff.bank_account_number || '';

        // Pay Rates
        document.getElementById('editWeekdayRate').value = staff.weekday_rate || 0;
        document.getElementById('editSaturdayRate').value = staff.saturday_rate || 0;
        document.getElementById('editSundayRate').value = staff.sunday_rate || 0;
        document.getElementById('editPublicHolidayRate').value = staff.public_holiday_rate || 0;
        document.getElementById('editOvertimeRate').value = staff.overtime_rate || 0;

        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('editStaffModal'));
        modal.show();
    } catch (error) {
        console.error('Error loading staff details:', error);
        showErrorMessage('Network error loading staff details');
    }
}

// Handle Edit Staff Form Submission
async function handleEditStaff(e) {
    e.preventDefault();

    const formData = new FormData(e.target);
    const staffCode = formData.get('staff_id');

    const updateData = {
        first_name: formData.get('first_name'),
        middle_name: formData.get('middle_name') || null,
        last_name: formData.get('last_name'),
        phone_number: formData.get('phone_number') || null,
        role_title: formData.get('role_title') || null,
        employment_type: formData.get('employment_type'),
        start_date: formData.get('start_date') || null,
        access_level: formData.get('access_level'),
        employment_status: formData.get('employment_status'),
        email: formData.get('email'),
        default_hours: parseFloat(formData.get('default_hours')) || 38,
        weekday_rate: parseFloat(formData.get('weekday_rate')) || 0,
        saturday_rate: parseFloat(formData.get('saturday_rate')) || 0,
        sunday_rate: parseFloat(formData.get('sunday_rate')) || 0,
        public_holiday_rate: parseFloat(formData.get('public_holiday_rate')) || 0,
        overtime_rate: parseFloat(formData.get('overtime_rate')) || 0,
        // Banking Details
        account_holder_name: formData.get('account_holder_name') || null,
        bank_name: formData.get('bank_name') || null,
        bank_bsb: formData.get('bank_bsb') || null,
        bank_account_number: formData.get('bank_account_number') || null
    };

    // Only include password if provided
    const password = formData.get('password_hash');
    if (password) {
        updateData.password = password;
    }

    // Only include kiosk PIN if provided
    const kioskPin = formData.get('kiosk_pin');
    if (kioskPin) {
        updateData.kiosk_pin = kioskPin;
    }

    try {
        const response = await fetch(`/api/system-admin/staff/${staffCode}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(updateData)
        });

        const result = await response.json();

        if (result.success) {
            showSuccessMessage('Staff member updated successfully!');

            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('editStaffModal'));
            modal.hide();

            // Reload staff list
            loadStaffList();
        } else {
            showErrorMessage(result.error || 'Failed to update staff member');
        }
    } catch (error) {
        console.error('Error updating staff:', error);
        showErrorMessage('Network error updating staff member');
    }
}

// Delete staff
async function deleteStaff(staffCode, staffName) {
    if (!confirm(`Are you sure you want to delete ${staffName}?\n\nThis action cannot be undone.`)) {
        return;
    }

    try {
        const response = await fetch(`/api/system-admin/staff/${staffCode}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });

        const result = await response.json();

        if (result.success) {
            showSuccessMessage('Staff member deleted successfully');
            loadStaffList();
        } else {
            showErrorMessage(result.error || 'Failed to delete staff member');
        }
    } catch (error) {
        console.error('Error deleting staff:', error);
        showErrorMessage('Network error deleting staff member');
    }
}

// Update staff count in dashboard
function updateStaffCount(count) {
    const totalStaffElement = document.getElementById('totalStaff');
    if (totalStaffElement) {
        totalStaffElement.textContent = count;
    }
}

// Show error in staff list
function showStaffError(message) {
    const staffListContainer = document.getElementById('staffList');
    staffListContainer.innerHTML = `
        <div class="alert alert-danger">
            <i class="bi bi-exclamation-triangle me-2"></i>
            ${message}
        </div>
    `;
}

// Show success message
function showSuccessMessage(message) {
    // Create toast notification
    const toastHTML = `
        <div class="toast-container position-fixed top-0 end-0 p-3">
            <div class="toast show" role="alert">
                <div class="toast-header bg-success text-white">
                    <i class="bi bi-check-circle me-2"></i>
                    <strong class="me-auto">Success</strong>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
                </div>
                <div class="toast-body">
                    ${message}
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', toastHTML);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        const toast = document.querySelector('.toast-container');
        if (toast) toast.remove();
    }, 5000);
}

// Show error message
function showErrorMessage(message) {
    // Create toast notification
    const toastHTML = `
        <div class="toast-container position-fixed top-0 end-0 p-3">
            <div class="toast show" role="alert">
                <div class="toast-header bg-danger text-white">
                    <i class="bi bi-exclamation-triangle me-2"></i>
                    <strong class="me-auto">Error</strong>
                    <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
                </div>
                <div class="toast-body">
                    ${message}
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', toastHTML);

    // Auto-remove after 5 seconds
    setTimeout(() => {
        const toast = document.querySelector('.toast-container');
        if (toast) toast.remove();
    }, 5000);
}
