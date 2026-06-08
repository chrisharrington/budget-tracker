import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { Balance } from '@lib/models';

let mongod: MongoMemoryServer;
let Config: typeof import('@lib/config').default;
let BalanceService: typeof import('.');
let collection: typeof import('@lib/data/base').collection;
let closeDatabase: typeof import('@lib/data/base').closeDatabase;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    Config = (await import('@lib/config')).default;
    Config.databaseConnectionString = mongod.getUri();
    BalanceService = await import('.');
    ({ collection, closeDatabase } = await import('@lib/data/base'));

    await BalanceService.ensureWeekOfIndex();
});

afterAll(async () => {
    await closeDatabase();
    await mongod.stop();
});

beforeEach(async () => {
    const balances = await collection<Balance>('balances');
    await balances.deleteMany({});
});

const weekOf = new Date('2026-06-01T06:00:00.000Z');

describe('BalanceService.findForWeek', () => {
    test('returns null when no balance exists for the week', async () => {
        expect(await BalanceService.findForWeek(weekOf)).toBeNull();
    });

    test('returns the balance document for a matching week', async () => {
        await BalanceService.upsertForWeek(weekOf, 250);
        const balance = await BalanceService.findForWeek(weekOf);
        expect(balance?.amount).toBe(250);
    });
});

describe('BalanceService.upsertForWeek', () => {
    test('inserts when absent and updates in place on a repeat week', async () => {
        await BalanceService.upsertForWeek(weekOf, 100);
        await BalanceService.upsertForWeek(weekOf, 175);

        expect((await BalanceService.findForWeek(weekOf))?.amount).toBe(175);

        const balances = await collection<Balance>('balances');
        expect(await balances.countDocuments({ weekOf })).toBe(1);
    });
});

describe('BalanceService.ensureWeekOfIndex', () => {
    test('enforces a single document per week', async () => {
        const balances = await collection<Balance>('balances');
        await balances.insertOne({ weekOf, amount: 1 } as Balance);

        // The unique weekOf index rejects a second document for the same week.
        await expect(balances.insertOne({ weekOf, amount: 2 } as Balance)).rejects.toThrow();
    });
});
