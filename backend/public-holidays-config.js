// Public Holidays Configuration System
// Supports state-based holidays with automatic date calculations

const PUBLIC_HOLIDAYS_CONFIG = {
    // Default state - can be changed in admin settings
    defaultState: 'TAS',

    // State-specific public holidays configuration
    states: {
        'TAS': {
            name: 'Tasmania',
            holidays: {
                // Fixed date holidays
                'NEW_YEARS_DAY': {
                    name: "New Year's Day",
                    type: 'fixed',
                    month: 1,
                    day: 1,
                    substitute: true // If falls on weekend, substitute on Monday
                },
                'AUSTRALIA_DAY': {
                    name: "Australia Day",
                    type: 'fixed',
                    month: 1,
                    day: 26,
                    substitute: true
                },
                'EIGHT_HOURS_DAY': {
                    name: "Eight Hours Day",
                    type: 'variable',
                    // Second Monday in March
                    month: 3,
                    week: 2,
                    weekday: 1 // Monday = 1
                },
                'ANZAC_DAY': {
                    name: "ANZAC Day",
                    type: 'fixed',
                    month: 4,
                    day: 25,
                    substitute: false // Never substituted
                },
                'KINGS_BIRTHDAY': {
                    name: "King's Birthday",
                    type: 'variable',
                    // Second Monday in June
                    month: 6,
                    week: 2,
                    weekday: 1
                },
                'CHRISTMAS_DAY': {
                    name: "Christmas Day",
                    type: 'fixed',
                    month: 12,
                    day: 25,
                    substitute: true
                },
                'BOXING_DAY': {
                    name: "Boxing Day",
                    type: 'fixed',
                    month: 12,
                    day: 26,
                    substitute: true
                },
                // Easter-based holidays (calculated dynamically)
                'GOOD_FRIDAY': {
                    name: "Good Friday",
                    type: 'easter',
                    offset: -2 // 2 days before Easter
                },
                'EASTER_MONDAY': {
                    name: "Easter Monday",
                    type: 'easter',
                    offset: 1 // 1 day after Easter
                },
                'EASTER_TUESDAY': {
                    name: "Easter Tuesday",
                    type: 'easter',
                    offset: 2, // 2 days after Easter
                    note: "Generally Tasmanian Public Service only"
                }
            }
        },

        'NSW': {
            name: 'New South Wales',
            holidays: {
                'NEW_YEARS_DAY': {
                    name: "New Year's Day",
                    type: 'fixed',
                    month: 1,
                    day: 1,
                    substitute: true
                },
                'AUSTRALIA_DAY': {
                    name: "Australia Day",
                    type: 'fixed',
                    month: 1,
                    day: 26,
                    substitute: true
                },
                'GOOD_FRIDAY': {
                    name: "Good Friday",
                    type: 'easter',
                    offset: -2
                },
                'EASTER_SATURDAY': {
                    name: "Easter Saturday",
                    type: 'easter',
                    offset: -1
                },
                'EASTER_MONDAY': {
                    name: "Easter Monday",
                    type: 'easter',
                    offset: 1
                },
                'ANZAC_DAY': {
                    name: "ANZAC Day",
                    type: 'fixed',
                    month: 4,
                    day: 25,
                    substitute: false
                },
                'QUEENS_BIRTHDAY': {
                    name: "Queen's Birthday",
                    type: 'variable',
                    month: 6,
                    week: 2,
                    weekday: 1
                },
                'BANK_HOLIDAY': {
                    name: "Bank Holiday",
                    type: 'variable',
                    month: 8,
                    week: 1,
                    weekday: 1
                },
                'LABOUR_DAY': {
                    name: "Labour Day",
                    type: 'variable',
                    month: 10,
                    week: 1,
                    weekday: 1
                },
                'CHRISTMAS_DAY': {
                    name: "Christmas Day",
                    type: 'fixed',
                    month: 12,
                    day: 25,
                    substitute: true
                },
                'BOXING_DAY': {
                    name: "Boxing Day",
                    type: 'fixed',
                    month: 12,
                    day: 26,
                    substitute: true
                }
            }
        },

        'VIC': {
            name: 'Victoria',
            holidays: {
                'NEW_YEARS_DAY': {
                    name: "New Year's Day",
                    type: 'fixed',
                    month: 1,
                    day: 1,
                    substitute: true
                },
                'AUSTRALIA_DAY': {
                    name: "Australia Day",
                    type: 'fixed',
                    month: 1,
                    day: 26,
                    substitute: true
                },
                'LABOUR_DAY': {
                    name: "Labour Day",
                    type: 'variable',
                    month: 3,
                    week: 2,
                    weekday: 1
                },
                'GOOD_FRIDAY': {
                    name: "Good Friday",
                    type: 'easter',
                    offset: -2
                },
                'EASTER_SATURDAY': {
                    name: "Easter Saturday",
                    type: 'easter',
                    offset: -1
                },
                'EASTER_MONDAY': {
                    name: "Easter Monday",
                    type: 'easter',
                    offset: 1
                },
                'ANZAC_DAY': {
                    name: "ANZAC Day",
                    type: 'fixed',
                    month: 4,
                    day: 25,
                    substitute: false
                },
                'QUEENS_BIRTHDAY': {
                    name: "Queen's Birthday",
                    type: 'variable',
                    month: 6,
                    week: 2,
                    weekday: 1
                },
                'MELBOURNE_CUP': {
                    name: "Melbourne Cup Day",
                    type: 'variable',
                    month: 11,
                    week: 1,
                    weekday: 2 // First Tuesday
                },
                'CHRISTMAS_DAY': {
                    name: "Christmas Day",
                    type: 'fixed',
                    month: 12,
                    day: 25,
                    substitute: true
                },
                'BOXING_DAY': {
                    name: "Boxing Day",
                    type: 'fixed',
                    month: 12,
                    day: 26,
                    substitute: true
                }
            }
        }
        // Add more states as needed...
    },

    // Manual holiday overrides for specific years
    overrides: {
        2025: {
            'TAS': [
                { date: '2025-01-01', name: "New Year's Day" },
                { date: '2025-01-27', name: "Australia Day" }, // Substituted
                { date: '2025-03-10', name: "Eight Hours Day" },
                { date: '2025-04-18', name: "Good Friday" },
                { date: '2025-04-21', name: "Easter Monday" },
                { date: '2025-04-22', name: "Easter Tuesday" },
                { date: '2025-04-25', name: "ANZAC Day" },
                { date: '2025-06-09', name: "King's Birthday" },
                { date: '2025-12-25', name: "Christmas Day" },
                { date: '2025-12-26', name: "Boxing Day" }
            ]
        },
        2026: {
            'TAS': [
                { date: '2026-01-01', name: "New Year's Day" },
                { date: '2026-01-26', name: "Australia Day" },
                { date: '2026-03-09', name: "Eight Hours Day" },
                { date: '2026-04-03', name: "Good Friday" },
                { date: '2026-04-06', name: "Easter Monday" },
                { date: '2026-04-07', name: "Easter Tuesday" },
                { date: '2026-04-25', name: "ANZAC Day" },
                { date: '2026-06-08', name: "King's Birthday" },
                { date: '2026-12-25', name: "Christmas Day" },
                { date: '2026-12-28', name: "Boxing Day" } // Substituted
            ]
        },
        2027: {
            'TAS': [
                { date: '2027-01-01', name: "New Year's Day" },
                { date: '2027-01-26', name: "Australia Day" },
                { date: '2027-03-08', name: "Eight Hours Day" },
                { date: '2027-03-26', name: "Good Friday" },
                { date: '2027-03-29', name: "Easter Monday" },
                { date: '2027-03-30', name: "Easter Tuesday" },
                { date: '2027-04-25', name: "ANZAC Day" },
                { date: '2027-06-14', name: "King's Birthday" },
                { date: '2027-12-27', name: "Christmas Day" }, // Substituted
                { date: '2027-12-28', name: "Boxing Day" } // Substituted
            ]
        }
    }
};

