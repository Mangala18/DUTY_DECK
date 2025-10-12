document.addEventListener("DOMContentLoaded", initializeKiosk);

function initializeKiosk() {
  // Check if kiosk is already logged in (full session)
  const kioskContext = JSON.parse(localStorage.getItem("kioskContext") || "{}");
  if (kioskContext.venue_code && kioskContext.business_code) {
    showKioskPanel();
    loadStaffGrid();
  } else {
    showLoginForm();
  }
}

function showLoginForm() {
  document.getElementById("kioskLogin").style.display = "block";
  document.getElementById("kioskPanel").style.display = "none";
  document.getElementById("venueName").textContent = "Kiosk Login Required";
}

function showKioskPanel() {
  document.getElementById("kioskLogin").style.display = "none";
  document.getElementById("kioskPanel").style.display = "block";
  document.getElementById("logoutBtn").style.display = "block";
}

async function kioskLogin() {
  const username = document.getElementById("kioskUsername").value.trim();
  const password = document.getElementById("kioskPassword").value.trim();
  const errorBox = document.getElementById("kioskLoginError");
  const passwordField = document.getElementById("kioskPassword");

  // Clear previous errors
  errorBox.innerHTML = "";

  if (!username || !password) {
    errorBox.innerHTML = `
      <div class="alert alert-warning" role="alert">
        ⚠️ Please enter both venue code and password
      </div>`;
    passwordField.focus();
    return;
  }

  try {
    const res = await fetch("/api/kiosk/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      // ❌ Show error
      errorBox.innerHTML = `
        <div class="alert alert-danger" role="alert">
          ❌ ${data.error || "Invalid login. Please try again."}
        </div>`;

      // 🔄 Reset + focus password
      passwordField.value = "";
      passwordField.focus();
      return;
    }

    // Success - Save session context
    localStorage.setItem("kioskContext", JSON.stringify({
      venue_code: data.venue_code,
      business_code: data.business_code,
      venue_name: data.venue_name,
      contact_email: data.contact_email
    }));

    // Clear form and errors
    document.getElementById("kioskUsername").value = "";
    passwordField.value = "";
    errorBox.innerHTML = "";

    // Show kiosk panel and load staff
    showKioskPanel();
    loadStaffGrid();

  } catch (err) {
    console.error("Error during kiosk login:", err);
    errorBox.innerHTML = `
      <div class="alert alert-danger" role="alert">
        ⚠️ Server error, please try again later.
      </div>`;
    passwordField.value = "";
    passwordField.focus(); // auto-focus for retry
  }
}

async function loadStaffGrid() {
  const ctx = JSON.parse(localStorage.getItem("kioskContext") || "{}");
  if (!ctx.venue_code || !ctx.business_code) {
    console.warn("No kiosk context found");
    showLoginForm();
    return;
  }

  // Show venue name in header
  document.getElementById("venueName").textContent = `Venue: ${ctx.venue_name || ctx.venue_code}`;

  try {
    const response = await fetch(`/api/kiosk/staff?business_code=${ctx.business_code}&venue_code=${ctx.venue_code}`);
    const result = await response.json();

    if (!result.success || !result.data) {
      throw new Error("Failed to load staff");
    }

    const activeStaff = result.data;

    const grid = document.getElementById("staffGrid");
    grid.innerHTML = activeStaff.map(s => `
      <div class="staff-card bg-white rounded-xl shadow-lg p-6 cursor-pointer transition-all duration-200 hover:shadow-2xl hover:-translate-y-1 hover:scale-105 flex flex-col items-center justify-center min-h-[140px] relative overflow-hidden border-t-4 border-blue-500" data-staff-code="${s.staff_code}" data-staff-name="${s.first_name} ${s.last_name}">
        <i class="bi bi-person-circle text-6xl text-blue-600 mb-2"></i>
        <div class="font-semibold text-lg text-slate-800 text-center">${s.first_name} ${s.last_name}</div>
      </div>
    `).join("");
  } catch (err) {
    console.error("Error loading staff:", err);
    document.getElementById("staffGrid").innerHTML = "<p class='text-danger'>Failed to load staff</p>";
  }
}

async function selectStaff(staffCode, staffName) {
  // Store staff info temporarily
  localStorage.setItem("tempStaffCode", staffCode);
  localStorage.setItem("tempStaffName", staffName);

  // Show PIN modal instead of going directly to clock section
  showPinModal(staffName);
}

function showPinModal(staffName) {
  const pinModal = document.getElementById("pinModal");
  const pinInput = document.getElementById("pinInput");
  const pinError = document.getElementById("pinError");
  const pinStaffName = document.getElementById("pinStaffName");

  pinStaffName.textContent = staffName;
  pinInput.value = "";
  pinError.classList.add("hidden");
  pinError.textContent = "";

  pinModal.classList.remove("hidden");
  setTimeout(() => pinInput.focus(), 100);
}

