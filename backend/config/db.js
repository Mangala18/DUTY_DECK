const mysql = require("mysql2");
const env = require("./env");

const db = mysql.createPool({
  host: env.DB_HOST,
  user: env.DB_USER,
  password: env.DB_PASS,
  database: env.DB_NAME,
  waitForConnections: true,
  connectionLimit: env.DB_CONNECTION_LIMIT,
  queueLimit: env.DB_QUEUE_LIMIT
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
    console.error(`  - Database "${env.DB_NAME}" exists`);
  } else {
    console.log('✅ Database connection pool initialized successfully');
    connection.release();
  }
});

module.exports = db;
