import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import express, { Express } from 'express';
import pinoHttp from 'pino-http';
import pino from 'pino';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import type { AddressInfo } from 'net';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { Balance, OneTime, Transaction } from '@lib/models';
import { errorHandler } from '@api/error-handler';

import budgetRouter from '.';

dayjs.extend(utc);
dayjs.extend(timezone);

// Builds an app wired the way api/app.ts wires it: request logging, the budget router, and the
// central error middleware last — so thrown handler errors travel the real asyncHandler→errorHandler
// path rather than a per-route try/catch.
function buildApp(): Express {
    const app = express();
    app.use(pinoHttp({ logger: pino({ level: 'silent' }) }));
    app.use(express.json());
    app.use('/', budgetRouter);
    app.use(errorHandler);
    return app;
}

describe('budget router request validation', () => {
    // These all reject at the validate middleware (ZodError → errorHandler → 400) before any handler
    // or DB work, so no Mongo is needed.
    async function statusFor(path: string, init?: RequestInit): Promise<number> {
        const server = buildApp().listen(0);
        const { port } = server.address() as AddressInfo;
        try {
            const response = await fetch(`http://127.0.0.1:${port}${path}`, init);
            return response.status;
        } finally {
            server.close();
        }
    }

    test('rejects GET /week without a date as 400', async () => {
        expect(await statusFor('/week')).toBe(400);
    });

    test('rejects GET /week with an unparseable date as 400', async () => {
        expect(await statusFor('/week?date=not-a-date')).toBe(400);
    });

    test('rejects POST /transaction without an amount as 400', async () => {
        const status = await statusFor('/transaction', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                _id: 'abc',
                date: '2026-06-01T00:00:00.000Z',
                description: 'COFFEE',
                owner: 'Chris',
                ignored: false,
                tags: [],
            }),
        });
        expect(status).toBe(400);
    });
});

describe('GET /history week bucketing', () => {
    let mongod: MongoMemoryServer;
    let Config: typeof import('@lib/config').default;
    let TransactionService: typeof import('@lib/data/transaction');
    let closeDatabase: typeof import('@lib/data/base').closeDatabase;

    beforeAll(async () => {
        mongod = await MongoMemoryServer.create();
        Config = (await import('@lib/config')).default;
        Config.databaseConnectionString = mongod.getUri();
        TransactionService = await import('@lib/data/transaction');
        ({ closeDatabase } = await import('@lib/data/base'));

        const seed = async (description: string, iso: string, amount: number, ignored = false) => {
            await TransactionService.insertOne({
                amount,
                date: new Date(iso),
                description,
                owner: 'Chris',
                ignored,
                tags: [],
            } as import('@lib/models').Transaction);
        };

        // Week of Mon 2026-06-01 (MDT, UTC-6): two spends totalling 150.
        await seed('a', '2026-06-03T12:00:00.000Z', 100);
        // 05:00Z Jun 8 is Sun 23:00 Edmonton — belongs to the 06-01 week, NOT the 06-08 UTC week.
        await seed('c', '2026-06-08T05:00:00.000Z', 50);
        // Week of Mon 2026-06-08: one spend of 30.
        await seed('b', '2026-06-10T12:00:00.000Z', 30);
        // Ignored rows are excluded from history entirely.
        await seed('ignored', '2026-06-03T12:00:00.000Z', 999, true);
    });

    afterAll(async () => {
        await closeDatabase();
        await mongod.stop();
    });

    test('groups transactions into Edmonton weeks with weekly-budget-minus-spend balances', async () => {
        const server = buildApp().listen(0);
        const { port } = server.address() as AddressInfo;

        try {
            const response = await fetch(`http://127.0.0.1:${port}/history`);
            const body = (await response.json()) as Array<{ date: string; balance: number }>;

            expect(response.status).toBe(200);
            // Weekly amount is 400 for 2026 (Config.weeklyAmount). Two weeks, sorted date-descending.
            // 06-08 week: 400 - 30 = 370. 06-01 week: 400 - 100 - 50 = 250 (the 05:00Z Jun-8 row lands
            // here because Edmonton bucketing puts it in the prior week; the ignored row is excluded).
            expect(body.map(entry => entry.balance)).toEqual([370, 250]);
        } finally {
            server.close();
        }
    });
});

