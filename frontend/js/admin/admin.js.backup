// Global variables
let currentUser = null;
let sidebarVisible = true;
let autoHideTimer = null;

// Initialize admin panel
document.addEventListener('DOMContentLoaded', function() {
    // Check if user is logged in
    checkAuth();

    // Load user information
    loadUserInfo();

    // Show default panel
    showPanel('dashboard');

    // Load initial data
    loadDashboardData();

    // Setup sidebar auto-hide functionality
    setupSidebarAutoHide();

    // Setup sidebar interactions
    setupSidebarInteractions();

    // Setup event listeners for buttons
    setupEventListeners();
});

function checkAuth() {
    const user = localStorage.getItem('currentUser');
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    try {
        currentUser = JSON.parse(user);
    } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('currentUser');
        window.location.href = 'index.html';
    }
}

function loadUserInfo() {
    if (currentUser) {
        const welcomeElement = document.getElementById('welcomeUser');
        if (welcomeElement) {
            welcomeElement.textContent = `Welcome, ${currentUser.first_name || 'Admin'}`;
        }
    }
}

function showPanel(panelName) {
    // Hide all panels
    const panels = document.querySelectorAll('.content-panel');
    panels.forEach(panel => {
        panel.classList.remove('active');
    });

    // Remove active class from all nav links
    const navLinks = document.querySelectorAll('.sidebar .nav-link');
    navLinks.forEach(link => {
        link.classList.remove('active');
    });

    // Show selected panel
    const targetPanel = document.getElementById(panelName + 'Panel');
    if (targetPanel) {
        targetPanel.classList.add('active');
    }

    // Add active class to corresponding nav link
    const activeLink = document.querySelector(`[data-panel="${panelName}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }

    // Load panel-specific data
    switch(panelName) {
        case 'dashboard':
            loadDashboardData();
            break;
        case 'staff':
            // Staff loading is handled by staff.js
            if (typeof loadStaffList === 'function') {
                loadStaffList();
            }
            break;
        case 'schedule':
            loadScheduleData();
            break;
        case 'payroll':
            loadPayrollData();
            break;
        case 'holidays':
            loadHolidaysData();
            break;
        case 'reports':
            loadReportsData();
            break;
        case 'settings':
            loadSettingsData();
            break;
    }
}

function loadDashboardData() {
    // Update dashboard statistics
    document.getElementById('totalStaff').textContent = '0';
    document.getElementById('activeShifts').textContent = '0';
    document.getElementById('todayHours').textContent = '0';
    document.getElementById('weekTotal').textContent = '$0';
}

// Staff data loading is handled by staff.js

function loadScheduleData() {
    // Load schedule data - placeholder for now
    console.log('Loading schedule data...');
}

function loadPayrollData() {
    // Load payroll data - placeholder for now
    console.log('Loading payroll data...');
}

function loadHolidaysData() {
    // Load holidays data - placeholder for now
    console.log('Loading holidays data...');
}

function loadReportsData() {
    // Load reports data - placeholder for now
    console.log('Loading reports data...');
}

function loadSettingsData() {
    // Load settings data - placeholder for now
    console.log('Loading settings data...');
}

// Add Staff functionality is handled by staff.js
// This function is kept for compatibility but staff.js handles the actual form submission

function logout() {
    // Clear user data
    localStorage.removeItem('currentUser');

    // Redirect to login page
    window.location.href = 'index.html';
}

// Utility functions
function showMessage(message, type = 'info') {
    // Create a toast or alert for user feedback
    console.log(`${type.toUpperCase()}: ${message}`);
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-AU', {
        style: 'currency',
        currency: 'AUD'
    }).format(amount);
}

function formatDate(date) {
    return new Intl.DateTimeFormat('en-AU').format(new Date(date));
}

function formatTime(time) {
    return new Intl.DateTimeFormat('en-AU', {
        hour: '2-digit',
        minute: '2-digit'
    }).format(new Date(time));
}

// Sidebar functionality
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const sidebarCol = sidebar.parentElement;
    const mainContent = document.getElementById('mainContent');

    if (window.innerWidth <= 768) {
        // Mobile behavior - hide/show completely
        if (sidebarVisible) {
            sidebar.style.transform = 'translateX(-100%)';
            sidebarVisible = false;
        } else {
            sidebar.style.transform = 'translateX(0)';
            sidebarVisible = true;
        }
    } else {
        // Desktop behavior - collapse to icons
        if (sidebarVisible) {
            sidebar.classList.add('collapsed');
            sidebarCol.classList.add('collapsed');
            mainContent.classList.add('expanded');
            sidebarVisible = false;
        } else {
            sidebar.classList.remove('collapsed');
            sidebarCol.classList.remove('collapsed');
            mainContent.classList.remove('expanded');
            sidebarVisible = true;
        }
    }
}

function setupSidebarAutoHide() {
    // Auto-collapse after 5 seconds of inactivity (no timer shown)
    if (window.innerWidth > 768) {
        startAutoCollapseTimer();
    }

    // Handle window resize
    window.addEventListener('resize', function() {
        const sidebar = document.getElementById('sidebar');
        const sidebarCol = sidebar.parentElement;
        const mainContent = document.getElementById('mainContent');

        if (window.innerWidth <= 768) {
            // Mobile mode - remove desktop classes
            sidebar.classList.remove('collapsed');
            sidebarCol.classList.remove('collapsed');
            mainContent.classList.remove('expanded');
            clearAutoCollapseTimer();
        } else {
            // Desktop mode - start timer if expanded
            if (sidebarVisible) {
                startAutoCollapseTimer();
            }
        }
    });
}

function setupSidebarInteractions() {
    const sidebar = document.getElementById('sidebar');

    // Reset timer on sidebar hover/interaction
    sidebar.addEventListener('mouseenter', function() {
        if (window.innerWidth > 768) {
            clearAutoCollapseTimer();
            // Expand if collapsed
            if (!sidebarVisible) {
                toggleSidebar();
            }
        }
    });

    sidebar.addEventListener('mouseleave', function() {
        if (sidebarVisible && window.innerWidth > 768) {
            startAutoCollapseTimer();
        }
    });

    // Reset timer on any sidebar click
    sidebar.addEventListener('click', function() {
        if (window.innerWidth > 768) {
            clearAutoCollapseTimer();
            startAutoCollapseTimer();
        }
    });
}

function startAutoCollapseTimer() {
    if (window.innerWidth <= 768) return; // Don't auto-collapse on mobile

    clearAutoCollapseTimer();

    autoHideTimer = setTimeout(function() {
        if (sidebarVisible) {
            toggleSidebar(); // Collapse to icons
        }
    }, 5000); // 5 seconds
}

function clearAutoCollapseTimer() {
    if (autoHideTimer) {
        clearTimeout(autoHideTimer);
        autoHideTimer = null;
    }
}

function setupEventListeners() {
    // Sidebar toggle button
    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', toggleSidebar);
    }

    // Logout button
    const logoutButton = document.getElementById('logoutButton');
    if (logoutButton) {
        logoutButton.addEventListener('click', logout);
    }

    // Navigation links (event delegation)
    document.body.addEventListener('click', (e) => {
        const navLink = e.target.closest('[data-panel]');
        if (navLink) {
            e.preventDefault();
            const panelName = navLink.dataset.panel;

            // Remove active class from all nav links
            document.querySelectorAll('.nav-link').forEach(link => {
                link.classList.remove('active');
            });

            // Add active class to clicked link
            navLink.classList.add('active');

            // Show the panel
            showPanel(panelName);
        }
    });
}