// Holiday calculation utilities
class HolidayCalculator {

    // Calculate Easter Sunday for a given year using the algorithm
    static calculateEaster(year) {
        const f = Math.floor;
        const a = year % 19;
        const b = f(year / 100);
        const c = year % 100;
        const d = f(b / 4);
        const e = b % 4;
        const g = f((8 * b + 13) / 25);
        const h = (19 * a + b - d - g + 15) % 30;
        const i = f(c / 4);
        const k = c % 4;
        const l = (32 + 2 * e + 2 * i - h - k) % 7;
        const m = f((a + 11 * h + 19 * l) / 433);
        const month = f((h + l - 7 * m + 90) / 25);
        const day = (h + l - 7 * m + 33 * month + 19) % 32;

        return new Date(year, month - 1, day);
    }

    // Calculate nth weekday of month (e.g., 2nd Monday of June)
    static calculateNthWeekday(year, month, week, weekday) {
        const firstDay = new Date(year, month - 1, 1);
        const firstWeekday = firstDay.getDay();
        const daysToAdd = (weekday - firstWeekday + 7) % 7;
        const firstOccurrence = 1 + daysToAdd;
        const nthOccurrence = firstOccurrence + (week - 1) * 7;

        return new Date(year, month - 1, nthOccurrence);
    }