function hidePinModal() {
  document.getElementById("pinModal").classList.add("hidden");
  document.getElementById("pinInput").value = "";
  document.getElementById("pinError").classList.add("hidden");
}

async function validatePinAndProceed() {
  const pin = document.getElementById("pinInput").value.trim();
  const pinError = document.getElementById("pinError");
  const staffCode = localStorage.getItem("tempStaffCode");
  const staffName = localStorage.getItem("tempStaffName");

  // Validate PIN format (6 digits)
  if (!/^\d{6}$/.test(pin)) {
    pinError.textContent = "❌ Please enter a valid 6-digit PIN";
    pinError.classList.remove("hidden");
    document.getElementById("pinInput").value = "";
    document.getElementById("pinInput").focus();
    return;
  }

  try {
    // Validate PIN with backend
    const response = await fetch("/api/kiosk/validate-pin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ staff_code: staffCode, pin: pin })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      pinError.textContent = "❌ " + (data.error || "Invalid PIN. Please try again.");
      pinError.classList.remove("hidden");
      document.getElementById("pinInput").value = "";
      document.getElementById("pinInput").focus();
      return;
    }

    // PIN is valid - proceed to clock section
    hidePinModal();
    proceedToClockSection(staffCode, staffName);

  } catch (err) {
    console.error("Error validating PIN:", err);
    pinError.textContent = "⚠️ Connection error. Please try again.";
    pinError.classList.remove("hidden");
  }
}

async function proceedToClockSection(staffCode, staffName) {
  document.getElementById("staffGrid").classList.add("hidden");
  document.getElementById("clockSection").classList.remove("hidden");
  document.getElementById("selectedStaffName").textContent = staffName;
  localStorage.setItem("selectedStaffCode", staffCode);

  await refreshStatus(staffCode);
}

function backToStaffList() {
  document.getElementById("staffGrid").classList.remove("hidden");
  document.getElementById("clockSection").classList.add("hidden");
}

async function refreshStatus(staffCode) {
  const ctx = JSON.parse(localStorage.getItem("kioskContext") || "{}");
  try {
    const res = await fetch(`/api/kiosk/status/${staffCode}?venue_code=${ctx.venue_code}`);
    const data = await res.json();

    const statusEl = document.getElementById("statusDisplay");

    if (data.autoClosed) {
      statusEl.className = "alert alert-warning text-center";
      statusEl.textContent = `⚠️ Shift auto-closed after 8 hours (Clock-out at ${new Date(data.shift.clock_out).toLocaleTimeString()})`;
      document.getElementById("clockInBtn").disabled = false;
      document.getElementById("clockOutBtn").disabled = true;
      return;
    }

    if (data.active) {
      statusEl.className = "alert alert-success text-center";
      statusEl.textContent = `✅ Currently clocked in since ${new Date(data.clock_in).toLocaleTimeString()}`;
      document.getElementById("clockInBtn").disabled = true;
      document.getElementById("clockOutBtn").disabled = false;
    } else {
      statusEl.className = "alert alert-info text-center";
      statusEl.textContent = "Not clocked in";
      document.getElementById("clockInBtn").disabled = false;
      document.getElementById("clockOutBtn").disabled = true;
    }
  } catch (err) {
    console.error("Error fetching shift status:", err);
  }
}

async function clockIn() {
  const ctx = JSON.parse(localStorage.getItem("kioskContext") || "{}");
  const staffCode = localStorage.getItem("selectedStaffCode");
  const time = new Date().toISOString();

  try {
    const response = await fetch("/api/kiosk/clock-in", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        staff_code: staffCode,
        business_code: ctx.business_code,
        venue_code: ctx.venue_code,
        clock_in: time
      })
    });

    const data = await response.json();
    if (response.ok) {
      showMessage("✅ Clock-in successful!", "success");
      await refreshStatus(staffCode);
    } else {
      showMessage("❌ " + (data.error || "Clock-in failed"), "error");
    }
  } catch (err) {
    console.error("Clock-in error:", err);
    showMessage("⚠️ Connection error", "error");
  }
}

async function clockOut() {
  const staffCode = localStorage.getItem("selectedStaffCode");
  const time = new Date().toISOString();

  try {
    const response = await fetch("/api/kiosk/clock-out", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        staff_code: staffCode,
        clock_out: time
      })
    });

    const data = await response.json();
    if (response.ok && data.shift) {
      // Show shift summary
      showShiftSummary(data.shift);
      await refreshStatus(staffCode);
    } else if (response.ok) {
      showMessage("✅ Clock-out successful!", "success");
      await refreshStatus(staffCode);
    } else {
      showMessage("❌ " + (data.error || "Clock-out failed"), "error");
    }
  } catch (err) {
    console.error("Clock-out error:", err);
    showMessage("⚠️ Connection error", "error");
  }
}

