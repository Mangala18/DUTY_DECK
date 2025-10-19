# Kiosk System - Quick Start Guide

## What Was Created

1. **Comprehensive Documentation** ([KIOSK_DOCUMENTATION.md](KIOSK_DOCUMENTATION.md))
   - Complete system architecture
   - API endpoints reference
   - Database schema
   - Development guide
   - Troubleshooting section

2. **Enhanced Kiosk HTML** ([frontend/kiosk.html](frontend/kiosk.html))
   - Detailed inline comments explaining every section
   - Clear documentation of data flow
   - API endpoint references
   - Button state logic explanations

## Quick Access

### Main Files

| File | Purpose | Location |
|------|---------|----------|
| **kiosk.html** | Main kiosk interface | [frontend/kiosk.html](frontend/kiosk.html) |
| **index.js** | Kiosk JavaScript logic | [frontend/js/kiosk/index.js](frontend/js/kiosk/index.js) |
| **kiosk.js** | Backend API endpoints | [backend/routes/kiosk.js](backend/routes/kiosk.js) |
| **Full Documentation** | Complete system guide | [KIOSK_DOCUMENTATION.md](KIOSK_DOCUMENTATION.md) |

---

## How The System Works

### Authentication Flow
```
1. Venue Login
   ├─ User enters: venue email + kiosk password
   ├─ API: POST /api/kiosk/login
   └─ Stored in: venues table

2. Staff Selection
   ├─ Staff clicks their card from the grid
   └─ Grid populated from: GET /api/kiosk/staff

3. PIN Validation
   ├─ Staff enters: 6-digit PIN
   ├─ API: POST /api/kiosk/validate-pin
   └─ Validated against: users.kiosk_pin

4. Clock Operations
   ├─ Clock In: POST /api/kiosk/shift/:staff_code/clockin
   ├─ Clock Out: POST /api/kiosk/shift/:id/clockout
   ├─ Start Break: POST /api/kiosk/shift/:id/breakin
   └─ End Break: POST /api/kiosk/shift/:id/breakout
```

---

## Database Tables Used

```sql
venues
  ├─ contact_email      (kiosk login username)
  └─ kiosk_password     (kiosk login password)

users
  └─ kiosk_pin          (6-digit staff PIN)

staff
  ├─ staff_code         (unique identifier)
  └─ venue_code         (venue assignment)

shifts
  ├─ staff_code         (who clocked in)
  ├─ venue_code         (where they clocked in)
  ├─ clock_in           (start time)
  ├─ clock_out          (end time)
  ├─ shift_state        (NONE/ACTIVE/ON_BREAK/COMPLETED)
  ├─ break_minutes      (accumulated break time)
  ├─ hours_worked       (total hours - breaks)
  └─ total_pay          (calculated pay)

pay_rates
  ├─ weekday_rate       (Mon-Fri hourly rate)
  ├─ saturday_rate      (Saturday hourly rate)
  ├─ sunday_rate        (Sunday hourly rate)
  └─ public_holiday_rate (Holiday hourly rate)

sync_log
  ├─ offline_id         (UUID for idempotency)
  └─ status             (synced/duplicate/failed)
```

---

## Frontend Components Explained

### 1. Kiosk Login Form
- **Location**: Lines 304-330 in [kiosk.html](frontend/kiosk.html)
- **Purpose**: Authenticate venue
- **Inputs**: Venue email + password
- **On Success**: Shows staff grid

### 2. Staff Grid
- **Location**: Line 348 in [kiosk.html](frontend/kiosk.html)
- **Purpose**: Display all staff at venue
- **Updates**: Every 5 seconds (status polling)
- **Visual States**:
  - Green border + glow = ACTIVE (clocked in)
  - Orange border + glow = ON_BREAK
  - Gray border = NONE (not clocked in)

