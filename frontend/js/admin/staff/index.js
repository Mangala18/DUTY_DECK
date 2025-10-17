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
    // Add Staff Form Element (the form itself)
    const addStaffForm = document.getElementById('addStaffFormElement');
    if (addStaffForm) {
        addStaffForm.addEventListener('submit', handleAddStaff);
    }

    // Edit Staff Form
    const editStaffForm = document.getElementById('editStaffForm');
    if (editStaffForm) {
        editStaffForm.addEventListener('submit', handleEditStaff);
    }

    // Show/Hide Add Staff Form (inline form, not modal)
    const showAddStaffBtn = document.getElementById('showAddStaffBtn');
    const hideAddStaffBtn = document.getElementById('hideAddStaffBtn');
    const cancelAddStaffBtn = document.getElementById('cancelAddStaffBtn');
    const addStaffFormContainer = document.getElementById('addStaffForm');
    const staffFilters = document.getElementById('staffFilters');

    if (showAddStaffBtn && addStaffFormContainer) {
        showAddStaffBtn.addEventListener('click', () => {
            addStaffFormContainer.style.display = 'block';
            if (staffFilters) staffFilters.style.display = 'none';
            populateVenueDropdown();
        });
    }

    if (hideAddStaffBtn && addStaffFormContainer) {
        hideAddStaffBtn.addEventListener('click', () => {
            addStaffFormContainer.style.display = 'none';
            if (staffFilters) staffFilters.style.display = 'block';
        });
    }

    if (cancelAddStaffBtn && addStaffFormContainer) {
        cancelAddStaffBtn.addEventListener('click', () => {
            addStaffFormContainer.style.display = 'none';
            if (staffFilters) staffFilters.style.display = 'block';
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
