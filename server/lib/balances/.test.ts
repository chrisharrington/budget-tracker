import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongoClient } from 'mongodb';
import dayjs from 'dayjs';

// Modules are imported in beforeAll AFTER pointing Config at the in-memory Mongo, so the shared
// pooled client reads the right connection string on first use.
let mongod: MongoMemoryServer;
let Config: typeof import('@lib/config').default;
let BalanceService: typeof import('@lib/data/balance').default;
let upsertBalanceFromPreviousWeek: typeof import('@lib/balances').upsertBalanceFromPreviousWeek;
let closeDatabase: typeof import('@lib/data/base').closeDatabase;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    Config = (await import('@lib/config')).default;
    Config.databaseConnectionString = mongod.getUri();
    BalanceService = (await import('@lib/data/balance')).default;
    ({ upsertBalanceFromPreviousWeek } = await import('@lib/balances'));
    ({ closeDatabase } = await import('@lib/data/base'));

    // The unique index is what forces concurrent upserts to converge on one document.
    await BalanceService.ensureWeekOfIndex();
});

afterAll(async () => {
    await closeDatabase();
    await mongod.stop();
});

beforeEach(async () => {
    const client = await MongoClient.connect(mongod.getUri());

    try {
        await client.db(Config.mongoDb).collection('balances').deleteMany({});
    } finally {
        await client.close();
    }
});

function startOfPreviousWeek(): Date {
    return dayjs().tz(Config.timezone).startOf('week').add(1, 'day').subtract(1, 'week').toDate();
}

describe('upsertBalanceFromPreviousWeek', () => {
    test('concurrent invocations leave exactly one balance document', async () => {
        await Promise.all([
            upsertBalanceFromPreviousWeek(true),
            upsertBalanceFromPreviousWeek(true)
        ]);

        const balances = await BalanceService.find({});
        expect(balances.length).toBe(1);
        // No transactions and no prior week → the balance is just the week's base allowance.
        expect(balances[0].amount).toBe(Config.weeklyAmount(balances[0].weekOf));
    });

    test('carries the prior week balance forward via an exact weekOf match', async () => {
        const priorWeekOf = dayjs(startOfPreviousWeek()).subtract(1, 'week').toDate();
        await BalanceService.upsertForWeek(priorWeekOf, 50);

        await upsertBalanceFromPreviousWeek(true);

        // sum = 0 − priorBalance(50) = −50, so amount = weeklyAmount − sum = weeklyAmount + 50.
        const current = await BalanceService.findOne({ weekOf: startOfPreviousWeek() });
        expect(current?.amount).toBe(Config.weeklyAmount(startOfPreviousWeek()) + 50);

        const all = await BalanceService.find({});
        expect(all.length).toBe(2);
    });

    test('skips when a balance already exists and force is false', async () => {
        await BalanceService.upsertForWeek(startOfPreviousWeek(), 123);

        await upsertBalanceFromPreviousWeek(false);

        const balances = await BalanceService.find({});
        expect(balances.length).toBe(1);
        expect(balances[0].amount).toBe(123); // untouched — the existing balance was left as-is
    });
});