describe('budget router (DB-backed routes)', () => {
    let mongod: MongoMemoryServer;
    let Config: typeof import('@lib/config').default;
    let TransactionService: typeof import('@lib/data/transaction');
    let BalanceService: typeof import('@lib/data/balance');
    let OneTimeService: typeof import('@lib/data/one-time');
    let collection: typeof import('@lib/data/base').collection;
    let closeDatabase: typeof import('@lib/data/base').closeDatabase;

    beforeAll(async () => {
        mongod = await MongoMemoryServer.create();
        Config = (await import('@lib/config')).default;
        Config.databaseConnectionString = mongod.getUri();
        TransactionService = await import('@lib/data/transaction');
        BalanceService = await import('@lib/data/balance');
        OneTimeService = await import('@lib/data/one-time');
        ({ collection, closeDatabase } = await import('@lib/data/base'));
    });

    afterAll(async () => {
        await closeDatabase();
        await mongod.stop();
    });

    beforeEach(async () => {
        await (await collection<Transaction>('transactions')).deleteMany({});
        await (await collection<Balance>('balances')).deleteMany({});
        await (await collection<OneTime>('one-time')).deleteMany({});
    });

    const transaction = (overrides: Partial<Transaction>): Transaction =>
        ({
            amount: 10,
            date: new Date('2026-06-03T12:00:00.000Z'),
            description: 'STORE',
            owner: 'Chris',
            ignored: false,
            tags: [],
            ...overrides,
        }) as Transaction;

    async function request(path: string, init?: RequestInit): Promise<Response> {
        const server = buildApp().listen(0);
        const { port } = server.address() as AddressInfo;
        try {
            return await fetch(`http://127.0.0.1:${port}${path}`, init);
        } finally {
            server.close();
        }
    }

    const post = (path: string, body: unknown): Promise<Response> =>
        request(path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        });

    // The route's own checkTransaction/updateBalance derive these boundaries from `dayjs()` now, so the
    // tests build their dates the same way to stay deterministic regardless of the day they run.
    const startOfPreviousWeek = () => dayjs().tz(Config.timezone).startOf('week').add(1, 'day').subtract(1, 'week');

    test("GET /week returns the weekly amount, carried balance, and the week's transactions", async () => {
        await TransactionService.insertOne(
            transaction({ description: 'in-1', amount: 100, date: new Date('2026-06-03T12:00:00.000Z') }),
        );
        await TransactionService.insertOne(
            transaction({ description: 'in-2', amount: 50, date: new Date('2026-06-04T12:00:00.000Z') }),
        );
        // Prior-week balance the route carries forward (week of Mon 2026-05-25 Edmonton).
        await BalanceService.upsertForWeek(dayjs.tz('2026-05-25', Config.timezone).toDate(), 370);

        const response = await request('/week?date=2026-06-03');
        const body = (await response.json()) as { weeklyAmount: number; balance: number; transactions: Transaction[] };

        expect(response.status).toBe(200);
        expect(body.weeklyAmount).toBe(400);
        expect(body.balance).toBe(370);
        expect(body.transactions.map(t => t.description).sort()).toEqual(['in-1', 'in-2']);
    });

    test('POST /transaction updates tags, applies the one-time delta, and snapshots the previous week', async () => {
        await (await collection<OneTime>('one-time')).insertOne({ balance: 100 } as OneTime);
        const seeded = await TransactionService.insertOne(
            transaction({ amount: 25, date: startOfPreviousWeek().add(1, 'hour').toDate() }),
        );

        const response = await post('/transaction', {
            _id: String(seeded._id),
            amount: 25,
            date: startOfPreviousWeek().add(1, 'hour').toISOString(),
            description: 'STORE',
            owner: 'Chris',
            ignored: false,
            tags: [{ name: 'one-time', ignore: false }],
        });

        expect(response.status).toBe(200);

        const updated = await TransactionService.findById(String(seeded._id));
        expect(updated?.tags.some(tag => tag.name === 'one-time')).toBe(true);
        // The one-time tag is newly added → 25 spent from the pool.
        expect((await OneTimeService.get()).balance).toBe(75);
        // The transaction sits in the previous week, so updateBalance writes that week's snapshot.
        expect(await (await collection<Balance>('balances')).countDocuments({})).toBe(1);
    });

    test('POST /transaction does not snapshot a balance for a current-week transaction', async () => {
        await (await collection<OneTime>('one-time')).insertOne({ balance: 100 } as OneTime);
        // This Monday 01:00 — allowed by checkTransaction, but outside updateBalance's previous-week window.
        const currentWeekDate = startOfPreviousWeek().add(1, 'week').add(1, 'hour');
        const seeded = await TransactionService.insertOne(transaction({ amount: 25, date: currentWeekDate.toDate() }));

        const response = await post('/transaction', {
            _id: String(seeded._id),
            amount: 25,
            date: currentWeekDate.toISOString(),
            description: 'STORE',
            owner: 'Chris',
            ignored: false,
            tags: [],
        });

        expect(response.status).toBe(200);
        expect(await (await collection<Balance>('balances')).countDocuments({})).toBe(0);
    });

    test('POST /transaction rejects edits older than the previous week with 400', async () => {
        const response = await post('/transaction', {
            _id: 'deadbeefdeadbeefdeadbeef',
            amount: 25,
            date: startOfPreviousWeek().subtract(1, 'day').toISOString(),
            description: 'STORE',
            owner: 'Chris',
            ignored: false,
            tags: [],
        });

        expect(response.status).toBe(400);
    });

    test('POST /transaction/split preserves the total across the original and the new transaction', async () => {
        const seeded = await TransactionService.insertOne(
            transaction({ amount: 100, date: startOfPreviousWeek().add(1, 'hour').toDate() }),
        );

        const response = await post('/transaction/split', {
            transaction: {
                _id: String(seeded._id),
                amount: 100,
                date: startOfPreviousWeek().add(1, 'hour').toISOString(),
                description: 'STORE',
                owner: 'Chris',
                ignored: false,
                tags: [],
            },
            newAmount: 30,
        });

        expect(response.status).toBe(200);

        const all = await (await collection<Transaction>('transactions')).find({}).toArray();
        expect(all.length).toBe(2);
        expect(all.map(t => t.amount).sort((first, second) => first - second)).toEqual([30, 70]);
    });

    test('GET /transaction/sum-monthly sums tagged transactions within the date range', async () => {
        const groceries = [{ _id: 'g', name: 'groceries', ignore: false }];
        await TransactionService.insertOne(
            transaction({ description: 'g1', amount: 40, date: new Date('2026-03-05T12:00:00.000Z'), tags: groceries }),
        );
        await TransactionService.insertOne(
            transaction({ description: 'g2', amount: 60, date: new Date('2026-03-20T12:00:00.000Z'), tags: groceries }),
        );
        await TransactionService.insertOne(
            transaction({
                description: 'out-of-range',
                amount: 999,
                date: new Date('2026-04-05T12:00:00.000Z'),
                tags: groceries,
            }),
        );
        await TransactionService.insertOne(
            transaction({
                description: 'other-tag',
                amount: 500,
                date: new Date('2026-03-10T12:00:00.000Z'),
                tags: [{ _id: 'd', name: 'dining', ignore: false }],
            }),
        );

        const response = await request('/transaction/sum-monthly?start=2026-03-01&end=2026-04-01&tag=groceries');
        const body = (await response.json()) as { sum: number; transactions: unknown[] };

        expect(response.status).toBe(200);
        expect(body.sum).toBe(100);
        expect(body.transactions.length).toBe(2);
    });
});
