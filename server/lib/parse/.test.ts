import { describe, expect, test } from 'bun:test';

import { copyTransaction, parseDevice, parseTransaction } from '.';
import { Transaction } from '@lib/models';

describe('parseTransaction', () => {
    test('coerces an ISO date string into a Date', () => {
        const transaction = parseTransaction({
            _id: 'abc',
            amount: 12.5,
            date: '2026-06-01T00:00:00.000Z',
            description: 'COFFEE',
            owner: 'Chris',
            ignored: false
        });

        expect(transaction.date).toBeInstanceOf(Date);
        expect(transaction.date.toISOString()).toBe('2026-06-01T00:00:00.000Z');
    });

    test('defaults tags to an empty array when absent', () => {
        const transaction = parseTransaction({
            _id: 'abc',
            amount: 12.5,
            date: '2026-06-01T00:00:00.000Z',
            description: 'COFFEE',
            owner: 'Chris',
            ignored: false
        });

        expect(transaction.tags).toEqual([]);
    });

    test('preserves the supplied fields', () => {
        const tags = [{ _id: 't1', name: 'food', ignore: false }];
        const transaction = parseTransaction({
            _id: 'abc',
            amount: -42,
            date: '2026-06-01T00:00:00.000Z',
            description: 'GROCERIES',
            owner: 'Sarah',
            ignored: true,
            tags
        });

        expect(transaction._id).toBe('abc');
        expect(transaction.amount).toBe(-42);
        expect(transaction.description).toBe('GROCERIES');
        expect(transaction.owner).toBe('Sarah');
        expect(transaction.ignored).toBe(true);
        expect(transaction.tags).toEqual(tags);
    });
});

describe('parseDevice', () => {
    test('maps the token from the raw body', () => {
        const device = parseDevice({ token: 'expo-token-1' });
        expect(device.token).toBe('expo-token-1');
    });

    test('passes through an existing _id', () => {
        const device = parseDevice({ _id: 'device-1', token: 'expo-token-1' });
        expect(device._id).toBe('device-1');
    });
});

describe('copyTransaction', () => {
    const original: Transaction = {
        _id: 'original-id',
        amount: 100,
        date: new Date('2026-06-01T00:00:00.000Z'),
        description: 'STORE',
        owner: 'Chris',
        ignored: false,
        tags: [{ _id: 't1', name: 'food', ignore: false }]
    };

    test('clones the data fields without carrying the _id', () => {
        const copy = copyTransaction(original);

        expect(copy._id).toBeUndefined();
        expect(copy.amount).toBe(100);
        expect(copy.description).toBe('STORE');
        expect(copy.owner).toBe('Chris');
        expect(copy.ignored).toBe(false);
        expect(copy.date).toBe(original.date);
        expect(copy.tags).toEqual(original.tags);
    });

    test('produces an independent tags array', () => {
        const copy = copyTransaction(original);
        copy.tags.push({ _id: 't2', name: 'extra', ignore: true });

        expect(original.tags).toHaveLength(1);
    });
});
