require('dotenv').config();

module.exports = {
  PORT: process.env.PORT || 3000,
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_USER: process.env.DB_USER || 'appuser',
  DB_PASS: process.env.DB_PASS || 'asdfghjkl',
  DB_NAME: process.env.DB_NAME || 'clockin_mysql',
  DB_CONNECTION_LIMIT: process.env.DB_CONNECTION_LIMIT || 10,
  DB_QUEUE_LIMIT: process.env.DB_QUEUE_LIMIT || 0
};