### 3. PIN Modal
- **Location**: Lines 383-417 in [kiosk.html](frontend/kiosk.html)
- **Purpose**: Authenticate staff member
- **Input**: 6-digit numeric PIN
- **On Success**: Shows clock section

### 4. Clock Section
- **Location**: Lines 428-488 in [kiosk.html](frontend/kiosk.html)
- **Purpose**: Clock in/out and break controls
- **Button States**:
  - **NONE state**: Clock In enabled, all others disabled
  - **ACTIVE state**: Clock Out + Start Break enabled
  - **ON_BREAK state**: End Break enabled

### 5. System Status Indicator
- **Location**: Line 519 in [kiosk.html](frontend/kiosk.html)
- **Purpose**: Show backend connectivity
- **States**:
  - Green = Online
  - Red = Offline (actions queued)
  - Yellow = Syncing

---

## Key Features

### 1. Real-time Status Updates
- Status polls every 5 seconds
- Updates staff card appearance automatically
- Batch query for performance: `GET /api/kiosk/status/venue/:venue_code`

### 2. Offline Support
- Actions queue in localStorage when backend is down
- Automatic sync when backend returns
- Uses UUIDs to prevent duplicate entries
- Tracked in `sync_log` table

### 3. Break Tracking
- Multiple breaks supported per shift
- Break time accumulates (`break_minutes` field)
- Deducted from total hours on clock out
- Formula: `hours_worked = (total_time - break_minutes) / 60`

### 4. Automatic Pay Calculation
- Determines payday type (weekday/saturday/sunday/holiday)
- Applies correct rate from `pay_rates` table
- Fallback to $25/hour if no rate defined
- Calculated on clock out

---

## API Endpoints Quick Reference

```bash
# Venue Login
POST /api/kiosk/login
Body: { "username": "venue@email.com", "password": "kiosk123" }

# Staff PIN Validation
POST /api/kiosk/validate-pin
Body: { "staff_code": "E001", "pin": "123456", "venue_code": "VEN001" }

# Load Staff List
GET /api/kiosk/staff?venue_code=VEN001

# Get Staff Status
GET /api/kiosk/status/E001

# Clock In
POST /api/kiosk/shift/E001/clockin
Body: { "venue_code": "VEN001" }

# Clock Out
POST /api/kiosk/shift/42/clockout

# Start Break
POST /api/kiosk/shift/42/breakin

# End Break
POST /api/kiosk/shift/42/breakout

# Offline Sync
POST /api/kiosk/sync
Body: { "actions": [ { "offline_id": "uuid", "type": "clockin", ... } ] }

# Health Check
GET /api/kiosk/health
```

---

## Common Customizations

### Change Status Polling Interval
**File**: [frontend/js/kiosk/index.js](frontend/js/kiosk/index.js)
```javascript
// Current: 5 seconds
setInterval(updateStatuses, 5000);

// Change to 10 seconds
setInterval(updateStatuses, 10000);
```

### Change Card Colors
**File**: [frontend/kiosk.html](frontend/kiosk.html) (Lines 80-107)
```css
/* Active state - Green */
.staff-card.status-active {
  background-image: linear-gradient(white, white),
    linear-gradient(135deg, #4ade80, #16a34a, #15803d);
  box-shadow: 0 0 20px rgba(22, 163, 74, 0.4);
}

/* Change to blue */
.staff-card.status-active {
  background-image: linear-gradient(white, white),
    linear-gradient(135deg, #60a5fa, #3b82f6, #2563eb);
  box-shadow: 0 0 20px rgba(59, 130, 246, 0.4);
}
```

### Add Overtime Logic
**File**: [backend/utils/payCalculator.js](backend/utils/payCalculator.js)
```javascript
function calculateShiftPay({ hoursWorked, paydayType, rates }) {
  const BASE_RATE = 25;
  let appliedRate = rates?.weekday_rate || BASE_RATE;

  // Add overtime calculation
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

## Testing The Kiosk

### 1. Setup Test Data

```sql
-- Create venue with kiosk credentials
INSERT INTO venues (venue_code, business_code, venue_name, contact_email, kiosk_password, timezone, state, status)
VALUES ('VEN001', 'BUS001', 'Sydney Office', 'sydney@dutydeck.com', 'kiosk123', 'Australia/Sydney', 'NSW', 'active');

