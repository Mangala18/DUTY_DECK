# ClockIn MySQL - Employee Time Tracking System

A comprehensive employee time tracking and payroll management system built with Node.js, Express, MySQL, and Bootstrap.

## Features

- **Multi-role Access Control**: Master Admin, System Admin, Manager, Supervisor, and Employee roles
- **Staff Management**: Add, edit, and manage staff members with detailed profiles
- **Kiosk Clock-in/out**: Dedicated kiosk interface for employee time tracking
- **Payroll Management**: Track hours, calculate pay rates (weekday, weekend, holiday, overtime)
- **Venue Management**: Multi-venue support for businesses with multiple locations
- **Compliance**: Bank details, emergency contacts, and employee documentation

## Project Structure

```
clockin_mysql/
├── backend/
│   ├── routes/
│   │   ├── auth.js              # Authentication routes
│   │   ├── kiosk.js             # Kiosk clock-in/out routes
│   │   ├── masterRoutes.js      # Master admin routes (businesses, venues)
│   │   ├── staffRoutes.js       # Staff management routes
│   │   └── systemAdminRoutes.js # System admin routes
│   ├── validation/
│   │   └── masterValidation.js  # Input validation
│   ├── db.js                    # Database connection pool
│   ├── server.js                # Express server entry point
│   └── package.json
├── frontend/
│   ├── css/
│   │   ├── admin.css           # Admin panel styles
│   │   ├── kiosk.css           # Kiosk interface styles
│   │   ├── login.css           # Login page styles
│   │   └── master.css          # Master admin styles
│   ├── js/
│   │   ├── admin.js            # Admin panel logic
│   │   ├── kiosk.js            # Kiosk functionality
│   │   ├── login.js            # Login functionality
│   │   ├── master.js           # Master admin logic
│   │   ├── staff.js            # Staff management logic
│   │   └── utils.js            # Utility functions
│   ├── admin.html              # System admin dashboard
│   ├── index.html              # Login page
│   ├── kiosk.html              # Kiosk interface
│   └── master.html             # Master admin dashboard
└── schema/
    └── *.sql                   # Database schema files

```

## Quick Start

```bash
# 1. Start MySQL
sudo service mysql start

# 2. Set up database
mysql -u root -p clockin_db < schema/01_create_db.sql
mysql -u root -p clockin_db < schema/02_tables.sql
mysql -u root -p clockin_db < schema/05_alter_breaks.sql

# 3. Configure database connection in backend/db.js

# 4. Install dependencies
cd backend && npm install

# 5. Start the server
npm run dev

# 6. Open browser to http://localhost:3000
```

## Prerequisites

