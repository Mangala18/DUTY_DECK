// ============================
// MASTER.JS (Frontend)
// Professional Panel with Master API Integration
// ============================
// Purpose:
// - Beautiful sidebar panel design
// - Add businesses via /api/master/business
// - Add venues + system admins via /api/master/venue-with-admin
// - Show live dashboard stats via /api/master/stats
// - List businesses & venues with proper tables

// Sidebar Toggle Functions
const sidebar = document.getElementById('sidebar');
const sidebarToggle = document.getElementById('sidebarToggle');
const mobileToggle = document.getElementById('mobileToggle');
const sidebarOverlay = document.getElementById('sidebarOverlay');

sidebarToggle.addEventListener('click', () => {
  sidebar.classList.toggle('collapsed');
});

mobileToggle.addEventListener('click', () => {
  sidebar.classList.toggle('mobile-open');
  sidebarOverlay.style.display = sidebar.classList.contains('mobile-open') ? 'block' : 'none';
});

sidebarOverlay.addEventListener('click', () => {
  sidebar.classList.remove('mobile-open');
  sidebarOverlay.style.display = 'none';
});

// ============================
// LAZY LOADING CACHE
// ============================
const dataCache = {
  dashboard: null,
  businesses: null,
  venues: null,
  users: null
};

// Navigation Functions
const navLinks = document.querySelectorAll('.nav-link');
const sections = document.querySelectorAll('.content-section');
const pageTitle = document.getElementById('pageTitle');

navLinks.forEach(link => {
  link.addEventListener('click', (e) => {
    e.preventDefault();

    // Update active nav
    navLinks.forEach(l => l.classList.remove('active'));
    link.classList.add('active');

    // Show corresponding section
    const section = link.dataset.section;
    sections.forEach(s => s.style.display = 'none');
    document.getElementById(section + 'Section').style.display = 'block';

    // Update page title
    const titles = {
      dashboard: 'Dashboard',
      businesses: 'Businesses',
      venues: 'Venues',
      users: 'Users'
    };
    pageTitle.textContent = titles[section];

    // Lazy load data for the section
    loadSectionData(section);

    // Close mobile menu
    if (window.innerWidth <= 768) {
      sidebar.classList.remove('mobile-open');
      sidebarOverlay.style.display = 'none';
    }
  });
});

// Load data only when tab is clicked
function loadSectionData(section) {
  switch(section) {
    case 'dashboard':
      if (!dataCache.dashboard) {
        loadDashboardStats();
        dataCache.dashboard = true; // Mark as loaded
      }
      break;
    case 'businesses':
      if (!dataCache.businesses) {
        loadBusinesses();
        dataCache.businesses = true; // Mark as loaded
      }
      break;
    case 'venues':
      if (!dataCache.venues) {
        loadVenues();
        dataCache.venues = true; // Mark as loaded
      }
      break;
    case 'users':
      if (!dataCache.users) {
        loadVenuesForFilter(); // Load venues for filter dropdown
        loadStaff(); // Load staff with default filters
        dataCache.users = true; // Mark as loaded
      }
      break;
  }
}

// Form Show/Hide Functions
function showAddBusinessForm() {
  document.getElementById('addBusinessForm').style.display = 'block';
}

function hideAddBusinessForm() {
  document.getElementById('addBusinessForm').style.display = 'none';
  document.getElementById('businessForm').reset();
}

function showAddVenueForm() {
  document.getElementById('addVenueForm').style.display = 'block';
}

function hideAddVenueForm() {
  document.getElementById('addVenueForm').style.display = 'none';
  document.getElementById('venueSysAdminForm').reset();
}

// ============================
// Create Business
// POST /api/master/business
// ============================
async function createBusiness(event) {
  event.preventDefault();
  const form = event.target;

  // Validate form
  const validationRules = {
    code: {
      validator: (val) => isRequired(val) && val.length >= 2 && val.length <= 10,
      message: 'Business code is required (2-10 characters)'
    },
    name: {
      validator: (val) => isRequired(val) && val.length >= 2,
      message: 'Business name is required (min 2 characters)'
    }
  };

  if (!validateForm(form, validationRules)) {
    showToast('Please fix the validation errors before submitting', 'error');
    return;
  }

  const payload = {
    code: form.code.value,
    name: form.name.value,
  };

  try {
    const res = await fetch("/api/master/business", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok || !data.success) throw new Error(data.error || "Failed to create business");

    showToast(`Business "${payload.name}" created successfully!`, 'success');
    clearValidation(form);
    form.reset();
    hideAddBusinessForm();
    loadBusinesses();
    loadDashboardStats();
  } catch (err) {
    console.error("Business creation error:", err);
    showToast("Failed to create business: " + err.message, 'error');
  }
}