-- Create staff member
INSERT INTO staff (staff_code, business_code, venue_code, first_name, last_name, employment_status)
VALUES ('E001', 'BUS001', 'VEN001', 'John', 'Doe', 'active');

-- Create user with PIN
INSERT INTO users (staff_code, email, password, kiosk_pin, access_level)
VALUES ('E001', 'john@dutydeck.com', 'password123', '123456', 'employee');

-- Create pay rates
INSERT INTO pay_rates (staff_code, weekday_rate, saturday_rate, sunday_rate, public_holiday_rate)
VALUES ('E001', 25.00, 30.00, 35.00, 50.00);
```

### 2. Test Flow

1. **Open Kiosk**: Navigate to `http://localhost:3000/frontend/kiosk.html`
2. **Login**: Email: `sydney@dutydeck.com`, Password: `kiosk123`
3. **Select Staff**: Click on "John Doe" card
4. **Enter PIN**: Type `123456`
5. **Clock In**: Click "Clock In" button
6. **Verify**: Check staff card turns green
7. **Start Break**: Click "Start Break"
8. **Verify**: Check staff card turns orange
9. **End Break**: Wait 5 minutes, click "End Break"
10. **Clock Out**: Click "Clock Out"
11. **Verify Pay**: Check database for calculated `total_pay`

### 3. Verify Database

```sql
-- Check shift record
SELECT * FROM shifts WHERE staff_code = 'E001' ORDER BY id DESC LIMIT 1;

-- Expected result:
-- shift_state: COMPLETED
-- break_minutes: 5
-- hours_worked: (calculated)
-- total_pay: (calculated)
```

---

## Troubleshooting

### "Invalid credentials" on login
**Check**: Venue email/password in `venues` table
```sql
SELECT contact_email, kiosk_password, status FROM venues WHERE contact_email = 'sydney@dutydeck.com';
```

### "Invalid PIN"
**Check**: Staff PIN in `users` table
```sql
SELECT u.staff_code, u.kiosk_pin, s.venue_code, s.employment_status
FROM users u
INNER JOIN staff s ON u.staff_code = s.staff_code
WHERE u.staff_code = 'E001';
```

### "Staff already has an active shift"
**Check**: Existing active shift
```sql
SELECT * FROM shifts WHERE staff_code = 'E001' AND shift_state IN ('ACTIVE', 'ON_BREAK');
```

**Fix**: Manually close shift
```sql
UPDATE shifts SET shift_state = 'COMPLETED', clock_out = NOW() WHERE id = <shift_id>;
```

### Staff card not updating
1. Check browser console for errors
2. Verify system status indicator says "Online"
3. Check backend is running: `curl http://localhost:3000/api/kiosk/health`

---

## Further Reading

- **Full Documentation**: [KIOSK_DOCUMENTATION.md](KIOSK_DOCUMENTATION.md)
- **Kiosk HTML**: [frontend/kiosk.html](frontend/kiosk.html) (with inline comments)
- **Backend API**: [backend/routes/kiosk.js](backend/routes/kiosk.js)
- **Frontend Logic**: [frontend/js/kiosk/index.js](frontend/js/kiosk/index.js)

---

## Questions?

1. Check [KIOSK_DOCUMENTATION.md](KIOSK_DOCUMENTATION.md) for detailed explanations
2. Review inline comments in [kiosk.html](frontend/kiosk.html)
3. Look at troubleshooting section above
4. Check database schema section in full documentation

---

**Last Updated**: 2025-10-19
**Version**: 1.0