# Master Admin Panel - Complete Communication Flow Documentation

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Technology Stack](#technology-stack)
3. [Data Flow Diagram](#data-flow-diagram)
4. [Database Schema](#database-schema)
5. [Frontend to Backend Communication](#frontend-to-backend-communication)
6. [Backend to Database Communication](#backend-to-database-communication)
7. [API Endpoints](#api-endpoints)
8. [Form Field Mapping](#form-field-mapping)
9. [Database Insert Operations](#database-insert-operations)
10. [Error Handling](#error-handling)
11. [Security Implementation](#security-implementation)

---

## Architecture Overview

The Master Admin Panel follows a three-tier architecture:

```
┌─────────────────┐
│  Browser (UI)   │  master.html + master.js + master.css
└────────┬────────┘
         │ HTTP/JSON
         │
┌────────▼────────┐
│  Express API    │  server.js + masterRoutes.js
└────────┬────────┘
         │ MySQL2
         │
┌────────▼────────┐
│  MySQL Database │  clockin_mysql
└─────────────────┘
```

---

## Technology Stack

### Frontend
- **HTML5**: Structure and semantic markup
- **CSS3**: Styling via Bootstrap 5.3.0 and custom master.css
- **JavaScript (ES6)**: Client-side logic in master.js
- **Bootstrap 5.3.0**: Responsive UI framework
- **FontAwesome 6.0.0**: Icon library

### Backend
- **Node.js**: Runtime environment
- **Express 4.x**: Web framework
- **MySQL2**: Database driver
- **CORS**: Cross-origin resource sharing

### Database
- **MySQL 8.x**: Relational database management system
- **Database Name**: clockin_mysql

---

## Data Flow Diagram

### Complete Request-Response Cycle

```
User Action (Browser)
    ↓
master.html (Form Input)
    ↓
master.js (Collect Form Data)
    ↓
JavaScript fetch() API
    ↓
HTTP POST/GET Request (JSON)
    ↓
server.js (Express Server - Port 3000)
    ↓
masterRoutes.js (Route Handler)
    ↓
db.js (MySQL Connection Pool)
    ↓
MySQL Database (clockin_mysql)
    ↓
Query Execution & Result
    ↓
JSON Response
    ↓
master.js (Process Response)
    ↓
DOM Update (Display Data)
    ↓
User Sees Result
```

---

## Database Schema

### Core Tables Structure

#### 1. businesses Table
```sql
CREATE TABLE businesses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    business_code VARCHAR(100) NOT NULL UNIQUE,
    business_name VARCHAR(100) NULL,
    status ENUM('active','inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_business_code (business_code)
);
```

**Purpose**: Stores top-level business entities
**Primary Key**: business_code (manual alphanumeric)
**Used By**: Venues reference this via foreign key

#### 2. venues Table
```sql
CREATE TABLE venues (
    id INT AUTO_INCREMENT PRIMARY KEY,
    venue_code VARCHAR(100) NOT NULL UNIQUE,
    business_code VARCHAR(100) NOT NULL,
    venu_name VARCHAR(150) NULL,
    contact_email VARCHAR(100) NOT NULL UNIQUE,
    kiosk_password VARCHAR(255) NOT NULL,
    state VARCHAR(50) NULL,
    venue_address VARCHAR(150) NULL,
    timezone VARCHAR(150),
    week_start ENUM('Mon','Tue','Wed','Thu','Fri','Sat','Sun') DEFAULT 'Mon',
    status ENUM('active','inactive') DEFAULT 'active',
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (business_code) REFERENCES businesses(business_code) ON DELETE CASCADE,
    INDEX idx_venue_code (venue_code),
    INDEX idx_venue_business_code (business_code)
);
```

**Purpose**: Physical locations belonging to businesses
**Primary Key**: venue_code (manual alphanumeric)
**Foreign Key**: business_code → businesses(business_code)

#### 3. staff Table
```sql
CREATE TABLE staff (
    id INT AUTO_INCREMENT PRIMARY KEY,
    staff_code VARCHAR(25) NOT NULL UNIQUE,
    business_code VARCHAR(100) NOT NULL,
    venue_code VARCHAR(100) NOT NULL,
    first_name VARCHAR(50) NOT NULL,
    middle_name VARCHAR(50) NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(150),
    phone_number VARCHAR(30),
    employment_status ENUM('active','inactive','terminated') DEFAULT 'active',
    employment_type ENUM('full_time','part_time','casual','contract') DEFAULT 'full_time',
    role_title VARCHAR(50) NULL,
    start_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (business_code) REFERENCES businesses(business_code) ON DELETE CASCADE,
    FOREIGN KEY (venue_code) REFERENCES venues(venue_code) ON DELETE CASCADE,
    INDEX idx_staff_code (staff_code),
    INDEX idx_staff_business_code (business_code),
    INDEX idx_staff_venue_code (venue_code)
);
```

**Purpose**: Employee records
**Primary Key**: staff_code (manual alphanumeric, max 25 chars)
**Foreign Keys**:
- business_code → businesses(business_code)
- venue_code → venues(venue_code)

#### 4. users Table
```sql
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    business_code VARCHAR(100) NOT NULL,
    venue_code VARCHAR(100) NULL,
    staff_code VARCHAR(25) NULL,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    access_level ENUM('system_admin','manager','supervisor','employee') NOT NULL,
    status ENUM('active','inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (business_code) REFERENCES businesses(business_code) ON DELETE CASCADE,
    FOREIGN KEY (venue_code) REFERENCES venues(venue_code) ON DELETE SET NULL,
    FOREIGN KEY (staff_code) REFERENCES staff(staff_code) ON DELETE SET NULL,
    INDEX idx_user_business_code (business_code),
    INDEX idx_user_venue_code (venue_code),
    INDEX idx_user_staff_code (staff_code)
);
```

**Purpose**: System login credentials
**Primary Key**: id (auto-increment)
**Unique**: username (used for login)
**Foreign Keys**:
- business_code → businesses(business_code)
- venue_code → venues(venue_code) [NULL for system admins]
- staff_code → staff(staff_code)

**Note**: For System Admins created via master panel, venue_code is NULL because they are tied to the business, not a specific venue.

---

## Frontend to Backend Communication

### File: master.js (Frontend JavaScript)

#### 1. Add Business Flow

**Location**: master.js lines 90-117

**Function**: `createBusiness(event)`

**Form Element**: `#businessForm` in master.html

**Trigger**: Form submit event

**Code Flow**:
```javascript
async function createBusiness(event) {
  event.preventDefault();
  const form = event.target;

  // Collect form data
  const payload = {
    code: form.code.value,        // From input name="code"
    name: form.name.value,        // From input name="name"
  };

  // Send POST request
  const res = await fetch("/api/master/business", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  // Process response
  const data = await res.json();

  // Success handling
  if (data.success) {
    alert(`Business "${payload.name}" created successfully!`);
    loadBusinesses();  // Refresh business list
    loadDashboardStats();  // Update dashboard
  }
}
```

**HTTP Request**:
```
POST /api/master/business
Content-Type: application/json

{
  "code": "BUS001",
  "name": "Example Business Pty Ltd"
}
```

**HTTP Response**:
```json
{
  "success": true,
  "business_code": "BUS001",
  "id": 1
}
```

---

#### 2. Add Venue + System Admin Flow

**Location**: master.js lines 124-171

**Function**: `createVenueAndSysAdmin(event)`

**Form Element**: `#venueSysAdminForm` in master.html

**Trigger**: Form submit event

**Code Flow**:
```javascript
async function createVenueAndSysAdmin(event) {
  event.preventDefault();
  const form = event.target;

  // Collect form data from all three sections
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

  // Send POST request
  const res = await fetch("/api/master/venue-with-admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  // Process response
  const data = await res.json();

  if (data.success) {
    alert(`Venue "${data.venue.venue_name}" created with SysAdmin ${data.sysAdmin.email}!`);
    loadVenues();
    loadBusinesses();
    loadDashboardStats();
  }
}
```

**HTTP Request**:
```
POST /api/master/venue-with-admin
Content-Type: application/json

{
  "business_code": "BUS001",
  "venue_code": "VEN001",
  "venue_name": "Main Office",
  "venue_address": "123 Example St, Sydney NSW 2000",
  "state": "NSW",
  "timezone": "Australia/Sydney",
  "week_start": "Mon",
  "contact_email": "kiosk@example.com",
  "kiosk_password": "kiosk123",
  "staff_code": "ADMIN001",
  "first_name": "John",
  "middle_name": "Robert",
  "last_name": "Smith",
  "email": "john.smith@example.com",
  "password": "admin123"
}
```

**HTTP Response**:
```json
{
  "success": true,
  "venue": {
    "venue_code": "VEN001",
    "venue_name": "Main Office"
  },
  "sysAdmin": {
    "user_id": 1,
    "email": "john.smith@example.com"
  }
}
```

---

#### 3. Load Data Functions

**Get All Businesses**:
```javascript
// Location: master.js lines 177-213
async function loadBusinesses() {
  const res = await fetch("/api/master/businesses");
  const data = await res.json();
  // Populate table and dropdown
}
```

**Request**: `GET /api/master/businesses`

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "business_code": "BUS001",
      "business_name": "Example Business",
      "status": "active",
      "created_at": "2025-10-03T06:30:00.000Z"
    }
  ]
}
```

**Get All Venues**:
```javascript
// Location: master.js lines 219-261
async function loadVenues() {
  const res = await fetch("/api/master/venues");
  const data = await res.json();
  // Populate venue table
}
```

**Request**: `GET /api/master/venues`

**Response**:
```json
{
  "success": true,
  "data": [
    {
      "id": "VEN001",
      "venue_name": "Main Office",
      "state": "NSW",
      "location": "123 Example St",
      "contact_email": "kiosk@example.com",
      "status": "active",
      "created_at": "2025-10-03T06:35:00.000Z",
      "business_name": "Example Business"
    }
  ]
}
```

**Get Dashboard Statistics**:
```javascript
// Location: master.js lines 304-344
async function loadDashboardStats() {
  const res = await fetch("/api/master/stats");
  const data = await res.json();
  // Update dashboard cards
}
```

**Request**: `GET /api/master/stats`

**Response**:
```json
{
  "success": true,
  "data": {
    "total_businesses": 5,
    "total_venues": 12,
    "total_staff": 48,
    "hours_this_month": 0,
    "businesses_this_month": 2,
    "businesses_last_month": 1,
    "venues_this_month": 3,
    "venues_last_month": 2,
    "staff_this_month": 8,
    "staff_last_month": 5,
    "hours_last_month": 0,
    "venues_by_state": [
      {"state": "NSW", "venues_per_state": 5},
      {"state": "VIC", "venues_per_state": 4},
      {"state": "QLD", "venues_per_state": 3}
    ]
  }
}
```

---

## Backend to Database Communication

### File: server.js (Express Server Setup)

**Location**: /home/vinny/clockin_mysql/backend/server.js

**Purpose**: Initialize Express server and mount routes

```javascript
const express = require("express");
const cors = require("cors");
const path = require("path");
const masterRoutes = require("./routes/masterRoutes");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, "../frontend")));

// Mount API routes
app.use("/api/master", masterRoutes);

// Start server
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
```

**Key Points**:
- Listens on port 3000
- Serves static files from frontend directory
- All master panel routes are prefixed with /api/master
- CORS enabled for development

---

### File: db.js (Database Connection)

**Location**: /home/vinny/clockin_mysql/backend/db.js

**Purpose**: MySQL connection pool configuration

```javascript
const mysql = require("mysql2");

const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "clockin_mysql",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = db;
```

**Configuration**:
- Host: localhost
- User: root
- Database: clockin_mysql
- Connection pooling enabled (max 10 connections)

---

### File: masterRoutes.js (API Route Handlers)

**Location**: /home/vinny/clockin_mysql/backend/routes/masterRoutes.js

---

## API Endpoints

### 1. GET /api/master/businesses

**Purpose**: Retrieve all businesses

**Handler Code** (lines 10-18):
```javascript
router.get("/businesses", (req, res) => {
  db.query("SELECT * FROM businesses ORDER BY business_name", (err, results) => {
    if (err) {
      console.error("Error fetching businesses:", err);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch businesses"
      });
    }
    res.json({ success: true, data: results });
  });
});
```

**SQL Query**:
```sql
SELECT * FROM businesses ORDER BY business_name
```

**Returns**: Array of business objects

---

### 2. POST /api/master/business

**Purpose**: Create a new business

**Handler Code** (lines 21-62):
```javascript
router.post("/business", (req, res) => {
  const { code, name } = req.body;

  // Validation
  if (!code || !name) {
    return res.status(400).json({
      success: false,
      error: "Business code and name are required"
    });
  }

  // Validate business code format
  const codePattern = /^[A-Za-z0-9]{1,10}$/;
  if (!codePattern.test(code)) {
    return res.status(400).json({
      success: false,
      error: "Business code must be 1-10 alphanumeric characters"
    });
  }

  const query = `
    INSERT INTO businesses (business_code, business_name, status)
    VALUES (?, ?, 'active')
  `;

  db.query(query, [code, name], (err, result) => {
    if (err) {
      console.error("Error adding business:", err);

      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({
          success: false,
          error: "Business code already exists"
        });
      }

      return res.status(500).json({
        success: false,
        error: "Failed to create business"
      });
    }
    res.json({
      success: true,
      business_code: code,
      id: result.insertId
    });
  });
});
```

**SQL Query**:
```sql
INSERT INTO businesses (business_code, business_name, status)
VALUES (?, ?, 'active')
```

**Parameters**:
1. code (from request body)
2. name (from request body)
3. 'active' (hardcoded)

**Validation**:
- Required fields check
- Code format: 1-10 alphanumeric characters
- Duplicate code detection (409 Conflict response)

**Returns**: Success message with business_code and auto-increment id

---

### 3. GET /api/master/venues

**Purpose**: Retrieve all venues with business information

**Handler Code** (lines 68-91):
```javascript
router.get("/venues", (req, res) => {
  const query = `
    SELECT v.venue_code AS id,
           v.venu_name AS venue_name,
           v.state,
           v.venue_address AS location,
           v.contact_email,
           v.status,
           v.created_at,
           b.business_name AS business_name
    FROM venues v
    JOIN businesses b ON v.business_code = b.business_code
    ORDER BY v.venu_name
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error("Error fetching venues:", err);
      return res.status(500).json({
        success: false,
        error: "Failed to fetch venues"
      });
    }
    res.json({ success: true, data: results });
  });
});
```

**SQL Query**:
```sql
SELECT v.venue_code AS id,
       v.venu_name AS venue_name,
       v.state,
       v.venue_address AS location,
       v.contact_email,
       v.status,
       v.created_at,
       b.business_name AS business_name
FROM venues v
JOIN businesses b ON v.business_code = b.business_code
ORDER BY v.venu_name
```

**Join**: venues LEFT JOIN businesses on business_code

**Returns**: Array of venue objects with business names

---

### 4. POST /api/master/venue-with-admin

**Purpose**: Create venue and system admin in a single transaction

**Handler Code** (lines 93-259):

**Step 1: Request Body Extraction**
```javascript
const {
  // Venue Details
  business_code, venue_code, venue_name, venue_address, state, timezone, week_start,
  // Kiosk Details
  contact_email, kiosk_password,
  // System Admin
  staff_code, first_name, middle_name, last_name, email, password
} = req.body;
```

**Step 2: Validation**
```javascript
// Required field validation
if (!business_code || !venue_code || !venue_name || !contact_email || !kiosk_password) {
  return res.status(400).json({
    success: false,
    error: "Required venue fields missing"
  });
}

if (!staff_code || !first_name || !last_name || !email || !password) {
  return res.status(400).json({
    success: false,
    error: "Required admin fields missing"
  });
}

// Code format validation
const codePattern = /^[A-Za-z0-9]+$/;
if (!codePattern.test(venue_code)) {
  return res.status(400).json({
    success: false,
    error: "Venue code must be alphanumeric"
  });
}

if (!codePattern.test(staff_code)) {
  return res.status(400).json({
    success: false,
    error: "Staff code must be alphanumeric"
  });
}
```

**Step 3: Password Handling** (Currently plaintext for testing)
```javascript
// TODO: In production, use bcrypt.hashSync(password, 10)
const kiosk_password_hash = kiosk_password;
const password_hash = password;
const username = email;  // Use email as username
```

**Step 4: Database Transaction**
```javascript
db.getConnection((err, connection) => {
  connection.beginTransaction((err) => {
    // Transaction steps here
  });
});
```

**Transaction Step 1: Insert Venue**
```javascript
const venueQuery = `
  INSERT INTO venues (
    venue_code, business_code, venu_name, state, venue_address,
    contact_email, kiosk_password, timezone, week_start, status
  )
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
`;

connection.query(
  venueQuery,
  [venue_code, business_code, venue_name, state, venue_address,
   contact_email, kiosk_password_hash, timezone, week_start],
  (err, venueResult) => {
    // Error handling with rollback if needed
  }
);
```

**SQL Executed**:
```sql
INSERT INTO venues (
  venue_code, business_code, venu_name, state, venue_address,
  contact_email, kiosk_password, timezone, week_start, status
)
VALUES (
  'VEN001', 'BUS001', 'Main Office', 'NSW', '123 Example St',
  'kiosk@example.com', 'kiosk123', 'Australia/Sydney', 'Mon', 'active'
)
```

**Transaction Step 2: Insert Staff**
```javascript
const staffQuery = `
  INSERT INTO staff (
    staff_code, business_code, venue_code,
    first_name, middle_name, last_name,
    employment_status, role_title
  )
  VALUES (?, ?, ?, ?, ?, ?, 'active', 'System Admin')
`;

connection.query(
  staffQuery,
  [staff_code, business_code, venue_code, first_name, middle_name, last_name],
  (err, staffResult) => {
    // Error handling with rollback if needed
  }
);
```

**SQL Executed**:
```sql
INSERT INTO staff (
  staff_code, business_code, venue_code,
  first_name, middle_name, last_name,
  employment_status, role_title
)
VALUES (
  'ADMIN001', 'BUS001', 'VEN001',
  'John', 'Robert', 'Smith',
  'active', 'System Admin'
)
```

**Transaction Step 3: Insert User** (System Admin Login)
```javascript
const userQuery = `
  INSERT INTO users (
    username, password_hash, access_level, status,
    staff_code, venue_code, business_code
  )
  VALUES (?, ?, 'system_admin', 'active', ?, NULL, ?)
`;

connection.query(
  userQuery,
  [username, password_hash, staff_code, business_code],
  (err, userResult) => {
    // Error handling with rollback if needed
  }
);
```

**SQL Executed**:
```sql
INSERT INTO users (
  username, password_hash, access_level, status,
  staff_code, venue_code, business_code
)
VALUES (
  'john.smith@example.com', 'admin123', 'system_admin', 'active',
  'ADMIN001', NULL, 'BUS001'
)
```

**Important Note**: `venue_code` is explicitly set to NULL for system admins because they are tied to the business, not a specific venue.

**Transaction Step 4: Commit**
```javascript
connection.commit((err) => {
  if (err) {
    return connection.rollback(() => {
      connection.release();
      res.status(500).json({
        success: false,
        error: "Failed to save venue and admin"
      });
    });
  }

  connection.release();
  res.json({
    success: true,
    venue: { venue_code, venue_name },
    sysAdmin: { user_id: userResult.insertId, email }
  });
});
```

**Error Handling**:
- If any step fails, entire transaction is rolled back
- Duplicate key errors return 409 Conflict
- Generic errors return 500 with sanitized message
- Full error details logged to console for debugging

---

### 5. GET /api/master/stats

**Purpose**: Retrieve dashboard statistics

**Handler Code** (lines 266-357):

**Query Structure**: Sequential nested queries

**Queries Executed**:

1. Total businesses count
2. Total venues count
3. Total active staff count
4. Monthly business counts (current and previous month)
5. Monthly venue counts
6. Monthly staff counts
7. Venues grouped by state

**Example SQL**:
```sql
SELECT COUNT(*) as total_businesses FROM businesses;
SELECT COUNT(*) as total_venues FROM venues;
SELECT COUNT(*) as total_staff FROM staff WHERE employment_status='active';
SELECT state, COUNT(*) as venues_per_state FROM venues GROUP BY state;
```

**Returns**: Comprehensive statistics object

---

## Form Field Mapping

### Business Form Field Mapping

| HTML Form Field (master.html) | JavaScript Variable (master.js) | Request Body Key | Database Column (02_tables.sql) | Table |
|-------------------------------|----------------------------------|------------------|----------------------------------|-------|
| `<input name="code">` | `form.code.value` | `code` | `business_code` | businesses |
| `<input name="name">` | `form.name.value` | `name` | `business_name` | businesses |
| N/A (hardcoded) | N/A | N/A | `status = 'active'` | businesses |

---

### Venue + System Admin Form Field Mapping

#### Venue Details Section

| HTML Form Field | JavaScript Variable | Request Body Key | Database Column | Table |
|----------------|---------------------|------------------|-----------------|-------|
| `<select name="business_code">` | `form.business_code.value` | `business_code` | `business_code` | venues |
| `<input name="venue_code">` | `form.venue_code.value` | `venue_code` | `venue_code` | venues |
| `<input name="venue_name">` | `form.venue_name.value` | `venue_name` | `venu_name` | venues |
| `<input name="venue_address">` | `form.venue_address.value` | `venue_address` | `venue_address` | venues |
| `<select name="state">` | `form.state.value` | `state` | `state` | venues |
| `<select name="timezone">` | `form.timezone.value` | `timezone` | `timezone` | venues |
| `<select name="week_start">` | `form.week_start.value` | `week_start` | `week_start` | venues |
| N/A (hardcoded) | N/A | N/A | `status = 'active'` | venues |

#### Kiosk Details Section

| HTML Form Field | JavaScript Variable | Request Body Key | Database Column | Table |
|----------------|---------------------|------------------|-----------------|-------|
| `<input name="contact_email">` | `form.contact_email.value` | `contact_email` | `contact_email` | venues |
| `<input name="kiosk_password">` | `form.kiosk_password.value` | `kiosk_password` | `kiosk_password` | venues |

#### System Admin Section

| HTML Form Field | JavaScript Variable | Request Body Key | Database Column | Table |
|----------------|---------------------|------------------|-----------------|-------|
| `<input name="staff_code">` | `form.staff_code.value` | `staff_code` | `staff_code` | staff |
| `<input name="first_name">` | `form.first_name.value` | `first_name` | `first_name` | staff |
| `<input name="middle_name">` | `form.middle_name.value` | `middle_name` | `middle_name` | staff |
| `<input name="last_name">` | `form.last_name.value` | `last_name` | `last_name` | staff |
| N/A (hardcoded) | N/A | N/A | `employment_status = 'active'` | staff |
| N/A (hardcoded) | N/A | N/A | `role_title = 'System Admin'` | staff |
| `<input name="email">` | `form.email.value` | `email` | `username` | users |
| `<input name="password">` | `form.password.value` | `password` | `password_hash` | users |
| N/A (hardcoded) | N/A | N/A | `access_level = 'system_admin'` | users |
| N/A (hardcoded) | N/A | N/A | `status = 'active'` | users |
| Derived from `email` | `username = email` | N/A | `username` | users |
| Copied from form | `staff_code` | `staff_code` | `staff_code` | users |
| Copied from form | `business_code` | `business_code` | `business_code` | users |
| N/A (hardcoded NULL) | N/A | N/A | `venue_code = NULL` | users |

**Important Notes**:
- `business_code` is used in venues, staff, and users tables
- `venue_code` is used in staff table but NULL in users table for system admins
- `staff_code` links staff and users tables
- `email` from form becomes `username` in users table
- Several fields are hardcoded in backend for security (access_level, role_title, status)

---

## Database Insert Operations

### Operation 1: Create Business

**Trigger**: User submits business form

**Frontend**: master.js `createBusiness()`

**Backend**: masterRoutes.js POST /api/master/business

**Database Operation**:
```sql
INSERT INTO businesses (business_code, business_name, status)
VALUES ('BUS001', 'Example Business', 'active');
```

**Result**:
- New row in businesses table
- Auto-increment id generated
- business_code is unique constraint
- created_at timestamp auto-populated

---

### Operation 2: Create Venue + System Admin

**Trigger**: User submits venue + admin form

**Frontend**: master.js `createVenueAndSysAdmin()`

**Backend**: masterRoutes.js POST /api/master/venue-with-admin

**Database Transaction** (All-or-nothing):

**Insert 1 - venues table**:
```sql
INSERT INTO venues (
  venue_code, business_code, venu_name, state, venue_address,
  contact_email, kiosk_password, timezone, week_start, status
)
VALUES (
  'VEN001',
  'BUS001',
  'Main Office',
  'NSW',
  '123 Example St, Sydney NSW 2000',
  'kiosk@example.com',
  'kiosk123',
  'Australia/Sydney',
  'Mon',
  'active'
);
```

**Constraints Checked**:
- venue_code must be unique
- business_code must exist in businesses table (foreign key)
- contact_email must be unique

**Insert 2 - staff table**:
```sql
INSERT INTO staff (
  staff_code, business_code, venue_code,
  first_name, middle_name, last_name,
  employment_status, role_title
)
VALUES (
  'ADMIN001',
  'BUS001',
  'VEN001',
  'John',
  'Robert',
  'Smith',
  'active',
  'System Admin'
);
```

**Constraints Checked**:
- staff_code must be unique
- business_code must exist in businesses table (foreign key)
- venue_code must exist in venues table (foreign key)

**Insert 3 - users table**:
```sql
INSERT INTO users (
  username, password_hash, access_level, status,
  staff_code, venue_code, business_code
)
VALUES (
  'john.smith@example.com',
  'admin123',
  'system_admin',
  'active',
  'ADMIN001',
  NULL,
  'BUS001'
);
```

**Constraints Checked**:
- username must be unique
- staff_code must exist in staff table (foreign key)
- business_code must exist in businesses table (foreign key)
- venue_code can be NULL (set to NULL for system admins)

**Transaction Behavior**:
- If ALL three inserts succeed: COMMIT (all changes saved)
- If ANY insert fails: ROLLBACK (all changes discarded)

**Example Failure Scenario**:
```
1. Insert venue: SUCCESS
2. Insert staff: SUCCESS
3. Insert user: FAIL (duplicate username)
   → ROLLBACK triggered
   → Venue and staff records removed
   → Database remains in original state
```

---

## Error Handling

### Frontend Error Handling (master.js)

**Network Errors**:
```javascript
try {
  const res = await fetch("/api/master/business", {...});
  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.error || "Failed to create business");
  }
} catch (err) {
  console.error("Business creation error:", err);
  alert("Failed to create business: " + err.message);
}
```

**User Notifications**:
- Success: JavaScript `alert()` with success message
- Failure: JavaScript `alert()` with error message

---

### Backend Error Handling (masterRoutes.js)

**Error Types and Responses**:

**1. Validation Errors (400 Bad Request)**:
```javascript
if (!code || !name) {
  return res.status(400).json({
    success: false,
    error: "Business code and name are required"
  });
}
```

**2. Duplicate Key Errors (409 Conflict)**:
```javascript
if (err.code === 'ER_DUP_ENTRY') {
  return res.status(409).json({
    success: false,
    error: "Business code already exists"
  });
}
```

**3. Database Errors (500 Internal Server Error)**:
```javascript
if (err) {
  console.error("Error adding business:", err);  // Log full error
  return res.status(500).json({
    success: false,
    error: "Failed to create business"  // Sanitized message
  });
}
```

**Error Sanitization**:
- Full MySQL errors logged to server console (for developers)
- Generic user-friendly messages sent to client (for security)
- No schema information exposed in responses

---

## Security Implementation

### Current Security Measures

**1. SQL Injection Prevention**:
```javascript
// BAD - Vulnerable to SQL injection
const query = `INSERT INTO businesses VALUES ('${code}', '${name}')`;

// GOOD - Using parameterized queries
const query = `INSERT INTO businesses (business_code, business_name) VALUES (?, ?)`;
db.query(query, [code, name], callback);
```

All queries use parameterized statements with `?` placeholders.

**2. Input Validation**:

**Business Code**:
```javascript
const codePattern = /^[A-Za-z0-9]{1,10}$/;
if (!codePattern.test(code)) {
  return res.status(400).json({
    error: "Business code must be 1-10 alphanumeric characters"
  });
}
```

**Venue and Staff Codes**:
```javascript
const codePattern = /^[A-Za-z0-9]+$/;
if (!codePattern.test(venue_code)) {
  return res.status(400).json({
    error: "Venue code must be alphanumeric"
  });
}
```

**3. Error Message Sanitization**:
- MySQL errors never exposed to client
- Generic messages: "Failed to create business"
- Detailed errors only in server logs

**4. Database Constraints**:
- UNIQUE constraints on business_code, venue_code, staff_code
- FOREIGN KEY constraints maintain referential integrity
- CASCADE deletes prevent orphaned records

**5. Transaction Safety**:
- Atomic operations for multi-table inserts
- ROLLBACK on any failure
- Data consistency guaranteed

---

### Security Items for Production (Not Yet Implemented)

**1. Password Hashing**:

**Current** (Testing Only):
```javascript
const password_hash = password;  // Plaintext storage
```

**Production** (TODO):
```javascript
const bcrypt = require('bcryptjs');
const password_hash = bcrypt.hashSync(password, 10);
```

**2. Authentication & Authorization**:
- No JWT tokens implemented yet
- No session management
- Anyone can access /api/master/* endpoints

**Production Requirement**: Implement JWT-based authentication

**3. CORS Configuration**:

**Current**:
```javascript
app.use(cors());  // Allows all origins
```

**Production**:
```javascript
app.use(cors({
  origin: 'https://yourdomain.com',
  credentials: true
}));
```

**4. Rate Limiting**:
- No rate limiting on API endpoints
- Vulnerable to brute force attacks

**Production Requirement**: Implement express-rate-limit

**5. HTTPS**:
- Currently HTTP only
- Credentials transmitted in plaintext

**Production Requirement**: SSL/TLS certificates required

---

## Complete Request Flow Example

### Example: Creating a Venue with System Admin

**Step 1: User Fills Form** (master.html)
```
Business: BUS001 (selected from dropdown)
Venue Code: VEN001
Venue Name: Sydney Office
Address: 100 George St, Sydney NSW 2000
State: NSW
Timezone: Australia/Sydney
Week Start: Mon
Venue Email: kiosk.sydney@company.com
Venue Password: kiosk2024
Staff Code: SADMIN01
First Name: Jane
Middle Name: Marie
Last Name: Doe
Email: jane.doe@company.com
Password: admin2024
```

**Step 2: Form Submit Triggers JavaScript** (master.js:124)
```javascript
async function createVenueAndSysAdmin(event) {
  event.preventDefault();

  const payload = {
    business_code: "BUS001",
    venue_code: "VEN001",
    venue_name: "Sydney Office",
    venue_address: "100 George St, Sydney NSW 2000",
    state: "NSW",
    timezone: "Australia/Sydney",
    week_start: "Mon",
    contact_email: "kiosk.sydney@company.com",
    kiosk_password: "kiosk2024",
    staff_code: "SADMIN01",
    first_name: "Jane",
    middle_name: "Marie",
    last_name: "Doe",
    email: "jane.doe@company.com",
    password: "admin2024"
  };

  const res = await fetch("/api/master/venue-with-admin", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
}
```

**Step 3: HTTP Request Sent**
```
POST http://localhost:3000/api/master/venue-with-admin
Content-Type: application/json

{
  "business_code": "BUS001",
  "venue_code": "VEN001",
  "venue_name": "Sydney Office",
  "venue_address": "100 George St, Sydney NSW 2000",
  "state": "NSW",
  "timezone": "Australia/Sydney",
  "week_start": "Mon",
  "contact_email": "kiosk.sydney@company.com",
  "kiosk_password": "kiosk2024",
  "staff_code": "SADMIN01",
  "first_name": "Jane",
  "middle_name": "Marie",
  "last_name": "Doe",
  "email": "jane.doe@company.com",
  "password": "admin2024"
}
```

**Step 4: Express Server Receives Request** (server.js)
```
→ CORS middleware (allows request)
→ JSON body parser (parses request body)
→ Routes to /api/master handler
→ masterRoutes.js handles request
```

**Step 5: Backend Validates Input** (masterRoutes.js:104-133)
```javascript
// Check required fields
if (!business_code || !venue_code || !venue_name ||
    !contact_email || !kiosk_password) {
  return 400 Bad Request
}

if (!staff_code || !first_name || !last_name ||
    !email || !password) {
  return 400 Bad Request
}

// Validate code formats
if (!/^[A-Za-z0-9]+$/.test(venue_code)) {
  return 400 Bad Request
}

if (!/^[A-Za-z0-9]+$/.test(staff_code)) {
  return 400 Bad Request
}

// All validations passed
```

**Step 6: Database Connection Pool** (db.js)
```javascript
db.getConnection((err, connection) => {
  // Connection acquired from pool
  // Begin transaction
});
```

**Step 7: Transaction Begins** (masterRoutes.js:147)
```javascript
connection.beginTransaction((err) => {
  // Transaction started
  // All subsequent queries part of same transaction
});
```

**Step 8: Insert Venue** (masterRoutes.js:155-179)
```sql
INSERT INTO venues (
  venue_code, business_code, venu_name, state, venue_address,
  contact_email, kiosk_password, timezone, week_start, status
)
VALUES (
  'VEN001',
  'BUS001',
  'Sydney Office',
  'NSW',
  '100 George St, Sydney NSW 2000',
  'kiosk.sydney@company.com',
  'kiosk2024',
  'Australia/Sydney',
  'Mon',
  'active'
);

-- Result: 1 row inserted into venues table
```

**Step 9: Insert Staff** (masterRoutes.js:181-206)
```sql
INSERT INTO staff (
  staff_code, business_code, venue_code,
  first_name, middle_name, last_name,
  employment_status, role_title
)
VALUES (
  'SADMIN01',
  'BUS001',
  'VEN001',
  'Jane',
  'Marie',
  'Doe',
  'active',
  'System Admin'
);

-- Result: 1 row inserted into staff table
```

**Step 10: Insert User** (masterRoutes.js:208-233)
```sql
INSERT INTO users (
  username, password_hash, access_level, status,
  staff_code, venue_code, business_code
)
VALUES (
  'jane.doe@company.com',
  'admin2024',
  'system_admin',
  'active',
  'SADMIN01',
  NULL,
  'BUS001'
);

-- Result: 1 row inserted into users table
-- Note: venue_code is NULL for system admins
```

**Step 11: Transaction Commit** (masterRoutes.js:235-250)
```javascript
connection.commit((err) => {
  if (err) {
    // Rollback all changes
    connection.rollback();
  } else {
    // All changes committed to database
    connection.release();
  }
});
```

**Step 12: Success Response Sent**
```json
HTTP 200 OK
Content-Type: application/json

{
  "success": true,
  "venue": {
    "venue_code": "VEN001",
    "venue_name": "Sydney Office"
  },
  "sysAdmin": {
    "user_id": 15,
    "email": "jane.doe@company.com"
  }
}
```

**Step 13: Frontend Receives Response** (master.js:157-167)
```javascript
const data = await res.json();

if (data.success) {
  alert(`Venue "${data.venue.venue_name}" created with SysAdmin ${data.sysAdmin.email}!`);
  form.reset();
  hideAddVenueForm();
  loadVenues();
  loadBusinesses();
  loadDashboardStats();
}
```

**Step 14: UI Updates**
```
→ Alert shown to user
→ Form hidden and reset
→ Venue list refreshed
→ Business dropdown refreshed
→ Dashboard stats updated
→ User sees new venue in table
```

**Final Database State**:

**venues table**:
```
| id | venue_code | business_code | venu_name     | state | venue_address              | ... |
|----|-----------|---------------|---------------|-------|----------------------------|-----|
| 5  | VEN001    | BUS001        | Sydney Office | NSW   | 100 George St, Sydney...   | ... |
```

**staff table**:
```
| id | staff_code | business_code | venue_code | first_name | middle_name | last_name | role_title   | ... |
|----|-----------|---------------|------------|------------|-------------|-----------|--------------|-----|
| 8  | SADMIN01  | BUS001        | VEN001     | Jane       | Marie       | Doe       | System Admin | ... |
```

**users table**:
```
| id | username                | password_hash | access_level  | staff_code | venue_code | business_code | ... |
|----|------------------------|---------------|---------------|------------|-----------|---------------|-----|
| 15 | jane.doe@company.com   | admin2024     | system_admin  | SADMIN01   | NULL      | BUS001        | ... |
```

---

## Development and Testing Guide

### Running the Application

**1. Start MySQL Server**:
```bash
# Ensure MySQL is running
sudo systemctl start mysql
# or
sudo service mysql start
```

**2. Load Database Schema**:
```bash
mysql -u root -p
USE clockin_mysql;
SOURCE /home/vinny/clockin_mysql/schema/02_tables.sql;
SHOW TABLES;
```

**3. Start Backend Server**:
```bash
cd /home/vinny/clockin_mysql/backend
node server.js

# Output: Server running at http://localhost:3000
```

**4. Access Frontend**:
```
Open browser: http://localhost:3000/master.html
```

### Testing Workflow

**Test 1: Create Business**
```
1. Navigate to Businesses section
2. Click "Add New Business"
3. Enter code: TEST01
4. Enter name: Test Company
5. Submit
6. Verify success message
7. Check database: SELECT * FROM businesses WHERE business_code = 'TEST01';
```

**Test 2: Create Venue + Admin**
```
1. Navigate to Venues section
2. Click "Add Venue + System Admin"
3. Fill all fields
4. Submit
5. Verify success message
6. Check database:
   SELECT * FROM venues WHERE venue_code = 'your_code';
   SELECT * FROM staff WHERE staff_code = 'your_staff_code';
   SELECT * FROM users WHERE username = 'your_email';
```

**Test 3: Error Handling**
```
1. Try duplicate business code → Should show "Business code already exists"
2. Try invalid code format (special chars) → Should show validation error
3. Try missing required field → Should show "required" error
```

### Common Troubleshooting

**Problem**: Cannot connect to database
```
Error: Access denied for user 'root'@'localhost'

Solution: Check db.js credentials
```

**Problem**: Foreign key constraint fails
```
Error: Cannot add or update a child row: a foreign key constraint fails

Solution: Ensure parent record exists (e.g., business_code must exist before adding venue)
```

**Problem**: Duplicate entry error
```
Error: Duplicate entry 'BUS001' for key 'business_code'

Solution: Use unique codes for each business/venue/staff
```

---

## File Structure Reference

```
/home/vinny/clockin_mysql/
│
├── backend/
│   ├── server.js              # Express server setup
│   ├── db.js                  # MySQL connection configuration
│   ├── routes/
│   │   └── masterRoutes.js    # API route handlers
│   ├── package.json
│   └── node_modules/
│
├── frontend/
│   ├── master.html            # UI structure
│   ├── js/
│   │   └── master.js          # Client-side logic
│   └── css/
│       └── master.css         # Styling
│
└── schema/
    ├── 01_create_db.sql       # Database creation
    ├── 02_tables.sql          # Table definitions
    ├── 03_indexes.sql         # Index creation
    └── 04_seed.sql            # Sample data
```

---

## Summary

This master admin panel provides a complete business management interface with the following features:

**Capabilities**:
- Create and manage businesses
- Create venues with integrated system admin accounts
- View dashboard statistics
- Secure transaction-based operations
- Input validation and error handling

**Technology Integration**:
- Frontend: HTML5, Bootstrap, vanilla JavaScript
- Backend: Node.js, Express, MySQL2
- Database: MySQL with proper foreign key relationships

**Data Integrity**:
- Atomic transactions for multi-table operations
- Foreign key constraints
- Unique constraints on codes and emails
- Rollback on failures

**For Developers**:
- All API endpoints documented with request/response examples
- Complete field mapping from form to database
- SQL queries shown for each operation
- Error handling patterns explained
- Security considerations outlined

This documentation serves as a complete reference for understanding, maintaining, and extending the master admin panel functionality.

---

**Document Version**: 1.0
**Last Updated**: 2025-10-03
**Author**: System Documentation
**Project**: DutyDeck Clock-in System
