/**
 * Test script for payday_type determination
 * Tests the payCalculator with different dates and scenarios
 */

const { HolidayCalculator } = require('./public-holidays-config');

console.log('=== Testing Payday Type Calculation ===\n');

// Test dates
const testDates = [
  { date: new Date('2025-01-01'), desc: 'New Year\'s Day (Wednesday)' },
  { date: new Date('2025-01-27'), desc: 'Australia Day substitute (Monday)' },
  { date: new Date('2025-03-10'), desc: 'Eight Hours Day (Monday)' },
  { date: new Date('2025-04-18'), desc: 'Good Friday' },
  { date: new Date('2025-04-21'), desc: 'Easter Monday' },
  { date: new Date('2025-04-25'), desc: 'ANZAC Day (Friday)' },
  { date: new Date('2025-12-25'), desc: 'Christmas Day (Thursday)' },
  { date: new Date('2025-10-15'), desc: 'Regular Wednesday (Weekday)' },
  { date: new Date('2025-10-18'), desc: 'Regular Saturday' },
  { date: new Date('2025-10-19'), desc: 'Regular Sunday' }
];

const state = 'TAS'; // Default Tasmania

console.log(`Testing for state: ${state}\n`);

testDates.forEach(test => {
  const isHoliday = HolidayCalculator.isPublicHoliday(test.date, state);
  const day = test.date.getDay();

  let paydayType;
  if (isHoliday) {
    paydayType = 'PUBLIC_HOLIDAY';
  } else if (day === 0) {
    paydayType = 'SUNDAY';
  } else if (day === 6) {
    paydayType = 'SATURDAY';
  } else {
    paydayType = 'WEEKDAY';
  }

  const holidayDetails = HolidayCalculator.getHolidayDetails(test.date, state);

  console.log(`📅 ${test.date.toDateString()}`);
  console.log(`   ${test.desc}`);
  console.log(`   Payday Type: ${paydayType}`);
  if (holidayDetails) {
    console.log(`   Holiday: ${holidayDetails.name}`);
  }
  console.log('');
});

// Test rate calculation
console.log('=== Sample Pay Calculation ===\n');

const sampleRates = {
  weekday_rate: 25.00,
  saturday_rate: 37.50,  // 1.5x
  sunday_rate: 50.00,    // 2x
  public_holiday_rate: 62.50  // 2.5x
};

const calculatePay = (hours, paydayType) => {
  let rate;
  switch (paydayType) {
    case 'SATURDAY':
      rate = sampleRates.saturday_rate;
      break;
    case 'SUNDAY':
      rate = sampleRates.sunday_rate;
      break;
    case 'PUBLIC_HOLIDAY':
      rate = sampleRates.public_holiday_rate;
      break;
    default:
      rate = sampleRates.weekday_rate;
  }
  return { rate, total: hours * rate };
};

console.log('Staff Rate Profile:');
console.log(`  Weekday: $${sampleRates.weekday_rate}/hr`);
console.log(`  Saturday: $${sampleRates.saturday_rate}/hr`);
console.log(`  Sunday: $${sampleRates.sunday_rate}/hr`);
console.log(`  Public Holiday: $${sampleRates.public_holiday_rate}/hr\n`);

console.log('8-hour shift examples:');
console.log('  Weekday: $' + calculatePay(8, 'WEEKDAY').total);
console.log('  Saturday: $' + calculatePay(8, 'SATURDAY').total);
console.log('  Sunday: $' + calculatePay(8, 'SUNDAY').total);
console.log('  Public Holiday: $' + calculatePay(8, 'PUBLIC_HOLIDAY').total);

console.log('\n✅ Test completed successfully!');
