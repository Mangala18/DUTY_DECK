# Kiosk System Documentation

## Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Authentication Flow](#authentication-flow)
4. [Clock Operations](#clock-operations)
5. [Break Tracking](#break-tracking)
6. [Frontend Components](#frontend-components)
7. [Backend API Endpoints](#backend-api-endpoints)
8. [Database Schema](#database-schema)
9. [Offline Support](#offline-support)
10. [Development Guide](#development-guide)
11. [Troubleshooting](#troubleshooting)

---

## Overview

The **Kiosk System** is a touchscreen-friendly interface that allows staff members to:
- Clock in and clock out of shifts
- Take breaks and resume work
- View real-time shift status
- Work offline with automatic synchronization

### Key Features
- **Venue-based Authentication**: Kiosks login using venue credentials
- **PIN-based Staff Authentication**: Each staff member has a 6-digit PIN
- **Real-time Status Updates**: Staff cards show current shift state (Active, On Break, Inactive)
- **Offline Capabilities**: Actions queue when backend is unavailable and sync automatically
- **Automatic Pay Calculation**: Computes pay based on hours worked, breaks, and payday type
- **Break Tracking**: Tracks break duration and deducts from hours worked
- **Multi-venue Support**: System admins can clock in at any venue

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     KIOSK INTERFACE                          │
│  (frontend/kiosk.html + js/kiosk/index.js)                  │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ HTTP/REST API
                 │
┌────────────────┴────────────────────────────────────────────┐
│                  EXPRESS SERVER                              │
│  (backend/server.js)                                         │
│    ├── routes/kiosk.js (Clock operations)                   │
│    ├── utils/payCalculator.js (Pay logic)                   │
│    └── config/db.js (Database pool)                         │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ MySQL Connection Pool
                 │
┌────────────────┴────────────────────────────────────────────┐
│               MySQL DATABASE                                 │
│    ├── shifts (Clock in/out records)                        │
│    ├── staff (Employee data)                                │
│    ├── users (Authentication + PINs)                        │
│    ├── venues (Kiosk credentials)                           │
│    ├── pay_rates (Salary information)                       │
│    └── sync_log (Offline queue tracking)                    │
└──────────────────────────────────────────────────────────────┘
```

### File Structure
```
/home/vinny/clockin_mysql/
├── frontend/
│   ├── kiosk.html                    # Main kiosk UI
│   ├── js/kiosk/
│   │   ├── index.js                  # Main kiosk logic (ES6 module)
│   │   └── breaks.js                 # Break tracking module
│   └── css/
│       └── kiosk.css                 # Kiosk styling
│
└── backend/
    ├── routes/
    │   └── kiosk.js                  # Kiosk API endpoints (920 lines)
    ├── utils/
    │   ├── payCalculator.js          # Pay calculation logic
    │   └── cache.js                  # Staff list caching
    └── config/
        └── db.js                     # MySQL connection pool
```

---

## Authentication Flow

### 1. Venue Authentication (Kiosk Login)

**Endpoint**: `POST /api/kiosk/login`

**Frontend Code** ([kiosk.html:244](frontend/kiosk.html#L244)):
```javascript
// User enters venue email + kiosk password
const response = await fetch('/api/kiosk/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: venueEmail,    // e.g., "sydney@dutydeck.com"
    password: kioskPassword  // e.g., "kiosk123"
  })
});
```

**Backend Logic** ([backend/routes/kiosk.js:50](backend/routes/kiosk.js#L50)):
```javascript
// Validates credentials against venues table
const [venues] = await conn.execute(
  `SELECT venue_code, business_code, venue_name, timezone, contact_email
   FROM venues
   WHERE contact_email = ? AND kiosk_password = ? AND status = 'active'`,
  [username, password]
);

if (venues.length === 0) {
  return res.status(401).json({ error: 'Invalid credentials' });
}

// Store in localStorage as 'kioskContext'
localStorage.setItem('kioskContext', JSON.stringify({
  venue_code: 'VEN001',
  business_code: 'BUS001',
  venue_name: 'Sydney Office',
  timezone: 'Australia/Sydney'
}));
```

**Database Table**:
```sql
-- venues table stores kiosk login credentials
venues (
  venue_code VARCHAR(100) PRIMARY KEY,
  business_code VARCHAR(100),
  venue_name VARCHAR(150),
  contact_email VARCHAR(100) UNIQUE,  -- Kiosk login username
  kiosk_password VARCHAR(255),        -- Kiosk login password
  timezone VARCHAR(150),
  status ENUM('active', 'inactive')
)
```

---

### 2. Staff PIN Validation

**Endpoint**: `POST /api/kiosk/validate-pin`

**Frontend Code** ([js/kiosk/index.js](frontend/js/kiosk/index.js)):
```javascript
// User clicks staff card → PIN modal appears
// User enters 6-digit PIN → validate
const response = await fetch('/api/kiosk/validate-pin', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    staff_code: 'E001',
    pin: '123456',
    venue_code: kioskContext.venue_code
  })
});
```

**Backend Validation** ([backend/routes/kiosk.js:109](backend/routes/kiosk.js#L109)):
```javascript
// Check if PIN matches AND staff is assigned to venue OR is system admin
const [users] = await conn.execute(
  `SELECT u.*, s.first_name, s.last_name, s.venue_code
   FROM users u
   INNER JOIN staff s ON u.staff_code = s.staff_code
   WHERE u.staff_code = ?
     AND u.kiosk_pin = ?
     AND (s.venue_code = ? OR s.venue_code IS NULL)
     AND s.employment_status = 'active'`,
  [staff_code, pin, venue_code]
);

if (users.length === 0) {
  return res.status(401).json({ error: 'Invalid PIN or access denied' });
}
```

**Database Fields**:
```sql
-- users table stores PINs
users (
  staff_code VARCHAR(25) PRIMARY KEY,
  kiosk_pin CHAR(6),           -- 6-digit numeric PIN
  access_level ENUM(...)       -- 'system_admin' can clock in anywhere
)

-- staff table stores venue assignment
staff (
  staff_code VARCHAR(25) PRIMARY KEY,
  venue_code VARCHAR(100),     -- NULL = system admin (can access all venues)
  employment_status ENUM('active', 'inactive', 'terminated')
)
```

---

## Clock Operations

### 1. Clock In

**Endpoint**: `POST /api/kiosk/shift/:staff_code/clockin`

**Frontend Code**:
```javascript
const response = await fetch(`/api/kiosk/shift/E001/clockin`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    venue_code: kioskContext.venue_code  // 'VEN001'
  })
});
```

**Backend Logic** ([backend/routes/kiosk.js:372](backend/routes/kiosk.js#L372)):
```javascript
// Transaction with guard to prevent duplicate active shifts
await conn.beginTransaction();