    // Get all holidays for a specific state and year
    static getHolidaysForYear(state, year) {
        // Check for manual overrides first
        if (PUBLIC_HOLIDAYS_CONFIG.overrides[year] && PUBLIC_HOLIDAYS_CONFIG.overrides[year][state]) {
            return PUBLIC_HOLIDAYS_CONFIG.overrides[year][state].map(holiday => ({
                ...holiday,
                date: new Date(holiday.date)
            }));
        }

        // Calculate holidays based on rules
        const stateConfig = PUBLIC_HOLIDAYS_CONFIG.states[state];
        if (!stateConfig) return [];

        const holidays = [];
        const easter = this.calculateEaster(year);

        for (const [key, config] of Object.entries(stateConfig.holidays)) {
            let holidayDate;

            switch (config.type) {
                case 'fixed':
                    holidayDate = new Date(year, config.month - 1, config.day);

                    // Handle substitution for weekends
                    if (config.substitute && (holidayDate.getDay() === 0 || holidayDate.getDay() === 6)) {
                        // If Sunday, move to Monday
                        if (holidayDate.getDay() === 0) {
                            holidayDate.setDate(holidayDate.getDate() + 1);
                        }
                        // If Saturday, move to Monday
                        else if (holidayDate.getDay() === 6) {
                            holidayDate.setDate(holidayDate.getDate() + 2);
                        }
                    }
                    break;

                case 'variable':
                    holidayDate = this.calculateNthWeekday(year, config.month, config.week, config.weekday);
                    break;

                case 'easter':
                    holidayDate = new Date(easter);
                    holidayDate.setDate(holidayDate.getDate() + config.offset);
                    break;
            }

            if (holidayDate) {
                holidays.push({
                    name: config.name,
                    date: holidayDate,
                    code: key,
                    note: config.note || ''
                });
            }
        }

        return holidays.sort((a, b) => a.date - b.date);
    }

    // Check if a specific date is a public holiday
    static isPublicHoliday(date, state = null) {
        const checkState = state || PUBLIC_HOLIDAYS_CONFIG.defaultState;
        const year = date.getFullYear();
        const holidays = this.getHolidaysForYear(checkState, year);

        const dateString = date.toDateString();
        return holidays.some(holiday => holiday.date.toDateString() === dateString);
    }

    // Get holiday details for a specific date
    static getHolidayDetails(date, state = null) {
        const checkState = state || PUBLIC_HOLIDAYS_CONFIG.defaultState;
        const year = date.getFullYear();
        const holidays = this.getHolidaysForYear(checkState, year);

        const dateString = date.toDateString();
        return holidays.find(holiday => holiday.date.toDateString() === dateString);
    }
}

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { PUBLIC_HOLIDAYS_CONFIG, HolidayCalculator };
}