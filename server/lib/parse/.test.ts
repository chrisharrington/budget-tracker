import { describe, expect, test } from 'bun:test';

import { copyTransaction } from '.';
import { Transaction } from '@lib/models';

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
