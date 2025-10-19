/**
 * Venue Management Module
 * Handles venue listing, creation, editing, and deletion
 */

import { apiRequest } from '../utils/api.js';
import { Storage } from '../utils/storage.js';
import { showToast, debounce } from '../utils/ui.js';

/**
 * Load and display all venues for the current business
 */
export async function loadVenues() {
  const businessCode = Storage.getUserBusinessCode();
  const venueList = document.querySelector('#venueList .table-content');

  if (!venueList) {
    console.warn('Venue list container not found');
    return;
  }

  // Check if businessCode is valid (not null, undefined, or "null" string)
  if (!businessCode || businessCode === 'null') {
    venueList.innerHTML = `
      <div class="alert alert-danger m-4" role="alert">
        <i class="fas fa-exclamation-triangle me-2"></i>
        <strong>Error:</strong> Unable to determine business context. Please contact your administrator.
      </div>`;
    showToast('Unable to determine business context', 'error');
    return;
  }

  // Show loading state
  venueList.innerHTML = `
    <div class="text-center py-5">
      <div class="spinner-border text-primary" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="text-muted mt-3">Loading venues...</p>
    </div>`;

  try {
    console.log('Loading venues for business:', businessCode);

    const response = await apiRequest(`/system-admin/staff/venues?business_code=${businessCode}`);

    console.log('Venues response:', response);

    if (response.success && response.data && response.data.length > 0) {
      renderVenues(response.data);
      showToast(`Loaded ${response.data.length} venue(s)`, 'success');
    } else {
      venueList.innerHTML = `
        <div class="text-center text-muted py-5">
          <i class="fas fa-building display-1 mb-3"></i>
          <h5>No venues found</h5>
          <p>Click "Add Venue" above to create your first venue.</p>
        </div>`;
    }
  } catch (error) {
    console.error('Error loading venues:', error);
    showToast('Failed to load venues: ' + error.message, 'error');
    venueList.innerHTML = `
      <div class="alert alert-danger m-4" role="alert">
        <i class="fas fa-exclamation-triangle me-2"></i>
        <strong>Error loading venues:</strong> ${error.message}
      </div>`;
  }
}

/**
 * Render venues in a table
 * @param {Array} venues - Array of venue objects
 */
function renderVenues(venues) {
  const venueList = document.querySelector('#venueList .table-content');

  let html = `
    <div class="table-responsive">
      <table class="table table-hover">
        <thead>
          <tr>
            <th>Venue Code</th>
            <th>Name</th>
            <th>Address</th>
            <th>State</th>
            <th>Contact Email</th>
            <th>Timezone</th>
            <th>Week Start</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
  `;

  venues.forEach(v => {
    const statusBadge = v.status === 'active'
      ? '<span class="badge bg-success">Active</span>'
      : '<span class="badge bg-secondary">Inactive</span>';

    const address = v.venue_address || v.address || '-';
    const state = v.state || '-';
    const contactEmail = v.contact_email || '-';
    const timezone = v.timezone ? v.timezone.replace('Australia/', '') : '-';
    const weekStart = v.week_start || 'Mon';

    html += `
      <tr>
        <td><strong>${v.venue_code}</strong></td>
        <td>${v.venue_name}</td>
        <td>${address}</td>
        <td>${state}</td>
        <td><small>${contactEmail}</small></td>
        <td><small>${timezone}</small></td>
        <td><small>${weekStart}</small></td>
        <td>${statusBadge}</td>
        <td>
          <div class="btn-group btn-group-sm" role="group">
            <button class="btn btn-outline-primary" onclick="window.editVenue('${v.venue_code}')" title="Edit Venue">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-outline-danger" onclick="window.deleteVenue('${v.venue_code}', '${v.venue_name.replace(/'/g, "\\'")}')" title="Delete Venue">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </td>
      </tr>`;
  });

  html += `
        </tbody>
      </table>
    </div>`;

  venueList.innerHTML = html;
}

/**
 * Edit venue - populate modal with venue data
 * @param {string} venueCode - Venue code to edit
 */