// ============================
// Create Venue + SysAdmin
// POST /api/master/venue-with-admin
// ============================
async function createVenueAndSysAdmin(event) {
  event.preventDefault();
  const form = event.target;

  // Validate form
  const validationRules = {
    business_code: { validator: isRequired, message: 'Business code is required' },
    venue_code: { validator: (val) => isRequired(val) && val.length >= 2, message: 'Venue code is required (min 2 chars)' },
    venue_name: { validator: isRequired, message: 'Venue name is required' },
    venue_address: { validator: isRequired, message: 'Venue address is required' },
    state: { validator: isRequired, message: 'State is required' },
    contact_email: { validator: isValidEmail, message: 'Valid contact email is required' },
    kiosk_password: { validator: (val) => isRequired(val) && val.length >= 6, message: 'Kiosk password required (min 6 chars)' },
    staff_code: { validator: isRequired, message: 'Staff code is required' },
    first_name: { validator: isRequired, message: 'First name is required' },
    last_name: { validator: isRequired, message: 'Last name is required' },
    email: { validator: isValidEmail, message: 'Valid email is required' },
    password: { validator: isStrongPassword, message: 'Password must be 8+ chars with uppercase, lowercase, and number' }
  };

  if (!validateForm(form, validationRules)) {
    showToast('Please fix the validation errors before submitting', 'error');
    return;
  }

  const payload = {
    // Venue Details
    business_code: form.business_code.value,
    venue_code: form.venue_code.value,
    venue_name: form.venue_name.value,
    venue_address: form.venue_address.value,
    state: form.state.value,
    timezone: form.timezone.value,
    week_start: form.week_start.value,

    // Kiosk Details
    contact_email: form.contact_email.value,
    kiosk_password: form.kiosk_password.value,

    // System Admin
    staff_code: form.staff_code.value,
    first_name: form.first_name.value,
    middle_name: form.middle_name.value,
    last_name: form.last_name.value,
    email: form.email.value,
    password: form.password.value,
  };

  try {
    const res = await fetch("/api/master/venue-with-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok || !data.success) throw new Error(data.error || "Failed to create venue + sysadmin");

    showToast(`Venue "${data.venue.venue_name}" created with SysAdmin ${data.sysAdmin.email}! Kiosk PIN: ${data.sysAdmin.kiosk_pin}`, 'success');
    clearValidation(form);
    form.reset();
    hideAddVenueForm();
    loadVenues();
    loadBusinesses(); // refresh dropdown
    loadDashboardStats();
  } catch (err) {
    console.error("Venue + SysAdmin creation error:", err);
    showToast("Failed to create venue + sysadmin: " + err.message, 'error');
  }
}

// ============================
// Load Businesses
// GET /api/master/businesses
// ============================
async function loadBusinesses() {
  try {
    const res = await fetch("/api/master/businesses");
    const data = await res.json();
    const tableContent = document.querySelector('#businessList .table-content');
    const dropdown = document.querySelector('#venueSysAdminForm select[name="business_code"]');

    if (res.ok && data.success && data.data.length > 0) {
      // Fill table
      tableContent.innerHTML = `
        <table class="data-grid">
          <thead>
            <tr>
              <th>Business Code</th>
              <th>Business Name</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${data.data.map(b => `
              <tr>
                <td><strong>${b.business_code}</strong></td>
                <td>${b.business_name}</td>
                <td><span class="badge ${b.status === 'active' ? 'bg-success' : 'bg-secondary'}">${b.status}</span></td>
                <td>${new Date(b.created_at).toLocaleDateString()}</td>
                <td>
                  <button class="btn btn-sm btn-warning" onclick="editBusiness('${b.business_code}', '${b.business_name.replace(/'/g, "\\'")}')">
                    <i class="fas fa-edit"></i>
                  </button>
                  <button class="btn btn-sm btn-danger" onclick="deleteBusiness('${b.business_code}', '${b.business_name.replace(/'/g, "\\'")}')">
                    <i class="fas fa-trash"></i>
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

      // Fill dropdown
      dropdown.innerHTML = '<option value="">Select Business</option>' +
        data.data.map(b =>
          `<option value="${b.business_code}">${b.business_name}</option>`
        ).join('');
    } else {
      tableContent.innerHTML = '<p class="text-muted text-center py-4">No businesses found</p>';
      dropdown.innerHTML = '<option value="">No businesses available</option>';
    }
  } catch (err) {
    console.error("Error loading businesses:", err);
    document.querySelector('#businessList .table-content').innerHTML = '<p class="text-muted text-center py-4">❌ Error loading businesses</p>';
  }
}

