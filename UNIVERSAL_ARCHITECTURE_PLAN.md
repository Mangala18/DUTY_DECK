# Universal Architecture Implementation Plan

## Overview
This document outlines the step-by-step plan to refactor the DUTY_DECK backend into a universal, maintainable architecture that eliminates code duplication and ensures consistent behavior across all modules.

## Current State Analysis

### Existing Structure
```
backend/
├── config/
│   └── db.js (exists - mysql2 pool)
├── controllers/
│   ├── staffController.js (exists)
│   ├── payrollController.js (new - unreviewed)
│   ├── scheduleController.js (new - unreviewed)
│   ├── timesheetController.js (new - unreviewed)
│   └── venueController.js (new - unreviewed)
├── routes/
│   ├── auth.js
│   ├── dashboardRoutes.js
│   ├── kiosk.js
│   ├── masterRoutes.js
│   └── systemAdminRoutes.js
├── utils/
│   ├── response.js (exists)
│   ├── storage.js
│   └── accessHelper.js (exists)
└── models/
    └── staffModel.js
```

### Problems Identified
1. **Repeated authentication context logic** in every controller
2. **Inconsistent transaction handling** (callbacks vs async/await)
3. **Duplicate business/venue validation** across routes
4. **No centralized error handling**
5. **Inconsistent logging patterns**
6. **Manual context passing** from frontend

---

## Implementation Plan

### Phase 1: Core Infrastructure (Foundation)

#### 1.1 Create Middleware Directory
**Files to create:**
- `backend/middleware/authContext.js`
- `backend/middleware/dbTransaction.js`
- `backend/middleware/errorHandler.js`

#### 1.2 Create Enhanced Config
**Files to create:**
- `backend/config/logger.js` (winston or pino)
- `backend/config/env.js` (centralized environment variables)

#### 1.3 Enhance Utils
**Files to update/create:**
- `backend/utils/response.js` (already exists, enhance if needed)
- `backend/utils/validator.js` (new)
- `backend/utils/sqlHelpers.js` (new - optional)

---

### Phase 2: Middleware Implementation

#### 2.1 Auth Context Middleware (`authContext.js`)
**Purpose:** Extract and validate business/venue context from JWT/session

**Features:**
- Decode JWT token to extract user context
- Validate business_code presence
- Attach `req.userContext` with:
  - `business_code`
  - `venue_code`
  - `access_level`
  - `staff_code`
  - `email`
- Return 401 if context invalid

**Dependencies:**
- Existing JWT verification middleware
- Token stored in `localStorage` on frontend

#### 2.2 Database Transaction Middleware (`dbTransaction.js`)
**Purpose:** Wrap route handlers with automatic transaction management

**Features:**
- Get DB connection from pool
- Begin transaction
- Attach `req.db` connection to request
- Auto-commit on success
- Auto-rollback on error
- Release connection in finally block
- Comprehensive error logging

**Usage Pattern:**
```javascript
router.post('/staff', withTransaction(addStaff));
```

#### 2.3 Error Handler Middleware (`errorHandler.js`)
**Purpose:** Catch and format all errors consistently

**Features:**
- Handle MySQL error codes (ER_DUP_ENTRY, ER_NO_DEFAULT_FOR_FIELD, etc.)
- Format validation errors
- Log errors with context
- Return consistent JSON error response
- Different handling for dev vs production

---

### Phase 3: Configuration Enhancements

#### 3.1 Logger Configuration (`config/logger.js`)
**Library:** Winston or Pino

**Features:**
- Structured logging (JSON format)
- Log levels: error, warn, info, debug
- File rotation for production
- Pretty printing for development
- Include timestamp, request ID, user context

#### 3.2 Environment Configuration (`config/env.js`)
**Purpose:** Centralize all environment variables