export async function editVenue(venueCode) {
  try {
    console.log('Editing venue:', venueCode);

    const businessCode = Storage.getUserBusinessCode();

    // Check if businessCode is valid
    if (!businessCode || businessCode === 'null') {
      throw new Error('Unable to determine business context');
    }

    // Get venue details
    const response = await apiRequest(`/system-admin/staff/venues?business_code=${businessCode}`);

    if (!response.success || !response.data) {
      throw new Error('Failed to load venue details');
    }

    const venue = response.data.find(v => v.venue_code === venueCode);

    if (!venue) {
      throw new Error('Venue not found');
    }

    // Show the add venue form container for editing
    const addVenueFormContainer = document.getElementById('addVenueForm');
    addVenueFormContainer.style.display = 'block';

    // Debug: Log form fields to verify they exist
    console.log('Form fields check:', {
      venue_code: document.getElementById('venue_code'),
      venue_name: document.getElementById('venue_name'),
      venue_address: document.getElementById('venue_address'),
      venue_state: document.getElementById('venue_state'),
      venue_email: document.getElementById('venue_email'),
      kiosk_password: document.getElementById('kiosk_password'),
      venue_timezone: document.getElementById('venue_timezone'),
      week_start: document.getElementById('week_start')
    });

    // Populate the form fields with correct IDs from admin.html
    document.getElementById('venue_code').value = venue.venue_code || '';
    document.getElementById('venue_code').readOnly = true; // Venue code shouldn't be changed
    document.getElementById('venue_name').value = venue.venue_name || '';
    document.getElementById('venue_address').value = venue.venue_address || venue.address || '';
    document.getElementById('venue_state').value = venue.state || '';
    document.getElementById('venue_email').value = venue.contact_email || venue.email || '';
    document.getElementById('kiosk_password').value = ''; // Don't populate password for security
    document.getElementById('venue_timezone').value = venue.timezone || '';
    document.getElementById('week_start').value = venue.week_start || 'Mon';

    // Update form title and button text to indicate edit mode
    document.getElementById('venueFormTitle').innerHTML = '<i class="fas fa-edit me-2"></i>Edit Venue';
    document.getElementById('saveVenueBtn').innerHTML = '<i class="fas fa-check me-2"></i>Update Venue';

    // Set edit mode flag
    document.getElementById('edit_mode').value = 'true';

    // Scroll to the form
    addVenueFormContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });

  } catch (error) {
    console.error('Error editing venue:', error);
    showToast('Failed to load venue: ' + error.message, 'error');
  }
}

/**
 * Delete venue with confirmation
 * @param {string} venueCode - Venue code to delete
 * @param {string} venueName - Venue name for confirmation message
 */
export async function deleteVenue(venueCode, venueName) {
  if (!confirm(`Are you sure you want to delete venue "${venueName}" (${venueCode})?\n\nThis action cannot be undone.`)) {
    return;
  }

  try {
    console.log('Deleting venue:', venueCode);
    showToast('Deleting venue...', 'info');

    const result = await apiRequest(`/system-admin/venues/${venueCode}`, {
      method: 'DELETE'
    });

    if (result.success) {
      showToast('Venue deleted successfully', 'success');
      await loadVenues();
    } else {
      showToast(result.error || 'Failed to delete venue', 'error');
    }
  } catch (error) {
    console.error('Error deleting venue:', error);
    showToast('Failed to delete venue: ' + error.message, 'error');
  }
}

/**
 * Handle add/edit venue form submission
 * @param {Event} e - Form submit event
 */
