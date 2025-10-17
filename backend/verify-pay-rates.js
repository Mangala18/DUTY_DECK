/**
 * Database Verification Script
 * Checks if all staff have pay rates configured
 */

const db = require('./config/db');

async function verifyPayRates() {
  console.log('=== Pay Rates Verification ===\n');

  try {
    // Check for staff without pay rates
    const [staffWithoutRates] = await db.query(`
      SELECT s.staff_code, s.first_name, s.last_name, s.employment_status
      FROM staff s
      LEFT JOIN pay_rates pr ON s.staff_code = pr.staff_code
      WHERE pr.id IS NULL
        AND s.employment_status = 'active'
    `);

    if (staffWithoutRates.length > 0) {
      console.log(`⚠️  Found ${staffWithoutRates.length} active staff without pay rates:\n`);
      staffWithoutRates.forEach(staff => {
        console.log(`   - ${staff.staff_code}: ${staff.first_name} ${staff.last_name}`);
      });
      console.log('\n💡 Fix: Insert pay rates for these staff members:');
      console.log(`
INSERT INTO pay_rates (staff_code, weekday_rate, saturday_rate, sunday_rate, public_holiday_rate, overtime_rate, default_hours)
VALUES
  ('STAFF_CODE_HERE', 25.00, 37.50, 50.00, 62.50, 40.00, 38.00);
      `);
    } else {
      console.log('✅ All active staff have pay rates configured');
    }

    // Check for venues without business_code
    const [venuesWithoutBusiness] = await db.query(`
      SELECT venue_code, venue_name, business_code
      FROM venues
      WHERE business_code IS NULL OR business_code = ''
    `);

    if (venuesWithoutBusiness.length > 0) {
      console.log(`\n⚠️  Found ${venuesWithoutBusiness.length} venues without business_code:\n`);
      venuesWithoutBusiness.forEach(venue => {
        console.log(`   - ${venue.venue_code}: ${venue.venue_name}`);
      });
      console.log('\n💡 Fix: Update these venues with proper business_code');
    } else {
      console.log('✅ All venues have business_code configured');
    }

    // Show current pay rates
    const [allRates] = await db.query(`
      SELECT pr.*, s.first_name, s.last_name
      FROM pay_rates pr
      JOIN staff s ON pr.staff_code = s.staff_code
      WHERE s.employment_status = 'active'
      ORDER BY s.first_name, s.last_name
    `);

    if (allRates.length > 0) {
      console.log(`\n📊 Current Pay Rates (${allRates.length} staff):\n`);
      allRates.forEach(rate => {
        console.log(`   ${rate.staff_code} - ${rate.first_name} ${rate.last_name}`);
        console.log(`      Weekday: $${rate.weekday_rate}/hr`);
        console.log(`      Saturday: $${rate.saturday_rate}/hr`);
        console.log(`      Sunday: $${rate.sunday_rate}/hr`);
        console.log(`      Public Holiday: $${rate.public_holiday_rate}/hr`);
        console.log('');
      });
    }

    // Check active shifts
    const [activeShifts] = await db.query(`
      SELECT s.id, s.staff_code, s.venue_code, s.shift_state, s.clock_in,
             v.business_code, pr.weekday_rate
      FROM shifts s
      LEFT JOIN venues v ON s.venue_code = v.venue_code
      LEFT JOIN pay_rates pr ON s.staff_code = pr.staff_code
      WHERE s.shift_state IN ('ACTIVE', 'ON_BREAK')
    `);

    if (activeShifts.length > 0) {
      console.log(`\n🔄 Active Shifts (${activeShifts.length}):\n`);
      activeShifts.forEach(shift => {
        const hasRates = shift.weekday_rate !== null;
        const hasBusiness = shift.business_code !== null;
        const status = hasRates && hasBusiness ? '✅' : '⚠️';

        console.log(`   ${status} Shift ${shift.id} - ${shift.staff_code} @ ${shift.venue_code}`);
        if (!hasRates) console.log(`      ❌ Missing pay rates`);
        if (!hasBusiness) console.log(`      ❌ Missing business_code`);
      });
    } else {
      console.log('\n✅ No active shifts at the moment');
    }

    console.log('\n=== Verification Complete ===');
    process.exit(0);

  } catch (err) {
    console.error('❌ Error:', err.message);
    process.exit(1);
  }
}

verifyPayRates();