// Check for existing active shift
const [existing] = await conn.execute(
  `SELECT id FROM shifts
   WHERE staff_code = ? AND shift_state IN ('ACTIVE', 'ON_BREAK')`,
  [staff_code]
);

if (existing.length > 0) {
  await conn.rollback();
  return res.status(409).json({
    error: 'Staff already has an active shift'
  });
}

// Insert new shift
await conn.execute(
  `INSERT INTO shifts (
    staff_code, venue_code, clock_in, shift_state,
    approval_status, last_action_time
  ) VALUES (?, ?, NOW(), 'ACTIVE', 'PENDING', NOW())`,
  [staff_code, venue_code]
);

await conn.commit();
```

**Database Record**:
```sql
-- shifts table after clock in
shifts (
  id: 42,
  staff_code: 'E001',
  venue_code: 'VEN001',
  clock_in: '2025-10-19 08:00:00',      -- NOW()
  clock_out: NULL,
  shift_state: 'ACTIVE',
  approval_status: 'PENDING',
  break_minutes: 0,
  hours_worked: NULL,                    -- Calculated on clock out
  applied_rate: NULL,
  total_pay: NULL,
  last_action_time: '2025-10-19 08:00:00'
)
```

---

### 2. Clock Out

**Endpoint**: `POST /api/kiosk/shift/:id/clockout`

**Frontend Code**:
```javascript
const response = await fetch(`/api/kiosk/shift/42/clockout`, {
  method: 'POST'
});
```

**Backend Logic** ([backend/routes/kiosk.js:480](backend/routes/kiosk.js#L480)):
```javascript
// Get shift details
const [shifts] = await conn.execute(
  `SELECT * FROM shifts WHERE id = ?`,
  [shift_id]
);

// Calculate hours worked (deduct break time)
const totalMinutes = differenceInMinutes(new Date(), new Date(shift.clock_in));
const workMinutes = totalMinutes - shift.break_minutes;
const hoursWorked = workMinutes / 60;

// Get pay rates for this staff member
const [rates] = await conn.execute(
  `SELECT * FROM pay_rates WHERE staff_code = ?`,
  [shift.staff_code]
);

// Determine payday type (weekday/saturday/sunday/public_holiday)
const paydayType = determinePaydayType(
  new Date(),
  shift.business_code
);

// Calculate pay
const { totalPay, appliedRate } = calculateShiftPay({
  hoursWorked,
  paydayType,
  rates: rates[0]
});

// Update shift record
await conn.execute(
  `UPDATE shifts
   SET clock_out = NOW(),
       shift_state = 'COMPLETED',
       hours_worked = ?,
       payday_type = ?,
       applied_rate = ?,
       total_pay = ?
   WHERE id = ?`,
  [hoursWorked, paydayType, appliedRate, totalPay, shift_id]
);
```

**Pay Calculation Logic** ([backend/utils/payCalculator.js](backend/utils/payCalculator.js)):
```javascript
function calculateShiftPay({ hoursWorked, paydayType, rates }) {
  const BASE_RATE = 25; // Fallback if no rate defined

  let appliedRate;
  switch (paydayType) {
    case 'WEEKDAY':
      appliedRate = rates?.weekday_rate || BASE_RATE;
      break;
    case 'SATURDAY':
      appliedRate = rates?.saturday_rate || BASE_RATE;
      break;
    case 'SUNDAY':
      appliedRate = rates?.sunday_rate || BASE_RATE;
      break;
    case 'PUBLIC_HOLIDAY':
      appliedRate = rates?.public_holiday_rate || BASE_RATE;
      break;
  }

  const totalPay = hoursWorked * appliedRate;
  return { totalPay, appliedRate };
}
```

**Database Record After Clock Out**:
```sql
shifts (
  id: 42,
  clock_in: '2025-10-19 08:00:00',
  clock_out: '2025-10-19 17:30:00',       -- NOW()
  shift_state: 'COMPLETED',
  break_minutes: 60,                      -- 1 hour break
  hours_worked: 8.50,                     -- 9.5 hours - 1 hour break
  payday_type: 'WEEKDAY',
  applied_rate: 25.00,
  total_pay: 212.50                       -- 8.5 * 25
)
```

---

## Break Tracking

### 1. Start Break

**Endpoint**: `POST /api/kiosk/shift/:id/breakin`

**Frontend Code**:
```javascript
const response = await fetch(`/api/kiosk/shift/42/breakin`, {
  method: 'POST'
});
```

**Backend Logic** ([backend/routes/kiosk.js:560](backend/routes/kiosk.js#L560)):
```javascript
// Validate shift is ACTIVE
const [shifts] = await conn.execute(
  `SELECT * FROM shifts WHERE id = ? AND shift_state = 'ACTIVE'`,
  [shift_id]
);

if (shifts.length === 0) {
  return res.status(400).json({
    error: 'Shift must be ACTIVE to start break'
  });
}

// Update to ON_BREAK state
await conn.execute(
  `UPDATE shifts
   SET shift_state = 'ON_BREAK',
       last_action_time = NOW()
   WHERE id = ?`,
  [shift_id]
);
```

**State Transition**:
```
ACTIVE → ON_BREAK
```

---

### 2. End Break

**Endpoint**: `POST /api/kiosk/shift/:id/breakout`

**Frontend Code**:
```javascript
const response = await fetch(`/api/kiosk/shift/42/breakout`, {
  method: 'POST'
});
```

**Backend Logic** ([backend/routes/kiosk.js:615](backend/routes/kiosk.js#L615)):
```javascript
// Validate shift is ON_BREAK
const [shifts] = await conn.execute(
  `SELECT * FROM shifts
   WHERE id = ? AND shift_state = 'ON_BREAK'`,
  [shift_id]
);

