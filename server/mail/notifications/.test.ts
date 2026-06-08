import { beforeAll, describe, expect, mock, test } from 'bun:test';

import { Device, Transaction } from '@lib/models';

// Capture what the (mocked) Expo SDK receives. The mock is registered before the subject is imported
// so the `new Expo(...)` static in the module resolves to this fake.
const chunkCalls: unknown[][] = [];

class MockExpo {
    constructor(_options: unknown) { /* accessToken ignored in tests */ }
    chunkPushNotifications(messages: unknown[]): unknown[][] {
        chunkCalls.push(messages);
        return [messages];
    }
    async sendPushNotificationsAsync(_chunk: unknown[]): Promise<unknown[]> {
        return [];
    }
}

mock.module('expo-server-sdk', () => ({ Expo: MockExpo }));

let Notifications: typeof import('.').default;

beforeAll(async () => {
    Notifications = (await import('.')).default;
});

describe('Notifications.send', () => {
    test('chunks one push message per device with the expected recipient and body', async () => {
        const transaction = { owner: 'Chris', description: 'STORE', amount: 12.5 } as Transaction;
        const device = { token: 'expo-token-1' } as Device;

        await Notifications.send(transaction, device);

        expect(chunkCalls).toEqual([
            [{ to: 'expo-token-1', body: 'A new transaction was made by Chris at STORE for $12.50.' }]
        ]);
    });
});
