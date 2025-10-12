/**
 * Staff Form Module
 * Handles add and edit staff form operations with validation
 */

import { api } from '../../utils/api.js';
import { Storage } from '../../utils/storage.js';
import { showToast, Loading, showFieldError, clearFieldErrors, debounce } from '../../utils/ui.js';
import { Validator } from '../../utils/validator.js';
import { confirmAction } from '../../utils/dialog.js';
import { loadStaffList } from './list.js';

// Module state
let formIsDirty = false;

/**
 * Validate staff form fields
 * @param {HTMLFormElement} form - Form element to validate
 * @param {boolean} isEdit - True if editing (skip password requirement)
 * @returns {Object} Validation errors (empty if valid)
 */
function validateStaffForm(form, isEdit = false) {
    const fields = {
        staff_code: [
            { check: v => Validator.required(v), message: 'Staff code is required' },
            { check: v => Validator.isStaffCode(v), message: 'Invalid staff code (3-25 alphanumeric)' }
        ],
        first_name: [
            { check: v => Validator.required(v), message: 'First name is required' },
            { check: v => Validator.minLength(v, 2), message: 'First name too short' }
        ],
        last_name: [
            { check: v => Validator.required(v), message: 'Last name is required' },
            { check: v => Validator.minLength(v, 2), message: 'Last name too short' }
        ],
        email: [
            { check: v => Validator.required(v), message: 'Email is required' },
            { check: v => Validator.isEmail(v), message: 'Invalid email format' }
        ],
        weekday_rate: [
            { check: v => Validator.required(v), message: 'Weekday rate is required' },
            { check: v => Validator.isPositiveNumber(v), message: 'Weekday rate must be positive' }
        ],
        saturday_rate: [
            { check: v => Validator.required(v), message: 'Saturday rate is required' },
            { check: v => Validator.isPositiveNumber(v), message: 'Saturday rate must be positive' }
        ],
        sunday_rate: [
            { check: v => Validator.required(v), message: 'Sunday rate is required' },
            { check: v => Validator.isPositiveNumber(v), message: 'Sunday rate must be positive' }
        ],
        public_holiday_rate: [
            { check: v => Validator.required(v), message: 'Holiday rate is required' },
            { check: v => Validator.isPositiveNumber(v), message: 'Holiday rate must be positive' }
        ],
        overtime_rate: [
            { check: v => Validator.required(v), message: 'Overtime rate is required' },
            { check: v => Validator.isPositiveNumber(v), message: 'Overtime rate must be positive' }
        ],
        account_holder_name: [
            { check: v => Validator.required(v), message: 'Account holder name is required' }
        ],
        bank_name: [
            { check: v => Validator.required(v), message: 'Bank name is required' }
        ],
        bank_bsb: [
            { check: v => Validator.required(v), message: 'BSB is required' },
            { check: v => Validator.isBSB(v), message: 'Invalid BSB format (XXX-XXX)' }
        ],
        bank_account_number: [
            { check: v => Validator.required(v), message: 'Account number is required' }
        ]
    };

    // Password only required for new staff
    if (!isEdit) {
        fields.password_hash = [
            { check: v => Validator.required(v), message: 'Password is required' },
            { check: v => Validator.minLength(v, 6), message: 'Password must be at least 6 characters' }
        ];
    }

    return Validator.validateForm(fields);
}

/**
 * Setup dirty form detection
 * @param {HTMLFormElement} form - Form element
 */
function setupDirtyFormDetection(form) {
    if (!form) return;

    form.addEventListener('input', () => {
        formIsDirty = true;
    });

    window.addEventListener('beforeunload', (e) => {
        if (formIsDirty) {
            e.preventDefault();
            e.returnValue = 'You have unsaved changes';
        }
    });
}

/**
 * Handle Add Staff Form Submission
 * @param {Event} e - Form submit event
 */
export async function handleAddStaff(e) {
    e.preventDefault();

    const form = e.target;
    clearFieldErrors(form);

    // Validate form
    const errors = validateStaffForm(form, false);
    if (Object.keys(errors).length > 0) {
        console.error('❌ Validation errors:', errors);
        for (const [fieldId, message] of Object.entries(errors)) {
            showFieldError(fieldId, message);
        }
        showToast('Please fix validation errors', 'error');
        return;
    }
    console.log('✅ Form validation passed');

    const formData = new FormData(form);
    const businessCode = Storage.getUserBusinessCode();

    // Validate venue selection
    const selectedVenueCode = formData.get('venue_code');
    if (!selectedVenueCode) {
        showFieldError('venueSelect', 'Please select a venue');
        showToast('Please select a venue', 'error');
        return;
    }

    // Build staff data object
    const staffData = {
        business_code: businessCode,
        venue_code: selectedVenueCode,
        staff_code: formData.get('staff_code').trim(),
        first_name: formData.get('first_name'),
        middle_name: formData.get('middle_name') || null,
        last_name: formData.get('last_name'),
        email: formData.get('email'),
        phone_number: formData.get('phone_number') || null,
        password: formData.get('password_hash'),
        access_level: formData.get('access_level'),
        role_title: formData.get('role_title') || null,
        employment_type: formData.get('employment_type') || 'full_time',
        start_date: formData.get('start_date') || null,
        weekday_rate: parseFloat(formData.get('weekday_rate')),
        saturday_rate: parseFloat(formData.get('saturday_rate')),
        sunday_rate: parseFloat(formData.get('sunday_rate')),
        public_holiday_rate: parseFloat(formData.get('public_holiday_rate')),
        overtime_rate: parseFloat(formData.get('overtime_rate')),
        default_hours: parseFloat(formData.get('default_hours')) || 38,
        // Banking Details
        account_holder_name: formData.get('account_holder_name'),
        bank_name: formData.get('bank_name'),
        bank_bsb: formData.get('bank_bsb'),
        bank_account_number: formData.get('bank_account_number')
    };

    try {
        Loading.show('Adding staff member...');

        const result = await api.post('/system-admin/staff', staffData);

        if (result.success) {
            showToast(`Staff member added successfully! Kiosk PIN: ${result.user?.kiosk_pin || 'N/A'}`, 'success', 5000);

            // Reset dirty flag
            formIsDirty = false;

            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('addStaffModal'));
            if (modal) modal.hide();

            // Reset form
            form.reset();

            // Reload staff list
            await loadStaffList();
        } else {
            showToast(result.error || 'Failed to add staff member', 'error');
        }
    } catch (error) {
        console.error('Error adding staff:', error);
        showToast('Error adding staff: ' + error.message, 'error');
    } finally {
        Loading.hide();
    }
}