// Calculate break duration
const breakStart = new Date(shift.last_action_time);
const breakEnd = new Date();
const breakMinutes = differenceInMinutes(breakEnd, breakStart);

// Accumulate break time
await conn.execute(
  `UPDATE shifts
   SET shift_state = 'ACTIVE',
       break_minutes = break_minutes + ?,
       last_action_time = NOW()
   WHERE id = ?`,
  [breakMinutes, shift_id]
);
```

**State Transition**:
```
ON_BREAK → ACTIVE
```

**Break Accumulation Example**:
```
Initial:     break_minutes = 0
Break 1:     15 minutes → break_minutes = 15
Break 2:     30 minutes → break_minutes = 45
Break 3:     15 minutes → break_minutes = 60
Clock Out:   hours_worked = (total_time - 60) / 60
```

---

## Frontend Components

### 1. Staff Grid ([kiosk.html:254](frontend/kiosk.html#L254))

**HTML Structure**:
```html
<div id="staffGrid" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
  <!-- Dynamically generated staff cards -->
</div>
```

**JavaScript Generation** ([js/kiosk/index.js](frontend/js/kiosk/index.js)):
```javascript
// Load staff from API
const response = await fetch(`/api/kiosk/staff?venue_code=${venueCode}`);
const staff = await response.json();

// Generate card for each staff member
staff.forEach(member => {
  const card = `
    <div class="staff-card status-${member.status}" data-staff-code="${member.staff_code}">
      <div class="status-badge ${member.status}"></div>
      <div class="p-4">
        <div class="font-bold text-lg">${member.first_name} ${member.last_name}</div>
        <div class="text-sm text-gray-600">${member.staff_code}</div>
      </div>
      ${member.status !== 'idle' ? `
        <div class="time-overlay">
          ${member.status === 'active' ? 'Active since' : 'On break since'} ${member.time}
        </div>
      ` : ''}
    </div>
  `;
  staffGrid.innerHTML += card;
});
```

**CSS Classes** ([kiosk.html:34-58](frontend/kiosk.html#L34-L58)):
```css
/* Green border + glow for active staff */
.staff-card.status-active {
  border: 3px solid transparent;
  background-image: linear-gradient(white, white),
    linear-gradient(135deg, #4ade80, #16a34a, #15803d);
  box-shadow: 0 0 20px rgba(22, 163, 74, 0.4);
  animation: pulseGreen 2s ease-in-out infinite;
}

/* Orange border + glow for staff on break */
.staff-card.status-break {
  border: 3px solid transparent;
  background-image: linear-gradient(white, white),
    linear-gradient(135deg, #fb923c, #f97316, #ea580c);
  box-shadow: 0 0 20px rgba(249, 115, 22, 0.4);
  animation: pulseOrange 3s ease-in-out infinite;
}

/* Gray border for inactive staff */
.staff-card.status-idle {
  border: 2px solid #d1d5db;
}
```

---

### 2. PIN Modal ([kiosk.html:273-307](frontend/kiosk.html#L273-L307))

**HTML Structure**:
```html
<div id="pinModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
  <div class="bg-white rounded-2xl p-8">
    <h3>Enter Your PIN</h3>
    <p id="pinStaffName">John Doe</p>

    <input
      type="password"
      id="pinInput"
      maxlength="6"
      pattern="[0-9]{6}"
      placeholder="Enter 6-digit PIN"
      inputmode="numeric">

    <div id="pinError" class="hidden"></div>

    <button id="pinCancelBtn">Cancel</button>
    <button id="pinSubmitBtn">Submit</button>
  </div>
</div>
```

**JavaScript Logic**:
```javascript
// Show modal when staff card clicked
document.addEventListener('click', (e) => {
  if (e.target.closest('.staff-card')) {
    const staffCode = e.target.closest('.staff-card').dataset.staffCode;
    showPinModal(staffCode);
  }
});

function showPinModal(staffCode) {
  currentStaffCode = staffCode;
  pinModal.classList.remove('hidden');
  pinInput.focus();
}

// Validate PIN on submit
async function validatePin() {
  const pin = pinInput.value;

  if (!/^\d{6}$/.test(pin)) {
    showError('PIN must be 6 digits');
    return;
  }

  const response = await fetch('/api/kiosk/validate-pin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      staff_code: currentStaffCode,
      pin: pin,
      venue_code: kioskContext.venue_code
    })
  });

  if (response.ok) {
    pinModal.classList.add('hidden');
    showClockSection(currentStaffCode);
  } else {
    showError('Invalid PIN');
  }
}
```

---

### 3. Clock Section ([kiosk.html:310-351](frontend/kiosk.html#L310-L351))

**HTML Structure**:
```html
<div id="clockSection" class="bg-white rounded-2xl shadow-2xl">
  <div class="bg-blue-600 text-white px-6 py-4">
    <h5 id="selectedStaffName">John Doe</h5>
    <button id="backToStaffListBtn">Back</button>
  </div>

  <div class="p-6">
    <div id="statusDisplay">Loading status...</div>

    <button id="clockInBtn">Clock In</button>
    <button id="clockOutBtn">Clock Out</button>
    <button id="breakInBtn">Start Break</button>
    <button id="breakOutBtn">End Break</button>

    <div id="message"></div>
  </div>
