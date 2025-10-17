# Admin Panel Documentation - DutyDeck System

## Table of Contents
1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Frontend Structure](#frontend-structure)
4. [Backend Structure](#backend-structure)
5. [Database Schema](#database-schema)
6. [API Endpoints](#api-endpoints)
7. [Authentication & Authorization](#authentication--authorization)
8. [How It Works](#how-it-works)
9. [Setup & Installation](#setup--installation)
10. [Features & Functionality](#features--functionality)

---

## Overview

The **DutyDeck Admin Panel** is a comprehensive employee management system built for managing staff, shifts, payroll, and schedules across multiple business venues. The system features a modern web-based interface with role-based access control.

**Main File:** [frontend/admin.html](frontend/admin.html)

### Technology Stack
- **Frontend:** HTML5, CSS3, JavaScript (ES6 Modules), Bootstrap 5.3
- **Backend:** Node.js, Express.js
- **Database:** MySQL 8.0
- **Authentication:** Custom session-based auth with localStorage

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    CLIENT (Browser)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  admin.html  │  │  kiosk.html  │  │  master.html │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                 │                │
│         └─────────────────┴─────────────────┘                │
│                           │                                   │
│                  ┌────────▼────────┐                         │
│                  │  JS Modules     │                         │
│                  │  - admin.js     │                         │
│                  │  - api.js       │                         │
│                  │  - storage.js   │                         │
│                  │  - ui.js        │                         │
│                  └────────┬────────┘                         │
└───────────────────────────┼──────────────────────────────────┘
                            │
                    HTTPS/REST API
                            │
┌───────────────────────────▼──────────────────────────────────┐
│                    SERVER (Node.js/Express)                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  server.js (Entry Point - Port 3000)                 │   │
│  └──────────────────┬───────────────────────────────────┘   │
│                     │                                         │
│  ┌──────────────────▼───────────────────────────────────┐   │
│  │  Routes Index (/api)                                 │   │
│  │  - authRoutes        → /api/login, /api/logout      │   │
│  │  - masterRoutes      → /api/master/*                │   │
│  │  - systemAdminRoutes → /api/system-admin/*          │   │
│  │  - staffRoutes       → /api/staff/*                 │   │
│  │  - kioskRoutes       → /api/kiosk/*                 │   │
│  │  - dashboardRoutes   → /api/system-admin/dashboard  │   │
│  └──────────────────┬───────────────────────────────────┘   │
│                     │                                         │
│  ┌──────────────────▼───────────────────────────────────┐   │
│  │  Middleware Layer                                    │   │
│  │  - authMiddleware (requireStaffManagementAccess)    │   │
│  │  - errorHandler                                      │   │
│  │  - CORS, JSON parser                                │   │
│  └──────────────────┬───────────────────────────────────┘   │
│                     │                                         │
│  ┌──────────────────▼───────────────────────────────────┐   │
│  │  Controllers                                         │   │
│  │  - staffController                                   │   │
│  │  - kioskController                                   │   │
│  │  - dashboardController                              │   │
│  └──────────────────┬───────────────────────────────────┘   │
└────────────────────┼────────────────────────────────────────┘
                     │
                MySQL Connection Pool
                     │
┌────────────────────▼────────────────────────────────────────┐
│                    DATABASE (MySQL 8.0)                      │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  clockin_mysql Database                              │   │
│  │  - businesses       (Business entities)              │   │
│  │  - venues          (Venue locations)                 │   │
│  │  - staff           (Employee records)                │   │
│  │  - users           (Login credentials)               │   │
│  │  - pay_rates       (Hourly rates)                    │   │
│  │  - shifts          (Time tracking)                   │   │
│  │  - rosters         (Shift schedules)                 │   │
│  │  - staff_compliance (Banking/tax info)              │   │
│  │  - sync_log        (Offline sync audit)             │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

---

## Frontend Structure

### File Organization

```
frontend/
├── admin.html                      # Main admin panel interface
├── kiosk.html                      # Employee clock-in/out kiosk
├── master.html                     # Master admin dashboard
├── index.html                      # Login page
├── css/
│   ├── admin.css                   # Admin panel styling (695 lines)
│   ├── kiosk.css                   # Kiosk styling
│   ├── login.css                   # Login page styling
│   └── master.css                  # Master dashboard styling
└── js/
    ├── admin/
    │   ├── admin.js               # Main admin panel controller
    │   └── staff/
    │       ├── index.js           # Staff module entry point
    │       ├── list.js            # Staff list management
    │       ├── form.js            # Add/Edit staff forms
    │       └── detail.js          # Staff detail view
    └── utils/
        ├── api.js                 # API request wrapper with retry logic
        ├── storage.js             # localStorage management
        ├── ui.js                  # UI helper functions (toasts, etc.)
        ├── validator.js           # Form validation
        ├── dialog.js              # Dialog/modal helpers
        └── logger.js              # Logging utility
```

### Admin Panel Layout (admin.html)

The admin panel consists of several key sections:

#### 1. **Header Navigation** (Lines 14-32)
- Brand logo and title
- Sidebar toggle button
- Welcome message with user info
- Logout button

#### 2. **Sidebar Navigation** (Lines 37-84)
- Dashboard
- Team Management (Staff)
- Schedule
- Payroll
- Holidays
- Reports
- Settings

Each nav item uses `data-panel` attribute to switch between content panels.

#### 3. **Content Panels**

**Dashboard Panel** (Lines 89-185)
- Quick stats cards:
  - Total Staff
  - Active Shifts
  - Today's Hours
  - This Week's Pay
- Recent Activity feed

**Staff Panel** (Lines 188-237)
- Venue and status filters
- Staff list table
- Add Staff button (opens modal)

**Other Panels** (Lines 239-342)
- Schedule Management
- Payroll Management
- Holiday Management
- Reports & Analytics
- Settings

#### 4. **Modals**

**Add Staff Modal** (Lines 352-550)
Comprehensive form with sections:
- Personal Information (first/middle/last name)
- Access & Work Details (staff code, venue, access level, employment type, role, start date, phone)
- Login Credentials (email, password)
- Pay Settings (default hours)
- Pay Rates (weekday, Saturday, Sunday, public holiday, overtime)
- Banking Details (account holder, bank name, BSB, account number)

**Edit Staff Modal** (Lines 553-761)
Extended version of Add Staff with additional fields:
- DOB, gender, full address
- Emergency contact name & phone
- Employment status toggle (active/inactive)
- Kiosk PIN

### CSS Styling (admin.css)

**Design System:**
- **Color Palette:**
  - Primary: `#4ecdc4` (Teal)
  - Success: `#28a745` (Green)
  - Info: `#17a2b8` (Blue)
  - Warning: `#ffc107` (Yellow)
  - Background: Dark gradient (`#1a1a2e → #16213e → #0f0f23`)

- **Visual Effects:**
  - Glass morphism (backdrop-filter blur)
  - Gradient borders
  - Smooth transitions (0.3s ease)
  - Custom scrollbars
  - Responsive sidebar collapse

- **Components:**
  - Cards with rgba backgrounds
  - Gradient buttons with hover effects
  - Custom form controls with focus states
  - Avatar circles for staff initials
  - Badge styling for status indicators

### JavaScript Modules

#### admin.js (Main Controller)
```javascript
// Core Responsibilities:
1. Authentication check on page load
2. Access level verification (system_admin, manager, supervisor)
3. Initialize navigation and sidebar
4. Load dashboard metrics
5. Setup network detection (online/offline)
6. Handle logout
```

**Key Functions:**
- `initializeAdminPanel()` - Entry point
- `setupNavigation()` - Panel switching logic
- `loadDashboardMetrics()` - Fetch stats from API
- `updateWelcomeMessage()` - Display user info

#### staff/index.js (Staff Module)
```javascript
// Exports:
- initStaffModule()      // Initialize staff management
- loadStaffList()        // Fetch and display staff
- handleAddStaff()       // Form submission for new staff
- handleEditStaff()      // Form submission for updates
- deleteStaff()          // Remove staff member
```

#### utils/api.js (API Layer)
```javascript
// Features:
1. Automatic authentication headers injection
2. Retry logic with exponential backoff (3 attempts)
3. Session expiry detection (401 → auto logout)
4. Network error handling
5. JSON parsing with error messages

// Usage:
apiRequest('/system-admin/staff')
api.get('/staff')
api.post('/staff', staffData)
api.put('/staff/EMP001', updates)
api.delete('/staff/EMP001')
```

**Retry Logic:**
- Retries on: Network errors, 5xx errors, 429 (rate limit)
- Backoff delays: 1s, 2s, 3s
- Auto-logout on 401 Unauthorized

#### utils/storage.js
```javascript
// localStorage Management:
- setUser(userData)              // Save user session
- getUser()                      // Get current user
- clearUser()                    // Logout
- requireAuth(redirectUrl)       // Auth guard
- getUserAccessLevel()           // Get user role
- getUserFullName()              // Get display name
```

---

## Backend Structure

### File Organization

```
backend/
├── server.js                       # Application entry point
├── db.js                          # MySQL connection pool
├── package.json                   # Dependencies
├── config/
│   ├── env.js                     # Environment variables
│   └── db.js                      # Database configuration
├── routes/
│   ├── index.js                   # Route aggregator
│   ├── auth.js                    # Login/logout
│   ├── staffRoutes.js             # Staff CRUD operations
│   ├── systemAdminRoutes.js       # System admin endpoints
│   ├── masterRoutes.js            # Master admin endpoints
│   ├── kioskRoutes.js             # Kiosk clock-in/out
│   └── dashboardRoutes.js         # Dashboard metrics
├── controllers/
│   ├── staffController.js         # Staff business logic
│   ├── kioskController.js         # Kiosk operations
│   └── dashboardController.js     # Dashboard data
├── middleware/
│   ├── authMiddleware.js          # Authentication guards
│   └── errorHandler.js            # Global error handling
└── public-holidays-config.js      # Public holiday definitions
```

### Server Configuration (server.js)

```javascript
// Port: 3000 (from env.js)
// Middleware Stack:
1. CORS (cross-origin requests)
2. express.json() (JSON body parser)
3. express.urlencoded() (form data parser)
4. express.static() (serve frontend files)
5. API routes (/api/*)
6. Error handler
7. Catch-all route (serve master.html)
```

### Database Connection (db.js)

```javascript
// MySQL Connection Pool:
{
  host: 'localhost',
  user: 'appuser',
  password: 'asdfghjkl',
  database: 'clockin_mysql',
  connectionLimit: 10,
  waitForConnections: true,
  queueLimit: 0
}

// Features:
- Connection pooling (max 10 connections)
- Error event handlers
- Initial connection test on startup
- Diagnostic logging
```

### Route Structure (routes/index.js)

```javascript
// API Endpoint Mapping:
/api/
├── /login                         # POST - User authentication
├── /logout                        # POST - User logout
├── /master/*                      # Master admin routes
├── /system-admin/
│   ├── /staff                     # Staff management (legacy)
│   └── /dashboard                 # Dashboard metrics
├── /staff/
│   ├── GET /                      # List all staff
│   ├── GET /:staff_code           # Get staff details
│   ├── POST /                     # Create staff
│   ├── PUT /:staff_code           # Update staff
│   ├── DELETE /:staff_code        # Delete staff
│   └── GET /venues                # List accessible venues
└── /kiosk/*                       # Kiosk operations
```

### Staff Routes (staffRoutes.js)

**Middleware:** `requireStaffManagementAccess`
- Allows: system_admin, manager, supervisor
- Blocks: employee (regular staff)

**Endpoints:**
1. `GET /api/staff/venues` - Get venues user can manage
2. `GET /api/staff` - Get staff list (role-based filtering)
3. `GET /api/staff/:staff_code` - Get individual staff details
4. `POST /api/staff` - Create new staff member
5. `PUT /api/staff/:staff_code` - Update staff member
6. `DELETE /api/staff/:staff_code` - Delete staff member

### System Admin Routes (systemAdminRoutes.js)

**Context Injection Middleware:**
```javascript
// Automatically injects headers:
- user_access_level: 'system_admin'
- user_business_code: from query/body
- user_venue_code: from query/body

// This allows legacy routes to work with shared staffRoutes
```

**Delegation:**
All staff operations delegated to shared `staffRoutes` module to eliminate code duplication.

---

## Database Schema

### Entity Relationship Diagram

```
businesses (1) ─────< venues (M)
    │                   │
    │                   │
    └────< staff (M) >──┘
           │
           ├────< users (1:1)
           ├────< pay_rates (1:1)
           ├────< staff_compliance (1:1)
           ├────< shifts (M)
           └────< rosters (M)

venues (1) ────< shifts (M)
venues (1) ────< rosters (M)
rosters (1) ───< shifts (M) [optional]
```

### Key Tables

#### businesses
```sql
id                  INT AUTO_INCREMENT PRIMARY KEY
business_code       VARCHAR(100) UNIQUE NOT NULL
business_name       VARCHAR(100)
status              ENUM('active','inactive') DEFAULT 'active'
created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

#### venues
```sql
id                  INT AUTO_INCREMENT PRIMARY KEY
venue_code          VARCHAR(100) UNIQUE NOT NULL
business_code       VARCHAR(100) NOT NULL (FK → businesses)
venue_name          VARCHAR(150)
contact_email       VARCHAR(100) UNIQUE NOT NULL
kiosk_password      VARCHAR(255) NOT NULL
state               VARCHAR(50)
venue_address       VARCHAR(150)
timezone            VARCHAR(150)
week_start          ENUM('Mon','Tue','Wed',...) DEFAULT 'Mon'
status              ENUM('active','inactive') DEFAULT 'active'
created_at          TIMESTAMP
updated_at          TIMESTAMP
```

#### staff
```sql
id                  INT AUTO_INCREMENT PRIMARY KEY
staff_code          VARCHAR(25) UNIQUE NOT NULL
business_code       VARCHAR(100) NOT NULL (FK → businesses)
venue_code          VARCHAR(100) (FK → venues, NULL for system_admin)
first_name          VARCHAR(50) NOT NULL
middle_name         VARCHAR(50)
last_name           VARCHAR(50) NOT NULL
phone_number        VARCHAR(30)
employment_status   ENUM('active','inactive','terminated') DEFAULT 'active'
employment_type     ENUM('full_time','part_time','casual','contract') DEFAULT 'full_time'
role_title          VARCHAR(50)
staff_type          ENUM('venue_staff','system_admin') DEFAULT 'venue_staff'
start_date          DATE
created_at          TIMESTAMP
updated_at          TIMESTAMP

-- Constraint: system_admin must have NULL venue_code
-- Constraint: venue_staff must have valid venue_code
```

#### users
```sql
id                  INT AUTO_INCREMENT PRIMARY KEY
staff_code          VARCHAR(25) (FK → staff, ON DELETE SET NULL)
email               VARCHAR(150) UNIQUE NOT NULL
password_hash       VARCHAR(255) NOT NULL
access_level        ENUM('system_admin','manager','supervisor','employee') NOT NULL
kiosk_pin           CHAR(6)
status              ENUM('active','inactive') DEFAULT 'active'
created_at          TIMESTAMP
updated_at          TIMESTAMP
```

#### pay_rates
```sql
id                  INT AUTO_INCREMENT PRIMARY KEY
staff_code          VARCHAR(25) NOT NULL (FK → staff, ON DELETE CASCADE)
default_hours       DECIMAL(5,2) DEFAULT 38.00
weekday_rate        DECIMAL(10,2) DEFAULT 0.00
saturday_rate       DECIMAL(10,2) DEFAULT 0.00
sunday_rate         DECIMAL(10,2) DEFAULT 0.00
public_holiday_rate DECIMAL(10,2) DEFAULT 0.00
overtime_rate       DECIMAL(10,2) DEFAULT 0.00
created_at          TIMESTAMP
```

#### staff_compliance
```sql
id                  INT AUTO_INCREMENT PRIMARY KEY
staff_code          VARCHAR(25) NOT NULL (FK → staff, ON DELETE CASCADE)
tfn                 VARCHAR(20)
super_fund          VARCHAR(100)
super_member_id     VARCHAR(50)
payroll_ref         VARCHAR(50)
account_holder_name VARCHAR(100)
bank_account_number VARCHAR(50)
bank_bsb            VARCHAR(20)
bank_name           VARCHAR(100)
created_at          TIMESTAMP
updated_at          TIMESTAMP
verified_at         TIMESTAMP
verified_by         VARCHAR(50)
```

#### shifts
```sql
id                  INT AUTO_INCREMENT PRIMARY KEY
roster_id           INT (FK → rosters, ON DELETE SET NULL)
staff_code          VARCHAR(25) NOT NULL (FK → staff, ON DELETE CASCADE)
venue_code          VARCHAR(100) NOT NULL (FK → venues, ON DELETE CASCADE)
clock_in            TIMESTAMP NOT NULL
clock_out           TIMESTAMP NULL
shift_state         ENUM('NONE','ACTIVE','ON_BREAK','COMPLETED') DEFAULT 'NONE'
approval_status     ENUM('PENDING','APPROVED','DISCARDED') DEFAULT 'PENDING'
payday_type         ENUM('WEEKDAY','SATURDAY','SUNDAY','PUBLIC_HOLIDAY') DEFAULT 'WEEKDAY'
last_action_time    TIMESTAMP
break_minutes       INT DEFAULT 0
hours_worked        DECIMAL(6,2)
applied_rate        DECIMAL(10,2)
total_pay           DECIMAL(12,2) DEFAULT 0.00
created_at          TIMESTAMP
updated_at          TIMESTAMP

-- Indexes for performance:
idx_shift_staff_code, idx_shift_staff_clockin, idx_shift_date,
idx_shifts_payroll, idx_shift_state, idx_staff_shift_state
```

#### rosters
```sql
id                  INT AUTO_INCREMENT PRIMARY KEY
venue_code          VARCHAR(100) NOT NULL (FK → venues, ON DELETE CASCADE)
staff_code          VARCHAR(25) NOT NULL (FK → staff, ON DELETE CASCADE)
shift_date          DATE NOT NULL
start_time          TIME NOT NULL
end_time            TIME NOT NULL

-- Unique constraint prevents double-booking
UNIQUE (venue_code, staff_code, shift_date, start_time)
```

#### sync_log
```sql
id                  INT AUTO_INCREMENT PRIMARY KEY
offline_id          VARCHAR(64) UNIQUE NOT NULL  -- UUID for idempotency
staff_code          VARCHAR(50) NOT NULL
type                ENUM('clockin','clockout','breakin','breakout') NOT NULL
timestamp           TIMESTAMP NOT NULL
status              ENUM('synced','duplicate','failed') DEFAULT 'synced'
error_message       TEXT
created_at          TIMESTAMP

-- Purpose: Audit log for offline kiosk synchronization
```

---

## API Endpoints

### Authentication

#### POST /api/login
**Request:**
```json
{
  "email": "admin@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "staff_code": "SYS001",
    "email": "admin@example.com",
    "access_level": "system_admin",
    "business_code": "BUS001",
    "venue_code": null,
    "first_name": "John",
    "last_name": "Doe"
  }
}
```

### Staff Management

#### GET /api/staff
**Headers:**
```
user_access_level: system_admin|manager|supervisor
user_business_code: BUS001
user_venue_code: VEN001 (optional)
```

**Response:**
```json
{
  "success": true,
  "staff": [
    {
      "staff_code": "EMP001",
      "first_name": "Jane",
      "middle_name": "Marie",
      "last_name": "Smith",
      "email": "jane@example.com",
      "phone_number": "0412345678",
      "employment_status": "active",
      "employment_type": "full_time",
      "role_title": "Cashier",
      "access_level": "employee",
      "venue_code": "VEN001",
      "venue_name": "Main Store",
      "start_date": "2024-01-01",
      "weekday_rate": 25.50,
      "saturday_rate": 30.60,
      "sunday_rate": 38.25,
      "public_holiday_rate": 51.00,
      "overtime_rate": 38.25
    }
  ]
}
```

#### GET /api/staff/:staff_code
**Response:**
```json
{
  "success": true,
  "staff": {
    "staff_code": "EMP001",
    "first_name": "Jane",
    "last_name": "Smith",
    "email": "jane@example.com",
    "phone_number": "0412345678",
    "employment_status": "active",
    "employment_type": "full_time",
    "role_title": "Cashier",
    "start_date": "2024-01-01",
    "default_hours": 38.00,
    "weekday_rate": 25.50,
    "account_holder_name": "Jane Smith",
    "bank_name": "Commonwealth Bank",
    "bank_bsb": "062-000",
    "bank_account_number": "12345678"
  }
}
```

#### POST /api/staff
**Request:**
```json
{
  "first_name": "John",
  "middle_name": "Paul",
  "last_name": "Doe",
  "staff_code": "EMP002",
  "venue_code": "VEN001",
  "access_level": "employee",
  "employment_type": "part_time",
  "role_title": "Sales Associate",
  "start_date": "2024-03-01",
  "phone_number": "0498765432",
  "email": "john@example.com",
  "password_hash": "password123",
  "default_hours": 20.00,
  "weekday_rate": 23.00,
  "saturday_rate": 27.60,
  "sunday_rate": 34.50,
  "public_holiday_rate": 46.00,
  "overtime_rate": 34.50,
  "account_holder_name": "John Doe",
  "bank_name": "ANZ Bank",
  "bank_bsb": "013-000",
  "bank_account_number": "87654321"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Staff member created successfully",
  "staff_code": "EMP002"
}
```

#### PUT /api/staff/:staff_code
**Request:** (Same as POST, all fields optional except staff_code)

**Response:**
```json
{
  "success": true,
  "message": "Staff member updated successfully"
}
```

#### DELETE /api/staff/:staff_code
**Response:**
```json
{
  "success": true,
  "message": "Staff member deleted successfully"
}
```

### Dashboard

#### GET /api/system-admin/dashboard
**Headers:**
```
user_access_level: system_admin|manager|supervisor
user_business_code: BUS001
user_venue_code: VEN001 (optional)
```

**Response:**
```json
{
  "success": true,
  "totalStaff": 25,
  "activeShifts": 8,
  "todayHours": "42.50",
  "weekTotal": "1250.75"
}
```

### Venues

#### GET /api/staff/venues
**Headers:**
```
user_access_level: system_admin|manager|supervisor
user_business_code: BUS001
```

**Response:**
```json
{
  "success": true,
  "venues": [
    {
      "venue_code": "VEN001",
      "venue_name": "Main Store",
      "business_code": "BUS001",
      "state": "NSW",
      "status": "active"
    },
    {
      "venue_code": "VEN002",
      "venue_name": "West Branch",
      "business_code": "BUS001",
      "state": "VIC",
      "status": "active"
    }
  ]
}
```

---

## Authentication & Authorization

### Access Levels

1. **system_admin** (Highest)
   - Full access to all businesses and venues
   - Can manage all staff across organization
   - Not tied to specific venue (venue_code = NULL)

2. **manager**
   - Manages specific venue
   - Can manage staff within their venue
   - Has venue_code assigned

3. **supervisor**
   - Manages specific venue
   - Can manage staff within their venue
   - Has venue_code assigned

4. **employee** (Lowest)
   - Regular staff member
   - Cannot access admin panel
   - Can only use kiosk for clock-in/out

### Auth Flow

```
1. User opens admin.html
   ↓
2. DOMContentLoaded event fires
   ↓
3. Check localStorage for 'currentUser'
   ↓
4. If not found → redirect to /index.html (login)
   ↓
5. If found → validate access_level
   ↓
6. If employee → show error, redirect to /index.html
   ↓
7. If system_admin/manager/supervisor → initialize panel
   ↓
8. Load user-specific data based on access level
```

### Session Management

**Storage Format (localStorage):**
```json
{
  "id": 1,
  "staff_code": "SYS001",
  "email": "admin@example.com",
  "access_level": "system_admin",
  "business_code": "BUS001",
  "venue_code": null,
  "first_name": "John",
  "last_name": "Doe"
}
```

**Security Considerations:**
- ⚠️ Current implementation uses localStorage (vulnerable to XSS)
- 🔒 Recommended: Migrate to HTTP-only cookies + JWT
- 🔐 Passwords stored as hashed (in database)
- ✅ API validates access level on every request

### API Authentication Headers

Every API request includes:
```javascript
{
  'Content-Type': 'application/json',
  'user_access_level': 'system_admin',
  'user_business_code': 'BUS001',
  'user_venue_code': 'VEN001'  // or empty string
}
```

**Backend Validation:**
```javascript
// Middleware: requireStaffManagementAccess
1. Extract headers: user_access_level, user_business_code, user_venue_code
2. Check if access_level in ['system_admin', 'manager', 'supervisor']
3. Apply role-based filtering to database queries
4. Prevent cross-business/venue data leakage
```

---

## How It Works

### 1. User Login Flow

```
┌─────────────┐
│ index.html  │
│ (Login Page)│
└──────┬──────┘
       │
       │ User enters email + password
       ↓
   POST /api/login
       │
       ├─ Validate credentials against users table
       ├─ JOIN with staff table to get full details
       ├─ Check if status = 'active'
       │
       ├─ ✅ Success
       │   ├─ Return user object
       │   ├─ Frontend saves to localStorage
       │   └─ Redirect based on access_level:
       │       ├─ system_admin → /master.html
       │       ├─ manager/supervisor → /admin.html
       │       └─ employee → /kiosk.html
       │
       └─ ❌ Failure
           └─ Return 401 error with message
```

### 2. Admin Panel Initialization

```
admin.html loads
  ↓
DOM Ready Event
  ↓
admin.js → initializeAdminPanel()
  │
  ├─ Storage.requireAuth('/admin.html')
  │   └─ Check localStorage for currentUser
  │       ├─ Not found → redirect to /index.html
  │       └─ Found → continue
  │
  ├─ Check access_level in ['system_admin', 'manager', 'supervisor']
  │   ├─ No → show error, redirect
  │   └─ Yes → continue
  │
  ├─ updateWelcomeMessage()
  │   └─ Display: "Welcome, John Doe (system_admin)"
  │
  ├─ setupNavigation()
  │   ├─ Attach click listeners to sidebar links
  │   ├─ Panel switching logic
  │   └─ Dashboard refresh button
  │
  ├─ setupLogout()
  │   └─ Clear localStorage + redirect on logout
  │
  ├─ setupNetworkDetection()
  │   └─ Show toasts on offline/online events
  │
  ├─ loadDashboardMetrics()
  │   └─ Fetch stats from /api/system-admin/dashboard
  │
  ├─ initStaffModule()
  │   ├─ Load venues → populateVenueDropdown()
  │   ├─ Setup form event listeners
  │   └─ Attach filter buttons
  │
  └─ showToast("Welcome back, John Doe!")
```

### 3. Loading Staff List

```
User clicks "Team" in sidebar
  ↓
Navigation handler triggers
  ↓
loadStaffList() called
  ↓
GET /api/staff
  Headers: {
    user_access_level: 'manager',
    user_business_code: 'BUS001',
    user_venue_code: 'VEN001'
  }
  ↓
Backend: staffController.getStaffList()
  │
  ├─ Extract access_level, business_code, venue_code from headers
  ├─ Build SQL query with role-based filtering:
  │   │
  │   ├─ system_admin:
  │   │   SELECT * FROM staff WHERE business_code = ?
  │   │
  │   ├─ manager/supervisor:
  │   │   SELECT * FROM staff WHERE venue_code = ?
  │   │
  │   └─ employee:
  │       Return 403 Forbidden
  │
  ├─ JOIN with users, pay_rates, venues tables
  ├─ Execute query
  └─ Return staff array
  ↓
Frontend receives staff data
  ↓
list.js → renderStaffTable()
  │
  ├─ Clear existing table
  ├─ For each staff member:
  │   ├─ Create table row
  │   ├─ Display: avatar, name, code, role, status
  │   ├─ Add action buttons: View, Edit, Delete
  │   └─ Attach event listeners
  └─ Display in #staffList container
```

### 4. Adding New Staff

```
User clicks "Add Staff" button
  ↓
Modal opens (addStaffModal)
  ↓
populateVenueDropdown()
  ├─ Fetch venues from GET /api/staff/venues
  └─ Populate dropdown with accessible venues
  ↓
User fills form and submits
  ↓
handleAddStaff(event)
  ├─ event.preventDefault()
  ├─ Collect form data using FormData API
  ├─ Convert to JSON object
  ├─ Add business_code from current user
  │
  ├─ POST /api/staff
  │   Body: {
  │     first_name, last_name, staff_code,
  │     venue_code, email, password_hash,
  │     weekday_rate, saturday_rate, etc.
  │   }
  │
  ├─ Backend: staffController.addStaff()
  │   │
  │   ├─ Start database transaction
  │   ├─ Validate required fields
  │   ├─ Check for duplicate staff_code/email
  │   │
  │   ├─ INSERT into staff table
  │   ├─ INSERT into users table (email, password_hash, access_level)
  │   ├─ INSERT into pay_rates table (all rates)
  │   ├─ INSERT into staff_compliance table (banking details)
  │   │
  │   ├─ Commit transaction
  │   └─ Return success
  │
  ├─ ✅ Success
  │   ├─ Close modal
  │   ├─ Show success toast
  │   ├─ Reload staff list
  │   └─ Clear form
  │
  └─ ❌ Error
      ├─ Show error toast
      └─ Keep modal open for corrections
```

### 5. Editing Staff

```
User clicks "Edit" button on staff row
  ↓
editStaff(staff_code) called
  ↓
GET /api/staff/:staff_code
  ↓
Backend returns full staff details
  ↓
Open editStaffModal
  ├─ Populate all form fields with existing data
  ├─ Set hidden input: staff_id
  └─ Show modal
  ↓
User modifies fields and submits
  ↓
handleEditStaff(event)
  ├─ Collect form data
  ├─ Include staff_code from hidden field
  │
  ├─ PUT /api/staff/:staff_code
  │   Body: { ...updated_fields }
  │
  ├─ Backend: staffController.updateStaff()
  │   │
  │   ├─ Start transaction
  │   ├─ UPDATE staff table
  │   ├─ UPDATE users table (if email/password changed)
  │   ├─ UPDATE pay_rates table (if rates changed)
  │   ├─ UPDATE staff_compliance table (if banking changed)
  │   ├─ Commit transaction
  │   └─ Return success
  │
  ├─ ✅ Success
  │   ├─ Close modal
  │   ├─ Show success toast
  │   └─ Reload staff list
  │
  └─ ❌ Error
      └─ Show error toast
```

### 6. Deleting Staff

```
User clicks "Delete" button
  ↓
Confirmation dialog appears
  ↓
User confirms deletion
  ↓
deleteStaff(staff_code)
  ↓
DELETE /api/staff/:staff_code
  ↓
Backend: staffController.deleteStaff()
  │
  ├─ Check if staff has active shifts
  │   └─ If yes, prevent deletion (or set employment_status = 'terminated')
  │
  ├─ DELETE from staff table
  │   │
  │   └─ Cascade deletes:
  │       ├─ users (ON DELETE SET NULL → keeps login history)
  │       ├─ pay_rates (ON DELETE CASCADE)
  │       ├─ staff_compliance (ON DELETE CASCADE)
  │       ├─ shifts (ON DELETE CASCADE)
  │       └─ rosters (ON DELETE CASCADE)
  │
  └─ Return success
  ↓
Frontend receives success
  ├─ Show success toast
  ├─ Remove row from table (DOM manipulation)
  └─ Update staff count in dashboard
```

### 7. Dashboard Metrics Calculation

```
loadDashboardMetrics() called
  ↓
GET /api/system-admin/dashboard
  ↓
Backend: dashboardController.getMetrics()
  │
  ├─ Total Staff:
  │   SELECT COUNT(*) FROM staff
  │   WHERE business_code = ? AND employment_status = 'active'
  │
  ├─ Active Shifts:
  │   SELECT COUNT(*) FROM shifts
  │   WHERE shift_state IN ('ACTIVE', 'ON_BREAK')
  │   AND venue_code IN (user's accessible venues)
  │
  ├─ Today's Hours:
  │   SELECT SUM(hours_worked) FROM shifts
  │   WHERE DATE(clock_in) = CURDATE()
  │   AND shift_state = 'COMPLETED'
  │
  └─ Week Total (Pay):
      SELECT SUM(total_pay) FROM shifts
      WHERE clock_in >= start_of_week
      AND clock_in <= end_of_week
      AND approval_status = 'APPROVED'
  ↓
Return metrics object
  ↓
Frontend updates dashboard cards
  ├─ document.getElementById('totalStaff').textContent = data.totalStaff
  ├─ document.getElementById('activeShifts').textContent = data.activeShifts
  ├─ document.getElementById('todayHours').textContent = data.todayHours
  └─ document.getElementById('weekTotal').textContent = '$' + data.weekTotal
```

### 8. API Error Handling & Retry

```
API Request Flow (api.js → apiRequest())
  │
  ├─ Attempt 1
  │   ├─ Add auth headers
  │   ├─ fetch('/api/endpoint')
  │   ├─ Response received
  │   │
  │   ├─ Status 401 (Unauthorized)
  │   │   ├─ Storage.clearUser()
  │   │   ├─ Show toast: "Session expired"
  │   │   └─ Redirect to /index.html
  │   │
  │   ├─ Status 403 (Forbidden)
  │   │   └─ Throw error (no retry)
  │   │
  │   ├─ Status 5xx (Server Error)
  │   │   └─ Retry eligible
  │   │
  │   ├─ Status 429 (Rate Limit)
  │   │   └─ Retry eligible
  │   │
  │   └─ Network Error (no response)
  │       └─ Retry eligible
  │
  ├─ Retry Logic
  │   ├─ Wait: exponential backoff (1s, 2s, 3s)
  │   ├─ Attempt 2 (same as above)
  │   ├─ Attempt 3 (same as above)
  │   └─ Final Attempt
  │
  ├─ ✅ Success (any attempt)
  │   ├─ Parse JSON response
  │   └─ Return data to caller
  │
  └─ ❌ Failure (all attempts exhausted)
      ├─ Extract error message from response
      ├─ Throw error
      └─ Caller handles via try/catch
          └─ showToast(error.message, 'error')
```

### 9. Offline Detection

```
Browser Event: 'offline'
  ↓
setupNetworkDetection() listener
  ↓
showToast('You are now offline. Some features may be unavailable.', 'warning', 5000)
  ↓
User continues working
  ├─ API requests will fail (network error)
  └─ Retry logic will attempt up to 3 times
  ↓
Browser Event: 'online'
  ↓
showToast('You are back online.', 'success', 3000)
  ↓
Pending API requests retry automatically
```

### 10. Responsive Sidebar

```
Mobile View (< 768px)
  │
  ├─ Sidebar position: fixed (off-screen left)
  ├─ Transform: translateX(-100%)
  │
  └─ User clicks hamburger menu
      ├─ sidebarToggle.addEventListener('click')
      ├─ sidebar.classList.toggle('show')
      └─ Transform: translateX(0)  [slide in]

Desktop View (>= 768px)
  │
  ├─ Sidebar visible by default
  ├─ Width: 250px
  │
  └─ Optional: Collapse feature (via sidebarToggle)
      ├─ sidebar.classList.toggle('collapsed')
      ├─ Width: 70px
      ├─ Hide text labels
      └─ Show icons only + tooltips on hover
```

---

## Setup & Installation

### Prerequisites

- Node.js 16+ and npm
- MySQL 8.0+
- Git (optional)

### Database Setup

1. **Create Database:**
```bash
mysql -u root -p
```

```sql
CREATE DATABASE clockin_mysql;
CREATE USER 'appuser'@'localhost' IDENTIFIED BY 'asdfghjkl';
GRANT ALL PRIVILEGES ON clockin_mysql.* TO 'appuser'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

2. **Import Schema:**
```bash
cd /home/vinny/clockin_mysql
mysql -u appuser -p clockin_mysql < schema/01_create_db.sql
mysql -u appuser -p clockin_mysql < schema/02_tables.sql
mysql -u appuser -p clockin_mysql < schema/03_indexes.sql
mysql -u appuser -p clockin_mysql < schema/04_seed.sql
mysql -u appuser -p clockin_mysql < schema/05_alter_breaks.sql
mysql -u appuser -p clockin_mysql < schema/06_sync_log.sql
mysql -u appuser -p clockin_mysql < schema/07_guard_active_shift.sql
mysql -u appuser -p clockin_mysql < schema/09_idx_shifts_venue_state.sql
```

### Backend Setup

1. **Install Dependencies:**
```bash
cd backend
npm install
```

2. **Configure Environment:**
Create `backend/config/env.js`:
```javascript
module.exports = {
  PORT: process.env.PORT || 3000,
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_USER: process.env.DB_USER || 'appuser',
  DB_PASSWORD: process.env.DB_PASSWORD || 'asdfghjkl',
  DB_NAME: process.env.DB_NAME || 'clockin_mysql'
};
```

3. **Update Database Credentials:**
Edit `backend/db.js` if needed (currently hardcoded).

4. **Start Server:**
```bash
# Development (with auto-reload)
npm run dev

# Production
npm start
```

Server runs on: `http://localhost:3000`

### Frontend Setup

1. **Install Dependencies (optional for Tailwind):**
```bash
cd frontend
npm install
```

2. **Access Application:**
Open browser to: `http://localhost:3000`

### Create First Admin User

```sql
-- Insert business
INSERT INTO businesses (business_code, business_name)
VALUES ('BUS001', 'My Company');

-- Insert staff record for system admin (no venue)
INSERT INTO staff (staff_code, business_code, venue_code, first_name, last_name, staff_type)
VALUES ('SYS001', 'BUS001', NULL, 'Admin', 'User', 'system_admin');

-- Insert user login
INSERT INTO users (staff_code, email, password_hash, access_level, status)
VALUES ('SYS001', 'admin@example.com', 'password123', 'system_admin', 'active');
```

**⚠️ Note:** In production, hash the password using bcrypt!

### Verify Installation

1. Open `http://localhost:3000`
2. Login with: `admin@example.com` / `password123`
3. Should redirect to `/master.html` (system admin dashboard)
4. Click "Admin Panel" to access `/admin.html`

---

## Features & Functionality

### Current Features

#### ✅ Implemented

1. **Authentication & Authorization**
   - Login/logout functionality
   - Role-based access control (4 levels)
   - Session persistence (localStorage)
   - Auto-logout on session expiry (401)

2. **Staff Management**
   - View staff list with filtering (venue, status)
   - Add new staff members
   - Edit existing staff
   - Delete staff (with cascade)
   - Comprehensive staff profiles:
     - Personal info
     - Employment details
     - Login credentials
     - Pay rates (5 types)
     - Banking/compliance details

3. **Dashboard**
   - Total staff count
   - Active shifts count
   - Today's hours worked
   - Week's total pay
   - Refresh button

4. **Venue Management**
   - List venues
   - Filter staff by venue
   - Role-based venue access

5. **UI/UX**
   - Responsive design (mobile, tablet, desktop)
   - Dark theme with gradient backgrounds
   - Toast notifications
   - Loading states
   - Error handling
   - Offline detection
   - Collapsible sidebar

6. **API Features**
   - Automatic retry on network errors (3 attempts)
   - Exponential backoff
   - Request deduplication
   - JSON error parsing
   - Auth header injection

#### 🚧 Placeholder/Not Implemented

1. **Schedule Management**
   - Roster creation
   - Shift scheduling
   - Drag-and-drop calendar
   - Conflict detection

2. **Payroll**
   - Payroll reports
   - Export to CSV/PDF
   - Pay period selection
   - Approval workflow

3. **Holidays**
   - Public holiday calendar
   - Custom holiday configuration
   - Holiday pay calculations

4. **Reports & Analytics**
   - Hours worked reports
   - Attendance reports
   - Cost analysis
   - Charts/graphs

5. **Settings**
   - System preferences
   - User management
   - Business configuration
   - Email templates

6. **Recent Activity Feed**
   - Real-time activity log
   - Audit trail
   - Notifications

### Security Considerations

#### Current Vulnerabilities

1. **⚠️ Plaintext Passwords:**
   - `password_hash` field stores passwords in plaintext
   - **Fix:** Implement bcrypt hashing in backend

2. **⚠️ localStorage Auth:**
   - Vulnerable to XSS attacks
   - **Fix:** Migrate to HTTP-only cookies + JWT

3. **⚠️ No CSRF Protection:**
   - **Fix:** Implement CSRF tokens

4. **⚠️ No Rate Limiting:**
   - Vulnerable to brute force attacks
   - **Fix:** Add rate limiting middleware (express-rate-limit)

5. **⚠️ SQL Injection (Potential):**
   - Using mysql2 with parameterized queries (good)
   - Ensure all queries use ? placeholders

6. **⚠️ No Input Validation:**
   - Client-side validation only
   - **Fix:** Add Joi validation in backend

#### Recommendations

```javascript
// 1. Hash passwords (backend)
const bcrypt = require('bcrypt');
const hashedPassword = await bcrypt.hash(password, 10);

// 2. Use HTTP-only cookies
res.cookie('token', jwt.sign(user, SECRET), {
  httpOnly: true,
  secure: true, // HTTPS only
  sameSite: 'strict'
});

// 3. Validate inputs (backend)
const schema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().min(8).required()
});

// 4. Rate limiting
const rateLimit = require('express-rate-limit');
app.use('/api/login', rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5 // 5 attempts
}));

// 5. Sanitize outputs
app.use(helmet()); // Security headers
```

### Performance Optimizations

1. **Database Indexes:**
   - ✅ All foreign keys indexed
   - ✅ Composite indexes on common queries
   - ✅ Index on shift_state for active shifts

2. **Connection Pooling:**
   - ✅ MySQL connection pool (max 10)
   - ✅ Automatic connection recycling

3. **Frontend:**
   - ✅ ES6 modules (tree-shaking capable)
   - ✅ Lazy loading of staff list
   - ✅ Debounced filter inputs (recommended)
   - 🚧 Image lazy loading
   - 🚧 Service worker for offline mode

4. **API:**
   - ✅ Retry logic prevents duplicate requests
   - 🚧 Response caching (Redis)
   - 🚧 Pagination for large datasets

---

## Troubleshooting

### Common Issues

1. **Cannot connect to database**
   ```
   Error: ER_ACCESS_DENIED_ERROR
   ```
   **Solution:** Check `backend/db.js` credentials match MySQL user.

2. **401 Unauthorized on all API requests**
   ```
   Session expired. Redirecting to login...
   ```
   **Solution:** Clear localStorage and re-login.

3. **Staff list not loading**
   - Check browser console for errors
   - Verify `user_business_code` in localStorage
   - Check backend logs for SQL errors

4. **Modal not opening**
   - Ensure Bootstrap JS is loaded
   - Check console for JavaScript errors

5. **Sidebar not responsive**
   - Clear browser cache
   - Check CSS file is loaded correctly

### Debug Mode

Enable debug logging:
```javascript
// frontend/js/utils/logger.js
export const DEBUG = true;

// Or in browser console:
localStorage.setItem('debug', 'true');
```

### Backend Logs

```bash
# View server logs
npm run dev

# Check MySQL logs
sudo tail -f /var/log/mysql/error.log
```

---

## Future Enhancements

### Phase 1: Core Improvements
- [ ] Implement password hashing (bcrypt)
- [ ] Migrate to JWT authentication
- [ ] Add input validation (Joi)
- [ ] Implement pagination for staff list
- [ ] Add search functionality

### Phase 2: Features
- [ ] Schedule/roster management
- [ ] Payroll reports with export
- [ ] Public holiday management
- [ ] Advanced reporting & analytics
- [ ] Email notifications

### Phase 3: Advanced
- [ ] Real-time updates (WebSockets)
- [ ] Mobile app (React Native)
- [ ] Offline mode (Service Workers)
- [ ] Multi-language support
- [ ] Advanced permissions (granular ACL)

---

## Credits

**System Name:** DutyDeck
**Version:** 1.0.0
**Database:** MySQL 8.0
**Framework:** Express.js 4.21
**UI Library:** Bootstrap 5.3

---

## License

Proprietary - All rights reserved

---

## Contact & Support

For support or questions, please contact your system administrator.

**Last Updated:** 2025-10-13
