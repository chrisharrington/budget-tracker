import { describe, expect, test } from 'bun:test';

import Config from '.';

// Dates are built with `new Date(year, monthIndex, day)` (month is 0-indexed), matching how the
// tier boundaries are declared in the subject, so comparisons are timezone-consistent.

describe('Config.weeklyAmount', () => {
    test('returns 400 on and after 2025-01-01', () => {
        expect(Config.weeklyAmount(new Date(2025, 0, 1))).toBe(400);
        expect(Config.weeklyAmount(new Date(2025, 5, 15))).toBe(400);
    });

    test('returns 750 from 2024-08-19 up to the end of 2024', () => {
        expect(Config.weeklyAmount(new Date(2024, 7, 19))).toBe(750);
        expect(Config.weeklyAmount(new Date(2024, 11, 31))).toBe(750);
    });

    test('returns 800 from 2021-12-05 up to just before 2024-08-19', () => {
        expect(Config.weeklyAmount(new Date(2021, 11, 5))).toBe(800);
        expect(Config.weeklyAmount(new Date(2024, 7, 18))).toBe(800);
    });

    test('returns 1000 from 2021-08-16 up to just before 2021-12-05', () => {
        expect(Config.weeklyAmount(new Date(2021, 7, 16))).toBe(1000);
        expect(Config.weeklyAmount(new Date(2021, 11, 4))).toBe(1000);
    });

    test('returns 500 before 2021-08-16', () => {
        expect(Config.weeklyAmount(new Date(2021, 7, 15))).toBe(500);
        expect(Config.weeklyAmount(new Date(2020, 0, 1))).toBe(500);
    });
});

describe('Config.oneTimeAmount', () => {
    test('returns 2000 on and after 2024-12-15', () => {
        expect(Config.oneTimeAmount(new Date(2024, 11, 15))).toBe(2000);
        expect(Config.oneTimeAmount(new Date(2025, 0, 1))).toBe(2000);
    });

    test('returns 1500 before 2024-12-15', () => {
        expect(Config.oneTimeAmount(new Date(2024, 11, 14))).toBe(1500);
    });
});