</div>
```

**Button State Logic**:
```javascript
async function updateButtonStates(staffCode) {
  // Get current shift status
  const response = await fetch(`/api/kiosk/status/${staffCode}`);
  const status = await response.json();

  if (status.shift_state === 'NONE') {
    // Not clocked in
    clockInBtn.disabled = false;
    clockOutBtn.disabled = true;
    breakInBtn.disabled = true;
    breakOutBtn.disabled = true;
    statusDisplay.textContent = 'Not Clocked In';

  } else if (status.shift_state === 'ACTIVE') {
    // Clocked in and working
    clockInBtn.disabled = true;
    clockOutBtn.disabled = false;
    breakInBtn.disabled = false;
    breakOutBtn.disabled = true;
    statusDisplay.textContent = `Clocked in at ${status.clock_in}`;

  } else if (status.shift_state === 'ON_BREAK') {
    // On break
    clockInBtn.disabled = true;
    clockOutBtn.disabled = true;
    breakInBtn.disabled = true;
    breakOutBtn.disabled = false;
    statusDisplay.textContent = `On break since ${status.last_action_time}`;
  }
}
```

---

### 4. Status Polling ([js/kiosk/index.js](frontend/js/kiosk/index.js))

**Real-time Updates**:
```javascript
// Poll status every 5 seconds
setInterval(async () => {
  const venueCode = kioskContext.venue_code;

  // Batch status query (more efficient than individual queries)
  const response = await fetch(`/api/kiosk/status/venue/${venueCode}`);
  const statuses = await response.json();

  // Update each staff card
  statuses.forEach(status => {
    const card = document.querySelector(`[data-staff-code="${status.staff_code}"]`);
    if (card) {
      // Update visual state
      card.className = `staff-card status-${status.shift_state.toLowerCase()}`;

      // Update time overlay
      if (status.shift_state !== 'NONE') {
        card.querySelector('.time-overlay').textContent =
          `${status.shift_state === 'ACTIVE' ? 'Active' : 'On break'} since ${status.time}`;
      }
    }
  });
}, 5000);
```

---

## Backend API Endpoints

### Kiosk Endpoints (No Auth Required)

| Endpoint | Method | Description | Request Body | Response |
|----------|--------|-------------|--------------|----------|
| `/api/kiosk/login` | POST | Venue login | `{ username, password }` | `{ venue_code, venue_name, timezone }` |
| `/api/kiosk/validate-pin` | POST | Staff PIN validation | `{ staff_code, pin, venue_code }` | `{ valid: true, staff }` |
| `/api/kiosk/staff` | GET | List staff at venue | Query: `venue_code` | `[ { staff_code, first_name, last_name, ... } ]` |
| `/api/kiosk/status/venue/:venue_code` | GET | Batch status for all staff | - | `[ { staff_code, shift_state, clock_in, ... } ]` |
| `/api/kiosk/status/:staff_code` | GET | Individual staff status | - | `{ shift_state, clock_in, shift_id, ... }` |
| `/api/kiosk/shift/:staff_code/clockin` | POST | Clock in | `{ venue_code }` | `{ success: true, shift_id }` |
| `/api/kiosk/shift/:id/clockout` | POST | Clock out | - | `{ success: true, shift: { hours_worked, total_pay, ... } }` |
| `/api/kiosk/shift/:id/breakin` | POST | Start break | - | `{ success: true }` |
| `/api/kiosk/shift/:id/breakout` | POST | End break | - | `{ success: true, break_minutes }` |
| `/api/kiosk/sync` | POST | Bulk offline sync | `{ actions: [ ... ] }` | `{ synced: 5, duplicates: 2, failed: 0 }` |
| `/api/kiosk/health` | GET | System health check | - | `{ status: 'healthy', timestamp }` |

---

### Backend Implementation ([backend/routes/kiosk.js](backend/routes/kiosk.js))

**Key Features**:
- **Transaction Guards**: Prevents duplicate active shifts
- **Caching**: Staff list cached for 30 minutes (reduces DB load)
- **Batch Queries**: Single query for all staff status (performance optimization)
- **Idempotency**: Offline sync uses UUIDs to prevent duplicates
- **Error Handling**: Comprehensive error messages and rollback on failures

**Example: Clock In Endpoint**:
```javascript
router.post('/shift/:staff_code/clockin', async (req, res) => {
  const { staff_code } = req.params;
  const { venue_code } = req.body;

  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    // Guard: Check for existing active shift
    const [existing] = await conn.execute(
      `SELECT id FROM shifts
       WHERE staff_code = ? AND shift_state IN ('ACTIVE', 'ON_BREAK')`,
      [staff_code]
    );

    if (existing.length > 0) {
      await conn.rollback();
      return res.status(409).json({
        error: 'Staff already has an active shift',
        shift_id: existing[0].id
      });
    }

    // Insert new shift
    const [result] = await conn.execute(
      `INSERT INTO shifts (
        staff_code, venue_code, clock_in, shift_state,
        approval_status, last_action_time
      ) VALUES (?, ?, NOW(), 'ACTIVE', 'PENDING', NOW())`,
      [staff_code, venue_code]
    );

    await conn.commit();

    res.json({
      success: true,
      shift_id: result.insertId,
      message: 'Clocked in successfully'
    });

  } catch (error) {
    if (conn) await conn.rollback();
    console.error('Clock in error:', error);
    res.status(500).json({ error: 'Failed to clock in' });
  } finally {
    if (conn) conn.release();
  }
});
```

---

## Database Schema

### Core Tables

#### 1. shifts
```sql
CREATE TABLE shifts (
  id INT PRIMARY KEY AUTO_INCREMENT,
  staff_code VARCHAR(25) NOT NULL,
  venue_code VARCHAR(100) NOT NULL,
  clock_in TIMESTAMP NOT NULL,
  clock_out TIMESTAMP NULL,
  shift_state ENUM('NONE','ACTIVE','ON_BREAK','COMPLETED') DEFAULT 'NONE',
  approval_status ENUM('PENDING','APPROVED','DISCARDED') DEFAULT 'PENDING',
  payday_type ENUM('WEEKDAY','SATURDAY','SUNDAY','PUBLIC_HOLIDAY'),
  break_minutes INT DEFAULT 0,
  hours_worked DECIMAL(6,2),
  applied_rate DECIMAL(10,2),
  total_pay DECIMAL(12,2),
  last_action_time TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_staff_state (staff_code, shift_state),
  INDEX idx_venue_state (venue_code, shift_state),

  FOREIGN KEY (staff_code) REFERENCES staff(staff_code),
  FOREIGN KEY (venue_code) REFERENCES venues(venue_code)
);
```

**Key Fields**:
- `shift_state`: Tracks current state (NONE → ACTIVE → ON_BREAK → ACTIVE → COMPLETED)
- `break_minutes`: Accumulated break time (deducted from hours_worked)
- `last_action_time`: Timestamp of last state change (used for break duration)
- `payday_type`: Determines which rate to apply (WEEKDAY/SATURDAY/SUNDAY/PUBLIC_HOLIDAY)

---

#### 2. staff
```sql
CREATE TABLE staff (
  staff_code VARCHAR(25) PRIMARY KEY,
  business_code VARCHAR(100),
  venue_code VARCHAR(100),              -- NULL = system admin (access all venues)
  first_name VARCHAR(50),
  last_name VARCHAR(50),
  employment_status ENUM('active','inactive','terminated') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_venue (venue_code),

  FOREIGN KEY (business_code) REFERENCES businesses(business_code),
  FOREIGN KEY (venue_code) REFERENCES venues(venue_code)
);
```

---

#### 3. users
```sql
CREATE TABLE users (
  staff_code VARCHAR(25) PRIMARY KEY,
  email VARCHAR(100) UNIQUE,
  password VARCHAR(255),
  kiosk_pin CHAR(6),                    -- 6-digit numeric PIN for kiosk
  access_level ENUM('system_admin','manager','supervisor','employee'),

  FOREIGN KEY (staff_code) REFERENCES staff(staff_code)
);
```

---

#### 4. venues
```sql
CREATE TABLE venues (
  venue_code VARCHAR(100) PRIMARY KEY,
  business_code VARCHAR(100),
  venue_name VARCHAR(150),
  contact_email VARCHAR(100) UNIQUE,    -- Kiosk login username
  kiosk_password VARCHAR(255),          -- Kiosk login password
  timezone VARCHAR(150),
  state VARCHAR(50),
  status ENUM('active','inactive') DEFAULT 'active',

  FOREIGN KEY (business_code) REFERENCES businesses(business_code)
);
```

---

#### 5. pay_rates
```sql
CREATE TABLE pay_rates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  staff_code VARCHAR(25) UNIQUE,
  weekday_rate DECIMAL(10,2),
  saturday_rate DECIMAL(10,2),
  sunday_rate DECIMAL(10,2),
  public_holiday_rate DECIMAL(10,2),
  overtime_rate DECIMAL(10,2),
  default_hours DECIMAL(5,2),

  FOREIGN KEY (staff_code) REFERENCES staff(staff_code)
);
```

---

#### 6. sync_log (Offline Support)
```sql
CREATE TABLE sync_log (
  id INT PRIMARY KEY AUTO_INCREMENT,
  offline_id VARCHAR(64) UNIQUE,        -- UUID for idempotency
  staff_code VARCHAR(50),
  type ENUM('clockin','clockout','breakin','breakout'),
  timestamp TIMESTAMP,
  status ENUM('synced','duplicate','failed'),
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_offline_id (offline_id)
);
```

---

### Database Relationships

```
businesses
  └── venues
        ├── staff (venue assignment)
        └── shifts (location tracking)

