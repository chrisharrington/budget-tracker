import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { Device } from '@lib/models';

// Imported in beforeAll after pointing Config at the in-memory Mongo (the shared pooled client reads
// the connection string on first use).
let mongod: MongoMemoryServer;
let Config: typeof import('@lib/config').default;
let DeviceService: typeof import('.');
let closeDatabase: typeof import('@lib/data/base').closeDatabase;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    Config = (await import('@lib/config')).default;
    Config.databaseConnectionString = mongod.getUri();
    DeviceService = await import('.');
    ({ closeDatabase } = await import('@lib/data/base'));
});

afterAll(async () => {
    await closeDatabase();
    await mongod.stop();
});

describe('DeviceService', () => {
    test('upsert registers a token without creating duplicates on repeat', async () => {
        await DeviceService.upsert({ token: 'expo-token-1' } as Device);
        await DeviceService.upsert({ token: 'expo-token-1' } as Device);

        const devices = await DeviceService.list();
        expect(devices.length).toBe(1);
        expect(devices[0].token).toBe('expo-token-1');
    });

    test('list returns every registered device', async () => {
        await DeviceService.upsert({ token: 'expo-token-2' } as Device);

        const tokens = (await DeviceService.list()).map(device => device.token);
        expect(tokens).toContain('expo-token-1');
        expect(tokens).toContain('expo-token-2');
    });

    test('list excludes a device disabled via disableByToken', async () => {
        await DeviceService.upsert({ token: 'expo-token-stale' } as Device);
        await DeviceService.disableByToken('expo-token-stale');

        const tokens = (await DeviceService.list()).map(device => device.token);
        expect(tokens).not.toContain('expo-token-stale');
    });

    test('disableByToken on an unknown token is a harmless no-op', async () => {
        await DeviceService.disableByToken('expo-token-never-registered');

        const tokens = (await DeviceService.list()).map(device => device.token);
        expect(tokens).toContain('expo-token-1');
    });
});
