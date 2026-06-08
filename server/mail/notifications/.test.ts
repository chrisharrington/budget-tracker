import { afterAll, beforeAll, beforeEach, describe, expect, mock, test } from 'bun:test';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { Device, NotificationTicket, Transaction } from '@lib/models';

// Capture what the (mocked) Expo SDK receives, and let each test drive what it returns. The mock is
// registered before the subject is imported so the `new Expo(...)` static in the module resolves to
// this fake. Tickets/receipts default to empty so the existing body-formatting test is unaffected.
const chunkCalls: unknown[][] = [];
let sendResult: unknown[] = [];
let receiptResult: Record<string, unknown> = {};

class MockExpo {
    constructor(_options: unknown) { /* accessToken ignored in tests */ }
    chunkPushNotifications(messages: unknown[]): unknown[][] {
        chunkCalls.push(messages);
        return [messages];
    }
    async sendPushNotificationsAsync(_chunk: unknown[]): Promise<unknown[]> {
        return sendResult;
    }
    chunkPushNotificationReceiptIds(ids: unknown[]): unknown[][] {
        return [ids];
    }
    async getPushNotificationReceiptsAsync(_ids: unknown[]): Promise<Record<string, unknown>> {
        return receiptResult;
    }
}

mock.module('expo-server-sdk', () => ({ Expo: MockExpo }));

let mongod: MongoMemoryServer;
let Config: typeof import('@lib/config').default;
let Notifications: typeof import('.').default;
let DeviceService: typeof import('@lib/data/device');
let collection: typeof import('@lib/data/base').collection;
let closeDatabase: typeof import('@lib/data/base').closeDatabase;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    Config = (await import('@lib/config')).default;
    Config.databaseConnectionString = mongod.getUri();
    Notifications = (await import('.')).default;
    DeviceService = await import('@lib/data/device');
    ({ collection, closeDatabase } = await import('@lib/data/base'));
});

afterAll(async () => {
    await closeDatabase();
    await mongod.stop();
});

beforeEach(async () => {
    chunkCalls.length = 0;
    sendResult = [];
    receiptResult = {};
    await (await collection<NotificationTicket>('notifications')).deleteMany({});
    await (await collection<Device>('devices')).deleteMany({});
});

const transaction = { owner: 'Chris', description: 'STORE', amount: 12.5 } as Transaction;

describe('Notifications.send', () => {
    test('chunks one push message per device with the expected recipient and body', async () => {
        const device = { token: 'expo-token-1' } as Device;

        await Notifications.send(transaction, device);

        expect(chunkCalls).toEqual([
            [{ to: 'expo-token-1', body: 'A new transaction was made by Chris at STORE for $12.50.' }]
        ]);
    });

    test('persists one unacquired ticket per ok ticket, tagged with the recipient token', async () => {
        sendResult = [{ status: 'ok', id: 'receipt-1' }];

        await Notifications.send(transaction, { token: 'expo-token-1' } as Device);

        const tickets = await (await collection<NotificationTicket>('notifications')).find({}).toArray();
        expect(tickets).toHaveLength(1);
        expect(tickets[0]).toMatchObject({
            status: 'ok',
            notificationId: 'receipt-1',
            token: 'expo-token-1',
            receiptAcquired: false
        });
    });

    test('disables the device and persists nothing when the send-time ticket is DeviceNotRegistered', async () => {
        await DeviceService.upsert({ token: 'expo-token-dead' } as Device);
        sendResult = [{ status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } }];

        await Notifications.send(transaction, { token: 'expo-token-dead' } as Device);

        expect((await DeviceService.list()).map(device => device.token)).not.toContain('expo-token-dead');
        expect(await (await collection<NotificationTicket>('notifications')).countDocuments({})).toBe(0);
    });

    test('leaves the device enabled for a non-DeviceNotRegistered error ticket', async () => {
        await DeviceService.upsert({ token: 'expo-token-1' } as Device);
        sendResult = [{ status: 'error', message: 'slow down', details: { error: 'MessageRateExceeded' } }];

        await Notifications.send(transaction, { token: 'expo-token-1' } as Device);

        expect((await DeviceService.list()).map(device => device.token)).toContain('expo-token-1');
        expect(await (await collection<NotificationTicket>('notifications')).countDocuments({})).toBe(0);
    });
});

describe('Notifications.acquireReceipts', () => {
    async function seedTicket(notificationId: string, token: string): Promise<void> {
        await (await collection<NotificationTicket>('notifications')).insertOne(
            { status: 'ok', notificationId, token, receiptAcquired: false } as NotificationTicket
        );
    }

    test('marks a delivered ticket acquired and leaves devices untouched', async () => {
        await DeviceService.upsert({ token: 'expo-token-1' } as Device);
        await seedTicket('receipt-1', 'expo-token-1');
        receiptResult = { 'receipt-1': { status: 'ok' } };

        await Notifications.acquireReceipts();

        const tickets = await (await collection<NotificationTicket>('notifications')).find({}).toArray();
        expect(tickets[0].receiptAcquired).toBe(true);
        expect((await DeviceService.list()).map(device => device.token)).toContain('expo-token-1');
    });

    test('disables the device and marks the ticket acquired on a DeviceNotRegistered receipt', async () => {
        await DeviceService.upsert({ token: 'expo-token-dead' } as Device);
        await seedTicket('receipt-dead', 'expo-token-dead');
        receiptResult = { 'receipt-dead': { status: 'error', message: 'gone', details: { error: 'DeviceNotRegistered' } } };

        await Notifications.acquireReceipts();

        expect((await DeviceService.list()).map(device => device.token)).not.toContain('expo-token-dead');
        const tickets = await (await collection<NotificationTicket>('notifications')).find({}).toArray();
        expect(tickets[0].receiptAcquired).toBe(true);
    });

    test('marks the ticket acquired but leaves the device enabled for a non-DeviceNotRegistered receipt error', async () => {
        await DeviceService.upsert({ token: 'expo-token-1' } as Device);
        await seedTicket('receipt-big', 'expo-token-1');
        receiptResult = { 'receipt-big': { status: 'error', message: 'too big', details: { error: 'MessageTooBig' } } };

        await Notifications.acquireReceipts();

        expect((await DeviceService.list()).map(device => device.token)).toContain('expo-token-1');
        const tickets = await (await collection<NotificationTicket>('notifications')).find({}).toArray();
        expect(tickets[0].receiptAcquired).toBe(true);
    });

    test('leaves a ticket pending when its receipt is not yet ready (partial batch)', async () => {
        await seedTicket('receipt-ready', 'expo-token-1');
        await seedTicket('receipt-pending', 'expo-token-2');
        receiptResult = { 'receipt-ready': { status: 'ok' } };

        await Notifications.acquireReceipts();

        const stillPending = await (await collection<NotificationTicket>('notifications'))
            .find({ receiptAcquired: false }).toArray();
        expect(stillPending.map(ticket => ticket.notificationId)).toEqual(['receipt-pending']);
    });
});