staff
  ├── users (authentication)
  ├── pay_rates (compensation)
  └── shifts (work records)

shifts
  └── sync_log (offline tracking)
```

---

## Offline Support

### Architecture

**Problem**: Kiosk may lose backend connectivity (network issues, server maintenance)

**Solution**: Queue actions locally, sync when backend is restored

**Components**:
1. **Health Checks**: Ping `/api/kiosk/health` every 10 seconds
2. **Local Queue**: Store actions in `localStorage` with UUIDs
3. **Sync Mechanism**: Batch upload queued actions when backend is online
4. **Idempotency**: Server rejects duplicate UUIDs (prevents double-clocking)

---

### Frontend Implementation ([js/kiosk/breaks.js](frontend/js/kiosk/breaks.js))

**Health Check**:
```javascript
let isOnline = true;

setInterval(async () => {
  try {
    const response = await fetch('/api/kiosk/health', { timeout: 5000 });
    if (response.ok) {
      isOnline = true;
      document.getElementById('systemStatus').textContent = 'Online';
      document.getElementById('offlineBanner').style.display = 'none';

      // Trigger sync if there are queued actions
      await syncQueuedActions();
    }
  } catch (error) {
    isOnline = false;
    document.getElementById('systemStatus').textContent = 'Offline';
    document.getElementById('offlineBanner').style.display = 'block';
  }
}, 10000);
```

**Queue Action**:
```javascript
function queueAction(type, staffCode, shiftId = null) {
  const queue = JSON.parse(localStorage.getItem('actionQueue') || '[]');

  const action = {
    offline_id: generateUUID(),
    type: type,                    // 'clockin', 'clockout', 'breakin', 'breakout'
    staff_code: staffCode,
    shift_id: shiftId,
    timestamp: new Date().toISOString(),
    venue_code: kioskContext.venue_code
  };

  queue.push(action);
  localStorage.setItem('actionQueue', JSON.stringify(queue));

  console.log('Action queued:', action);
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
```

**Sync Queued Actions**:
```javascript
async function syncQueuedActions() {
  const queue = JSON.parse(localStorage.getItem('actionQueue') || '[]');

  if (queue.length === 0) return;

  document.getElementById('systemStatus').textContent = 'Syncing...';

  try {
    const response = await fetch('/api/kiosk/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ actions: queue })
    });

    const result = await response.json();

    console.log('Sync result:', result);
    // result = { synced: 5, duplicates: 2, failed: 0, errors: [] }

    // Clear queue
    localStorage.setItem('actionQueue', '[]');

    document.getElementById('systemStatus').textContent = 'Online';

  } catch (error) {
    console.error('Sync failed:', error);
  }
}
```

---

### Backend Sync Endpoint ([backend/routes/kiosk.js:750](backend/routes/kiosk.js#L750))

```javascript
router.post('/sync', async (req, res) => {
  const { actions } = req.body;

  const results = {
    synced: 0,
    duplicates: 0,
    failed: 0,
    errors: []
  };

  for (const action of actions) {
    try {
      // Check if already synced (idempotency)
      const [existing] = await pool.execute(
        `SELECT * FROM sync_log WHERE offline_id = ?`,
        [action.offline_id]
      );

      if (existing.length > 0) {
        results.duplicates++;
        continue;
      }

      // Process action based on type
      if (action.type === 'clockin') {
        await clockIn(action.staff_code, action.venue_code);
      } else if (action.type === 'clockout') {
        await clockOut(action.shift_id);
      } else if (action.type === 'breakin') {
        await startBreak(action.shift_id);
      } else if (action.type === 'breakout') {
        await endBreak(action.shift_id);
      }

      // Log successful sync
      await pool.execute(
        `INSERT INTO sync_log (offline_id, staff_code, type, timestamp, status)
         VALUES (?, ?, ?, ?, 'synced')`,
        [action.offline_id, action.staff_code, action.type, action.timestamp]
      );

      results.synced++;

    } catch (error) {
      // Log failed sync
      await pool.execute(
        `INSERT INTO sync_log (offline_id, staff_code, type, timestamp, status, error_message)
         VALUES (?, ?, ?, ?, 'failed', ?)`,
        [action.offline_id, action.staff_code, action.type, action.timestamp, error.message]
      );

      results.failed++;
      results.errors.push({
        offline_id: action.offline_id,
        error: error.message
      });
    }
  }

  res.json(results);
});
```

---

## Development Guide

### Setting Up the Kiosk

#### 1. Create a Venue with Kiosk Credentials

```sql
-- Insert venue with kiosk login credentials
INSERT INTO venues (
  venue_code, business_code, venue_name,
  contact_email, kiosk_password,
  timezone, state, status
) VALUES (
  'VEN001', 'BUS001', 'Sydney Office',
  'sydney@dutydeck.com', 'kiosk123',
  'Australia/Sydney', 'NSW', 'active'
);
```

---

#### 2. Create Staff Members

```sql
-- Insert staff member
INSERT INTO staff (
  staff_code, business_code, venue_code,
  first_name, last_name, employment_status
) VALUES (
  'E001', 'BUS001', 'VEN001',
  'John', 'Doe', 'active'
);

