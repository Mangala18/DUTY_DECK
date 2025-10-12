/**
 * Admin Panel Main Module
 * Coordinates all admin functionality using modular imports
 */

import { Storage } from '../utils/storage.js';
import { showToast } from '../utils/ui.js';
import { initStaffModule, loadStaffList } from './staff/index.js';
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
    const panels = document.querySelectorAll('.content-panel');

    sidebarLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();

            const panelId = link.dataset.panel + 'Panel';

            // Update active link
            sidebarLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            // Show corresponding panel
            panels.forEach(panel => {
                if (panel.id === panelId) {
                    panel.classList.add('active');

                    // Load data for specific panels
                    if (panelId === 'staffPanel') {
                        loadStaffList();
                    } else if (panelId === 'dashboardPanel') {
                        loadDashboardMetrics();
                    }
                } else {
                    panel.classList.remove('active');
                }
            });
        });
    });

    // Sidebar toggle for mobile
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.getElementById('sidebar');
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('show');
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
