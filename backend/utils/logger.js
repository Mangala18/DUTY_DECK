/**
 * Logger Utility
 * Wrapper for console logging (can be extended with winston, etc.)
 */

exports.info = (message, ...args) => {
  console.log(`[INFO] ${message}`, ...args);
};

exports.error = (message, ...args) => {
  console.error(`[ERROR] ${message}`, ...args);
};

exports.warn = (message, ...args) => {
  console.warn(`[WARN] ${message}`, ...args);
};

exports.debug = (message, ...args) => {
  if (process.env.DEBUG === 'true') {
    console.log(`[DEBUG] ${message}`, ...args);
  }
};