-- Create user account with kiosk PIN
INSERT INTO users (
  staff_code, email, password, kiosk_pin, access_level
) VALUES (
  'E001', 'john@dutydeck.com', 'password123', '123456', 'employee'
);

-- Set pay rates
INSERT INTO pay_rates (
  staff_code, weekday_rate, saturday_rate, sunday_rate, public_holiday_rate
) VALUES (
  'E001', 25.00, 30.00, 35.00, 50.00
);
```

---

#### 3. Access the Kiosk

1. **Open Browser**: Navigate to `http://localhost:3000/frontend/kiosk.html`
2. **Login**:
   - Email: `sydney@dutydeck.com`
   - Password: `kiosk123`
3. **Select Staff**: Click on "John Doe" card
4. **Enter PIN**: `123456`
5. **Clock In**: Click "Clock In" button

---

### Testing Clock Operations

#### Manual Test Flow

```bash
# 1. Clock in
curl -X POST http://localhost:3000/api/kiosk/shift/E001/clockin \
  -H "Content-Type: application/json" \
  -d '{"venue_code":"VEN001"}'

# Response: { "success": true, "shift_id": 42 }

# 2. Check status
curl http://localhost:3000/api/kiosk/status/E001

# Response: { "shift_state": "ACTIVE", "clock_in": "2025-10-19T08:00:00Z", ... }

# 3. Start break
curl -X POST http://localhost:3000/api/kiosk/shift/42/breakin

# 4. End break (after 30 minutes)
curl -X POST http://localhost:3000/api/kiosk/shift/42/breakout

# Response: { "success": true, "break_minutes": 30 }

# 5. Clock out
curl -X POST http://localhost:3000/api/kiosk/shift/42/clockout

# Response: {
#   "success": true,
#   "shift": {
#     "hours_worked": 8.5,
#     "break_minutes": 30,
#     "payday_type": "WEEKDAY",
#     "applied_rate": 25.00,
#     "total_pay": 212.50
#   }
# }
```

---

### Automated Tests

**Database Query Tests**:
```sql
-- Test: Check for active shifts
SELECT * FROM shifts
WHERE staff_code = 'E001'
  AND shift_state IN ('ACTIVE', 'ON_BREAK');

-- Test: Calculate hours worked
SELECT
  id,
  staff_code,
  clock_in,
  clock_out,
  break_minutes,
  TIMESTAMPDIFF(MINUTE, clock_in, clock_out) AS total_minutes,
  (TIMESTAMPDIFF(MINUTE, clock_in, clock_out) - break_minutes) / 60 AS hours_worked
FROM shifts
WHERE id = 42;

-- Test: Verify pay calculation
SELECT
  s.id,
  s.staff_code,
  s.hours_worked,
  s.payday_type,
  p.weekday_rate,
  p.saturday_rate,
  p.sunday_rate,
  p.public_holiday_rate,
  s.applied_rate,
  s.total_pay,
  (s.hours_worked * s.applied_rate) AS calculated_pay
FROM shifts s
LEFT JOIN pay_rates p ON s.staff_code = p.staff_code
WHERE s.id = 42;
```

---

### Common Customizations

#### 1. Change Status Polling Interval

**File**: [js/kiosk/index.js](frontend/js/kiosk/index.js)

```javascript
// Current: Poll every 5 seconds
setInterval(updateStatuses, 5000);

// Change to 10 seconds
setInterval(updateStatuses, 10000);
```

---

#### 2. Add Custom Staff Card Fields

**Frontend** ([js/kiosk/index.js](frontend/js/kiosk/index.js)):
```javascript
const card = `
  <div class="staff-card" data-staff-code="${member.staff_code}">
    <div class="p-4">
      <div class="font-bold">${member.first_name} ${member.last_name}</div>
      <div class="text-sm">${member.staff_code}</div>

      <!-- ADD CUSTOM FIELD -->
      <div class="text-xs text-gray-500">${member.department}</div>
    </div>
  </div>
`;
```

**Backend** ([backend/routes/kiosk.js](backend/routes/kiosk.js)):
```javascript
// Modify staff query to include department
const [staff] = await conn.execute(
  `SELECT
    staff_code, first_name, last_name,
    department  -- ADD THIS
   FROM staff
   WHERE venue_code = ? AND employment_status = 'active'`,
  [venue_code]
);
```

---

#### 3. Customize Pay Calculation Logic

**File**: [backend/utils/payCalculator.js](backend/utils/payCalculator.js)