**Variables:**
- `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `JWT_SECRET`, `JWT_EXPIRY`
- `PORT`, `NODE_ENV`
- `LOG_LEVEL`

---

### Phase 4: Database Schema Standardization

#### 4.1 Required Columns for All Tables
Ensure every table has:
```sql
business_code VARCHAR(50) NOT NULL,
venue_code VARCHAR(50) DEFAULT NULL,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
```

#### 4.2 Foreign Key Constraints
Add referential integrity:
```sql
-- Staff to Venue
ALTER TABLE staff
  ADD CONSTRAINT fk_staff_venue
  FOREIGN KEY (venue_code) REFERENCES venues(venue_code)
  ON DELETE RESTRICT;

-- Venue to Business
ALTER TABLE venues
  ADD CONSTRAINT fk_venue_business
  FOREIGN KEY (business_code) REFERENCES businesses(business_code)
  ON DELETE RESTRICT;

-- Pay Rates to Staff
ALTER TABLE pay_rates
  ADD CONSTRAINT fk_payrates_staff
  FOREIGN KEY (staff_code) REFERENCES staff(staff_code)
  ON DELETE CASCADE;

-- Users to Staff
ALTER TABLE users
  ADD CONSTRAINT fk_users_staff
  FOREIGN KEY (staff_code) REFERENCES staff(staff_code)
  ON DELETE CASCADE;
```

#### 4.3 Tables to Review
- `staff` ✓ (has business_code, venue_code)
- `venues` ✓ (has business_code)
- `businesses` ✓ (root table)
- `users` ✓ (has staff_code)
- `pay_rates` - needs verification
- `staff_compliance` - needs verification
- `timesheets` - needs verification
- `schedules` - needs verification
- `payroll` - needs verification

---

### Phase 5: Controller Migration

#### 5.1 Update staffController.js
**Changes:**
- Remove manual `db.getConnection()` logic
- Use `req.db` from transaction middleware
- Use `req.userContext` instead of manual extraction
- Use centralized `logger` instead of `console.log`
- Simplify error handling (let middleware catch)

#### 5.2 Migrate Other Controllers
In priority order:
1. `venueController.js`
2. `payrollController.js`
3. `timesheetController.js`
4. `scheduleController.js`

---

### Phase 6: Route Updates

#### 6.1 System Admin Routes
**File:** `backend/routes/systemAdminRoutes.js`

**Updates:**
- Apply `authContext` middleware to all routes
- Wrap POST/PUT/DELETE routes with `withTransaction`
- Remove manual context validation

**Example:**
```javascript
const { authContext } = require('../middleware/authContext');
const { withTransaction } = require('../middleware/dbTransaction');

router.use(authContext); // Apply to all routes

router.get('/staff', staffController.getStaffList);
router.post('/staff', withTransaction(staffController.addStaff));
router.put('/staff/:staff_code', withTransaction(staffController.updateStaff));
```

#### 6.2 Other Route Files
- `masterRoutes.js`
- `dashboardRoutes.js`
- `kiosk.js`
- `auth.js` (may need special handling)

---

### Phase 7: Frontend Unification

#### 7.1 Create Context Utility
**File:** `frontend/js/utils/context.js`

**Purpose:** Single source of truth for user context

**Functions:**
```javascript
export const getContext = () => ({
  business_code: localStorage.getItem('business_code'),
  venue_code: localStorage.getItem('venue_code') || '',
  access_level: localStorage.getItem('access_level'),
  staff_code: localStorage.getItem('staff_code'),
  email: localStorage.getItem('email')
});

export const setContext = (context) => {
  Object.keys(context).forEach(key => {
    localStorage.setItem(key, context[key]);
  });
};

