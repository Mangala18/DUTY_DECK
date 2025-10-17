/**
 * Pay Calculator Utility
 *
 * Determines payday_type and calculates applicable pay rate based on:
 * - Day of week (Weekday, Saturday, Sunday)
 * - Public holidays
 * - Staff pay rates
 */

const db = require('../config/db');
const { HolidayCalculator } = require('../public-holidays-config');

/**
 * Determine the payday_type for a given date and venue
 *
 * @param {Date} date - The date to check
 * @param {string} businessCode - Business code (used to get venue state)
 * @returns {Promise<string>} - One of: 'WEEKDAY', 'SATURDAY', 'SUNDAY', 'PUBLIC_HOLIDAY'
 */
async function determinePaydayType(date, businessCode) {
  try {
    // Get the venue's state from the database
    const [venues] = await db.query(
      `SELECT v.state
       FROM venues v
       WHERE v.business_code = ?
       LIMIT 1`,
      [businessCode]
    );

    // Use state from venue, or fallback to default
    const state = (venues.length > 0 && venues[0].state) || 'TAS';

    // Check if it's a public holiday using the HolidayCalculator
    if (HolidayCalculator.isPublicHoliday(date, state)) {
      return 'PUBLIC_HOLIDAY';
    }

    // Check day of week (0 = Sunday, 6 = Saturday)
    const day = date.getDay();

    if (day === 0) return 'SUNDAY';
    if (day === 6) return 'SATURDAY';

    return 'WEEKDAY';
  } catch (err) {
    console.error('Error determining payday type:', err.message);
    // Fallback to day-based calculation if holiday lookup fails
    const day = date.getDay();
    if (day === 0) return 'SUNDAY';
    if (day === 6) return 'SATURDAY';
    return 'WEEKDAY';
  }
}

/**
 * Calculate pay for a shift based on payday_type
 *
 * @param {Object} params
 * @param {number} params.hoursWorked - Total hours worked in the shift
 * @param {string} params.paydayType - One of: 'WEEKDAY', 'SATURDAY', 'SUNDAY', 'PUBLIC_HOLIDAY'
 * @param {Object} params.rates - Staff pay rates object with rate fields (can be null/undefined)
 * @returns {Object} - { appliedRate, totalPay }
 */
function calculateShiftPay({ hoursWorked, paydayType, rates }) {
  // Base fallback rate when no pay rates are configured
  const BASE_RATE = 25.00;

  // Convert hours to number to handle string inputs from database
  const hours = Number(hoursWorked || 0);

  let appliedRate = 0;

  // If no rates object, use base rate
  if (!rates) {
    appliedRate = BASE_RATE;
  } else {
    // Convert all rates to numbers (MySQL returns DECIMAL as strings)
    const weekdayRate = Number(rates.weekday_rate || 0);
    const saturdayRate = Number(rates.saturday_rate || 0);
    const sundayRate = Number(rates.sunday_rate || 0);
    const publicHolidayRate = Number(rates.public_holiday_rate || 0);

    // Use configured rates with fallback to base rate
    switch (paydayType) {
      case 'SATURDAY':
        appliedRate = saturdayRate || weekdayRate || BASE_RATE;
        break;
      case 'SUNDAY':
        appliedRate = sundayRate || weekdayRate || BASE_RATE;
        break;
      case 'PUBLIC_HOLIDAY':
        appliedRate = publicHolidayRate || weekdayRate || BASE_RATE;
        break;
      case 'WEEKDAY':
      default:
        appliedRate = weekdayRate || BASE_RATE;
    }
  }

  // Ensure appliedRate is a number before using toFixed
  appliedRate = Number(appliedRate);

  const totalPay = Number((hours * appliedRate).toFixed(2));

  return {
    appliedRate: Number(appliedRate.toFixed(2)),
    totalPay
  };
}

/**
 * Complete pay calculation for a shift including payday_type determination
 *
 * @param {Object} params
 * @param {string} params.staffCode - Staff code
 * @param {Date} params.clockIn - Clock in timestamp
 * @param {Date} params.clockOut - Clock out timestamp
 * @param {number} params.breakMinutes - Break minutes (default 0)
 * @param {string} params.businessCode - Business code for holiday lookup
 * @returns {Promise<Object>} - { paydayType, appliedRate, hoursWorked, totalPay }
 */
async function calculateCompleteShiftPay({
  staffCode,
  clockIn,
  clockOut,
  breakMinutes = 0,
  businessCode
}) {
  try {
    // Fetch staff pay rates
    const [rateRows] = await db.query(
      `SELECT weekday_rate, saturday_rate, sunday_rate, public_holiday_rate, overtime_rate
       FROM pay_rates
       WHERE staff_code = ?
       LIMIT 1`,
      [staffCode]
    );

    if (!rateRows || rateRows.length === 0) {
      throw new Error(`No pay rates found for staff_code: ${staffCode}`);
    }

    const rates = rateRows[0];

    // Calculate hours worked
    const diffMs = new Date(clockOut) - new Date(clockIn);
    const diffHours = diffMs / (1000 * 60 * 60);
    const hoursWorked = parseFloat((diffHours - (breakMinutes / 60)).toFixed(2));

    // Determine payday type (use clock_in date as the shift date)
    const paydayType = await determinePaydayType(new Date(clockIn), businessCode);

    // Calculate pay
    const { appliedRate, totalPay } = calculateShiftPay({
      hoursWorked,
      paydayType,
      rates
    });

    return {
      paydayType,
      appliedRate,
      hoursWorked,
      totalPay
    };
  } catch (err) {
    console.error('Error in calculateCompleteShiftPay:', err.message);
    throw err;
  }
}

module.exports = {
  determinePaydayType,
  calculateShiftPay,
  calculateCompleteShiftPay
};