```javascript
// Current logic
function calculateShiftPay({ hoursWorked, paydayType, rates }) {
  const BASE_RATE = 25;
  let appliedRate = rates?.weekday_rate || BASE_RATE;

  // ADD OVERTIME LOGIC
  let totalPay;
  if (hoursWorked > 8) {
    const regularPay = 8 * appliedRate;
    const overtimeHours = hoursWorked - 8;
    const overtimePay = overtimeHours * (rates?.overtime_rate || appliedRate * 1.5);
    totalPay = regularPay + overtimePay;
  } else {
    totalPay = hoursWorked * appliedRate;
  }

  return { totalPay, appliedRate };
}
```

---

#### 4. Add Break Limits

**Backend** ([backend/routes/kiosk.js](backend/routes/kiosk.js)):
```javascript
router.post('/shift/:id/breakout', async (req, res) => {
  // ... existing code ...

  const breakMinutes = differenceInMinutes(new Date(), new Date(shift.last_action_time));
  const totalBreakMinutes = shift.break_minutes + breakMinutes;

  // ADD BREAK LIMIT CHECK
  const MAX_BREAK_MINUTES = 60; // 1 hour max
  if (totalBreakMinutes > MAX_BREAK_MINUTES) {
    return res.status(400).json({
      error: `Total break time cannot exceed ${MAX_BREAK_MINUTES} minutes`
    });
  }

  // ... rest of code ...
});
```

---

## Troubleshooting

### Common Issues

#### 1. "Invalid credentials" on Kiosk Login

**Symptoms**: Login fails with 401 error

**Causes**:
- Incorrect email or password
- Venue status is 'inactive'
- Email/password fields are case-sensitive

**Solution**:
```sql
-- Check venue credentials
SELECT venue_code, contact_email, kiosk_password, status
FROM venues
WHERE contact_email = 'sydney@dutydeck.com';

-- Update if needed
UPDATE venues
SET kiosk_password = 'kiosk123', status = 'active'
WHERE contact_email = 'sydney@dutydeck.com';
```

---

#### 2. "Invalid PIN" Error

**Symptoms**: PIN validation fails

**Causes**:
- PIN doesn't match `users.kiosk_pin`
- Staff not assigned to venue (and not system admin)
- Staff employment_status is 'inactive'

**Solution**:
```sql
-- Check PIN and venue assignment
SELECT
  u.staff_code,
  u.kiosk_pin,
  s.venue_code,
  s.employment_status
FROM users u
INNER JOIN staff s ON u.staff_code = s.staff_code
WHERE u.staff_code = 'E001';

-- Update PIN
UPDATE users
SET kiosk_pin = '123456'
WHERE staff_code = 'E001';

-- Activate staff
UPDATE staff
SET employment_status = 'active'
WHERE staff_code = 'E001';
```

---

#### 3. "Staff already has an active shift" (409 Conflict)

**Symptoms**: Cannot clock in because existing shift is still active

**Causes**:
- Previous shift was not clocked out
- Shift state is stuck in 'ACTIVE' or 'ON_BREAK'

**Solution**:
```sql
-- Find active shift
SELECT * FROM shifts
WHERE staff_code = 'E001'
  AND shift_state IN ('ACTIVE', 'ON_BREAK');

-- Option 1: Clock out manually
UPDATE shifts
SET
  clock_out = NOW(),
  shift_state = 'COMPLETED',
  hours_worked = TIMESTAMPDIFF(MINUTE, clock_in, NOW()) / 60
WHERE id = 42;

-- Option 2: Use auto-close monitor (closes shifts >10 hours old)
-- This runs automatically every 15 minutes
```

---

#### 4. Pay Calculation is $0.00

**Symptoms**: `total_pay` is 0 or NULL after clock out

**Causes**:
- No pay_rates record for staff member
- All rate fields are NULL
- hours_worked is 0

**Solution**:
```sql
-- Check pay rates
SELECT * FROM pay_rates
WHERE staff_code = 'E001';

-- Insert if missing (uses $25 base rate)
INSERT INTO pay_rates (staff_code, weekday_rate, saturday_rate, sunday_rate, public_holiday_rate)
VALUES ('E001', 25.00, 30.00, 35.00, 50.00);

-- Or system will use $25 fallback automatically
```

---

#### 5. Staff Cards Not Updating (Stale Status)

**Symptoms**: Staff card shows "Inactive" even though they clocked in

**Causes**:
- Status polling is paused
- JavaScript error preventing updates
- Backend is offline

**Solution**:
1. **Check Browser Console**: Look for JavaScript errors
2. **Check System Status Indicator**: Should say "Online"
3. **Verify Backend**: `curl http://localhost:3000/api/kiosk/health`
4. **Force Refresh**: Reload the page

---

#### 6. Offline Sync Not Working

**Symptoms**: Actions stay queued even when backend is online

**Causes**:
- Health check endpoint is failing
- Sync endpoint has errors
- localStorage is full

**Debug Steps**:
```javascript
// Check localStorage queue
console.log(localStorage.getItem('actionQueue'));

// Manually trigger sync
await syncQueuedActions();

// Check sync results
const queue = JSON.parse(localStorage.getItem('actionQueue') || '[]');
const response = await fetch('/api/kiosk/sync', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ actions: queue })
});
const result = await response.json();
console.log(result);
```

---

#### 7. Break Time Not Deducted from Hours Worked

**Symptoms**: `hours_worked` doesn't account for `break_minutes`

**Causes**:
- Backend calculation logic error
- `last_action_time` not updated correctly

**Verify**:
```sql
-- Check break calculation
SELECT
  id,
  staff_code,
  clock_in,
  clock_out,
  break_minutes,
  TIMESTAMPDIFF(MINUTE, clock_in, clock_out) AS total_minutes,
  (TIMESTAMPDIFF(MINUTE, clock_in, clock_out) - break_minutes) / 60 AS expected_hours,
  hours_worked AS actual_hours
FROM shifts
WHERE id = 42;

-- Should match:
-- expected_hours = actual_hours
```

---

#### 8. Multiple Break Periods Not Accumulating

**Symptoms**: Only last break is counted

**Check Logic** ([backend/routes/kiosk.js](backend/routes/kiosk.js)):
```javascript
// Should be ADDING to existing break_minutes
await conn.execute(
  `UPDATE shifts
   SET break_minutes = break_minutes + ?  -- IMPORTANT: Use += not =
   WHERE id = ?`,
  [newBreakMinutes, shift_id]
);
```

---

