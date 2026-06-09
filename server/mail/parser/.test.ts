import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';

import Config from '@lib/config';

import { parseMessage } from '.';

const fixture = (name: string) => readFileSync(join(import.meta.dir, '../__fixtures__', name), 'utf8');

const happy = fixture('tangerine-happy.html');
const sarah = fixture('tangerine-sarah.html');
const missingAmount = fixture('tangerine-missing-amount.html');
const missingMerchant = fixture('tangerine-missing-merchant.html');

const originalMap = Config.cardOwnerMap;

beforeEach(() => {
    Config.cardOwnerMap = { '1379': 'Chris', '8472': 'Sarah' };
});

afterEach(() => {
    Config.cardOwnerMap = originalMap;
});

describe('parseMessage — happy path', () => {
    test('extracts amount, merchant, owner, date, and the fixed ignored/tags fields', () => {
        const transaction = parseMessage(happy);

        expect(transaction.amount).toBe(1283.94);
        expect(transaction.description).toBe('ROYAL OAK AUDI');
        expect(transaction.owner).toBe('Chris');
        // The email states "August 14, 2020"; parsed at Edmonton (MDT, UTC-6) midnight, not IMAP time.
        expect(transaction.date.toISOString()).toBe('2020-08-14T06:00:00.000Z');
        expect(transaction.ignored).toBe(false);
        expect(transaction.tags).toEqual([]);
    });
});

describe('parseMessage — amount extraction', () => {
    test('parses an amount with no thousands separator', () => {
        expect(parseMessage(happy.replace('$1,283.94', '$42.50')).amount).toBe(42.5);
    });

    test('strips every thousands separator from a large amount', () => {
        expect(parseMessage(happy.replace('$1,283.94', '$1,234,567.89')).amount).toBe(1234567.89);
    });

    test('throws when no amount is present', () => {
        expect(() => parseMessage(missingAmount)).toThrow('amount');
    });

    test('throws when the amount is not formatted with two decimals', () => {
        // The regex requires `\.[0-9]{2}`, so a bare-dollar or single-decimal value is not an amount.
        expect(() => parseMessage(happy.replace('$1,283.94', '$5'))).toThrow('amount');
    });
});

describe('parseMessage — merchant extraction', () => {
    test('reads the merchant between "at" and "on", ignoring a later "call us at …"', () => {
        // The happy fixture deliberately ends with "call us at 1-888-826-4374"; first-match wins.
        expect(parseMessage(happy).description).toBe('ROYAL OAK AUDI');
    });

    test("does not mis-attribute when the merchant name contains another card's digits", () => {
        // Owner must come from the card number (1379 → Chris), never from "8472" sitting in the
        // merchant name — the exact failure mode the old substring heuristic had.
        const transaction = parseMessage(happy.replace('ROYAL OAK AUDI', 'STORE 8472'));
        expect(transaction.description).toBe('STORE 8472');
        expect(transaction.owner).toBe('Chris');
    });

    test('throws when there is no merchant clause', () => {
        expect(() => parseMessage(missingMerchant)).toThrow('merchant');
    });

    test('rejects a whitespace-only merchant via schema validation', () => {
        // The merchant regex matches, but the trimmed value is empty → Zod `min(1)` rejects.
        expect(() => parseMessage(happy.replace('at ROYAL OAK AUDI on', 'at    on'))).toThrow();
    });
});

describe('parseMessage — card/owner attribution', () => {
    test('attributes a different card to its mapped owner', () => {
        expect(parseMessage(happy.replace('1379', '8472')).owner).toBe('Sarah');
    });

    test('picks the last-4 immediately before "at", not an earlier digit group', () => {
        // The masked number "5360 xxxx xxxx 1379" must resolve to 1379 (→ Chris), not 5360.
        expect(parseMessage(happy).owner).toBe('Chris');
    });

    test('throws when the card is not in CARD_OWNER_MAP', () => {
        Config.cardOwnerMap = { '8472': 'Sarah' };
        expect(() => parseMessage(happy)).toThrow('CARD_OWNER_MAP');
    });

    test('attributes a real Sarah-addressed email to Sarah', () => {
        Config.cardOwnerMap = { '1379': 'Chris', '2988': 'Sarah' };

        const transaction = parseMessage(sarah);

        expect(transaction.owner).toBe('Sarah');
        expect(transaction.amount).toBe(58.2);
        expect(transaction.description).toBe('SAFEWAY');
        // "January 12, 2026" parsed at Edmonton (MST, UTC-7) midnight.
        expect(transaction.date.toISOString()).toBe('2026-01-12T07:00:00.000Z');
    });
});

describe('parseMessage — date extraction', () => {
    test('applies the correct DST offset for a winter (MST, UTC-7) date', () => {
        const transaction = parseMessage(happy.replace('August 14, 2020', 'January 12, 2026'));
        expect(transaction.date.toISOString()).toBe('2026-01-12T07:00:00.000Z');
    });

    test('throws when the date is not a full "Month D, YYYY"', () => {
        expect(() => parseMessage(happy.replace('August 14, 2020', 'Aug 14'))).toThrow('date');
    });
});
