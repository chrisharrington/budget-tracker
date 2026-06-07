import { describe, expect, test } from 'bun:test';

import { Tag } from '@lib/models';

import { oneTimeBalanceDelta } from '.';

const ONE_TIME = 'one-time';
const tag = (name: string): Tag => ({ name } as Tag);

describe('oneTimeBalanceDelta', () => {
    test('spends from the pool when the one-time tag is newly added', () => {
        expect(oneTimeBalanceDelta([], [tag(ONE_TIME)], 25)).toBe(-25);
        expect(oneTimeBalanceDelta([tag('groceries')], [tag('groceries'), tag(ONE_TIME)], 25)).toBe(-25);
    });

    test('refunds the pool when the one-time tag is removed', () => {
        // The regressed branch: old had the one-time tag, new does not.
        expect(oneTimeBalanceDelta([tag(ONE_TIME)], [], 25)).toBe(25);
        expect(oneTimeBalanceDelta([tag(ONE_TIME)], [tag('groceries')], 25)).toBe(25);
    });

    test('makes no change when the one-time tag is present before and after', () => {
        expect(oneTimeBalanceDelta([tag(ONE_TIME)], [tag(ONE_TIME)], 25)).toBe(0);
    });

    test('makes no change when the one-time tag is absent before and after', () => {
        expect(oneTimeBalanceDelta([], [], 25)).toBe(0);
        expect(oneTimeBalanceDelta([tag('groceries')], [tag('dining')], 25)).toBe(0);
    });
});
