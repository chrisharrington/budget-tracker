import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { NotificationTicket } from '@lib/models';

// Imported in beforeAll after pointing Config at the in-memory Mongo (the shared pooled client reads
// the connection string on first use).
let mongod: MongoMemoryServer;
let Config: typeof import('@lib/config').default;
let NotificationService: typeof import('.');
let collection: typeof import('@lib/data/base').collection;
let closeDatabase: typeof import('@lib/data/base').closeDatabase;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    Config = (await import('@lib/config')).default;
    Config.databaseConnectionString = mongod.getUri();
    NotificationService = await import('.');
    ({ collection, closeDatabase } = await import('@lib/data/base'));
});

afterAll(async () => {
    await closeDatabase();
    await mongod.stop();
});

beforeEach(async () => {
    await (await collection<NotificationTicket>('notifications')).deleteMany({});
});

describe('NotificationService', () => {
    test('listUnacquired returns only tickets still awaiting a receipt', async () => {
        await NotificationService.insert([
            { status: 'ok', notificationId: 'receipt-1', token: 'token-1', receiptAcquired: false },
            { status: 'ok', notificationId: 'receipt-2', token: 'token-2', receiptAcquired: true }
        ]);

        const pending = await NotificationService.listUnacquired();

        expect(pending.map(ticket => ticket.notificationId)).toEqual(['receipt-1']);
        expect(pending[0].token).toBe('token-1');
    });

    test('markAcquired flips only the named tickets', async () => {
        await NotificationService.insert([
            { status: 'ok', notificationId: 'receipt-1', token: 'token-1', receiptAcquired: false },
            { status: 'ok', notificationId: 'receipt-2', token: 'token-2', receiptAcquired: false }
        ]);

        await NotificationService.markAcquired(['receipt-1']);

        const pending = await NotificationService.listUnacquired();
        expect(pending.map(ticket => ticket.notificationId)).toEqual(['receipt-2']);
    });

    test('markAcquired ignores unknown receipt ids without touching existing tickets', async () => {
        await NotificationService.insert([
            { status: 'ok', notificationId: 'receipt-1', token: 'token-1', receiptAcquired: false }
        ]);

        await NotificationService.markAcquired(['does-not-exist']);

        const pending = await NotificationService.listUnacquired();
        expect(pending.map(ticket => ticket.notificationId)).toEqual(['receipt-1']);
    });

    test('insert and markAcquired are no-ops when given empty arrays', async () => {
        await NotificationService.insert([]);
        await NotificationService.markAcquired([]);

        expect(await NotificationService.listUnacquired()).toEqual([]);
    });
});