// ============================
// Load Venues
// GET /api/master/venues
// ============================
async function loadVenues() {
  try {
    const res = await fetch("/api/master/venues");
    const data = await res.json();
    const tableContent = document.querySelector('#venueList .table-content');

    if (res.ok && data.success && data.data.length > 0) {
      // Store venue data globally for edit function
      window.venueData = data.data;

      tableContent.innerHTML = `
        <table class="data-grid">
          <thead>
            <tr>
              <th>ID</th>
              <th>Venue Name</th>
              <th>Business</th>
              <th>State</th>
              <th>Location</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${data.data.map(v => `
              <tr>
                <td>${v.venue_code}</td>
                <td><strong>${v.venue_name}</strong></td>
                <td>${v.business_name || 'N/A'}</td>
                <td>${v.state}</td>
                <td>${v.location}</td>
                <td><span class="badge ${v.status === 'active' ? 'bg-success' : 'bg-secondary'}">${v.status}</span></td>
                <td>${new Date(v.created_at).toLocaleDateString()}</td>
                <td>
                  <button class="btn btn-sm btn-warning" onclick="editVenue('${v.venue_code}')">
                    <i class="fas fa-edit"></i>
                  </button>
                  <button class="btn btn-sm btn-danger" onclick="deleteVenue('${v.venue_code}', '${v.venue_name.replace(/'/g, "\\'")}')">
                    <i class="fas fa-trash"></i>
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else {
      tableContent.innerHTML = '<p class="text-muted text-center py-4">No venues found</p>';
    }
  } catch (err) {
    console.error("Error loading venues:", err);
    document.querySelector('#venueList .table-content').innerHTML = '<p class="text-muted text-center py-4">❌ Error loading venues</p>';
  }
}

// ============================
// Load Dashboard Stats
// GET /api/master/stats
// ============================
function calcGrowth(current, last) {
  if (!last && current) return { text: "+∞%", class: "positive" };
  if (!last && !current) return { text: "0%", class: "neutral" };
  const diff = current - last;
  const pct = ((diff / last) * 100).toFixed(1);
  const text = `${diff >= 0 ? '+' : ''}${pct}%`;
  const className = diff > 0 ? "positive" : diff < 0 ? "negative" : "neutral";
  return { text, class: className };
}

function updateStatCard(elementId, mainValue, subText, growth) {
  const element = document.getElementById(elementId);
  if (!element) return;

  const statInfo = element.closest('.stat-card').querySelector('.stat-info');
  const h3 = statInfo.querySelector('h3');

  h3.textContent = mainValue;

  // Update or create growth indicator
  let growthElement = statInfo.querySelector('.stat-growth');
  if (!growthElement) {
    growthElement = document.createElement('div');
    growthElement.className = 'stat-growth';
    statInfo.appendChild(growthElement);
  }

  if (subText) {
    growthElement.textContent = `${subText} (${growth.text})`;
    growthElement.className = `stat-growth ${growth.class}`;
    growthElement.style.display = 'block';
  } else {
    growthElement.style.display = 'none';
  }
}

async function loadDashboardStats() {
  try {
    const res = await fetch("/api/master/stats");
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error("Failed to load stats");

    const stats = data.data;

    // Update stat cards with growth indicators
    updateStatCard('statBusinesses', stats.total_businesses,
      `This month: ${stats.businesses_this_month}`,
      calcGrowth(stats.businesses_this_month, stats.businesses_last_month));

    updateStatCard('statVenues', stats.total_venues,
      `This month: ${stats.venues_this_month}`,
      calcGrowth(stats.venues_this_month, stats.venues_last_month));

    updateStatCard('statStaff', stats.total_staff,
      `This month: ${stats.staff_this_month}`,
      calcGrowth(stats.staff_this_month, stats.staff_last_month));

    updateStatCard('statHours', (stats.hours_this_month || 0).toFixed(1),
      `hours this month`,
      calcGrowth(stats.hours_this_month, stats.hours_last_month));

    // Update venues by state table
    const tbody = document.getElementById('venuesByState');
    if (tbody && stats.venues_by_state && stats.venues_by_state.length > 0) {
      tbody.innerHTML = stats.venues_by_state.map(r =>
        `<tr><td>${r.state}</td><td>${r.venues_per_state}</td></tr>`
      ).join('');
    } else if (tbody) {
      tbody.innerHTML = '<tr><td colspan="2" class="text-center text-muted">No venues yet</td></tr>';
    }

  } catch (err) {
    console.error("Dashboard stats error:", err);
    // Show sample data if API fails
    showSampleDashboardData();
  }
}

