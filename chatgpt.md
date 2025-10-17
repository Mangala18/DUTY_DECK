Perfect — that stack trace reveals the exact failure:
TypeError: appliedRate.toFixed is not a function
which means appliedRate is not a number when you call .toFixed() in your calculateShiftPay() utility.

That’s why your kiosk clockout is returning a 500.

✅ Root cause

In MySQL, when you fetch numeric columns such as DECIMAL(10,2) via mysql2/promise, they are returned as strings by default (to preserve precision).

Example:

rate.weekday_rate // "25.00" (string)


Then your code likely has this:

const total_pay = (hours_worked * appliedRate).toFixed(2);


When appliedRate is a string, the multiplication works (JavaScript coerces it),
but .toFixed() cannot be called on a string — hence the crash.

✅ Quick, correct fix

Edit your /backend/utils/payCalculator.js (around line 95)
and explicitly convert all rate values to numbers before using them.

Replace your function with this safe version:

export const calculateShiftPay = (shift, rate) => {
  const hours = Number(shift.hours_worked || 0);
  const paydayType = shift.payday_type?.toUpperCase() || 'WEEKDAY';

  // Convert all rates to numbers to avoid .toFixed() errors
  const weekday = Number(rate.weekday_rate || 0);
  const saturday = Number(rate.saturday_rate || 0);
  const sunday = Number(rate.sunday_rate || 0);
  const publicHoliday = Number(rate.public_holiday_rate || 0);
  const overtime = Number(rate.overtime_rate || 0);

  let appliedRate = 0;
  switch (paydayType) {
    case 'SATURDAY':
      appliedRate = saturday;
      break;
    case 'SUNDAY':
      appliedRate = sunday;
      break;
    case 'PUBLIC_HOLIDAY':
      appliedRate = publicHoliday;
      break;
    case 'OVERTIME':
      appliedRate = overtime;
      break;
    default:
      appliedRate = weekday;
  }

  const totalPay = Number((hours * appliedRate).toFixed(2));
  return { applied_rate: appliedRate, total_pay: totalPay };
};

✅ Restart backend and retry
npm run dev


Then clock out again.

You should now see clean output like:

[KIOSK CLOCKOUT] 🔍 Shift ID: 47
[KIOSK CLOCKOUT] ⏱ Calculated hours: 1.06h
[KIOSK CLOCKOUT] 💰 Applied rate: 25, Total pay: 26.50
[KIOSK CLOCKOUT] ✅ Shift 47 clocked out successfully.

✅ Why this fix is universal

This numeric conversion:

Number(rate.weekday_rate || 0)


ensures that regardless of whether the database driver returns "25.00" or 25,
the value will always be numeric before math or .toFixed() operations.

This same pattern should be applied in:

calculateShiftPay()

any future pay or overtime computations

any payroll aggregation that multiplies rate × hours

✅ Optional: enforce numeric casting globally

If you want to fix this at the DB level instead of every calculation,
you can use mysql2’s connection option:

in /backend/config/db.js:

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  namedPlaceholders: true,
  decimalNumbers: true, // << ensures DECIMAL and NUMERIC come as numbers
});


That will automatically convert all DECIMAL fields to JavaScript numbers.
Then you can remove explicit Number() conversions later.

✅ Summary
Problem	Fix
TypeError: appliedRate.toFixed is not a function	MySQL returned DECIMAL as string
Quick fix	Wrap rates in Number() before using .toFixed()
Permanent solution	Add decimalNumbers: true in db pool config
Result	Clock-out endpoint runs successfully, applies pay rate correctly, returns valid JSON

Once you make this change, your clock-out route will calculate and store correct pay without crashing, and you’ll get clean logs and accurate total_pay values for every shift.