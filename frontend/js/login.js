/**
 * Login Module
 * Handles user authentication using modular utilities
 */

import { api } from './utils/api.js';
import { Storage } from './utils/storage.js';
import { showToast } from './utils/ui.js';

// Module state
let selectedRole = '';

// Initialize on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  setupEventListeners();
});

/**
 * Setup all event listeners
 */
function setupEventListeners() {
  // Login form submission
  const loginForm = document.getElementById("adminLoginForm");
  if (loginForm) {
    loginForm.addEventListener("submit", handleLogin);
  }

  // Role selection buttons (event delegation)
  document.body.addEventListener('click', (e) => {
    if (e.target.closest('[data-role]')) {
      const role = e.target.closest('[data-role]').dataset.role;
      selectRole(role);
    }
  });

  // Staff kiosk button
  const staffKioskButton = document.getElementById('staffKioskButton');
  if (staffKioskButton) {
    staffKioskButton.addEventListener('click', goToStaffConsole);
  }

  // Back to role selection button
  const backToRoleButton = document.getElementById('backToRoleButton');
  if (backToRoleButton) {
    backToRoleButton.addEventListener('click', backToRoleSelection);
  }
}

/**
 * Handle login form submission
 * @param {Event} e - Form submit event
 */
async function handleLogin(e) {
  e.preventDefault();

  const username = document.getElementById("username")?.value.trim();
  const password = document.getElementById("password")?.value.trim();
  const errorBox = document.getElementById("loginMessage");
  const loginBtn = e.target.querySelector("button[type='submit']");

  // Clear previous errors
  if (errorBox) {
    errorBox.innerHTML = "";
  }

  // Basic validation
  if (!username || !password) {
    showError("Please enter both username and password.");
    return;
  }

  try {
    // Disable button while waiting
    if (loginBtn) {
      loginBtn.disabled = true;
      loginBtn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span> Signing in...`;
    }

    // Call login API using modular api utility
    const data = await api.post("/login", { username, password });

    if (!data.success) {
      throw new Error(data.error || "Login failed");
    }

    // Success: Save user using Storage utility
    Storage.clearUser(); // Clear old session
    Storage.setUser(data);

    showToast(`Welcome, ${Storage.getUserFullName()}!`, 'success');

    // Blur active element to avoid aria-hidden warnings
    document.activeElement?.blur();

    // Redirect based on access level
    redirectUser(data.access_level);

  } catch (err) {
    console.error("Login error:", err);
    showError(err.message || "Invalid credentials. Please try again.");
  } finally {
    // Re-enable button
    if (loginBtn) {
      loginBtn.disabled = false;
      loginBtn.innerHTML = `<i class="bi bi-box-arrow-in-right me-2"></i>Sign In`;
    }
  }
}

/**
 * Redirect user based on access level
 * @param {string} accessLevel - User's access level
 */
function redirectUser(accessLevel) {
  switch (accessLevel) {
    case "master":
      window.location.href = "/master.html";
      break;
    case "system_admin":
    case "manager":
    case "supervisor":
      window.location.href = "/admin.html";
      break;
    case "employee":
      window.location.href = "/kiosk.html";
      break;
    default:
      window.location.href = "/admin.html";
  }
}

/**
 * Show error message
 * @param {string} message - Error message to display
 */
function showError(message) {
  const errorBox = document.getElementById("loginMessage");
  if (errorBox) {
    errorBox.innerHTML = `<div class="alert alert-danger p-3">${message}</div>`;
  } else {
    alert("❌ " + message);
  }
  showToast(message, 'error');
}

/**
 * Select role (admin/staff)
 * @param {string} role - Selected role
 */
function selectRole(role) {
  selectedRole = role;

  const subtitle = document.getElementById('loginSubtitle');
  const roleSelection = document.getElementById('roleSelection');
  const loginForm = document.getElementById('loginForm');
  const errorBox = document.getElementById("loginMessage");

  // Clear any previous errors
  if (errorBox) {
    errorBox.classList.add('d-none');
    errorBox.innerHTML = '';
  }

  if (role === 'admin') {
    subtitle.textContent = 'Admin Console Login';
    roleSelection.classList.add('d-none');
    loginForm.classList.remove('d-none');

    // Focus on username field
    setTimeout(() => {
      const usernameField = document.getElementById('username');
      if (usernameField) {
        usernameField.focus();
      }
    }, 100);
  }
}

/**
 * Navigate to staff console (kiosk)
 */
function goToStaffConsole() {
  window.location.href = 'kiosk.html';
}

/**
 * Back to role selection screen
 */
function backToRoleSelection() {
  const subtitle = document.getElementById('loginSubtitle');
  const roleSelection = document.getElementById('roleSelection');
  const loginForm = document.getElementById('loginForm');
  const errorBox = document.getElementById("loginMessage");
  const authForm = document.getElementById("authForm");

  // Clear any previous errors
  if (errorBox) {
    errorBox.classList.add('d-none');
    errorBox.innerHTML = '';
  }

  // Reset form
  if (authForm) {
    authForm.reset();
  }

  // Reset UI
  subtitle.textContent = 'Choose your console to continue';
  roleSelection.classList.remove('d-none');
  loginForm.classList.add('d-none');
  selectedRole = '';
}