function showSampleDashboardData() {
  // Fallback to sample data if API is not available
  document.getElementById('statBusinesses').textContent = '0';
  document.getElementById('statVenues').textContent = '0';
  document.getElementById('statStaff').textContent = '0';
  document.getElementById('statHours').textContent = '0';
  document.getElementById('venuesByState').innerHTML = '<tr><td colspan="2" class="text-center text-muted">Unable to load data</td></tr>';
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
  // LAZY LOADING: Only load dashboard on initial page load
  loadDashboardStats();
  dataCache.dashboard = true; // Mark dashboard as loaded

  // Don't load businesses and venues - they'll load when user clicks their tabs

  // Setup event listeners
  setupEventListeners();
});

function setupEventListeners() {
  // Business form controls
  const showAddBusinessBtn = document.getElementById('showAddBusinessBtn');
  if (showAddBusinessBtn) {
    showAddBusinessBtn.addEventListener('click', showAddBusinessForm);
  }

  const hideAddBusinessBtn = document.getElementById('hideAddBusinessBtn');
  if (hideAddBusinessBtn) {
    hideAddBusinessBtn.addEventListener('click', hideAddBusinessForm);
  }

  const cancelAddBusinessBtn = document.getElementById('cancelAddBusinessBtn');
  if (cancelAddBusinessBtn) {
    cancelAddBusinessBtn.addEventListener('click', hideAddBusinessForm);
  }

  const businessForm = document.getElementById('businessForm');
  if (businessForm) {
    businessForm.addEventListener('submit', createBusiness);
  }

  // Venue form controls
  const showAddVenueBtn = document.getElementById('showAddVenueBtn');
  if (showAddVenueBtn) {
    showAddVenueBtn.addEventListener('click', showAddVenueForm);
  }

  const hideAddVenueBtn = document.getElementById('hideAddVenueBtn');
  if (hideAddVenueBtn) {
    hideAddVenueBtn.addEventListener('click', hideAddVenueForm);
  }

  const cancelAddVenueBtn = document.getElementById('cancelAddVenueBtn');
  if (cancelAddVenueBtn) {
    cancelAddVenueBtn.addEventListener('click', hideAddVenueForm);
  }

  const venueSysAdminForm = document.getElementById('venueSysAdminForm');
  if (venueSysAdminForm) {
    venueSysAdminForm.addEventListener('submit', createVenueAndSysAdmin);
  }

  // Staff filter controls
  setupStaffFilters();

  // Staff form controls
  const showAddStaffBtn = document.getElementById('showAddStaffBtn');
  if (showAddStaffBtn) {
    showAddStaffBtn.addEventListener('click', showAddStaffForm);
  }

  const hideAddStaffBtn = document.getElementById('hideAddStaffBtn');
  if (hideAddStaffBtn) {
    hideAddStaffBtn.addEventListener('click', hideAddStaffForm);
  }

  const cancelAddStaffBtn = document.getElementById('cancelAddStaffBtn');
  if (cancelAddStaffBtn) {
    cancelAddStaffBtn.addEventListener('click', hideAddStaffForm);
  }

  const staffForm = document.getElementById('staffForm');
  if (staffForm) {
    staffForm.addEventListener('submit', createStaff);
  }
}

// ============================
// EDIT BUSINESS
// ============================
function editBusiness(code, name) {
  // Populate modal with current data
  document.getElementById('editBusinessCode').value = code;
  document.getElementById('editBusinessCodeDisplay').value = code;
  document.getElementById('editBusinessName').value = name;

  // Show modal
  const modal = new bootstrap.Modal(document.getElementById('editBusinessModal'));
  modal.show();
}