/**
 * Handle Edit Staff Form Submission
 * @param {Event} e - Form submit event
 */
export async function handleEditStaff(e) {
    e.preventDefault();

    const form = e.target;
    clearFieldErrors(form);

    // Validate form (edit mode - password optional)
    const errors = validateStaffForm(form, true);
    if (Object.keys(errors).length > 0) {
        for (const [fieldId, message] of Object.entries(errors)) {
            showFieldError(fieldId, message);
        }
        showToast('Please fix validation errors', 'error');
        return;
    }

    const formData = new FormData(form);
    const staffCode = formData.get('staff_code')?.trim();

    if (!staffCode) {
        showToast('Staff code is missing', 'error');
        return;
    }

    // Build update payload
    const payload = {
        first_name: formData.get('first_name'),
        middle_name: formData.get('middle_name') || null,
        last_name: formData.get('last_name'),
        email: formData.get('email'),
        phone_number: formData.get('phone_number') || null,
        access_level: formData.get('access_level'),
        role_title: formData.get('role_title') || null,
        employment_type: formData.get('employment_type'),
        employment_status: formData.get('employment_status'),
        start_date: formData.get('start_date') || null,
        dob: formData.get('dob') || null,
        gender: formData.get('gender') || null,
        full_address: formData.get('full_address') || null,
        emergency_contact_name: formData.get('emergency_contact_name') || null,
        emergency_contact_phone: formData.get('emergency_contact_phone') || null,
        default_hours: parseFloat(formData.get('default_hours')) || null,
        kiosk_pin: formData.get('kiosk_pin') || null,
        // Pay rates
        weekday_rate: parseFloat(formData.get('weekday_rate')),
        saturday_rate: parseFloat(formData.get('saturday_rate')),
        sunday_rate: parseFloat(formData.get('sunday_rate')),
        public_holiday_rate: parseFloat(formData.get('public_holiday_rate')),
        overtime_rate: parseFloat(formData.get('overtime_rate')),
        // Banking
        account_holder_name: formData.get('account_holder_name'),
        bank_name: formData.get('bank_name'),
        bank_bsb: formData.get('bank_bsb'),
        bank_account_number: formData.get('bank_account_number')
    };

    // Include password only if provided
    const password = formData.get('password_hash');
    if (password && password.trim()) {
        payload.password = password;
    }

    try {
        Loading.show('Updating staff member...');

        const result = await api.put(`/system-admin/staff/${encodeURIComponent(staffCode)}`, payload);

        if (result.success) {
            showToast('Staff member updated successfully', 'success');

            // Reset dirty flag
            formIsDirty = false;

            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('editStaffModal'));
            if (modal) modal.hide();

            // Reload staff list
            await loadStaffList();
        } else {
            showToast(result.error || 'Failed to update staff member', 'error');
        }
    } catch (error) {
        console.error('Error updating staff:', error);
        showToast('Error updating staff: ' + error.message, 'error');
    } finally {
        Loading.hide();
    }
}

/**
 * Delete staff member with confirmation
 * @param {string} staffCode - Staff code to delete
 * @param {string} fullName - Staff full name for confirmation
 */
export async function deleteStaff(staffCode, fullName) {
    const confirmed = await confirmAction(
        `Are you sure you want to delete <strong>${fullName}</strong>? This action cannot be undone.`,
        'Confirm Deletion'
    );

    if (!confirmed) {
        return;
    }

    try {
        Loading.show('Deleting staff member...');

        const result = await api.delete(`/system-admin/staff/${staffCode}`);

        if (result.success) {
            showToast(`Staff member ${fullName} deleted successfully`, 'success');
            await loadStaffList();
        } else {
            showToast(result.error || 'Failed to delete staff member', 'error');
        }
    } catch (error) {
        console.error('Error deleting staff:', error);
        showToast('Error deleting staff: ' + error.message, 'error');
    } finally {
        Loading.hide();
    }
}

/**
 * Initialize form module
 */
export function initForms() {
    // Setup dirty form detection for both forms
    const addForm = document.getElementById('addStaffForm');
    const editForm = document.getElementById('editStaffForm');

    if (addForm) setupDirtyFormDetection(addForm);
    if (editForm) setupDirtyFormDetection(editForm);
}

// Export delete function to window for onclick handlers (temporary until full refactor)
window.deleteStaff = deleteStaff;
