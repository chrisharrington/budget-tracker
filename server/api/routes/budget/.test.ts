import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import express, { Express } from 'express';
import pinoHttp from 'pino-http';
import pino from 'pino';
import type { AddressInfo } from 'net';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { errorHandler } from '@api/error-handler';

import budgetRouter from '.';

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

describe('budget router error handling', () => {
    test('responds 500 without leaking the internal error', async () => {
        const server = buildApp().listen(0);
        const { port } = server.address() as AddressInfo;

        try {
            // No `date` query param → the handler throws `Missing date parameter…` → asyncHandler
            // forwards it → errorHandler → sanitized 500. A DB-free, deterministic error path.
            const response = await fetch(`http://127.0.0.1:${port}/week`);
            const body = await response.text();

            expect(response.status).toBe(500);
            expect(body).toBe('Internal Server Error');
            expect(body).not.toContain('date parameter');
        } finally {
            server.close();
        }
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
                tags: []
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
            const body = await response.json() as Array<{ date: string; balance: number }>;

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
