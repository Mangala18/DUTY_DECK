/**
 * Staff Module Index
 * Centralized export for all staff-related functionality
 */

import {
    loadVenues,
    populateVenueDropdown,
    populateVenueFilter,
    loadStaffList,
    applyStaffFilters,
    getStaffData,
    getVenuesData
} from './list.js';

import {
    handleAddStaff,
    handleEditStaff,
    deleteStaff
} from './form.js';

import {
    viewStaff,
    editStaff
} from './detail.js';

/**
 * Initialize staff module
 * Sets up event listeners and loads initial data
 */
export function initStaffModule() {
    console.log('Initializing staff module...');

    // Setup event listeners
    setupEventListeners();

    // Load initial data
    loadVenues().then(() => {
        populateVenueDropdown();
        populateVenueFilter();
    });
}

/**
 * Setup all event listeners for staff module
 */
function setupEventListeners() {
    // Add Staff Form
    const addStaffForm = document.getElementById('addStaffForm');
    if (addStaffForm) {
        addStaffForm.addEventListener('submit', handleAddStaff);
    }

    // Edit Staff Form
    const editStaffForm = document.getElementById('editStaffForm');
    if (editStaffForm) {
        editStaffForm.addEventListener('submit', handleEditStaff);
    }

    // Load venues when Add Staff modal opens
    const addStaffModal = document.getElementById('addStaffModal');
    if (addStaffModal) {
        addStaffModal.addEventListener('show.bs.modal', () => {
            populateVenueDropdown();
        });
    }

    // Apply filters button
    const applyFiltersBtn = document.querySelector('[onclick="applyStaffFilters()"]');
    if (applyFiltersBtn) {
        applyFiltersBtn.onclick = applyStaffFilters;
    }
}

// Export all functions
export {
    // List operations
    loadVenues,
    populateVenueDropdown,
    populateVenueFilter,
    loadStaffList,
    applyStaffFilters,
    getStaffData,
    getVenuesData,

    // Form operations
    handleAddStaff,
    handleEditStaff,
    deleteStaff,

    // Detail operations
    viewStaff,
    editStaff
};

// Make applyStaffFilters available globally for onclick (temporary)
window.applyStaffFilters = applyStaffFilters;
