import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { MongoMemoryServer } from 'mongodb-memory-server';
import dayjs from 'dayjs';

import { Balance } from '@lib/models';

// Modules are imported in beforeAll AFTER pointing Config at the in-memory Mongo, so the shared
// pooled client reads the right connection string on first use.
let mongod: MongoMemoryServer;
let Config: typeof import('@lib/config').default;
let BalanceService: typeof import('@lib/data/balance');
let upsertBalanceFromPreviousWeek: typeof import('@lib/balances').upsertBalanceFromPreviousWeek;
let collection: typeof import('@lib/data/base').collection;
let closeDatabase: typeof import('@lib/data/base').closeDatabase;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    Config = (await import('@lib/config')).default;
    Config.databaseConnectionString = mongod.getUri();
    BalanceService = await import('@lib/data/balance');
    ({ upsertBalanceFromPreviousWeek } = await import('@lib/balances'));
    ({ collection, closeDatabase } = await import('@lib/data/base'));

    // The unique index is what forces concurrent upserts to converge on one document.
    await BalanceService.ensureWeekOfIndex();
});

afterAll(async () => {
    await closeDatabase();
    await mongod.stop();
});

beforeEach(async () => {
    await (await collection<Balance>('balances')).deleteMany({});
});

function startOfPreviousWeek(): Date {
    return dayjs().tz(Config.timezone).startOf('week').add(1, 'day').subtract(1, 'week').toDate();
}

async function countBalances(): Promise<number> {
    return await (await collection<Balance>('balances')).countDocuments({});
}

describe('upsertBalanceFromPreviousWeek', () => {
    test('concurrent invocations leave exactly one balance document', async () => {
        await Promise.all([upsertBalanceFromPreviousWeek(true), upsertBalanceFromPreviousWeek(true)]);

        expect(await countBalances()).toBe(1);
        // No transactions and no prior week → the balance is just the week's base allowance.
        const balance = await BalanceService.findForWeek(startOfPreviousWeek());
        expect(balance?.amount).toBe(Config.weeklyAmount(startOfPreviousWeek()));
    });

    test('carries the prior week balance forward via an exact weekOf match', async () => {
        const priorWeekOf = dayjs(startOfPreviousWeek()).subtract(1, 'week').toDate();
        await BalanceService.upsertForWeek(priorWeekOf, 50);

        await upsertBalanceFromPreviousWeek(true);

        // sum = 0 − priorBalance(50) = −50, so amount = weeklyAmount − sum = weeklyAmount + 50.
        const current = await BalanceService.findForWeek(startOfPreviousWeek());
        expect(current?.amount).toBe(Config.weeklyAmount(startOfPreviousWeek()) + 50);

        expect(await countBalances()).toBe(2);
    });

    test('skips when a balance already exists and force is false', async () => {
        await BalanceService.upsertForWeek(startOfPreviousWeek(), 123);

        await upsertBalanceFromPreviousWeek(false);

        expect(await countBalances()).toBe(1);
        // untouched — the existing balance was left as-is
        expect((await BalanceService.findForWeek(startOfPreviousWeek()))?.amount).toBe(123);
    });

    test('overwrites an existing balance when force is true', async () => {
        // A stale balance is present for the week; force=true must recompute and replace it in place.
        await BalanceService.upsertForWeek(startOfPreviousWeek(), 123);

        await upsertBalanceFromPreviousWeek(true);

        expect(await countBalances()).toBe(1);
        // No transactions and no prior week → recomputed to the base allowance, not the stale 123.
        expect((await BalanceService.findForWeek(startOfPreviousWeek()))?.amount).toBe(
            Config.weeklyAmount(startOfPreviousWeek()),
        );
    });
});