- **Node.js** (v14 or higher) - [Download](https://nodejs.org/)
- **MySQL** (v5.7 or higher) - [Download](https://dev.mysql.com/downloads/mysql/)
- **npm** (comes with Node.js)

## Installation & Setup

### 1. Clone/Extract the Project

```bash
cd /home/vinny/clockin_mysql
```

### 2. Set Up the Database

**Step 2.1: Start MySQL Service**

```bash
# On Linux/WSL
sudo service mysql start

# Or using systemctl
sudo systemctl start mysql
```

**Step 2.2: Create Database and Import Schema**

```bash
# Login to MySQL as root
mysql -u root -p

# Inside MySQL prompt, create the database
CREATE DATABASE clockin_db;
EXIT;

# Import schema files in order
mysql -u root -p clockin_db < schema/01_create_db.sql
mysql -u root -p clockin_db < schema/02_tables.sql
mysql -u root -p clockin_db < schema/05_alter_breaks.sql
```

**Note**: `03_indexes.sql` and `04_seed.sql` are currently empty. You'll need to create your initial users manually or through the application.

### 3. Configure Database Connection

Edit [backend/db.js](backend/db.js) and update the MySQL connection details:

```javascript
const pool = mysql.createPool({
  host: "localhost",
  user: "root",              // Your MySQL username
  password: "your_password",  // Your MySQL password
  database: "clockin_db",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
```

### 4. Install Backend Dependencies

```bash
cd backend
npm install
```

This will install the following dependencies:
- `express` - Web framework
- `mysql2` - MySQL client
- `cors` - Cross-origin resource sharing
- `dotenv` - Environment variable management
- `joi` - Data validation
- `nodemon` - Development auto-reload (dev dependency)

### 5. Install Frontend Dependencies

```bash
cd ../frontend
npm install
```

## Running the Application

### Method 1: Standard Start (Production)

```bash
cd backend
npm start
```

### Method 2: Development Mode (Auto-reload)

```bash
cd backend
npm run dev
```

This uses nodemon to automatically restart the server when you make changes to the code.

**Server will start on**: `http://localhost:3000`

You should see output like:
```
Server running on port 3000
MySQL Connected
```

### Access the Application

Once the server is running, access these URLs in your browser:

- **Login Page**: http://localhost:3000/
- **Master Admin Panel**: http://localhost:3000/master.html
- **System Admin Panel**: http://localhost:3000/admin.html
- **Kiosk Interface**: http://localhost:3000/kiosk.html

## Creating Your First User

Since there's no sample data, you'll need to create the initial users directly in the database:

### Create a Master Admin User

```sql
-- Login to MySQL
mysql -u root -p clockin_db

-- Insert a master admin user (password: 'admin123' - hashed)
INSERT INTO users (username, email, password_hash, role, created_at)
VALUES (
  'masteradmin',
  'master@example.com',
  '$2a$10$YourHashedPasswordHere',  -- Replace with actual bcrypt hash
  'master_admin',
  NOW()
);
```

### Create a Business and System Admin

```sql
-- Insert a business
INSERT INTO businesses (name, created_at) VALUES ('My Business', NOW());

-- Insert a venue
INSERT INTO venues (business_id, name, address, created_at)
VALUES (1, 'Main Office', '123 Main St', NOW());

-- Insert a system admin user
INSERT INTO users (username, email, password_hash, role, business_id, created_at)
VALUES (
  'admin',
  'admin@example.com',
  '$2a$10$YourHashedPasswordHere',  -- Replace with actual bcrypt hash
  'system_admin',
  1,
  NOW()
);
```

**Note**: For security, you should hash passwords using bcrypt. You can use an online bcrypt generator or create a simple Node.js script to generate hashed passwords.

### Create Staff for Kiosk

Staff members can be created through the admin panel after logging in, or directly in the database:

```sql
INSERT INTO staff (
  business_id, venue_id, first_name, last_name,
  employee_code, pin_code, hourly_rate, status, created_at
) VALUES (
  1, 1, 'John', 'Doe',
  'EMP001', '123456', 15.00, 'active', NOW()
);
```

## Default Login Credentials

After creating users as shown above:

**Master Admin:**
- Email: master@example.com
- Password: (whatever you set during user creation)

**System Admin:**
- Email: admin@example.com
- Password: (whatever you set during user creation)

**Kiosk Mode:**
- Employee Code: EMP001
- PIN: 123456 (for the sample staff created above)

## API Endpoints

### Authentication
- `POST /api/login` - User login
- `POST /api/logout` - User logout

### Staff Management
- `GET /api/system-admin/staff` - Get all staff (with filters)
- `POST /api/system-admin/staff` - Add new staff
- `GET /api/system-admin/staff/:id` - Get staff details
- `PUT /api/system-admin/staff/:id` - Update staff
- `DELETE /api/system-admin/staff/:id` - Delete staff (soft delete)

### Venues
- `GET /api/system-admin/venues` - Get all venues
- `GET /api/master/venues` - Master admin venue management

### Kiosk
- `POST /api/kiosk/clock-in` - Clock in
- `POST /api/kiosk/clock-out` - Clock out

## User Roles & Permissions

1. **Master Admin**: Full system access, manage businesses and venues
2. **System Admin**: Manage all staff within their business
3. **Manager**: Manage staff within their assigned venue
4. **Supervisor**: Limited staff management within their venue
5. **Employee**: Basic access, clock-in/out only

## Development

### File Structure

- **Backend**: Express.js server with route-based architecture
- **Frontend**: Vanilla JavaScript with Bootstrap 5 UI
- **Database**: MySQL with normalized schema

### Key Technologies

- **Backend**: Node.js, Express, MySQL2
- **Frontend**: Bootstrap 5, Bootstrap Icons, Vanilla JavaScript
- **Security**: Password hashing, role-based access control

## Troubleshooting

### Server won't start

**Check MySQL is running:**
```bash
sudo service mysql status
# or
sudo systemctl status mysql
```

**Check if port 3000 is already in use:**
```bash
lsof -i:3000
# Kill the process if needed
kill -9 <PID>
```

**Verify database credentials:**
- Check [backend/db.js](backend/db.js) has correct username/password
- Test MySQL connection: `mysql -u root -p clockin_db`

### Database connection errors

**Error: "ER_ACCESS_DENIED_ERROR"**
- Wrong username or password in [backend/db.js](backend/db.js)
- Verify credentials: `mysql -u root -p`

**Error: "ER_BAD_DB_ERROR: Unknown database"**
- Database doesn't exist. Create it:
```bash
mysql -u root -p
CREATE DATABASE clockin_db;
```

**Error: "ECONNREFUSED"**
- MySQL service is not running
- Start MySQL: `sudo service mysql start`

### 404 Errors on API calls

- Ensure server is running on port 3000
- Check browser console for errors (F12)
- Verify the URL path is correct
- Check server logs for route errors

### Authentication issues

**Can't login:**
- Verify user exists in `users` table
- Check password hash is correct (use bcrypt)
- Clear browser cookies and try again
- Check browser console for error messages

**Session expires immediately:**
- Check server logs for session errors
- Verify cookies are enabled in browser

### Kiosk clock-in issues

**"Staff not found" error:**
- Verify employee_code exists in `staff` table
- Check staff status is 'active'
- Ensure PIN is correct (6 digits)

**Break tracking not working:**
- Verify `schema/05_alter_breaks.sql` was imported
- Check `break_records` table exists
- Check browser console for API errors

### Frontend not loading styles

- Check if Bootstrap CSS is loading (Network tab in browser)
- Verify [frontend/css/](frontend/css/) files exist
- Hard refresh browser (Ctrl+F5 or Cmd+Shift+R)

### Development Tips

**View server logs:**
```bash
cd backend
npm run dev  # Shows detailed logs with nodemon
```

**Check database tables:**
```bash
mysql -u root -p clockin_db
SHOW TABLES;
DESCRIBE users;
DESCRIBE staff;
```

**Reset database (WARNING: deletes all data):**
```bash
mysql -u root -p
DROP DATABASE clockin_db;
CREATE DATABASE clockin_db;
EXIT;
mysql -u root -p clockin_db < schema/01_create_db.sql
mysql -u root -p clockin_db < schema/02_tables.sql
mysql -u root -p clockin_db < schema/05_alter_breaks.sql
```

## License

Proprietary - All rights reserved

## Support

For issues or questions, contact your system administrator.