export const clearContext = () => {
  localStorage.removeItem('business_code');
  localStorage.removeItem('venue_code');
  localStorage.removeItem('access_level');
  localStorage.removeItem('staff_code');
  localStorage.removeItem('email');
};
```

#### 7.2 Update Frontend Modules
Replace scattered `localStorage` calls with:
```javascript
import { getContext } from '../utils/context.js';
const { business_code, venue_code } = getContext();
```

**Files to update:**
- `frontend/js/admin/admin.js`
- `frontend/js/admin/staff/index.js`
- `frontend/js/admin/staff/list.js`
- `frontend/js/admin/payroll.js`
- `frontend/js/admin/schedule.js`
- `frontend/js/admin/timesheet.js`
- `frontend/js/admin/venue.js`

---

### Phase 8: Testing & Validation

#### 8.1 Test Cases
- [ ] Staff creation with new architecture
- [ ] Staff list filtering by business/venue
- [ ] Transaction rollback on error
- [ ] Duplicate entry handling
- [ ] Cross-business isolation (user from Business A cannot access Business B data)
- [ ] Logging output verification

#### 8.2 Database Integrity Tests
- [ ] Foreign key constraints prevent orphaned records
- [ ] Cannot insert staff without valid venue
- [ ] Cannot insert venue without valid business

---

## Implementation Order (Recommended)

### Week 1: Foundation
1. ✓ Create `middleware/authContext.js`
2. ✓ Create `middleware/dbTransaction.js`
3. ✓ Create `middleware/errorHandler.js`
4. ✓ Create `config/logger.js`
5. ✓ Test middleware in isolation

### Week 2: Database & Controllers
1. ✓ Review and update database schema
2. ✓ Add foreign key constraints
3. ✓ Migrate `staffController.js` to new architecture
4. ✓ Update `systemAdminRoutes.js` to use middleware
5. ✓ Test staff operations end-to-end

### Week 3: Expand to Other Modules
1. ✓ Migrate `venueController.js`
2. ✓ Migrate `payrollController.js`
3. ✓ Migrate `timesheetController.js`
4. ✓ Migrate `scheduleController.js`
5. ✓ Update all route files

### Week 4: Frontend & Polish
1. ✓ Create `frontend/js/utils/context.js`
2. ✓ Update all frontend modules
3. ✓ Comprehensive testing
4. ✓ Documentation updates
5. ✓ Performance optimization

---

## Benefits After Implementation

### For Developers
- **80% less boilerplate code** in new controllers
- **Consistent patterns** across all modules
- **Easier debugging** with centralized logging
- **Faster development** of new features

### For System
- **Database-level security** preventing cross-business leaks
- **Automatic transaction safety** - no missed rollbacks
- **Consistent API responses** - easier frontend integration
- **Better error tracking** - structured logs

### For Users
- **More reliable operations** - fewer bugs from inconsistent handling
- **Better error messages** - consistent, user-friendly responses
- **Improved performance** - optimized connection pooling

---

## Rollback Plan

If issues arise:
1. **Middleware issues:** Can be disabled by removing from route registration
2. **Controller issues:** Keep old controller versions in `controllers/legacy/`
3. **Database issues:** Foreign keys can be dropped if needed
4. **Frontend issues:** Context utility is additive, doesn't break existing code

---

## Success Metrics

- [ ] All controllers use `req.userContext` (no manual extraction)
- [ ] All write operations use `withTransaction` middleware
- [ ] All routes use `authContext` middleware
- [ ] All errors use centralized error handler
- [ ] All logs use centralized logger
- [ ] All API responses follow consistent format
- [ ] Zero cross-business data leaks in testing
- [ ] Database foreign key constraints enforced

---

## Questions to Resolve

1. **JWT Implementation:** Is JWT already implemented or still using session-based auth?
2. **Logger Preference:** Winston vs Pino vs simple console wrapper?
3. **Error Responses:** Should error messages be user-friendly or technical in production?
4. **Transaction Scope:** Should ALL database operations use transactions, or only multi-table operations?
5. **Existing Data:** Are there existing records that violate foreign key constraints?

---

## Next Steps

1. Review this plan with the team
2. Answer the questions above
3. Set up development branch for refactoring
4. Begin Phase 1 implementation
5. Continuous testing during migration