async function saveBusinessEdit() {
  const code = document.getElementById('editBusinessCode').value;
  const name = document.getElementById('editBusinessName').value;

  if (!name) {
    showToast('Business name is required', 'error');
    return;
  }

  try {
    const res = await fetch(`/api/master/business/${code}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update business');
    }

    showToast('Business updated successfully!', 'success');

    // Close modal
    bootstrap.Modal.getInstance(document.getElementById('editBusinessModal')).hide();

    // Clear cache and reload data
    dataCache.businesses = null;
    dataCache.dashboard = null;
    loadBusinesses();
    loadDashboardStats();
  } catch (err) {
    console.error('Error updating business:', err);
    showToast('Failed to update business: ' + err.message, 'error');
  }
}

// ============================
// DELETE BUSINESS
// ============================
let businessToDelete = null;

function deleteBusiness(code, name) {
  // Store business info
  businessToDelete = code;

  // Populate modal
  document.getElementById('deleteBusinessCode').textContent = code;
  document.getElementById('deleteBusinessName').textContent = name;

  // Show modal
  const modal = new bootstrap.Modal(document.getElementById('deleteBusinessModal'));
  modal.show();
}

async function confirmDeleteBusiness() {
  if (!businessToDelete) return;

  try {
    const res = await fetch(`/api/master/business/${businessToDelete}`, {
      method: 'DELETE'
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to delete business');
    }

    showToast('Business deleted successfully!', 'success');

    // Close modal
    bootstrap.Modal.getInstance(document.getElementById('deleteBusinessModal')).hide();

    // Reset
    businessToDelete = null;

    // Clear cache and reload data
    dataCache.businesses = null;
    dataCache.dashboard = null;
    loadBusinesses();
    loadDashboardStats();
  } catch (err) {
    console.error('Error deleting business:', err);
    showToast('Failed to delete business: ' + err.message, 'error');
  }
}

// ============================
// EDIT VENUE + ADMIN
// ============================
async function editVenue(venue_code) {
  try {
    // Fetch full venue details including admin info
    const res = await fetch(`/api/master/venue/${venue_code}`);
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error('Failed to load venue details');
    }

    const venue = data.data;

    // Populate venue fields
    document.getElementById('editVenueCode').value = venue_code;
    document.getElementById('editVenueCodeDisplay').value = venue_code;
    document.getElementById('editVenueName').value = venue.venue_name || '';
    document.getElementById('editVenueAddress').value = venue.venue_address || '';
    document.getElementById('editVenueState').value = venue.state || '';
    document.getElementById('editVenueTimezone').value = venue.timezone || '';
    document.getElementById('editVenueWeekStart').value = venue.week_start || 'Mon';
    document.getElementById('editVenueEmail').value = venue.contact_email || '';

    // Populate admin fields
    document.getElementById('editAdminFirstName').value = venue.first_name || '';
    document.getElementById('editAdminMiddleName').value = venue.middle_name || '';
    document.getElementById('editAdminLastName').value = venue.last_name || '';
    document.getElementById('editAdminEmail').value = venue.admin_email || '';

    // Show modal
    const modal = new bootstrap.Modal(document.getElementById('editVenueModal'));
    modal.show();
  } catch (err) {
    console.error('Error loading venue details:', err);
    showToast('Failed to load venue details: ' + err.message, 'error');
  }
}

async function saveVenueEdit() {
  const venue_code = document.getElementById('editVenueCode').value;

  const payload = {
    venue_name: document.getElementById('editVenueName').value,
    venue_address: document.getElementById('editVenueAddress').value,
    state: document.getElementById('editVenueState').value,
    timezone: document.getElementById('editVenueTimezone').value,
    week_start: document.getElementById('editVenueWeekStart').value,
    contact_email: document.getElementById('editVenueEmail').value,
    first_name: document.getElementById('editAdminFirstName').value,
    middle_name: document.getElementById('editAdminMiddleName').value,
    last_name: document.getElementById('editAdminLastName').value,
    email: document.getElementById('editAdminEmail').value
  };

  try {
    const res = await fetch(`/api/master/venue-with-admin/${venue_code}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to update venue');
    }

    showToast('Venue and admin updated successfully!', 'success');

    // Close modal
    bootstrap.Modal.getInstance(document.getElementById('editVenueModal')).hide();

    // Clear cache and reload data
    dataCache.venues = null;
    dataCache.dashboard = null;
    loadVenues();
    loadDashboardStats();
  } catch (err) {
    console.error('Error updating venue:', err);
    showToast('Failed to update venue: ' + err.message, 'error');
  }
}

