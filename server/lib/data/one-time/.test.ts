import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { OneTime, Tag, Transaction } from '@lib/models';

let mongod: MongoMemoryServer;
let Config: typeof import('@lib/config').default;
let OneTimeService: typeof import('.');
let collection: typeof import('@lib/data/base').collection;
let closeDatabase: typeof import('@lib/data/base').closeDatabase;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    Config = (await import('@lib/config')).default;
    Config.databaseConnectionString = mongod.getUri();
    OneTimeService = await import('.');
    ({ collection, closeDatabase } = await import('@lib/data/base'));
});

afterAll(async () => {
    await closeDatabase();
    await mongod.stop();
});

beforeEach(async () => {
    await (await collection<OneTime>('one-time')).deleteMany({});
    await (await collection<Transaction>('transactions')).deleteMany({});
});

const tag = (name: string): Tag => ({ name } as Tag);

describe('oneTimeBalanceDelta', () => {
    const ONE_TIME = 'one-time';

    test('spends from the pool when the one-time tag is newly added', () => {
        expect(OneTimeService.oneTimeBalanceDelta([], [tag(ONE_TIME)], 25)).toBe(-25);
        expect(OneTimeService.oneTimeBalanceDelta([tag('groceries')], [tag('groceries'), tag(ONE_TIME)], 25)).toBe(-25);
    });

    test('refunds the pool when the one-time tag is removed', () => {
        expect(OneTimeService.oneTimeBalanceDelta([tag(ONE_TIME)], [], 25)).toBe(25);
        expect(OneTimeService.oneTimeBalanceDelta([tag(ONE_TIME)], [tag('groceries')], 25)).toBe(25);
    });

    test('makes no change when the one-time tag is present before and after', () => {
        expect(OneTimeService.oneTimeBalanceDelta([tag(ONE_TIME)], [tag(ONE_TIME)], 25)).toBe(0);
    });

    test('makes no change when the one-time tag is absent before and after', () => {
        expect(OneTimeService.oneTimeBalanceDelta([], [], 25)).toBe(0);
        expect(OneTimeService.oneTimeBalanceDelta([tag('groceries')], [tag('dining')], 25)).toBe(0);
    });
});

describe('OneTimeService.get', () => {
    test('throws when no one-time record exists', async () => {
        await expect(OneTimeService.get()).rejects.toThrow('No one-time balance record found.');
    });

    test('returns the stored record', async () => {
        await (await collection<OneTime>('one-time')).insertOne({ balance: 500 } as OneTime);
        expect((await OneTimeService.get()).balance).toBe(500);
    });
});

describe('OneTimeService.addAmount', () => {
    test('increments the stored balance', async () => {
        await (await collection<OneTime>('one-time')).insertOne({ balance: 100 } as OneTime);
        await OneTimeService.addAmount(2000);
        expect((await OneTimeService.get()).balance).toBe(2100);
    });
});

describe('OneTimeService.applyTransaction', () => {
    test('spends from the pool when a transaction gains the one-time tag', async () => {
        const transactions = await collection<Transaction>('transactions');
        const { insertedId } = await transactions.insertOne({
            amount: 25, date: new Date(), description: 'STORE', owner: 'Chris', ignored: false, tags: []
        } as unknown as Transaction);
        await (await collection<OneTime>('one-time')).insertOne({ balance: 100 } as OneTime);

        await OneTimeService.applyTransaction({
            _id: insertedId.toString(),
            amount: 25, date: new Date(), description: 'STORE', owner: 'Chris', ignored: false,
            tags: [tag('one-time')]
        });

        expect((await OneTimeService.get()).balance).toBe(75);
    });
});
