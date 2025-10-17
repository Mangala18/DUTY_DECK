const mysql = require("mysql2/promise");
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

// Test initial connection using async/await
(async () => {
  try {
    const connection = await db.getConnection();
    console.log('✅ Database connection pool initialized successfully');
    connection.release();
  } catch (err) {
    console.error('❌ Failed to establish database connection:', err.message);
    console.error('Please verify:');
    console.error('  - MySQL server is running');
    console.error('  - Database credentials are correct');
    console.error(`  - Database "${env.DB_NAME}" exists`);
  }
})();

module.exports = db;