function showShiftSummary(shift) {
  const startTime = new Date(shift.clock_in).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  const endTime = new Date(shift.clock_out).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

  // Build shift details
  let shiftDetails = `
    <div class="text-center">
      <h4>✅ Shift Ended</h4>
      <p><strong>Started:</strong> ${startTime}</p>
      <p><strong>Ended:</strong> ${endTime}</p>
      <p><strong>Duration:</strong> ${shift.hours_worked || shift.duration_hours} hours</p>
  `;

  // Add pay info if available
  if (shift.total_pay && shift.rate) {
    shiftDetails += `
      <p><strong>Rate:</strong> $${shift.rate}/hour</p>
      <p><strong>Total Pay:</strong> $${shift.total_pay}</p>
    `;

    // Add special rate indicators
    if (shift.is_holiday) {
      shiftDetails += `<p class="text-warning"><i class="bi bi-star"></i> Holiday Rate Applied</p>`;
    } else if (shift.is_weekend) {
      shiftDetails += `<p class="text-info"><i class="bi bi-calendar-week"></i> Weekend Rate Applied</p>`;
    }
  }

  shiftDetails += `</div>`;

  const msgEl = document.getElementById("message");
  msgEl.innerHTML = shiftDetails;
  msgEl.className = "alert mt-3 alert-success";
  msgEl.classList.remove("hidden");

  // Auto-return to staff list after 7 seconds (longer to show pay info)
  setTimeout(() => {
    backToStaffList();
    msgEl.classList.add("hidden");
  }, 7000);
}

function showMessage(text, type) {
  const msgEl = document.getElementById("message");
  msgEl.textContent = text;
  const bgColor = type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800";
  msgEl.className = `mt-4 px-6 py-4 rounded-xl font-semibold ${bgColor}`;
  msgEl.classList.remove("hidden");
}

function kioskLogout() {
  // Clear current session (staff grid access)
  localStorage.removeItem("kioskContext");

  // Hide logout button and show login form
  document.getElementById("logoutBtn").style.display = "none";
  document.getElementById("kioskPanel").style.display = "none";
  document.getElementById("kioskLogin").style.display = "block";

  // Reset password field and focus it
  const passwordField = document.getElementById("kioskPassword");
  passwordField.value = "";
  passwordField.focus();

  // Clear error messages
  document.getElementById("kioskLoginError").innerHTML = "";

  // Reset venue name in header
  document.getElementById("venueName").textContent = "Kiosk Login Required";

  // Keep venue remembered (username field stays pre-filled and readonly)
}

// Setup event listeners for kiosk functionality
function setupEventListeners() {
    // Kiosk login button
    const kioskLoginButton = document.getElementById("kioskLoginButton");
    if (kioskLoginButton) {
        kioskLoginButton.addEventListener("click", kioskLogin);
    }

    // Logout button
    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", kioskLogout);
    }

    // Back to staff list button
    const backToStaffListBtn = document.getElementById("backToStaffListBtn");
    if (backToStaffListBtn) {
        backToStaffListBtn.addEventListener("click", backToStaffList);
    }

    // Clock In button
    const clockInBtn = document.getElementById("clockInBtn");
    if (clockInBtn) {
        clockInBtn.addEventListener("click", clockIn);
    }

    // Clock Out button
    const clockOutBtn = document.getElementById("clockOutBtn");
    if (clockOutBtn) {
        clockOutBtn.addEventListener("click", clockOut);
    }

    // PIN modal submit button
    const pinSubmitBtn = document.getElementById("pinSubmitBtn");
    if (pinSubmitBtn) {
        pinSubmitBtn.addEventListener("click", validatePinAndProceed);
    }

    // PIN modal cancel button
    const pinCancelBtn = document.getElementById("pinCancelBtn");
    if (pinCancelBtn) {
        pinCancelBtn.addEventListener("click", hidePinModal);
    }

    // PIN input - submit on Enter key
    const pinInput = document.getElementById("pinInput");
    if (pinInput) {
        pinInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                validatePinAndProceed();
            }
        });

        // Only allow numeric input
        pinInput.addEventListener("input", (e) => {
            e.target.value = e.target.value.replace(/[^0-9]/g, "");
        });
    }

    // Staff card selection (event delegation)
    document.body.addEventListener("click", (e) => {
        const staffCard = e.target.closest(".staff-card");
        if (staffCard) {
            const staffCode = staffCard.dataset.staffCode;
            const staffName = staffCard.dataset.staffName;
            if (staffCode && staffName) {
                selectStaff(staffCode, staffName);
            }
        }
    });
}

// Initialize event listeners
setupEventListeners();