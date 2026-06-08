import { describe, expect, test } from 'bun:test';

import { parseMessage } from '.';

// Representative decoded HTML body, mirroring the shape mailparser hands us (see mail/sample.txt).
const body = (card: string, merchant: string) =>
    `<p>Just a quick note to let you know that a transaction of $1,283.94 was made on your ` +
    `Tangerine World Mastercard<sup>&#174;</sup> 5360 xxxx  xxxx ${card} at ${merchant} on ` +
    `August 14, 2020.<br><br>If you have any questions, please don't hesitate to call us.</p>`;

describe('parseMessage', () => {
    const date = new Date('2020-08-14T21:58:33.000Z');

    test('extracts the amount, handling thousands separators', () => {
        const transaction = parseMessage(body('0931', 'ROYAL OAK AUDI'), date);
        expect(transaction.amount).toBe(1283.94);
    });

    test('extracts the merchant description between "at" and the trailing "on"', () => {
        const transaction = parseMessage(body('0931', 'ROYAL OAK AUDI'), date);
        expect(transaction.description).toBe('ROYAL OAK AUDI');
    });

    test('attributes the transaction to Chris when card 1379 is present', () => {
        const transaction = parseMessage(body('1379', 'TIM HORTONS'), date);
        expect(transaction.owner).toBe('Chris');
    });

    test('attributes the transaction to Sarah otherwise', () => {
        const transaction = parseMessage(body('0931', 'ROYAL OAK AUDI'), date);
        expect(transaction.owner).toBe('Sarah');
    });

    test('passes the date through and defaults ignored/tags', () => {
        const transaction = parseMessage(body('0931', 'ROYAL OAK AUDI'), date);
        expect(transaction.date).toBe(date);
        expect(transaction.ignored).toBe(false);
        expect(transaction.tags).toEqual([]);
    });
});