// ============================
// DELETE VENUE
// ============================
let venueToDelete = null;

function deleteVenue(venue_code, venue_name) {
  // Store venue info
  venueToDelete = venue_code;

  // Populate modal
  document.getElementById('deleteVenueCode').textContent = venue_code;
  document.getElementById('deleteVenueName').textContent = venue_name;

  // Show modal
  const modal = new bootstrap.Modal(document.getElementById('deleteVenueModal'));
  modal.show();
}

async function confirmDeleteVenue() {
  if (!venueToDelete) return;

  try {
    const res = await fetch(`/api/master/venue/${venueToDelete}`, {
      method: 'DELETE'
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Failed to delete venue');
    }

    showToast('Venue deleted successfully!', 'success');

    // Close modal
    bootstrap.Modal.getInstance(document.getElementById('deleteVenueModal')).hide();

    // Reset
    venueToDelete = null;

    // Clear cache and reload data
    dataCache.venues = null;
    dataCache.dashboard = null;
    loadVenues();
    loadDashboardStats();
  } catch (err) {
    console.error('Error deleting venue:', err);
    showToast('Failed to delete venue: ' + err.message, 'error');
  }
}

// ============================
// STAFF MANAGEMENT
// ============================

// Load venues for filter dropdown
async function loadVenuesForFilter() {
  try {
    const res = await fetch("/api/master/venues");
    const data = await res.json();
    const filterDropdown = document.getElementById('filterVenue');

    if (res.ok && data.success && data.data.length > 0) {
      filterDropdown.innerHTML = '<option value="all">All Venues</option>' +
        data.data.map(v =>
          `<option value="${v.venue_code}">${v.venue_name}</option>`
        ).join('');
    } else {
      filterDropdown.innerHTML = '<option value="all">All Venues</option>';
    }

    // Add event listener for filter change
    filterDropdown.addEventListener('change', applyStaffFilters);
  } catch (err) {
    console.error("Error loading venues for filter:", err);
  }
}

// Load staff with filters
async function loadStaff() {
  const venueFilter = document.getElementById('filterVenue').value;
  const statusFilter = document.getElementById('filterStatus').value;

  // Build query parameters
  const params = new URLSearchParams();
  if (venueFilter && venueFilter !== 'all') {
    params.append('venue_code', venueFilter);
  }
  if (statusFilter && statusFilter !== 'all') {
    params.append('status', statusFilter);
  }

  try {
    const res = await fetch(`/api/system-admin/staff?${params.toString()}`, {
      headers: {
        "user_access_level": "system_admin"
      }
    });
    const data = await res.json();
    const tableContent = document.querySelector('#staffList .table-content');

    if (res.ok && data.success && data.data.length > 0) {
      tableContent.innerHTML = `
        <table class="data-grid">
          <thead>
            <tr>
              <th>Full Name</th>
              <th>Venue</th>
              <th>Role</th>
              <th>Employment Status</th>
            </tr>
          </thead>
          <tbody>
            ${data.data.map(s => `
              <tr>
                <td><strong>${s.full_name}</strong></td>
                <td>${s.venue_name || 'N/A'}</td>
                <td>${s.role_title || 'N/A'}</td>
                <td><span class="badge ${s.employment_status === 'active' ? 'bg-success' : 'bg-secondary'}">${s.employment_status}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else {
      tableContent.innerHTML = '<p class="text-muted text-center py-4">No staff members found</p>';
    }
  } catch (err) {
    console.error("Error loading staff:", err);
    document.querySelector('#staffList .table-content').innerHTML = '<p class="text-muted text-center py-4">❌ Error loading staff</p>';
  }
}

// Apply filters when dropdown changes
function applyStaffFilters() {
  loadStaff();
}

// Setup filter event listeners
function setupStaffFilters() {
  const filterStatus = document.getElementById('filterStatus');
  if (filterStatus) {
    filterStatus.addEventListener('change', applyStaffFilters);
  }
}

// Show/Hide Staff Form
function showAddStaffForm() {
  document.getElementById('addStaffForm').style.display = 'block';
  // Load businesses and venues for dropdowns
  loadBusinessesForStaffForm();
}

function hideAddStaffForm() {
  document.getElementById('addStaffForm').style.display = 'none';
  document.getElementById('staffForm').reset();
}

// Load businesses for staff form
async function loadBusinessesForStaffForm() {
  try {
    const res = await fetch("/api/master/businesses");
    const data = await res.json();
    const dropdown = document.querySelector('#staffForm select[name="business_code"]');

    if (res.ok && data.success && data.data.length > 0) {
      dropdown.innerHTML = '<option value="">Select Business</option>' +
        data.data.map(b =>
          `<option value="${b.business_code}">${b.business_name}</option>`
        ).join('');

      // Add event listener to load venues when business is selected
      dropdown.addEventListener('change', loadVenuesForStaffForm);
    } else {
      dropdown.innerHTML = '<option value="">No businesses available</option>';
    }
  } catch (err) {
    console.error("Error loading businesses for staff form:", err);
  }
}

// Load venues for staff form based on selected business
async function loadVenuesForStaffForm() {
  const businessCode = document.querySelector('#staffForm select[name="business_code"]').value;
  const venueDropdown = document.querySelector('#staffForm select[name="venue_code"]');

  if (!businessCode) {
    venueDropdown.innerHTML = '<option value="">Select Venue</option>';
    return;
  }

  try {
    const res = await fetch("/api/master/venues");
    const data = await res.json();

    if (res.ok && data.success && data.data.length > 0) {
      // Filter venues by business_code (note: venues endpoint doesn't return business_code, so we'll show all for now)
      venueDropdown.innerHTML = '<option value="">Select Venue</option>' +
        data.data.map(v =>
          `<option value="${v.venue_code}">${v.venue_name}</option>`
        ).join('');
    } else {
      venueDropdown.innerHTML = '<option value="">No venues available</option>';
    }
  } catch (err) {
    console.error("Error loading venues for staff form:", err);
    venueDropdown.innerHTML = '<option value="">Error loading venues</option>';
  }
}

// Create staff member
async function createStaff(event) {
  event.preventDefault();
  const form = event.target;

  // Validate form
  const validationRules = {
    business_code: { validator: isRequired, message: 'Business is required' },
    venue_code: { validator: isRequired, message: 'Venue is required' },
    staff_code: { validator: isRequired, message: 'Staff code is required' },
    first_name: { validator: isRequired, message: 'First name is required' },
    last_name: { validator: isRequired, message: 'Last name is required' },
    email: { validator: isValidEmail, message: 'Valid email is required' },
    phone_number: { validator: isValidPhone, message: 'Valid phone number is required' },
    password: { validator: isStrongPassword, message: 'Password must be 8+ chars with uppercase, lowercase, and number' },
    access_level: { validator: isRequired, message: 'Access level is required' },
    role_title: { validator: isRequired, message: 'Role title is required' },
    employment_type: { validator: isRequired, message: 'Employment type is required' }
  };

  if (!validateForm(form, validationRules)) {
    showToast('Please fix the validation errors before submitting', 'error');
    return;
  }

  const payload = {
    // Staff Details
    business_code: form.business_code.value,
    venue_code: form.venue_code.value,
    staff_code: form.staff_code.value,
    first_name: form.first_name.value,
    middle_name: form.middle_name.value,
    last_name: form.last_name.value,
    email: form.email.value,
    phone_number: form.phone_number.value,
    password: form.password.value,
    access_level: form.access_level.value,
    role_title: form.role_title.value,
    employment_type: form.employment_type.value,
    // Pay Rates
    weekday_rate: form.weekday_rate.value || 0,
    saturday_rate: form.saturday_rate.value || 0,
    sunday_rate: form.sunday_rate.value || 0,
    public_holiday_rate: form.public_holiday_rate.value || 0,
    overtime_rate: form.overtime_rate.value || 0,
    default_hours: form.default_hours.value || 0
  };

  try {
    const res = await fetch("/api/system-admin/staff", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "user_access_level": "system_admin",
        "user_business_code": payload.business_code,
        "user_venue_code": payload.venue_code
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok || !data.success) throw new Error(data.error || "Failed to create staff member");

    showToast(`Staff member created successfully! Kiosk PIN: ${data.user.kiosk_pin}`, 'success');
    clearValidation(form);
    form.reset();
    hideAddStaffForm();

    // Clear cache and reload data
    dataCache.users = null;
    dataCache.dashboard = null;
    loadStaff();
    loadDashboardStats();
  } catch (err) {
    console.error("Staff creation error:", err);
    showToast("Failed to create staff member: " + err.message, 'error');
  }
}