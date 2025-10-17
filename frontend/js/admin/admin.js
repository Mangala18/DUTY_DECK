/**
 * Admin Panel Main Module
 * Coordinates all admin functionality using modular imports
 */

import { Storage } from '../utils/storage.js';
import { showToast } from '../utils/ui.js';
import { initStaffModule, loadStaffList } from './staff/index.js';
import { initVenueModule, loadVenues } from './venue.js';
import { initScheduleModule, loadSchedule } from './schedule.js';
import { initTimesheetModule, loadTimesheetStaff } from './timesheet.js';
import { initPayroll, loadPayrollSummary } from './payroll.js';
import { apiRequest } from '../utils/api.js';

// Check authentication on page load
document.addEventListener('DOMContentLoaded', () => {
    // Require authentication
    if (!Storage.requireAuth('/admin.html')) {
        return;
    }

    // Check if user has admin access
    const accessLevel = Storage.getUserAccessLevel();
    if (!['system_admin', 'manager', 'supervisor'].includes(accessLevel)) {
        showToast('You do not have permission to access this page', 'error');
        setTimeout(() => {
            window.location.href = '/index.html';
        }, 2000);
        return;
    }

    // Initialize
    initializeAdminPanel();
});

/**
 * Initialize admin panel
 */
function initializeAdminPanel() {
    // Update welcome message
    updateWelcomeMessage();

    // Setup navigation
    setupNavigation();

    // Setup logout
    setupLogout();

    // Setup offline/online detection
    setupNetworkDetection();

    // Load dashboard metrics
    loadDashboardMetrics();

    // Initialize staff module
    initStaffModule();

    // Initialize venue module
    initVenueModule();

    // Initialize schedule module
    initScheduleModule();

    // Initialize timesheet module
    initTimesheetModule();

    // Initialize payroll module
    initPayroll();

    // Show welcome toast
    showToast(`Welcome back, ${Storage.getUserFullName()}!`, 'success');
}

/**
 * Update welcome message with user info
 */
function updateWelcomeMessage() {
    const welcomeEl = document.getElementById('welcomeUser');
    if (welcomeEl) {
        const fullName = Storage.getUserFullName();
        const accessLevel = Storage.getUserAccessLevel();
        welcomeEl.textContent = `Welcome, ${fullName} (${accessLevel})`;
    }
}

/**
 * Setup sidebar navigation
 */
function setupNavigation() {
    const sidebarLinks = document.querySelectorAll('.sidebar .nav-link');
    const sections = document.querySelectorAll('.content-section');
    const sidebar = document.getElementById('sidebar');
    const sidebarOverlay = document.getElementById('sidebarOverlay');
    const pageTitle = document.getElementById('pageTitle');

    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();

            const sectionName = link.dataset.section;
            const sectionId = sectionName + 'Section';

            // Update active link
            sidebarLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // Update page title
            const titleText = link.querySelector('.nav-text').textContent;
            if (pageTitle) {
                pageTitle.textContent = titleText;
            }

            // Show corresponding section
            sections.forEach(section => {
                if (section.id === sectionId) {
                    section.classList.add('active');

                    // Load data for specific sections
                    if (sectionId === 'staffSection') {
                        loadStaffList();
                    } else if (sectionId === 'dashboardSection') {
                        loadDashboardMetrics();
                    } else if (sectionId === 'businessSection') {
                        loadVenues();
                    } else if (sectionId === 'scheduleSection') {
                        loadSchedule();
                    } else if (sectionId === 'timesheetSection') {
                        loadTimesheetStaff();
                    } else if (sectionId === 'payrollSection') {
                        loadPayrollSummary();
                    }
                } else {
                    section.classList.remove('active');
                }
            });

            // Close sidebar on mobile after selecting
            if (window.innerWidth <= 768) {
                sidebar.classList.remove('mobile-open');
                sidebarOverlay.classList.remove('show');
            }
        });
    });

    // Desktop sidebar toggle (collapse/expand)
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => {
            if (window.innerWidth > 768) {
                // Desktop: toggle collapsed state
                sidebar.classList.toggle('collapsed');
            } else {
                // Mobile: toggle mobile-open state
                sidebar.classList.toggle('mobile-open');
                sidebarOverlay.classList.toggle('show');
            }
        });
    }

    // Mobile toggle button
    const mobileToggle = document.getElementById('mobileToggle');
    if (mobileToggle) {
        mobileToggle.addEventListener('click', () => {
            sidebar.classList.add('mobile-open');
            sidebarOverlay.classList.add('show');
        });
    }

    // Close sidebar when overlay is clicked
    if (sidebarOverlay) {
        sidebarOverlay.addEventListener('click', () => {
            sidebar.classList.remove('mobile-open');
            sidebarOverlay.classList.remove('show');
        });
    }

    // Setup dashboard refresh button
    const refreshBtn = document.getElementById('refreshDashboard');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', () => {
            loadDashboardMetrics();
            showToast('Dashboard refreshed', 'success');
        });
    }
}

/**
 * Setup logout functionality
 */
function setupLogout() {
    const logoutBtn = document.getElementById('logoutButton');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', handleLogout);
    }
}

/**
 * Handle logout
 */
function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        Storage.clearUser();
        showToast('Logged out successfully', 'success');
        setTimeout(() => {
            window.location.href = '/index.html';
        }, 500);
    }
}

/**
 * Setup offline/online network detection
 */
function setupNetworkDetection() {
    // Show notification when going offline
    window.addEventListener('offline', () => {
        showToast('You are now offline. Some features may be unavailable.', 'warning', 5000);
    });

    // Show notification when coming back online
    window.addEventListener('online', () => {
        showToast('You are back online.', 'success', 3000);
    });

    // Check initial connection status
    if (!navigator.onLine) {
        showToast('You appear to be offline. Some features may be unavailable.', 'warning', 5000);
    }
}

/**
 * Load dashboard metrics
 */
async function loadDashboardMetrics() {
    try {
        const data = await apiRequest('/system-admin/dashboard');

        // Update dashboard cards
        document.getElementById('totalStaff').textContent = data.totalStaff || 0;
        document.getElementById('activeShifts').textContent = data.activeShifts || 0;
        document.getElementById('todayHours').textContent = data.todayHours || '0.00';
        document.getElementById('weekTotal').textContent = data.weekTotal || '0.00';

    } catch (error) {
        console.error('Error loading dashboard metrics:', error);
        showToast('Failed to load dashboard metrics', 'error');
    }
}