export async function handleAddVenue(e) {
  e.preventDefault();

  const form = e.target;
  const businessCode = Storage.getUserBusinessCode();
  const editMode = document.getElementById('edit_mode').value === 'true';
  const venueCode = form.venue_code.value.trim();

  // Build venue data object with correct field names
  const venueData = {
    business_code: businessCode,
    venue_code: venueCode,
    venue_name: form.venue_name.value.trim(),
    contact_email: form.venue_email.value.trim(),
    kiosk_password: form.kiosk_password.value.trim(),
    state: form.state.value,
    venue_address: form.venue_address.value.trim(),
    timezone: form.timezone.value,
    week_start: form.week_start.value
  };

  console.log(editMode ? 'Updating venue:' : 'Adding venue:', venueData);

  try {
    if (editMode) {
      // Update existing venue
      showToast('Updating venue...', 'info');

      const result = await apiRequest(`/system-admin/venues/${venueCode}`, {
        method: 'PUT',
        body: JSON.stringify(venueData)
      });

      if (result.success) {
        showToast('Venue updated successfully', 'success');
        resetVenueForm();
        await loadVenues();
      } else {
        showToast(result.error || 'Failed to update venue', 'error');
      }
    } else {
      // Add new venue
      showToast('Adding venue...', 'info');

      const result = await apiRequest('/system-admin/venues', {
        method: 'POST',
        body: JSON.stringify(venueData)
      });

      if (result.success) {
        showToast('Venue added successfully', 'success');
        resetVenueForm();
        await loadVenues();
      } else {
        showToast(result.error || 'Failed to add venue', 'error');
      }
    }
  } catch (error) {
    console.error('Error saving venue:', error);
    showToast('Error saving venue: ' + error.message, 'error');
  }
}

/**
 * Reset venue form to add mode
 */
function resetVenueForm() {
  const form = document.getElementById('addVenueFormElement');
  const addVenueFormContainer = document.getElementById('addVenueForm');

  form.reset();
  addVenueFormContainer.style.display = 'none';

  // Reset to add mode
  document.getElementById('edit_mode').value = 'false';
  document.getElementById('venue_code').readOnly = false;
  document.getElementById('venueFormTitle').innerHTML = '<i class="fas fa-building me-2"></i>Add New Venue';
  document.getElementById('saveVenueBtn').innerHTML = '<i class="fas fa-check me-2"></i>Save Venue';
}


/**
 * Initialize venue module - setup event listeners
 */
export function initVenueModule() {
  console.log('Initializing venue module...');

  // Add/Edit venue form
  const addVenueForm = document.getElementById('addVenueFormElement');
  if (addVenueForm) {
    addVenueForm.addEventListener('submit', handleAddVenue);
  }

  // Show/Hide add venue form buttons
  const showAddVenueBtn = document.getElementById('showAddVenueBtn');
  const hideAddVenueBtn = document.getElementById('hideAddVenueBtn');
  const cancelAddVenueBtn = document.getElementById('cancelAddVenueBtn');
  const cancelVenueEditBtn = document.getElementById('cancelVenueEditBtn');
  const addVenueFormContainer = document.getElementById('addVenueForm');

  if (showAddVenueBtn && addVenueFormContainer) {
    showAddVenueBtn.addEventListener('click', () => {
      resetVenueForm(); // Reset form before showing
      addVenueFormContainer.style.display = 'block';
    });
  }

  if (hideAddVenueBtn && addVenueFormContainer) {
    hideAddVenueBtn.addEventListener('click', () => {
      resetVenueForm();
    });
  }

  if (cancelAddVenueBtn && addVenueFormContainer) {
    cancelAddVenueBtn.addEventListener('click', () => {
      resetVenueForm();
    });
  }

  if (cancelVenueEditBtn && addVenueFormContainer) {
    cancelVenueEditBtn.addEventListener('click', () => {
      resetVenueForm();
    });
  }

  // Venue search with debounce
  const venueSearchInput = document.getElementById('venueSearchInput');
  if (venueSearchInput) {
    const debouncedFilter = debounce((value) => {
      filterVenues(value);
    }, 300);

    venueSearchInput.addEventListener('input', (e) => {
      debouncedFilter(e.target.value);
    });
  }
}

/**
 * Filter venues by search term
 * @param {string} searchTerm - Search term to filter by
 */
function filterVenues(searchTerm) {
  const rows = document.querySelectorAll('#venueList tbody tr');
  const term = searchTerm.toLowerCase();

  rows.forEach(row => {
    const text = row.textContent.toLowerCase();
    row.style.display = text.includes(term) ? '' : 'none';
  });
}

// Export functions to window for onclick handlers
window.editVenue = editVenue;
window.deleteVenue = deleteVenue;
window.loadVenues = loadVenues;