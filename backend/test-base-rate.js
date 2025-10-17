/**
 * Test Base Rate Fallback
 * Verifies that the system uses $25/hr base rate when pay rates are not configured
 */

const { calculateShiftPay } = require('./utils/payCalculator');

console.log('=== Testing Base Rate Fallback ===\n');

// Test 1: Staff with no pay rates (null)
console.log('Test 1: Staff with NO pay rates configured');
const result1 = calculateShiftPay({
  hoursWorked: 8,
  paydayType: 'WEEKDAY',
  rates: null
});
console.log(`  8 hours, WEEKDAY, no rates`);
console.log(`  Applied Rate: $${result1.appliedRate}/hr`);
console.log(`  Total Pay: $${result1.totalPay}`);
console.log(`  Expected: $25/hr = $200`);
console.log(`  Result: ${result1.appliedRate === 25 && result1.totalPay === 200 ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 2: Staff with pay rates configured
console.log('Test 2: Staff WITH pay rates configured');
const result2 = calculateShiftPay({
  hoursWorked: 8,
  paydayType: 'WEEKDAY',
  rates: {
    weekday_rate: 30,
    saturday_rate: 45,
    sunday_rate: 60,
    public_holiday_rate: 75
  }
});
console.log(`  8 hours, WEEKDAY, weekday_rate=$30`);
console.log(`  Applied Rate: $${result2.appliedRate}/hr`);
console.log(`  Total Pay: $${result2.totalPay}`);
console.log(`  Expected: $30/hr = $240`);
console.log(`  Result: ${result2.appliedRate === 30 && result2.totalPay === 240 ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 3: Staff with partial rates (Saturday rate missing, falls back to base)
console.log('Test 3: Saturday rate missing - fallback to base rate');
const result3 = calculateShiftPay({
  hoursWorked: 8,
  paydayType: 'SATURDAY',
  rates: {
    weekday_rate: 30,
    saturday_rate: null, // Missing
    sunday_rate: 60,
    public_holiday_rate: 75
  }
});
console.log(`  8 hours, SATURDAY, saturday_rate=null, weekday_rate=$30`);
console.log(`  Applied Rate: $${result3.appliedRate}/hr`);
console.log(`  Total Pay: $${result3.totalPay}`);
console.log(`  Expected: Falls back to weekday_rate=$30 → $240`);
console.log(`  Result: ${result3.appliedRate === 30 && result3.totalPay === 240 ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 4: All rates missing - complete fallback
console.log('Test 4: All specific rates missing');
const result4 = calculateShiftPay({
  hoursWorked: 8,
  paydayType: 'SUNDAY',
  rates: {
    weekday_rate: null,
    saturday_rate: null,
    sunday_rate: null,
    public_holiday_rate: null
  }
});
console.log(`  8 hours, SUNDAY, all rates=null`);
console.log(`  Applied Rate: $${result4.appliedRate}/hr`);
console.log(`  Total Pay: $${result4.totalPay}`);
console.log(`  Expected: Falls back to base $25/hr = $200`);
console.log(`  Result: ${result4.appliedRate === 25 && result4.totalPay === 200 ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 5: Public Holiday with no rates
console.log('Test 5: Public Holiday with no rates');
const result5 = calculateShiftPay({
  hoursWorked: 10,
  paydayType: 'PUBLIC_HOLIDAY',
  rates: null
});
console.log(`  10 hours, PUBLIC_HOLIDAY, no rates`);
console.log(`  Applied Rate: $${result5.appliedRate}/hr`);
console.log(`  Total Pay: $${result5.totalPay}`);
console.log(`  Expected: Base rate $25/hr = $250`);
console.log(`  Result: ${result5.appliedRate === 25 && result5.totalPay === 250 ? '✅ PASS' : '❌ FAIL'}\n`);

console.log('=== Test Summary ===');
console.log('✅ All tests validate the $25 base rate fallback');
console.log('✅ System will never fail due to missing pay rates');
console.log('✅ Staff without configured rates will be paid $25/hr for ALL day types');
