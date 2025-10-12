# Admin.html Database Logging Guide

Enhanced logging has been added to track how admin.html interacts with the database.

## What's Been Added

### 1. Staff Controller Logging (`backend/controllers/staffController.js`)
- **GET /api/system-admin/staff/venues** - Fetching venues list
- **GET /api/system-admin/staff** - Fetching staff list with filters
- **GET /api/system-admin/staff/:staff_code** - Fetching single staff details

### 2. Master Routes Logging (`backend/routes/masterRoutes.js`)
- **GET /api/master/venue/:venue_code** - Fetching venue details for editing
- **PUT /api/master/venue-with-admin/:venue_code** - Updating venue and admin

## How to View the Logs

### Step 1: Restart the Backend Server

The server is currently running. You need to restart it to load the new logging code:

```bash
# Find the running server process
ps aux | grep "node server.js" | grep -v grep

# Stop it (Ctrl+C in the terminal where it's running, or):
kill 1908

# Then restart
cd /home/vinny/clockin_mysql/backend
npm start
```

### Step 2: Open admin.html in Browser

```
http://localhost:3000/admin.html
```

### Step 3: Watch the Terminal Logs

As you interact with admin.html, you'll see detailed logs like:

## Example Log Output

### When Loading Venues:
```
[GET /staff/venues] 👤 User context: {
  "access_level": "system_admin",
  "business_code": "B001",
  "venue_code": null
}
[GET /staff/venues] 🔍 Query: SELECT venue_code, venue_name, venue_address, state, status FROM venues WHERE status = 'active' AND business_code = ? ORDER BY venue_name ASC
[GET /staff/venues] 📝 Params: [ 'B001' ]
[GET /staff/venues] ✅ Results count: 3
```

### When Loading Staff List:
```
[GET /staff] 👤 User context: {
  "access_level": "system_admin",
  "business_code": "B001",
  "venue_code": null
}
[GET /staff] 📥 Query params: {
  "venue_code": "V001",
  "status": "active"
}
[GET /staff] 🔐 Access conditions: [ 's.business_code = ?', 's.venue_code = ?', "s.employment_status = 'active'" ]
[GET /staff] 📝 Params: [ 'B001', 'V001' ]
[GET /staff] 🔍 Query: SELECT s.staff_code, CONCAT(s.first_name, ' ', IFNULL(CONCAT(s.middle_name, ' '), ''), s.last_name) AS full_name, ...
[GET /staff] ✅ Results count: 5
[GET /staff] ✅ First result sample: {
  "staff_code": "S001",
  "full_name": "John Doe",
  "role_title": "Manager",
  ...
}
```

### When Editing a Venue (from master.html):
```
[GET /venue/V001] Query: SELECT v.venue_code, v.venue_name AS venue_name, v.venue_address, v.state...
[GET /venue/V001] Params: [ 'V001' ]
[GET /venue/V001] ✅ Results: [
  {
    "venue_code": "V001",
    "venue_name": "Main Venue",
    "venue_address": "123 Main St",
    ...
  }
]
[GET /venue/V001] ✅ Sending response: { ... }
```

### When Saving Venue Changes:
```
[PUT /venue-with-admin/V001] 📥 Request body: {
  "venue_name": "Updated Venue Name",
  "venue_address": "456 New St",
  "state": "NSW",
  ...
}
[PUT /venue-with-admin/V001] ✅ Validation passed
[PUT /venue-with-admin/V001] ✅ Transaction committed successfully
[PUT /venue-with-admin/V001] ✅ Sending response: {
  "success": true,
  "message": "Venue and system admin updated successfully",
  "venue_code": "V001"
}
```

## Log Symbols Legend

- 👤 User Context - Shows who is making the request
- 📥 Request Data - Incoming data from frontend
- 🔍 SQL Query - The actual database query being executed
- 📝 Parameters - Values being inserted into the query
- 🔐 Access Controls - Permission filters applied
- ✅ Success - Operation completed successfully
- ❌ Error - Something went wrong
- ⚠️  Warning - Non-critical issue

## What to Look For

1. **User Context** - Verify the correct business_code and venue_code are set
2. **Query Parameters** - Check if filters are being applied correctly
3. **SQL Queries** - See exactly what's being queried from the database
4. **Results Count** - Verify the number of records returned
5. **Error Messages** - Catch any database or validation errors

## Troubleshooting

If you don't see logs:
1. Make sure you restarted the server after adding the logging code
2. Check that you're looking at the correct terminal window
3. Verify the server is running: `ps aux | grep "node server.js"`
4. Check for any startup errors in the console

If you see errors:
- Look for ❌ symbols in the logs
- Check the error message details
- Verify database connection is working
- Check that all required columns exist in the database schema