### Database Debugging Queries

```sql
-- 1. Check all active shifts
SELECT
  s.id,
  s.staff_code,
  CONCAT(st.first_name, ' ', st.last_name) AS staff_name,
  s.venue_code,
  s.clock_in,
  s.shift_state,
  s.break_minutes,
  TIMESTAMPDIFF(MINUTE, s.clock_in, NOW()) AS minutes_elapsed
FROM shifts s
INNER JOIN staff st ON s.staff_code = st.staff_code
WHERE s.shift_state IN ('ACTIVE', 'ON_BREAK');

-- 2. Check shifts with pay issues
SELECT
  s.id,
  s.staff_code,
  s.hours_worked,
  s.payday_type,
  s.applied_rate,
  s.total_pay,
  p.weekday_rate,
  p.saturday_rate,
  (s.hours_worked * s.applied_rate) AS expected_pay
FROM shifts s
LEFT JOIN pay_rates p ON s.staff_code = p.staff_code
WHERE s.shift_state = 'COMPLETED'
  AND (s.total_pay IS NULL OR s.total_pay = 0);

-- 3. Check sync queue failures
SELECT * FROM sync_log
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 10;

-- 4. Find staff without PINs
SELECT
  s.staff_code,
  CONCAT(s.first_name, ' ', s.last_name) AS staff_name,
  u.kiosk_pin
FROM staff s
LEFT JOIN users u ON s.staff_code = u.staff_code
WHERE s.employment_status = 'active'
  AND (u.kiosk_pin IS NULL OR u.kiosk_pin = '');

-- 5. Audit clock operations
SELECT
  s.staff_code,
  CONCAT(st.first_name, ' ', st.last_name) AS staff_name,
  s.clock_in,
  s.clock_out,
  s.shift_state,
  s.break_minutes,
  s.hours_worked,
  s.total_pay,
  s.created_at
FROM shifts s
INNER JOIN staff st ON s.staff_code = st.staff_code
WHERE DATE(s.clock_in) = CURDATE()
ORDER BY s.clock_in DESC;
```

---

### Performance Optimization

#### 1. Enable Staff List Caching

**File**: [backend/routes/kiosk.js](backend/routes/kiosk.js)

**Current Implementation**:
```javascript
// Cache staff list for 30 minutes
const cache = require('../utils/cache');
const CACHE_KEY = `staff_${venue_code}`;

// Check cache first
let staff = cache.get(CACHE_KEY);
if (!staff) {
  // Query database
  const [results] = await pool.execute(
    `SELECT * FROM staff WHERE venue_code = ?`,
    [venue_code]
  );
  staff = results;

  // Cache for 30 minutes
  cache.set(CACHE_KEY, staff, 1800);
}
```

---

#### 2. Use Batch Status Queries

**Instead of**:
```javascript
// BAD: Individual query for each staff member (N queries)
for (const staffCode of staffCodes) {
  const status = await fetch(`/api/kiosk/status/${staffCode}`);
}
```

**Use**:
```javascript
// GOOD: Single batch query for all staff at venue
const statuses = await fetch(`/api/kiosk/status/venue/${venueCode}`);
```

---

#### 3. Add Database Indexes

```sql
-- Improve shift queries
CREATE INDEX idx_staff_state ON shifts(staff_code, shift_state);
CREATE INDEX idx_venue_state ON shifts(venue_code, shift_state);

-- Improve status polling
CREATE INDEX idx_clock_in ON shifts(clock_in);
CREATE INDEX idx_last_action ON shifts(last_action_time);
```

---

## Security Considerations

### 1. PIN Security
- PINs are currently stored as plain text (6-digit numeric)
- **Recommendation**: Hash PINs using bcrypt for production
- Consider implementing rate limiting on PIN attempts

### 2. Kiosk Password Security
- Venue kiosk passwords stored as plain text
- **Recommendation**: Hash passwords before storing
- Rotate passwords regularly

### 3. Session Management
- Currently using localStorage (survives page refresh)
- **Recommendation**: Implement session timeout after inactivity
- Clear kiosk context on logout

### 4. Input Validation
- Validate all user inputs (PIN format, staff codes, etc.)
- Sanitize inputs to prevent SQL injection
- Use prepared statements (already implemented)

---

## Future Enhancements

### Planned Features
1. **Photo Capture**: Take staff photo on clock in for verification
2. **Geolocation**: Verify staff is at venue location
3. **Signature Capture**: Digital signature for shift approval
4. **Shift Notes**: Allow staff to add notes (issues, incidents, etc.)
5. **QR Code Check-in**: Alternative to PIN entry
6. **Multi-language Support**: Translations for different locales
7. **Dark Mode**: Theme switching for night shifts
8. **Voice Commands**: Accessibility feature for hands-free operation

---

## Support & Contact

For questions or issues:
1. Check this documentation first
2. Review database schema and API endpoints
3. Check browser console for JavaScript errors
4. Verify backend logs for API errors
5. Contact development team with specific error messages

---

## Changelog

### Version 1.0 (Current)
- Kiosk login with venue credentials
- Staff PIN authentication
- Clock in/out operations
- Break tracking with accumulation
- Offline support with sync
- Real-time status updates
- Auto-close for long shifts
- Pay calculation with payday types
- System health monitoring

---

## File Reference

### Frontend Files
- [frontend/kiosk.html](frontend/kiosk.html) - Main kiosk UI
- [frontend/js/kiosk/index.js](frontend/js/kiosk/index.js) - Kiosk logic
- [frontend/js/kiosk/breaks.js](frontend/js/kiosk/breaks.js) - Break tracking

### Backend Files
- [backend/routes/kiosk.js](backend/routes/kiosk.js) - Kiosk API endpoints
- [backend/utils/payCalculator.js](backend/utils/payCalculator.js) - Pay calculation
- [backend/config/db.js](backend/config/db.js) - Database connection

### Database Files
- [schema/02_tables.sql](schema/02_tables.sql) - Main tables
- [schema/05_alter_breaks.sql](schema/05_alter_breaks.sql) - Break tracking
- [schema/06_sync_log.sql](schema/06_sync_log.sql) - Offline sync

---

**Last Updated**: 2025-10-19
**Author**: Development Team
**Version**: 1.0