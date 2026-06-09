import { afterEach, describe, expect, test } from 'bun:test';

import Config, { parseCardOwnerMap, parseCorsOrigins } from '.';

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

describe('Config.mongoDb', () => {
    test('defaults to budget when MONGO_DB is unset', () => {
        // MONGO_DB is not set in the test environment, so the static falls back to the default.
        expect(Config.mongoDb).toBe('budget');
    });
});

describe('Config.apiKey', () => {
    test('is undefined when API_KEY is unset (no default)', () => {
        // Unlike mongoDb, apiKey has no fallback — a missing key reads as undefined, never ''.
        expect(Config.apiKey).toBeUndefined();
    });
});

describe('parseCorsOrigins', () => {
    test('returns an empty allowlist for undefined or empty input', () => {
        expect(parseCorsOrigins(undefined)).toEqual([]);
        expect(parseCorsOrigins('')).toEqual([]);
    });

    test('parses a single origin', () => {
        expect(parseCorsOrigins('https://budget.example.com')).toEqual(['https://budget.example.com']);
    });

    test('splits a comma-separated list and trims surrounding whitespace', () => {
        expect(parseCorsOrigins('https://a.example.com, https://b.example.com ')).toEqual([
            'https://a.example.com',
            'https://b.example.com',
        ]);
    });

    test('drops blank entries from trailing or doubled commas', () => {
        expect(parseCorsOrigins('https://a.example.com,,https://b.example.com,')).toEqual([
            'https://a.example.com',
            'https://b.example.com',
        ]);
    });
});

describe('parseCardOwnerMap', () => {
    test('returns an empty map for undefined or empty input', () => {
        expect(parseCardOwnerMap(undefined)).toEqual({});
        expect(parseCardOwnerMap('')).toEqual({});
    });

    test('parses a JSON object of card last-4 to owner name', () => {
        expect(parseCardOwnerMap('{"1379":"Chris","8472":"Sarah"}')).toEqual({ '1379': 'Chris', '8472': 'Sarah' });
    });

    test('returns an empty map for malformed JSON', () => {
        expect(parseCardOwnerMap('{not json')).toEqual({});
    });

    test('returns an empty map when the JSON is not an object', () => {
        expect(parseCardOwnerMap('"a string"')).toEqual({});
        expect(parseCardOwnerMap('["1379","Chris"]')).toEqual({});
    });

    test('drops entries whose value is not a string', () => {
        expect(parseCardOwnerMap('{"1379":"Chris","8472":123}')).toEqual({ '1379': 'Chris' });
    });
});

describe('Config.assertMailConfig', () => {
    const original = {
        host: Config.mailHost,
        user: Config.mailEmailAddress,
        password: Config.mailPassword,
    };

    afterEach(() => {
        Config.mailHost = original.host;
        Config.mailEmailAddress = original.user;
        Config.mailPassword = original.password;
    });

    test('throws naming every missing mail variable', () => {
        Config.mailHost = '';
        Config.mailEmailAddress = '';
        Config.mailPassword = '';

        expect(() => Config.assertMailConfig()).toThrow('MAIL_HOST, MAIL_USER, MAIL_PASSWORD');
    });

    test('throws naming only the missing variable', () => {
        Config.mailHost = 'imap.example.com';
        Config.mailEmailAddress = 'inbox@example.com';
        Config.mailPassword = '';

        expect(() => Config.assertMailConfig()).toThrow('MAIL_PASSWORD');
    });

    test('does not throw when every mail variable is set', () => {
        Config.mailHost = 'imap.example.com';
        Config.mailEmailAddress = 'inbox@example.com';
        Config.mailPassword = 'secret';

        expect(() => Config.assertMailConfig()).not.toThrow();
    });
});
