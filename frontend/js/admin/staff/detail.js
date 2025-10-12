/**
 * Staff Detail Module
 * Handles viewing and editing individual staff member details
 */

import { api } from '../../utils/api.js';
import { showToast, Loading } from '../../utils/ui.js';

/**
 * View staff member details
 * @param {string} staffCode - Staff code to view
 */
export async function viewStaff(staffCode) {
    try {
        Loading.show('Loading staff details...');

        const result = await api.get(`/system-admin/staff/${staffCode}`);

        if (result.success && result.data) {
            displayStaffDetails(result.data);
        } else {
            showToast(result.error || 'Failed to load staff details', 'error');
        }
    } catch (error) {
        console.error('Error loading staff details:', error);
        showToast('Error loading staff details: ' + error.message, 'error');
    } finally {
        Loading.hide();
    }
}

/**
 * Display staff details in modal or panel
 * @param {Object} staff - Staff member data
 */
function displayStaffDetails(staff) {
    // TODO: Implement full staff detail view
    console.log('Staff details:', staff);
    showToast('Staff detail view not yet fully implemented', 'info');
}

/**
 * Edit staff member (opens edit modal with data)
 * @param {string} staffCode - Staff code to edit
 */
export async function editStaff(staffCode) {
    try {
        Loading.show('Loading staff for editing...');

        const result = await api.get(`/system-admin/staff/${staffCode}`);

        if (result.success && result.data) {
            populateEditForm(result.data);
        } else {
            showToast(result.error || 'Failed to load staff details', 'error');
        }
    } catch (error) {
        console.error('Error loading staff for edit:', error);
        showToast('Error loading staff: ' + error.message, 'error');
    } finally {
        Loading.hide();
    }
}

/**
 * Populate edit form with staff data
 * @param {Object} staff - Staff member data
 */
function populateEditForm(staff) {
    // TODO: Implement full edit form population
    console.log('Populating edit form for:', staff);
    showToast('Edit form population not yet fully implemented', 'info');

    // Open edit modal
    const editModal = document.getElementById('editStaffModal');
    if (editModal) {
        const modal = new bootstrap.Modal(editModal);
        modal.show();
    }
}

// Export to window for onclick handlers (temporary)
window.viewStaff = viewStaff;
window.editStaff = editStaff;
