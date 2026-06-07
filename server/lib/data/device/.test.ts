import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { MongoMemoryServer } from 'mongodb-memory-server';

import { Device } from '@lib/models';

// Imported in beforeAll after pointing Config at the in-memory Mongo (the shared pooled client reads
// the connection string on first use).
let mongod: MongoMemoryServer;
let Config: typeof import('@lib/config').default;
let DeviceService: typeof import('.').default;
let closeDatabase: typeof import('@lib/data/base').closeDatabase;

beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    Config = (await import('@lib/config')).default;
    Config.databaseConnectionString = mongod.getUri();
    DeviceService = (await import('.')).default;
    ({ closeDatabase } = await import('@lib/data/base'));
});

afterAll(async () => {
    await closeDatabase();
    await mongod.stop();
});

describe('DeviceService.upsert', () => {
    test('registers a token without creating duplicates on repeat', async () => {
        await DeviceService.upsert({ token: 'expo-token-1' } as Device);
        await DeviceService.upsert({ token: 'expo-token-1' } as Device);

        const devices = await DeviceService.find({});
        expect(devices.length).toBe(1);
        expect(devices[0].token).toBe('expo-token-1');
    });
});
