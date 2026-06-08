import { describe, expect, test } from 'bun:test';

import {
    deviceTokenSchema,
    monthlyTagQuerySchema,
    tagSchema,
    transactionSchema,
    transactionSplitSchema,
    weekQuerySchema
} from '.';

const validTransaction = {
    _id: 'abc',
    amount: 12.5,
    date: '2026-06-01T00:00:00.000Z',
    description: 'COFFEE',
    owner: 'Chris',
    ignored: false,
    tags: [{ _id: 't1', name: 'food', ignore: false }]
};

describe('transactionSchema', () => {
    test('rejects a body with a missing amount', () => {
        const { amount, ...withoutAmount } = validTransaction;
        expect(transactionSchema.safeParse(withoutAmount).success).toBe(false);
    });

    test('coerces an ISO date string into a Date', () => {
        const parsed = transactionSchema.parse(validTransaction);
        expect(parsed.date).toBeInstanceOf(Date);
        expect(parsed.date.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    });

    test('defaults tags to an empty array and ignored to false when absent', () => {
        const { tags, ignored, ...rest } = validTransaction;
        const parsed = transactionSchema.parse(rest);
        expect(parsed.tags).toEqual([]);
        expect(parsed.ignored).toBe(false);
    });

    test('strips unknown top-level keys such as the client-only balance', () => {
        const parsed = transactionSchema.parse({ ...validTransaction, balance: true });
        expect('balance' in parsed).toBe(false);
    });
});

describe('tagSchema', () => {
    test('preserves extra app-only keys (loose) and defaults ignore to false', () => {
        const parsed = tagSchema.parse({ name: 'food', defaults: ['groceries'], updated: '2026-01-01' });
        expect(parsed.ignore).toBe(false);
        expect((parsed as { defaults: string[] }).defaults).toEqual(['groceries']);
    });

    test('rejects a tag without a name', () => {
        expect(tagSchema.safeParse({ ignore: true }).success).toBe(false);
    });
});

describe('transactionSplitSchema', () => {
    test('accepts a transaction with a numeric newAmount', () => {
        expect(transactionSplitSchema.safeParse({ transaction: validTransaction, newAmount: 5 }).success).toBe(true);
    });

    test('rejects a missing newAmount', () => {
        expect(transactionSplitSchema.safeParse({ transaction: validTransaction }).success).toBe(false);
    });
});

describe('weekQuerySchema', () => {
    test('accepts a dayjs-formatted date string', () => {
        expect(weekQuerySchema.safeParse({ date: '2026-06-08T14:30:45-06:00' }).success).toBe(true);
    });

    test('rejects a missing or unparseable date', () => {
        expect(weekQuerySchema.safeParse({}).success).toBe(false);
        expect(weekQuerySchema.safeParse({ date: 'not-a-date' }).success).toBe(false);
    });
});

describe('monthlyTagQuerySchema', () => {
    test('accepts valid start/end/tag', () => {
        expect(monthlyTagQuerySchema.safeParse({ start: '2026-06-01', end: '2026-06-30', tag: 'food' }).success).toBe(true);
    });

    test('rejects a bad date or an empty tag', () => {
        expect(monthlyTagQuerySchema.safeParse({ start: 'nope', end: '2026-06-30', tag: 'food' }).success).toBe(false);
        expect(monthlyTagQuerySchema.safeParse({ start: '2026-06-01', end: '2026-06-30', tag: '' }).success).toBe(false);
    });
});

describe('deviceTokenSchema', () => {
    test('accepts a non-empty token', () => {
        expect(deviceTokenSchema.safeParse({ token: 'expo-token-1' }).success).toBe(true);
    });

    test('rejects an empty or missing token', () => {
        expect(deviceTokenSchema.safeParse({ token: '' }).success).toBe(false);
        expect(deviceTokenSchema.safeParse({}).success).toBe(false);
    });
});
