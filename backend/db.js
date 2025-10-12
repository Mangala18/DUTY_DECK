const mysql = require("mysql2");

const db = mysql.createPool({
  host: "localhost",
  user: "appuser",
  password: "asdfghjkl",
  database: "clockin_mysql",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Add connection error handler for diagnostics
db.on('connection', (connection) => {
  console.log('✅ New database connection established');

  connection.on('error', (err) => {
    console.error('❌ Database connection error:', err);
    if (err.code === 'PROTOCOL_CONNECTION_LOST') {
      console.error('Database connection was closed.');
    }
    if (err.code === 'ER_CON_COUNT_ERROR') {
      console.error('Database has too many connections.');
    }
    if (err.code === 'ECONNREFUSED') {
      console.error('Database connection was refused.');
    }
  });
});

// Test initial connection
db.getConnection((err, connection) => {
  if (err) {
    console.error('❌ Failed to establish database connection:', err.message);
    console.error('Please verify:');
    console.error('  - MySQL server is running');
    console.error('  - Database credentials are correct');
    console.error('  - Database "clockin_mysql" exists');
  } else {
    console.log('✅ Database connection pool initialized successfully');
    connection.release();
  }
});

module.exports = db;